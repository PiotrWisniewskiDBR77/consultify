import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getActiveDeviations,
  getKPIScorecard,
  getKPITrend,
  getReconciliationHealth,
  getResultsDashboard,
  getResultsKpiCatalog,
  getResultsKpiDrawerDetail,
  getReviewPackTimeline,
  getROIByDateRange,
  getROIDashboard,
  getROIInitiativeDetail,
  getROIPortfolioSummary,
  resolveDeviation,
} from '../resultsROIService.js';

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const KPI_ID = '11111111-2222-4333-8444-555555555555';
const DEVIATION_ID = '22222222-3333-4444-8555-666666666666';
const PACK_ID = '33333333-4444-4555-8666-777777777777';
const ENTRY_ID = '44444444-5555-4666-8777-888888888888';
const INITIATIVE_ID = '55555555-6666-4777-8888-999999999999';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getKPIScorecard', () => {
  it('aggregates totals, status, metric type, and average achievement rate', async () => {
    mockDbGet.mockResolvedValueOnce({ total: 4 }).mockResolvedValueOnce({ avg_rate: 0.875 });
    mockDbAll
      .mockResolvedValueOnce([
        { status: 'active', cnt: 2 },
        { status: 'design', cnt: 2 },
      ])
      .mockResolvedValueOnce([
        { metric_type: 'percentage', cnt: 2 },
        { metric_type: 'currency', cnt: 2 },
      ]);

    const card = await getKPIScorecard(ORG_ID);

    expect(card.organizationId).toBe(ORG_ID);
    expect(card.totalKpis).toBe(4);
    expect(card.byStatus.active).toBe(2);
    expect(card.byStatus.design).toBe(2);
    expect(card.byCategory.percentage).toBe(2);
    expect(card.byCategory.currency).toBe(2);
    expect(card.averageTargetAchievementRate).toBeCloseTo(0.875);
  });

  it('returns null average when no eligible KPIs', async () => {
    mockDbGet.mockResolvedValueOnce({ total: 0 }).mockResolvedValueOnce({ avg_rate: null });
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const card = await getKPIScorecard(ORG_ID);
    expect(card.totalKpis).toBe(0);
    expect(card.averageTargetAchievementRate).toBeNull();
  });

  it('avg achievement SQL caps ratio without scalar MIN (Postgres-safe)', async () => {
    mockDbGet.mockResolvedValueOnce({ total: 1 }).mockResolvedValueOnce({ avg_rate: 0.5 });
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getKPIScorecard(ORG_ID);

    const avgSqlCall = mockDbGet.mock.calls.find((c) => String(c[0]).includes('AS avg_rate'));
    expect(avgSqlCall).toBeDefined();
    const sql = avgSqlCall![0] as string;
    expect(sql).not.toMatch(/MIN\s*\(\s*1\.0/i);
    expect(sql).toContain('THEN 1.0');
    // RES-11: qualified `d.current_value`/`d.target_value` since the
    // visibility retrofit joins in `initiative_kpis ck` — same ratio logic,
    // now disambiguated against the joined alias.
    expect(sql).toContain('d.current_value * 1.0 / d.target_value');
  });
});

