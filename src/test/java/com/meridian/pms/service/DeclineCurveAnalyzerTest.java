package com.meridian.pms.service;

import com.meridian.pms.domain.ForecastModel;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class DeclineCurveAnalyzerTest {

    private final DeclineCurveAnalyzer analyzer = new DeclineCurveAnalyzer();
    private final LocalDate firstMonth = LocalDate.of(2025, 1, 1);

    @Test
    void fitsExponentialDeclineAndProjectsASensibleRange() {
        List<DeclineCurveAnalyzer.MonthlyRate> rates = new ArrayList<>();
        for (int t = 0; t < 18; t++) {
            rates.add(new DeclineCurveAnalyzer.MonthlyRate(
                    firstMonth.plusMonths(t), 2_000 * Math.exp(-0.015 * t)));
        }

        DeclineCurveAnalyzer.Fit fit = analyzer.fit(rates, ForecastModel.EXPONENTIAL, null);

        assertThat(fit.qi()).isCloseTo(2_000, within(0.1));
        assertThat(fit.diMonthly()).isCloseTo(0.015, within(0.00001));
        assertThat(fit.bFactor()).isZero();
        assertThat(fit.rSquared()).isGreaterThan(0.999);
        assertThat(fit.annualDeclinePct()).isCloseTo(16.47, within(0.1));

        List<DeclineCurveAnalyzer.ProjectedPoint> projection =
                analyzer.project(fit, LocalDate.of(2026, 6, 22), 12);
        assertThat(projection).hasSize(12);
        assertThat(projection.getFirst().oilRate()).isLessThan(fit.qi());
        assertThat(projection.getLast().oilRate()).isLessThan(projection.getFirst().oilRate());
        projection.forEach(point -> {
            assertThat(point.lowRate()).isLessThanOrEqualTo(point.oilRate());
            assertThat(point.highRate()).isGreaterThanOrEqualTo(point.oilRate());
        });
    }

    @Test
    void fitsHyperbolicCurveWhenBFactorIsSupplied() {
        List<DeclineCurveAnalyzer.MonthlyRate> rates = new ArrayList<>();
        double qi = 1_800;
        double di = 0.012;
        double b = 0.7;
        for (int t = 0; t < 20; t++) {
            rates.add(new DeclineCurveAnalyzer.MonthlyRate(
                    firstMonth.plusMonths(t), qi / Math.pow(1 + b * di * t, 1 / b)));
        }

        DeclineCurveAnalyzer.Fit fit = analyzer.fit(rates, ForecastModel.HYPERBOLIC, b);

        assertThat(fit.model()).isEqualTo(ForecastModel.HYPERBOLIC);
        assertThat(fit.bFactor()).isEqualTo(0.7);
        assertThat(fit.qi()).isCloseTo(qi, within(1.0));
        assertThat(fit.diMonthly()).isCloseTo(di, within(0.0001));
        assertThat(fit.rSquared()).isGreaterThan(0.999);
        assertThat(analyzer.remainingRecoverableOil(fit, LocalDate.of(2026, 8, 1), 30))
                .isGreaterThan(1_000_000);
    }

    @Test
    void rejectsInsufficientHistory() {
        assertThatThrownBy(() -> analyzer.fit(List.of(
                new DeclineCurveAnalyzer.MonthlyRate(firstMonth, 1_000),
                new DeclineCurveAnalyzer.MonthlyRate(firstMonth.plusMonths(1), 990)),
                ForecastModel.EXPONENTIAL, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("three months");
    }

    @Test
    void higherEconomicLimitProducesLowerRecovery() {
        List<DeclineCurveAnalyzer.MonthlyRate> rates = new ArrayList<>();
        for (int t = 0; t < 18; t++) {
            rates.add(new DeclineCurveAnalyzer.MonthlyRate(
                    firstMonth.plusMonths(t), 1_500 * Math.exp(-0.02 * t)));
        }
        DeclineCurveAnalyzer.Fit fit = analyzer.fit(rates, ForecastModel.EXPONENTIAL, null);
        LocalDate base = LocalDate.of(2026, 6, 1);

        assertThat(analyzer.remainingRecoverableOil(fit, base, 10))
                .isGreaterThan(analyzer.remainingRecoverableOil(fit, base, 50));
    }
}
