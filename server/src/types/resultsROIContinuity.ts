/**
 * V8 Results / ROI Continuity — Core Type Family
 *
 * Dual-mode KPI operating model, deviation governance, ROI realization tracking,
 * executive review packs, and KPI-Finance reconciliation.
 *
 * Decision W6-5: Results starts reconciliation, Finance resolves finance-side meaning.
 * Decision W6-6: Standalone KPI/ROI governance events in scope — dual-mode logic honored.
 * Decision W6-7: ExecutiveReviewPack is Results-native; Reports consumes as snapshot source.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const KPIModeValues = ['initiative_linked', 'standalone'] as const;
export type KPIMode = (typeof KPIModeValues)[number];

export const KPIStatusValues = [
  'design',
  'baseline',
  'active',
  'measurement',
  'review',
  'deviation',
  'improvement',
  'benefits_realization',
] as const;
export type KPIStatus = (typeof KPIStatusValues)[number];

export const MetricTypeValues = [
  'currency',
  'percentage',
  'count',
  'ratio',
  'duration',
  'score',
  'index',
] as const;
export type MetricType = (typeof MetricTypeValues)[number];

export const MeasurementCadenceValues = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually',
] as const;
export type MeasurementCadence = (typeof MeasurementCadenceValues)[number];

export const DeviationTypeValues = [
  'underperformance',
  'overperformance',
  'data_quality',
  'measurement_gap',
] as const;
export type DeviationType = (typeof DeviationTypeValues)[number];

export const DeviationSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export type DeviationSeverity = (typeof DeviationSeverityValues)[number];

export const ReviewPackStatusValues = ['draft', 'in_review', 'approved', 'shared'] as const;
export type ReviewPackStatus = (typeof ReviewPackStatusValues)[number];

export const ReconciliationStatusValues = [
  'pending',
  'reconciled',
  'disputed',
  'escalated',
] as const;
export type ReconciliationStatus = (typeof ReconciliationStatusValues)[number];

export const ReconciliationInitiatorValues = ['results', 'finance'] as const;
export type ReconciliationInitiator = (typeof ReconciliationInitiatorValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface KPIDefinition {
  kpiId: string;
  organizationId: string;
  name: string;
  mode: KPIMode;
  initiativeId: string | null;
  metricType: MetricType;
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  measurementCadence: MeasurementCadence;
  status: KPIStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * RES-02 adapter: the canonical `initiative_kpis.id` this v8_kpi_definitions
   * row corresponds to. `v8_kpi_definitions` is NOT a second owner of KPI
   * definitions — this is the explicit pointer to the one canonical identity.
   * `null` means an explicit UNMAPPED state (a row created before RES-02, or
   * whose canonical KPI could not be determined) — this is NEVER guessed by
   * name-matching or any other heuristic; every row created going forward
   * populates it via `kpiDefinitionService.createDefinition`.
   */
  canonicalKpiId: string | null;
}

export interface DeviationRecord {
  deviationId: string;
  organizationId: string;
  kpiId: string;
  deviationType: DeviationType;
  severity: DeviationSeverity;
  actionRequired: string;
  escalatedTo: string | null;
  createdAt: string;
  /** Snapshot at deviation time for trend analytics (optional). */
  observedActual?: number | null;
  observedTarget?: number | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolution?: string | null;
}

export interface ROIRealizationEntry {
  entryId: string;
  organizationId: string;
  kpiId: string;
  initiativeId: string | null;
  realizedValue: number;
  period: string;
  provenanceRef: string | null;
  verifiedBy: string | null;
  createdAt: string;
}

export interface KPISummary {
  kpiId: string;
  name: string;
  status: KPIStatus;
  currentValue: number | null;
  targetValue: number | null;
}

export interface DeviationHighlight {
  deviationId: string;
  kpiId: string;
  deviationType: DeviationType;
  severity: DeviationSeverity;
}

export interface ROISnapshot {
  totalRealized: number;
  entriesCount: number;
  period: string;
}

