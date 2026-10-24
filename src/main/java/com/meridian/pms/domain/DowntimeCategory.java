package com.meridian.pms.domain;

public enum DowntimeCategory {
    PLANNED_MAINTENANCE("Planned maintenance"),
    EQUIPMENT_FAILURE("Equipment failure"),
    POWER_OUTAGE("Power outage"),
    WEATHER("Weather"),
    PIPELINE_CONSTRAINT("Pipeline constraint"),
    REGULATORY("Regulatory"),
    OTHER("Other");

    private final String label;

    DowntimeCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
