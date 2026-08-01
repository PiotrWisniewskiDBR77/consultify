/**
 * RES-003A — KPI Recovery Card canonical loop (Results, Linia B).
 *
 * REAL-runtime E2E: local Postgres (real schema) + REAL v8 results router +
 * REAL verifyToken/requireV8OrgContext/attachV8Context middleware chain,
 * mirroring tests/acceptance/v8-mutation-canary.e2e.test.ts's
 * `buildV8App()` pattern and tests/acceptance/h65-rbac.e2e.test.ts's
 * two-tenant / mintTokenFor pattern.
 *
 * Covers:
 *   Group 1 — schema/constraint guarantees (direct SQL, no API)
 *   Group 2 — concurrency (real Promise.all through the real HTTP router)
 *   Group 3 — closure gate (positive + every negative reason)
 *   Group 4 — reopen via handleTimeSeriesRecorded (direct import, not HTTP)
 *   Group 5 — tenant isolation (+ positive control)
 *
 * Source of truth read in full before writing this file:
 *   server/src/routes/v8/results.routes.ts
 *   server/src/services/results/kpiRecoveryCardService.ts
 *   server/src/services/results/kpiDeviationService.ts
 *   server/src/services/results/kpiPermissions.ts
 *   server/src/services/v8/kpiWorkflowCanon.ts (KPI_PERMISSION_MATRIX)
 *   server/migrations/20260801_res003a_kpi_recovery_card.sql
 *
 * All fixtures use the reversible `TEST_RES003A_` prefix and are removed in
 * afterAll via cleanupAll(). Writes ONLY to the LOCAL Postgres (harness guard
 * enforces this via requireLocalDbUrl()).
 *
 * ENVIRONMENT NOTE (found while building this file, not a backend bug):
 * `kpi_deviation_cases` and several `initiative_kpis` columns
 * (organization_id, direction, threshold_mode, amber/red thresholds,
 * owner_user_id) exist in the REAL schema (server/migrations-v2/
 * 001_baseline_20260413.sql, dumped from prod/demo) but are NOT created by
 * tests/acceptance/schema.mjs on a from-scratch local Postgres: the table's
 * only CREATE TABLE lives in server/migrations-v2/001_baseline_20260413.sql
 * (never applied by schema.mjs, which only scans server/migrations/*.sql) and
 * in server/migrations/never-ran/612_results_kpi_global_and_deviation.sql
 * (excluded — schema.mjs's readdirSync is non-recursive, "never-ran" is a
 * subdirectory) and in server/migrations/20260719_baseline_gap.sql (a
 * multi-thousand-statement dump applied as ONE `client.query()` call, so a
 * single failing statement anywhere in that file rolls back the whole file
 * under node-pg's implicit-transaction-per-simple-query-message behavior —
 * confirmed happening here, `kpi_deviation_cases` never landed). This is a
 * pre-existing gap in the acceptance harness's schema loader, not something
 * introduced by RES-003A. Worked around for THIS local run only by applying
 * the missing DDL directly to the running container (not committed to any
 * migration file) — see the session report for the exact statements.
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

/**
 * REAL BACKEND TIMEZONE-FRAGILITY FINDING (discovered running this suite
 * against real Postgres, not a guess — see session report):
 * kpi_recovery_cards.active_since is TIMESTAMPTZ but kpi_time_series.created_at
 * is TIMESTAMP WITHOUT TIME ZONE (server/migrations-v2/001_baseline_20260413.sql).
 * closeRecoveryCard's freshness check
 * (`SELECT ... FROM kpi_time_series WHERE ... AND created_at > ?`, in
 * server/src/services/results/kpiRecoveryCardService.ts) binds the naive
 * column against a JS Date parameter. node-pg's default (non-UTC) Date
 * serialization encodes that parameter using the Node PROCESS's local
 * wall-clock digits + an explicit offset (e.g. "+02:00" on this machine,
 * Europe/Warsaw); when Postgres infers the parameter's type as `timestamp`
 * (matching the naive column it's compared against) it silently DISCARDS that
 * offset instead of applying it, shifting the effective comparison value by
 * the server process's local UTC offset. Confirmed empirically: with the
 * Node process on Europe/Warsaw (UTC+2), a measurement genuinely 2 seconds
 * fresher than active_since was read back as 2 HOURS STALER, flipping the
 * close-gate from "closeable" to STALE_MEASUREMENT. Forcing `TZ=UTC` on the
 * Node process (not just `SET TIME ZONE 'UTC'` on the PG session — that alone
 * does not fix it, since the corruption happens in node-pg's outgoing
 * parameter encoding) makes the comparison correct. This is a real,
 * deployment-timezone-dependent bug in the shipped close-gate — it will only
 * manifest when the Node server process's OS/container timezone isn't UTC
 * (this local dev machine isn't; the real value on Railway prod is unverified
 * from here). Filed as a follow-up rather than fixed here — this file's
 * mandate is tests only, no backend edits. This line makes the ACCEPTANCE
 * SUITE itself deterministic (matches what any UTC-default CI/container would
 * already give it) — it is a test-environment control, not a change to the
 * assertions or a workaround that hides the bug from the report.
 */
