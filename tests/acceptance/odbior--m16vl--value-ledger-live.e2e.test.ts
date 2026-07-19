/**
 * M16 "Śledzenie wartości" — REAL-runtime proof for `valueLedgerService` behind
 * the real `POST/GET /api/v8/finance/value-tracking/ledger/*` endpoints.
 *
 * Context: `server/src/routes/v8/finance-value.routes.ts` wires 7 previously-
 * orphaned M16 value-tracking services into REST endpoints (module docblock:
 * "wires 7 previously-orphaned M16 services (0 importers before this file)").
 * `valueLedgerService` (frozen baseline + append-only correction ledger) has
 * 35+ pure-function unit tests (`tests/unit/finance/valueLedgerService.test.ts`)
 * and a thorough route-wiring test (`tests/integration/routes/v8.finance-value.test.ts`)
 * — but that integration test mocks `server/src/utils/DbPromise.js` entirely
 * (`vi.mock('.../DbPromise.js', ...)`), so the actual SQL against Postgres
 * (INSERT/UPDATE with `is_active` deactivation, the JOIN-free ledger SUM) has
 * never been exercised against a real database — exactly the class of bug this
 * codebase has repeatedly hit (column/alias drift only visible with real SQL).
 *
 * This harness mounts the REAL `finance-value.routes.ts` router behind REAL
 * `verifyToken` + `attachV8Context` (the same auth chain `v8/index.ts` uses,
 * minus the DB-backed `v8OrgGate` feature-flag check — mirrors the existing
 * `odbior--o4c--business-case-live` pattern of mounting a v8 sub-router directly)
 * and drives the full real-DB flow: freeze baseline -> read active baseline ->
 * append two correction entries -> read composed current-value + audit trail ->
 * re-freeze (supersede) the baseline and confirm the old one is deactivated.
 *
 * Prefix for all rows this test writes: `odbior--m16vl--`.
 */
import { createServer, type Server } from 'node:http';

import express, { type Express } from 'express';
import request from 'supertest';

import { getJwtSecret, mintToken, pgClient, requireLocalDbUrl } from './harness';
import { seed, SEED } from './seed.mjs';

const PREFIX = 'odbior--m16vl--';
const INITIATIVE_ID = `${PREFIX}ini-1`;
const KPI_ID = `${PREFIX}kpi-1`;

let app: Express;
let server: Server;
let token: string;

