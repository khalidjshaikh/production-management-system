package com.meridian.pms.service;

import com.meridian.pms.domain.Forecast;
import com.meridian.pms.domain.ForecastPoint;
import com.meridian.pms.domain.ProductionRecord;
import com.meridian.pms.domain.Well;
import com.meridian.pms.domain.WellStatus;
import com.meridian.pms.repository.DowntimeEventRepository;
import com.meridian.pms.repository.ForecastRepository;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.CommonDtos;
import com.meridian.pms.web.dto.DashboardDtos;
import com.meridian.pms.web.dto.ProductionDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final DateTimeFormatter OUTLOOK_FORMAT = DateTimeFormatter.ofPattern("MMM ''yy", Locale.US);

    private final WellRepository wellRepository;
    private final ProductionRecordRepository productionRepository;
    private final DowntimeEventRepository downtimeRepository;
    private final ForecastRepository forecastRepository;
    private final DowntimeService downtimeService;
    private final ProductionService productionService;

    public DashboardService(WellRepository wellRepository,
                            ProductionRecordRepository productionRepository,
                            DowntimeEventRepository downtimeRepository,
                            ForecastRepository forecastRepository,
                            DowntimeService downtimeService,
                            ProductionService productionService) {
        this.wellRepository = wellRepository;
        this.productionRepository = productionRepository;
        this.downtimeRepository = downtimeRepository;
        this.forecastRepository = forecastRepository;
        this.downtimeService = downtimeService;
        this.productionService = productionService;
    }

    public DashboardDtos.DashboardResponse summary(int requestedDays) {
        int days = Math.min(Math.max(requestedDays, 7), 365);
        LocalDate latest = productionRepository.findLatestProductionDate();
        LocalDate end = latest != null ? latest : LocalDate.now();
        LocalDate start = end.minusDays(days - 1L);
        LocalDate previousEnd = start.minusDays(1);
        LocalDate previousStart = previousEnd.minusDays(days - 1L);

        List<CommonDtos.DailyPoint> series = buildSeries(start, end);
        Totals current = totals(series, days);
        Totals previous = previousTotals(previousStart, previousEnd, days);

        long activeWells = wellRepository.countByStatus(WellStatus.PRODUCING);
        long totalWells = wellRepository.count();

        LocalDateTime rangeStart = start.atStartOfDay();
        LocalDateTime rangeEnd = end.plusDays(1).atStartOfDay().minusSeconds(1);
        double deferredOil = value(downtimeRepository.sumDeferredOilBetween(rangeStart, rangeEnd));
        double deferredGas = value(downtimeRepository.sumDeferredGasBetween(rangeStart, rangeEnd));
        double previousDeferredOil = value(downtimeRepository.sumDeferredOilBetween(
                previousStart.atStartOfDay(), start.atStartOfDay().minusSeconds(1)));

        double oilDelta = deltaPct(current.oilRate, previous.oilRate);
        double gasDelta = deltaPct(current.gasRate, previous.gasRate);
        double waterCutDelta = current.waterCut - previous.waterCut;
        double uptimeDelta = current.uptime - previous.uptime;
        double deferredDelta = deltaPct(deferredOil, previousDeferredOil);

        DashboardDtos.DashboardKpis kpis = new DashboardDtos.DashboardKpis(
                current.oilRate,
                current.gasRate,
                current.waterRate,
                current.waterCut,
                current.uptime,
                activeWells,
                totalWells,
                deferredOil,
                deferredGas,
                activeWells == 0 ? 0 : current.oilRate / activeWells,
                oilDelta,
                gasDelta,
                waterCutDelta,
                uptimeDelta,
                deferredDelta);

        List<DashboardDtos.FieldSlice> fields = fieldSlices(start, end, current.oilRate * days);
        List<DashboardDtos.TopWell> topWells = topWells(start, end, previousStart, previousEnd, days, current.oilRate * days);
        Outlook outlook = outlook(end);
        List<ProductionDtos.ProductionRecordView> recent = productionService.recent(6);
        List<DashboardDtos.RecentProduction> recentProduction = recent.stream()
                .map(r -> new DashboardDtos.RecentProduction(
                        r.id(), r.wellName(), r.productionDate(), r.oilBbl(), r.gasMcf(), r.waterBbl()))
                .toList();

        return new DashboardDtos.DashboardResponse(
                end,
                start,
                days,
                kpis,
                series,
                fields,
                topWells,
                downtimeService.recent(4),
                outlook.months(),
                outlook.wells(),
                recentProduction);
    }

    private List<CommonDtos.DailyPoint> buildSeries(LocalDate start, LocalDate end) {
        Map<LocalDate, CommonDtos.DailyPoint> points = productionRepository
                .aggregateDaily(start, end, null, null).stream()
                .collect(Collectors.toMap(ProductionRecordRepository.DailyAggregate::getDate,
                        this::toDailyPoint, (a, b) -> a, HashMap::new));
        List<CommonDtos.DailyPoint> series = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            series.add(points.getOrDefault(day, new CommonDtos.DailyPoint(day, 0, 0, 0, 0, 0, 0, 0)));
        }
        return series;
    }

    private CommonDtos.DailyPoint toDailyPoint(ProductionRecordRepository.DailyAggregate aggregate) {
        double oil = value(aggregate.getOil());
        double gas = value(aggregate.getGas());
        double water = value(aggregate.getWater());
        double hours = value(aggregate.getHours());
        long records = aggregate.getRecords() == null ? 0 : aggregate.getRecords();
        double capacity = records * 24.0;
        return new CommonDtos.DailyPoint(
                aggregate.getDate(), oil, gas, water,
                percent(water, oil + water),
                capacity <= 0 ? 0 : hours / capacity * 100,
                Math.max(0, capacity - hours),
                records);
    }

    private Totals totals(List<CommonDtos.DailyPoint> series, int days) {
        double oil = series.stream().mapToDouble(CommonDtos.DailyPoint::oil).sum();
        double gas = series.stream().mapToDouble(CommonDtos.DailyPoint::gas).sum();
        double water = series.stream().mapToDouble(CommonDtos.DailyPoint::water).sum();
        long records = series.stream().mapToLong(CommonDtos.DailyPoint::records).sum();
        double hours = series.stream().mapToDouble(p -> Math.max(0, p.records() * 24.0 - p.downtimeHours())).sum();
        return new Totals(oil / days, gas / days, water / days,
                percent(water, oil + water),
                records <= 0 ? 0 : hours / (records * 24.0) * 100);
    }

    private Totals previousTotals(LocalDate start, LocalDate end, int days) {
        List<ProductionRecordRepository.DailyAggregate> aggregates = productionRepository.aggregateDaily(start, end, null, null);
        double oil = aggregates.stream().mapToDouble(a -> value(a.getOil())).sum();
        double gas = aggregates.stream().mapToDouble(a -> value(a.getGas())).sum();
        double water = aggregates.stream().mapToDouble(a -> value(a.getWater())).sum();
        long records = aggregates.stream().mapToLong(a -> a.getRecords() == null ? 0 : a.getRecords()).sum();
        double hours = aggregates.stream().mapToDouble(a -> value(a.getHours())).sum();
        return new Totals(oil / days, gas / days, water / days,
                percent(water, oil + water),
                records <= 0 ? 0 : hours / (records * 24.0) * 100);
    }

    private List<DashboardDtos.FieldSlice> fieldSlices(LocalDate start, LocalDate end, double totalOil) {
        return productionRepository.aggregateByField(start, end).stream()
                .map(f -> {
                    double oil = value(f.getOil());
                    double gas = value(f.getGas());
                    double water = value(f.getWater());
                    long days = ChronoUnit.DAYS.between(start, end) + 1;
                    return new DashboardDtos.FieldSlice(
                            f.getField(),
                            oil / days,
                            gas / days,
                            water / days,
                            percent(water, oil + water),
                            f.getWells() == null ? 0 : f.getWells(),
                            totalOil <= 0 ? 0 : oil / totalOil * 100);
                })
                .sorted(Comparator.comparingDouble(DashboardDtos.FieldSlice::oilRate).reversed())
                .toList();
    }

    private List<DashboardDtos.TopWell> topWells(LocalDate start,
                                                 LocalDate end,
                                                 LocalDate previousStart,
                                                 LocalDate previousEnd,
                                                 int days,
                                                 double totalOil) {
        Map<Long, ProductionRecordRepository.WellAggregate> current = productionRepository.aggregateByWell(start, end).stream()
                .collect(Collectors.toMap(ProductionRecordRepository.WellAggregate::getWellId, Function.identity()));
        Map<Long, ProductionRecordRepository.WellAggregate> previous = productionRepository.aggregateByWell(previousStart, previousEnd).stream()
                .collect(Collectors.toMap(ProductionRecordRepository.WellAggregate::getWellId, Function.identity()));
        if (current.isEmpty()) {
            return List.of();
        }
        Map<Long, Well> wells = wellRepository.findAllById(current.keySet()).stream()
                .collect(Collectors.toMap(Well::getId, Function.identity()));

        return current.entrySet().stream()
                .filter(e -> wells.containsKey(e.getKey()))
                .sorted((a, b) -> Double.compare(value(b.getValue().getOil()), value(a.getValue().getOil())))
                .limit(6)
                .map(e -> {
                    Well well = wells.get(e.getKey());
                    ProductionRecordRepository.WellAggregate agg = e.getValue();
                    ProductionRecordRepository.WellAggregate prev = previous.get(e.getKey());
                    double oilRate = value(agg.getOil()) / days;
                    double prevRate = prev == null ? 0 : value(prev.getOil()) / days;
                    double waterCut = percent(value(agg.getWater()), value(agg.getOil()) + value(agg.getWater()));
                    double capacity = (agg.getRecords() == null ? 0 : agg.getRecords()) * 24.0;
                    return new DashboardDtos.TopWell(
                            well.getId(), well.getName(), well.getFieldName(),
                            well.getStatus(), well.getStatus().getLabel(),
                            well.getLiftType(), well.getLiftType() == null ? null : well.getLiftType().getLabel(),
                            oilRate,
                            value(agg.getGas()) / days,
                            waterCut,
                            capacity <= 0 ? 0 : value(agg.getHours()) / capacity * 100,
                            deltaPct(oilRate, prevRate),
                            totalOil <= 0 ? 0 : value(agg.getOil()) / totalOil * 100);
                })
                .toList();
    }

    private Outlook outlook(LocalDate latest) {
        List<Forecast> forecasts = forecastRepository.findAllByOrderByCreatedAtDesc();
        Map<Long, Forecast> latestByWell = new LinkedHashMap<>();
        for (Forecast forecast : forecasts) {
            latestByWell.putIfAbsent(forecast.getWell().getId(), forecast);
        }

        YearMonth firstMonth = YearMonth.from(latest).plusMonths(1);
        Map<YearMonth, double[]> buckets = new LinkedHashMap<>();
        for (int i = 0; i < 6; i++) {
            buckets.put(firstMonth.plusMonths(i), new double[]{0, 0});
        }
        for (Forecast forecast : latestByWell.values()) {
            for (ForecastPoint point : forecast.getPoints()) {
                YearMonth month = YearMonth.from(point.getForecastDate());
                double[] bucket = buckets.get(month);
                if (bucket != null) {
                    bucket[0] += point.getOilRate();
                    bucket[1] += point.getGasRate();
                }
            }
        }
        List<DashboardDtos.ForecastMonth> months = buckets.entrySet().stream()
                .map(e -> new DashboardDtos.ForecastMonth(
                        e.getKey().atDay(1),
                        e.getKey().atDay(1).format(OUTLOOK_FORMAT),
                        e.getValue()[0],
                        e.getValue()[1]))
                .toList();
        return new Outlook(months, latestByWell.size());
    }

    private double deltaPct(double current, double previous) {
        if (previous <= 0) {
            return 0;
        }
        return (current - previous) / previous * 100;
    }

    private double percent(double numerator, double denominator) {
        return denominator <= 0 ? 0 : numerator / denominator * 100;
    }

    private double value(Double value) {
        return value == null ? 0 : value;
    }

    private record Totals(double oilRate, double gasRate, double waterRate, double waterCut, double uptime) {
    }

    private record Outlook(List<DashboardDtos.ForecastMonth> months, int wells) {
    }
}
