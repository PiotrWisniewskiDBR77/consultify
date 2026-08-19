import { v8Delete, v8Get, v8Post, v8Put } from './client';

/**
 * @deprecated V8 Results API (`/api/v8/results/*`) is the canonical SSOT.
 * Legacy `/api/benefits/*` paths are deprecated and will be removed.
 * This fallback exists only for backward compatibility during migration.
 */
export const shouldFallbackToLegacyResults = (error: any) => {
  const status = Number(error?.status);
  return [400, 404, 405, 501].includes(status);
};

/** Builds a `?a=1&b=2` suffix from defined values, or '' when none are set. */
function queryStringFrom(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface V8ResultsDashboardSnapshot {
  organizationId: string;
  kpiScorecard: {
    organizationId: string;
    totalKpis: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    averageTargetAchievementRate: number | null;
  };
  activeDeviationsCount: number;
  roiDashboard: {
    organizationId: string;
    totalEntries: number;
    totalRealized: number;
    projectedFromKpiTargets: number;
    overallRealizationRate: number | null;
    byInitiative: Array<{
      initiativeId: string | null;
      entryCount: number;
      realizedSum: number;
    }>;
  };
  reconciliationHealth: {
    organizationId: string;
    total: number;
    byStatus: Record<string, number>;
    unresolvedCount: number;
    averageResolutionHours: number | null;
  };
  recentReviewPacks: Array<{
    packId: string;
    reviewPeriod: string;
    status: string;
    createdAt: string;
    kpiSummaryCount: number;
    deviationHighlightCount: number;
    roiSnapshotTotalRealized: number;
    roiSnapshotEntriesCount: number;
  }>;
}

export interface V8ResultsRoiPortfolioSummaryItem {
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
  /** Faza2 gap #3 — netto (benefit − opexAnnual). Optional: legacy fallback
   *  endpoint (`/benefits/roi/portfolio/summary`) does not return these yet. */
  netProjectedBenefit?: number;
  netRealizedBenefit?: number;
  roiPercentGross?: number | null;
  roiPercentNet?: number | null;
}

export interface V8ResultsRoiPortfolioSummary {
  organizationId: string;
  items: V8ResultsRoiPortfolioSummaryItem[];
  summary: {
    totalProjected: number;
    totalRealized: number;
    totalCapex: number;
    totalVariance: number;
    initiativeCount: number;
    coveragePercent: number;
    /** Faza2 gap #3 — portfolio-level netto. Optional, same legacy-fallback caveat. */
    totalOpexAnnual?: number;
    netTotalProjected?: number;
    netTotalRealized?: number;
    roiPercentGross?: number | null;
    roiPercentNet?: number | null;
  };
}

export type V8ReconciliationStatus = 'pending' | 'reconciled' | 'disputed' | 'escalated';

/** O4.7 — market-vs-execution decomposition of a realized-vs-projected variance. */
export type V8PostMortemVerdict =
  'market-driven' | 'execution-driven' | 'mixed' | 'on-plan' | 'undetermined';

export interface V8ReconciliationPostMortem {
  projected: number;
  realized: number;
  /** realized − projected. */
  totalVariance: number;
  /** Portion of the gap attributable to the market moving vs assumption. */
  marketEffect: number;
  /** Residual portion attributable to execution. */
  executionEffect: number;
  /** |marketEffect| / (|marketEffect| + |executionEffect|), [0..1]. */
  marketShare: number;
  /** |executionEffect| / (…), [0..1]. */
  executionShare: number;
  verdict: V8PostMortemVerdict;
  confidence: 'confirmed' | 'mixed' | 'declared' | 'undetermined';
  explanation: { pl: string; en: string };
}

/**
 * CONCLUSION_LAYER payload persisted alongside an engine reconciliation. The O4.7
 * `postMortem` is embedded as a sibling key on this object (no dedicated column).
 */
export interface V8ReconciliationConclusion {
  headline?: string;
  k1Fact?: string;
  k2Meaning?: string;
  k3Actions?: Array<{ action: string; ownerRole: string; impact: string; effort: string }>;
  k4Effect?: string;
  severity?: 'on_track' | 'watch' | 'off_track';
  aiGenerated?: boolean;
  /** O4.7 — market-vs-execution post-mortem (present only for engine reconciliations). */
  postMortem?: V8ReconciliationPostMortem | null;
}

export interface V8ResultsReconciliationItem {
  reconciliationId: string;
  kpiId: string;
  kpiName: string | null;
  /** KPI unit (e.g. '%', '€', 'szt.') — drives value formatting. */
  unit: string | null;
  initiativeId: string | null;
  financeRef: string;
  reconciliationStatus: V8ReconciliationStatus;
  initiatedBy: 'results' | 'finance';
  projectedValue: number | null;
  realizedValue: number | null;
  varianceAbsolute: number | null;
  variancePercent: number | null;
  hasMismatch: boolean;
  /** Finance-model driver the KPI feeds (present for engine reconciliations). */
  driverKey?: string | null;
  /** CONCLUSION_LAYER (incl. O4.7 postMortem) when the engine reconciled this pair. */
  conclusion?: V8ReconciliationConclusion | null;
  /** true when the engine (not the legacy monetary heuristic) produced this row. */
  engineReconciled?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /results/reconciliations/pull request body. */
export interface V8ReconciliationPullPayload {
  initiativeId: string;
  mappings: Array<{
    kpiId: string;
    driverKey: string;
    unitMultiplier?: number;
    projectedValue?: number | null;
  }>;
}

/** POST /results/reconciliations/pull response. */
export interface V8ReconciliationPullResult {
  organizationId: string;
  initiativeId: string;
  reconciledCount: number;
  offTrackCount: number;
  items: Array<{
    kpiId: string;
    kpiName: string;
    driverKey: string;
    realizedValue: number | null;
    projectedValue: number | null;
    deviationAbsolute: number | null;
    deviationPercent: number | null;
    conclusion: V8ReconciliationConclusion | null;
    postMortem: V8ReconciliationPostMortem | null;
  }>;
}

export interface V8ResultsReconciliationOverview {
  organizationId: string;
  initiativeId: string | null;
  items: V8ResultsReconciliationItem[];
  summary: {
    total: number;
    byStatus: Partial<Record<V8ReconciliationStatus, number>>;
    mismatchCount: number;
    unresolvedCount: number;
  };
}

export interface V8ResultsRoiInitiativeDetail {
  organizationId: string;
  initiativeId: string;
  variance: {
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
    };
    realized?: {
      revenueDelta: number;
      costDelta: number;
      savings: number;
      totalBenefit: number;
      dataPoints: number;
    };
    variance?: {
      absolute: number;
      percent: number;
      status: 'on_track' | 'below_plan' | 'above_plan';
    } | null;
  };
  assumptions: {
    expectedRevenueDelta?: number | null;
    expectedCostDelta?: number | null;
    capex?: number | null;
    opexAnnual?: number | null;
    horizonMonths?: number | null;
    effectStartDate?: string | null;
    confidence?: string | null;
    assumptionsOwner?: string | null;
    assumptionsText?: string | null;
  } | null;
  realized: Array<{
    id: string;
    periodMonth: string;
    realizedRevenueDelta?: number | null;
    realizedCostDelta?: number | null;
    realizedSavings?: number | null;
    varianceNotes?: string | null;
    recordedBy?: string | null;
    createdAt?: string | null;
  }>;
}

export interface V8ResultsKpiCatalogEntry {
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
  /** RES-02: CAS pointer — send back as `expectedVersion` on update. */
  currentDefinitionVersion?: number | null;
  /** RES-11: who may see this KPI — send back unchanged on update unless the
   * caller is actually changing it. */
  visibility?: 'org_visible' | 'initiative_restricted' | 'private_to_owner';
  latestValue?: number | null;
  latestMeasurementDate?: string | null;
  prevValue?: number | null;
  prevMeasurementDate?: string | null;
  isOnTarget: boolean;
  /** RES-004: canonical band-evaluated status — see kpiDomain.ts's deriveStatus(). */
  evalStatus?: 'GREEN' | 'AMBER' | 'RED' | 'UNCONFIGURED' | 'NO_DATA';
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

export interface V8ResultsKpiCatalogMapping {
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

export interface V8ResultsTrackedInitiativeEntry {
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

export interface V8ResultsKpiCatalog {
  organizationId: string;
  initiatives: V8ResultsTrackedInitiativeEntry[];
  kpis: V8ResultsKpiCatalogEntry[];
  mappings: V8ResultsKpiCatalogMapping[];
}

/**
 * RES-10 — Results-owned scorecard ("karta KPI"): a department x period card
 * grouping existing V8ResultsKpiCatalogEntry rows. Distinct from Initiatives'
 * goals/OKR contract (src/services/api.ts `goals*` — Initiatives-owned).
 * `ownerDomain` is always 'results' on these responses; a mismatch means the
 * wrong backend contract answered the request.
 */
export interface V8ResultsScorecard {
  id: string;
  organizationId: string;
  name: string;
  department: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  kpiCount: number;
  onTargetCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface V8ResultsScorecardKpi {
  id: string;
  name: string;
  baselineValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  direction: string | null;
  progressPercentage: number | null;
  isOnTarget: boolean | null;
  category: string | null;
  initiativeId: string | null;
  sortOrder: number;
}

export interface V8ResultsScorecardListResponse {
  scorecards: V8ResultsScorecard[];
  count: number;
  ownerDomain: 'results';
}

export interface V8ResultsScorecardKpisResponse {
  scorecard: { id: string; name: string };
  kpis: V8ResultsScorecardKpi[];
  count: number;
  ownerDomain: 'results';
}

export interface V8ResultsCreateScorecardPayload {
  name: string;
  department?: string | null;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export type V8ResultsUpdateScorecardPayload = Partial<V8ResultsCreateScorecardPayload> & {
  status?: string;
};

export interface V8ResultsKpiDrawerDetail {
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
  openCase: {
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
    actions: Array<{
      id: string;
      title: string;
      ownerUserId?: string | null;
      dueDate?: string | null;
      status: 'OPEN' | 'DONE' | 'CANCELLED';
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
  } | null;
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

export interface V8ResultsCreateKpiTimeSeriesPayload {
  value: number;
  periodStart: string;
  periodEnd?: string | null;
  source?: string | null;
  notes?: string | null;
}

export interface V8ResultsCreateKpiTimeSeriesResponse {
  id: string;
  kpiId: string;
  value: number;
  measuredAt: string;
  periodStart: string;
  periodEnd?: string | null;
  periodKey?: string | null;
}

export interface V8ResultsCreateKpiPayload {
  name: string;
  description?: string;
  unit?: string;
  baselineValue?: number | null;
  targetValue?: number | null;
  measurementFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  alertThreshold?: number | null;
  alertDirection?: 'BELOW' | 'ABOVE';
  ownerUserId?: string | null;
  direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  thresholdMode?: 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
  amberThresholdPct?: number | null;
  redThresholdPct?: number | null;
  amberThresholdAbs?: number | null;
  redThresholdAbs?: number | null;
  /** RES-11: who may see this KPI. Defaults to org_visible if omitted. */
  visibility?: 'org_visible' | 'initiative_restricted' | 'private_to_owner';
}

export interface V8ResultsCreateKpiResponse {
  id: string;
}

export interface V8ResultsUpdateKpiPayload {
  name?: string;
  description?: string;
  unit?: string;
  baselineValue?: number | null;
  targetValue?: number | null;
  measurementFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  alertThreshold?: number | null;
  alertDirection?: 'BELOW' | 'ABOVE';
  ownerUserId?: string | null;
  direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  thresholdMode?: 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
  amberThresholdPct?: number | null;
  redThresholdPct?: number | null;
  amberThresholdAbs?: number | null;
  redThresholdAbs?: number | null;
  /** RES-11: who may see this KPI. Backend validates fail-closed — an
   * unrecognized value is rejected with 400, zero mutation. */
  visibility?: 'org_visible' | 'initiative_restricted' | 'private_to_owner';
  /** RES-02: the version the client last saw — enforces optimistic concurrency. */
  expectedVersion?: number;
}

export interface V8ResultsUpdateKpiResponse {
  success: boolean;
  currentDefinitionVersion?: number;
}

export interface V8ResultsDeleteKpiResponse {
  success: boolean;
}

export interface V8ResultsCreateKpiMappingPayload {
  initiativeId: string;
  kpiId: string;
  impactWeight?: number;
  impactDirection?: 'increase' | 'decrease';
  expectedDelta?: number | null;
  expectedDeltaUnit?: string | null;
  lagDays?: number;
  confidence?: string;
  notes?: string | null;
}

export interface V8ResultsCreateKpiMappingResponse {
  id: string;
  initiativeId: string;
  kpiId: string;
}

export interface V8ResultsDeleteKpiMappingResponse {
  success: boolean;
}

export interface V8ResultsAcknowledgeDeviationCaseResponse {
  success: boolean;
}

export interface V8ResultsUpdateDeviationCaseRcaPayload {
  rcaText?: string | null;
}

export interface V8ResultsUpdateDeviationCaseRcaResponse {
  success: boolean;
}

export interface V8ResultsCreateDeviationActionPayload {
  title: string;
  ownerUserId?: string | null;
  dueDate?: string | null;
}

export interface V8ResultsCreateDeviationActionResponse {
  id: string;
  caseId: string;
}

export interface V8ResultsUpdateDeviationActionPayload {
  title?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  status?: string | null;
}

export interface V8ResultsUpdateDeviationActionResponse {
  success: boolean;
}

export interface V8ResultsResolveDeviationCaseResponse {
  success: boolean;
}

export interface V8ResultsCloseDeviationCasePayload {
  evidenceText?: string | null;
  evidenceRef?: string | null;
  resolutionNotes?: string | null;
  linkedInitiativeId?: string | null;
  linkedTaskId?: string | null;
}

export interface V8ResultsCloseDeviationCaseResponse {
  success: boolean;
}

// #M15/OC2 (2026-07-15) — wiring for the 3 previously orphaned engines
// (kpiAnomalyService/kpiForecastService/deviationRcaSuggestService) surfaced
// behind resultsFeatureFlags.deviationDiagnostics. Read-only, additive to the
// existing acknowledge/rca/actions/resolve/close seam above — does not
// replace it.
export interface V8ResultsKpiAnomaly {
  index: number;
  value: number;
  periodIso: string | null;
  method: 'zscore' | 'iqr' | string;
  severity: 'moderate' | 'severe' | string;
  score: number;
}

export interface V8ResultsKpiAnomaliesResponse {
  kpiId: string;
  anomalies: V8ResultsKpiAnomaly[];
  summary: { hasAnomalies: boolean; count: number; [key: string]: unknown };
}

export interface V8ResultsKpiForecastResponse {
  kpiId: string;
  target: number | null;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  trend: { slope: number; intercept: number; [key: string]: unknown };
  projection: { willHitTarget: boolean; [key: string]: unknown } | null;
  alert: Record<string, unknown> | null;
  points: Array<{ t: number; value: number; periodIso: string | null }>;
}

export interface V8ResultsRcaHypothesis {
  category:
    'measurement' | 'adoption' | 'scope' | 'external' | 'capacity' | 'data-quality' | string;
  hypothesis: string;
  confidence: number;
}

export interface V8ResultsRcaAction {
  title: string;
  [key: string]: unknown;
}

export interface V8ResultsDeviationCaseRcaSuggestResponse {
  caseId: string;
  kpiId: string;
  signals: Record<string, unknown>;
  hypotheses: V8ResultsRcaHypothesis[];
  actions: V8ResultsRcaAction[];
}

export interface V8ResultsCreateKpiReportPayload {
  periodStart: string;
  periodEnd?: string | null;
  title?: string;
  filters?: Record<string, unknown> | null;
  kpiIds?: string[];
  initiativeIds?: string[];
}

export interface V8ResultsCreateKpiReportResponse {
  snapshotId: string;
  reportId: string;
}

export interface V8ResultsUpdateRoiAssumptionsPayload {
  capex?: number | null;
  opexAnnual?: number | null;
  expectedRoiPercent?: number | null;
  expectedNpv?: number | null;
  expectedPaybackMonths?: number | null;
  horizonMonths?: number | null;
  baselineRevenue?: number | null;
  baselineCost?: number | null;
  expectedRevenueDelta?: number | null;
  expectedCostDelta?: number | null;
  effectStartDate?: string | null;
  assumptionsText?: string | null;
  assumptionsOwner?: string | null;
  confidence?: 'high' | 'medium' | 'low' | string | null;
}

export interface V8ResultsUpdateRoiAssumptionsResponse {
  success: boolean;
}

export interface V8ResultsCreateRoiRealizedPayload {
  periodMonth: string;
  realizedRevenueDelta?: number | null;
  realizedCostDelta?: number | null;
  realizedSavings?: number | null;
  source?: string | null;
  varianceNotes?: string | null;
}

export interface V8ResultsCreateRoiRealizedResponse {
  id: string;
}

export const V8ResultsApi = {
  getDashboard: (options?: { initiativeId?: string }) =>
    v8Get<{ snapshot: V8ResultsDashboardSnapshot }>('/results/dashboard', options),
  getKpiCatalog: (params?: { kpiId?: string; initiativeId?: string }) =>
    v8Get<V8ResultsKpiCatalog>(
      '/results/kpis/catalog',
      params?.kpiId || params?.initiativeId
        ? {
            ...(params?.kpiId ? { kpiId: params.kpiId } : {}),
            ...(params?.initiativeId ? { initiativeId: params.initiativeId } : {}),
          }
        : undefined
    ),
  getKpiDrawerDetail: (kpiId: string) =>
    v8Get<V8ResultsKpiDrawerDetail>(`/results/kpis/${encodeURIComponent(kpiId)}/drawer-detail`),
  getRoiPortfolioSummary: (options?: { initiativeId?: string }) =>
    v8Get<V8ResultsRoiPortfolioSummary>('/results/roi/portfolio-summary', options),
  getRoiInitiativeDetail: (initiativeId: string) =>
    v8Get<V8ResultsRoiInitiativeDetail>(
      `/results/roi/initiative/${encodeURIComponent(initiativeId)}/detail`
    ),
  getReconciliationOverview: (options?: { initiativeId?: string; kpiId?: string }) =>
    v8Get<V8ResultsReconciliationOverview>(
      '/results/reconciliations',
      options?.initiativeId || options?.kpiId
        ? {
            ...(options?.initiativeId ? { initiativeId: options.initiativeId } : {}),
            ...(options?.kpiId ? { kpiId: options.kpiId } : {}),
          }
        : undefined
    ),
  /**
   * O4.7 — pull actuals for one initiative and (re)reconcile them against the
   * finance model, computing a market-vs-execution post-mortem per KPI↔driver.
   */
  pullReconciliation: (payload: V8ReconciliationPullPayload) =>
    v8Post<V8ReconciliationPullResult>('/results/reconciliations/pull', payload),
  deleteKpiMapping: (mappingId: string) =>
    v8Delete<V8ResultsDeleteKpiMappingResponse>(
      `/results/kpi-mappings/${encodeURIComponent(mappingId)}`
    ),
  // RESULTS-W23 remains live until a canonical resolve successor exists.
  resolveDeviationCase: (caseId: string) =>
    v8Post<V8ResultsResolveDeviationCaseResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/resolve`,
      {}
    ),
  // #M15/OC2 (2026-07-15): AI-assisted diagnostics — anomalies/forecast/RCA
  // suggestions. Behind resultsFeatureFlags.deviationDiagnostics; no legacy
  // /benefits/* equivalent exists, so there is nothing to fall back to.
  getKpiAnomalies: (kpiId: string, query?: Record<string, number | undefined>) =>
    v8Get<V8ResultsKpiAnomaliesResponse>(
      `/results/kpis/${encodeURIComponent(kpiId)}/anomalies${queryStringFrom(query)}`
    ),
  getKpiForecast: (kpiId: string, query?: Record<string, number | undefined>) =>
    v8Get<V8ResultsKpiForecastResponse>(
      `/results/kpis/${encodeURIComponent(kpiId)}/forecast${queryStringFrom(query)}`
    ),
  getDeviationCaseRcaSuggest: (
    caseId: string,
    query?: Record<string, string | number | boolean | undefined>
  ) =>
    v8Get<V8ResultsDeviationCaseRcaSuggestResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/rca-suggest${queryStringFrom(query)}`
    ),
  createKpiReport: (payload: V8ResultsCreateKpiReportPayload) =>
    v8Post<V8ResultsCreateKpiReportResponse>('/results/kpi-reports', payload),
  refreshKpiReport: (snapshotId: string) =>
    v8Post<V8ResultsCreateKpiReportResponse>(
      `/results/kpi-reports/${encodeURIComponent(snapshotId)}/refresh`,
      {}
    ),
  getWorkflowSignals: () =>
    v8Get<{
      data: Array<{
        signalId: string;
        kpiId: string;
        severity: string;
        description: string;
        createdAt: string;
        kpiName?: string;
      }>;
    }>('/results/workflow/signals'),

  // M14 → M15 closure-handoff benefits inbox (Decision B1b).
  getClosureBenefitsInbox: () =>
    v8Get<{ items: V8ResultsClosureBenefit[] }>('/results/benefits/inbox'),
  promoteClosureBenefit: (benefitId: string) =>
    v8Post<{ kpiId: string | null; alreadyPromoted: boolean }>(
      `/results/benefits/${encodeURIComponent(benefitId)}/promote`,
      {}
    ),
  dismissClosureBenefit: (benefitId: string) =>
    v8Post<{ success: boolean }>(`/results/benefits/${encodeURIComponent(benefitId)}/dismiss`, {}),

  // #RES-003A (2026-08-01) — KPI Recovery Card: canonical recovery loop for an
  // open deviation case (hypothesis → confirmed cause → actions/checkpoints →
  // close/continue/escalate, optimistic concurrency via `version`). Behind
  // resultsFeatureFlags.recoveryCard (default OFF). New surface — no legacy
  // /benefits/* equivalent, so there is nothing to fall back to.
  getRecoveryCard: (caseId: string) =>
    v8Get<V8ResultsKpiRecoveryCard>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/recovery-card`
    ),
  createRecoveryCard: (caseId: string, payload?: V8ResultsCreateRecoveryCardPayload) =>
    v8Post<V8ResultsKpiRecoveryCard>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/recovery-card`,
      payload || {}
    ),
  updateRecoveryCard: (cardId: string, payload: V8ResultsUpdateRecoveryCardPayload) =>
    v8Put<V8ResultsKpiRecoveryCard>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}`,
      payload
    ),
  // Sub-resource mutations below return ONLY the sub-resource (camelCase),
  // never the full card — callers must refetch getRecoveryCard() afterwards
  // to refresh `actions`/`checkpoints` in local state. Contrast with
  // updateRecoveryCard/closeRecoveryCard/continueRecoveryCard/
  // escalateRecoveryCard above and close/continue/escalate below, which DO
  // return the full card with actions/checkpoints embedded.
  createRecoveryAction: (cardId: string, payload: V8ResultsCreateRecoveryActionPayload) =>
    v8Post<V8ResultsKpiRecoveryAction>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/actions`,
      payload
    ),
  updateRecoveryAction: (
    cardId: string,
    actionId: string,
    payload: V8ResultsUpdateRecoveryActionPayload
  ) =>
    v8Put<V8ResultsKpiRecoveryAction>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/actions/${encodeURIComponent(actionId)}`,
      payload
    ),
  // POST link-task does NOT return a bare ActionDTO — the route wraps it as
  // `{ linked, linkedTaskId, action }` (linkRecoveryActionTask service result
  // spread with a freshly-reloaded action DTO). Verified against
  // server/src/routes/v8/results.routes.ts (2026-08-01, parallel backend
  // track): `data: { ...result, action: freshAction ? toActionDTO(...) : null }`.
  linkRecoveryActionTask: (cardId: string, actionId: string) =>
    v8Post<V8ResultsLinkRecoveryActionTaskResponse>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/actions/${encodeURIComponent(actionId)}/link-task`,
      {}
    ),
  createRecoveryCheckpoint: (cardId: string, payload: V8ResultsCreateRecoveryCheckpointPayload) =>
    v8Post<V8ResultsKpiRecoveryCheckpoint>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/checkpoints`,
      payload
    ),
  resolveRecoveryCheckpoint: (
    cardId: string,
    checkpointId: string,
    payload: V8ResultsResolveRecoveryCheckpointPayload
  ) =>
    v8Put<V8ResultsKpiRecoveryCheckpoint>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/checkpoints/${encodeURIComponent(checkpointId)}/resolve`,
      payload
    ),
  closeRecoveryCard: (cardId: string, payload: V8ResultsCloseRecoveryCardPayload) =>
    v8Post<V8ResultsKpiRecoveryCard>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/close`,
      payload
    ),
  continueRecoveryCard: (cardId: string, payload: V8ResultsContinueRecoveryCardPayload) =>
    v8Post<V8ResultsKpiRecoveryCard>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/continue`,
      payload
    ),
  escalateRecoveryCard: (cardId: string, payload: V8ResultsEscalateRecoveryCardPayload) =>
    v8Post<V8ResultsKpiRecoveryCard>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/escalate`,
      payload
    ),
  listRecoveryExperiments: (cardId: string) =>
    v8Get<V8ResultsRecoveryExperiment[]>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/experiments`
    ),
  createRecoveryExperiment: (
    cardId: string,
    payload: V8ResultsCreateRecoveryExperimentPayload,
    idempotencyKey: string
  ) =>
    v8Post<V8ResultsRecoveryExperiment>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/experiments`,
      payload,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  reviewRecoveryExperiment: (cardId: string, experimentId: string, approved: boolean) =>
    v8Post<V8ResultsRecoveryExperiment>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/experiments/${encodeURIComponent(experimentId)}/review`,
      { approved }
    ),
  decideRecoveryExperiment: (
    cardId: string,
    experimentId: string,
    payload: {
      verdict: V8ResultsRecoveryExperimentVerdict;
      evidence: string;
      decision: V8ResultsRecoveryExperimentDecision;
    }
  ) =>
    v8Post<V8ResultsRecoveryExperiment>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/experiments/${encodeURIComponent(experimentId)}/verdict`,
      payload
    ),
  confirmRecoveryCause: (
    cardId: string,
    payload: { cause: string; evidence: string },
    idempotencyKey: string
  ) =>
    v8Post<{ id: string; confirmedCause: string }>(
      `/results/recovery-cards/${encodeURIComponent(cardId)}/confirmed-cause`,
      payload,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  // RES-10 — Results-owned scorecards ("karty KPI"). Never confuse with the
  // Initiatives goals contract (src/services/api.ts `goals*`).
  getScorecards: () => v8Get<V8ResultsScorecardListResponse>('/results/scorecards'),
  getScorecardKpis: (scorecardId: string) =>
    v8Get<V8ResultsScorecardKpisResponse>(
      `/results/scorecards/${encodeURIComponent(scorecardId)}/kpis`
    ),
  updateScorecard: (scorecardId: string, payload: V8ResultsUpdateScorecardPayload) =>
    v8Put<{ scorecard: V8ResultsScorecard; ownerDomain: 'results' }>(
      `/results/scorecards/${encodeURIComponent(scorecardId)}`,
      payload
    ),
};

/** A closure-handoff benefit awaiting triage in the M15 Results inbox. */
export interface V8ResultsClosureBenefit {
  id: string;
  initiativeId: string;
  initiativeName: string | null;
  kpiName: string;
  sourceKpiId: string | null;
  unit: string | null;
  description: string | null;
  targetValue: number | null;
  status: string;
  closedAt: string | null;
  createdAt: string | null;
}

// #RES-003A (2026-08-01) — KPI Recovery Card types. See V8ResultsApi.*Recovery*
// methods above; contract fixed by the parallel backend track (server/**).
export type V8ResultsRecoveryCardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type V8ResultsRecoveryCardLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'CLOSED';
export type V8ResultsRecoveryCardDecision = 'CONTINUE' | 'ESCALATE' | 'CLOSE';
export type V8ResultsRecoveryEffectivenessStatus =
  'NOT_YET_DUE' | 'PENDING_ASSESSMENT' | 'ASSESSED';
export type V8ResultsRecoveryEffectivenessRating =
  'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
export type V8ResultsRecoveryActionType = 'IMMEDIATE' | 'DURABLE';
export type V8ResultsRecoveryActionStatus = 'OPEN' | 'DONE' | 'CANCELLED';
export type V8ResultsRecoveryTaskLinkStatus = 'NONE' | 'PENDING' | 'LINKED' | 'LINK_FAILED';
export type V8ResultsRecoveryCheckpointStatus = 'PENDING' | 'MET' | 'MISSED' | 'CANCELLED';
export type V8ResultsRecoveryExperimentVerdict = 'SUPPORTED' | 'NOT_SUPPORTED' | 'INCONCLUSIVE';
export type V8ResultsRecoveryExperimentDecision = 'CONTINUE' | 'REVISE' | 'ESCALATE' | 'CLOSE';
export interface V8ResultsRecoveryExperiment {
  id: string;
  recoveryCardId: string;
  version: number;
  intervention: string;
  comparison: string | null;
  baseline: string;
  measurementWindow: string;
  successCriterion: string;
  ownerUserId: string;
  remeasureAt: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy: string | null;
  approvedAt: string | null;
  verdict: V8ResultsRecoveryExperimentVerdict | null;
  verdictEvidence: string | null;
  decision: V8ResultsRecoveryExperimentDecision | null;
  createdBy: string;
  createdAt: string;
}
export interface V8ResultsCreateRecoveryExperimentPayload {
  intervention: string;
  comparison?: string | null;
  baseline: string;
  measurementWindow: string;
  successCriterion: string;
  ownerUserId: string;
  remeasureAt: string;
}
export type V8ResultsCloseRecoveryCardBlockedReason =
  'STILL_BREACHING' | 'STALE_MEASUREMENT' | 'MISSING_EVIDENCE' | 'VERSION_CONFLICT';

export interface V8ResultsKpiRecoveryAction {
  id: string;
  actionType: V8ResultsRecoveryActionType;
  title: string;
  description?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  status: V8ResultsRecoveryActionStatus;
  linkedTaskId?: string | null;
  taskLinkStatus: V8ResultsRecoveryTaskLinkStatus;
}

/**
 * POST .../actions/:actionId/link-task response shape — a sub-resource
 * endpoint, but NOT a bare ActionDTO: it wraps the link outcome
 * (`linked`/`linkedTaskId`) around the refreshed action.
 */
export interface V8ResultsLinkRecoveryActionTaskResponse {
  linked: boolean;
  linkedTaskId: string | null;
  action: V8ResultsKpiRecoveryAction | null;
}

export interface V8ResultsKpiRecoveryCheckpoint {
  id: string;
  checkpointDate: string;
  status: V8ResultsRecoveryCheckpointStatus;
  notes?: string | null;
  kpiTimeSeriesId?: string | null;
}

/**
 * Shape of one `dependencies`/`risks` entry — JSONB column, matches the
 * migration schema. `description` is the only required field; `relatedId`
 * (e.g. an initiative/task/KPI id) and `note` are optional supplementary
 * detail entered behind an "add details" expand in the UI.
 */
export interface V8ResultsRecoveryListItem {
  description: string;
  relatedId?: string;
  note?: string;
}

export interface V8ResultsKpiRecoveryCard {
  id: string;
  deviationCaseId: string;
  kpiId: string;
  hypothesis?: string | null;
  confirmedCause?: string | null;
  impactDescription?: string | null;
  priority: V8ResultsRecoveryCardPriority;
  expectedImpact?: string | null;
  dependencies: V8ResultsRecoveryListItem[];
  risks: V8ResultsRecoveryListItem[];
  expectedRecoveryDate?: string | null;
  effectivenessCriteria?: string | null;
  effectivenessStatus: V8ResultsRecoveryEffectivenessStatus;
  effectivenessRating?: V8ResultsRecoveryEffectivenessRating | null;
  lifecycleStatus: V8ResultsRecoveryCardLifecycleStatus;
  decision?: V8ResultsRecoveryCardDecision | null;
  version: number;
  evidenceText?: string | null;
  evidenceRef?: string | null;
  actions: V8ResultsKpiRecoveryAction[];
  checkpoints: V8ResultsKpiRecoveryCheckpoint[];
  createdBy?: string | null;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt: string;
  closedBy?: string | null;
  closedAt?: string | null;
}

export interface V8ResultsCreateRecoveryCardPayload {
  hypothesis?: string;
  priority?: V8ResultsRecoveryCardPriority;
  expectedImpact?: string;
  expectedRecoveryDate?: string;
  effectivenessCriteria?: string;
}

export interface V8ResultsUpdateRecoveryCardPayload {
  version: number;
  hypothesis?: string;
  confirmedCause?: string;
  impactDescription?: string;
  priority?: V8ResultsRecoveryCardPriority;
  expectedImpact?: string;
  dependencies?: V8ResultsRecoveryListItem[];
  risks?: V8ResultsRecoveryListItem[];
  expectedRecoveryDate?: string;
  effectivenessCriteria?: string;
}

export interface V8ResultsCreateRecoveryActionPayload {
  title: string;
  description?: string;
  actionType: V8ResultsRecoveryActionType;
  ownerUserId?: string;
  dueDate?: string;
  idempotencyKey?: string;
}

export interface V8ResultsUpdateRecoveryActionPayload {
  status?: V8ResultsRecoveryActionStatus;
  ownerUserId?: string;
  dueDate?: string;
}

export interface V8ResultsCreateRecoveryCheckpointPayload {
  checkpointDate: string;
  notes?: string;
}

export interface V8ResultsResolveRecoveryCheckpointPayload {
  status: 'MET' | 'MISSED';
  kpiTimeSeriesId?: string;
}

export interface V8ResultsCloseRecoveryCardPayload {
  version: number;
  evidenceText?: string;
  evidenceRef?: string;
  effectivenessRating: V8ResultsRecoveryEffectivenessRating;
}

/** Shape of the `error.data` payload on a 409 from closeRecoveryCard. */
export interface V8ResultsCloseRecoveryCardConflict {
  reason: V8ResultsCloseRecoveryCardBlockedReason;
  latestMeasurement?: unknown;
}

export interface V8ResultsContinueRecoveryCardPayload {
  version: number;
  note?: string;
}

export interface V8ResultsEscalateRecoveryCardPayload {
  version: number;
  note?: string;
  escalateTo?: string;
}
