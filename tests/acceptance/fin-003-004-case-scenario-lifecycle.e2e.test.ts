/**
 * FIN-03/FIN-04 — Investment Case save/version/reopen + Scenario/baseline
 * lifecycle: acceptance suite.
 *
 * REAL-runtime E2E: local Postgres (full schema, incl. migration
 * 20260801_fin003_004_case_scenario_baseline.sql) + the REAL
 * `routes/v8/finance.routes.ts` router mounted at /api/v8/finance behind the
 * REAL verifyToken -> requireV8OrgContext -> attachV8Context middleware
 * chain (mirrors routes/v8/index.ts:46-63, minus the v8OrgGate feature-flag
 * check, which finance.routes.ts's own handlers never read). No mocks of
 * the router, service, or DB under test. Two real tenants (org A / org B),
 * real seeded users, real signed JWTs minted per-actor.
 *
 * Fixtures use the reversible `fin0304--` prefix and are removed in
 * afterAll. Writes ONLY to the LOCAL Postgres (requireLocalDbUrl() guard —
 * see the harness-guard test at the bottom for a live proof).
 *
 * Structural reference: tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts
 * (same "real router + real Postgres + two tenants + raw-SQL verification"
 * shape, adapted to the Finance Investment Case domain).
 */
// MUST run before any server-side module (Config.ts) is imported. This test
// runner does not set NODE_ENV=test, so server/src/config/Config.ts falls
// back to its DEV secret ('supersecretkey_change_this_in_production'), while
// harness.ts's getJwtSecret() falls back to a THIRD, different hardcoded
// string ('development_secret_key_change_in_production_abc123xyz') — the two
// never agree, so tokens minted via the harness default fail verification
// with "invalid signature" (reproduced live while building this suite; a
// pre-existing harness/Config drift, not something this packet introduced).
// Setting JWT_SECRET explicitly here, before any import touches Config.ts,
// makes BOTH Config.ts (`process.env.JWT_SECRET || ...`) and harness.ts's
// getJwtSecret() (same pattern) converge on this one value.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'fin0304-acceptance-test-secret-key-minimum-32-characters-long';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const P = 'fin0304--';

// ── Tenants ──────────────────────────────────────────────────────────────
const ORG_A = `${P}org-A`;
const ORG_B = `${P}org-B`;
const USER_A = `${P}user-A`;
const EMAIL_A = `${P}a@acceptance.local`;
const USER_B = `${P}user-B`;
const EMAIL_B = `${P}b@acceptance.local`;