describe('getKPITrend', () => {
  it('builds trend points from deviation rows joined to KPI', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        created_at: '2026-01-01T00:00:00.000Z',
        observed_actual: 10,
        observed_target: 12,
        current_value: 99,
        target_value: 100,
      },
      {
        created_at: '2026-02-01T00:00:00.000Z',
        observed_actual: null,
        observed_target: null,
        current_value: 11,
        target_value: 12,
      },
    ]);

    const trend = await getKPITrend(KPI_ID, ORG_ID);

    expect(trend).toHaveLength(2);
    expect(trend[0]).toEqual({
      period: '2026-01-01T00:00:00.000Z',
      actualValue: 10,
      targetValue: 12,
      deviation: -2,
    });
    expect(trend[1].actualValue).toBe(11);
    expect(trend[1].targetValue).toBe(12);
    expect(trend[1].deviation).toBe(-1);
  });

  it('limits to the last N periods when periods is set', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        created_at: '2026-01-01T00:00:00.000Z',
        observed_actual: 1,
        observed_target: 1,
        current_value: null,
        target_value: null,
      },
      {
        created_at: '2026-02-01T00:00:00.000Z',
        observed_actual: 2,
        observed_target: 2,
        current_value: null,
        target_value: null,
      },
      {
        created_at: '2026-03-01T00:00:00.000Z',
        observed_actual: 3,
        observed_target: 3,
        current_value: null,
        target_value: null,
      },
    ]);

    const trend = await getKPITrend(KPI_ID, ORG_ID, 2);
    expect(trend).toHaveLength(2);
    expect(trend[0].period).toBe('2026-02-01T00:00:00.000Z');
    expect(trend[1].period).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('getActiveDeviations', () => {
  it('returns unresolved deviations for the org', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        deviation_id: DEVIATION_ID,
        organization_id: ORG_ID,
        kpi_id: KPI_ID,
        deviation_type: 'underperformance',
        severity: 'high',
        action_required: 'Act',
        escalated_to: null,
        created_at: '2026-03-23T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
        resolution: null,
        observed_actual: null,
        observed_target: null,
      },
    ]);

    const rows = await getActiveDeviations(ORG_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].deviationId).toBe(DEVIATION_ID);
    expect(rows[0].resolvedAt).toBeNull();

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('resolved_at IS NULL');
    expect(sql).not.toContain('AND severity =');
  });

  it('filters by severity when provided', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActiveDeviations(ORG_ID, 'critical');
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('AND severity = ?');
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 'critical']);
  });

  it('throws on invalid severity', async () => {
    await expect(getActiveDeviations(ORG_ID, 'nope' as any)).rejects.toThrow(
      'Invalid deviation severity'
    );
  });
});

describe('resolveDeviation', () => {
  it('marks a deviation resolved', async () => {
    mockDbGet.mockResolvedValueOnce({
      deviation_id: DEVIATION_ID,
      organization_id: ORG_ID,
      kpi_id: KPI_ID,
      deviation_type: 'underperformance',
      severity: 'high',
      action_required: 'Act',
      escalated_to: null,
      created_at: '2026-03-23T10:00:00.000Z',
      resolved_at: null,
      resolved_by: null,
      resolution: null,
      observed_actual: null,
      observed_target: null,
    });

    const updated = await resolveDeviation(
      DEVIATION_ID,
      ORG_ID,
      'Root cause addressed',
      'user-uuid-001'
    );

    expect(updated.resolvedBy).toBe('user-uuid-001');
    expect(updated.resolution).toBe('Root cause addressed');
    expect(updated.resolvedAt).toMatch(/^\d{4}-/);
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_deviation_records');
  });

  it('throws when deviation is missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(resolveDeviation(DEVIATION_ID, ORG_ID, 'x', 'y')).rejects.toThrow('not found');
  });
});

describe('getROIDashboard', () => {
  it('aggregates ROI entries, projected targets, and initiative breakdown', async () => {
    mockDbGet
      .mockResolvedValueOnce({ total_entries: 3, total_realized: 300 })
      .mockResolvedValueOnce({ projected: 400 });
    mockDbAll.mockResolvedValueOnce([
      { initiative_id: INITIATIVE_ID, entry_count: 2, realized_sum: 200 },
      { initiative_id: null, entry_count: 1, realized_sum: 100 },
    ]);

    const dash = await getROIDashboard(ORG_ID);

    expect(dash.organizationId).toBe(ORG_ID);
    expect(dash.totalEntries).toBe(3);
    expect(dash.totalRealized).toBe(300);
    expect(dash.projectedFromKpiTargets).toBe(400);
    expect(dash.overallRealizationRate).toBeCloseTo(0.75);
    expect(dash.byInitiative).toHaveLength(2);
  });

  it('returns null realization rate when projected is zero', async () => {
    mockDbGet
      .mockResolvedValueOnce({ total_entries: 0, total_realized: 0 })
      .mockResolvedValueOnce({ projected: 0 });
    mockDbAll.mockResolvedValueOnce([]);

    const dash = await getROIDashboard(ORG_ID);
    expect(dash.overallRealizationRate).toBeNull();
  });
});

