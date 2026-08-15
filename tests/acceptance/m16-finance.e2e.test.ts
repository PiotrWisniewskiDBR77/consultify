/**
 * M16 FINANSE — odbiór E2E backendu 15 paneli + valueOffice/driverPlanner
 * flipniętych w nocy (2026-07-16). Weryfikuje że BACKEND realnie liczy/persystuje,
 * nie tylko że dev-render pokazuje panel.
 *
 * Wzorzec 1:1 z parity-3areas.e2e.test.ts: REALNE routery v8 (finance-valuation,
 * finance-planning, finance-intelligence, finance-value=value-tracking,
 * financeValueRoutes=value-office) montowane WĄSKO za verifyToken +
 * requireV8OrgContext + attachV8Context (bez v8OrgGate — to flaga org, nie
 * pipeline; sama org-scoping logika jest w getV8Context per handler).
 * REALNA lokalna Postgres (parity pg18). Zero mocków.
 *
 * Suity pokryte:
 *   1) finance-valuation  — monte-carlo-npv, real-options/defer, sensitivity/tornado
 *   2) finance-planning   — cash-forecast
 *   2b) finance-intelligence — variance/narrate (gdzie realnie leży "variance-narration")
 *   3) finance-value (value-tracking) — ledger/baselines -> ledger/entries ->
 *      ledger/current-value (persist+odczyt w value_baselines/value_ledger_entries),
 *      attribution/rollup, capture/gates (POST+GET+advance), banking/status,
 *      ratios/extended
 *   4) financeValueRoutes (value-office, ValueOfficePanel) — value-bridge,
 *      portfolio/prioritize
 *   5) auth — 401 bez tokenu na reprezentatywnych endpointach
 */
import { appendFileSync } from 'node:fs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const EVIDENCE = process.env.PARITY_EVIDENCE_FILE;
const evidence = (line: string) => {
  if (EVIDENCE) appendFileSync(EVIDENCE, line + '\n');
  // Also print to stdout so the run is self-documenting without the env var.
  console.log(`[EVIDENCE] ${line}`);
};

const PREFIX = 'odbior--m16--';
const INITIATIVE_ID = `${PREFIX}initiative-0001`;
const KPI_ID = `${PREFIX}kpi-0001`;

let token: string;
let valuationApp: Express;
let planningApp: Express;
let intelligenceApp: Express;
let valueTrackingApp: Express;
let valueOfficeApp: Express;

const createdGateIds: string[] = [];

beforeAll(async () => {
  await seed();
  token = mintToken();

  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );

  const mount = (routerModule: unknown, prefix: string): Express => {
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use(
      prefix,
      verifyToken as any,
      requireV8OrgContext as any,
      attachV8Context as any,
      routerModule as any
    );
    return app;
  };

  const { default: financeValuationRouter } = await import(
    '../../server/src/routes/v8/finance-valuation.routes.js'
  );
  valuationApp = mount(financeValuationRouter, '/api/v8/finance-valuation');

  const { default: financePlanningRouter } = await import(
    '../../server/src/routes/v8/finance-planning.routes.js'
  );
  planningApp = mount(financePlanningRouter, '/api/v8/finance-planning');

  const { default: financeIntelligenceRouter } = await import(
    '../../server/src/routes/v8/finance-intelligence.routes.js'
  );
  intelligenceApp = mount(financeIntelligenceRouter, '/api/v8/finance-intelligence');

  const { default: financeValueTrackingRouter } = await import(
    '../../server/src/routes/v8/finance-value.routes.js'
  );
  valueTrackingApp = mount(financeValueTrackingRouter, '/api/v8/finance/value-tracking');

  const { default: financeValueOfficeRouter } = await import(
    '../../server/src/routes/v8/financeValueRoutes.js'
  );
  valueOfficeApp = mount(financeValueOfficeRouter, '/api/v8/finance/value');
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client
      .query(`DELETE FROM value_ledger_entries WHERE initiative_id = $1`, [INITIATIVE_ID])
      .catch(() => {});
    await client
      .query(`DELETE FROM value_baselines WHERE initiative_id = $1`, [INITIATIVE_ID])
      .catch(() => {});
    if (createdGateIds.length) {
      await client
        .query(`DELETE FROM value_capture_gates WHERE id = ANY($1)`, [createdGateIds])
        .catch(() => {});
    }
    await client
      .query(`DELETE FROM value_capture_gates WHERE initiative_id = $1`, [INITIATIVE_ID])
      .catch(() => {});
  } finally {
    await client.end();
  }
});

