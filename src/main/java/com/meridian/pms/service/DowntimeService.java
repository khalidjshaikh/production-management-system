package com.meridian.pms.service;

import com.meridian.pms.domain.DowntimeCategory;
import com.meridian.pms.domain.DowntimeEvent;
import com.meridian.pms.domain.ProductionRecord;
import com.meridian.pms.domain.Well;
import com.meridian.pms.exception.BadRequestException;
import com.meridian.pms.exception.NotFoundException;
import com.meridian.pms.repository.DowntimeEventRepository;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.CommonDtos;
import com.meridian.pms.web.dto.DowntimeDtos;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class DowntimeService {

    private final DowntimeEventRepository downtimeRepository;
    private final ProductionRecordRepository productionRepository;
    private final WellRepository wellRepository;

    public DowntimeService(DowntimeEventRepository downtimeRepository,
                           ProductionRecordRepository productionRepository,
                           WellRepository wellRepository) {
        this.downtimeRepository = downtimeRepository;
        this.productionRepository = productionRepository;
        this.wellRepository = wellRepository;
    }

    public CommonDtos.PageResponse<DowntimeDtos.DowntimeView> list(String status,
                                                                   DowntimeCategory category,
                                                                   Long wellId,
                                                                   String field,
                                                                   int page,
                                                                   int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 200),
                Sort.by(Sort.Direction.DESC, "startTime"));
        Page<DowntimeEvent> events = downtimeRepository.findAll(buildSpecification(status, category, wellId, field), pageable);
        List<DowntimeDtos.DowntimeView> content = events.getContent().stream().map(this::toView).toList();
        return CommonDtos.PageResponse.of(content, events.getNumber(), events.getSize(), events.getTotalElements());
    }

    public List<DowntimeDtos.DowntimeView> recent(int limit) {
        return downtimeRepository.findRecent().stream().limit(Math.max(0, limit)).map(this::toView).toList();
    }

    public DowntimeDtos.DowntimeView get(Long id) {
        return toView(findEvent(id));
    }

    @Transactional
    public DowntimeDtos.DowntimeView create(DowntimeDtos.DowntimeUpsertRequest request) {
        Well well = findWell(request.wellId());
        validateTimes(request.startTime(), request.endTime());
        DowntimeEvent event = new DowntimeEvent();
        apply(event, request, well);
        return toView(downtimeRepository.save(event));
    }

    @Transactional
    public DowntimeDtos.DowntimeView update(Long id, DowntimeDtos.DowntimeUpsertRequest request) {
        DowntimeEvent event = findEvent(id);
        Well well = findWell(request.wellId());
        validateTimes(request.startTime(), request.endTime());
        apply(event, request, well);
        downtimeRepository.save(event);
        return toView(event);
    }

    @Transactional
    public void delete(Long id) {
        downtimeRepository.delete(findEvent(id));
    }

    private void apply(DowntimeEvent event, DowntimeDtos.DowntimeUpsertRequest request, Well well) {
        event.setWell(well);
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setCategory(request.category());
        event.setDescription(request.description().trim());
        event.setReportedBy(StringUtils.hasText(request.reportedBy()) ? request.reportedBy().trim() : "Operations");
        double durationHours = request.endTime() == null
                ? 24.0
                : Math.max(0, Duration.between(request.startTime(), request.endTime()).toMinutes() / 60.0);

        event.setDeferredOilBbl(request.deferredOilBbl() != null
                ? request.deferredOilBbl()
                : estimateDeferred(well.getId(), request.startTime(), true, durationHours));
        event.setDeferredGasMcf(request.deferredGasMcf() != null
                ? request.deferredGasMcf()
                : estimateDeferred(well.getId(), request.startTime(), false, durationHours));
    }

    private void validateTimes(LocalDateTime startTime, LocalDateTime endTime) {
        if (endTime != null && !endTime.isAfter(startTime)) {
            throw new BadRequestException("Downtime end time must be after the start time");
        }
    }

    /**
     * Estimates deferred volumes using the well's average daily rate over the 30 days before
     * the event. Active events are estimated over 24 hours until resolved.
     */
    private double estimateDeferred(Long wellId, LocalDateTime startTime, boolean oil, double durationHours) {
        LocalDate from = startTime.toLocalDate().minusDays(30);
        LocalDate to = startTime.toLocalDate().minusDays(1);
        List<ProductionRecord> records = productionRepository.findForWellBetween(wellId, from, to);
        if (records.isEmpty()) {
            return 0;
        }
        double total = records.stream().mapToDouble(r -> oil ? r.getOilBbl() : r.getGasMcf()).sum();
        double averageDaily = total / records.size();
        return Math.round(averageDaily * durationHours / 24.0 * 100.0) / 100.0;
    }

    public DowntimeDtos.DowntimeSummary summary(int requestedDays) {
        int days = Math.min(Math.max(requestedDays, 1), 365);
        LocalDate today = LocalDate.now();
        LocalDate rangeStart = today.minusDays(days - 1L);
        LocalDateTime start = rangeStart.atStartOfDay();
        LocalDateTime now = LocalDateTime.now();

        List<DowntimeEvent> events = downtimeRepository.findRelevantSince(start).stream()
                .filter(e -> !e.getStartTime().isAfter(now))
                .toList();

        double deferredOil = 0;
        double deferredGas = 0;
        long totalEvents = 0;
        long resolvedEvents = 0;
        double resolvedHours = 0;
        double totalHours = 0;

        Map<DowntimeCategory, CategoryAccumulator> categories = new EnumMap<>(DowntimeCategory.class);
        Map<LocalDate, Double> dailyHours = new HashMap<>();
        Map<LocalDate, Long> dailyEvents = new HashMap<>();

        for (DowntimeEvent event : events) {
            if (!event.getStartTime().isBefore(start)) {
                totalEvents++;
                deferredOil += value(event.getDeferredOilBbl());
                deferredGas += value(event.getDeferredGasMcf());
                dailyEvents.merge(event.getStartTime().toLocalDate(), 1L, Long::sum);
            }
            if (!event.isActive()) {
                resolvedEvents++;
                resolvedHours += event.getDurationHours();
            }

            double overlap = overlapHours(event, start, now.plusMinutes(1));
            totalHours += overlap;
            categories.computeIfAbsent(event.getCategory(), c -> new CategoryAccumulator())
                    .add(overlap, value(event.getDeferredOilBbl()));

            for (LocalDate day = rangeStart; !day.isAfter(today); day = day.plusDays(1)) {
                double dayOverlap = overlapHours(event, day.atStartOfDay(), day.plusDays(1).atStartOfDay());
                if (dayOverlap > 0) {
                    dailyHours.merge(day, dayOverlap, Double::sum);
                }
            }
        }

        List<DowntimeDtos.CategorySlice> slices = categories.entrySet().stream()
                .map(e -> new DowntimeDtos.CategorySlice(e.getKey().name(), e.getKey().getLabel(),
                        e.getValue().events, round(e.getValue().hours, 1), round(e.getValue().deferredOil, 1)))
                .sorted((a, b) -> Double.compare(b.hours(), a.hours()))
                .toList();

        List<DowntimeDtos.DailyDowntime> series = new ArrayList<>();
        for (LocalDate day = rangeStart; !day.isAfter(today); day = day.plusDays(1)) {
            series.add(new DowntimeDtos.DailyDowntime(day, round(dailyHours.getOrDefault(day, 0.0), 1),
                    dailyEvents.getOrDefault(day, 0L)));
        }

        long active = downtimeRepository.countByEndTimeIsNull();
        double averageResolution = resolvedEvents == 0 ? 0 : resolvedHours / resolvedEvents;

        return new DowntimeDtos.DowntimeSummary(days, totalEvents, active, round(totalHours, 1),
                round(deferredOil, 1), round(deferredGas, 1), round(averageResolution, 1), slices, series);
    }

    private double overlapHours(DowntimeEvent event, LocalDateTime windowStart, LocalDateTime windowEnd) {
        LocalDateTime eventStart = event.getStartTime();
        LocalDateTime eventEnd = event.getEndTime() == null ? LocalDateTime.now() : event.getEndTime();
        LocalDateTime overlapStart = eventStart.isAfter(windowStart) ? eventStart : windowStart;
        LocalDateTime overlapEnd = eventEnd.isBefore(windowEnd) ? eventEnd : windowEnd;
        if (!overlapEnd.isAfter(overlapStart)) {
            return 0;
        }
        return Duration.between(overlapStart, overlapEnd).toMinutes() / 60.0;
    }

    private Specification<DowntimeEvent> buildSpecification(String status,
                                                             DowntimeCategory category,
                                                             Long wellId,
                                                             String field) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(status)) {
                switch (status.toUpperCase(Locale.ROOT)) {
                    case "ACTIVE" -> predicates.add(cb.isNull(root.get("endTime")));
                    case "RESOLVED" -> predicates.add(cb.isNotNull(root.get("endTime")));
                    default -> {
                    }
                }
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (wellId != null) {
                predicates.add(cb.equal(root.get("well").get("id"), wellId));
            }
            if (StringUtils.hasText(field)) {
                Join<Object, Object> well = root.join("well");
                predicates.add(cb.equal(well.get("fieldName"), field));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private DowntimeEvent findEvent(Long id) {
        return downtimeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Downtime event " + id + " was not found"));
    }

    private Well findWell(Long id) {
        return wellRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Well " + id + " was not found"));
    }

    public DowntimeDtos.DowntimeView toView(DowntimeEvent event) {
        return new DowntimeDtos.DowntimeView(
                event.getId(),
                event.getWell().getId(),
                event.getWell().getName(),
                event.getWell().getFieldName(),
                event.getCategory(),
                event.getCategory().getLabel(),
                event.getDescription(),
                event.getStartTime(),
                event.getEndTime(),
                round(event.getDurationHours(), 1),
                event.isActive(),
                event.getDeferredOilBbl(),
                event.getDeferredGasMcf(),
                event.getReportedBy());
    }

    private double value(Double value) {
        return value == null ? 0 : value;
    }

    private double round(double value, int scale) {
        double factor = Math.pow(10, scale);
        return Math.round(value * factor) / factor;
    }

    private static final class CategoryAccumulator {
        private long events;
        private double hours;
        private double deferredOil;

        void add(double hours, double deferredOil) {
            if (hours > 0) {
                events++;
            }
            this.hours += hours;
            this.deferredOil += deferredOil;
        }
    }
}