describe('getROIPortfolioSummary', () => {
  it('bridges org-scoped ROI assumptions and realized values into a portfolio summary', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          initiative_id: INITIATIVE_ID,
          initiative_name: 'Initiative Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: 100,
          opex_annual: 25,
          expected_revenue_delta: 300,
          expected_cost_delta: 50,
          confidence: 'medium',
        },
      ])
      .mockResolvedValueOnce([
        {
          initiative_id: INITIATIVE_ID,
          total_rev: 120,
          total_cost: 40,
          total_savings: 10,
        },
      ]);

    const summary = await getROIPortfolioSummary(ORG_ID);

    expect(summary.organizationId).toBe(ORG_ID);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      initiativeId: INITIATIVE_ID,
      initiativeName: 'Initiative Alpha',
      projectedBenefit: 350,
      realizedBenefit: 170,
      variance: -180,
      hasRealized: true,
    });
    expect(summary.summary).toEqual({
      totalProjected: 350,
      totalRealized: 170,
      totalCapex: 100,
      totalVariance: -180,
      initiativeCount: 1,
      coveragePercent: 100,
    });
  });
});

describe('getROIInitiativeDetail', () => {
  it('bridges initiative variance, assumptions, and realized rows for the active ROI drawer', async () => {
    mockDbGet.mockResolvedValueOnce({
      expected_revenue_delta: 300,
      expected_cost_delta: 50,
      capex: 100,
      opex_annual: 20,
      horizon_months: 24,
      effect_start_date: '2026-01-01',
      confidence: 'medium',
      assumptions_owner: 'owner-1',
      assumptions_text: 'Assumption text',
      expected_roi_percent: 10,
      expected_npv: 200,
      expected_payback_months: 18,
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'real-1',
        period_month: '2026-03-01',
        realized_revenue_delta: 120,
        realized_cost_delta: 40,
        realized_savings: 10,
        variance_notes: 'note',
        recorded_by: 'user-1',
        created_at: '2026-03-05T00:00:00.000Z',
      },
    ]);

    const detail = await getROIInitiativeDetail(INITIATIVE_ID, ORG_ID);

    expect(detail.organizationId).toBe(ORG_ID);
    expect(detail.initiativeId).toBe(INITIATIVE_ID);
    expect(detail.variance.hasAssumptions).toBe(true);
    expect(detail.variance.projected?.totalBenefit).toBe(350);
    expect(detail.variance.realized?.totalBenefit).toBe(170);
    expect(detail.variance.variance?.absolute).toBe(-180);
    expect(detail.assumptions?.assumptionsOwner).toBe('owner-1');
    expect(detail.realized).toHaveLength(1);
    expect(detail.realized[0].periodMonth).toBe('2026-03-01');
  });
});

describe('getResultsKpiCatalog', () => {
  it('bridges KPI rows and initiative mappings for active Results surfaces', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          id: KPI_ID,
          initiative_id: INITIATIVE_ID,
          initiative_name: 'Initiative Alpha',
          name: 'KPI Alpha',
          description: 'desc',
          unit: '%',
          baseline_value: 10,
          target_value: 20,
          measurement_frequency: 'MONTHLY',
          alert_threshold: 5,
          alert_direction: 'BELOW',
          is_primary: true,
          sort_order: 1,
          owner_user_id: 'owner-1',
          owner_first_name: 'Ada',
          owner_last_name: 'Lovelace',
          direction: 'HIGHER_IS_BETTER',
          threshold_mode: 'PERCENT_FROM_TARGET',
          // RES-004: these are FRACTIONS (0.1 = 10%), matching
          // evaluateKpiPoint's convention — the pre-RES-004 naive isOnTarget
          // computation never read these columns at all, so this fixture's
          // old literal 10/20 values were silent dead data; now that a real
          // engine reads them, they must be realistic (target=20, latest=18
          // is 10% below target -> AMBER at these bands, not RED, not GREEN).
          amber_threshold_pct: 0.1,
          red_threshold_pct: 0.2,
          amber_threshold_abs: null,
          red_threshold_abs: null,
          current_value: 18,
          latest_value: 18,
          latest_period_start: '2026-03-01',
          prev_value: 15,
          prev_period_start: '2026-02-01',
          open_case_id: 'case-1',
          open_case_severity: 'RED',
          open_case_status: 'OPEN',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-03-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'map-1',
          initiative_id: INITIATIVE_ID,
          initiative_name: 'Initiative Alpha',
          kpi_id: KPI_ID,
          kpi_name: 'KPI Alpha',
          impact_direction: 'increase',
        },
      ]);

    const catalog = await getResultsKpiCatalog(ORG_ID, { kpiId: KPI_ID });

    expect(catalog.organizationId).toBe(ORG_ID);
    expect(catalog.kpis).toHaveLength(1);
    expect(catalog.kpis[0]).toMatchObject({
      id: KPI_ID,
      initiativeId: INITIATIVE_ID,
      initiativeName: 'Initiative Alpha',
      ownerName: 'Ada Lovelace',
      isOnTarget: false,
      // RES-004: real band evaluation (18 is 10% below target=20, amber
      // band starts at 10%) — AMBER, not a bare "not literally >= target".
      evalStatus: 'AMBER',
    });
    expect(catalog.mappings).toHaveLength(1);
    expect(catalog.mappings[0]).toMatchObject({
      id: 'map-1',
      initiativeId: INITIATIVE_ID,
      initiativeName: 'Initiative Alpha',
      kpiId: KPI_ID,
      kpiName: 'KPI Alpha',
      impactDirection: 'increase',
    });
  });
});

