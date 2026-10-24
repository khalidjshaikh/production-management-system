package com.meridian.pms.domain;

public enum WellStatus {
    PRODUCING("Producing"),
    SHUT_IN("Shut in"),
    COMPLETING("Completing"),
    DRILLING("Drilling"),
    PLUGGED("Plugged & abandoned");

    private final String label;

    WellStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
