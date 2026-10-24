package com.meridian.pms.service;

import com.meridian.pms.domain.Forecast;
import com.meridian.pms.domain.ForecastModel;
import com.meridian.pms.domain.ForecastPoint;
import com.meridian.pms.domain.ProductionRecord;
import com.meridian.pms.domain.Well;
import com.meridian.pms.domain.WellStatus;
import com.meridian.pms.exception.BadRequestException;
import com.meridian.pms.exception.NotFoundException;
import com.meridian.pms.repository.ForecastRepository;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.ForecastDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class ForecastService {

    private static final double DAYS_PER_MONTH = 30.4375;
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("MMM ''yy", Locale.US);

    private final ForecastRepository forecastRepository;
    private final ProductionRecordRepository productionRepository;
    private final WellRepository wellRepository;
    private final DeclineCurveAnalyzer analyzer;

    public ForecastService(ForecastRepository forecastRepository,
                           ProductionRecordRepository productionRepository,
                           WellRepository wellRepository,
                           DeclineCurveAnalyzer analyzer) {
        this.forecastRepository = forecastRepository;
        this.productionRepository = productionRepository;
        this.wellRepository = wellRepository;
        this.analyzer = analyzer;
    }

    public List<ForecastDtos.ForecastSummary> list() {
        return forecastRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toSummary)
                .toList();
    }

    public List<ForecastDtos.ForecastSummary> forWell(Long wellId) {
        return forecastRepository.findByWellIdOrderByCreatedAtDesc(wellId).stream()
                .map(this::toSummary)
                .toList();
    }

    public ForecastDtos.ForecastDetail get(Long id) {
        Forecast forecast = findForecast(id);
        List<ForecastDtos.ForecastPointView> points = forecast.getPoints().stream()
                .sorted(Comparator.comparingInt(ForecastPoint::getMonthIndex))
                .map(p -> new ForecastDtos.ForecastPointView(
                        p.getMonthIndex(),
                        p.getForecastDate(),
                        round(p.getOilRate(), 1),
                        round(p.getGasRate(), 1),
                        round(p.getWaterRate(), 1),
                        round(p.getOilLowRate(), 1),
                        round(p.getOilHighRate(), 1),
                        round(p.getCumulativeOilBbl(), 0)))
                .toList();

        return new ForecastDtos.ForecastDetail(
                toSummary(forecast),
                points,
                actualMonths(forecast.getWell().getId(), forecast.getBaseDate()),
                round(forecast.getInitialWaterCutPct(), 1),
                round(forecast.getGorMcfPerBbl(), 3),
                round(forecast.getRSquared() * 100, 1),
                forecast.getMonitoredMonths());
    }

    @Transactional
    public ForecastDtos.ForecastDetail generate(ForecastDtos.GenerateForecastRequest request) {
        Well well = wellRepository.findById(request.wellId())
                .orElseThrow(() -> new NotFoundException("Well " + request.wellId() + " was not found"));
        if (well.getStatus() == WellStatus.DRILLING || well.getStatus() == WellStatus.COMPLETING) {
            throw new BadRequestException("This well has no production history to forecast");
        }

        LocalDate baseDate = productionRepository.findLatestProductionDateByWellId(well.getId());
        if (baseDate == null) {
            throw new BadRequestException("This well has no production records yet");
        }

        List<ProductionRecord> records = productionRepository.findForWellBetween(
                well.getId(), baseDate.minusMonths(24), baseDate);
        if (records.size() < 60) {
            throw new BadRequestException("At least 60 daily production records are required before forecasting");
        }

        Map<YearMonth, MonthAccumulator> monthly = aggregateByMonth(records);
        List<DeclineCurveAnalyzer.MonthlyRate> rates = monthly.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .limit(18)
                .map(e -> new DeclineCurveAnalyzer.MonthlyRate(
                        e.getKey().atDay(1), e.getValue().oil / Math.max(1, e.getValue().records)))
                .filter(r -> r.oilRate() > 0)
                .toList();
        if (rates.size() < 4) {
            throw new BadRequestException("At least four producing months are required to fit a decline curve");
        }

        int horizon = request.horizonMonths() != null ? request.horizonMonths() : 24;
        double economicLimit = request.economicLimitBopd() != null ? request.economicLimitBopd() : 15.0;
        DeclineCurveAnalyzer.Fit fit = analyzer.fit(rates, request.model(),
                request.model() == ForecastModel.HYPERBOLIC ? request.bFactor() : null);
        List<DeclineCurveAnalyzer.ProjectedPoint> projections = analyzer.project(fit, baseDate, horizon);
        double eur = analyzer.remainingRecoverableOil(fit, baseDate, economicLimit);

        List<ProductionRecord> recent = records.stream()
                .filter(r -> !r.getProductionDate().isBefore(baseDate.minusDays(90)))
                .toList();
        double recentOil = recent.stream().mapToDouble(ProductionRecord::getOilBbl).sum();
        double recentGas = recent.stream().mapToDouble(ProductionRecord::getGasMcf).sum();
        double recentWater = recent.stream().mapToDouble(ProductionRecord::getWaterBbl).sum();
        double gor = recentOil <= 0 ? 0 : recentGas / recentOil;
        double waterCut = recentOil + recentWater <= 0 ? 0 : recentWater / (recentOil + recentWater);
        double waterCutTrend = waterCutTrend(monthly);

        Forecast forecast = new Forecast();
        forecast.setWell(well);
        forecast.setName(StringUtils.hasText(request.name())
                ? request.name().trim()
                : "P50 base case · " + baseDate.format(MONTH_FORMAT));
        forecast.setModel(fit.model());
        forecast.setBaseDate(baseDate);
        forecast.setQiOil(round(fit.qi(), 1));
        forecast.setDiAnnualPct(round(fit.annualDeclinePct(), 1));
        forecast.setbFactor(round(fit.bFactor(), 2));
        forecast.setHorizonMonths(horizon);
        forecast.setEconomicLimitBopd(economicLimit);
        forecast.setEurOilBbl(round(eur, 0));
        forecast.setRSquared(fit.rSquared());
        forecast.setInitialWaterCutPct(round(waterCut * 100, 1));
        forecast.setGorMcfPerBbl(round(gor, 3));
        forecast.setMonitoredMonths(fit.months());

        double cumulativeOil = 0;
        for (DeclineCurveAnalyzer.ProjectedPoint projection : projections) {
            double wc = Math.min(0.98, waterCut + waterCutTrend * (projection.monthIndex() + 1));
            double waterRate = wc >= 0.98 ? projection.oilRate() * 49 : projection.oilRate() * wc / (1 - wc);
            double gasRate = projection.oilRate() * gor;
            cumulativeOil += projection.oilRate() * DAYS_PER_MONTH;

            ForecastPoint point = new ForecastPoint();
            point.setMonthIndex(projection.monthIndex());
            point.setForecastDate(projection.date());
            point.setOilRate(projection.oilRate());
            point.setGasRate(round(gasRate, 1));
            point.setWaterRate(round(waterRate, 1));
            point.setOilLowRate(projection.lowRate());
            point.setOilHighRate(projection.highRate());
            point.setCumulativeOilBbl(round(cumulativeOil, 0));
            forecast.addPoint(point);
        }

        forecast.setQiGas(forecast.getPoints().isEmpty() ? 0 : forecast.getPoints().getFirst().getGasRate());
        forecast.setQiWater(forecast.getPoints().isEmpty() ? 0 : forecast.getPoints().getFirst().getWaterRate());
        Forecast saved = forecastRepository.save(forecast);
        return get(saved.getId());
    }

    @Transactional
    public void delete(Long id) {
        forecastRepository.delete(findForecast(id));
    }

    private Forecast findForecast(Long id) {
        return forecastRepository.findDetailedById(id)
                .orElseThrow(() -> new NotFoundException("Forecast " + id + " was not found"));
    }

    private ForecastDtos.ForecastSummary toSummary(Forecast forecast) {
        List<Double> preview = forecast.getPoints().stream()
                .sorted(Comparator.comparingInt(ForecastPoint::getMonthIndex))
                .limit(12)
                .map(p -> round(p.getOilRate(), 1))
                .toList();
        double nextMonth = preview.isEmpty() ? 0 : preview.getFirst();
        return new ForecastDtos.ForecastSummary(
                forecast.getId(),
                forecast.getWell().getId(),
                forecast.getWell().getName(),
                forecast.getWell().getFieldName(),
                forecast.getName(),
                forecast.getModel(),
                forecast.getModel().getLabel(),
                forecast.getBaseDate(),
                forecast.getCreatedAt(),
                forecast.getHorizonMonths(),
                forecast.getQiOil(),
                forecast.getDiAnnualPct(),
                forecast.getbFactor(),
                forecast.getEconomicLimitBopd(),
                forecast.getEurOilBbl(),
                nextMonth,
                preview);
    }

    private List<ForecastDtos.ActualMonth> actualMonths(Long wellId, LocalDate baseDate) {
        LocalDate from = baseDate.minusMonths(11).withDayOfMonth(1);
        List<ProductionRecord> records = productionRepository.findForWellBetween(wellId, from, baseDate);
        Map<YearMonth, MonthAccumulator> monthly = aggregateByMonth(records);
        return monthly.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new ForecastDtos.ActualMonth(
                        e.getKey().atDay(1),
                        round(e.getValue().oil / Math.max(1, e.getValue().records), 1)))
                .toList();
    }

    private Map<YearMonth, MonthAccumulator> aggregateByMonth(List<ProductionRecord> records) {
        Map<YearMonth, MonthAccumulator> monthly = new LinkedHashMap<>();
        for (ProductionRecord record : records) {
            MonthAccumulator accumulator = monthly.computeIfAbsent(
                    YearMonth.from(record.getProductionDate()), key -> new MonthAccumulator());
            accumulator.oil += record.getOilBbl();
            accumulator.gas += record.getGasMcf();
            accumulator.water += record.getWaterBbl();
            accumulator.records++;
        }
        return monthly;
    }

    /**
     * Fits the recent monthly water-cut trend (fraction per month), bounded to a
     * non-negative 0.0–0.6 percentage-point monthly drift.
     */
    private double waterCutTrend(Map<YearMonth, MonthAccumulator> monthly) {
        List<Double> cuts = monthly.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .skip(Math.max(0, monthly.size() - 6L))
                .map(e -> {
                    double liquids = e.getValue().oil + e.getValue().water;
                    return liquids <= 0 ? 0 : e.getValue().water / liquids;
                })
                .toList();
        if (cuts.size() < 3) {
            return 0.0015;
        }
        double meanX = (cuts.size() - 1) / 2.0;
        double meanY = cuts.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double numerator = 0;
        double denominator = 0;
        for (int i = 0; i < cuts.size(); i++) {
            numerator += (i - meanX) * (cuts.get(i) - meanY);
            denominator += Math.pow(i - meanX, 2);
        }
        double slope = denominator == 0 ? 0 : numerator / denominator;
        return Math.max(0, Math.min(0.006, slope));
    }

    private double round(double value, int scale) {
        double factor = Math.pow(10, scale);
        return Math.round(value * factor) / factor;
    }

    private static final class MonthAccumulator {
        private double oil;
        private double gas;
        private double water;
        private long records;
    }
}