describe('getResultsKpiDrawerDetail', () => {
  it('bridges KPI measurements and the open deviation case for the active drawer surface', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          id: 'm-1',
          kpi_id: KPI_ID,
          value: 12,
          period_start: '2026-03-01',
          period_end: null,
          measurement_frequency: 'MONTHLY',
          notes: 'note',
          created_at: '2026-03-02T00:00:00.000Z',
          user_id: 'user-1',
          user_first_name: 'Ada',
          user_last_name: 'Lovelace',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'case-1',
          kpi_id: KPI_ID,
          organization_id: ORG_ID,
          period_start: '2026-03-01',
          period_end: '2026-03-31',
          severity: 'RED',
          status: 'OPEN',
          owner_user_id: 'owner-1',
          deviation_summary: 'Below target',
          rca_text: 'Root cause',
          evidence_text: null,
          evidence_ref: null,
          resolution_notes: null,
          detected_at: '2026-03-03T00:00:00.000Z',
          acknowledged_at: null,
          resolved_at: null,
          closed_at: null,
          created_at: '2026-03-03T00:00:00.000Z',
          updated_at: '2026-03-03T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'action-1',
          case_id: 'case-1',
          title: 'Follow up',
          owner_user_id: 'owner-1',
          due_date: '2026-03-10',
          status: 'OPEN',
          created_at: '2026-03-03T00:00:00.000Z',
          updated_at: '2026-03-03T00:00:00.000Z',
        },
      ]);

    const detail = await getResultsKpiDrawerDetail(KPI_ID, ORG_ID);

    expect(detail.organizationId).toBe(ORG_ID);
    expect(detail.kpiId).toBe(KPI_ID);
    expect(detail.measurements).toHaveLength(1);
    expect(detail.measurements[0]).toMatchObject({
      id: 'm-1',
      periodKey: '2026-03',
      createdBy: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
    });
    expect(detail.openCase?.id).toBe('case-1');
    expect(detail.openCase?.actions).toHaveLength(1);
    expect(detail.openCase?.actions[0].title).toBe('Follow up');
  });
});

describe('getROIByDateRange', () => {
  it('returns entries between inclusive ISO bounds', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        entry_id: ENTRY_ID,
        organization_id: ORG_ID,
        kpi_id: KPI_ID,
        initiative_id: INITIATIVE_ID,
        realized_value: 50,
        period: '2026-Q1',
        provenance_ref: null,
        verified_by: null,
        created_at: '2026-03-15T12:00:00.000Z',
      },
    ]);

    const rows = await getROIByDateRange(
      ORG_ID,
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].entryId).toBe(ENTRY_ID);
    expect(rows[0].realizedValue).toBe(50);
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[1]).toContain('2026-03-01');
    expect(params[2]).toContain('2026-03-31');
  });
});

describe('getReviewPackTimeline', () => {
  it('orders packs by created_at and summarizes embedded JSON', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        pack_id: PACK_ID,
        organization_id: ORG_ID,
        review_period: '2026-Q1',
        kpi_summaries:
          '[{"kpiId":"00000000-0000-4000-8000-aaaaaaaaaaaa","name":"A","status":"active","currentValue":1,"targetValue":2}]',
        deviation_highlights: '[]',
        roi_snapshot: '{"totalRealized":99,"entriesCount":2,"period":"2026-Q1"}',
        status: 'draft',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const timeline = await getReviewPackTimeline(ORG_ID);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].packId).toBe(PACK_ID);
    expect(timeline[0].kpiSummaryCount).toBe(1);
    expect(timeline[0].deviationHighlightCount).toBe(0);
    expect(timeline[0].roiSnapshotTotalRealized).toBe(99);
    expect(timeline[0].roiSnapshotEntriesCount).toBe(2);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY created_at ASC');
  });
});

