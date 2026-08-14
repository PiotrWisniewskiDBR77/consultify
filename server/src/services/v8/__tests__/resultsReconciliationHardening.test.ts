/**
 * M15 Rezultaty — value-reconciliation HARDENING regression coverage.
 *
 * Protects the data-integrity rules that the happy-path suites
 * (`resultsRuntime.test.ts`, `resultsROIService.test.ts`) do not pin down:
 *
 *  1. Finalization / lifecycle lock — a KPI in the terminal
 *     `benefits_realization` ("finalized / locked") state cannot be mutated to
 *     ANY successor status, and every mutation path stays org-scoped.
 *  2. KPI time-series determinism — out-of-order and duplicate timestamps are
 *     handled deterministically; baseline→target deltas are computed correctly,
 *     including the one-sided-null guard and the `periods` window boundary.
 *  3. ROI realization vs. planned reconciliation — variance and % realized
 *     (coverage) are computed correctly on a known dataset, including the
 *     orphan-realized-row rule and rounding.
 *
 * Org-scope (SEC-3) is already covered for the standard verbs in
 * `resultsROIService.test.ts`; here we only assert that the *finalization* and
 * *reconciliation* read/write paths added above are themselves org-scoped, so
 * the integrity rules can never be evaluated across orgs.
 *
 * Style mirrors `resultsRuntime.test.ts` (DB layer mocked via `DbPromise.js`).
 */
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
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

import { KPIStatusValues } from '../../../types/resultsROIContinuity.js';
import { getKPITrend, getROIPortfolioSummary, updateKPIStatus } from '../resultsROIService.js';

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ORG_ID = 'ffffffff-0000-4111-8222-333333333333';
const KPI_ID = '11111111-2222-4333-8444-555555555555';
const INITIATIVE_A = '55555555-6666-4777-8888-999999999999';
const INITIATIVE_B = '66666666-7777-4888-8999-aaaaaaaaaaaa';

