package com.meridian.pms.web.dto;

import com.meridian.pms.domain.DowntimeCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class DowntimeDtos {

    private DowntimeDtos() {
    }

    public record DowntimeView(
            Long id,
            Long wellId,
            String wellName,
            String fieldName,
            DowntimeCategory category,
            String categoryLabel,
            String description,
            LocalDateTime startTime,
            LocalDateTime endTime,
            double durationHours,
            boolean active,
            Double deferredOilBbl,
            Double deferredGasMcf,
            String reportedBy) {
    }

    public record DowntimeUpsertRequest(
            @NotNull Long wellId,
            @NotNull LocalDateTime startTime,
            LocalDateTime endTime,
            @NotNull DowntimeCategory category,
            @NotBlank @Size(max = 500) String description,
            @PositiveOrZero Double deferredOilBbl,
            @PositiveOrZero Double deferredGasMcf,
            @Size(max = 100) String reportedBy) {
    }

    public record CategorySlice(
            String category,
            String label,
            long events,
            double hours,
            double deferredOilBbl) {
    }

    public record DailyDowntime(LocalDate date, double hours, long events) {
    }

    public record DowntimeSummary(
            int rangeDays,
            long totalEvents,
            long activeEvents,
            double totalDowntimeHours,
            double deferredOilBbl,
            double deferredGasMcf,
            double avgResolutionHours,
            List<CategorySlice> categories,
            List<DailyDowntime> series) {
    }
}
