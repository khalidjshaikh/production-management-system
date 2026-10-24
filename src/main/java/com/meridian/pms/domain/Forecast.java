package com.meridian.pms.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "forecasts")
public class Forecast {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "well_id", nullable = false)
    private Well well;

    @Column(nullable = false, length = 140)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ForecastModel model;

    @Column(name = "base_date", nullable = false)
    private LocalDate baseDate;

    @Column(name = "qi_oil", nullable = false)
    private double qiOil;

    @Column(name = "qi_gas", nullable = false)
    private double qiGas;

    @Column(name = "qi_water", nullable = false)
    private double qiWater;

    @Column(name = "di_annual_pct", nullable = false)
    private double diAnnualPct;

    @Column(name = "b_factor", nullable = false)
    private double bFactor;

    @Column(name = "horizon_months", nullable = false)
    private int horizonMonths;

    @Column(name = "economic_limit_bopd", nullable = false)
    private double economicLimitBopd;

    @Column(name = "eur_oil_bbl", nullable = false)
    private double eurOilBbl;

    @Column(name = "r_squared", nullable = false)
    private double rSquared;

    @Column(name = "initial_water_cut_pct", nullable = false)
    private double initialWaterCutPct;

    @Column(name = "gor_mcf_per_bbl", nullable = false)
    private double gorMcfPerBbl;

    @Column(name = "monitored_months", nullable = false)
    private int monitoredMonths;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "forecast", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("monthIndex ASC")
    private List<ForecastPoint> points = new ArrayList<>();

    @jakarta.persistence.PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void addPoint(ForecastPoint point) {
        point.setForecast(this);
        points.add(point);
    }

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ForecastModel getModel() {
        return model;
    }

    public void setModel(ForecastModel model) {
        this.model = model;
    }

    public LocalDate getBaseDate() {
        return baseDate;
    }

    public void setBaseDate(LocalDate baseDate) {
        this.baseDate = baseDate;
    }

    public double getQiOil() {
        return qiOil;
    }

    public void setQiOil(double qiOil) {
        this.qiOil = qiOil;
    }

    public double getQiGas() {
        return qiGas;
    }

    public void setQiGas(double qiGas) {
        this.qiGas = qiGas;
    }

    public double getQiWater() {
        return qiWater;
    }

    public void setQiWater(double qiWater) {
        this.qiWater = qiWater;
    }

    public double getDiAnnualPct() {
        return diAnnualPct;
    }

    public void setDiAnnualPct(double diAnnualPct) {
        this.diAnnualPct = diAnnualPct;
    }

    public double getbFactor() {
        return bFactor;
    }

    public void setbFactor(double bFactor) {
        this.bFactor = bFactor;
    }

    public int getHorizonMonths() {
        return horizonMonths;
    }

    public void setHorizonMonths(int horizonMonths) {
        this.horizonMonths = horizonMonths;
    }

    public double getEconomicLimitBopd() {
        return economicLimitBopd;
    }

    public void setEconomicLimitBopd(double economicLimitBopd) {
        this.economicLimitBopd = economicLimitBopd;
    }

    public double getEurOilBbl() {
        return eurOilBbl;
    }

    public void setEurOilBbl(double eurOilBbl) {
        this.eurOilBbl = eurOilBbl;
    }

    public double getRSquared() {
        return rSquared;
    }

    public void setRSquared(double rSquared) {
        this.rSquared = rSquared;
    }

    public double getInitialWaterCutPct() {
        return initialWaterCutPct;
    }

    public void setInitialWaterCutPct(double initialWaterCutPct) {
        this.initialWaterCutPct = initialWaterCutPct;
    }

    public double getGorMcfPerBbl() {
        return gorMcfPerBbl;
    }

    public void setGorMcfPerBbl(double gorMcfPerBbl) {
        this.gorMcfPerBbl = gorMcfPerBbl;
    }

    public int getMonitoredMonths() {
        return monitoredMonths;
    }

    public void setMonitoredMonths(int monitoredMonths) {
        this.monitoredMonths = monitoredMonths;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<ForecastPoint> getPoints() {
        return points;
    }
}
