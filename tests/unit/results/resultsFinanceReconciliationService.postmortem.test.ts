/**
 * O4.7 wiring — `financePostMortemService.decomposeVariance` consumed by
 * `resultsFinanceReconciliationService.pullAndReconcileInitiative`.
 *
 * The engine (financePostMortemService) already has its own pure-function
 * tests (tests/unit/finance/financePostMortemService.test.ts). This file
 * proves the WIRING contract at the M15↔M16 reconciliation boundary only:
 *   1. both sides present, no market-shift feed → postMortem computed with
 *      verdict 'undetermined' for a real (non-on-plan) gap — never a guessed
 *      execution-failure attribution (honest, §"no guessing").
 *   2. within the ±5% on-plan band → verdict 'on-plan', not 'undetermined'.
 *   3. a missing realized/projected side → postMortem stays `null` (no
 *      fabricated 0 baseline), while the pre-existing K1..K4 conclusion still
 *      degrades to its own "no data" branch unaffected by this wiring.
 *   4. the persisted `conclusion_json` embeds `postMortem` as a sibling key
 *      (additive — no schema migration, no change to the existing
 *      `conclusion` shape) so it reaches the same read seam
 *      (`resultsROIService.getReconciliationOverview` → `conclusion`) that
 *      already renders the K1..K4 narrative today.
 *
 * Mocks DbPromise (no real DB), mirroring
 * server/src/services/v8/__tests__/resultsFinanceReconciliationService.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

import { pullAndReconcileInitiative } from '../../../server/src/services/v8/resultsFinanceReconciliationService.js';

const ORG = 'aaa00000-0000-4000-8000-000000000001';
const INIT = 'init-11111111';
const KPI = 'kpi-postmortem-0001';

describe('resultsFinanceReconciliationService — O4.7 post-mortem wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
  });

  it('real off-plan gap, no market-shift feed → postMortem.verdict = undetermined (not a guessed execution failure)', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          kpi_id: KPI,
          name: 'Przychód z inicjatywy',
          metric_type: 'currency',
          target_value: 100000,
          current_value: null,
        },
      ])
      .mockResolvedValueOnce([{ kpi_id: KPI, realized_sum: 70000 }]);
    mockDbGet.mockResolvedValueOnce(null); // no existing row

    const res = await pullAndReconcileInitiative(ORG, INIT, [
      { kpiId: KPI, driverKey: 'revenue_uplift', unitMultiplier: 1 },
    ]);

    const item = res.items[0];
    expect(item.projectedValue).toBe(100000);
    expect(item.realizedValue).toBe(70000);
    expect(item.postMortem).not.toBeNull();
    expect(item.postMortem!.totalVariance).toBe(-30000);
    // No market shifts supplied anywhere in this reconciliation path yet →
    // decomposeVariance refuses to attribute the miss to execution alone.
    expect(item.postMortem!.verdict).toBe('undetermined');
    expect(item.postMortem!.confidence).toBe('undetermined');
    expect(item.postMortem!.explanation.pl).toContain('nie można rozdzielić rynku od egzekucji');

    // The pre-existing K1..K4 conclusion is untouched by this wiring (still off_track).
    expect(item.conclusion?.severity).toBe('off_track');
  });

  it('within ±5% of plan → postMortem.verdict = on-plan (not undetermined)', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          kpi_id: KPI,
          name: 'Przychód z inicjatywy',
          metric_type: 'currency',
          target_value: 100000,
          current_value: null,
        },
      ])
      .mockResolvedValueOnce([{ kpi_id: KPI, realized_sum: 102000 }]);
    mockDbGet.mockResolvedValueOnce(null);

    const res = await pullAndReconcileInitiative(ORG, INIT, [
      { kpiId: KPI, driverKey: 'revenue_uplift', unitMultiplier: 1 },
    ]);

    expect(res.items[0].postMortem?.verdict).toBe('on-plan');
  });

  it('missing realized value → postMortem stays null (no fabricated 0 baseline)', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          kpi_id: KPI,
          name: 'KPI bez aktuali',
          metric_type: 'currency',
          target_value: 100000,
          current_value: null,
        },
      ])
      .mockResolvedValueOnce([]);
    // No realized ROI entries AND no current_value → kpiActual stays null → realizedValue null.
    mockDbGet.mockResolvedValueOnce(null);

    const res = await pullAndReconcileInitiative(ORG, INIT, [
      { kpiId: KPI, driverKey: 'revenue_uplift', unitMultiplier: 1 },
    ]);

    expect(res.items[0].realizedValue).toBeNull();
    expect(res.items[0].postMortem).toBeNull();
    // The K1..K4 conclusion still has its own honest "no data" branch, independent of postMortem.
    expect(res.items[0].conclusion?.k1Fact).toContain('Brak zrealizowanej lub prognozowanej');
  });

  it('persists postMortem as a sibling key inside conclusion_json (additive, no migration)', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          kpi_id: KPI,
          name: 'Przychód z inicjatywy',
          metric_type: 'currency',
          target_value: 100000,
          current_value: null,
        },
      ])
      .mockResolvedValueOnce([{ kpi_id: KPI, realized_sum: 70000 }]);
    mockDbGet.mockResolvedValueOnce(null);

    await pullAndReconcileInitiative(ORG, INIT, [
      { kpiId: KPI, driverKey: 'revenue_uplift', unitMultiplier: 1 },
    ]);

    const inserts = mockDbRun.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO v8_kpi_finance_reconciliations')
    );
    expect(inserts.length).toBe(1);
    const insertParams = inserts[0][1] as unknown[];
    const conclusionParam = insertParams.find(
      (p) => typeof p === 'string' && p.startsWith('{') && p.includes('headline')
    );
    expect(conclusionParam).toBeTruthy();
    const parsed = JSON.parse(String(conclusionParam));
    // Original K1..K4 shape preserved…
    expect(parsed.headline).toBeDefined();
    expect(parsed.k1Fact).toBeDefined();
    // …postMortem sits alongside it, not in place of it.
    expect(parsed.postMortem).toBeDefined();
    expect(parsed.postMortem.verdict).toBe('undetermined');
    expect(parsed.postMortem.totalVariance).toBe(-30000);
  });
});
