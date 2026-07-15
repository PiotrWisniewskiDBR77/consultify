/**
 * Wiring test for the Value Tracking cluster (M16 Finance) — 7 previously
 * orphaned services (0 importers before this change):
 *   valueLedgerService, valueAttributionRollupService,
 *   valueCapturePipelineService, realizedValueReconciliationService,
 *   kpiLineageService, bankingValueService, extendedRatiosService.
 *
 * Services are NOT mocked — only the DB layer (DbPromise) is — so real
 * computation flows through each route and the response shape is verified
 * end-to-end, mirroring tests/integration/routes/v8.results.orphan-engines-wiring.test.ts.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockAll(...args),
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

import financeValueRouter from '../../../server/src/routes/v8/finance-value.routes.js';

const ORG = 'org-1';
const UID = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = { organizationId: ORG, userId: UID, userRole: 'owner', isSuperAdmin: false };
    req.user = { id: UID, organizationId: ORG, role: 'owner' };
    next();
  });
  app.use('/api/v8/finance/value-tracking', financeValueRouter);
  return app;
}

const BASE = '/api/v8/finance/value-tracking';

describe('V8 Finance — Value Tracking cluster wiring (M16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({ success: true, changes: 1 });
    mockGet.mockResolvedValue(null);
    mockAll.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // 1. valueLedgerService
  // -------------------------------------------------------------------------
  describe('ledger (valueLedgerService)', () => {
    it('POST /ledger/baselines freezes a new active baseline', async () => {
      const res = await request(createApp())
        .post(`${BASE}/ledger/baselines`)
        .send({ initiativeId: 'init-1', kpiId: 'kpi-1', value: 1000 });
      expect(res.status).toBe(201);
      expect(res.body.data.frozen_value).toBe(1000);
      expect(res.body.data.organization_id).toBe(ORG);
      // Deactivate-prior + insert both org-scoped.
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE value_baselines'),
        expect.arrayContaining([ORG, 'init-1', 'kpi-1']),
        expect.anything()
      );
    });

    it('POST /ledger/baselines 400s when initiativeId/kpiId missing', async () => {
      const res = await request(createApp()).post(`${BASE}/ledger/baselines`).send({ value: 5 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALUE_LEDGER_BAD_INPUT');
    });

    it('GET /ledger/baselines/active reads the active baseline org-scoped', async () => {
      mockGet.mockResolvedValueOnce({
        id: 'b1',
        organization_id: ORG,
        initiative_id: 'init-1',
        kpi_id: 'kpi-1',
        frozen_value: 500,
        frozen_at: '2026-01-01',
        frozen_by: null,
        source_snapshot: null,
        is_active: 1,
      });
      const res = await request(createApp()).get(
        `${BASE}/ledger/baselines/active?initiativeId=init-1&kpiId=kpi-1`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.frozen_value).toBe(500);
      expect(mockGet).toHaveBeenCalledWith(expect.any(String), ['org-1', 'init-1', 'kpi-1'], expect.anything());
    });

    it('POST /ledger/entries appends a correction entry', async () => {
      const res = await request(createApp())
        .post(`${BASE}/ledger/entries`)
        .send({ initiativeId: 'init-1', entryType: 'adjustment', valueDelta: -50, reason: 'correction' });
      expect(res.status).toBe(201);
      expect(res.body.data.value_delta).toBe(-50);
      expect(res.body.data.initiative_id).toBe('init-1');
    });

    it('GET /ledger/entries lists entries for an initiative', async () => {
      mockAll.mockResolvedValueOnce([
        {
          id: 'e1',
          organization_id: ORG,
          initiative_id: 'init-1',
          entry_type: 'adjustment',
          value_delta: -50,
          reason: null,
          provenance: null,
          created_by: null,
          created_at: '2026-01-02',
        },
      ]);
      const res = await request(createApp()).get(`${BASE}/ledger/entries?initiativeId=init-1`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].value_delta).toBe(-50);
    });

    it('GET /ledger/current-value composes baseline + entries into a current value + audit trail', async () => {
      mockGet.mockResolvedValueOnce({
        id: 'b1',
        organization_id: ORG,
        initiative_id: 'init-1',
        kpi_id: 'kpi-1',
        frozen_value: 1000,
        frozen_at: '2026-01-01',
        frozen_by: null,
        source_snapshot: null,
        is_active: 1,
      });
      mockAll.mockResolvedValueOnce([
        {
          id: 'e1',
          organization_id: ORG,
          initiative_id: 'init-1',
          entry_type: 'adjustment',
          value_delta: -50,
          reason: null,
          provenance: null,
          created_by: null,
          created_at: '2026-01-02',
        },
      ]);
      const res = await request(createApp()).get(
        `${BASE}/ledger/current-value?initiativeId=init-1&kpiId=kpi-1`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.current).toBe(950);
      expect(res.body.data.baselineValue).toBe(1000);
      expect(res.body.data.auditTrail).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 2. valueAttributionRollupService (pure)
  // -------------------------------------------------------------------------
  describe('attribution rollup (valueAttributionRollupService)', () => {
    it('POST /attribution/rollup caps overlapping contributions per KPI', async () => {
      const res = await request(createApp())
        .post(`${BASE}/attribution/rollup`)
        .send({
          contributions: [
            { initiativeId: 'a', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.7, valuePerKpiUnit: 10 },
            { initiativeId: 'b', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.6, valuePerKpiUnit: 10 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.totalAttributed).toBe(1000); // capped at 100% of the 100-unit delta * 10
      expect(res.body.data.doubleCountAvoided).toBeGreaterThan(0);
    });

    it('POST /attribution/by-initiative attributes capped value per initiative', async () => {
      const res = await request(createApp())
        .post(`${BASE}/attribution/by-initiative`)
        .send({
          contributions: [
            { initiativeId: 'a', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ initiativeId: 'a', attributedValue: 500 }]);
    });
  });

  // -------------------------------------------------------------------------
  // 3. valueCapturePipelineService
  // -------------------------------------------------------------------------
  describe('capture gates (valueCapturePipelineService)', () => {
    it('GET /capture/gates lists org-scoped gates', async () => {
      mockAll.mockResolvedValueOnce([
        { id: 'g1', organization_id: ORG, initiative_id: 'init-1', gate: 'G0', status: 'pending' },
      ]);
      const res = await request(createApp()).get(`${BASE}/capture/gates?initiativeId=init-1`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockAll).toHaveBeenCalledWith(
        expect.stringContaining('FROM value_capture_gates'),
        [ORG, 'init-1']
      );
    });

    it('POST /capture/gates creates a gate record', async () => {
      mockGet.mockResolvedValueOnce({
        id: 'g1',
        organization_id: ORG,
        initiative_id: 'init-1',
        gate: 'G0',
        status: 'pending',
        criteria: null,
        value_evidence: null,
      });
      const res = await request(createApp())
        .post(`${BASE}/capture/gates`)
        .send({ initiativeId: 'init-1', gate: 'G0' });
      expect(res.status).toBe(201);
      expect(res.body.data.gate).toBe('G0');
    });

    it('POST /capture/gates rejects an invalid gate label', async () => {
      const res = await request(createApp())
        .post(`${BASE}/capture/gates`)
        .send({ initiativeId: 'init-1', gate: 'G9' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALUE_CAPTURE_GATE_CREATE_FAILED');
    });

    it('POST /capture/gates/:id/advance advances when criteria met + signed off', async () => {
      mockGet
        .mockResolvedValueOnce({
          id: 'g1',
          organization_id: ORG,
          initiative_id: 'init-1',
          gate: 'G0',
          status: 'pending',
          criteria: 'exit criteria met',
          value_evidence: null,
        })
        .mockResolvedValueOnce({
          id: 'g1',
          organization_id: ORG,
          initiative_id: 'init-1',
          gate: 'G0',
          status: 'passed',
          criteria: 'exit criteria met',
          signed_off_by: UID,
          value_evidence: null,
        });
      const res = await request(createApp())
        .post(`${BASE}/capture/gates/g1/advance`)
        .send({ signedOffBy: UID });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('passed');
    });

    it('POST /capture/gates/:id/advance 404s when the gate is not found', async () => {
      mockGet.mockResolvedValueOnce(null);
      const res = await request(createApp())
        .post(`${BASE}/capture/gates/missing/advance`)
        .send({ signedOffBy: UID });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('VALUE_CAPTURE_GATE_NOT_FOUND');
    });

    it('GET /capture/funnel builds a conversion funnel from stored gates', async () => {
      mockAll.mockResolvedValueOnce([
        { id: 'g1', organization_id: ORG, initiative_id: 'init-1', gate: 'G0', status: 'passed', value_evidence: 100 },
        { id: 'g2', organization_id: ORG, initiative_id: 'init-2', gate: 'G0', status: 'passed', value_evidence: 50 },
        { id: 'g3', organization_id: ORG, initiative_id: 'init-1', gate: 'G1', status: 'pending', value_evidence: 0 },
      ]);
      const res = await request(createApp()).get(`${BASE}/capture/funnel`);
      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({ gate: 'G0', count: 2, totalValue: 150 });
      expect(res.body.data[1]).toMatchObject({ gate: 'G1', count: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // 4. realizedValueReconciliationService
  // -------------------------------------------------------------------------
  describe('reconciliation (realizedValueReconciliationService)', () => {
    it('POST /reconciliation/check flags a variance beyond tolerance', async () => {
      const res = await request(createApp())
        .post(`${BASE}/reconciliation/check`)
        .send({ declared: 1000, statementValue: 1200, tolerancePct: 5 });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('variance');
      expect(res.body.data.case).toBe('statement-exceeds-declared');
    });

    it('POST /reconciliation/portfolio aggregates matched/variance/unmapped', async () => {
      const res = await request(createApp())
        .post(`${BASE}/reconciliation/portfolio`)
        .send({
          rows: [
            { kpiId: 'k1', initiativeId: 'i1', declaredValue: 100, mappedStatementLineCode: 'L1', statementValue: 100 },
            { kpiId: 'k2', initiativeId: 'i2', declaredValue: 100, mappedStatementLineCode: null, statementValue: null },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.matched).toBe(1);
      expect(res.body.data.unmapped).toBe(1);
    });

    it('GET /reconciliation/organization loads + reconciles org rows (degrades to empty on DB error)', async () => {
      mockAll.mockRejectedValueOnce(new Error('no such table'));
      const res = await request(createApp()).get(`${BASE}/reconciliation/organization`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ matched: 0, variances: 0, unmapped: 0, items: [] });
    });
  });

  // -------------------------------------------------------------------------
  // 5. kpiLineageService (pure)
  // -------------------------------------------------------------------------
  describe('lineage (kpiLineageService)', () => {
    it('POST /lineage/early-warnings detects a leading/lagging divergence', async () => {
      const res = await request(createApp())
        .post(`${BASE}/lineage/early-warnings`)
        .send({
          pairs: [{ leadingKpiId: 'lead-1', leadingDeltaPct: 20, laggingKpiId: 'lag-1', laggingDeltaPct: 1 }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ leadingKpiId: 'lead-1', laggingKpiId: 'lag-1' });
    });
  });

  // -------------------------------------------------------------------------
  // 6. bankingValueService (pure)
  // -------------------------------------------------------------------------
  describe('banking (bankingValueService)', () => {
    it('POST /banking/bank wires a hard run-rate cost saving into the budget line (negative delta)', async () => {
      const res = await request(createApp())
        .post(`${BASE}/banking/bank`)
        .send({
          benefit: { value: 500, type: 'cost_out', isHard: true, isRunRate: true, mappedBudgetLine: 'OPEX-IT' },
          targetBudgetPeriod: '2026-Q3',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.bankedAmount).toBe(500);
      expect(res.body.data.budgetLineImpact).toEqual({ lineCode: 'OPEX-IT', deltaValue: -500 });
    });

    it('POST /banking/status reports leaked when actual falls short of plan', async () => {
      const res = await request(createApp())
        .post(`${BASE}/banking/status`)
        .send({
          benefit: { value: 500, type: 'cost_out', isHard: true, isRunRate: true, mappedBudgetLine: 'OPEX-IT' },
          actual: 300,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('leaked');
    });

    it('POST /banking/portfolio aggregates banked/pending/leaked totals', async () => {
      const res = await request(createApp())
        .post(`${BASE}/banking/portfolio`)
        .send({
          items: [
            {
              benefit: { value: 100, type: 'cost_out', isHard: true, isRunRate: true, mappedBudgetLine: 'A' },
              actual: 100,
            },
            {
              benefit: { value: 50, type: 'revenue_up', isHard: true, isRunRate: true, mappedBudgetLine: 'B' },
            },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.totalBanked).toBe(100);
      expect(res.body.data.totalPending).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // 7. extendedRatiosService (pure)
  // -------------------------------------------------------------------------
  describe('extended ratios (extendedRatiosService)', () => {
    const fin = {
      netIncome: 100,
      equity: 500,
      totalAssets: 1000,
      ebit: 150,
      ebitda: 200,
      debt: 300,
      cash: 50,
      revenue: 800,
      fixedAssets: 400,
      taxRatePct: 19,
    };

    it('POST /ratios/extended computes the 10-ratio extended set', async () => {
      const res = await request(createApp()).post(`${BASE}/ratios/extended`).send(fin);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(10);
      const roe = res.body.data.find((r: { code: string }) => r.code === 'roe');
      expect(roe.value).toBeCloseTo(0.2, 5);
    });

    it('POST /ratios/dupont decomposes ROE into netMargin x assetTurnover x equityMultiplier', async () => {
      const res = await request(createApp()).post(`${BASE}/ratios/dupont`).send(fin);
      expect(res.status).toBe(200);
      expect(res.body.data.roe).toBeCloseTo(0.2, 5);
      expect(
        res.body.data.netMargin * res.body.data.assetTurnover * res.body.data.equityMultiplier
      ).toBeCloseTo(res.body.data.roe, 5);
    });

    it('POST /ratios/benchmark positions a value against an industry quartile distribution', async () => {
      const res = await request(createApp())
        .post(`${BASE}/ratios/benchmark`)
        .send({ value: 0.15, benchmark: { p25: 0.05, median: 0.1, p75: 0.2 } });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ percentile: 'median', status: 'ok' });
    });
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  it('rejects unauthenticated calls before reaching any service (no v8Context attached)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v8/finance/value-tracking', financeValueRouter);
    const res = await request(app).post(`${BASE}/lineage/early-warnings`).send({ pairs: [] });
    expect(res.status).toBe(500); // getV8Context throws -> asyncHandler -> Express error handler
    expect(mockAll).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });
});