// ============================================================================
// 1) FINANCE-VALUATION — monte-carlo-npv, real-options/defer, sensitivity/tornado
// ============================================================================
describe('M16 SUITE: finance-valuation (real engines behind real auth)', () => {
  it('POST /monte-carlo-npv returns a real simulation shape (not 500/404), 3x reliability', async () => {
    const body = {
      drivers: {
        revenue: { kind: 'triangular', min: 100, mode: 150, max: 220 },
        cost: { kind: 'normal', mean: 60, sd: 10 },
      },
      weights: { revenue: 1, cost: -1 },
      intercept: 0,
      iterations: 500,
      seed: 42,
      bins: 10,
    };

    const results: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(valuationApp)
        .post('/api/v8/finance-valuation/monte-carlo-npv')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      if (res.status !== 200) {
        console.error(`[monte-carlo-npv] run${i} FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
      }
      expect(res.status).toBe(200);
      const sim = res.body?.data?.simulation;
      expect(sim).toBeTruthy();
      expect(Array.isArray(sim.samples)).toBe(true);
      expect(sim.samples.length).toBe(500);
      expect(Number.isFinite(sim.mean)).toBe(true);
      expect(Number.isFinite(sim.p50)).toBe(true);
      expect(Array.isArray(res.body?.data?.histogram)).toBe(true);
      results.push(sim.mean);
    }
    // Seeded PRNG -> deterministic across repeated calls (reliability proof).
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    evidence(`VALUATION monte-carlo-npv mean=${results[0]} (3x identical, deterministic seed=42)`);
  }, 30_000);

  it('POST /real-options/defer returns a real binomial-lattice option value', async () => {
    const res = await request(valuationApp)
      .post('/api/v8/finance-valuation/real-options/defer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        underlyingValue: 1_000_000,
        investmentCost: 800_000,
        volatility: 0.3,
        riskFreeRate: 0.04,
        timeToDecideYears: 2,
      });

    if (res.status !== 200) {
      console.error(`[real-options/defer] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data).toBeTruthy();
    expect(Number.isFinite(data.optionValue)).toBe(true);
    expect(data.optionValue).toBeGreaterThanOrEqual(0);
    expect(['defer', 'invest-now', 'abandon']).toContain(data.recommendation);
    evidence(`VALUATION real-options/defer optionValue=${data.optionValue} recommendation=${data.recommendation}`);
  }, 15_000);

  it('POST /sensitivity/tornado returns a real what-if tornado result', async () => {
    const res = await request(valuationApp)
      .post('/api/v8/finance-valuation/sensitivity/tornado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseDrivers: { revenue: 150, cost: 60, headcount: 8 },
        weights: { revenue: 1, cost: -1, headcount: -5 },
        intercept: 0,
        driverIds: ['revenue', 'cost', 'headcount'],
        swingPct: 0.2,
      });

    if (res.status !== 200) {
      console.error(`[sensitivity/tornado] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body?.data).toBeTruthy();
    evidence(`VALUATION sensitivity/tornado data=${JSON.stringify(res.body?.data).slice(0, 300)}`);
  }, 15_000);

  it('rejects an unauthenticated monte-carlo-npv request (real auth enforced)', async () => {
    const res = await request(valuationApp)
      .post('/api/v8/finance-valuation/monte-carlo-npv')
      .send({ drivers: { x: { kind: 'normal', mean: 1, sd: 1 } } });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// 2) FINANCE-PLANNING — cash-forecast
// ============================================================================
describe('M16 SUITE: finance-planning (real engine behind real auth)', () => {
  it('POST /cash-forecast returns a real forecast+runway+curve, 3x reliability', async () => {
    const body = {
      openingCash: 500_000,
      periods: [
        { period: '2026-08', inflows: 120_000, outflows: 150_000 },
        { period: '2026-09', inflows: 110_000, outflows: 160_000 },
        { period: '2026-10', inflows: 100_000, outflows: 170_000 },
      ],
      monthlyBurn: 40_000,
      minCash: 50_000,
    };

    const closingBalances: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(planningApp)
        .post('/api/v8/finance-planning/cash-forecast')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      if (res.status !== 200) {
        console.error(`[cash-forecast] run${i} FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
      }
      expect(res.status).toBe(200);
      const data = res.body?.data;
      expect(Array.isArray(data?.forecast)).toBe(true);
      expect(data.forecast.length).toBe(3);
      expect(data.runway).toBeTruthy();
      expect(Array.isArray(data.curve)).toBe(true);
      const last = data.forecast[data.forecast.length - 1];
      expect(Number.isFinite(last.closingCash ?? last.closing_cash ?? last.closing)).toBe(true);
      closingBalances.push(Number(last.closingCash ?? last.closing_cash ?? last.closing));
    }
    expect(closingBalances[0]).toBe(closingBalances[1]);
    expect(closingBalances[1]).toBe(closingBalances[2]);
    evidence(`PLANNING cash-forecast closingCash=${closingBalances[0]} (3x identical, deterministic)`);
  }, 30_000);

  it('rejects an unauthenticated cash-forecast request (real auth enforced)', async () => {
    const res = await request(planningApp)
      .post('/api/v8/finance-planning/cash-forecast')
      .send({ openingCash: 100, periods: [] });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// 2b) FINANCE-INTELLIGENCE — variance/narrate ("variance-narration")
// ============================================================================
describe('M16 SUITE: finance-intelligence — variance/narrate (real engine)', () => {
  it('POST /variance/narrate returns a real narration + top drivers + severity', async () => {
    const res = await request(intelligenceApp)
      .post('/api/v8/finance-intelligence/variance/narrate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bridge: [
          { label: 'Wolumen', plan: 100_000, actual: 92_000 },
          { label: 'Cena', plan: 50_000, actual: 55_000 },
          { label: 'FX', plan: 10_000, actual: 4_000 },
        ],
        topN: 2,
      });

    if (res.status !== 200) {
      console.error(`[variance/narrate] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data).toBeTruthy();
    // narration is { headline, drivers, commentary } — a real CFO write-up, not a stub string.
    expect(typeof data.narration?.headline).toBe('string');
    expect(data.narration.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(data.narration.drivers)).toBe(true);
    expect(typeof data.narration.commentary).toBe('string');
    // top-level `drivers` = topVarianceDrivers(bridge, topN) — capped at topN.
    expect(Array.isArray(data.drivers)).toBe(true);
    expect(data.drivers.length).toBeLessThanOrEqual(2);
    expect(data.severity).toBeTruthy();
    evidence(`INTELLIGENCE variance/narrate headline="${data.narration.headline}" severity=${JSON.stringify(data.severity)} drivers=${data.drivers.length}`);
  }, 15_000);
});

// ============================================================================
// 3) FINANCE VALUE-TRACKING — ledger, attribution, capture gates, banking, ratios
// ============================================================================
describe('M16 SUITE: finance/value-tracking (ledger/attribution/capture/banking/ratios)', () => {
  it('ledger: freeze baseline -> append entry -> current-value composes correctly, PERSISTED in Postgres', async () => {
    // 1. Freeze baseline.
    const baselineRes = await request(valueTrackingApp)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID, value: 100_000 });

    if (baselineRes.status !== 201) {
      console.error(`[ledger/baselines] FAILED status=${baselineRes.status} body=${JSON.stringify(baselineRes.body)}`);
    }
    expect(baselineRes.status).toBe(201);
    const baselineId = baselineRes.body?.data?.id;
    expect(baselineId).toBeTruthy();

    // PERSISTENCE — direct SQL read.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id, initiative_id, kpi_id, frozen_value, is_active
           FROM value_baselines WHERE id = $1`,
        [baselineId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(Number(rows[0].frozen_value)).toBe(100_000);
      expect(Number(rows[0].is_active)).toBe(1);
      evidence(`VALUE-LEDGER baseline id=${baselineId} frozen_value=${rows[0].frozen_value} org=${rows[0].organization_id}`);
    } finally {
      await client.end();
    }

    // 2. Append a correction entry.
    const entryRes = await request(valueTrackingApp)
      .post('/api/v8/finance/value-tracking/ledger/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, entryType: 'correction', valueDelta: 15_000, reason: 'odbior test' });

    expect(entryRes.status).toBe(201);
    const entryId = entryRes.body?.data?.id;
    expect(entryId).toBeTruthy();
    evidence(`VALUE-LEDGER entry id=${entryId} valueDelta=15000`);

    // 3. current-value composes baseline + ledger.
    const currentRes = await request(valueTrackingApp)
      .get(
        `/api/v8/finance/value-tracking/ledger/current-value?initiativeId=${encodeURIComponent(INITIATIVE_ID)}&kpiId=${encodeURIComponent(KPI_ID)}`
      )
      .set('Authorization', `Bearer ${token}`);

    if (currentRes.status !== 200) {
      console.error(`[ledger/current-value] FAILED status=${currentRes.status} body=${JSON.stringify(currentRes.body)}`);
    }
    expect(currentRes.status).toBe(200);
    const current = currentRes.body?.data;
    expect(current.baselineValue).toBe(100_000);
    expect(current.current).toBe(115_000);
    expect(Array.isArray(current.auditTrail)).toBe(true);
    expect(current.auditTrail.length).toBe(2); // baseline + 1 entry
    evidence(`VALUE-LEDGER current-value=${current.current} (100000 baseline + 15000 delta) auditTrail=${current.auditTrail.length} steps`);
  }, 30_000);

  it('attribution/rollup: anti-double-count portfolio rollup returns real totals', async () => {
    // Two initiatives both claim a share of the SAME KPI's delta (100 units,
    // 100 PLN/unit); their shares sum to 1.3 (over-claimed) -> service must cap
    // the total attributed value at the KPI delta and report the overclaim as
    // doubleCountAvoided (the whole point of this "anti-double-count" engine).
    const res = await request(valueTrackingApp)
      .post('/api/v8/finance/value-tracking/attribution/rollup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contributions: [
          { initiativeId: 'a', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.7, valuePerKpiUnit: 100 },
          { initiativeId: 'b', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.6, valuePerKpiUnit: 100 },
        ],
      });

    if (res.status !== 200) {
      console.error(`[attribution/rollup] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data).toBeTruthy();
    // Capped total: shares (0.7+0.6=1.3) scaled down to sum to 1.0 of the 100-unit
    // delta at 100 PLN/unit -> attributed = 100 * 100 = 10,000 (not 13,000 naive).
    expect(data.totalAttributed).toBe(10_000);
    expect(data.doubleCountAvoided).toBeGreaterThan(0);
    expect(Array.isArray(data.byKpi)).toBe(true);
    expect(data.byKpi[0].kpiId).toBe('k1');
    evidence(`VALUE-TRACKING attribution/rollup totalAttributed=${data.totalAttributed} doubleCountAvoided=${data.doubleCountAvoided} (anti-double-count over 1.3 claimed share)`);
  }, 15_000);

  it('capture/gates: create G0 gate (persisted), list it, advance requires criteria+sign-off', async () => {
    const createRes = await request(valueTrackingApp)
      .post('/api/v8/finance/value-tracking/capture/gates')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, gate: 'G0', criteria: 'Business case zaakceptowany', valueEvidence: 25_000 });

    if (createRes.status !== 201) {
      console.error(`[capture/gates POST] FAILED status=${createRes.status} body=${JSON.stringify(createRes.body)}`);
    }
    expect(createRes.status).toBe(201);
    const gateId = createRes.body?.data?.id;
    expect(gateId).toBeTruthy();
    createdGateIds.push(gateId);

    // PERSISTENCE.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM value_capture_gates WHERE id = $1`, [gateId]);
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(rows[0].gate).toBe('G0');
      evidence(`VALUE-CAPTURE gate id=${gateId} gate=G0 org=${rows[0].organization_id}`);
    } finally {
      await client.end();
    }

    // LIST.
    const listRes = await request(valueTrackingApp)
      .get(`/api/v8/finance/value-tracking/capture/gates?initiativeId=${encodeURIComponent(INITIATIVE_ID)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body?.data)).toBe(true);
    expect(listRes.body.data.some((g: any) => g.id === gateId)).toBe(true);

    // ADVANCE — criteria present + signedOffBy -> should succeed (criteria non-empty in create above).
    const advanceRes = await request(valueTrackingApp)
      .post(`/api/v8/finance/value-tracking/capture/gates/${gateId}/advance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ signedOffBy: SEED.USER_ID });

    if (advanceRes.status !== 200) {
      console.error(`[capture/gates advance] status=${advanceRes.status} body=${JSON.stringify(advanceRes.body)}`);
    }
    expect(advanceRes.status).toBe(200);
    expect(advanceRes.body?.data?.status).toBe('passed');
    evidence(`VALUE-CAPTURE gate ${gateId} advanced -> status=${advanceRes.body?.data?.status}`);
  }, 30_000);

  it('banking/status: reports real banked-vs-actual status (hard+run-rate benefit, actual short of plan -> "leaked")', async () => {
    const res = await request(valueTrackingApp)
      .post('/api/v8/finance/value-tracking/banking/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        benefit: {
          value: 10_000,
          type: 'cost_out',
          isHard: true,
          isRunRate: true,
          mappedBudgetLine: 'OPEX-IT',
        },
        actual: 9_200,
      });

    if (res.status !== 200) {
      console.error(`[banking/status] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data).toBeTruthy();
    // actual (9200) < planned (10000) -> the saving fell short -> 'leaked', variance = -800.
    expect(data.status).toBe('leaked');
    expect(data.variance).toBe(-800);
    evidence(`VALUE-TRACKING banking/status=${data.status} variance=${data.variance} (planned 10000, actual 9200 -> leaked)`);
  }, 15_000);

  it('ratios/extended: computes real ROE/ROA/ROIC/DSCR-family ratios', async () => {
    const res = await request(valueTrackingApp)
      .post('/api/v8/finance/value-tracking/ratios/extended')
      .set('Authorization', `Bearer ${token}`)
      .send({
        netIncome: 500_000,
        equity: 2_000_000,
        totalAssets: 5_000_000,
        ebit: 700_000,
        ebitda: 1_200_000,
        debt: 1_000_000,
        cash: 200_000,
        revenue: 4_000_000,
        fixedAssets: 2_500_000,
        taxRatePct: 19,
      });

    if (res.status !== 200) {
      console.error(`[ratios/extended] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data as Array<{ code: string; value: number | null; status: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(5);
    const byCode = Object.fromEntries(data.map((r) => [r.code, r]));
    // ROE = netIncome/equity = 500k/2,000k = 0.25 — must be a real non-null number.
    expect(byCode.roe.value).toBeCloseTo(0.25, 6);
    // ROA = 500k/5,000k = 0.10
    expect(byCode.roa.value).toBeCloseTo(0.1, 6);
    expect(byCode.roic.value).not.toBeNull();
    evidence(`VALUE-TRACKING ratios/extended roe=${byCode.roe.value} roa=${byCode.roa.value} roic=${byCode.roic.value} (${data.length} ratios computed)`);
  }, 15_000);

  it('rejects an unauthenticated ledger read (real auth enforced)', async () => {
    const res = await request(valueTrackingApp).get(
      `/api/v8/finance/value-tracking/ledger/current-value?initiativeId=${INITIATIVE_ID}&kpiId=${KPI_ID}`
    );
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// 4) FINANCE VALUE-OFFICE — ValueOfficePanel's actual data source
// ============================================================================
describe('M16 SUITE: finance/value (ValueOfficePanel backend — value-bridge, portfolio/prioritize)', () => {
  it('POST /value-bridge returns a real waterfall (not 500/404)', async () => {
    const res = await request(valueOfficeApp)
      .post('/api/v8/finance/value/value-bridge')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initiatives: [
          { id: 'i1', name: 'Automatyzacja linii A', value: 200_000, stage: 'identified' },
          { id: 'i2', name: 'Program oszczędności B', value: 150_000, stage: 'realized' },
          { id: 'i3', name: 'Refinansowanie C', value: 90_000, stage: 'banked' },
        ],
      });

    if (res.status !== 200) {
      console.error(`[value-bridge] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data).toBeTruthy();
    expect(Array.isArray(data.steps)).toBe(true);
    expect(data.steps.length).toBeGreaterThan(0);
    expect(Number.isFinite(data.totalRealized)).toBe(true);
    expect(Number.isFinite(data.totalIdentified)).toBe(true);
    expect(data.totalIdentified).toBeGreaterThan(0);
    evidence(`VALUE-OFFICE value-bridge totalIdentified=${data.totalIdentified} totalRealized=${data.totalRealized} steps=${data.steps.length}`);
  }, 15_000);

  it('POST /portfolio/prioritize returns a real NPV x risk bubble board', async () => {
    const res = await request(valueOfficeApp)
      .post('/api/v8/finance/value/portfolio/prioritize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initiatives: [
          { id: 'i1', name: 'A', npv: 500_000, risk: 0.2, effort: 3 },
          { id: 'i2', name: 'B', npv: 200_000, risk: 0.7, effort: 5 },
          { id: 'i3', name: 'C', npv: 800_000, risk: 0.5, effort: 8 },
        ],
      });

    if (res.status !== 200) {
      console.error(`[portfolio/prioritize] FAILED status=${res.status} body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data).toBeTruthy();
    evidence(`VALUE-OFFICE portfolio/prioritize=${JSON.stringify(data).slice(0, 400)}`);
  }, 15_000);

  it('rejects an unauthenticated value-bridge request (real auth enforced)', async () => {
    const res = await request(valueOfficeApp).post('/api/v8/finance/value/value-bridge').send({ initiatives: [] });
    expect(res.status).toBe(401);
  });
});