describe('getReconciliationHealth', () => {
  it('summarizes status counts, unresolved, and average resolution hours', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        { reconciliation_status: 'pending', cnt: 2 },
        { reconciliation_status: 'reconciled', cnt: 1 },
      ])
      .mockResolvedValueOnce([
        {
          created_at: '2026-03-23T10:00:00.000Z',
          updated_at: '2026-03-23T14:00:00.000Z',
        },
      ]);
    mockDbGet.mockResolvedValueOnce({ total: 3 });

    const health = await getReconciliationHealth(ORG_ID);

    expect(health.total).toBe(3);
    expect(health.byStatus.pending).toBe(2);
    expect(health.byStatus.reconciled).toBe(1);
    expect(health.unresolvedCount).toBe(2);
    expect(health.averageResolutionHours).toBeCloseTo(4);
  });

  it('returns null average resolution when none reconciled', async () => {
    mockDbAll
      .mockResolvedValueOnce([{ reconciliation_status: 'pending', cnt: 1 }])
      .mockResolvedValueOnce([]);
    mockDbGet.mockResolvedValueOnce({ total: 1 });

    const health = await getReconciliationHealth(ORG_ID);
    expect(health.averageResolutionHours).toBeNull();
  });
});

describe('getResultsDashboard', () => {
  it('composes scorecard, deviations, ROI, reconciliation, and recent packs', async () => {
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS total FROM v8_kpi_definitions')) {
        return { total: 1 };
      }
      if (sql.includes('AS avg_rate')) {
        return { avg_rate: 0.5 };
      }
      if (sql.includes('total_entries')) {
        return { total_entries: 1, total_realized: 10 };
      }
      if (sql.includes('AS projected')) {
        return { projected: 20 };
      }
      if (sql.includes('COUNT(*) AS total FROM v8_kpi_finance_reconciliations')) {
        return { total: 1 };
      }
      return null;
    });

    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('v8_kpi_definitions') && sql.includes('GROUP BY status')) {
        return [{ status: 'active', cnt: 1 }];
      }
      if (sql.includes('GROUP BY metric_type')) {
        return [{ metric_type: 'count', cnt: 1 }];
      }
      if (sql.includes('v8_deviation_records') && sql.includes('resolved_at IS NULL')) {
        return [];
      }
      if (sql.includes('GROUP BY initiative_id')) {
        return [{ initiative_id: null, entry_count: 1, realized_sum: 10 }];
      }
      if (
        sql.includes('v8_kpi_finance_reconciliations') &&
        sql.includes('GROUP BY reconciliation_status')
      ) {
        return [{ reconciliation_status: 'pending', cnt: 1 }];
      }
      if (sql.includes("reconciliation_status = 'reconciled'")) {
        return [];
      }
      if (sql.includes('v8_executive_review_packs')) {
        return [
          {
            pack_id: PACK_ID,
            organization_id: ORG_ID,
            review_period: '2026-Q1',
            kpi_summaries: '[]',
            deviation_highlights: '[]',
            roi_snapshot: '{"totalRealized":0,"entriesCount":0,"period":"P"}',
            status: 'draft',
            created_at: '2026-03-20T00:00:00.000Z',
            updated_at: '2026-03-20T00:00:00.000Z',
          },
          {
            pack_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
            organization_id: ORG_ID,
            review_period: '2026-Q2',
            kpi_summaries: '[]',
            deviation_highlights: '[]',
            roi_snapshot: '{"totalRealized":1,"entriesCount":1,"period":"P"}',
            status: 'draft',
            created_at: '2026-03-21T00:00:00.000Z',
            updated_at: '2026-03-21T00:00:00.000Z',
          },
        ];
      }
      return [];
    });

    const dash = await getResultsDashboard(ORG_ID);

    expect(dash.organizationId).toBe(ORG_ID);
    expect(dash.kpiScorecard.totalKpis).toBe(1);
    expect(dash.activeDeviationsCount).toBe(0);
    expect(dash.roiDashboard.totalRealized).toBe(10);
    expect(dash.reconciliationHealth.total).toBe(1);
    expect(dash.recentReviewPacks).toHaveLength(2);
    expect(dash.recentReviewPacks[1].reviewPeriod).toBe('2026-Q2');
  });
});