function makeFakeKPIRow(overrides: Record<string, unknown> = {}) {
  return {
    kpi_id: KPI_ID,
    organization_id: ORG_ID,
    name: 'Test KPI',
    mode: 'standalone',
    initiative_id: null,
    metric_type: 'currency',
    baseline_value: 100,
    target_value: 150,
    current_value: 120,
    measurement_cadence: 'monthly',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// 1. FINALIZATION / LIFECYCLE LOCK
// ===========================================================================

describe('finalization lock — a finalized (benefits_realization) KPI is immutable', () => {
  // `benefits_realization` is the terminal/finalized lifecycle state; its
  // transition allow-list is empty, so EVERY successor must be rejected and no
  // UPDATE may be issued.
  const successors = KPIStatusValues.filter((s) => s !== 'benefits_realization');

  it.each(successors)(
    'rejects mutation benefits_realization → %s and writes nothing',
    async (target) => {
      mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'benefits_realization' }));

      await expect(updateKPIStatus(KPI_ID, ORG_ID, target)).rejects.toThrow(
        /Invalid status transition|terminal state/
      );

      // The guard rejects BEFORE any persistence — a finalized entity is never
      // mutated.
      expect(mockDbRun).not.toHaveBeenCalled();
    }
  );

  it('even a self-transition benefits_realization → benefits_realization is rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'benefits_realization' }));
    await expect(updateKPIStatus(KPI_ID, ORG_ID, 'benefits_realization')).rejects.toThrow(
      /Invalid status transition|terminal state/
    );
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('scopes the lock lookup to the caller org (cannot finalize across orgs)', async () => {
    // KPI exists in ORG_ID; the lookup must carry the org so org B can never
    // read or mutate org A's finalized entity.
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'review' }));
    await updateKPIStatus(KPI_ID, ORG_ID, 'benefits_realization');

    const lookupCall = mockDbGet.mock.calls[0];
    expect(String(lookupCall[0])).toContain('organization_id');
    expect(lookupCall[1]).toContain(ORG_ID);

    // The persisting UPDATE is also org-scoped.
    const updateSql = String(mockDbRun.mock.calls[0][0]);
    expect(updateSql).toContain('WHERE kpi_id = ? AND organization_id = ?');
    expect(mockDbRun.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('treats a missing KPI in the caller org as not-found (no cross-org leak)', async () => {
    // KPI belongs to OTHER_ORG_ID → org-scoped lookup returns nothing.
    mockDbGet.mockResolvedValueOnce(null);
    await expect(updateKPIStatus(KPI_ID, OTHER_ORG_ID, 'baseline')).rejects.toThrow('not found');
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 2. KPI TIME-SERIES DETERMINISM
// ===========================================================================

describe('KPI time-series — deterministic ordering, dedup, and baseline→target deltas', () => {
  it('orders by created_at ascending at the query level (deterministic series)', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getKPITrend(KPI_ID, ORG_ID);
    const sql = String(mockDbAll.mock.calls[0][0]);
    expect(sql).toContain('ORDER BY d.created_at ASC');
    // org-scoped read so the series can never mix orgs.
    expect(sql).toContain('d.organization_id = ?');
    expect(mockDbAll.mock.calls[0][1]).toEqual([KPI_ID, ORG_ID]);
  });

  it('preserves DB order verbatim and computes actual−target deltas per point', async () => {
    // Rows arrive already ordered (ORDER BY created_at ASC). The mapping must
    // be a stable 1:1 projection — no reordering in TS.
    mockDbAll.mockResolvedValueOnce([
      {
        created_at: '2026-01-01T00:00:00.000Z',
        observed_actual: 90,
        observed_target: 100,
        current_value: null,
        target_value: null,
      },
      {
        created_at: '2026-02-01T00:00:00.000Z',
        observed_actual: 130,
        observed_target: 100,
        current_value: null,
        target_value: null,
      },
    ]);

    const trend = await getKPITrend(KPI_ID, ORG_ID);

    expect(trend.map((p) => p.period)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ]);
    expect(trend[0].deviation).toBe(-10); // 90 - 100 (under target)
    expect(trend[1].deviation).toBe(30); // 130 - 100 (over target)
  });

  it('handles duplicate timestamps deterministically (both points retained, same delta)', async () => {
    // Two observations sharing one timestamp must both survive with stable,
    // independent deltas — no silent dedup/collapse that would lose data.
    mockDbAll.mockResolvedValueOnce([
      {
        created_at: '2026-03-01T00:00:00.000Z',
        observed_actual: 100,
        observed_target: 120,
        current_value: null,
        target_value: null,
      },
      {
        created_at: '2026-03-01T00:00:00.000Z',
        observed_actual: 110,
        observed_target: 120,
        current_value: null,
        target_value: null,
      },
    ]);

    const trend = await getKPITrend(KPI_ID, ORG_ID);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatchObject({ period: '2026-03-01T00:00:00.000Z', deviation: -20 });
    expect(trend[1]).toMatchObject({ period: '2026-03-01T00:00:00.000Z', deviation: -10 });
  });

  it('falls back to KPI baseline/target columns when an observation is missing', async () => {
    // observed_* null → fall back to current_value / target_value; delta still
    // computed from the resolved pair.
    mockDbAll.mockResolvedValueOnce([
      {
        created_at: '2026-04-01T00:00:00.000Z',
        observed_actual: null,
        observed_target: null,
        current_value: 140,
        target_value: 150,
      },
    ]);

    const trend = await getKPITrend(KPI_ID, ORG_ID);
    expect(trend[0].actualValue).toBe(140);
    expect(trend[0].targetValue).toBe(150);
    expect(trend[0].deviation).toBe(-10);
  });

  it('emits a null delta (not 0 or NaN) when only one side is known', async () => {
    // Integrity guard: a half-known point must NOT masquerade as an
    // on-target (0) or corrupted (NaN) deviation.
    mockDbAll.mockResolvedValueOnce([
      {
        created_at: '2026-05-01T00:00:00.000Z',
        observed_actual: 90,
        observed_target: null,
        current_value: null,
        target_value: null,
      },
    ]);

    const trend = await getKPITrend(KPI_ID, ORG_ID);
    expect(trend[0].actualValue).toBe(90);
    expect(trend[0].targetValue).toBeNull();
    expect(trend[0].deviation).toBeNull();
  });

  it('returns the FULL series when periods <= 0 (window boundary)', async () => {
    // `periods` must be a positive window; 0 (and negatives) are no-ops, not
    // an empty/last-N slice.
    const rows = [1, 2, 3].map((n) => ({
      created_at: `2026-0${n}-01T00:00:00.000Z`,
      observed_actual: n,
      observed_target: n,
      current_value: null,
      target_value: null,
    }));
    mockDbAll.mockResolvedValueOnce(rows);

    const trend = await getKPITrend(KPI_ID, ORG_ID, 0);
    expect(trend).toHaveLength(3);
  });

  it('keeps the LAST N points (most recent window), preserving order', async () => {
    const rows = [1, 2, 3, 4].map((n) => ({
      created_at: `2026-0${n}-01T00:00:00.000Z`,
      observed_actual: n,
      observed_target: 0,
      current_value: null,
      target_value: null,
    }));
    mockDbAll.mockResolvedValueOnce(rows);

    const trend = await getKPITrend(KPI_ID, ORG_ID, 2);
    expect(trend.map((p) => p.period)).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    ]);
  });
});

