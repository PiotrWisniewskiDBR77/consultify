import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
  v8Delete: vi.fn(),
}));

import { V8ResultsApi, shouldFallbackToLegacyResults } from '@/services/api/v8/results';
import { v8Delete, v8Get, v8Post, v8Put } from '@/services/api/v8/client';

describe('V8ResultsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed results dashboard from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      snapshot: {
        organizationId: 'org-1',
        kpiScorecard: {
          organizationId: 'org-1',
          totalKpis: 5,
          byStatus: { active: 5 },
          byCategory: { count: 5 },
          averageTargetAchievementRate: 0.75,
        },
        activeDeviationsCount: 2,
        roiDashboard: {
          organizationId: 'org-1',
          totalEntries: 3,
          totalRealized: 1200,
          projectedFromKpiTargets: 2400,
          overallRealizationRate: 0.5,
          byInitiative: [],
        },
        reconciliationHealth: {
          organizationId: 'org-1',
          total: 1,
          byStatus: { pending: 1 },
          unresolvedCount: 1,
          averageResolutionHours: null,
        },
        recentReviewPacks: [],
      },
    });

    const data = await V8ResultsApi.getDashboard();

    expect(v8Get).toHaveBeenCalledWith('/results/dashboard', undefined);
    expect(data.snapshot.kpiScorecard.totalKpis).toBe(5);
    expect(data.snapshot.roiDashboard.totalRealized).toBe(1200);
  });

  it('requests initiative-scoped governed dashboard from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      snapshot: {
        organizationId: 'org-1',
        kpiScorecard: {
          organizationId: 'org-1',
          totalKpis: 2,
          byStatus: { onTarget: 2 },
          byCategory: {},
          averageTargetAchievementRate: 0.9,
        },
        activeDeviationsCount: 0,
        roiDashboard: {
          organizationId: 'org-1',
          totalEntries: 1,
          totalRealized: 1000,
          projectedFromKpiTargets: 1500,
          overallRealizationRate: 0.66,
          byInitiative: [],
        },
        reconciliationHealth: {
          organizationId: 'org-1',
          total: 0,
          byStatus: {},
          unresolvedCount: 0,
          averageResolutionHours: null,
        },
        recentReviewPacks: [],
      },
    });

    await V8ResultsApi.getDashboard({ initiativeId: 'init-1' });
    expect(v8Get).toHaveBeenCalledWith('/results/dashboard', { initiativeId: 'init-1' });
  });

  it('requests the governed ROI portfolio summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      organizationId: 'org-1',
      items: [
        {
          initiativeId: 'init-1',
          initiativeName: 'Initiative Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: 100,
          opexAnnual: 20,
          projectedBenefit: 300,
          realizedBenefit: 120,
          variance: -180,
          confidence: 'medium',
          hasRealized: true,
        },
      ],
      summary: {
        totalProjected: 300,
        totalRealized: 120,
        totalCapex: 100,
        totalVariance: -180,
        initiativeCount: 1,
        coveragePercent: 100,
      },
    });

    const data = await V8ResultsApi.getRoiPortfolioSummary();

    expect(v8Get).toHaveBeenCalledWith('/results/roi/portfolio-summary', undefined);
    expect(data.summary.totalProjected).toBe(300);
    expect(data.items[0].initiativeId).toBe('init-1');
  });

  it('requests initiative-scoped ROI portfolio summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      organizationId: 'org-1',
      items: [],
      summary: {
        totalProjected: 0,
        totalRealized: 0,
        totalCapex: 0,
        totalVariance: 0,
        initiativeCount: 0,
        coveragePercent: 0,
      },
    });

    await V8ResultsApi.getRoiPortfolioSummary({ initiativeId: 'init-1' });
    expect(v8Get).toHaveBeenCalledWith('/results/roi/portfolio-summary', { initiativeId: 'init-1' });
  });

  it('requests the governed KPI catalog from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [{ id: 'kpi-1', name: 'KPI Alpha' }],
      mappings: [{ id: 'map-1', kpiId: 'kpi-1', initiativeId: 'init-1' }],
    });

    const data = await V8ResultsApi.getKpiCatalog({ kpiId: 'kpi-1' });

    expect(v8Get).toHaveBeenCalledWith('/results/kpis/catalog', { kpiId: 'kpi-1' });
    expect(data.kpis[0].id).toBe('kpi-1');
    expect(data.mappings[0].initiativeId).toBe('init-1');
  });

  it('requests initiative-scoped governed KPI catalog from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [],
      mappings: [],
      initiatives: [],
    });

    await V8ResultsApi.getKpiCatalog({ initiativeId: 'init-1' });
    expect(v8Get).toHaveBeenCalledWith('/results/kpis/catalog', { initiativeId: 'init-1' });
  });

  it('requests the governed KPI drawer detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    });

    const data = await V8ResultsApi.getKpiDrawerDetail('kpi-1');

    expect(v8Get).toHaveBeenCalledWith('/results/kpis/kpi-1/drawer-detail');
    expect(data.kpiId).toBe('kpi-1');
  });

  it('requests governed KPI report refresh from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      snapshotId: 'snap-2',
      reportId: 'report-2',
    });

    const data = await V8ResultsApi.refreshKpiReport('snap-1');

    expect(v8Post).toHaveBeenCalledWith('/results/kpi-reports/snap-1/refresh', {});
    expect(data.reportId).toBe('report-2');
  });

  it('requests governed KPI time-series record from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      id: 'ts-1',
      kpiId: 'kpi-1',
      value: 24,
      measuredAt: '2026-03-01',
      periodStart: '2026-03-01',
      periodKey: '2026-03',
    });

    const data = await V8ResultsApi.createKpiTimeSeriesValue('kpi-1', {
      value: 24,
      periodStart: '2026-03-01',
      notes: 'March value',
    });

    expect(v8Post).toHaveBeenCalledWith('/results/kpis/kpi-1/time-series', {
      value: 24,
      periodStart: '2026-03-01',
      notes: 'March value',
    });
    expect(data.id).toBe('ts-1');
    expect(data.periodKey).toBe('2026-03');
  });

  it('requests the governed ROI initiative detail from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      organizationId: 'org-1',
      initiativeId: 'init-1',
      variance: { hasAssumptions: false, variance: null },
      assumptions: null,
      realized: [],
    });

    const data = await V8ResultsApi.getRoiInitiativeDetail('init-1');

    expect(v8Get).toHaveBeenCalledWith('/results/roi/initiative/init-1/detail');
    expect(data.initiativeId).toBe('init-1');
  });

  it('falls back to legacy results routes only for bounded compatibility statuses', () => {
    expect(shouldFallbackToLegacyResults({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacyResults({ status: 501 })).toBe(true);
    expect(shouldFallbackToLegacyResults({ status: 500 })).toBe(false);
    expect(shouldFallbackToLegacyResults({ status: 429 })).toBe(false);
  });

  it('requests governed KPI create from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'kpi-1' });

    const data = await V8ResultsApi.createKpi({
      name: 'Revenue Growth',
      targetValue: 100,
      measurementFrequency: 'MONTHLY',
    });

    expect(v8Post).toHaveBeenCalledWith('/results/kpis', {
      name: 'Revenue Growth',
      targetValue: 100,
      measurementFrequency: 'MONTHLY',
    });
    expect(data.id).toBe('kpi-1');
  });

  it('requests governed KPI settings save from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.updateKpi('kpi-1', {
      name: 'Revenue Growth',
      description: 'Updated description',
      unit: '%',
      baselineValue: 10,
      targetValue: 20,
      measurementFrequency: 'MONTHLY',
      direction: 'HIGHER_IS_BETTER',
      thresholdMode: 'PERCENT_FROM_TARGET',
      amberThresholdPct: 5,
      redThresholdPct: 10,
    });

    expect(v8Put).toHaveBeenCalledWith('/results/kpis/kpi-1', {
      name: 'Revenue Growth',
      description: 'Updated description',
      unit: '%',
      baselineValue: 10,
      targetValue: 20,
      measurementFrequency: 'MONTHLY',
      direction: 'HIGHER_IS_BETTER',
      thresholdMode: 'PERCENT_FROM_TARGET',
      amberThresholdPct: 5,
      redThresholdPct: 10,
    });
    expect(data.success).toBe(true);
  });

  it('requests governed KPI delete from the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.deleteKpi('kpi-1');

    expect(v8Delete).toHaveBeenCalledWith('/results/kpis/kpi-1');
    expect(data.success).toBe(true);
  });

  it('requests governed KPI mapping create from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      id: 'map-1',
      initiativeId: 'init-1',
      kpiId: 'kpi-1',
    });

    const data = await V8ResultsApi.createKpiMapping({
      initiativeId: 'init-1',
      kpiId: 'kpi-1',
      impactDirection: 'increase',
    });

    expect(v8Post).toHaveBeenCalledWith('/results/kpi-mappings', {
      initiativeId: 'init-1',
      kpiId: 'kpi-1',
      impactDirection: 'increase',
    });
    expect(data.id).toBe('map-1');
    expect(data.initiativeId).toBe('init-1');
  });

  it('requests governed KPI mapping delete from the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.deleteKpiMapping('map-1');

    expect(v8Delete).toHaveBeenCalledWith('/results/kpi-mappings/map-1');
    expect(data.success).toBe(true);
  });

  it('requests governed deviation-case acknowledge from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.acknowledgeDeviationCase('case-1');

    expect(v8Post).toHaveBeenCalledWith('/results/deviation-cases/case-1/acknowledge', {});
    expect(data.success).toBe(true);
  });

  it('requests governed deviation-case RCA save from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.updateDeviationCaseRca('case-1', {
      rcaText: 'Root cause analysis details',
    });

    expect(v8Put).toHaveBeenCalledWith('/results/deviation-cases/case-1/rca', {
      rcaText: 'Root cause analysis details',
    });
    expect(data.success).toBe(true);
  });

  it('requests governed deviation action create from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'action-1', caseId: 'case-1' });

    const data = await V8ResultsApi.createDeviationAction('case-1', {
      title: 'Create mitigation plan',
      dueDate: '2026-03-31',
    });

    expect(v8Post).toHaveBeenCalledWith('/results/deviation-cases/case-1/actions', {
      title: 'Create mitigation plan',
      dueDate: '2026-03-31',
    });
    expect(data.id).toBe('action-1');
    expect(data.caseId).toBe('case-1');
  });

  it('requests governed deviation action update from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.updateDeviationAction('case-1', 'action-1', {
      status: 'DONE',
    });

    expect(v8Put).toHaveBeenCalledWith('/results/deviation-cases/case-1/actions/action-1', {
      status: 'DONE',
    });
    expect(data.success).toBe(true);
  });

  it('requests governed deviation-case resolve from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.resolveDeviationCase('case-1');

    expect(v8Post).toHaveBeenCalledWith('/results/deviation-cases/case-1/resolve', {});
    expect(data.success).toBe(true);
  });

  it('requests governed deviation-case close from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.closeDeviationCase('case-1', {
      evidenceText: 'Verified mitigation in review pack',
      resolutionNotes: 'Closed after governance review',
    });

    expect(v8Post).toHaveBeenCalledWith('/results/deviation-cases/case-1/close', {
      evidenceText: 'Verified mitigation in review pack',
      resolutionNotes: 'Closed after governance review',
    });
    expect(data.success).toBe(true);
  });

  it('requests governed KPI report create from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      snapshotId: 'snap-1',
      reportId: 'report-1',
    });

    const data = await V8ResultsApi.createKpiReport({
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      title: 'Monthly KPI Review',
      kpiIds: ['kpi-1'],
    });

    expect(v8Post).toHaveBeenCalledWith('/results/kpi-reports', {
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      title: 'Monthly KPI Review',
      kpiIds: ['kpi-1'],
    });
    expect(data.reportId).toBe('report-1');
    expect(data.snapshotId).toBe('snap-1');
  });

  it('requests governed ROI assumptions save from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({ success: true });

    const data = await V8ResultsApi.updateRoiInitiativeAssumptions('init-1', {
      expectedRevenueDelta: 200,
      expectedCostDelta: 100,
      horizonMonths: 24,
      confidence: 'medium',
    });

    expect(v8Put).toHaveBeenCalledWith('/results/roi/initiative/init-1/assumptions', {
      expectedRevenueDelta: 200,
      expectedCostDelta: 100,
      horizonMonths: 24,
      confidence: 'medium',
    });
    expect(data.success).toBe(true);
  });

  it('requests governed ROI realized entry create from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'real-1' });

    const data = await V8ResultsApi.createRoiInitiativeRealizedEntry('init-1', {
      periodMonth: '2026-03-01',
      realizedSavings: 120,
      varianceNotes: 'March realized benefit',
      source: 'manual',
    });

    expect(v8Post).toHaveBeenCalledWith('/results/roi/initiative/init-1/realized', {
      periodMonth: '2026-03-01',
      realizedSavings: 120,
      varianceNotes: 'March realized benefit',
      source: 'manual',
    });
    expect(data.id).toBe('real-1');
  });

  // #M15/OC2 (2026-07-15): wiring of the 3 previously orphaned Results engines
  // (kpiAnomaly/kpiForecast/deviationRcaSuggest) into the V8 namespace.
  it('requests KPI anomalies from the V8 namespace (no query when unset)', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      kpiId: 'kpi-1',
      anomalies: [{ index: 4, value: 100, periodIso: '2026-05-01', method: 'zscore', severity: 'severe', score: 3.2 }],
      summary: { hasAnomalies: true, count: 1 },
    });

    const data = await V8ResultsApi.getKpiAnomalies('kpi-1');

    expect(v8Get).toHaveBeenCalledWith('/results/kpis/kpi-1/anomalies');
    expect(data.summary.hasAnomalies).toBe(true);
    expect(data.anomalies[0].value).toBe(100);
  });

  it('appends only defined query overrides for KPI anomalies', async () => {
    vi.mocked(v8Get).mockResolvedValue({ kpiId: 'kpi-1', anomalies: [], summary: { hasAnomalies: false, count: 0 } });

    await V8ResultsApi.getKpiAnomalies('kpi-1', { zThreshold: 2.5, iqrK: undefined });

    expect(v8Get).toHaveBeenCalledWith('/results/kpis/kpi-1/anomalies?zThreshold=2.5');
  });

  it('requests KPI forecast from the V8 namespace and encodes the kpiId', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      kpiId: 'kpi/1',
      target: 100,
      direction: 'HIGHER_IS_BETTER',
      trend: { slope: 30, intercept: 10 },
      projection: { willHitTarget: true },
      alert: null,
      points: [],
    });

    const data = await V8ResultsApi.getKpiForecast('kpi/1', { deadlineT: 5 });

    expect(v8Get).toHaveBeenCalledWith('/results/kpis/kpi%2F1/forecast?deadlineT=5');
    expect(data.projection?.willHitTarget).toBe(true);
    expect(data.trend.slope).toBe(30);
  });

  it('requests deviation-case RCA suggestions from the V8 namespace with judgment overrides', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      caseId: 'case-1',
      kpiId: 'kpi-1',
      signals: { deviationPct: -0.4, trend: 'declining', scopeChanged: true },
      hypotheses: [{ category: 'scope', hypothesis: 'Scope creep diluted the effect', confidence: 0.7 }],
      actions: [{ title: 'Re-baseline the initiative scope' }],
    });

    const data = await V8ResultsApi.getDeviationCaseRcaSuggest('case-1', {
      scopeChanged: true,
      adoptionScore: 0.1,
    });

    expect(v8Get).toHaveBeenCalledWith(
      '/results/deviation-cases/case-1/rca-suggest?scopeChanged=true&adoptionScore=0.1'
    );
    expect(data.hypotheses[0].category).toBe('scope');
    expect(data.actions[0].title).toContain('Re-baseline');
  });
});
