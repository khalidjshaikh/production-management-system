export type WellStatus = 'PRODUCING' | 'SHUT_IN' | 'COMPLETING' | 'DRILLING' | 'PLUGGED';
export type LiftType = 'FLOWING' | 'ESP' | 'ROD_PUMP' | 'GAS_LIFT' | 'PLUNGER_LIFT' | 'HYDRAULIC';
export type DowntimeCategory =
  | 'PLANNED_MAINTENANCE'
  | 'EQUIPMENT_FAILURE'
  | 'POWER_OUTAGE'
  | 'WEATHER'
  | 'PIPELINE_CONSTRAINT'
  | 'REGULATORY'
  | 'OTHER';
export type ForecastModel = 'EXPONENTIAL' | 'HYPERBOLIC';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface DailyPoint {
  date: string;
  oil: number;
  gas: number;
  water: number;
  waterCutPct: number;
  uptimePct: number;
  downtimeHours: number;
  records: number;
}

export interface WellMetrics {
  oilRate: number;
  gasRate: number;
  waterRate: number;
  waterCutPct: number;
  uptimePct: number;
  oilDeltaPct: number;
  days: number;
  recordCount: number;
}

export interface WellView {
  id: number;
  name: string;
  apiNumber: string;
  fieldName: string;
  operator: string;
  county?: string;
  state?: string;
  status: WellStatus;
  statusLabel: string;
  liftType?: LiftType;
  liftLabel?: string;
  targetFormation?: string;
  spudDate?: string;
  completionDate?: string;
  totalDepthFt?: number;
  lateralLengthFt?: number;
  latitude?: number;
  longitude?: number;
  updatedAt: string;
  metrics: WellMetrics;
}

export interface WellDetail {
  well: WellView;
  series: DailyPoint[];
  downtime: DowntimeView[];
}