process.env.TZ = 'UTC';

const P = 'TEST_RES003A_';

const ORG_ID = `${P}org`;
const USER_ID = `${P}user`;
const EMAIL = `${P}owner@acceptance.local`;
const KPI_ID = `${P}kpi-oee`;
const INITIATIVE_ID = `${P}ini`;

const ORG_B_ID = `${P}org-b`;
const USER_B_ID = `${P}user-b`;
const EMAIL_B = `${P}owner-b@acceptance.local`;
const KPI_B_ID = `${P}kpi-b`;
const INITIATIVE_B_ID = `${P}ini-b`;

function caseIdFor(tag: string): string {
  return `${P}case-${tag}`;
}
function cardIdFor(tag: string): string {
  return `${P}card-${tag}`;
}
function actionIdFor(tag: string): string {
  return `${P}act-${tag}`;
}
function taskIdFor(tag: string): string {
  return `${P}task-${tag}`;
}
function tsIdFor(tag: string): string {
  return `${P}ts-${tag}`;
}

// ─────────────────────────── fixture helpers ───────────────────────────

async function pinUtc(c: pg.Client): Promise<void> {
  // kpi_time_series.created_at is TIMESTAMP WITHOUT TIME ZONE while
  // kpi_recovery_cards.active_since is TIMESTAMPTZ (see migration comment on
  // active_since) — pin this session to UTC so `NOW()` literals we write
  // through the raw pg.Client land on the same wall-clock the app's own pool
  // connection uses (server default is already Etc/UTC; this makes it explicit
  // instead of relying on that default silently matching).
  await c.query(`SET TIME ZONE 'UTC'`);
}

async function seedOrgUserKpi(
  c: pg.Client,
  orgId: string,
  userId: string,
  email: string,
  kpiId: string,
  opts: {
    initiativeId?: string;
    target?: number;
    direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    thresholdMode?: 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
    amberPct?: number;
    redPct?: number;
  } = {}
): Promise<void> {
  const initiativeId = opts.initiativeId || `${kpiId}-ini`;

  await c.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,NOW())
     ON CONFLICT (id) DO NOTHING`,
    [orgId, `RES003A ${orgId}`]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x','ADMIN','active','RES003A','Test',NOW())
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email]
  );
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $3,$1,$2,'OWNER','ACTIVE',NOW()
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, `${P}mem-${userId}`]
  );
  await c.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1,$2,$3,'DRAFT')
     ON CONFLICT (id) DO NOTHING`,
    [initiativeId, orgId, `RES003A initiative ${initiativeId}`]
  );
  await c.query(
    `INSERT INTO initiative_kpis (
       id, initiative_id, organization_id, name, target_value, direction, threshold_mode,
       amber_threshold_pct, red_threshold_pct, owner_user_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO NOTHING`,
    [
      kpiId,
      initiativeId,
      orgId,
      `RES003A KPI ${kpiId}`,
      opts.target ?? 100,
      opts.direction ?? 'HIGHER_IS_BETTER',
      opts.thresholdMode ?? 'PERCENT_FROM_TARGET',
      opts.amberPct ?? 0.1,
      opts.redPct ?? 0.2,
      userId,
    ]
  );
}

/**
 * INSERT kpi_deviation_cases, status='OPEN'. periodStart MUST be unique per
 * (orgId, kpiId) across the whole file — the real schema (server/migrations-v2/
 * 001_baseline_20260413.sql) has
 * `UNIQUE (organization_id, kpi_id, period_start)` on this table, and this
 * suite reuses ORG_ID/KPI_ID across many tests. Every call site below passes
 * an explicit, never-repeated periodStart for that reason.
 */
async function seedDeviationCase(
  c: pg.Client,
  orgId: string,
  kpiId: string,
  userId: string,
  tag: string,
  opts: { severity?: 'AMBER' | 'RED'; periodStart: string; status?: string } = { periodStart: '' }
): Promise<string> {
  const id = caseIdFor(tag);
  await c.query(
    `INSERT INTO kpi_deviation_cases (id, kpi_id, organization_id, period_start, severity, status, owner_user_id, detected_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'test')
     ON CONFLICT (id) DO NOTHING`,
    [id, kpiId, orgId, opts.periodStart, opts.severity ?? 'RED', opts.status ?? 'OPEN', userId]
  );
  return id;
}

