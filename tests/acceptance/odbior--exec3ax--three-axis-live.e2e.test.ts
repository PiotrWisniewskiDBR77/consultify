/**
 * "Execution 3-osi" — REAL-runtime proof for `threeAxisReportService.buildThreeAxisReport`.
 *
 * Context: the F5 flagship read-model (T=czas × Z=zadania × W=wartość — see
 * `Harvard/wdrozenie-100/_KONCEPT_PROGRAM_MANAGEMENT_2026-07-10.md` §6) was wired
 * into a real HTTP endpoint in commits `ee89d68e2e`/`1f7db631a3` (2026-07-12) and
 * ships 781 lines of read-model + DB fetchers, but had ZERO tests of any kind —
 * `git grep -l threeAxisReportService tests/` before this file only found
 * `tests/integration/routes/report-builder.program3axis.routes.test.ts`, which
 * mocks the service entirely (pins route→service plumbing, not the SQL/math).
 *
 * This harness seeds ONE initiative with a real cost baseline (BAC), real
 * schedule dates, a real budget_entries ACTUAL row (AC), a real initiative_kpis
 * target + value_baselines/value_ledger_entries (current value), mounts the REAL
 * `report-builder.routes.ts` router behind REAL `verifyToken`, and calls the REAL
 * `GET /api/report-builder/program-3axis/live` — proving the T/Z/W axes, SPI/CPI-
 * derived scheduleHealth, impactGap (W-vs-Z) and deliveryPromise (W-vs-T) are
 * computed from genuine Postgres rows, not fabricated.
 *
 * Prefix for all rows this test writes: `odbior--exec3ax--`.
 */
// `initiatives.planned_start_date/planned_end_date` are `timestamp without
// time zone` columns (see server/migrations/20260411_v8_p03e_forecast_columns.sql).
// node-postgres parses a naive timestamp into a JS Date using the CURRENT
// process's local timezone, while `asOf` (this test's query param and the
// route's own `Date.now()` default) is a plain UTC epoch number. Forcing TZ=UTC
// here makes the round-trip lossless and matches how the deployed server runs
// (containers default to UTC) — without this, a non-UTC dev machine sees a
// spurious few-percent drift in T/pv that has nothing to do with the engine.
process.env.TZ = 'UTC';

import { createServer, type Server } from 'node:http';

import express, { type Express } from 'express';
import request from 'supertest';

import { getJwtSecret, mintToken, pgClient, requireLocalDbUrl } from './harness';
import { seed, SEED } from './seed.mjs';

const PREFIX = 'odbior--exec3ax--';
const INI_ID = `${PREFIX}ini-1`;
const KPI_ID = `${PREFIX}kpi-1`;
const BASELINE_ID = `${PREFIX}baseline-1`;
const LEDGER_ID = `${PREFIX}ledger-1`;
const BUDGET_ENTRY_ID = `${PREFIX}budget-1`;
const PROGRAM_ID = `${PREFIX}program-1`;

// Fixed "as of" instant so T (time-elapsed fraction) is deterministic, not
// dependent on wall-clock skew between seeding and the HTTP call.
const AS_OF = Date.parse('2026-07-01T00:00:00.000Z');
const START = new Date(AS_OF - 100 * 24 * 60 * 60 * 1000).toISOString(); // asOf - 100d
const END = new Date(AS_OF + 100 * 24 * 60 * 60 * 1000).toISOString(); // asOf + 100d
// pvFraction = (asOf - start) / (end - start) = 200d window, asOf at the exact
// midpoint => T = 50.0% (not a happy-path round number chosen by the engine —
// chosen by this fixture on purpose so a math regression is easy to spot).

const BAC = 100_000; // cost_capex only (cost_opex = 0)
const PROGRESS_PCT = 40; // no milestones seeded => EV fraction = progress/100
const ACTUAL_COST = 50_000; // budget_entries ACTUAL sum => AC
const KPI_TARGET = 100_000; // initiative_kpis.target_value
const BASELINE_FROZEN = 30_000; // value_baselines.frozen_value (is_active=1)
const LEDGER_DELTA = 10_000; // value_ledger_entries.value_delta

let app: Express;
let server: Server;
let token: string;

