package com.meridian.pms.web.dto;

import com.meridian.pms.domain.LiftType;
import com.meridian.pms.domain.WellStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class WellDtos {

    private WellDtos() {
    }

    public record WellMetrics(
            double oilRate,
            double gasRate,
            double waterRate,
            double waterCutPct,
            double uptimePct,
            double oilDeltaPct,
            int days,
            long recordCount) {
    }

    public record WellView(
            Long id,
            String name,
            String apiNumber,
            String fieldName,
            String operator,
            String county,
            String state,
            WellStatus status,
            String statusLabel,
            LiftType liftType,
            String liftLabel,
            String targetFormation,
            LocalDate spudDate,
            LocalDate completionDate,
            Double totalDepthFt,
            Double lateralLengthFt,
            Double latitude,
            Double longitude,
            Instant updatedAt,
            WellMetrics metrics) {
    }

    public record WellDetail(
            WellView well,
            List<CommonDtos.DailyPoint> series,
            List<DowntimeDtos.DowntimeView> downtime) {
    }

    public record WellUpsertRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank
            @Pattern(regexp = "^[0-9A-Za-z-]{5,20}$", message = "must be 5-20 characters using numbers, letters or dashes")
            String apiNumber,
            @NotBlank @Size(max = 80) String fieldName,
            @NotBlank @Size(max = 100) String operator,
            @Size(max = 80) String county,
            @Size(max = 40) String state,
            @NotNull WellStatus status,
            LiftType liftType,
            @Size(max = 100) String targetFormation,
            LocalDate spudDate,
            LocalDate completionDate,
            @Positive Double totalDepthFt,
            @Positive Double lateralLengthFt,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude) {
    }
}
