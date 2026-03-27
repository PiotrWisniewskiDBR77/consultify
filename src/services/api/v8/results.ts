import { v8Delete, v8Get, v8Post, v8Put } from './client';

export const shouldFallbackToLegacyResults = (error: any) => {
  const status = Number(error?.status);
  return [400, 404, 405, 501].includes(status);
};

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
  initiativeId?: string | null;
  initiativeName?: string | null;
  name: string;
  description?: string | null;
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
  kpiId: string;
  kpiName?: string | null;
  impactDirection?: string | null;
}

export interface V8ResultsKpiCatalog {
  organizationId: string;
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

export interface V8ResultsCreateKpiReportPayload {
  periodStart: string;
  periodEnd?: string | null;
  title?: string;
  filters?: Record<string, unknown> | null;
  kpiIds?: string[];
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
  getDashboard: () => v8Get<{ snapshot: V8ResultsDashboardSnapshot }>('/results/dashboard'),
  getKpiCatalog: (params?: { kpiId?: string }) =>
    v8Get<V8ResultsKpiCatalog>(
      '/results/kpis/catalog',
      params?.kpiId ? { kpiId: params.kpiId } : undefined,
    ),
  getKpiDrawerDetail: (kpiId: string) =>
    v8Get<V8ResultsKpiDrawerDetail>(`/results/kpis/${encodeURIComponent(kpiId)}/drawer-detail`),
  createKpiTimeSeriesValue: (kpiId: string, payload: V8ResultsCreateKpiTimeSeriesPayload) =>
    v8Post<V8ResultsCreateKpiTimeSeriesResponse>(
      `/results/kpis/${encodeURIComponent(kpiId)}/time-series`,
      payload,
    ),
  getRoiPortfolioSummary: () =>
    v8Get<V8ResultsRoiPortfolioSummary>('/results/roi/portfolio-summary'),
  getRoiInitiativeDetail: (initiativeId: string) =>
    v8Get<V8ResultsRoiInitiativeDetail>(
      `/results/roi/initiative/${encodeURIComponent(initiativeId)}/detail`,
    ),
  createKpi: (payload: V8ResultsCreateKpiPayload) =>
    v8Post<V8ResultsCreateKpiResponse>('/results/kpis', payload),
  updateKpi: (kpiId: string, payload: V8ResultsUpdateKpiPayload) =>
    v8Put<V8ResultsUpdateKpiResponse>(`/results/kpis/${encodeURIComponent(kpiId)}`, payload),
  createKpiMapping: (payload: V8ResultsCreateKpiMappingPayload) =>
    v8Post<V8ResultsCreateKpiMappingResponse>('/results/kpi-mappings', payload),
  deleteKpiMapping: (mappingId: string) =>
    v8Delete<V8ResultsDeleteKpiMappingResponse>(
      `/results/kpi-mappings/${encodeURIComponent(mappingId)}`,
    ),
  createKpiReport: (payload: V8ResultsCreateKpiReportPayload) =>
    v8Post<V8ResultsCreateKpiReportResponse>('/results/kpi-reports', payload),
  updateRoiInitiativeAssumptions: (
    initiativeId: string,
    payload: V8ResultsUpdateRoiAssumptionsPayload,
  ) =>
    v8Put<V8ResultsUpdateRoiAssumptionsResponse>(
      `/results/roi/initiative/${encodeURIComponent(initiativeId)}/assumptions`,
      payload,
    ),
  createRoiInitiativeRealizedEntry: (
    initiativeId: string,
    payload: V8ResultsCreateRoiRealizedPayload,
  ) =>
    v8Post<V8ResultsCreateRoiRealizedResponse>(
      `/results/roi/initiative/${encodeURIComponent(initiativeId)}/realized`,
      payload,
    ),
};