describe('Execution 3-osi (threeAxisReportService) — real-runtime wiring', () => {
  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.JWT_SECRET = process.env.JWT_SECRET || getJwtSecret();
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';

    await seed();

    const client = pgClient();
    await client.connect();
    try {
      // Reversible cleanup of any leftovers from a previous aborted run.
      await client.query(`DELETE FROM value_ledger_entries WHERE id = $1`, [LEDGER_ID]);
      await client.query(`DELETE FROM value_baselines WHERE id = $1`, [BASELINE_ID]);
      await client.query(`DELETE FROM budget_entries WHERE id = $1`, [BUDGET_ENTRY_ID]);
      await client.query(`DELETE FROM initiative_kpis WHERE id = $1`, [KPI_ID]);
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [INI_ID]);

      await client.query(
        `INSERT INTO initiatives
           (id, organization_id, program_id, name, status, cost_capex, cost_opex,
            planned_start_date, planned_end_date, progress)
         VALUES ($1, $2, $3, 'Odbior Exec3Ax Initiative', 'EXECUTING', $4, 0, $5, $6, $7)`,
        [INI_ID, SEED.ORG_ID, PROGRAM_ID, BAC, START, END, PROGRESS_PCT]
      );

      await client.query(
        `INSERT INTO initiative_kpis (id, initiative_id, name, target_value)
         VALUES ($1, $2, 'Odbior Exec3Ax KPI', $3)`,
        [KPI_ID, INI_ID, KPI_TARGET]
      );

      await client.query(
        `INSERT INTO value_baselines
           (id, organization_id, initiative_id, kpi_id, frozen_value, is_active)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [BASELINE_ID, SEED.ORG_ID, INI_ID, KPI_ID, BASELINE_FROZEN]
      );

      await client.query(
        `INSERT INTO value_ledger_entries
           (id, organization_id, initiative_id, entry_type, value_delta)
         VALUES ($1, $2, $3, 'REALIZED_CORRECTION', $4)`,
        [LEDGER_ID, SEED.ORG_ID, INI_ID, LEDGER_DELTA]
      );

      await client.query(
        `INSERT INTO budget_entries
           (id, organization_id, initiative_id, entry_type, cost_type, category, amount)
         VALUES ($1, $2, $3, 'ACTUAL', 'OPEX', 'General', $4)`,
        [BUDGET_ENTRY_ID, SEED.ORG_ID, INI_ID, ACTUAL_COST]
      );
    } finally {
      await client.end();
    }

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { default: reportBuilderRouter } = await import(
      '../../server/src/routes/report-builder.routes.js'
    );

    app = express();
    app.use(express.json({ limit: '5mb' }));
    // report-builder.routes.ts already applies verifyToken/demoContextMiddleware
    // via router.use() internally; mounting it directly (wzorzec harvey.e2e /
    // odbior--o4c) exercises the exact same middleware chain as production.
    app.use('/api/report-builder', reportBuilderRouter);
    void verifyToken; // imported for parity with sibling acceptance files; router self-applies it.

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    token = mintToken();
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));

    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM value_ledger_entries WHERE id = $1`, [LEDGER_ID]);
      await client.query(`DELETE FROM value_baselines WHERE id = $1`, [BASELINE_ID]);
      await client.query(`DELETE FROM budget_entries WHERE id = $1`, [BUDGET_ENTRY_ID]);
      await client.query(`DELETE FROM initiative_kpis WHERE id = $1`, [KPI_ID]);
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [INI_ID]);
    } finally {
      await client.end();
    }
  }, 30_000);

  it('GET /program-3axis/live computes REAL T/Z/W + SPI-derived scheduleHealth/impactGap/deliveryPromise from seeded Postgres rows', async () => {
    const res = await request(app)
      .get('/api/report-builder/program-3axis/live')
      .query({ asOf: String(AS_OF), programId: PROGRAM_ID })
      .set('Authorization', `Bearer ${token}`);

    // eslint-disable-next-line no-console
    console.log('[exec3ax] /live status', res.status, JSON.stringify(res.body).slice(0, 2000));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(true);

    const report = res.body.report;
    expect(report).toBeTruthy();
    expect(report.scope.level).toBe('program');
    expect(report.scope.programId).toBe(PROGRAM_ID);

    const row = report.rows.find((r: any) => r.initiativeId === INI_ID);
    expect(row).toBeTruthy();

    // T — pvFraction: asOf sits exactly at the midpoint of the 200-day window.
    expect(row.T.pct).toBeCloseTo(50.0, 1);
    expect(row.T.dataQuality).toBe('ok');

    // Z — EV/BAC via evmService.deriveInitiativeEvm (no milestones => progress%).
    expect(row.Z.pct).toBeCloseTo(40.0, 1);
    expect(row.Z.dataQuality).toBe('ok');

    // W — (frozen_value + ledger delta) / target = (30000+10000)/100000 = 40%.
    expect(row.W.pct).toBeCloseTo(40.0, 1);
    expect(row.W.dataQuality).toBe('ok');
    expect(row.raw.valueCurrent).toBeCloseTo(BASELINE_FROZEN + LEDGER_DELTA, 6);
    expect(row.raw.valueTarget).toBeCloseTo(KPI_TARGET, 6);

    // scheduleHealth = SPI = EV/PV = 40000/50000 = 0.8 => RED (< 0.85 threshold,
    // identical to evmService.indexRag — proves the shared-threshold doctrine).
    expect(row.scheduleHealth.ratio).toBeCloseTo(0.8, 2);
    expect(row.scheduleHealth.rag).toBe('RED');

    // impactGap = W/Z = 40/40 = 1.0 => GREEN (>= 0.95) — work IS converting to value.
    expect(row.impactGap.ratio).toBeCloseTo(1.0, 2);
    expect(row.impactGap.rag).toBe('GREEN');

    // deliveryPromise = W/T = 40/50 = 0.8 => RED — the program's value promise is
    // behind the elapsed-time clock even though impact-per-task-done is fine.
    expect(row.deliveryPromise.ratio).toBeCloseTo(0.8, 2);
    expect(row.deliveryPromise.rag).toBe('RED');

    // Row RAG = worst-of(scheduleHealth, impactGap, deliveryPromise) = RED.
    expect(row.rag).toBe('RED');

    // raw EVM numbers are exposed and match the seeded fixture, not invented.
    expect(row.raw.bac).toBeCloseTo(BAC, 2);
    expect(row.raw.evm.pv).toBeCloseTo(50_000, 2);
    expect(row.raw.evm.ev).toBeCloseTo(40_000, 2);
    expect(row.raw.evm.ac).toBeCloseTo(50_000, 2);

    // dataQuality counters reflect this one fully-populated initiative.
    expect(report.dataQuality.initiativesTotal).toBeGreaterThanOrEqual(1);
    expect(report.dataQuality.withCostBaseline).toBeGreaterThanOrEqual(1);
    expect(report.dataQuality.withValueBaseline).toBeGreaterThanOrEqual(1);
    expect(report.dataQuality.withScheduleDates).toBeGreaterThanOrEqual(1);

    // Program-level aggregate reuses derivePortfolioEvm 1:1 (kanon EVM) — with a
    // single contributing initiative the aggregate must equal the row exactly.
    expect(report.program.T.pct).toBeCloseTo(row.T.pct, 1);
    expect(report.program.scheduleHealth.rag).toBe('RED');
  });

  it('GET /program-3axis/live degrades gracefully (available:true, empty rows, program NA) when scoped to a project with zero initiatives', async () => {
    // auth.middleware resolves organizationId from the verified session/membership,
    // not a client-supplied JWT claim (a JWT can't spoof another org) — so the
    // "no data" case is proven the same way `projectId` scoping is exercised in
    // production: a real project/scope with nothing under it, same org.
    const res = await request(app)
      .get('/api/report-builder/program-3axis/live')
      .query({ projectId: `${PREFIX}nonexistent-project` })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(true); // engine degrades gracefully, not an error path
    expect(res.body.report.scope.level).toBe('project');
    expect(res.body.report.rows).toEqual([]);
    expect(res.body.report.program.T.dataQuality).toBe('missing');
    expect(res.body.report.program.rag).toBe('NA');
  });
});
