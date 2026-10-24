package com.meridian.pms.web.dto;

import com.meridian.pms.domain.ForecastModel;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ForecastDtos {

    private ForecastDtos() {
    }

    public record ForecastSummary(
            Long id,
            Long wellId,
            String wellName,
            String fieldName,
            String name,
            ForecastModel model,
            String modelLabel,
            LocalDate baseDate,
            Instant createdAt,
            int horizonMonths,
            double qiOil,
            double diAnnualPct,
            double bFactor,
            double economicLimitBopd,
            double eurOilBbl,
            double nextMonthOilRate,
            List<Double> preview) {
    }

    public record ForecastPointView(
            int monthIndex,
            LocalDate date,
            double oilRate,
            double gasRate,
            double waterRate,
            double oilLowRate,
            double oilHighRate,
            double cumulativeOilBbl) {
    }

    public record ActualMonth(LocalDate month, double oilRate) {
    }

    public record ForecastDetail(
            ForecastSummary summary,
            List<ForecastPointView> points,
            List<ActualMonth> actuals,
            double initialWaterCutPct,
            double gorMcfPerBbl,
            double rSquared,
            int monitoredMonths) {
    }

    public record GenerateForecastRequest(
            @NotNull Long wellId,
            @NotNull ForecastModel model,
            @Min(6) @Max(60) Integer horizonMonths,
            @DecimalMin("1") @DecimalMax("10000") Double economicLimitBopd,
            @DecimalMin("0") @DecimalMax("1.2") Double bFactor,
            @Size(max = 140) String name) {
    }
}
