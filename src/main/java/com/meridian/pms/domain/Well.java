package com.meridian.pms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "wells", uniqueConstraints = @UniqueConstraint(name = "uk_well_api", columnNames = "api_number"))
public class Well {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "api_number", nullable = false, length = 20)
    private String apiNumber;

    @Column(name = "field_name", nullable = false, length = 80)
    private String fieldName;

    @Column(nullable = false, length = 100)
    private String operator;

    @Column(length = 80)
    private String county;

    @Column(length = 40)
    private String state;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private WellStatus status = WellStatus.PRODUCING;

    @Enumerated(EnumType.STRING)
    @Column(name = "lift_type", length = 24)
    private LiftType liftType = LiftType.FLOWING;

    @Column(name = "target_formation", length = 100)
    private String targetFormation;

    @Column(name = "spud_date")
    private LocalDate spudDate;

    @Column(name = "completion_date")
    private LocalDate completionDate;

    @Column(name = "total_depth_ft")
    private Double totalDepthFt;

    @Column(name = "lateral_length_ft")
    private Double lateralLengthFt;

    private Double latitude;

    private Double longitude;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @jakarta.persistence.PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @jakarta.persistence.PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getApiNumber() {
        return apiNumber;
    }

    public void setApiNumber(String apiNumber) {
        this.apiNumber = apiNumber;
    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getCounty() {
        return county;
    }

    public void setCounty(String county) {
        this.county = county;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public WellStatus getStatus() {
        return status;
    }

    public void setStatus(WellStatus status) {
        this.status = status;
    }

    public LiftType getLiftType() {
        return liftType;
    }

    public void setLiftType(LiftType liftType) {
        this.liftType = liftType;
    }

    public String getTargetFormation() {
        return targetFormation;
    }

    public void setTargetFormation(String targetFormation) {
        this.targetFormation = targetFormation;
    }

    public LocalDate getSpudDate() {
        return spudDate;
    }

    public void setSpudDate(LocalDate spudDate) {
        this.spudDate = spudDate;
    }

    public LocalDate getCompletionDate() {
        return completionDate;
    }

    public void setCompletionDate(LocalDate completionDate) {
        this.completionDate = completionDate;
    }

    public Double getTotalDepthFt() {
        return totalDepthFt;
    }

    public void setTotalDepthFt(Double totalDepthFt) {
        this.totalDepthFt = totalDepthFt;
    }

    public Double getLateralLengthFt() {
        return lateralLengthFt;
    }

    public void setLateralLengthFt(Double lateralLengthFt) {
        this.lateralLengthFt = lateralLengthFt;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