export interface ExecutiveReviewPack {
  packId: string;
  organizationId: string;
  reviewPeriod: string;
  kpiSummaries: KPISummary[];
  deviationHighlights: DeviationHighlight[];
  roiSnapshot: ROISnapshot;
  status: ReviewPackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KPIFinanceReconciliation {
  reconciliationId: string;
  organizationId: string;
  kpiId: string;
  financeRef: string;
  reconciliationStatus: ReconciliationStatus;
  initiatedBy: ReconciliationInitiator;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const KPISummarySchema = z.object({
  kpiId: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(KPIStatusValues),
  currentValue: z.number().nullable(),
  targetValue: z.number().nullable(),
});

export const DeviationHighlightSchema = z.object({
  deviationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  deviationType: z.enum(DeviationTypeValues),
  severity: z.enum(DeviationSeverityValues),
});

export const ROISnapshotSchema = z.object({
  totalRealized: z.number(),
  entriesCount: z.number().int().min(0),
  period: z.string().min(1),
});

export const KPIDefinitionSchema = z.object({
  kpiId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(KPIModeValues),
  initiativeId: z.string().uuid().nullable(),
  metricType: z.enum(MetricTypeValues),
  baselineValue: z.number().nullable(),
  targetValue: z.number().nullable(),
  currentValue: z.number().nullable(),
  measurementCadence: z.enum(MeasurementCadenceValues),
  status: z.enum(KPIStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const DeviationRecordSchema = z.object({
  deviationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  deviationType: z.enum(DeviationTypeValues),
  severity: z.enum(DeviationSeverityValues),
  actionRequired: z.string().min(1),
  escalatedTo: z.string().nullable(),
  createdAt: z.string().min(1),
  observedActual: z.number().nullable().optional(),
  observedTarget: z.number().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  resolvedBy: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
});

export const ROIRealizationEntrySchema = z.object({
  entryId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  initiativeId: z.string().uuid().nullable(),
  realizedValue: z.number(),
  period: z.string().min(1),
  provenanceRef: z.string().nullable(),
  verifiedBy: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const ExecutiveReviewPackSchema = z.object({
  packId: z.string().uuid(),
  organizationId: z.string().uuid(),
  reviewPeriod: z.string().min(1),
  kpiSummaries: z.array(KPISummarySchema),
  deviationHighlights: z.array(DeviationHighlightSchema),
  roiSnapshot: ROISnapshotSchema,
  status: z.enum(ReviewPackStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const KPIFinanceReconciliationSchema = z.object({
  reconciliationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  financeRef: z.string().min(1),
  reconciliationStatus: z.enum(ReconciliationStatusValues),
  initiatedBy: z.enum(ReconciliationInitiatorValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateKPIParams {
  organizationId: string;
  name: string;
  mode: KPIMode;
  initiativeId?: string | null;
  metricType: MetricType;
  baselineValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  measurementCadence: MeasurementCadence;
}

export const CreateKPIParamsSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(KPIModeValues),
  initiativeId: z.string().uuid().nullable().optional(),
  metricType: z.enum(MetricTypeValues),
  baselineValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  measurementCadence: z.enum(MeasurementCadenceValues),
});

export interface RecordDeviationParams {
  organizationId: string;
  kpiId: string;
  deviationType: DeviationType;
  severity: DeviationSeverity;
  actionRequired: string;
  escalatedTo?: string | null;
  /** Optional KPI value snapshot for `getKPITrend`. */
  observedActual?: number | null;
  observedTarget?: number | null;
}

export const RecordDeviationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  deviationType: z.enum(DeviationTypeValues),
  severity: z.enum(DeviationSeverityValues),
  actionRequired: z.string().min(1),
  escalatedTo: z.string().nullable().optional(),
  observedActual: z.number().nullable().optional(),
  observedTarget: z.number().nullable().optional(),
});

export interface RecordROIRealizationParams {
  organizationId: string;
  kpiId: string;
  initiativeId?: string | null;
  realizedValue: number;
  period: string;
  provenanceRef?: string | null;
  verifiedBy?: string | null;
}

export const RecordROIRealizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  initiativeId: z.string().uuid().nullable().optional(),
  realizedValue: z.number(),
  period: z.string().min(1),
  provenanceRef: z.string().nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
});

export interface CreateExecutiveReviewPackParams {
  organizationId: string;
  reviewPeriod: string;
  kpiSummaries: KPISummary[];
  deviationHighlights: DeviationHighlight[];
  roiSnapshot: ROISnapshot;
}

export const CreateExecutiveReviewPackParamsSchema = z.object({
  organizationId: z.string().uuid(),
  reviewPeriod: z.string().min(1),
  kpiSummaries: z.array(KPISummarySchema),
  deviationHighlights: z.array(DeviationHighlightSchema),
  roiSnapshot: ROISnapshotSchema,
});

export interface InitiateReconciliationParams {
  organizationId: string;
  kpiId: string;
  financeRef: string;
  initiatedBy: ReconciliationInitiator;
}

export const InitiateReconciliationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  kpiId: z.string().uuid(),
  financeRef: z.string().min(1),
  initiatedBy: z.enum(ReconciliationInitiatorValues),
});

// ==========================================
// Runtime aggregates (Wave 19 — Results dashboard)
// ==========================================

export interface KPIScorecardSummary {
  organizationId: string;
  totalKpis: number;
  byStatus: Partial<Record<KPIStatus, number>>;
  byCategory: Partial<Record<MetricType, number>>;
  /** Average achievement ratio in [0, 1], capped at 1; null when no eligible KPIs. */
  averageTargetAchievementRate: number | null;
}

export interface KPITrendPoint {
  period: string;
  actualValue: number | null;
  targetValue: number | null;
  deviation: number | null;
}

export interface ROIDashboardSummary {
  organizationId: string;
  totalEntries: number;
  totalRealized: number;
  /** Sum of KPI targets for KPIs that have at least one ROI entry in the org. */
  projectedFromKpiTargets: number;
  /** totalRealized / projected when projected > 0; otherwise null. */
  overallRealizationRate: number | null;
  byInitiative: Array<{
    initiativeId: string | null;
    entryCount: number;
    realizedSum: number;
  }>;
}

export interface ROIPortfolioSummaryItem {
  initiativeId: string;
  initiativeName: string;
  status: string;
  priority: string;
  capex: number;
  opexAnnual: number;
  projectedBenefit: number;
  realizedBenefit: number;
  variance: number;
  confidence: string | null;
  hasRealized: boolean;
  /** Faza2 gap #3 — ROI netto: benefit pomniejszony o opex_annual (ten sam rok/okres
   *  co roi_assumptions.opex_annual). Additive — nie zastępuje gross projectedBenefit/
   *  realizedBenefit powyżej, tylko dokłada widok "po odjęciu kosztów operacyjnych". */
  netProjectedBenefit: number;
  netRealizedBenefit: number;
  /** ROI % = benefit / capex * 100. null gdy capex <= 0 (dzielenie niezdefiniowane). */
  roiPercentGross: number | null;
  roiPercentNet: number | null;
}

export interface ROIPortfolioSummary {
  organizationId: string;
  items: ROIPortfolioSummaryItem[];
  summary: {
    totalProjected: number;
    totalRealized: number;
    totalCapex: number;
    totalVariance: number;
    initiativeCount: number;
    coveragePercent: number;
    /** Faza2 gap #3 — dodatkowe pola netto (opex_annual odjęty) obok istniejących gross. */
    totalOpexAnnual: number;
    netTotalProjected: number;
    netTotalRealized: number;
    roiPercentGross: number | null;
    roiPercentNet: number | null;
  };
}

export interface ROIInitiativeVarianceDetail {
  hasAssumptions: boolean;
  projected?: {
    totalBenefit: number;
    revenueDelta?: number | null;
    costDelta?: number | null;
    capex?: number | null;
    opexAnnual?: number | null;
    roiPercent?: number | null;
    npv?: number | null;
    paybackMonths?: number | null;
    horizonMonths?: number | null;
    confidence?: string | null;
    /** Faza2 gap #3 — projected benefit netto (po odjęciu opexAnnual). Additive. */
    netTotalBenefit?: number;
    roiPercentNet?: number | null;
  };
  realized?: {
    revenueDelta: number;
    costDelta: number;
    savings: number;
    totalBenefit: number;
    dataPoints: number;
    /** Faza2 gap #3 — realized benefit netto (po odjęciu opexAnnual z roi_assumptions). */
    netTotalBenefit?: number;
    roiPercentNet?: number | null;
  };
  variance?: {
    absolute: number;
    percent: number;
    status: 'on_track' | 'below_plan' | 'above_plan';
  } | null;
}

export interface ROIAssumptionsDetail {
  expectedRevenueDelta?: number | null;
  expectedCostDelta?: number | null;
  capex?: number | null;
  opexAnnual?: number | null;
  horizonMonths?: number | null;
  effectStartDate?: string | null;
  confidence?: string | null;
  assumptionsOwner?: string | null;
  assumptionsText?: string | null;
}

export interface ROIRealizedDetailEntry {
  id: string;
  periodMonth: string;
  realizedRevenueDelta?: number | null;
  realizedCostDelta?: number | null;
  realizedSavings?: number | null;
  varianceNotes?: string | null;
  recordedBy?: string | null;
  createdAt?: string | null;
}

export interface ROIInitiativeDetail {
  organizationId: string;
  initiativeId: string;
  variance: ROIInitiativeVarianceDetail;
  assumptions: ROIAssumptionsDetail | null;
  realized: ROIRealizedDetailEntry[];
}

export interface ResultsKpiCatalogEntry {
  id: string;
  mappingId?: string | null;
  initiativeId?: string | null;
  initiativeName?: string | null;
  initiativeStatus?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  baselineValue?: number | null;
  targetValue: number | null;
  measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  alertThreshold?: number | null;
  alertDirection: 'BELOW' | 'ABOVE';
  isPrimary: boolean;
  sortOrder: number;
  /** RES-02: CAS pointer — round-trip as `expectedVersion` on update. */
  currentDefinitionVersion?: number | null;
  latestValue?: number | null;
  latestMeasurementDate?: string | null;
  prevValue?: number | null;
  prevMeasurementDate?: string | null;
  isOnTarget: boolean;
  /**
   * RES-004: the KPI's real band-evaluated status (evaluateKpiPoint, the
   * SAME engine that drives deviation-case detection) — GREEN/AMBER/RED/
   * UNCONFIGURED/NO_DATA. `isOnTarget` stays a boolean for older consumers
   * (true iff evalStatus is GREEN); active Results UI must read evalStatus
   * directly rather than re-deriving a status from raw value/target.
   */
  evalStatus: 'GREEN' | 'AMBER' | 'RED' | 'UNCONFIGURED' | 'NO_DATA';
  createdAt: string;
  updatedAt?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  thresholdMode?: 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
  amberThresholdPct?: number | null;
  redThresholdPct?: number | null;
  amberThresholdAbs?: number | null;
  redThresholdAbs?: number | null;
  definitionSource?: 'library' | 'initiative-custom';
  observationPhase?: 'realization' | 'post-implementation' | 'both';
  trackedInRealization?: boolean;
  trackedPostImplementation?: boolean;
  observationStatus?: 'active' | 'paused' | 'completed';
  realizationExpectation?: {
    baselineValue?: number | null;
    targetValue?: number | null;
    measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  };
  postImplementationExpectation?: {
    baselineValue?: number | null;
    targetValue?: number | null;
    measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  };
  openDeviationCase?: {
    id: string;
    severity: 'AMBER' | 'RED';
    status: string;
  } | null;
}

export interface ResultsKpiCatalogMapping {
  id: string;
  initiativeId: string;
  initiativeName?: string | null;
  initiativeStatus?: string | null;
  kpiId: string;
  kpiName?: string | null;
  impactDirection?: string | null;
  definitionSource?: 'library' | 'initiative-custom';
  observationPhase?: 'realization' | 'post-implementation' | 'both';
  trackedInRealization?: boolean;
  trackedPostImplementation?: boolean;
  observationStatus?: 'active' | 'paused' | 'completed';
}

export interface ResultsTrackedInitiativeEntry {
  initiativeId: string;
  initiativeName: string;
  initiativeStatus: string;
  lifecycleBucket: 'in-realization' | 'realized';
  trackedKpiCount: number;
  realizationKpiCount: number;
  postImplementationKpiCount: number;
  belowTargetCount: number;
  needsEntryCount: number;
  openDeviationCount: number;
  openReportCount: number;
  lastReportTitle?: string | null;
  lastReportId?: string | null;
  lastReportCreatedAt?: string | null;
}

export interface ResultsKpiCatalog {
  organizationId: string;
  initiatives: ResultsTrackedInitiativeEntry[];
  kpis: ResultsKpiCatalogEntry[];
  mappings: ResultsKpiCatalogMapping[];
}

export interface ResultsKpiDrawerAction {
  id: string;
  title: string;
  ownerUserId?: string | null;
  dueDate?: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ResultsKpiDrawerCase {
  id: string;
  kpiId: string;
  organizationId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  severity: 'AMBER' | 'RED';
  status: string;
  ownerUserId?: string | null;
  deviationSummary?: string | null;
  rcaText?: string | null;
  evidenceText?: string | null;
  evidenceRef?: string | null;
  resolutionNotes?: string | null;
  detectedAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  actions: ResultsKpiDrawerAction[];
}

export interface ResultsKpiDrawerDetail {
  organizationId: string;
  kpiId: string;
  measurements: Array<{
    id: string;
    kpiId: string;
    value: number;
    measuredAt: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    periodKey?: string | null;
    notes?: string | null;
    createdAt: string;
    createdBy?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  openCase: ResultsKpiDrawerCase | null;
  auditLog: Array<{
    id: string;
    section: string;
    eventType: string;
    source: string;
    actorUserId?: string | null;
    summary?: string | null;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface ReviewPackTimelineEntry {
  packId: string;
  reviewPeriod: string;
  status: ReviewPackStatus;
  createdAt: string;
  kpiSummaryCount: number;
  deviationHighlightCount: number;
  roiSnapshotTotalRealized: number;
  roiSnapshotEntriesCount: number;
}

export interface ReconciliationHealthSummary {
  organizationId: string;
  total: number;
  byStatus: Partial<Record<ReconciliationStatus, number>>;
  unresolvedCount: number;
  /** Mean hours from created_at to updated_at for reconciled rows; null if none. */
  averageResolutionHours: number | null;
}

/**
 * One reconciliation row enriched with the projected (KPI target) vs realized
 * (summed ROI realization entries) values and the computed variance. This is the
 * read seam M15 Results uses to DISPLAY finance reconciliations (M16 writes them).
 */
export interface ReconciliationVarianceItem {
  reconciliationId: string;
  kpiId: string;
  kpiName: string | null;
  /**
   * KPI unit (e.g. '%', '€', 'szt.'). Drives display formatting and whether a
   * monetary variance is meaningful. Null when the KPI has no unit.
   */
  unit: string | null;
  initiativeId: string | null;
  financeRef: string;
  reconciliationStatus: ReconciliationStatus;
  initiatedBy: ReconciliationInitiator;
  /** KPI target_value — the projected benefit. Null when the KPI has no target. */
  projectedValue: number | null;
  /**
   * Sum of ROI realization entries (currency deltas) for this KPI. Null when none
   * recorded, or when the KPI unit is non-monetary (so the sum is not comparable
   * to a percentage/count target).
   */
  realizedValue: number | null;
  /** realizedValue − projectedValue; null when either side is missing. */
  varianceAbsolute: number | null;
  /** Percentage variance vs |projected|; null when projected is 0/missing. */
  variancePercent: number | null;
  /** True when projected and realized are both known and differ beyond rounding. */
  hasMismatch: boolean;
  /**
   * Finance-model driver/benefit key this KPI was reconciled against, when the
   * reconciliation ENGINE (resultsFinanceReconciliationService) has run. Null on
   * legacy display-only rows.
   */
  driverKey?: string | null;
  /**
   * CONCLUSION_LAYER payload persisted by the reconciliation engine
   * (headline / K2 meaning / K3 actions / K4 effect). Null when the engine has
   * not reconciled this pair yet.
   */
  conclusion?: unknown | null;
  /**
   * True when the projected/realized/variance figures above come from the
   * engine's unit-normalised deviation rather than the legacy monetary heuristic.
   */
  engineReconciled?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Org-scoped reconciliation overview for the Results ROI surface: per-KPI
 * reconciliation status + projected-vs-realized variance, plus status rollup.
 */
export interface ReconciliationVarianceOverview {
  organizationId: string;
  initiativeId: string | null;
  items: ReconciliationVarianceItem[];
  summary: {
    total: number;
    byStatus: Partial<Record<ReconciliationStatus, number>>;
    /** Count of items where projected and realized are both known and differ. */
    mismatchCount: number;
    /** pending + disputed + escalated. */
    unresolvedCount: number;
  };
}

export interface ResultsDashboardSnapshot {
  organizationId: string;
  kpiScorecard: KPIScorecardSummary;
  activeDeviationsCount: number;
  roiDashboard: ROIDashboardSummary;
  reconciliationHealth: ReconciliationHealthSummary;
  recentReviewPacks: ReviewPackTimelineEntry[];
}

// ==========================================
// KPI STATUS LIFECYCLE (valid transitions)
// ==========================================

export const KPI_STATUS_TRANSITIONS: Record<KPIStatus, KPIStatus[]> = {
  design: ['baseline'],
  baseline: ['active'],
  active: ['measurement'],
  measurement: ['review'],
  review: ['deviation', 'improvement', 'benefits_realization'],
  deviation: ['improvement', 'review'],
  improvement: ['measurement', 'benefits_realization'],
  benefits_realization: [],
} as const;