function mintTokenFor(userId: string, orgId: string, email: string, role: string): string {
  return jwt.sign(
    { id: userId, email, organizationId: orgId, organization_id: orgId, role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function seedTenant(
  c: pg.Client,
  orgId: string,
  userId: string,
  email: string,
  role: string
): Promise<void> {
  const now = new Date().toISOString();
  await c.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
    [orgId, `FIN0304 ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x',$4,'active','Fin0304','Test',$5) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, role, now]
  );
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $4,$1,$2,'ADMIN','ACTIVE',$3
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, now, `${P}mem-${userId}`]
  );
}

describe('FIN-03/FIN-04 — Investment Case + Scenario/Baseline lifecycle (real Postgres, real router)', () => {
  let client: pg.Client;
  let app: Express;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    requireLocalDbUrl();
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    // Apply this packet's own migration directly — acceptance suites run
    // against a persistent local fixture DB that may predate this branch's
    // migration file; this makes the suite self-sufficient rather than
    // depending on an out-of-band migration run having already happened.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.resolve(
      __dirname,
      '../../server/migrations/20260801_fin003_004_case_scenario_baseline.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migrationSql);

    await seedTenant(client, ORG_A, USER_A, EMAIL_A, 'ADMIN');
    await seedTenant(client, ORG_B, USER_B, EMAIL_B, 'ADMIN');

    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';

    const expressApp = express();
    expressApp.use(express.json({ limit: '5mb' }));
    const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { requireV8OrgContext, attachV8Context } = await import(
      '../../server/src/middleware/v8Auth.middleware.js'
    );
    const financeRouter = (await import('../../server/src/routes/v8/finance.routes.js')).default;
    expressApp.use(
      '/api/v8/finance',
      verifyToken as any,
      requireV8OrgContext as any,
      attachV8Context as any,
      financeRouter as unknown as express.Router
    );
    app = expressApp;

    tokenA = mintTokenFor(USER_A, ORG_A, EMAIL_A, 'ADMIN');
    tokenB = mintTokenFor(USER_B, ORG_B, EMAIL_B, 'ADMIN');
  });

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM financial_model_baseline_audit WHERE case_id LIKE $1 OR organization_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM financial_model_idempotency WHERE organization_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM financial_model_outputs WHERE model_id IN (SELECT id FROM financial_models WHERE organization_id LIKE $1)`, [`${P}%`]);
    await client.query(`DELETE FROM financial_model_events WHERE model_id IN (SELECT id FROM financial_models WHERE organization_id LIKE $1)`, [`${P}%`]);
    await client.query(`DELETE FROM financial_model_versions WHERE model_id IN (SELECT id FROM financial_models WHERE organization_id LIKE $1)`, [`${P}%`]);
    await client.query(`DELETE FROM financial_models WHERE organization_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organization_members WHERE user_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}%`]);
    await client.end();
  });

  // ═══════════════ TEST 1: create -> save -> GET -> reopen, identical ═══════════════
  it('test 1: create -> save assumptions -> GET -> reopen returns identical data', async () => {
    const createRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `${P}case-1`,
        startDate: '2020-01-01',
        currency: 'EUR',
        horizonMonths: 36,
        granularity: 'annual',
        assumptions: { discountRatePct: 10, note: 'initial' },
      });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.data.model.id;
    expect(caseId).toBeTruthy();

    // Save assumptions (PUT).
    const saveRes = await request(app)
      .put(`/api/v8/finance/models/${caseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ assumptions: { discountRatePct: 12, note: 'updated', hurdleRatePct: 15 } });
    expect(saveRes.status).toBe(200);

    // First GET ("close the view").
    const firstGet = await request(app)
      .get(`/api/v8/finance/models/${caseId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(firstGet.status).toBe(200);
    expect(firstGet.body.data.model.assumptions_json).toMatchObject({
      discountRatePct: 12,
      note: 'updated',
      hurdleRatePct: 15,
    });
    const versionAfterSave = firstGet.body.data.model.version;

    // Reopen ("GET the SAME caseId again", a fresh independent request).
    const reopenGet = await request(app)
      .get(`/api/v8/finance/models/${caseId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(reopenGet.status).toBe(200);
    expect(reopenGet.body.data.model.id).toBe(caseId);
    expect(reopenGet.body.data.model.assumptions_json).toEqual(firstGet.body.data.model.assumptions_json);
    expect(reopenGet.body.data.model.version).toBe(versionAfterSave);
    expect(reopenGet.body.data.model.currency).toBe('EUR');
    expect(reopenGet.body.data.model.name).toBe(`${P}case-1`);

    // Raw DB verification — not just trusting the HTTP echo.
    const row = await client.query(
      `SELECT name, currency, assumptions_json FROM financial_models WHERE id=$1`,
      [caseId]
    );
    expect(row.rows[0].name).toBe(`${P}case-1`);
    expect(JSON.parse(row.rows[0].assumptions_json)).toMatchObject({ discountRatePct: 12 });
  });

  // ═══════════════ TEST 2: three scenarios + baseline selection ═══════════════
  let caseRootId: string;
  let scenarioBaseId: string;
  let scenarioUpsideId: string;
  let scenarioDownsideId: string;

  it('test 2: create Base/Upside/Downside scenarios under one case, select a baseline', async () => {
    const rootRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}case-2-root`, startDate: '2021-01-01', currency: 'EUR' });
    expect(rootRes.status).toBe(201);
    caseRootId = rootRes.body.data.model.id;

    const baseRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}scenario-base`, startDate: '2021-01-01', scenario: 'base', caseId: caseRootId });
    expect(baseRes.status).toBe(201);
    scenarioBaseId = baseRes.body.data.model.id;
    expect(baseRes.body.data.model.case_id).toBe(caseRootId);

    const upsideRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `${P}scenario-upside`,
        startDate: '2021-01-01',
        scenario: 'optimistic',
        caseId: caseRootId,
      });
    expect(upsideRes.status).toBe(201);
    scenarioUpsideId = upsideRes.body.data.model.id;

    const downsideRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `${P}scenario-downside`,
        startDate: '2021-01-01',
        scenario: 'conservative',
        caseId: caseRootId,
      });
    expect(downsideRes.status).toBe(201);
    scenarioDownsideId = downsideRes.body.data.model.id;

    // List the case's scenarios.
    const caseRes = await request(app)
      .get(`/api/v8/finance/models/${caseRootId}/case`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(caseRes.status).toBe(200);
    expect(caseRes.body.data.count).toBe(4); // root + 3 scenarios
    expect(caseRes.body.data.baselineModelId).toBeNull(); // none picked yet

    // Pick the Base scenario as baseline.
    const setBaselineRes = await request(app)
      .post(`/api/v8/finance/models/${scenarioBaseId}/set-baseline`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(setBaselineRes.status).toBe(200);
    expect(setBaselineRes.body.data.baselineModelId).toBe(scenarioBaseId);
    expect(setBaselineRes.body.data.previousBaselineModelId).toBeNull();

    const afterPick = await request(app)
      .get(`/api/v8/finance/models/${caseRootId}/case`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(afterPick.body.data.baselineModelId).toBe(scenarioBaseId);
    const flags = (afterPick.body.data.scenarios as Array<{ id: string; is_baseline: boolean }>).map(
      (s) => [s.id, s.is_baseline]
    );
    expect(flags.filter(([, isBase]) => isBase)).toEqual([[scenarioBaseId, true]]);
  });

  // ═══════════════ TEST 3: two-baseline attempt -> atomic demote, exactly one survives ═══════════════
  it('test 3: switching baseline to Upside atomically demotes Base — exactly one baseline survives', async () => {
    const switchRes = await request(app)
      .post(`/api/v8/finance/models/${scenarioUpsideId}/set-baseline`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(switchRes.status).toBe(200);
    expect(switchRes.body.data.previousBaselineModelId).toBe(scenarioBaseId);

    // DB-level invariant: exactly one TRUE row for this case.
    const row = await client.query(
      `SELECT id FROM financial_models WHERE organization_id=$1 AND COALESCE(case_id,id)=$2 AND is_baseline=TRUE`,
      [ORG_A, caseRootId]
    );
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].id).toBe(scenarioUpsideId);

    // Base is now demoted.
    const baseRow = await client.query(`SELECT is_baseline FROM financial_models WHERE id=$1`, [
      scenarioBaseId,
    ]);
    expect(baseRow.rows[0].is_baseline).toBe(false);

    // Audit log recorded who/when/from/to.
    const audit = await client.query(
      `SELECT previous_baseline_model_id, new_baseline_model_id, changed_by FROM financial_model_baseline_audit
       WHERE case_id=$1 ORDER BY changed_at DESC LIMIT 1`,
      [caseRootId]
    );
    expect(audit.rows[0].previous_baseline_model_id).toBe(scenarioBaseId);
    expect(audit.rows[0].new_baseline_model_id).toBe(scenarioUpsideId);
    expect(audit.rows[0].changed_by).toBe(USER_A);

    // Concurrent attempt: race two set-baseline calls for two DIFFERENT
    // scenarios of the SAME case. Both must return 200 (no crash on the
    // unique index), and afterward exactly one baseline survives.
    const [raceA, raceB] = await Promise.all([
      request(app)
        .post(`/api/v8/finance/models/${scenarioBaseId}/set-baseline`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({}),
      request(app)
        .post(`/api/v8/finance/models/${scenarioDownsideId}/set-baseline`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({}),
    ]);
    expect(raceA.status).toBe(200);
    expect(raceB.status).toBe(200);
    const afterRace = await client.query(
      `SELECT id FROM financial_models WHERE organization_id=$1 AND COALESCE(case_id,id)=$2 AND is_baseline=TRUE`,
      [ORG_A, caseRootId]
    );
    expect(afterRace.rows.length).toBe(1); // never zero, never two
    expect([scenarioBaseId, scenarioDownsideId]).toContain(afterRace.rows[0].id); // last committer wins
  });

  // ═══════════════ TEST 4: idempotent retry — no duplicate version/scenario ═══════════════
  it('test 4a: retried create with the same Idempotency-Key does not mint a duplicate scenario', async () => {
    const idemKey = `${P}idem-create-1`;
    const first = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}idem-scenario`, startDate: '2022-01-01', idempotencyKey: idemKey });
    expect(first.status).toBe(201);
    const firstId = first.body.data.model.id;

    const retry = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}idem-scenario`, startDate: '2022-01-01', idempotencyKey: idemKey });
    expect(retry.status).toBe(200); // not 201 — a replay, not a new resource
    expect(retry.body.data.model.id).toBe(firstId);
    expect(retry.body.data.idempotentReplay).toBe(true);

    const count = await client.query(
      `SELECT COUNT(*)::int AS c FROM financial_models WHERE organization_id=$1 AND name=$2`,
      [ORG_A, `${P}idem-scenario`]
    );
    expect(count.rows[0].c).toBe(1); // exactly one row, not two
  });

  it('test 4b: retried approve (save version) with the same Idempotency-Key does not create a duplicate version row', async () => {
    const createRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}idem-approve-model`, startDate: '2022-06-01' });
    const modelId = createRes.body.data.model.id;

    const idemKey = `${P}idem-approve-1`;
    const first = await request(app)
      .post(`/api/v8/finance/models/${modelId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ idempotencyKey: idemKey });
    expect(first.status).toBe(200);

    const retry = await request(app)
      .post(`/api/v8/finance/models/${modelId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ idempotencyKey: idemKey });
    expect(retry.status).toBe(200);
    expect(retry.body.data.idempotentReplay).toBe(true);

    const versions = await client.query(
      `SELECT version FROM financial_model_versions WHERE model_id=$1`,
      [modelId]
    );
    expect(versions.rows.length).toBe(1); // exactly one version row, not two
  });

  // ═══════════════ TEST 5: stale-version / optimistic concurrency ═══════════════
  it('test 5: a stale expectedVersion is rejected 409 VERSION_CONFLICT on both PUT and approve, never overwrites', async () => {
    const createRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}stale-version-model`, startDate: '2023-01-01' });
    const modelId = createRes.body.data.model.id;
    const initial = await client.query(`SELECT version FROM financial_models WHERE id=$1`, [modelId]);
    const v0 = Number(initial.rows[0].version); // 1

    // approve() is the ONLY write path that bumps `version` (updateModel's
    // PUT is a metadata write and deliberately does not — see updateModel's
    // doc comment). Bump it once here so v0 becomes genuinely stale.
    const approveRes = await request(app)
      .post(`/api/v8/finance/models/${modelId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(approveRes.status).toBe(200);
    const afterApprove = await client.query(`SELECT version FROM financial_models WHERE id=$1`, [modelId]);
    const v1 = Number(afterApprove.rows[0].version);
    expect(v1).toBe(v0 + 1);

    // PUT with the now-stale v0 is rejected — does not overwrite.
    const stalePut = await request(app)
      .put(`/api/v8/finance/models/${modelId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}stale-version-model-LOSER`, expectedVersion: v0 });
    expect(stalePut.status).toBe(409);
    expect(stalePut.body.code).toBe('VERSION_CONFLICT');
    expect(stalePut.body.serverVersion).toBe(v1);

    // PUT with the CORRECT current version succeeds.
    const correctPut = await request(app)
      .put(`/api/v8/finance/models/${modelId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}stale-version-model-WINNER`, expectedVersion: v1 });
    expect(correctPut.status).toBe(200);

    const row = await client.query(`SELECT name FROM financial_models WHERE id=$1`, [modelId]);
    expect(row.rows[0].name).toBe(`${P}stale-version-model-WINNER`); // never overwritten by the stale loser

    // Same invariant on a second approve(): a stale expectedVersion is
    // rejected, a correct one succeeds and bumps the version again.
    const staleApprove = await request(app)
      .post(`/api/v8/finance/models/${modelId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: v0 });
    expect(staleApprove.status).toBe(409);
    expect(staleApprove.body.code).toBe('VERSION_CONFLICT');

    const correctApprove = await request(app)
      .post(`/api/v8/finance/models/${modelId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: v1 });
    expect(correctApprove.status).toBe(200);
    const afterSecondApprove = await client.query(`SELECT version FROM financial_models WHERE id=$1`, [
      modelId,
    ]);
    expect(Number(afterSecondApprove.rows[0].version)).toBe(v1 + 1);
  });

  // ═══════════════ TEST 6: cross-tenant rejection ═══════════════
  it('test 6: org B cannot read, write, or set-baseline org A case/scenario/baseline', async () => {
    const getRes = await request(app)
      .get(`/api/v8/finance/models/${caseRootId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getRes.status).toBe(404);
    expect(JSON.stringify(getRes.body)).not.toContain(`${P}case-2-root`);

    const putRes = await request(app)
      .put(`/api/v8/finance/models/${scenarioUpsideId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'B-HIJACKED-NAME' });
    expect(putRes.status).toBe(404);

    const baselineRes = await request(app)
      .post(`/api/v8/finance/models/${scenarioDownsideId}/set-baseline`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(baselineRes.status).toBe(404);

    const caseListRes = await request(app)
      .get(`/api/v8/finance/models/${caseRootId}/case`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(caseListRes.status).toBe(404); // listCaseScenarios returns [] for an org that owns nothing here

    // Nothing changed on org A's side.
    const row = await client.query(`SELECT name FROM financial_models WHERE id=$1`, [scenarioUpsideId]);
    expect(row.rows[0].name).not.toBe('B-HIJACKED-NAME');
  });

  it('test 6b: org B cannot graft a scenario onto org A\'s case via a forged caseId', async () => {
    const forgeRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: `${P}forged-scenario`, startDate: '2021-01-01', caseId: caseRootId });
    expect(forgeRes.status).toBe(400);
    expect(String(forgeRes.body.error)).toMatch(/Investment Case not found/);

    // Org A's case is still exactly its original 4 rows — no forged row grafted on.
    const caseRes = await request(app)
      .get(`/api/v8/finance/models/${caseRootId}/case`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(caseRes.body.data.count).toBe(4);
  });

  // ═══════════════ TEST 7: results recompute correctly after reopen ═══════════════
  it('test 7: NPV/IRR/payback recompute deterministically on reopen, and change when assumptions change', async () => {
    const createRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `${P}recompute-model`,
        startDate: '2020-01-01',
        horizonMonths: 24,
        // NOT 'annual' granularity — see FINDING in the final report:
        // computeModel()'s period-date generation produces NaN period
        // labels/dates for (at least some) annual-granularity horizons,
        // pre-existing and unrelated to this packet's Case/Scenario/Baseline
        // changes (reproduced live: financial_model_events row correctly
        // persisted with the right amount, but computeModel() returned
        // all-zero cashflows and periodLabels ["FYNaN","FYNaN"]). Default
        // 'monthly' granularity (proven working by every approve()-based
        // test above) routes around it.
        assumptions: { discountRatePct: 10 },
      });
    const modelId = createRes.body.data.model.id;

    const event1Res = await request(app)
      .post(`/api/v8/finance/models/${modelId}/events`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        eventType: 'revenue',
        name: 'Uplift',
        amount: 500_000,
        periodStart: '2020-01-01',
        cfClassification: 'operating',
      });
    expect(event1Res.status).toBe(201);

    // "Close and reopen" — call appraisal twice, must be byte-identical
    // (recomputed from stored events each time, not served from a stale cache).
    const firstAppraisal = await request(app)
      .get(`/api/v8/finance/models/${modelId}/appraisal`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(firstAppraisal.status).toBe(200);

    const reopenAppraisal = await request(app)
      .get(`/api/v8/finance/models/${modelId}/appraisal`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(reopenAppraisal.status).toBe(200);
    expect(reopenAppraisal.body.data.result.npv).toBeCloseTo(firstAppraisal.body.data.result.npv, 6);
    expect(reopenAppraisal.body.data.result.irr).toBeCloseTo(firstAppraisal.body.data.result.irr, 6);
    expect(reopenAppraisal.body.data.result.payback).toBeCloseTo(
      firstAppraisal.body.data.result.payback,
      6
    );

    // Prove it is a REAL recompute, not a cache: add another revenue event
    // and confirm the appraisal actually changes.
    await request(app)
      .post(`/api/v8/finance/models/${modelId}/events`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        eventType: 'revenue',
        name: 'Second uplift',
        amount: 300_000,
        periodStart: '2020-01-01',
        cfClassification: 'operating',
      });
    const afterChangeAppraisal = await request(app)
      .get(`/api/v8/finance/models/${modelId}/appraisal`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(afterChangeAppraisal.status).toBe(200);
    expect(afterChangeAppraisal.body.data.result.npv).not.toBeCloseTo(firstAppraisal.body.data.result.npv, 2);
    expect(afterChangeAppraisal.body.data.result.npv).toBeGreaterThan(firstAppraisal.body.data.result.npv);
  });

  // ═══════════════ TEST 8: negative controls — OpEx sign + discount_rate ═══════════════
  it('test 8a: a NEGATIVE opex amount is a SAVING — it RAISES cashflow/NPV, never lowers it — regression guard for the FIN-005 sign fix', async () => {
    // Uses the SAME appraisal path as test 7 (computeModel -> appraiseComputeResult),
    // not POST /compute + GET /outputs — that path hits an unrelated, pre-existing
    // "invalid input syntax for type date: NaN-NaN-01" bug in persistComputeResult
    // for this model's exact granularity/horizon combo (reproduced while building
    // this suite; reported as a finding, out of scope for this packet — see final
    // report). The appraisal endpoint calls computeModel() directly with no
    // persistence step, so it is unaffected and is also the ACTUAL golden-flow
    // path ("compute NPV/IRR/payback"), making it the more faithful regression
    // guard for the sign convention anyway.
    const createRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `${P}opex-sign-model`,
        startDate: '2020-01-01',
        horizonMonths: 12, // default 'monthly' granularity — see the FINDING note on test 7
        assumptions: { discountRatePct: 10 },
      });
    const modelId = createRes.body.data.model.id;

    await request(app)
      .post(`/api/v8/finance/models/${modelId}/events`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        eventType: 'revenue',
        name: 'Base revenue',
        amount: 200_000,
        periodStart: '2020-01-01',
        cfClassification: 'operating',
      });

    const beforeSaving = await request(app)
      .get(`/api/v8/finance/models/${modelId}/appraisal`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(beforeSaving.status).toBe(200);

    await request(app)
      .post(`/api/v8/finance/models/${modelId}/events`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        eventType: 'opex',
        name: 'OpEx reduction (automation)',
        amount: -50_000, // negative = a SAVING, per financialModelingService.ts's documented convention
        periodStart: '2020-01-01',
        cfClassification: 'operating',
      });

    const afterSaving = await request(app)
      .get(`/api/v8/finance/models/${modelId}/appraisal`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(afterSaving.status).toBe(200);

    // If the pre-FIN-005 Math.abs() bug ever regressed, a "saving" would be
    // treated as an ordinary COST and LOWER the NPV instead of raising it.
    expect(afterSaving.body.data.result.npv).toBeGreaterThan(beforeSaving.body.data.result.npv);
    expect(afterSaving.body.data.input.cashflows[0]).toBeCloseTo(
      beforeSaving.body.data.input.cashflows[0] + 50_000,
      0
    );
  });

  it('test 8b: discountRatePct is NEVER silently defaulted — appraisal fails closed with 400 when no rate is available anywhere', async () => {
    const createRes = await request(app)
      .post('/api/v8/finance/models')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `${P}no-rate-model`, startDate: '2020-01-01' }); // no assumptions.discountRatePct
    const modelId = createRes.body.data.model.id;

    const res = await request(app)
      .get(`/api/v8/finance/models/${modelId}/appraisal`)
      .set('Authorization', `Bearer ${tokenA}`); // no ?discountRatePct= query param either
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/discountRatePct is required/);
  });

  // ═══════════════ HARNESS SAFETY PROOF ═══════════════
  it('harness guard: a non-local DATABASE_URL is refused loudly, never silently skipped', () => {
    const original = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgres://user:pass@trolley.proxy.rlwy.net:28146/railway';
      expect(() => requireLocalDbUrl()).toThrow(/LOCAL DATABASE_URL/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
});
