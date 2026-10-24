package com.meridian.pms.service;

import com.meridian.pms.domain.ForecastModel;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Decline-curve analysis for oil wells. Fits an Arps exponential or hyperbolic
 * curve to monthly oil rates and projects future rates with a P10/P90-style band.
 */
public class DeclineCurveAnalyzer {

    private static final double DAYS_PER_MONTH = 30.4375;

    public record MonthlyRate(LocalDate month, double oilRate) {
    }

    public record Fit(
            ForecastModel model,
            LocalDate firstMonth,
            int months,
            double qi,
            double diMonthly,
            double bFactor,
            double rSquared) {

        public double rateAt(int monthOffset) {
            if (model == ForecastModel.HYPERBOLIC || bFactor > 0.0001) {
                return qi / Math.pow(1.0 + bFactor * diMonthly * monthOffset, 1.0 / bFactor);
            }
            return qi * Math.exp(-diMonthly * monthOffset);
        }

        public double annualDeclinePct() {
            double afterTwelve = rateAt(12);
            return qi <= 0 ? 0 : (1.0 - afterTwelve / qi) * 100.0;
        }
    }

    public record ProjectedPoint(LocalDate date, int monthIndex, double oilRate, double lowRate, double highRate) {
    }

    /**
     * Fits a decline curve to the supplied monthly rates. The first month is treated as t=0.
     */
    public Fit fit(List<MonthlyRate> monthlyRates, ForecastModel model, Double fixedBFactor) {
        if (monthlyRates == null || monthlyRates.size() < 3) {
            throw new IllegalArgumentException("At least three months of production history are required");
        }
        List<MonthlyRate> points = monthlyRates.stream()
                .filter(p -> p.oilRate() > 0)
                .toList();
        if (points.size() < 3) {
            throw new IllegalArgumentException("At least three producing months are required");
        }

        LocalDate firstMonth = points.getFirst().month();
        if (model == ForecastModel.EXPONENTIAL) {
            return fitExponential(points, firstMonth);
        }
        Fit hyperbolic = fitHyperbolic(points, firstMonth, fixedBFactor);
        return hyperbolic != null ? hyperbolic : fitExponential(points, firstMonth);
    }

    private Fit fitExponential(List<MonthlyRate> points, LocalDate firstMonth) {
        int n = points.size();
        double[] x = new double[n];
        double[] y = new double[n];
        double sumX = 0;
        double sumY = 0;
        for (int i = 0; i < n; i++) {
            x[i] = ChronoUnit.MONTHS.between(YearMonth.from(firstMonth), YearMonth.from(points.get(i).month()));
            y[i] = Math.log(points.get(i).oilRate());
            sumX += x[i];
            sumY += y[i];
        }
        double meanX = sumX / n;
        double meanY = sumY / n;
        double covariance = 0;
        double varianceX = 0;
        for (int i = 0; i < n; i++) {
            covariance += (x[i] - meanX) * (y[i] - meanY);
            varianceX += (x[i] - meanX) * (x[i] - meanX);
        }
        double slope = varianceX == 0 ? 0 : covariance / varianceX;
        double diMonthly = Math.max(0.0001, -slope);
        double qi = Math.exp(meanY - slope * meanX);

        Fit fit = new Fit(ForecastModel.EXPONENTIAL, firstMonth, n, qi, diMonthly, 0.0, 0.0);
        double rSquared = rSquared(points, fit);
        return new Fit(fit.model(), fit.firstMonth(), n, qi, diMonthly, 0.0, rSquared);
    }

