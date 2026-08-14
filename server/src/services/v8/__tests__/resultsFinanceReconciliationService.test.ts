/**
 * Round-trip tests for the M15 ↔ M16 reconciliation ENGINE
 * (resultsFinanceReconciliationService). Proves:
 *   - pure unit-normalisation + deviation math (offline, no DB),
 *   - CONCLUSION_LAYER shape (headline / K1..K4) per severity,
 *   - the DB-backed pull maps KPI actuals → finance driver with the unit
 *     multiplier, computes realized-vs-projected deviation, and UPSERTS a row
 *     with the deviation + conclusion.
 *
 * Mocks DbPromise (no real DB), mirroring reconciliationOverview.test.ts.
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

import {
  buildDeviationConclusion,
  computeDeviation,
  normalizeToFinanceBasis,
  pullAndReconcileInitiative,
} from '../resultsFinanceReconciliationService.js';

const ORG = 'aaa00000-0000-4000-8000-000000000001';
const INIT = 'init-11111111';
const KPI_MONEY = 'kpi-money-0001';
const KPI_HOURS = 'kpi-hours-0001';

describe('resultsFinanceReconciliationService — pure engine', () => {
  it('normalizeToFinanceBasis applies the unit multiplier (unit consistency)', () => {
    // 1200 hours saved × €50/hour = €60,000 on the finance basis.
    expect(normalizeToFinanceBasis(1200, 50)).toBe(60000);
    // Default multiplier is identity.
    expect(normalizeToFinanceBasis(60000, undefined)).toBe(60000);
    // Non-finite in → null out.
    expect(normalizeToFinanceBasis(null, 50)).toBeNull();
    expect(normalizeToFinanceBasis(Number.NaN, 50)).toBeNull();
  });

  it('computeDeviation bands realized-vs-projected on the same basis', () => {
    // Within 5% → on_track.
    expect(computeDeviation(102, 100)).toMatchObject({
      deviationAbsolute: 2,
      deviationPercent: 2,
      severity: 'on_track',
    });
    // 5–15% → watch.
    expect(computeDeviation(110, 100).severity).toBe('watch');
    // > 15% → off_track (unfavorable).
    expect(computeDeviation(70, 100)).toMatchObject({
      deviationAbsolute: -30,
      deviationPercent: -30,
      severity: 'off_track',
    });
    // Missing side → null deviation, on_track.
    expect(computeDeviation(null, 100)).toMatchObject({
      deviationAbsolute: null,
      severity: 'on_track',
    });
  });

  it('buildDeviationConclusion emits a full K1..K4 chain per severity', () => {
    const offTrack = buildDeviationConclusion({
      kpiName: 'Roczne oszczędności',
      driverKey: 'opex_savings',
      realized: 70000,
      projected: 100000,
      deviation: computeDeviation(70000, 100000),
    });
    expect(offTrack.severity).toBe('off_track');
    expect(offTrack.headline).toContain('Roczne oszczędności');
    expect(offTrack.k1Fact).toContain('70000');
    expect(offTrack.k1Fact).toContain('100000');
    expect(offTrack.k2Meaning.length).toBeGreaterThan(0);
    expect(offTrack.k3Actions.length).toBeGreaterThanOrEqual(1);
    expect(offTrack.k3Actions[0]).toHaveProperty('ownerRole');
    expect(offTrack.k4Effect.length).toBeGreaterThan(0);
    expect(offTrack.aiGenerated).toBe(false);

    const onTrack = buildDeviationConclusion({
      kpiName: 'OEE',
      driverKey: 'throughput',
      realized: 101,
      projected: 100,
      deviation: computeDeviation(101, 100),
    });
    expect(onTrack.severity).toBe('on_track');
    expect(onTrack.k3Actions.length).toBeGreaterThanOrEqual(1);

    const favorable = buildDeviationConclusion({
      kpiName: 'Przychód',
      driverKey: 'revenue',
      realized: 130000,
      projected: 100000,
      deviation: computeDeviation(130000, 100000),
    });
    expect(favorable.severity).toBe('off_track');
    // Favorable → recommends revising the model UP.
    expect(favorable.k3Actions.some((a) => /w górę|zaktualizuj/i.test(a.action))).toBe(true);
  });
});

describe('resultsFinanceReconciliationService — DB round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
  });

  it('short-circuits when no mappings are supplied', async () => {
    const res = await pullAndReconcileInitiative(ORG, INIT, []);
    expect(res.reconciledCount).toBe(0);
    expect(mockDbAll).not.toHaveBeenCalled();
  });

  it('pulls actuals, applies the unit multiplier, computes deviation, and upserts', async () => {
    // KPI catalog for the initiative: one money KPI, one hours KPI.
    mockDbAll
      .mockResolvedValueOnce([
        {
          kpi_id: KPI_MONEY,
          name: 'Roczne oszczędności',
          metric_type: 'currency',
          target_value: 100000,
          current_value: null,
        },
        {
          kpi_id: KPI_HOURS,
          name: 'Godziny zaoszczędzone',
          metric_type: 'duration',
          target_value: 2000, // hours target
          current_value: 1200, // hours realized (no ROI entries → falls back here)
        },
      ])
      // H5.3 batches realized sums for every mapped KPI in one query.
      .mockResolvedValueOnce([{ kpi_id: KPI_MONEY, realized_sum: 80000 }]);

    // Existing-reconciliation probes remain one dbGet per KPI.
    mockDbGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const res = await pullAndReconcileInitiative(ORG, INIT, [
      // money KPI: identity multiplier; projected €100k vs realized €80k → -20% off_track.
      { kpiId: KPI_MONEY, driverKey: 'opex_savings', unitMultiplier: 1 },
      // hours KPI: €50/hour. realized 1200h×50=€60k, projected from explicit finance model €60k → on_track.
      {
        kpiId: KPI_HOURS,
        driverKey: 'labor_cost',
        unitMultiplier: 50,
        projectedValue: 60000,
      },
    ]);

    expect(res.reconciledCount).toBe(2);

    const money = res.items.find((i) => i.kpiId === KPI_MONEY)!;
    expect(money.realizedValue).toBe(80000);
    expect(money.projectedValue).toBe(100000);
    expect(money.deviationAbsolute).toBe(-20000);
    expect(money.deviationPercent).toBe(-20);
    expect(money.conclusion?.severity).toBe('off_track');

    const hours = res.items.find((i) => i.kpiId === KPI_HOURS)!;
    // Unit conversion applied: 1200 hours × €50 = €60,000 finance basis.
    expect(hours.kpiActual).toBe(1200);
    expect(hours.realizedValue).toBe(60000);
    expect(hours.projectedValue).toBe(60000);
    expect(hours.deviationAbsolute).toBe(0);
    expect(hours.conclusion?.severity).toBe('on_track');
    expect(res.offTrackCount).toBe(1);

    // Two INSERTs persisted (both were new rows), each carrying deviation + conclusion.
    const inserts = mockDbRun.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO v8_kpi_finance_reconciliations')
    );
    expect(inserts.length).toBe(2);
    const insertParams = inserts[0][1] as unknown[];
    // conclusion_json param present and parseable.
    const conclusionParam = insertParams.find(
      (p) => typeof p === 'string' && p.startsWith('{') && p.includes('headline')
    );
    expect(conclusionParam).toBeTruthy();
    expect(() => JSON.parse(String(conclusionParam))).not.toThrow();
  });

  it('UPDATEs an existing reconciliation row instead of inserting a duplicate', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          kpi_id: KPI_MONEY,
          name: 'Roczne oszczędności',
          metric_type: 'currency',
          target_value: 100000,
          current_value: null,
        },
      ])
      .mockResolvedValueOnce([{ kpi_id: KPI_MONEY, realized_sum: 95000 }]);
    mockDbGet.mockResolvedValueOnce({ reconciliation_id: 'rec-existing' });

    const res = await pullAndReconcileInitiative(ORG, INIT, [
      { kpiId: KPI_MONEY, driverKey: 'opex_savings', unitMultiplier: 1 },
    ]);

    expect(res.reconciledCount).toBe(1);
    const updates = mockDbRun.mock.calls.filter((c) =>
      String(c[0]).includes('UPDATE v8_kpi_finance_reconciliations')
    );
    const inserts = mockDbRun.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO v8_kpi_finance_reconciliations')
    );
    expect(updates.length).toBe(1);
    expect(inserts.length).toBe(0);
  });
});