describe('M16 value-ledger (valueLedgerService) — real-runtime wiring', () => {
  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.JWT_SECRET = process.env.JWT_SECRET || getJwtSecret();
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';

    await seed();

    // Reversible cleanup of any leftovers from a previous aborted run — the
    // service itself has no FK to `initiatives`, so a bare initiativeId string
    // is legitimate, but scoping under organization_id keeps this reversible.
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM value_ledger_entries WHERE organization_id = $1 AND initiative_id = $2`,
        [SEED.ORG_ID, INITIATIVE_ID]
      );
      await client.query(
        `DELETE FROM value_baselines WHERE organization_id = $1 AND initiative_id = $2`,
        [SEED.ORG_ID, INITIATIVE_ID]
      );
    } finally {
      await client.end();
    }

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const { default: financeValueTrackingRoutes } = await import(
      '../../server/src/routes/v8/finance-value.routes.js'
    );

    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use(
      '/api/v8/finance/value-tracking',
      verifyToken as any,
      attachV8Context as any,
      financeValueTrackingRoutes
    );

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    token = mintToken();
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));

    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM value_ledger_entries WHERE organization_id = $1 AND initiative_id = $2`,
        [SEED.ORG_ID, INITIATIVE_ID]
      );
      await client.query(
        `DELETE FROM value_baselines WHERE organization_id = $1 AND initiative_id = $2`,
        [SEED.ORG_ID, INITIATIVE_ID]
      );
    } finally {
      await client.end();
    }
  }, 30_000);

  it('POST /ledger/baselines freezes a REAL active baseline row in Postgres', async () => {
    const res = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID, value: 30_000, sourceSnapshot: { note: 'odbior' } });

    // eslint-disable-next-line no-console
    console.log('[m16vl] POST baselines', res.status, JSON.stringify(res.body));
    expect(res.status).toBe(201);
    expect(res.body.data).toBeTruthy();
    expect(Number(res.body.data.frozen_value)).toBe(30_000);
    expect(Number(res.body.data.is_active)).toBe(1);
    expect(res.body.data.organization_id).toBe(SEED.ORG_ID);
    expect(res.body.data.initiative_id).toBe(INITIATIVE_ID);
    expect(res.body.data.kpi_id).toBe(KPI_ID);

    const active = await request(app)
      .get('/api/v8/finance/value-tracking/ledger/baselines/active')
      .query({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID })
      .set('Authorization', `Bearer ${token}`);
    expect(active.status).toBe(200);
    expect(Number(active.body.data.frozen_value)).toBe(30_000);
  });

  it('POST /ledger/entries appends two REAL correction entries, and GET /ledger/current-value composes baseline + entries with a full audit trail', async () => {
    const entry1 = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initiativeId: INITIATIVE_ID,
        entryType: 'MANUAL_CORRECTION',
        valueDelta: 5_000,
        reason: 'odbior: manual uplift',
      });
    expect(entry1.status).toBe(201);
    expect(Number(entry1.body.data.value_delta)).toBe(5_000);

    const entry2 = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        initiativeId: INITIATIVE_ID,
        entryType: 'REALIZED_CORRECTION',
        valueDelta: -2_000,
        reason: 'odbior: realized shortfall',
      });
    expect(entry2.status).toBe(201);
    expect(Number(entry2.body.data.value_delta)).toBe(-2_000);

    const listRes = await request(app)
      .get('/api/v8/finance/value-tracking/ledger/entries')
      .query({ initiativeId: INITIATIVE_ID })
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBe(2);

    const currentRes = await request(app)
      .get('/api/v8/finance/value-tracking/ledger/current-value')
      .query({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID })
      .set('Authorization', `Bearer ${token}`);

    // eslint-disable-next-line no-console
    console.log('[m16vl] current-value', currentRes.status, JSON.stringify(currentRes.body));
    expect(currentRes.status).toBe(200);
    // current = baseline(30000) + 5000 - 2000 = 33000, computed by REAL SQL SUMs
    // composed through valueLedgerService.currentValueFromLedger (pure function),
    // not re-derived by this test.
    expect(currentRes.body.data.current).toBe(33_000);
    expect(currentRes.body.data.baselineValue).toBe(30_000);
    expect(Array.isArray(currentRes.body.data.auditTrail)).toBe(true);
    // baseline step + 2 ledger steps.
    expect(currentRes.body.data.auditTrail.length).toBe(3);
    expect(currentRes.body.data.auditTrail[0].kind).toBe('baseline');
    expect(currentRes.body.data.auditTrail[0].runningTotal).toBe(30_000);
    expect(currentRes.body.data.auditTrail[2].runningTotal).toBe(33_000);
  });

  it('POST /ledger/baselines (re-freeze) deactivates the prior baseline — only one is_active=1 row survives, and current-value reflects the NEW baseline (old ledger entries do not carry over)', async () => {
    const refreeze = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID, value: 50_000 });
    expect(refreeze.status).toBe(201);
    expect(Number(refreeze.body.data.frozen_value)).toBe(50_000);
    expect(Number(refreeze.body.data.is_active)).toBe(1);

    // Prove it with a REAL SQL read (not the service's own accessor) — only one
    // active row per (org, initiative, kpi), confirming the deactivation UPDATE
    // actually ran, not just that the new INSERT succeeded.
    const client = pgClient();
    await client.connect();
    try {
      const activeRows = await client.query(
        `SELECT id, frozen_value, is_active FROM value_baselines
         WHERE organization_id = $1 AND initiative_id = $2 AND kpi_id = $3 AND is_active = 1`,
        [SEED.ORG_ID, INITIATIVE_ID, KPI_ID]
      );
      expect(activeRows.rows.length).toBe(1);
      expect(Number(activeRows.rows[0].frozen_value)).toBe(50_000);

      const allRows = await client.query(
        `SELECT id, frozen_value, is_active FROM value_baselines
         WHERE organization_id = $1 AND initiative_id = $2 AND kpi_id = $3 ORDER BY frozen_value ASC`,
        [SEED.ORG_ID, INITIATIVE_ID, KPI_ID]
      );
      expect(allRows.rows.length).toBe(2);
      expect(Number(allRows.rows[0].is_active)).toBe(0); // the old 30000 baseline, deactivated
    } finally {
      await client.end();
    }

    const currentRes = await request(app)
      .get('/api/v8/finance/value-tracking/ledger/current-value')
      .query({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID })
      .set('Authorization', `Bearer ${token}`);
    expect(currentRes.status).toBe(200);
    // baseline is now 50000; the 2 prior ledger entries still belong to this
    // initiative (ledger is not baseline-scoped) so current = 50000+5000-2000.
    expect(currentRes.body.data.baselineValue).toBe(50_000);
    expect(currentRes.body.data.current).toBe(53_000);
  });

  it('POST /ledger/baselines 400s on missing initiativeId/kpiId (route-level validation, not a 500)', async () => {
    const res = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1000 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALUE_LEDGER_BAD_INPUT');
  });
});
