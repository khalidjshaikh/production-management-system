package com.meridian.pms.domain;

public enum ForecastModel {
    EXPONENTIAL("Exponential decline"),
    HYPERBOLIC("Hyperbolic decline");

    private final String label;

    ForecastModel(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
