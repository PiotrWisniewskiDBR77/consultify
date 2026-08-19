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
  | 'market-driven'
  | 'execution-driven'
  | 'mixed'
  | 'on-plan'
  | 'undetermined';

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
  latestValue?: number | null;
  latestMeasurementDate?: string | null;
  prevValue?: number | null;
  prevMeasurementDate?: string | null;
  isOnTarget: boolean;
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
}

export interface V8ResultsUpdateKpiResponse {
  success: boolean;
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
    | 'measurement'
    | 'adoption'
    | 'scope'
    | 'external'
    | 'capacity'
    | 'data-quality'
    | string;
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
  getScorecards: () =>
    v8Get<{
      scorecards: Array<{
        id: string;
        name: string;
        department: string | null;
        periodLabel: string | null;
        periodStart: string | null;
        periodEnd: string | null;
        status: string;
        kpiCount: number;
        onTargetCount: number;
      }>;
      count: number;
    }>('/results/scorecards'),
  getScorecardKpis: (scorecardId: string) =>
    v8Get<{
      scorecard: { id: string; name: string };
      kpis: Array<Record<string, unknown> & { id: string; name: string }>;
      count: number;
    }>(`/results/scorecards/${encodeURIComponent(scorecardId)}/kpis`),
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
  createKpiTimeSeriesValue: (kpiId: string, payload: V8ResultsCreateKpiTimeSeriesPayload) =>
    v8Post<V8ResultsCreateKpiTimeSeriesResponse>(
      `/results/kpis/${encodeURIComponent(kpiId)}/time-series`,
      payload
    ),
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
  createKpi: (payload: V8ResultsCreateKpiPayload) =>
    v8Post<V8ResultsCreateKpiResponse>('/results/kpis', payload),
  updateKpi: (kpiId: string, payload: V8ResultsUpdateKpiPayload) =>
    v8Put<V8ResultsUpdateKpiResponse>(`/results/kpis/${encodeURIComponent(kpiId)}`, payload),
  deleteKpi: (kpiId: string) =>
    v8Delete<V8ResultsDeleteKpiResponse>(`/results/kpis/${encodeURIComponent(kpiId)}`),
  createKpiMapping: (payload: V8ResultsCreateKpiMappingPayload) =>
    v8Post<V8ResultsCreateKpiMappingResponse>('/results/kpi-mappings', payload),
  deleteKpiMapping: (mappingId: string) =>
    v8Delete<V8ResultsDeleteKpiMappingResponse>(
      `/results/kpi-mappings/${encodeURIComponent(mappingId)}`
    ),
  acknowledgeDeviationCase: (caseId: string) =>
    v8Post<V8ResultsAcknowledgeDeviationCaseResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/acknowledge`,
      {}
    ),
  updateDeviationCaseRca: (caseId: string, payload: V8ResultsUpdateDeviationCaseRcaPayload) =>
    v8Put<V8ResultsUpdateDeviationCaseRcaResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/rca`,
      payload
    ),
  createDeviationAction: (caseId: string, payload: V8ResultsCreateDeviationActionPayload) =>
    v8Post<V8ResultsCreateDeviationActionResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/actions`,
      payload
    ),
  updateDeviationAction: (
    caseId: string,
    actionId: string,
    payload: V8ResultsUpdateDeviationActionPayload
  ) =>
    v8Put<V8ResultsUpdateDeviationActionResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/actions/${encodeURIComponent(actionId)}`,
      payload
    ),
  resolveDeviationCase: (caseId: string) =>
    v8Post<V8ResultsResolveDeviationCaseResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/resolve`,
      {}
    ),
  closeDeviationCase: (caseId: string, payload: V8ResultsCloseDeviationCasePayload) =>
    v8Post<V8ResultsCloseDeviationCaseResponse>(
      `/results/deviation-cases/${encodeURIComponent(caseId)}/close`,
      payload
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
  updateRoiInitiativeAssumptions: (
    initiativeId: string,
    payload: V8ResultsUpdateRoiAssumptionsPayload
  ) =>
    v8Put<V8ResultsUpdateRoiAssumptionsResponse>(
      `/results/roi/initiative/${encodeURIComponent(initiativeId)}/assumptions`,
      payload
    ),
  createRoiInitiativeRealizedEntry: (
    initiativeId: string,
    payload: V8ResultsCreateRoiRealizedPayload
  ) =>
    v8Post<V8ResultsCreateRoiRealizedResponse>(
      `/results/roi/initiative/${encodeURIComponent(initiativeId)}/realized`,
      payload
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
