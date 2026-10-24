package com.meridian.pms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

@Entity
@Table(
        name = "production_records",
        uniqueConstraints = @UniqueConstraint(name = "uk_production_well_date", columnNames = {"well_id", "production_date"}),
        indexes = {
                @Index(name = "idx_production_date", columnList = "production_date"),
                @Index(name = "idx_production_well_date", columnList = "well_id, production_date")
        })
public class ProductionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "well_id", nullable = false)
    private Well well;

    @Column(name = "production_date", nullable = false)
    private LocalDate productionDate;

    @Column(name = "oil_bbl", nullable = false)
    private double oilBbl;

    @Column(name = "gas_mcf", nullable = false)
    private double gasMcf;

    @Column(name = "water_bbl", nullable = false)
    private double waterBbl;

    @Column(name = "hours_online", nullable = false)
    private double hoursOnline = 24;

    @Column(name = "wellhead_pressure_psi")
    private Double wellheadPressurePsi;

    @Column(name = "choke_size_64ths")
    private Double chokeSize64ths;

    @Column(length = 500)
    private String notes;

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

    public LocalDate getProductionDate() {
        return productionDate;
    }

    public void setProductionDate(LocalDate productionDate) {
        this.productionDate = productionDate;
    }

    public double getOilBbl() {
        return oilBbl;
    }

    public void setOilBbl(double oilBbl) {
        this.oilBbl = oilBbl;
    }

    public double getGasMcf() {
        return gasMcf;
    }

    public void setGasMcf(double gasMcf) {
        this.gasMcf = gasMcf;
    }

    public double getWaterBbl() {
        return waterBbl;
    }

    public void setWaterBbl(double waterBbl) {
        this.waterBbl = waterBbl;
    }

    public double getHoursOnline() {
        return hoursOnline;
    }

    public void setHoursOnline(double hoursOnline) {
        this.hoursOnline = hoursOnline;
    }

    public Double getWellheadPressurePsi() {
        return wellheadPressurePsi;
    }

    public void setWellheadPressurePsi(Double wellheadPressurePsi) {
        this.wellheadPressurePsi = wellheadPressurePsi;
    }

    public Double getChokeSize64ths() {
        return chokeSize64ths;
    }

    public void setChokeSize64ths(Double chokeSize64ths) {
        this.chokeSize64ths = chokeSize64ths;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public double getWaterCutPct() {
        double liquids = oilBbl + waterBbl;
        return liquids <= 0 ? 0 : waterBbl / liquids * 100.0;
    }
}