export interface WellUpsertRequest {
  name: string;
  apiNumber: string;
  fieldName: string;
  operator: string;
  county?: string | null;
  state?: string | null;
  status: WellStatus;
  liftType?: LiftType | null;
  targetFormation?: string | null;
  spudDate?: string | null;
  completionDate?: string | null;
  totalDepthFt?: number | null;
  lateralLengthFt?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProductionRecordView {
  id: number;
  wellId: number;
  wellName: string;
  fieldName: string;
  productionDate: string;
  oilBbl: number;
  gasMcf: number;
  waterBbl: number;
  waterCutPct: number;
  hoursOnline: number;
  downtimeHours: number;
  wellheadPressurePsi?: number;
  chokeSize64ths?: number;
  notes?: string;
}

export interface ProductionSummary {
  oilBbl: number;
  gasMcf: number;
  waterBbl: number;
  oilRate: number;
  gasRate: number;
  waterRate: number;
  waterCutPct: number;
  uptimePct: number;
  records: number;
  from: string;
  to: string;
  series: DailyPoint[];
}

export interface ProductionPageResponse {
  records: PageResponse<ProductionRecordView>;
  summary: ProductionSummary;
}

export interface ProductionUpsertRequest {
  wellId: number;
  productionDate: string;
  oilBbl: number;
  gasMcf: number;
  waterBbl: number;
  hoursOnline: number;
  wellheadPressurePsi?: number | null;
  chokeSize64ths?: number | null;
  notes?: string | null;
}

export interface DowntimeView {
  id: number;
  wellId: number;
  wellName: string;
  fieldName: string;
  category: DowntimeCategory;
  categoryLabel: string;
  description: string;
  startTime: string;
  endTime?: string | null;
  durationHours: number;
  active: boolean;
  deferredOilBbl?: number;
  deferredGasMcf?: number;
  reportedBy?: string;
}

export interface DowntimeUpsertRequest {
  wellId: number;
  startTime: string;
  endTime?: string | null;
  category: DowntimeCategory;
  description: string;
  deferredOilBbl?: number | null;
  deferredGasMcf?: number | null;
  reportedBy?: string | null;
}

export interface CategorySlice {
  category: DowntimeCategory;
  label: string;
  events: number;
  hours: number;
  deferredOilBbl: number;
}

export interface DailyDowntime {
  date: string;
  hours: number;
  events: number;
}

export interface DowntimeSummary {
  rangeDays: number;
  totalEvents: number;
  activeEvents: number;
  totalDowntimeHours: number;
  deferredOilBbl: number;
  deferredGasMcf: number;
  avgResolutionHours: number;
  categories: CategorySlice[];
  series: DailyDowntime[];
}

export interface ForecastSummary {
  id: number;
  wellId: number;
  wellName: string;
  fieldName: string;
  name: string;
  model: ForecastModel;
  modelLabel: string;
  baseDate: string;
  createdAt: string;
  horizonMonths: number;
  qiOil: number;
  diAnnualPct: number;
  bFactor: number;
  economicLimitBopd: number;
  eurOilBbl: number;
  nextMonthOilRate: number;
  preview: number[];
}

export interface ForecastPointView {
  monthIndex: number;
  date: string;
  oilRate: number;
  gasRate: number;
  waterRate: number;
  oilLowRate: number;
  oilHighRate: number;
  cumulativeOilBbl: number;
}

export interface ActualMonth {
  month: string;
  oilRate: number;
}

export interface ForecastDetail {
  summary: ForecastSummary;
  points: ForecastPointView[];
  actuals: ActualMonth[];
  initialWaterCutPct: number;
  gorMcfPerBbl: number;
  rSquared: number;
  monitoredMonths: number;
}

export interface GenerateForecastRequest {
  wellId: number;
  model: ForecastModel;
  horizonMonths: number;
  economicLimitBopd: number;
  bFactor?: number | null;
  name?: string | null;
}

export interface DashboardKpis {
  oilRate: number;
  gasRate: number;
  waterRate: number;
  waterCutPct: number;
  uptimePct: number;
  activeWells: number;
  totalWells: number;
  deferredOilBbl: number;
  deferredGasMcf: number;
  avgOilPerWell: number;
  oilDeltaPct: number;
  gasDeltaPct: number;
  waterCutDeltaPts: number;
  uptimeDeltaPts: number;
  deferredOilDeltaPct: number;
}

export interface FieldSlice {
  field: string;
  oilRate: number;
  gasRate: number;
  waterRate: number;
  waterCutPct: number;
  wells: number;
  sharePct: number;
}

export interface TopWell {
  id: number;
  name: string;
  fieldName: string;
  status: WellStatus;
  statusLabel: string;
  liftType?: LiftType;
  liftLabel?: string;
  oilRate: number;
  gasRate: number;
  waterCutPct: number;
  uptimePct: number;
  deltaPct: number;
  sharePct: number;
}

export interface ForecastMonth {
  month: string;
  label: string;
  oilRate: number;
  gasRate: number;
}

export interface RecentProduction {
  id: number;
  wellName: string;
  date: string;
  oilBbl: number;
  gasMcf: number;
  waterBbl: number;
}

export interface DashboardResponse {
  latestDate: string;
  rangeStart: string;
  rangeDays: number;
  kpis: DashboardKpis;
  series: DailyPoint[];
  fields: FieldSlice[];
  topWells: TopWell[];
  recentDowntime: DowntimeView[];
  outlook: ForecastMonth[];
  outlookWells: number;
  recentProduction: RecentProduction[];
}

export interface EnumOption {
  value: string;
  label: string;
}

export interface MetaResponse {
  fields: string[];
  operators: string[];
  wellStatuses: EnumOption[];
  liftTypes: EnumOption[];
  downtimeCategories: EnumOption[];
  forecastModels: EnumOption[];
  latestProductionDate?: string;
  statusCounts?: Record<string, number>;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string>;
}
