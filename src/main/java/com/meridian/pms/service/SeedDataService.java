package com.meridian.pms.service;

import com.meridian.pms.domain.DowntimeCategory;
import com.meridian.pms.domain.DowntimeEvent;
import com.meridian.pms.domain.ForecastModel;
import com.meridian.pms.domain.LiftType;
import com.meridian.pms.domain.ProductionRecord;
import com.meridian.pms.domain.Well;
import com.meridian.pms.domain.WellStatus;
import com.meridian.pms.repository.DowntimeEventRepository;
import com.meridian.pms.repository.ForecastRepository;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.ForecastDtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Creates a deterministic 18-month production history for a realistic 18-well
 * asset. Seeding is idempotent and only runs against an empty database.
 */
@Service
public class SeedDataService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDataService.class);
    private static final int HISTORY_DAYS = 540;

    private static final Map<DowntimeCategory, String[]> DESCRIPTIONS = Map.of(
            DowntimeCategory.PLANNED_MAINTENANCE, new String[]{
                    "Scheduled ESP change-out", "Planned rod pump maintenance", "Valve and flange inspection"},
            DowntimeCategory.EQUIPMENT_FAILURE, new String[]{
                    "ESP electrical fault", "Rod pump failure — downhole", "Gas lift compressor trip",
                    "Surface flowline leak"},
            DowntimeCategory.POWER_OUTAGE, new String[]{
                    "Grid outage on rural feeder", "Substation breaker trip", "Co-op power interruption"},
            DowntimeCategory.WEATHER, new String[]{
                    "Winter storm — access restricted", "Lightning shutdown", "High wind operations curtailment"},
            DowntimeCategory.PIPELINE_CONSTRAINT, new String[]{
                    "Gathering line pressure constraint", "Midstream capacity curtailment",
                    "Saltwater disposal line restriction"},
            DowntimeCategory.REGULATORY, new String[]{
                    "Regulatory inspection hold", "Flaring limit — permit condition",
                    "H2S monitoring calibration"},
            DowntimeCategory.OTHER, new String[]{
                    "Road closure — lease access", "Third-party compressor station maintenance"}
    );

    private static final String[] CREW = {
            "D. Ramirez", "T. Okafor", "M. Chen", "A. Novak", "J. Whitfield", "S. Patel"
    };

    private final WellRepository wellRepository;
    private final ProductionRecordRepository productionRepository;
    private final DowntimeEventRepository downtimeRepository;
    private final ForecastRepository forecastRepository;
    private final ForecastService forecastService;
    private final boolean enabled;

    public SeedDataService(WellRepository wellRepository,
                           ProductionRecordRepository productionRepository,
                           DowntimeEventRepository downtimeRepository,
                           ForecastRepository forecastRepository,
                           ForecastService forecastService,
                           @Value("${app.seed.enabled:true}") boolean enabled) {
        this.wellRepository = wellRepository;
        this.productionRepository = productionRepository;
        this.downtimeRepository = downtimeRepository;
        this.forecastRepository = forecastRepository;
        this.forecastService = forecastService;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled || wellRepository.count() > 0) {
            return;
        }
        LocalDate today = LocalDate.now();
        Random random = new Random(20261021L);

        List<Well> wells = createWells(today);
        wellRepository.saveAll(wells);
        log.info("Seeding {} wells", wells.size());

        Map<String, Well> byName = new HashMap<>();
        wells.forEach(well -> byName.put(well.getName(), well));
        List<WellSeed> seeds = wellSeeds();
        Map<String, WellSeed> seedByName = new HashMap<>();
        seeds.forEach(seed -> seedByName.put(seed.name(), seed));

        List<DowntimeEvent> events = new ArrayList<>();
        Map<Long, List<DowntimeEvent>> eventsByWell = new HashMap<>();

        for (Well well : wells) {
            WellSeed seed = seedByName.get(well.getName());
            if (seed == null || seed.lastProductionDay(today) == null) {
                continue;
            }
            LocalDate productionStart = productionStart(well, today);
            LocalDate lastProductionDay = seed.lastProductionDay(today);
            eventsByWell.put(well.getId(),
                    createEvents(well, seed, productionStart, lastProductionDay, today, random));
        }

        addOngoingEvents(byName, eventsByWell, today);
        addActiveOperationsEvents(byName, seedByName, eventsByWell, today);
        eventsByWell.values().forEach(events::addAll);
        downtimeRepository.saveAll(events);
        log.info("Seeded {} downtime events", events.size());

        List<ProductionRecord> records = new ArrayList<>();
        for (Well well : wells) {
            WellSeed seed = seedByName.get(well.getName());
            if (seed == null || seed.lastProductionDay(today) == null) {
                continue;
            }
            LocalDate productionStart = productionStart(well, today);
            LocalDate lastProductionDay = seed.lastProductionDay(today);
            List<DowntimeEvent> wellEvents = eventsByWell.getOrDefault(well.getId(), List.of());
            long dayIndex = 0;
            for (LocalDate date = productionStart; !date.isAfter(lastProductionDay); date = date.plusDays(1), dayIndex++) {
                records.add(createProduction(well, seed, date, dayIndex, wellEvents));
            }
        }
        productionRepository.saveAll(records);
        log.info("Seeded {} daily production records", records.size());

        if (forecastRepository.count() == 0) {
            seedForecasts(byName);
        }
        log.info("Seed complete — production console is ready");
    }

    private LocalDate productionStart(Well well, LocalDate today) {
        LocalDate historyStart = today.minusDays(HISTORY_DAYS);
        if (well.getCompletionDate() == null) {
            return historyStart;
        }
        LocalDate start = well.getCompletionDate().plusDays(2);
        return start.isBefore(historyStart) ? historyStart : start;
    }

    private List<Well> createWells(LocalDate today) {
        List<Well> wells = new ArrayList<>();
        for (WellSeed seed : wellSeeds()) {
            Well well = new Well();
            well.setName(seed.name());
            well.setApiNumber(seed.apiNumber());
            well.setFieldName(seed.field());
            well.setOperator(seed.operator());
            well.setCounty(seed.county());
            well.setState(seed.state());
            well.setStatus(seed.status());
            well.setLiftType(seed.liftType());
            well.setTargetFormation(seed.formation());
            well.setSpudDate(today.minusDays(seed.spudDaysAgo()));
            if (seed.status() != WellStatus.DRILLING && seed.status() != WellStatus.COMPLETING) {
                well.setCompletionDate(today.minusDays(seed.completionDaysAgo()));
            }
            well.setTotalDepthFt(seed.depthFt());
            well.setLateralLengthFt(seed.lateralFt());
            well.setLatitude(seed.latitude());
            well.setLongitude(seed.longitude());
            wells.add(well);
        }
        return wells;
    }

    private List<DowntimeEvent> createEvents(Well well,
                                             WellSeed seed,
                                             LocalDate productionStart,
                                             LocalDate lastProductionDay,
                                             LocalDate today,
                                             Random random) {
        List<DowntimeEvent> events = new ArrayList<>();
        long span = ChronoUnit.DAYS.between(productionStart, lastProductionDay);
        if (span < 30) {
            return events;
        }
        int count = 4 + random.nextInt(5);
        double slot = span / (double) (count + 1);
        LocalDate latestStart = lastProductionDay.minusDays(Math.min(5, Math.max(2, span / 20)));

        for (int i = 0; i < count; i++) {
            long offset = Math.round(slot * (i + 1) + (random.nextDouble() - 0.5) * slot * 0.55);
            offset = Math.max(2, Math.min(offset, span - 2));
            LocalDate startDay = productionStart.plusDays(offset);
            if (startDay.isAfter(latestStart)) {
                continue;
            }
            DowntimeCategory category = weightedCategory(random);
            double hours = durationHours(category, random);
            LocalDateTime start = startDay.atTime(randomTime(random));
            LocalDateTime end = start.plusMinutes(Math.round(hours * 60));
            LocalDateTime now = LocalDateTime.now();
            if (end.isAfter(now)) {
                end = now.minusMinutes(20 + random.nextInt(90));
            }
            if (!end.isAfter(start.plusMinutes(20))) {
                continue;
            }
            long eventHours = Duration.between(start, end).toMinutes() / 60;
            double potentialOil = potentialOil(seed, productionStart, start.toLocalDate());
            double potentialGas = potentialOil * seed.gor();
            DowntimeEvent event = new DowntimeEvent();
            event.setWell(well);
            event.setStartTime(start);
            event.setEndTime(end);
            event.setCategory(category);
            event.setDescription(description(category, random));
            event.setDeferredOilBbl(round(potentialOil * eventHours / 24.0, 1));
            event.setDeferredGasMcf(round(potentialGas * eventHours / 24.0, 1));
            event.setReportedBy(CREW[random.nextInt(CREW.length)]);
            events.add(event);
        }
        events.sort(Comparator.comparing(DowntimeEvent::getStartTime));
        return events;
    }

    private void addOngoingEvents(Map<String, Well> wells,
                                  Map<Long, List<DowntimeEvent>> eventsByWell,
                                  LocalDate today) {
        addOngoing(wells, eventsByWell, "Pronghorn 8H-4", today.minusDays(25).atTime(6, 0),
                DowntimeCategory.EQUIPMENT_FAILURE,
                "Shut in — ESP failure; replacement unit awaiting rig availability",
                "D. Ramirez", 1180, 0.012, 1.5);
        addOngoing(wells, eventsByWell, "Yucca 1H-6", today.minusDays(53).atTime(9, 30),
                DowntimeCategory.PIPELINE_CONSTRAINT,
                "Shut in pending gathering system debottleneck; producer curtailed",
                "M. Chen", 880, 0.018, 1.0);
    }

    private void addOngoing(Map<String, Well> wells,
                            Map<Long, List<DowntimeEvent>> eventsByWell,
                            String name,
                            LocalDateTime start,
                            DowntimeCategory category,
                            String description,
                            String reportedBy,
                            double qi,
                            double decline,
                            double gor) {
        Well well = wells.get(name);
        if (well == null) {
            return;
        }
        double months = Math.max(0, ChronoUnit.DAYS.between(well.getCompletionDate(), start.toLocalDate()) / 30.4375);
        double rate = qi * Math.exp(-decline * months);
        double hours = Math.max(1, Duration.between(start, LocalDateTime.now()).toMinutes() / 60.0);
        DowntimeEvent event = new DowntimeEvent();
        event.setWell(well);
        event.setStartTime(start);
        event.setEndTime(null);
        event.setCategory(category);
        event.setDescription(description);
        event.setDeferredOilBbl(round(rate * hours / 24.0, 1));
        event.setDeferredGasMcf(round(rate * gor * hours / 24.0, 1));
        event.setReportedBy(reportedBy);
        eventsByWell.computeIfAbsent(well.getId(), id -> new ArrayList<>()).add(event);
    }

    private void addActiveOperationsEvents(Map<String, Well> wells,
                                           Map<String, WellSeed> seeds,
                                           Map<Long, List<DowntimeEvent>> eventsByWell,
                                           LocalDate today) {
        addActiveEvent(wells, seeds, eventsByWell, "Juniper 4H-9", today.minusDays(1).atTime(6, 0),
                DowntimeCategory.POWER_OUTAGE,
                "Substation outage — co-op crews restoring service", "T. Okafor", 44);
        addActiveEvent(wells, seeds, eventsByWell, "Cactus Flats 2H-8", today.minusDays(2).atTime(12, 0),
                DowntimeCategory.PIPELINE_CONSTRAINT,
                "Gathering line pressure above tariff; production curtailed", "A. Novak", 20);
    }

    private void addActiveEvent(Map<String, Well> wells,
                                Map<String, WellSeed> seeds,
                                Map<Long, List<DowntimeEvent>> eventsByWell,
                                String name,
                                LocalDateTime start,
                                DowntimeCategory category,
                                String description,
                                String reportedBy,
                                double choke) {
        Well well = wells.get(name);
        WellSeed seed = seeds.get(name);
        if (well == null || seed == null) {
            return;
        }
        double months = Math.max(0, ChronoUnit.DAYS.between(well.getCompletionDate(), start.toLocalDate()) / 30.4375);
        double rate = seed.qi() * Math.exp(-seed.monthlyDecline() * months);
        double hours = Math.max(1, Duration.between(start, LocalDateTime.now()).toMinutes() / 60.0);
        DowntimeEvent event = new DowntimeEvent();
        event.setWell(well);
        event.setStartTime(start);
        event.setEndTime(null);
        event.setCategory(category);
        event.setDescription(description);
        event.setDeferredOilBbl(round(rate * hours / 24.0, 1));
        event.setDeferredGasMcf(round(rate * seed.gor() * hours / 24.0, 1));
        event.setReportedBy(reportedBy);
        eventsByWell.computeIfAbsent(well.getId(), id -> new ArrayList<>()).add(event);
    }

    private ProductionRecord createProduction(Well well,
                                              WellSeed seed,
                                              LocalDate date,
                                              long dayIndex,
                                              List<DowntimeEvent> events) {
        double offline = downtimeHours(events, date);
        offline = Math.min(24, offline);
        double online = Math.max(0, 24 - offline);
        double months = Math.max(0, ChronoUnit.DAYS.between(well.getCompletionDate(), date) / 30.4375);
        double potentialOil = seed.qi() * Math.exp(-seed.monthlyDecline() * months);

        double seasonal = 1 + 0.028 * Math.sin(dayIndex * 0.113 + seed.seed())
                + 0.018 * Math.sin(dayIndex * 0.47 + seed.seed() * 1.7);
        long hash = (dayIndex * 1_103_515_245L + seed.seed() * 12_345L) & 0x7fffffffL;
        double jitter = (hash % 1000) / 1000.0 - 0.5;
        double oil = Math.max(0, potentialOil * seasonal * (1 + jitter * 0.045) * online / 24.0);

        double waterCut = clamp(seed.initialWaterCut() + seed.waterCutGrowth() * months
                + 0.009 * Math.sin(dayIndex * 0.071 + seed.seed() * 2.1), 0.015, 0.965);
        double water = waterCut >= 0.999 ? oil * 100 : oil * waterCut / (1 - waterCut);
        double gas = oil * seed.gor() * (1 + 0.025 * Math.sin(dayIndex * 0.23 + seed.seed()));

        ProductionRecord record = new ProductionRecord();
        record.setWell(well);
        record.setProductionDate(date);
        record.setOilBbl(round(oil, 2));
        record.setGasMcf(round(gas, 2));
        record.setWaterBbl(round(water, 2));
        record.setHoursOnline(round(online, 2));
        record.setWellheadPressurePsi(round(Math.max(90,
                seed.wellheadPressure() * (1 - 0.22 * Math.min(months / 18.0, 1.0))
                        + 22 * Math.sin(dayIndex * 0.051 + seed.seed())), 1));
        record.setChokeSize64ths(seed.choke() + (dayIndex % 120 < 60 ? 0 : 2));
        if (online > 0 && dayIndex > 0 && dayIndex % 167 == 0) {
            record.setNotes("Choke adjusted to hold drawdown within target");
        }
        return record;
    }

    private double downtimeHours(List<DowntimeEvent> events, LocalDate date) {
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();
        LocalDateTime now = LocalDateTime.now();
        double total = 0;
        for (DowntimeEvent event : events) {
            LocalDateTime start = event.getStartTime().isAfter(dayStart) ? event.getStartTime() : dayStart;
            LocalDateTime rawEnd = event.getEndTime() == null ? now : event.getEndTime();
            LocalDateTime end = rawEnd.isBefore(dayEnd) ? rawEnd : dayEnd;
            if (end.isAfter(start)) {
                total += Duration.between(start, end).toMinutes() / 60.0;
            }
        }
        return total;
    }

    private double potentialOil(WellSeed seed, LocalDate productionStart, LocalDate date) {
        double months = Math.max(0, ChronoUnit.DAYS.between(productionStart, date) / 30.4375);
        return seed.qi() * Math.exp(-seed.monthlyDecline() * months);
    }

    private void seedForecasts(Map<String, Well> wells) {
        record Seed(String well, ForecastModel model, int horizon, double limit, Double b) {
        }
        List<Seed> seeds = List.of(
                new Seed("Rattlesnake 12H-3", ForecastModel.HYPERBOLIC, 24, 20, 0.8),
                new Seed("Antelope 8H-1", ForecastModel.EXPONENTIAL, 18, 25, null),
                new Seed("Juniper 3H-7", ForecastModel.HYPERBOLIC, 36, 30, 0.9),
                new Seed("Mesquite 5H-1", ForecastModel.EXPONENTIAL, 24, 10, null),
                new Seed("Cactus Flats 4H-11", ForecastModel.HYPERBOLIC, 24, 15, 0.7));
        for (Seed seed : seeds) {
            Well well = wells.get(seed.well());
            if (well == null) {
                continue;
            }
            try {
                forecastService.generate(new ForecastDtos.GenerateForecastRequest(
                        well.getId(), seed.model(), seed.horizon(), seed.limit(), seed.b(), null));
            } catch (RuntimeException ex) {
                log.warn("Could not seed forecast for {}: {}", seed.well(), ex.getMessage());
            }
        }
        log.info("Seeded {} example forecasts", forecastRepository.count());
    }

    private DowntimeCategory weightedCategory(Random random) {
        int roll = random.nextInt(100);
        if (roll < 23) {
            return DowntimeCategory.EQUIPMENT_FAILURE;
        }
        if (roll < 42) {
            return DowntimeCategory.PLANNED_MAINTENANCE;
        }
        if (roll < 56) {
            return DowntimeCategory.PIPELINE_CONSTRAINT;
        }
        if (roll < 68) {
            return DowntimeCategory.POWER_OUTAGE;
        }
        if (roll < 80) {
            return DowntimeCategory.WEATHER;
        }
        if (roll < 87) {
            return DowntimeCategory.REGULATORY;
        }
        return DowntimeCategory.OTHER;
    }

    private double durationHours(DowntimeCategory category, Random random) {
        return switch (category) {
            case PLANNED_MAINTENANCE -> 6 + random.nextInt(26);
            case EQUIPMENT_FAILURE -> 14 + random.nextInt(82);
            case POWER_OUTAGE -> 2 + random.nextInt(15);
            case WEATHER -> 8 + random.nextInt(64);
            case PIPELINE_CONSTRAINT -> 14 + random.nextInt(104);
            case REGULATORY -> 10 + random.nextInt(40);
            case OTHER -> 4 + random.nextInt(22);
        };
    }

    private String description(DowntimeCategory category, Random random) {
        String[] options = DESCRIPTIONS.get(category);
        return options[random.nextInt(options.length)];
    }

    private LocalTime randomTime(Random random) {
        return LocalTime.of(4 + random.nextInt(16), random.nextBoolean() ? 0 : 30);
    }

    private double round(double value, int scale) {
        double factor = Math.pow(10, scale);
        return Math.round(value * factor) / factor;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private List<WellSeed> wellSeeds() {
        return List.of(
                new WellSeed("Rattlesnake 12H-3", "42-301-34567", "Spraberry", "Midland", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ESP, "Spraberry Sand",
                        1120, 830, 10_840, 9_620, 31.9973, -102.0779,
                        1_850, 0.0110, 0.24, 0.0035, 1.8, 1_840, 34, 11),
                new WellSeed("Rattlesnake 14H-5", "42-301-34591", "Spraberry", "Midland", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ESP, "Wolfcamp B",
                        1040, 760, 11_250, 8_950, 32.0211, -102.1012,
                        1_420, 0.0130, 0.31, 0.0040, 2.1, 1_610, 30, 22),
                new WellSeed("Antelope 8H-1", "42-475-33822", "Wolfcamp", "Upton", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.GAS_LIFT, "Wolfcamp A",
                        1250, 940, 12_180, 10_230, 31.3694, -102.0487,
                        2_260, 0.0090, 0.18, 0.0028, 1.45, 2_180, 42, 33),
                new WellSeed("Antelope 9H-2", "42-475-33851", "Wolfcamp", "Upton", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ESP, "Wolfcamp A",
                        1180, 890, 11_960, 9_880, 31.3881, -102.0213,
                        1_675, 0.0120, 0.27, 0.0030, 1.65, 1_920, 36, 44),
                new WellSeed("Juniper 3H-7", "33-053-09412", "Bakken", "McKenzie", "ND",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.GAS_LIFT, "Middle Bakken",
                        980, 705, 19_460, 9_940, 47.7215, -103.3128,
                        2_450, 0.0140, 0.12, 0.0020, 3.2, 2_740, 40, 55),
                new WellSeed("Juniper 4H-9", "33-053-09438", "Bakken", "McKenzie", "ND",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ESP, "Three Forks",
                        910, 640, 20_120, 10_400, 47.7532, -103.2844,
                        1_980, 0.0150, 0.16, 0.0024, 3.0, 2_560, 38, 66),
                new WellSeed("Bighorn 21H-2", "33-105-04177", "Bakken", "Williams", "ND",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ROD_PUMP, "Middle Bakken",
                        1370, 1_090, 18_870, 8_120, 48.1642, -102.9421,
                        1_520, 0.0125, 0.22, 0.0030, 2.7, 1_480, 28, 77),
                new WellSeed("Bighorn 22H-4", "33-105-04203", "Bakken", "Williams", "ND",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ROD_PUMP, "Three Forks",
                        1280, 1_010, 19_240, 8_640, 48.1880, -102.9113,
                        1_210, 0.0160, 0.35, 0.0042, 2.4, 1_320, 26, 88),
                new WellSeed("Mesquite 5H-1", "42-255-33109", "Eagle Ford", "Karnes", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ROD_PUMP, "Eagle Ford Shale",
                        1230, 960, 13_480, 6_780, 28.8847, -97.9012,
                        980, 0.0170, 0.41, 0.0050, 0.9, 1_090, 24, 99),
                new WellSeed("Mesquite 6H-2", "42-255-33142", "Eagle Ford", "Karnes", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ROD_PUMP, "Eagle Ford Shale",
                        1160, 900, 13_100, 6_420, 28.9110, -97.8725,
                        760, 0.0190, 0.47, 0.0055, 1.1, 980, 22, 110),
                new WellSeed("Cactus Flats 2H-8", "42-383-34771", "Wolfcamp", "Reagan", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.GAS_LIFT, "Wolfcamp C",
                        1320, 1_020, 12_650, 10_880, 31.3542, -101.5481,
                        2_100, 0.0105, 0.17, 0.0026, 1.6, 2_050, 44, 121),
                new WellSeed("Cactus Flats 4H-11", "42-383-34802", "Wolfcamp", "Reagan", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ESP, "Wolfcamp B",
                        1200, 920, 12_320, 9_760, 31.3789, -101.5127,
                        1_750, 0.0115, 0.25, 0.0032, 1.9, 1_880, 34, 132),
                new WellSeed("Pronghorn 7H-3", "42-317-35118", "Spraberry", "Reagan", "TX",
                        "Meridian Operating", WellStatus.PRODUCING, LiftType.ROD_PUMP, "Spraberry Sand",
                        1440, 1_170, 9_840, 7_540, 31.4022, -101.6734,
                        1_340, 0.0135, 0.29, 0.0036, 1.75, 1_470, 30, 143),
                new WellSeed("Pronghorn 8H-4", "42-317-35151", "Spraberry", "Reagan", "TX",
                        "Meridian Operating", WellStatus.SHUT_IN, LiftType.ESP, "Spraberry Sand",
                        1390, 1_120, 10_020, 7_880, 31.4210, -101.6498,
                        1_180, 0.0120, 0.33, 0.0038, 1.5, 1_380, 28, 154),
                new WellSeed("Yucca 1H-6", "42-123-33902", "Eagle Ford", "DeWitt", "TX",
                        "Meridian Operating", WellStatus.SHUT_IN, LiftType.ROD_PUMP, "Eagle Ford Shale",
                        1560, 1_310, 12_940, 6_120, 29.0972, -97.3415,
                        880, 0.0180, 0.52, 0.0050, 1.0, 1_010, 22, 165),
                new WellSeed("Horizon 3H-1", "42-475-34991", "Wolfcamp", "Upton", "TX",
                        "Meridian Operating", WellStatus.DRILLING, LiftType.FLOWING, "Wolfcamp A",
                        38, 0, 12_450, 10_120, 31.4023, -102.0911,
                        0, 0, 0, 0, 0, 0, 0, 176),
                new WellSeed("Kestrel 9H-2", "33-053-08117", "Bakken", "McKenzie", "ND",
                        "Legacy Partners", WellStatus.PLUGGED, LiftType.ROD_PUMP, "Middle Bakken",
                        1_920, 1_660, 18_440, 7_280, 47.6988, -103.3471,
                        640, 0.0240, 0.68, 0.0060, 0.7, 760, 20, 187),
                new WellSeed("Sagebrush 4H-2", "42-255-35220", "Eagle Ford", "DeWitt", "TX",
                        "Meridian Operating", WellStatus.COMPLETING, LiftType.FLOWING, "Eagle Ford Shale",
                        62, 0, 13_280, 8_440, 29.1264, -97.3782,
                        0, 0, 0, 0, 0, 0, 0, 198));
    }

    private record WellSeed(String name,
                            String apiNumber,
                            String field,
                            String county,
                            String state,
                            String operator,
                            WellStatus status,
                            LiftType liftType,
                            String formation,
                            int spudDaysAgo,
                            int completionDaysAgo,
                            double depthFt,
                            double lateralFt,
                            double latitude,
                            double longitude,
                            double qi,
                            double monthlyDecline,
                            double initialWaterCut,
                            double waterCutGrowth,
                            double gor,
                            double wellheadPressure,
                            double choke,
                            int seed) {

        LocalDate lastProductionDay(LocalDate today) {
            return switch (status) {
                case PRODUCING -> today;
                case SHUT_IN -> seed == 154 ? today.minusDays(26) : today.minusDays(54);
                case PLUGGED -> today.minusDays(210);
                case DRILLING, COMPLETING -> null;
            };
        }
    }
}
