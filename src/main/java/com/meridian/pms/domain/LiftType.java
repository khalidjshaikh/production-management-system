package com.meridian.pms.domain;

public enum LiftType {
    FLOWING("Natural flow"),
    ESP("Electric submersible"),
    ROD_PUMP("Rod pump"),
    GAS_LIFT("Gas lift"),
    PLUNGER_LIFT("Plunger lift"),
    HYDRAULIC("Hydraulic");

    private final String label;

    LiftType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