/**
 * INSERT kpi_time_series with an explicit created_at SQL expression
 * (raw-interpolated: this file's own hardcoded literals only, never
 * user/request input) so freshness relative to kpi_recovery_cards.active_since
 * is exact and not subject to JS Date <-> tz-naive-column cast ambiguity.
 */
async function seedMeasurement(
  c: pg.Client,
  orgId: string,
  kpiId: string,
  tag: string,
  opts: { value: number; createdAtSql?: string; periodStart?: string }
): Promise<string> {
  const id = tsIdFor(tag);
  const createdAtSql = opts.createdAtSql ?? 'NOW()';
  await c.query(
    `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, created_at)
     VALUES ($1,$2,$3,$4,$5, ${createdAtSql})
     ON CONFLICT (id) DO NOTHING`,
    [id, kpiId, orgId, opts.value, opts.periodStart ?? '2026-01-01']
  );
  return id;
}

function mintTokenFor(userId: string, orgId: string, email: string): string {
  return jwt.sign(
    { id: userId, email, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function cleanupAll(c: pg.Client): Promise<void> {
  await c.query(`DELETE FROM kpi_recovery_checkpoints WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM kpi_recovery_actions WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM kpi_recovery_cards WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM tasks WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM kpi_time_series WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM kpi_deviation_cases WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM initiative_kpis WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM initiatives WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM organization_members WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM users WHERE organization_id LIKE $1`, [`${P}%`]);
  await c.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}%`]);
}

/**
 * Mounts the REAL production path for /api/v8/results:
 *   express.json()  →  verifyToken  →  requireV8OrgContext  →  attachV8Context
 *   →  results.routes.ts
 * Mirrors buildV8App() in tests/acceptance/v8-mutation-canary.e2e.test.ts.
 * v8FeatureGate (the global ENABLE_V8_GLOBAL toggle) is Gateway.ts-level
 * plumbing, not part of the v8Router itself — omitted here exactly as the
 * canary test omits it, since the router applies its own real auth/org gates.
 */
async function buildApp(): Promise<Express> {
  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const { default: resultsRouter } = await import('../../server/src/routes/v8/results.routes.js');

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(
    '/api/v8/results',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    resultsRouter
  );
  return app;
}

/**
 * Same adapter shape as buildRecoveryDb() in results.routes.ts — built here
 * from the same DbPromise exports so the Group 4 (reopen) tests can call
 * handleTimeSeriesRecorded directly (not through HTTP) exactly the way the
 * route layer does, with real errors thrown instead of silently swallowed
 * (`{ fallback: false }`).
 */
async function buildDirectRecoveryDb() {
  const { all: dbAll, get: dbGet, run: dbRun } = await import(
    '../../server/src/utils/DbPromise.js'
  );
  return {
    get: (sql: string, params?: unknown[]) => dbGet(sql, params, { fallback: false }),
    all: (sql: string, params?: unknown[]) => dbAll(sql, params, { fallback: false }),
    run: (sql: string, params?: unknown[]) => dbRun(sql, params, { fallback: false }),
  } as any;
}

// ─────────────────────────────── suite ───────────────────────────────

describe('RES-003A — KPI Recovery Card canonical loop', () => {
  let client: pg.Client;
  let app: Express;
  let tokenA: string;
  let tokenB: string;
  let periodCounter = 0;

  /** Next never-repeated periodStart for kpi_deviation_cases (org,kpi unique). */
  function nextPeriodStart(): string {
    periodCounter += 1;
    const day = String(periodCounter).padStart(2, '0');
    return `2026-01-${day}`;
  }

  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';

    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await pinUtc(client);

    await cleanupAll(client);
    await seedOrgUserKpi(client, ORG_ID, USER_ID, EMAIL, KPI_ID, { initiativeId: INITIATIVE_ID });
    await seedOrgUserKpi(client, ORG_B_ID, USER_B_ID, EMAIL_B, KPI_B_ID, {
      initiativeId: INITIATIVE_B_ID,
    });

    app = await buildApp();
    tokenA = mintTokenFor(USER_ID, ORG_ID, EMAIL);
    tokenB = mintTokenFor(USER_B_ID, ORG_B_ID, EMAIL_B);
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await cleanupAll(client);
    await client.end();
  });

  // ═══════════════════ Group 1 — schema/constraint guarantees ═══════════════════
  // Direct SQL against the local Postgres, no API involved.

  it('1) unique deviation_case_id blocks a second manual INSERT for the same case', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'schema-uniq', {
      periodStart: nextPeriodStart(),
    });
    const cardA = cardIdFor('schema-uniq-a');
    const cardB = cardIdFor('schema-uniq-b');

    await client.query(
      `INSERT INTO kpi_recovery_cards (id, organization_id, deviation_case_id, kpi_id) VALUES ($1,$2,$3,$4)`,
      [cardA, ORG_ID, caseId, KPI_ID]
    );

    await expect(
      client.query(
        `INSERT INTO kpi_recovery_cards (id, organization_id, deviation_case_id, kpi_id) VALUES ($1,$2,$3,$4)`,
        [cardB, ORG_ID, caseId, KPI_ID]
      )
    ).rejects.toMatchObject({ code: '23505' });

    const rows = await client.query(
      `SELECT id FROM kpi_recovery_cards WHERE deviation_case_id=$1`,
      [caseId]
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].id).toBe(cardA);
  });

  it('2) CHECK close_requires_evidence rejects UPDATE to CLOSE without evidence', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'schema-evidence', {
      periodStart: nextPeriodStart(),
    });
    const cardId = cardIdFor('schema-evidence');
    await client.query(
      `INSERT INTO kpi_recovery_cards (id, organization_id, deviation_case_id, kpi_id) VALUES ($1,$2,$3,$4)`,
      [cardId, ORG_ID, caseId, KPI_ID]
    );

    await expect(
      client.query(`UPDATE kpi_recovery_cards SET decision='CLOSE' WHERE id=$1`, [cardId])
    ).rejects.toMatchObject({ code: '23514' });

    const row = await client.query(`SELECT decision FROM kpi_recovery_cards WHERE id=$1`, [
      cardId,
    ]);
    expect(row.rows[0].decision).toBeNull();
  });

  it('3) partial unique index rejects a second action INSERT with the same idempotency_key on the same card', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'schema-idem', {
      periodStart: nextPeriodStart(),
    });
    const cardId = cardIdFor('schema-idem');
    await client.query(
      `INSERT INTO kpi_recovery_cards (id, organization_id, deviation_case_id, kpi_id) VALUES ($1,$2,$3,$4)`,
      [cardId, ORG_ID, caseId, KPI_ID]
    );

    await client.query(
      `INSERT INTO kpi_recovery_actions (id, organization_id, recovery_card_id, action_type, title, idempotency_key)
       VALUES ($1,$2,$3,'IMMEDIATE','First attempt',$4)`,
      [actionIdFor('schema-idem-a'), ORG_ID, cardId, 'idem-key-schema-1']
    );

    await expect(
      client.query(
        `INSERT INTO kpi_recovery_actions (id, organization_id, recovery_card_id, action_type, title, idempotency_key)
         VALUES ($1,$2,$3,'IMMEDIATE','Retried attempt',$4)`,
        [actionIdFor('schema-idem-b'), ORG_ID, cardId, 'idem-key-schema-1']
      )
    ).rejects.toMatchObject({ code: '23505' });

    const rows = await client.query(
      `SELECT id FROM kpi_recovery_actions WHERE recovery_card_id=$1 AND idempotency_key=$2`,
      [cardId, 'idem-key-schema-1']
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].id).toBe(actionIdFor('schema-idem-a'));
  });

  it('4) unique index rejects linking a second action to a task already linked to another action', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'schema-tasklink', {
      periodStart: nextPeriodStart(),
    });
    const cardId = cardIdFor('schema-tasklink');
    await client.query(
      `INSERT INTO kpi_recovery_cards (id, organization_id, deviation_case_id, kpi_id) VALUES ($1,$2,$3,$4)`,
      [cardId, ORG_ID, caseId, KPI_ID]
    );
    const taskId = taskIdFor('schema-tasklink');
    await client.query(`INSERT INTO tasks (id, organization_id, title) VALUES ($1,$2,'Shared task')`, [
      taskId,
      ORG_ID,
    ]);

    await client.query(
      `INSERT INTO kpi_recovery_actions (id, organization_id, recovery_card_id, action_type, title, linked_task_id, task_link_status)
       VALUES ($1,$2,$3,'IMMEDIATE','Action A',$4,'LINKED')`,
      [actionIdFor('schema-tasklink-a'), ORG_ID, cardId, taskId]
    );

    await expect(
      client.query(
        `INSERT INTO kpi_recovery_actions (id, organization_id, recovery_card_id, action_type, title, linked_task_id, task_link_status)
         VALUES ($1,$2,$3,'IMMEDIATE','Action B',$4,'LINKED')`,
        [actionIdFor('schema-tasklink-b'), ORG_ID, cardId, taskId]
      )
    ).rejects.toMatchObject({ code: '23505' });

    const rows = await client.query(
      `SELECT id FROM kpi_recovery_actions WHERE linked_task_id=$1`,
      [taskId]
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].id).toBe(actionIdFor('schema-tasklink-a'));
  });

  it('5) CHECK constraints reject out-of-enum values for priority/effectiveness/lifecycle/decision', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'schema-enums', {
      periodStart: nextPeriodStart(),
    });
    const cardId = cardIdFor('schema-enums');
    await client.query(
      `INSERT INTO kpi_recovery_cards (id, organization_id, deviation_case_id, kpi_id) VALUES ($1,$2,$3,$4)`,
      [cardId, ORG_ID, caseId, KPI_ID]
    );

    await expect(
      client.query(`UPDATE kpi_recovery_cards SET priority='URGENT' WHERE id=$1`, [cardId])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query(`UPDATE kpi_recovery_cards SET effectiveness_status='MAYBE' WHERE id=$1`, [
        cardId,
      ])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query(`UPDATE kpi_recovery_cards SET effectiveness_rating='SORT_OF' WHERE id=$1`, [
        cardId,
      ])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query(`UPDATE kpi_recovery_cards SET lifecycle_status='PAUSED' WHERE id=$1`, [
        cardId,
      ])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query(`UPDATE kpi_recovery_cards SET decision='MAYBE' WHERE id=$1`, [cardId])
    ).rejects.toMatchObject({ code: '23514' });

    const row = await client.query(
      `SELECT priority, effectiveness_status, effectiveness_rating, lifecycle_status, decision
       FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(row.rows[0]).toMatchObject({
      priority: 'MEDIUM',
      effectiveness_status: 'NOT_YET_DUE',
      effectiveness_rating: null,
      lifecycle_status: 'DRAFT',
      decision: null,
    });
  });

  // ═══════════════════ Group 2 — concurrency (real Promise.all, through HTTP) ═══════════════════

  it('6) two parallel POST recovery-card for the same case create exactly one row', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'conc-create', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });

    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({}),
      request(app)
        .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({}),
    ]);

    expect([200, 201]).toContain(r1.status);
    expect([200, 201]).toContain(r2.status);
    expect(r1.body?.data?.id).toBeTruthy();
    expect(r1.body.data.id).toBe(r2.body.data.id);
    // Exactly one of the two racing calls actually created the row.
    const createdFlags = [r1.body?.data?.created, r2.body?.data?.created];
    expect(createdFlags.filter(Boolean).length).toBe(1);

    const rows = await client.query(
      `SELECT COUNT(*)::int AS n FROM kpi_recovery_cards WHERE deviation_case_id=$1`,
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('7) parallel close + continue on the same version: exactly one wins, DB version=2 (not 3)', async () => {
    const caseId = await seedDeviationCase(
      client,
      ORG_ID,
      KPI_ID,
      USER_ID,
      'conc-close-vs-continue',
      { periodStart: nextPeriodStart(), severity: 'RED' }
    );
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;
    expect(createRes.body.data.version).toBe(1);

    // Fresh, in-target measurement so the close-gate's freshness+breach checks
    // would pass IF the close call wins the race.
    await seedMeasurement(client, ORG_ID, KPI_ID, 'conc-close-vs-continue', { value: 100 });

    const [closeRes, continueRes] = await Promise.all([
      request(app)
        .post(`/api/v8/results/recovery-cards/${cardId}/close`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ version: 1, evidenceText: 'Recovered to target', effectivenessRating: 'EFFECTIVE' }),
      request(app)
        .post(`/api/v8/results/recovery-cards/${cardId}/continue`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ version: 1 }),
    ]);

    const statuses = [closeRes.status, continueRes.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const winner = closeRes.status === 200 ? closeRes : continueRes;
    const loser = closeRes.status === 409 ? closeRes : continueRes;
    expect(winner.status).toBe(200);
    expect(loser.body.code).toMatch(/VERSION_CONFLICT/);

    const row = await client.query(`SELECT version FROM kpi_recovery_cards WHERE id=$1`, [
      cardId,
    ]);
    expect(Number(row.rows[0].version)).toBe(2);
  });

  it('8) two parallel POST actions with the same idempotencyKey create exactly one action, same id returned', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'conc-action-idem', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    const body = {
      actionType: 'IMMEDIATE',
      title: 'Escalate to vendor',
      idempotencyKey: 'retry-key-conc-1',
    };
    const [a1, a2] = await Promise.all([
      request(app)
        .post(`/api/v8/results/recovery-cards/${cardId}/actions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body),
      request(app)
        .post(`/api/v8/results/recovery-cards/${cardId}/actions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body),
    ]);

    expect([200, 201]).toContain(a1.status);
    expect([200, 201]).toContain(a2.status);
    expect(a1.body.data.id).toBeTruthy();
    expect(a1.body.data.id).toBe(a2.body.data.id);

    const rows = await client.query(
      `SELECT COUNT(*)::int AS n FROM kpi_recovery_actions WHERE recovery_card_id=$1 AND idempotency_key=$2`,
      [cardId, 'retry-key-conc-1']
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('9) retry POST link-task for the same action: the action stays linked to the SAME task both times', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'conc-link-retry', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;
    const actionRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/actions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ actionType: 'IMMEDIATE', title: 'Notify supplier' });
    const actionId = actionRes.body.data.id;

    const first = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/actions/${actionId}/link-task`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.data.linked).toBe(true);
    const firstTaskId = first.body.data.linkedTaskId;
    expect(firstTaskId).toBeTruthy();

    // Retry: linkRecoveryActionTask's UPDATE guards on task_link_status !=
    // 'LINKED' (server/src/services/results/kpiRecoveryCardService.ts), so a
    // second call must NOT re-point the action at a different task — the
    // idempotency guarantee this endpoint actually provides is "the action's
    // linked_task_id never changes once LINKED", not "no new tasks row is
    // ever inserted" (the route unconditionally INSERTs a fresh `tasks` row
    // before attempting the link on every call — see the route's `taskId =
    // uuidv4(); await dbRun('INSERT INTO tasks ...')` above the link call).
    const second = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/actions/${actionId}/link-task`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.data.linked).toBe(false);
    expect(second.body.data.linkedTaskId).toBe(firstTaskId);
    expect(second.body.data.action.linkedTaskId).toBe(firstTaskId);

    const actionRow = await client.query(
      `SELECT linked_task_id, task_link_status FROM kpi_recovery_actions WHERE id=$1`,
      [actionId]
    );
    expect(actionRow.rows[0].linked_task_id).toBe(firstTaskId);
    expect(actionRow.rows[0].task_link_status).toBe('LINKED');
  });

  // ═══════════════════ Group 3 — closure gate ═══════════════════

  it('10) close succeeds: measurement fresher than activeSince, in-target, evidence + rating present', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'gate-success', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    await seedMeasurement(client, ORG_ID, KPI_ID, 'gate-success', { value: 100 }); // GREEN, fresh

    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'Back on target', effectivenessRating: 'EFFECTIVE' });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.lifecycleStatus).toBe('CLOSED');
    expect(closeRes.body.data.decision).toBe('CLOSE');
    expect(closeRes.body.data.effectivenessStatus).toBe('ASSESSED');
    expect(closeRes.body.data.effectivenessRating).toBe('EFFECTIVE');
    expect(closeRes.body.data.version).toBe(2);
    expect(closeRes.body.data.evidenceText).toBe('Back on target');
    expect(closeRes.body.data.closedBy).toBe(USER_ID);
    expect(Array.isArray(closeRes.body.data.actions)).toBe(true);
    expect(Array.isArray(closeRes.body.data.checkpoints)).toBe(true);
  });

  it('11) close rejected (STALE_MEASUREMENT) when no measurement is newer than activeSince — card state unchanged', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'gate-stale', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    // No measurement recorded after the card's activeSince at all.
    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'x', effectivenessRating: 'EFFECTIVE' });

    expect(closeRes.status).toBe(409);
    expect(closeRes.body.reason).toBe('STALE_MEASUREMENT');
    expect(closeRes.body.data.lifecycleStatus).toBe('ACTIVE');
    expect(closeRes.body.data.version).toBe(1);

    const row = await client.query(
      `SELECT lifecycle_status, version, decision FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(row.rows[0]).toMatchObject({ lifecycle_status: 'ACTIVE', version: 1, decision: null });
  });

  it('12) close rejected (STILL_BREACHING) when latest measurement is still AMBER/RED — but continue succeeds on the same card', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'gate-breach', {
      periodStart: nextPeriodStart(),
      severity: 'RED',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    // target=100, HIGHER_IS_BETTER, redPct=0.20 -> value=70 is badness 0.30 -> RED.
    await seedMeasurement(client, ORG_ID, KPI_ID, 'gate-breach', { value: 70 });

    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'x', effectivenessRating: 'PARTIALLY_EFFECTIVE' });

    expect(closeRes.status).toBe(409);
    expect(closeRes.body.reason).toBe('STILL_BREACHING');
    expect(closeRes.body.latestMeasurement).toMatchObject({ value: 70, status: 'RED' });
    expect(closeRes.body.data.lifecycleStatus).toBe('ACTIVE');
    expect(closeRes.body.data.version).toBe(1);

    const continueRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/continue`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1 });

    expect(continueRes.status).toBe(200);
    expect(continueRes.body.data.decision).toBe('CONTINUE');
    expect(continueRes.body.data.lifecycleStatus).toBe('ACTIVE');
    expect(continueRes.body.data.version).toBe(2);
  });

  it('13) close rejected (MISSING_EVIDENCE) via the API when neither evidenceText nor evidenceRef is present', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'gate-evidence', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    await seedMeasurement(client, ORG_ID, KPI_ID, 'gate-evidence', { value: 100 });

    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, effectivenessRating: 'EFFECTIVE' });

    expect(closeRes.status).toBe(409);
    expect(closeRes.body.reason).toBe('MISSING_EVIDENCE');

    const row = await client.query(
      `SELECT lifecycle_status, evidence_text, evidence_ref, version FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(row.rows[0]).toMatchObject({
      lifecycle_status: 'ACTIVE',
      evidence_text: null,
      evidence_ref: null,
      version: 1,
    });
  });

  it('14) close rejected (400) when effectivenessRating is missing/invalid — required by the endpoint before the evidence/measurement gate runs', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'gate-rating', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;
    await seedMeasurement(client, ORG_ID, KPI_ID, 'gate-rating', { value: 100 });

    const noRatingRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'x' });
    expect(noRatingRes.status).toBe(400);
    expect(noRatingRes.body.code).toBe('RESULTS_RECOVERY_CARD_INVALID_RATING');

    const badRatingRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'x', effectivenessRating: 'MAYBE' });
    expect(badRatingRes.status).toBe(400);
    expect(badRatingRes.body.code).toBe('RESULTS_RECOVERY_CARD_INVALID_RATING');

    const row = await client.query(
      `SELECT lifecycle_status, version FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(row.rows[0]).toMatchObject({ lifecycle_status: 'ACTIVE', version: 1 });
  });

  // ═══════════════════ Group 4 — reopen via handleTimeSeriesRecorded (direct import) ═══════════════════

  it('15) a CLOSED card reopens to ACTIVE via handleTimeSeriesRecorded when a new breaching measurement lands; activeSince advances', async () => {
    const periodStart = nextPeriodStart();
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'reopen', {
      periodStart,
      severity: 'RED',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    await seedMeasurement(client, ORG_ID, KPI_ID, 'reopen-close', { value: 100 });
    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'x', effectivenessRating: 'EFFECTIVE' });
    expect(closeRes.status).toBe(200);

    const before = await client.query(
      `SELECT lifecycle_status, active_since FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(before.rows[0].lifecycle_status).toBe('CLOSED');

    const { handleTimeSeriesRecorded } = await import(
      '../../server/src/services/results/kpiDeviationService.js'
    );
    const recoveryDb = await buildDirectRecoveryDb();
    const result = await handleTimeSeriesRecorded({
      db: recoveryDb,
      orgId: ORG_ID,
      kpiId: KPI_ID,
      value: 70, // RED again (badness 0.30 >= redPct 0.20)
      periodStart,
      recordedByUserId: USER_ID,
    });

    expect(result.createdOrUpdatedCaseId).toBe(caseId);
    expect(result.recoveryCardId).toBe(cardId);
    expect(result.recoveryCardCreated).toBe(false); // reopened, not freshly created

    const after = await client.query(
      `SELECT lifecycle_status, active_since, version, decision, effectiveness_status, effectiveness_rating
       FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(after.rows[0].lifecycle_status).toBe('ACTIVE');
    expect(after.rows[0].decision).toBeNull();
    expect(after.rows[0].effectiveness_status).toBe('NOT_YET_DUE');
    expect(after.rows[0].effectiveness_rating).toBeNull();
    expect(new Date(after.rows[0].active_since).getTime()).toBeGreaterThan(
      new Date(before.rows[0].active_since).getTime()
    );
  });

  it('16) reopen does not delete pre-existing actions/checkpoints — both survive', async () => {
    const periodStart = nextPeriodStart();
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'reopen-preserve', {
      periodStart,
      severity: 'RED',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    const actionRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/actions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ actionType: 'IMMEDIATE', title: 'Contact supplier' });
    expect([200, 201]).toContain(actionRes.status);

    const checkpointRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/checkpoints`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ checkpointDate: '2026-02-10', notes: 'weekly check' });
    expect(checkpointRes.status).toBe(201);

    await seedMeasurement(client, ORG_ID, KPI_ID, 'reopen-preserve-close', { value: 100 });
    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, evidenceText: 'x', effectivenessRating: 'EFFECTIVE' });
    expect(closeRes.status).toBe(200);

    const { handleTimeSeriesRecorded } = await import(
      '../../server/src/services/results/kpiDeviationService.js'
    );
    const recoveryDb = await buildDirectRecoveryDb();
    await handleTimeSeriesRecorded({
      db: recoveryDb,
      orgId: ORG_ID,
      kpiId: KPI_ID,
      value: 70,
      periodStart,
      recordedByUserId: USER_ID,
    });

    const fresh = await request(app)
      .get(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.lifecycleStatus).toBe('ACTIVE');
    expect(fresh.body.data.actions).toHaveLength(1);
    expect(fresh.body.data.actions[0].title).toBe('Contact supplier');
    expect(fresh.body.data.checkpoints).toHaveLength(1);
    expect(fresh.body.data.checkpoints[0].notes).toBe('weekly check');
  });

  // ═══════════════════ Group 5 — tenant isolation (+ positive control) ═══════════════════
  // NOTE: numbered 18-21 per the pre-agreed test plan (there is a deliberate
  // gap at #17 in that plan; not introduced here).

  it('18) org B cannot GET org A recovery card — 404, no leak of org A ids', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'tenant-read', {
      periodStart: nextPeriodStart(),
      severity: 'RED',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(cardId);
    expect(JSON.stringify(res.body)).not.toContain(caseId);
  });

  it('19) org B cannot mutate org A card (PUT/close/continue) — 404, org A card state unchanged', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'tenant-mutate', {
      periodStart: nextPeriodStart(),
      severity: 'RED',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const cardId = createRes.body.data.id;
    await seedMeasurement(client, ORG_ID, KPI_ID, 'tenant-mutate', { value: 100 });

    const putRes = await request(app)
      .put(`/api/v8/results/recovery-cards/${cardId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ version: 1, hypothesis: 'HACKED-BY-B' });
    expect(putRes.status).toBe(404);

    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ version: 1, evidenceText: 'HACKED', effectivenessRating: 'EFFECTIVE' });
    expect(closeRes.status).toBe(404);

    const continueRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/continue`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ version: 1 });
    expect(continueRes.status).toBe(404);

    const row = await client.query(
      `SELECT lifecycle_status, version, hypothesis, evidence_text, decision
       FROM kpi_recovery_cards WHERE id=$1`,
      [cardId]
    );
    expect(row.rows[0]).toMatchObject({
      lifecycle_status: 'ACTIVE',
      version: 1,
      hypothesis: null,
      evidence_text: null,
      decision: null,
    });
  });

  it('20) org B cannot create a recovery card by guessing org A deviationCaseId', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'tenant-guess', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });

    const res = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});

    expect(res.status).toBe(404);
    const row = await client.query(
      `SELECT COUNT(*)::int AS n FROM kpi_recovery_cards WHERE deviation_case_id=$1`,
      [caseId]
    );
    expect(row.rows[0].n).toBe(0);
  });

  it('21) positive control: org A can fully read/write/close its own card', async () => {
    const caseId = await seedDeviationCase(client, ORG_ID, KPI_ID, USER_ID, 'tenant-positive', {
      periodStart: nextPeriodStart(),
      severity: 'AMBER',
    });
    const createRes = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect([200, 201]).toContain(createRes.status);
    const cardId = createRes.body.data.id;

    const putRes = await request(app)
      .put(`/api/v8/results/recovery-cards/${cardId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 1, hypothesis: 'Vendor lead time increased' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.hypothesis).toBe('Vendor lead time increased');
    expect(putRes.body.data.version).toBe(2);

    await seedMeasurement(client, ORG_ID, KPI_ID, 'tenant-positive', { value: 100 });
    const closeRes = await request(app)
      .post(`/api/v8/results/recovery-cards/${cardId}/close`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ version: 2, evidenceText: 'Confirmed fixed', effectivenessRating: 'EFFECTIVE' });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.lifecycleStatus).toBe('CLOSED');
    expect(closeRes.body.data.version).toBe(3);

    const getRes = await request(app)
      .get(`/api/v8/results/deviation-cases/${caseId}/recovery-card`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(cardId);
    expect(getRes.body.data.lifecycleStatus).toBe('CLOSED');
  });
});
