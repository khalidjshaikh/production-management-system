package com.meridian.pms.service;

import com.meridian.pms.domain.LiftType;
import com.meridian.pms.domain.Well;
import com.meridian.pms.domain.WellStatus;
import com.meridian.pms.exception.BadRequestException;
import com.meridian.pms.exception.ConflictException;
import com.meridian.pms.exception.NotFoundException;
import com.meridian.pms.repository.DowntimeEventRepository;
import com.meridian.pms.repository.ForecastRepository;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.CommonDtos;
import com.meridian.pms.web.dto.DowntimeDtos;
import com.meridian.pms.web.dto.WellDtos;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class WellService {

    private static final int METRIC_WINDOW_DAYS = 30;
    private static final int DEFAULT_SERIES_DAYS = 180;

    private final WellRepository wellRepository;
    private final ProductionRecordRepository productionRepository;
    private final DowntimeEventRepository downtimeRepository;
    private final ForecastRepository forecastRepository;
    private final DowntimeService downtimeService;

    public WellService(WellRepository wellRepository,
                       ProductionRecordRepository productionRepository,
                       DowntimeEventRepository downtimeRepository,
                       ForecastRepository forecastRepository,
                       DowntimeService downtimeService) {
        this.wellRepository = wellRepository;
        this.productionRepository = productionRepository;
        this.downtimeRepository = downtimeRepository;
        this.forecastRepository = forecastRepository;
        this.downtimeService = downtimeService;
    }

    public CommonDtos.PageResponse<WellDtos.WellView> list(String search,
                                                           WellStatus status,
                                                           String field,
                                                           LiftType liftType,
                                                           int page,
                                                           int size,
                                                           String sort) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 200), resolveSort(sort));
        Specification<Well> spec = buildSpecification(search, status, field, liftType);
        Page<Well> results = wellRepository.findAll(spec, pageable);

        LocalDate end = latestDate();
        LocalDate start = end.minusDays(METRIC_WINDOW_DAYS - 1L);
        LocalDate previousEnd = start.minusDays(1);
        LocalDate previousStart = previousEnd.minusDays(METRIC_WINDOW_DAYS - 1L);

        Map<Long, WellAggregate> current = aggregates(start, end);
        Map<Long, WellAggregate> previous = aggregates(previousStart, previousEnd);

        List<WellDtos.WellView> content = results.getContent().stream()
                .map(well -> toView(well, current.get(well.getId()), previous.get(well.getId()), METRIC_WINDOW_DAYS))
                .toList();
        return CommonDtos.PageResponse.of(content, results.getNumber(), results.getSize(), results.getTotalElements());
    }

    public WellDtos.WellDetail getDetail(Long id) {
        Well well = findWell(id);
        LocalDate wellLatest = productionRepository.findLatestProductionDateByWellId(id);
        LocalDate end = wellLatest != null ? wellLatest : latestDate();
        LocalDate start = end.minusDays(DEFAULT_SERIES_DAYS - 1L);
        LocalDate metricsStart = end.minusDays(METRIC_WINDOW_DAYS - 1L);
        LocalDate previousEnd = metricsStart.minusDays(1);
        LocalDate previousStart = previousEnd.minusDays(METRIC_WINDOW_DAYS - 1L);

        List<CommonDtos.DailyPoint> series = dailyPoints(
                productionRepository.aggregateDaily(start, end, id, null));
        WellDtos.WellView view = toView(well,
                aggregate(metricsStart, end, id),
                aggregate(previousStart, previousEnd, id),
                METRIC_WINDOW_DAYS);

        List<DowntimeDtos.DowntimeView> downtime = downtimeRepository.findForWell(id).stream()
                .limit(6)
                .map(downtimeService::toView)
                .toList();
        return new WellDtos.WellDetail(view, series, downtime);
    }

    public WellDtos.WellView get(Long id) {
        Well well = findWell(id);
        LocalDate end = latestDate();
        LocalDate start = end.minusDays(METRIC_WINDOW_DAYS - 1L);
        LocalDate previousEnd = start.minusDays(1);
        LocalDate previousStart = previousEnd.minusDays(METRIC_WINDOW_DAYS - 1L);
        return toView(well, aggregate(start, end, id), aggregate(previousStart, previousEnd, id), METRIC_WINDOW_DAYS);
    }

    @Transactional
    public WellDtos.WellView create(WellDtos.WellUpsertRequest request) {
        String api = normalizeApi(request.apiNumber());
        if (wellRepository.existsByApiNumberIgnoreCase(api)) {
            throw new ConflictException("A well with API number " + api + " already exists");
        }
        Well well = new Well();
        apply(well, request, api);
        return toView(wellRepository.save(well), null, null, METRIC_WINDOW_DAYS);
    }

    @Transactional
    public WellDtos.WellView update(Long id, WellDtos.WellUpsertRequest request) {
        Well well = findWell(id);
        String api = normalizeApi(request.apiNumber());
        if (wellRepository.existsByApiNumberIgnoreCaseAndIdNot(api, id)) {
            throw new ConflictException("A well with API number " + api + " already exists");
        }
        apply(well, request, api);
        wellRepository.save(well);
        return get(id);
    }

    @Transactional
    public void delete(Long id) {
        Well well = findWell(id);
        productionRepository.deleteByWellId(id);
        downtimeRepository.deleteByWellId(id);
        forecastRepository.deleteByWellId(id);
        wellRepository.delete(well);
    }

    public Well findWell(Long id) {
        return wellRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Well " + id + " was not found"));
    }

    private void apply(Well well, WellDtos.WellUpsertRequest request, String api) {
        if (request.spudDate() != null && request.completionDate() != null
                && request.completionDate().isBefore(request.spudDate())) {
            throw new BadRequestException("Completion date cannot be before the spud date");
        }
        well.setName(clean(request.name()));
        well.setApiNumber(api);
        well.setFieldName(clean(request.fieldName()));
        well.setOperator(clean(request.operator()));
        well.setCounty(clean(request.county()));
        well.setState(clean(request.state()));
        well.setStatus(request.status());
        well.setLiftType(request.liftType());
        well.setTargetFormation(clean(request.targetFormation()));
        well.setSpudDate(request.spudDate());
        well.setCompletionDate(request.completionDate());
        well.setTotalDepthFt(request.totalDepthFt());
        well.setLateralLengthFt(request.lateralLengthFt());
        well.setLatitude(request.latitude());
        well.setLongitude(request.longitude());
    }

    private String normalizeApi(String api) {
        return clean(api) == null ? null : clean(api).toUpperCase(Locale.ROOT);
    }

    private String clean(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private Specification<Well> buildSpecification(String search, WellStatus status, String field, LiftType liftType) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(search)) {
                String like = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("apiNumber")), like),
                        cb.like(cb.lower(root.get("fieldName")), like),
                        cb.like(cb.lower(root.get("operator")), like)));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (StringUtils.hasText(field)) {
                predicates.add(cb.equal(root.get("fieldName"), field));
            }
            if (liftType != null) {
                predicates.add(cb.equal(root.get("liftType"), liftType));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Sort resolveSort(String sort) {
        if (!StringUtils.hasText(sort)) {
            return Sort.by(Sort.Direction.ASC, "name");
        }
        return switch (sort) {
            case "-name", "name_desc" -> Sort.by(Sort.Direction.DESC, "name");
            case "fieldName" -> Sort.by(Sort.Direction.ASC, "fieldName").and(Sort.by("name"));
            case "-fieldName" -> Sort.by(Sort.Direction.DESC, "fieldName").and(Sort.by("name"));
            case "-completionDate" -> Sort.by(Sort.Direction.DESC, "completionDate");
            case "completionDate" -> Sort.by(Sort.Direction.ASC, "completionDate");
            case "-spudDate" -> Sort.by(Sort.Direction.DESC, "spudDate");
            case "status" -> Sort.by(Sort.Direction.ASC, "status").and(Sort.by("name"));
            default -> Sort.by(Sort.Direction.ASC, "name");
        };
    }

    private Map<Long, WellAggregate> aggregates(LocalDate from, LocalDate to) {
        return productionRepository.aggregateByWell(from, to).stream()
                .collect(Collectors.toMap(ProductionRecordRepository.WellAggregate::getWellId,
                        WellAggregate::from, (a, b) -> a, HashMap::new));
    }

    private WellAggregate aggregate(LocalDate from, LocalDate to, Long wellId) {
        return productionRepository.aggregateByWell(from, to).stream()
                .filter(a -> a.getWellId().equals(wellId))
                .findFirst()
                .map(WellAggregate::from)
                .orElse(new WellAggregate(0, 0, 0, 0, 0));
    }

    private List<CommonDtos.DailyPoint> dailyPoints(List<ProductionRecordRepository.DailyAggregate> aggregates) {
        return aggregates.stream().map(a -> {
            double hours = value(a.getHours());
            double records = value(a.getRecords());
            double capacity = records * 24.0;
            double waterCut = ratio(value(a.getWater()), value(a.getOil()) + value(a.getWater())) * 100;
            return new CommonDtos.DailyPoint(a.getDate(), value(a.getOil()), value(a.getGas()), value(a.getWater()),
                    waterCut, capacity <= 0 ? 0 : hours / capacity * 100, Math.max(0, capacity - hours), a.getRecords());
        }).toList();
    }

    private WellDtos.WellView toView(Well well, WellAggregate current, WellAggregate previous, int windowDays) {
        WellAggregate c = current == null ? new WellAggregate(0, 0, 0, 0, 0) : current;
        WellAggregate p = previous == null ? new WellAggregate(0, 0, 0, 0, 0) : previous;
        double oilRate = c.oil / windowDays;
        double gasRate = c.gas / windowDays;
        double waterRate = c.water / windowDays;
        double waterCut = ratio(c.water, c.oil + c.water) * 100;
        double capacity = c.records * 24.0;
        double uptime = capacity <= 0 ? 0 : c.hours / capacity * 100;
        double previousOilRate = p.oil / windowDays;
        double delta = previousOilRate <= 0 ? 0 : (oilRate - previousOilRate) / previousOilRate * 100;

        WellDtos.WellMetrics metrics = new WellDtos.WellMetrics(
                oilRate, gasRate, waterRate, waterCut, uptime, delta, windowDays, c.records);
        return new WellDtos.WellView(
                well.getId(), well.getName(), well.getApiNumber(), well.getFieldName(), well.getOperator(),
                well.getCounty(), well.getState(), well.getStatus(), well.getStatus().getLabel(),
                well.getLiftType(), well.getLiftType() == null ? null : well.getLiftType().getLabel(),
                well.getTargetFormation(), well.getSpudDate(), well.getCompletionDate(),
                well.getTotalDepthFt(), well.getLateralLengthFt(), well.getLatitude(), well.getLongitude(),
                well.getUpdatedAt(), metrics);
    }

    private LocalDate latestDate() {
        LocalDate latest = productionRepository.findLatestProductionDate();
        return latest != null ? latest : LocalDate.now();
    }

    private double ratio(double numerator, double denominator) {
        return denominator <= 0 ? 0 : numerator / denominator;
    }

    private double value(Double value) {
        return value == null ? 0 : value;
    }

    private double value(Number value) {
        return value == null ? 0 : value.doubleValue();
    }

    private record WellAggregate(double oil, double gas, double water, double hours, long records) {
        static WellAggregate from(ProductionRecordRepository.WellAggregate aggregate) {
            return new WellAggregate(
                    aggregate.getOil() == null ? 0 : aggregate.getOil(),
                    aggregate.getGas() == null ? 0 : aggregate.getGas(),
                    aggregate.getWater() == null ? 0 : aggregate.getWater(),
                    aggregate.getHours() == null ? 0 : aggregate.getHours(),
                    aggregate.getRecords() == null ? 0 : aggregate.getRecords());
        }
    }
}
