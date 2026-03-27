import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8ResultsApi, shouldFallbackToLegacyResults } from '@/services/api/v8/results';
import { v8Get, v8Post, v8Put } from '@/services/api/v8/client';

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

    expect(v8Get).toHaveBeenCalledWith('/results/dashboard');
    expect(data.snapshot.kpiScorecard.totalKpis).toBe(5);
    expect(data.snapshot.roiDashboard.totalRealized).toBe(1200);
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

    expect(v8Get).toHaveBeenCalledWith('/results/roi/portfolio-summary');
    expect(data.summary.totalProjected).toBe(300);
    expect(data.items[0].initiativeId).toBe('init-1');
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
});
