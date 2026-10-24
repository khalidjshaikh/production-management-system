package com.meridian.pms.service;

import com.meridian.pms.domain.ProductionRecord;
import com.meridian.pms.domain.Well;
import com.meridian.pms.exception.BadRequestException;
import com.meridian.pms.exception.ConflictException;
import com.meridian.pms.exception.NotFoundException;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.CommonDtos;
import com.meridian.pms.web.dto.ProductionDtos;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@Transactional(readOnly = true)
public class ProductionService {

    private final ProductionRecordRepository productionRepository;
    private final WellRepository wellRepository;

    public ProductionService(ProductionRecordRepository productionRepository, WellRepository wellRepository) {
        this.productionRepository = productionRepository;
        this.wellRepository = wellRepository;
    }

    public ProductionDtos.ProductionPage search(Long wellId,
                                                String field,
                                                LocalDate from,
                                                LocalDate to,
                                                int page,
                                                int size) {
        LocalDate latest = latestDate();
        LocalDate end = to != null ? to : latest;
        LocalDate start = from != null ? from : end.minusDays(89);
        if (start.isAfter(end)) {
            throw new BadRequestException("The start date must be on or before the end date");
        }
        if (ChronoUnit.DAYS.between(start, end) > 731) {
            throw new BadRequestException("Select a production window of two years or less");
        }

        Page<ProductionRecord> results = productionRepository.findAll(
                buildSpecification(wellId, field, start, end),
                PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 500),
                        Sort.by(Sort.Order.desc("productionDate"), Sort.Order.desc("id"))));
        List<ProductionDtos.ProductionRecordView> records = results.getContent().stream().map(this::toView).toList();

        List<CommonDtos.DailyPoint> series = productionRepository.aggregateDaily(start, end, wellId, field).stream()
                .map(this::toDailyPoint)
                .toList();
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        double oil = series.stream().mapToDouble(CommonDtos.DailyPoint::oil).sum();
        double gas = series.stream().mapToDouble(CommonDtos.DailyPoint::gas).sum();
        double water = series.stream().mapToDouble(CommonDtos.DailyPoint::water).sum();
        double hours = series.stream().mapToDouble(p -> p.records() * 24.0 - p.downtimeHours()).sum();
        long recordCount = series.stream().mapToLong(CommonDtos.DailyPoint::records).sum();
        double capacity = recordCount * 24.0;
        double uptime = capacity <= 0 ? 0 : hours / capacity * 100;

        ProductionDtos.ProductionSummary summary = new ProductionDtos.ProductionSummary(
                oil,
                gas,
                water,
                days <= 0 ? 0 : oil / days,
                days <= 0 ? 0 : gas / days,
                days <= 0 ? 0 : water / days,
                percent(water, oil + water),
                uptime,
                results.getTotalElements(),
                start,
                end,
                series);

        return new ProductionDtos.ProductionPage(
                CommonDtos.PageResponse.of(records, results.getNumber(), results.getSize(), results.getTotalElements()),
                summary);
    }

    @Transactional
    public ProductionDtos.ProductionRecordView create(ProductionDtos.ProductionUpsertRequest request) {
        Well well = findWell(request.wellId());
        validateDate(request.productionDate());
        productionRepository.findByWellIdAndProductionDate(well.getId(), request.productionDate())
                .ifPresent(existing -> {
                    throw new ConflictException("A production record for " + well.getName() + " on "
                            + request.productionDate() + " already exists");
                });
        ProductionRecord record = new ProductionRecord();
        apply(record, well, request);
        return toView(productionRepository.save(record));
    }

    @Transactional
    public ProductionDtos.ProductionRecordView update(Long id, ProductionDtos.ProductionUpsertRequest request) {
        ProductionRecord record = findRecord(id);
        Well well = findWell(request.wellId());
        validateDate(request.productionDate());
        productionRepository.findByWellIdAndProductionDate(well.getId(), request.productionDate())
                .filter(existing -> !Objects.equals(existing.getId(), id))
                .ifPresent(existing -> {
                    throw new ConflictException("A production record for " + well.getName() + " on "
                            + request.productionDate() + " already exists");
                });
        apply(record, well, request);
        productionRepository.save(record);
        return toView(record);
    }

    @Transactional
    public void delete(Long id) {
        productionRepository.delete(findRecord(id));
    }

    public List<ProductionDtos.ProductionRecordView> recent(int limit) {
        return productionRepository.findAll(PageRequest.of(0, Math.max(0, limit),
                        Sort.by(Sort.Order.desc("productionDate"), Sort.Order.desc("id"))))
                .getContent().stream().map(this::toView).toList();
    }

    private void apply(ProductionRecord record, Well well, ProductionDtos.ProductionUpsertRequest request) {
        record.setWell(well);
        record.setProductionDate(request.productionDate());
        record.setOilBbl(request.oilBbl());
        record.setGasMcf(request.gasMcf());
        record.setWaterBbl(request.waterBbl());
        record.setHoursOnline(request.hoursOnline());
        record.setWellheadPressurePsi(request.wellheadPressurePsi());
        record.setChokeSize64ths(request.chokeSize64ths());
        record.setNotes(StringUtils.hasText(request.notes()) ? request.notes().trim() : null);
    }

    private void validateDate(LocalDate date) {
        if (date.isAfter(LocalDate.now())) {
            throw new BadRequestException("Production cannot be entered for a future date");
        }
    }

    private Specification<ProductionRecord> buildSpecification(Long wellId, String field, LocalDate from, LocalDate to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.between(root.get("productionDate"), from, to));
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

    private Well findWell(Long id) {
        return wellRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Well " + id + " was not found"));
    }

    private ProductionRecord findRecord(Long id) {
        return productionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Production record " + id + " was not found"));
    }

    public ProductionDtos.ProductionRecordView toView(ProductionRecord record) {
        double downtime = Math.max(0, 24.0 - record.getHoursOnline());
        return new ProductionDtos.ProductionRecordView(
                record.getId(),
                record.getWell().getId(),
                record.getWell().getName(),
                record.getWell().getFieldName(),
                record.getProductionDate(),
                record.getOilBbl(),
                record.getGasMcf(),
                record.getWaterBbl(),
                record.getWaterCutPct(),
                record.getHoursOnline(),
                downtime,
                record.getWellheadPressurePsi(),
                record.getChokeSize64ths(),
                record.getNotes());
    }

    private CommonDtos.DailyPoint toDailyPoint(ProductionRecordRepository.DailyAggregate aggregate) {
        double oil = value(aggregate.getOil());
        double gas = value(aggregate.getGas());
        double water = value(aggregate.getWater());
        double hours = value(aggregate.getHours());
        long records = aggregate.getRecords() == null ? 0 : aggregate.getRecords();
        double capacity = records * 24.0;
        return new CommonDtos.DailyPoint(
                aggregate.getDate(),
                oil,
                gas,
                water,
                percent(water, oil + water),
                capacity <= 0 ? 0 : hours / capacity * 100,
                Math.max(0, capacity - hours),
                records);
    }

    private LocalDate latestDate() {
        LocalDate latest = productionRepository.findLatestProductionDate();
        return latest != null ? latest : LocalDate.now();
    }

    private double percent(double numerator, double denominator) {
        return denominator <= 0 ? 0 : numerator / denominator * 100;
    }

    private double value(Double value) {
        return value == null ? 0 : value;
    }
}
