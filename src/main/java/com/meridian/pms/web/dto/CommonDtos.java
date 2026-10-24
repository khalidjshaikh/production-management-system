package com.meridian.pms.web.dto;

import com.meridian.pms.domain.DowntimeCategory;
import com.meridian.pms.domain.ForecastModel;
import com.meridian.pms.domain.LiftType;
import com.meridian.pms.domain.WellStatus;
import org.springframework.data.domain.Page;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

public final class CommonDtos {

    private CommonDtos() {
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
        public static <T> PageResponse<T> from(Page<T> page) {
            return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(),
                    page.getTotalElements(), page.getTotalPages());
        }

        public static <T> PageResponse<T> of(List<T> content, int page, int size, long totalElements) {
            int totalPages = size == 0 ? 0 : (int) Math.ceil(totalElements / (double) size);
            return new PageResponse<>(content, page, size, totalElements, totalPages);
        }
    }

    public record DailyPoint(
            LocalDate date,
            double oil,
            double gas,
            double water,
            double waterCutPct,
            double uptimePct,
            double downtimeHours,
            long records) {
    }

    public record EnumOption(String value, String label) {
        public static EnumOption of(Enum<?> value, String label) {
            return new EnumOption(value.name(), label);
        }
    }

    public record MetaResponse(
            List<String> fields,
            List<String> operators,
            List<EnumOption> wellStatuses,
            List<EnumOption> liftTypes,
            List<EnumOption> downtimeCategories,
            List<EnumOption> forecastModels,
            LocalDate latestProductionDate,
            Map<String, Long> statusCounts) {

        public static MetaResponse create(List<String> fields, List<String> operators, LocalDate latestDate,
                                          Map<String, Long> statusCounts) {
            return new MetaResponse(
                    fields,
                    operators,
                    Arrays.stream(WellStatus.values())
                            .map(s -> EnumOption.of(s, s.getLabel())).toList(),
                    Arrays.stream(LiftType.values())
                            .map(s -> EnumOption.of(s, s.getLabel())).toList(),
                    Arrays.stream(DowntimeCategory.values())
                            .map(s -> EnumOption.of(s, s.getLabel())).toList(),
                    Arrays.stream(ForecastModel.values())
                            .map(s -> EnumOption.of(s, s.getLabel())).toList(),
                    latestDate,
                    statusCounts);
        }
    }
}
