/**
 * Contract test for the M16 → M15 reconciliation read seam (service layer).
 *
 * `getReconciliationOverview` is the read path that DISPLAYS Finance's
 * `v8_kpi_finance_reconciliations` rows inside Results: it joins each row to the
 * KPI target (projected) and summed ROI realization entries (realized), then
 * computes the variance. These tests exercise the REAL variance/rollup logic
 * against a mocked DB layer, and prove org scoping.
 *
 * Mirrors resultsROIService.test.ts (mocked DbPromise, no real DB).
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

import { getReconciliationOverview } from '../resultsROIService.js';

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const ORG_B = 'bbb00000-0000-4000-8000-000000000002';
const KPI_1 = 'kpi-11111111';
const KPI_2 = 'kpi-22222222';

describe('getReconciliationOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
  });

  it('computes projected-vs-realized variance, mismatch flag, and status rollup', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        reconciliation_id: 'rec-1',
        kpi_id: KPI_1,
        finance_ref: 'finance:GL-100',
        reconciliation_status: 'disputed',
        initiated_by: 'finance',
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T01:00:00.000Z',
        kpi_name: 'Annual Savings',
        initiative_id: 'init-1',
        projected_value: 100000,
        realized_value: 80000,
      },
      {
        reconciliation_id: 'rec-2',
        kpi_id: KPI_2,
        finance_ref: 'finance:GL-200',
        reconciliation_status: 'reconciled',
        initiated_by: 'results',
        created_at: '2026-03-30T00:00:00.000Z',
        updated_at: '2026-03-30T00:30:00.000Z',
        kpi_name: 'Cycle Time',
        initiative_id: 'init-2',
        projected_value: 50000,
        realized_value: 50000,
      },
    ]);

    const overview = await getReconciliationOverview(ORG_A);

    expect(overview.organizationId).toBe(ORG_A);
    expect(overview.items).toHaveLength(2);

    const rec1 = overview.items.find((i) => i.reconciliationId === 'rec-1')!;
    expect(rec1.projectedValue).toBe(100000);
    expect(rec1.realizedValue).toBe(80000);
    expect(rec1.varianceAbsolute).toBe(-20000);
    expect(rec1.variancePercent).toBe(-20);
    expect(rec1.hasMismatch).toBe(true);
    expect(rec1.reconciliationStatus).toBe('disputed');
    expect(rec1.kpiName).toBe('Annual Savings');
    expect(rec1.initiativeId).toBe('init-1');

    const rec2 = overview.items.find((i) => i.reconciliationId === 'rec-2')!;
    expect(rec2.varianceAbsolute).toBe(0);
    expect(rec2.variancePercent).toBe(0);
    expect(rec2.hasMismatch).toBe(false);

    expect(overview.summary.total).toBe(2);
    expect(overview.summary.mismatchCount).toBe(1);
    expect(overview.summary.byStatus.disputed).toBe(1);
    expect(overview.summary.byStatus.reconciled).toBe(1);
    expect(overview.summary.unresolvedCount).toBe(1);

    // org-scoping: caller's org bound as first query parameter
    const [, params] = mockDbAll.mock.calls[0];
    expect((params as unknown[])[0]).toBe(ORG_A);
  });

  it('rounds fractional variance and percent to 2 decimals', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        reconciliation_id: 'rec-r',
        kpi_id: KPI_1,
        finance_ref: 'finance:GL-R',
        reconciliation_status: 'pending',
        initiated_by: 'finance',
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:00:00.000Z',
        kpi_name: 'Rev',
        initiative_id: 'init-r',
        projected_value: 3,
        realized_value: 4, // variance 1 / 3 = 33.333...%
      },
    ]);
    const overview = await getReconciliationOverview(ORG_A);
    expect(overview.items[0].varianceAbsolute).toBe(1);
    expect(overview.items[0].variancePercent).toBe(33.33);
    expect(overview.items[0].hasMismatch).toBe(true);
  });

  it('returns null variance when projected or realized is missing', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        reconciliation_id: 'rec-3',
        kpi_id: KPI_1,
        finance_ref: 'finance:GL-300',
        reconciliation_status: 'pending',
        initiated_by: 'finance',
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:00:00.000Z',
        kpi_name: null,
        initiative_id: null,
        projected_value: null,
        realized_value: 1000,
      },
    ]);

    const overview = await getReconciliationOverview(ORG_A);
    const rec = overview.items[0];
    expect(rec.varianceAbsolute).toBeNull();
    expect(rec.variancePercent).toBeNull();
    expect(rec.hasMismatch).toBe(false);
    expect(overview.summary.mismatchCount).toBe(0);
    expect(overview.summary.unresolvedCount).toBe(1);
  });

  it('leaves variancePercent null when projected is 0 but still reports the absolute', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        reconciliation_id: 'rec-z',
        kpi_id: KPI_1,
        finance_ref: 'finance:GL-Z',
        reconciliation_status: 'escalated',
        initiated_by: 'finance',
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:00:00.000Z',
        kpi_name: 'Zero Target',
        initiative_id: 'init-z',
        projected_value: 0,
        realized_value: 500,
      },
    ]);
    const overview = await getReconciliationOverview(ORG_A);
    expect(overview.items[0].varianceAbsolute).toBe(500);
    expect(overview.items[0].variancePercent).toBeNull();
    expect(overview.items[0].hasMismatch).toBe(true);
    expect(overview.summary.unresolvedCount).toBe(1); // escalated
  });

  it('is org-scoped: cross-org caller sees an empty overview', async () => {
    mockDbAll.mockResolvedValueOnce([]); // foreign-org row excluded by predicate
    const overview = await getReconciliationOverview(ORG_B);
    expect(overview.organizationId).toBe(ORG_B);
    expect(overview.items).toHaveLength(0);
    expect(overview.summary.total).toBe(0);
    expect(overview.summary.mismatchCount).toBe(0);
    const [, params] = mockDbAll.mock.calls[0];
    expect((params as unknown[])[0]).toBe(ORG_B);
  });

  it('H2.5: suppresses monetary variance for a percentage KPI (OEE) but keeps projected', async () => {
    // Regression: OEE target 85(%) vs summed €138,000 realized produced a
    // nonsensical +162252% variance. A non-monetary unit must not fabricate one.
    mockDbAll.mockResolvedValueOnce([
      {
        reconciliation_id: 'rec-oee',
        kpi_id: KPI_1,
        finance_ref: 'finance:GL-OEE',
        reconciliation_status: 'pending',
        initiated_by: 'finance',
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:00:00.000Z',
        kpi_name: 'OEE',
        initiative_id: 'init-oee',
        unit: '%',
        projected_value: 85,
        realized_value: 138000,
      },
    ]);

    const overview = await getReconciliationOverview(ORG_A);
    const rec = overview.items[0];
    expect(rec.unit).toBe('%');
    expect(rec.projectedValue).toBe(85); // projected still surfaced
    expect(rec.realizedValue).toBeNull(); // €-sum not comparable to a % target
    expect(rec.varianceAbsolute).toBeNull();
    expect(rec.variancePercent).toBeNull();
    expect(rec.hasMismatch).toBe(false);
    expect(overview.summary.mismatchCount).toBe(0);
  });

  it('H2.5: still computes variance for a monetary unit (€)', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        reconciliation_id: 'rec-eur',
        kpi_id: KPI_2,
        finance_ref: 'finance:GL-EUR',
        reconciliation_status: 'disputed',
        initiated_by: 'finance',
        created_at: '2026-03-31T00:00:00.000Z',
        updated_at: '2026-03-31T00:00:00.000Z',
        kpi_name: 'Annual Savings',
        initiative_id: 'init-eur',
        unit: '€',
        projected_value: 100000,
        realized_value: 80000,
      },
    ]);

    const overview = await getReconciliationOverview(ORG_A);
    const rec = overview.items[0];
    expect(rec.unit).toBe('€');
    expect(rec.realizedValue).toBe(80000);
    expect(rec.varianceAbsolute).toBe(-20000);
    expect(rec.variancePercent).toBe(-20);
    expect(rec.hasMismatch).toBe(true);
    expect(overview.summary.mismatchCount).toBe(1);
  });

  it('forwards initiativeId and kpiId filters as bound parameters', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getReconciliationOverview(ORG_A, { initiativeId: 'init-9', kpiId: KPI_1 });
    const [sql, params] = mockDbAll.mock.calls[0];
    expect(String(sql)).toContain('k.initiative_id = ?');
    expect(String(sql)).toContain('r.kpi_id = ?');
    expect(params).toEqual([ORG_A, 'init-9', KPI_1]);
  });
});