// ===========================================================================
// 3. ROI REALIZATION vs. PLANNED — RECONCILIATION MATH
// ===========================================================================

describe('ROI reconciliation — variance and % realized on a known multi-initiative dataset', () => {
  it('computes per-initiative variance and portfolio coverage/variance correctly', async () => {
    // Two initiatives with assumptions; only initiative A has realized values.
    // Known dataset:
    //   A: projected = 300 + (-50) = 250 ; realized = 120 + (-40) + 10 = 90  → variance -160
    //   B: projected = 200 + 0     = 200 ; realized = 0 (none)               → variance -200
    // Portfolio: projected 450, realized 90, variance -360, coverage 1/2 = 50%
    mockDbAll
      .mockResolvedValueOnce([
        {
          initiative_id: INITIATIVE_A,
          initiative_name: 'Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: 100,
          opex_annual: 25,
          expected_revenue_delta: 300,
          expected_cost_delta: -50,
          confidence: 'high',
        },
        {
          initiative_id: INITIATIVE_B,
          initiative_name: 'Beta',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          capex: 50,
          opex_annual: 10,
          expected_revenue_delta: 200,
          expected_cost_delta: 0,
          confidence: 'low',
        },
      ])
      .mockResolvedValueOnce([
        { initiative_id: INITIATIVE_A, total_rev: 120, total_cost: -40, total_savings: 10 },
      ]);

    const summary = await getROIPortfolioSummary(ORG_ID);

    const alpha = summary.items.find((i) => i.initiativeId === INITIATIVE_A)!;
    const beta = summary.items.find((i) => i.initiativeId === INITIATIVE_B)!;

    expect(alpha.projectedBenefit).toBe(250);
    expect(alpha.realizedBenefit).toBe(90);
    expect(alpha.variance).toBe(-160);
    expect(alpha.hasRealized).toBe(true);

    expect(beta.projectedBenefit).toBe(200);
    expect(beta.realizedBenefit).toBe(0);
    expect(beta.variance).toBe(-200);
    expect(beta.hasRealized).toBe(false);

    expect(summary.summary).toEqual({
      totalProjected: 450,
      totalRealized: 90,
      totalCapex: 150,
      totalOpexAnnual: 35,
      netTotalProjected: 415,
      netTotalRealized: 55,
      roiPercentGross: 60,
      roiPercentNet: 36.666666666666664,
      totalVariance: -360,
      initiativeCount: 2,
      coveragePercent: 50, // 1 of 2 initiatives has realized data
    });
  });

  it('rounds coverage percent (2 of 3 realized → 67%)', async () => {
    mockDbAll
      .mockResolvedValueOnce(
        ['x', 'y', 'z'].map((suffix, idx) => ({
          initiative_id: `${INITIATIVE_A}-${suffix}`,
          initiative_name: `Init ${suffix}`,
          status: 'DONE',
          priority: 'LOW',
          capex: 0,
          opex_annual: 0,
          expected_revenue_delta: 100,
          expected_cost_delta: 0,
          confidence: 'medium',
          _idx: idx,
        }))
      )
      .mockResolvedValueOnce([
        { initiative_id: `${INITIATIVE_A}-x`, total_rev: 50, total_cost: 0, total_savings: 0 },
        { initiative_id: `${INITIATIVE_A}-y`, total_rev: 60, total_cost: 0, total_savings: 0 },
      ]);

    const summary = await getROIPortfolioSummary(ORG_ID);
    expect(summary.summary.initiativeCount).toBe(3);
    expect(summary.summary.coveragePercent).toBe(67); // round(2/3 * 100) = 67
  });

  it('over-realization yields a positive variance (% realized > 100)', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          initiative_id: INITIATIVE_A,
          initiative_name: 'Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: 0,
          opex_annual: 0,
          expected_revenue_delta: 100,
          expected_cost_delta: 0,
          confidence: 'high',
        },
      ])
      .mockResolvedValueOnce([
        { initiative_id: INITIATIVE_A, total_rev: 150, total_cost: 0, total_savings: 0 },
      ]);

    const summary = await getROIPortfolioSummary(ORG_ID);
    expect(summary.items[0].variance).toBe(50); // 150 realized vs 100 projected
    expect(summary.summary.totalVariance).toBe(50);
  });

  it('RULE: a realized row with no matching assumption is excluded from totals (no baseline = no variance)', async () => {
    // INTEGRITY RULE pin: variance is anchored to planned assumptions. A
    // realized row for an initiative WITHOUT a roi_assumptions baseline cannot
    // be reconciled (there is nothing to vary against) and is therefore not
    // counted in totalRealized. This documents intentional behaviour so a
    // future regression that silently double-counts orphan realized rows fails.
    mockDbAll
      .mockResolvedValueOnce([
        {
          initiative_id: INITIATIVE_A,
          initiative_name: 'Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: 0,
          opex_annual: 0,
          expected_revenue_delta: 100,
          expected_cost_delta: 0,
          confidence: 'high',
        },
      ])
      .mockResolvedValueOnce([
        // matches an assumption → counted
        { initiative_id: INITIATIVE_A, total_rev: 80, total_cost: 0, total_savings: 0 },
        // orphan: no assumption row for INITIATIVE_B → excluded
        { initiative_id: INITIATIVE_B, total_rev: 999, total_cost: 0, total_savings: 0 },
      ]);

    const summary = await getROIPortfolioSummary(ORG_ID);
    expect(summary.items).toHaveLength(1);
    expect(summary.summary.totalRealized).toBe(80); // orphan 999 NOT included
    expect(summary.summary.coveragePercent).toBe(100); // 1 assumption, 1 realized
  });

  it('null numeric columns coalesce to 0 (no NaN leaking into variance)', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          initiative_id: INITIATIVE_A,
          initiative_name: 'Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: null,
          opex_annual: null,
          expected_revenue_delta: null,
          expected_cost_delta: null,
          confidence: 'high',
        },
      ])
      .mockResolvedValueOnce([
        { initiative_id: INITIATIVE_A, total_rev: null, total_cost: null, total_savings: null },
      ]);

    const summary = await getROIPortfolioSummary(ORG_ID);
    expect(summary.items[0].projectedBenefit).toBe(0);
    expect(summary.items[0].realizedBenefit).toBe(0);
    expect(summary.items[0].variance).toBe(0);
    expect(Number.isNaN(summary.summary.totalVariance)).toBe(false);
  });

  it('empty portfolio yields zeroed totals and 0% coverage (no divide-by-zero)', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const summary = await getROIPortfolioSummary(ORG_ID);
    expect(summary.items).toHaveLength(0);
    expect(summary.summary).toEqual({
      totalProjected: 0,
      totalRealized: 0,
      totalCapex: 0,
      totalOpexAnnual: 0,
      netTotalProjected: 0,
      netTotalRealized: 0,
      roiPercentGross: null,
      roiPercentNet: null,
      totalVariance: 0,
      initiativeCount: 0,
      coveragePercent: 0,
    });
  });

  it('scopes BOTH the assumptions and realized reads to the caller org', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await getROIPortfolioSummary(ORG_ID);

    const assumptionsSql = String(mockDbAll.mock.calls[0][0]);
    const realizedSql = String(mockDbAll.mock.calls[1][0]);
    expect(assumptionsSql).toContain('ra.organization_id = ?');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
    expect(realizedSql).toContain('organization_id = ?');
    expect(mockDbAll.mock.calls[1][1]).toContain(ORG_ID);
  });
});
