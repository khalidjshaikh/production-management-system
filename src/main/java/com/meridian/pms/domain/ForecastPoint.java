package com.meridian.pms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "forecast_points")
public class ForecastPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "forecast_id", nullable = false)
    private Forecast forecast;

    @Column(name = "month_index", nullable = false)
    private int monthIndex;

    @Column(name = "forecast_date", nullable = false)
    private LocalDate forecastDate;

    @Column(name = "oil_rate", nullable = false)
    private double oilRate;

    @Column(name = "gas_rate", nullable = false)
    private double gasRate;

    @Column(name = "water_rate", nullable = false)
    private double waterRate;

    @Column(name = "oil_low_rate", nullable = false)
    private double oilLowRate;

    @Column(name = "oil_high_rate", nullable = false)
    private double oilHighRate;

    @Column(name = "cumulative_oil_bbl", nullable = false)
    private double cumulativeOilBbl;

    public Long getId() {
        return id;
    }

    public Forecast getForecast() {
        return forecast;
    }

    public void setForecast(Forecast forecast) {
        this.forecast = forecast;
    }

    public int getMonthIndex() {
        return monthIndex;
    }

    public void setMonthIndex(int monthIndex) {
        this.monthIndex = monthIndex;
    }

    public LocalDate getForecastDate() {
        return forecastDate;
    }

    public void setForecastDate(LocalDate forecastDate) {
        this.forecastDate = forecastDate;
    }

    public double getOilRate() {
        return oilRate;
    }

    public void setOilRate(double oilRate) {
        this.oilRate = oilRate;
    }

    public double getGasRate() {
        return gasRate;
    }

    public void setGasRate(double gasRate) {
        this.gasRate = gasRate;
    }

    public double getWaterRate() {
        return waterRate;
    }

    public void setWaterRate(double waterRate) {
        this.waterRate = waterRate;
    }

    public double getOilLowRate() {
        return oilLowRate;
    }

    public void setOilLowRate(double oilLowRate) {
        this.oilLowRate = oilLowRate;
    }

    public double getOilHighRate() {
        return oilHighRate;
    }

    public void setOilHighRate(double oilHighRate) {
        this.oilHighRate = oilHighRate;
    }

    public double getCumulativeOilBbl() {
        return cumulativeOilBbl;
    }

    public void setCumulativeOilBbl(double cumulativeOilBbl) {
        this.cumulativeOilBbl = cumulativeOilBbl;
    }
}