    private Fit fitHyperbolic(List<MonthlyRate> points, LocalDate firstMonth, Double fixedBFactor) {
        double referenceQi = points.getFirst().oilRate();
        double[] t = new double[points.size()];
        for (int i = 0; i < points.size(); i++) {
            t[i] = ChronoUnit.MONTHS.between(YearMonth.from(firstMonth), YearMonth.from(points.get(i).month()));
        }

        double bestSse = Double.MAX_VALUE;
        double bestQi = referenceQi;
        double bestDi = 0.01;
        double bestB = fixedBFactor != null ? fixedBFactor : 0.8;

        double[] bValues;
        if (fixedBFactor != null) {
            bValues = new double[]{fixedBFactor};
        } else {
            bValues = new double[]{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2};
        }

        for (double b : bValues) {
            if (b <= 0.001) {
                continue;
            }
            for (double qiFactor = 0.75; qiFactor <= 1.2501; qiFactor += 0.05) {
                double qi = referenceQi * qiFactor;
                double numerator = 0;
                double denominator = 0;
                for (int i = 0; i < points.size(); i++) {
                    if (t[i] == 0) {
                        continue;
                    }
                    double transformed = Math.pow(qi / points.get(i).oilRate(), b) - 1.0;
                    numerator += t[i] * transformed;
                    denominator += t[i] * t[i];
                }
                if (denominator == 0) {
                    continue;
                }
                double di = numerator / denominator / b;
                if (di <= 0.00005 || di > 0.5) {
                    continue;
                }
                double sse = 0;
                for (int i = 0; i < points.size(); i++) {
                    double predicted = qi / Math.pow(1.0 + b * di * t[i], 1.0 / b);
                    double error = points.get(i).oilRate() - predicted;
                    sse += error * error;
                }
                if (sse < bestSse) {
                    bestSse = sse;
                    bestQi = qi;
                    bestDi = di;
                    bestB = b;
                }
            }
        }

        Fit fit = new Fit(ForecastModel.HYPERBOLIC, firstMonth, points.size(), bestQi, bestDi, bestB, 0.0);
        return new Fit(fit.model(), fit.firstMonth(), points.size(), bestQi, bestDi, bestB, rSquared(points, fit));
    }

    private double rSquared(List<MonthlyRate> points, Fit fit) {
        double mean = points.stream().mapToDouble(MonthlyRate::oilRate).average().orElse(0);
        double sse = 0;
        double sst = 0;
        for (MonthlyRate point : points) {
            double offset = ChronoUnit.MONTHS.between(YearMonth.from(fit.firstMonth()), YearMonth.from(point.month()));
            double predicted = fit.rateAt((int) offset);
            double error = point.oilRate() - predicted;
            sse += error * error;
            sst += Math.pow(point.oilRate() - mean, 2);
        }
        if (sst <= 0) {
            return 1;
        }
        return Math.max(0, Math.min(1, 1 - sse / sst));
    }

    /**
     * Projects the fitted curve. Sensitivity assumptions: low case carries 12% lower initial
     * rate and 25% faster decline; high case carries 10% higher initial rate and 20% slower decline.
     */
    public List<ProjectedPoint> project(Fit fit, LocalDate baseDate, int horizonMonths) {
        List<ProjectedPoint> points = new ArrayList<>();
        LocalDate baseMonth = YearMonth.from(baseDate).atDay(1);
        for (int i = 0; i < horizonMonths; i++) {
            LocalDate month = baseMonth.plusMonths(i + 1);
            int offset = (int) ChronoUnit.MONTHS.between(YearMonth.from(fit.firstMonth()), YearMonth.from(month));
            double baseRate = fit.rateAt(offset);
            double lowRate = rate(fit.qi() * 0.88, fit.diMonthly() * 1.25, fit.bFactor(), offset);
            double highRate = rate(fit.qi() * 1.10, fit.diMonthly() * 0.80, fit.bFactor(), offset);
            points.add(new ProjectedPoint(
                    month,
                    i,
                    round(baseRate, 2),
                    round(Math.min(lowRate, baseRate), 2),
                    round(Math.max(highRate, baseRate), 2)));
        }
        return points;
    }

    /**
     * Remaining recoverable oil from the base date to the economic limit, using monthly
     * volumes and a 600-month cap.
     */
    public double remainingRecoverableOil(Fit fit, LocalDate baseDate, double economicLimitBopd) {
        double eur = 0;
        LocalDate baseMonth = YearMonth.from(baseDate).atDay(1);
        for (int i = 1; i <= 600; i++) {
            LocalDate month = baseMonth.plusMonths(i);
            int offset = (int) ChronoUnit.MONTHS.between(YearMonth.from(fit.firstMonth()), YearMonth.from(month));
            double rate = fit.rateAt(offset);
            if (rate <= economicLimitBopd) {
                break;
            }
            eur += rate * DAYS_PER_MONTH;
        }
        return eur;
    }

    public double rate(Fit fit, LocalDate date) {
        int offset = (int) ChronoUnit.MONTHS.between(YearMonth.from(fit.firstMonth()), YearMonth.from(date));
        return fit.rateAt(offset);
    }

    private double rate(double qi, double diMonthly, double b, int offset) {
        if (b > 0.0001) {
            return qi / Math.pow(1.0 + b * diMonthly * offset, 1.0 / b);
        }
        return qi * Math.exp(-diMonthly * offset);
    }

    private double round(double value, int scale) {
        double factor = Math.pow(10, scale);
        return Math.round(value * factor) / factor;
    }
}
