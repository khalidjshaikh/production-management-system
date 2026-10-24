package com.meridian.pms.web.dto;

import com.meridian.pms.domain.DowntimeCategory;
import com.meridian.pms.domain.LiftType;
import com.meridian.pms.domain.WellStatus;

import java.time.LocalDate;
import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record DashboardKpis(
            double oilRate,
            double gasRate,
            double waterRate,
            double waterCutPct,
            double uptimePct,
            long activeWells,
            long totalWells,
            double deferredOilBbl,
            double deferredGasMcf,
            double avgOilPerWell,
            double oilDeltaPct,
            double gasDeltaPct,
            double waterCutDeltaPts,
            double uptimeDeltaPts,
            double deferredOilDeltaPct) {
    }

    public record FieldSlice(
            String field,
            double oilRate,
            double gasRate,
            double waterRate,
            double waterCutPct,
            long wells,
            double sharePct) {
    }

    public record TopWell(
            Long id,
            String name,
            String fieldName,
            WellStatus status,
            String statusLabel,
            LiftType liftType,
            String liftLabel,
            double oilRate,
            double gasRate,
            double waterCutPct,
            double uptimePct,
            double deltaPct,
            double sharePct) {
    }

    public record ForecastMonth(
            LocalDate month,
            String label,
            double oilRate,
            double gasRate) {
    }

    public record DashboardResponse(
            LocalDate latestDate,
            LocalDate rangeStart,
            int rangeDays,
            DashboardKpis kpis,
            List<CommonDtos.DailyPoint> series,
            List<FieldSlice> fields,
            List<TopWell> topWells,
            List<DowntimeDtos.DowntimeView> recentDowntime,
            List<ForecastMonth> outlook,
            int outlookWells,
            List<RecentProduction> recentProduction) {
    }

    public record RecentProduction(
            Long id,
            String wellName,
            LocalDate date,
            double oilBbl,
            double gasMcf,
            double waterBbl) {
    }
}
