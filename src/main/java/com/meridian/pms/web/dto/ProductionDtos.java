package com.meridian.pms.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public final class ProductionDtos {

    private ProductionDtos() {
    }

    public record ProductionRecordView(
            Long id,
            Long wellId,
            String wellName,
            String fieldName,
            LocalDate productionDate,
            double oilBbl,
            double gasMcf,
            double waterBbl,
            double waterCutPct,
            double hoursOnline,
            double downtimeHours,
            Double wellheadPressurePsi,
            Double chokeSize64ths,
            String notes) {
    }

    public record ProductionSummary(
            double oilBbl,
            double gasMcf,
            double waterBbl,
            double oilRate,
            double gasRate,
            double waterRate,
            double waterCutPct,
            double uptimePct,
            long records,
            LocalDate from,
            LocalDate to,
            List<CommonDtos.DailyPoint> series) {
    }

    public record ProductionPage(
            CommonDtos.PageResponse<ProductionRecordView> records,
            ProductionSummary summary) {
    }

    public record ProductionUpsertRequest(
            @NotNull Long wellId,
            @NotNull LocalDate productionDate,
            @PositiveOrZero double oilBbl,
            @PositiveOrZero double gasMcf,
            @PositiveOrZero double waterBbl,
            @DecimalMin("0") @DecimalMax("24") double hoursOnline,
            @PositiveOrZero Double wellheadPressurePsi,
            @PositiveOrZero Double chokeSize64ths,
            @Size(max = 500) String notes) {
    }
}
