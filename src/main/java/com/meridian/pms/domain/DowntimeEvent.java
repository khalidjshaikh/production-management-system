package com.meridian.pms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "downtime_events", indexes = {
        @Index(name = "idx_downtime_start", columnList = "start_time"),
        @Index(name = "idx_downtime_well", columnList = "well_id")
})
public class DowntimeEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "well_id", nullable = false)
    private Well well;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DowntimeCategory category;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "deferred_oil_bbl")
    private Double deferredOilBbl;

    @Column(name = "deferred_gas_mcf")
    private Double deferredGasMcf;

    @Column(name = "reported_by", length = 100)
    private String reportedBy;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Well getWell() {
        return well;
    }

    public void setWell(Well well) {
        this.well = well;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public DowntimeCategory getCategory() {
        return category;
    }

    public void setCategory(DowntimeCategory category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Double getDeferredOilBbl() {
        return deferredOilBbl;
    }

    public void setDeferredOilBbl(Double deferredOilBbl) {
        this.deferredOilBbl = deferredOilBbl;
    }

    public Double getDeferredGasMcf() {
        return deferredGasMcf;
    }

    public void setDeferredGasMcf(Double deferredGasMcf) {
        this.deferredGasMcf = deferredGasMcf;
    }

    public String getReportedBy() {
        return reportedBy;
    }

    public void setReportedBy(String reportedBy) {
        this.reportedBy = reportedBy;
    }

    public boolean isActive() {
        return endTime == null;
    }

    public double getDurationHours() {
        LocalDateTime end = endTime == null ? LocalDateTime.now() : endTime;
        return Math.max(0, Duration.between(startTime, end).toMinutes() / 60.0);
    }
}
