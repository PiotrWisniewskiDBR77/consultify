/**
 * Authorization matrix for the Results strict membership wall over MOUNTED
 * ROUTERS (not the full Gateway) — real routers, real `verifyToken`, real
 * `requireActiveMembership`, real signed JWTs, real PostgreSQL.
 *
 * SCOPE, NAMED HONESTLY
 * This suite mounts the four Results routers directly on a bare Express app. It
 * does NOT exercise the production Gateway, so Gateway-level concerns (betaGate,
 * v8FeatureGate, global rate limiting, the readiness gate, apiLogging) are OUT OF
 * SCOPE here and are not proven by it. What it does prove is the per-router
 * authorization contract and that a denial writes nothing.
 *
 * WHAT THIS GATE EXISTS FOR
 * Three Results routers had NO per-request membership check: after revoking a
 * user's `organization_members` row their still-valid signed JWT could keep
 * WRITING, and a SUPERADMIN with no membership row at all was accepted.
 *
 * NOTHING ABOUT AUTHORIZATION IS MOCKED. The membership middleware is real (the
 * resultsVnext unit suites stub it because they test route logic; this gate exists
 * to test the thing they stub). The ONLY injected seam is a bounded failure of
 * `DbPromise.get` for `organization_members` lookups, used to prove fail-closed
 * behaviour; every other query delegates to the real implementation, the number
 * of intercepted lookups is asserted, and the seam is disarmed in `finally`.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   RESULTS_STRICT_MEMBERSHIP_TEST_CLEANUP=i-own-this-disposable-database \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/consultify_wobs_<something> \
 *   npx vitest run --config vitest.acceptance.config.ts --retry=0 \
 *     tests/acceptance/results-strict-membership.mounted.pg.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg, { type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * BOUNDED FAILURE INJECTION — `organization_members` lookups only.
 *
 * Armed for exactly one assertion, it fails ONLY queries that read
 * `organization_members` and delegates everything else to the real DbPromise.
 * A blanket `ALTER TABLE ... RENAME` (the previous approach) took the table away
 * from the entire process, which is both wider than the thing under test and
 * destructive to any concurrent reader.
 */
const membershipLookup = vi.hoisted(() => ({ failing: false, interceptedHits: 0 }));

vi.mock('../../server/src/utils/DbPromise.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/utils/DbPromise.js')>();
  return {
    ...actual,
    get: (...args: unknown[]) => {
      // `get` is overloaded as (sql, ...) and (db, sql, ...).
      const sql =
        typeof args[0] === 'string' ? args[0] : typeof args[1] === 'string' ? args[1] : '';
      if (membershipLookup.failing && /organization_members/i.test(sql)) {
        membershipLookup.interceptedHits += 1;
        return Promise.reject(new Error('injected membership lookup failure (bounded test seam)'));
      }
      return (actual.get as (...a: unknown[]) => unknown)(...args);
    },
  };
});

import config from '../../server/src/config/Config.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REQUIRED_DB_PREFIX = 'consultify_wobs';
const CLEANUP_OPT_IN =
  process.env.RESULTS_STRICT_MEMBERSHIP_TEST_CLEANUP === 'i-own-this-disposable-database';

function callerDbName(connectionString: string): string {
  try {
    return new URL(connectionString).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}
const CALLER_DB = callerDbName(DATABASE_URL);

const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres') &&
  CLEANUP_OPT_IN &&
  CALLER_DB.startsWith(REQUIRED_DB_PREFIX);

if (!enabled) {
  // eslint-disable-next-line no-console
  console.warn(
    `[mounted Results strict membership suite SKIPPED — clean skip, not a pass] needs ` +
      `RUN_DB_TESTS=1 MOCK_DB=false, ` +
      `RESULTS_STRICT_MEMBERSHIP_TEST_CLEANUP=i-own-this-disposable-database, and a DATABASE_URL ` +
      `whose database name starts with "${REQUIRED_DB_PREFIX}" (teardown disables an append-only ` +
      `DELETE trigger). db="${CALLER_DB}" cleanupOptIn=${CLEANUP_OPT_IN}`
  );
}

const MEMBERSHIP_REVOKED_CODE = 'ORG_MEMBERSHIP_REVOKED';
const MEMBERSHIP_UNVERIFIABLE_CODE = 'ORG_MEMBERSHIP_UNVERIFIABLE';
const DELETE_TRIGGER = 'trg_results_writer_observation_no_delete';
const UPDATE_TRIGGER = 'trg_results_writer_observation_no_update';

/** Deterministic advisory-lock key: same value on every run, so two concurrent
 * runs of THIS suite serialize instead of interleaving a trigger disable. */
const ADVISORY_LOCK_KEY = 20261014;

describe.skipIf(!enabled).sequential('mounted Results routers — strict membership wall', () => {
  const runId = randomUUID();
  const orgA = `sm-${runId}-org-a`;
  const orgB = `sm-${runId}-org-b`;

  const activeAdmin = `sm-${runId}-admin`;
  const revokedAdmin = `sm-${runId}-revoked`;
  const noMembership = `sm-${runId}-nomember`;
  const superNoMembership = `sm-${runId}-super`;
  const foreignAdmin = `sm-${runId}-foreign`;

  let pool: pg.Pool;
  let app: Express;
  /** A REAL org-A resource, created through a real request, for the foreign case. */
  let orgAKpiId = '';

  const token = (userId: string, organizationId: string, role = 'ADMIN', extra = {}) =>
    jwt.sign(
      {
        id: userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
        ...extra,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  /** Business + intent + both observation ledgers every denial must leave untouched. */
  async function deltas(organizationId: string): Promise<{
    business: number;
    intents: number;
    writerObservations: number;
    cutoverObservations: number;
  }> {
    const { rows } = await pool.query<{
      business: string;
      intents: string;
      writer_observations: string;
      cutover_observations: string;
    }>(
      `SELECT
         ((SELECT count(*) FROM initiative_kpis WHERE organization_id = $1) +
          (SELECT count(*) FROM results_kpi_report_snapshots WHERE organization_id = $1) +
          (SELECT count(*) FROM rvn_kpi_definitions WHERE organization_id = $1))::text AS business,
         (SELECT count(*) FROM legacy_cutover_signal_intents WHERE organization_id = $1)::text AS intents,
         (SELECT count(*) FROM results_writer_observations WHERE organization_id = $1)::text AS writer_observations,
         (SELECT count(*) FROM legacy_cutover_usage_events WHERE organization_id = $1)::text AS cutover_observations`,
      [organizationId]
    );
    return {
      business: Number(rows[0]?.business ?? '0'),
      intents: Number(rows[0]?.intents ?? '0'),
      writerObservations: Number(rows[0]?.writer_observations ?? '0'),
      cutoverObservations: Number(rows[0]?.cutover_observations ?? '0'),
    };
  }

  /** observeWriter is fire-and-forget by design; let the dispatch land. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  const WALLED_WRITES = [
    {
      name: 'benefits POST /kpis',
      exec: (bearer?: string, body?: Record<string, unknown>) => {
        const req = request(app).post('/benefits/kpis');
        if (bearer) req.set('Authorization', `Bearer ${bearer}`);
        return req.send({
          name: `sm-${runId}-kpi-${randomUUID().slice(0, 8)}`,
          unit: '%',
          targetValue: 90,
          direction: 'HIGHER_IS_BETTER',
          ...(body ?? {}),
        });
      },
    },
    {
      name: 'results POST /kpi-reports',
      exec: (bearer?: string, body?: Record<string, unknown>) => {
        const req = request(app).post('/results/kpi-reports');
        if (bearer) req.set('Authorization', `Bearer ${bearer}`);
        return req.send({ periodStart: '2026-08-01', ...(body ?? {}) });
      },
    },
    {
      name: 'vnext POST /kpi',
      exec: (bearer?: string, body?: Record<string, unknown>) => {
        const req = request(app).post('/vnext/kpi');
        if (bearer) req.set('Authorization', `Bearer ${bearer}`);
        return req.send({
          kpiCode: `SM-${randomUUID().slice(0, 8)}`,
          name: 'sm vnext kpi',
          targetGeometry: 'threshold_min',
          targetValue: 1,
          ...(body ?? {}),
        });
      },
    },
  ] as const;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 6 });

    // Server-side guard: the connection string can lie, `current_database()` cannot.
    const { rows } = await pool.query<{ db: string }>(`SELECT current_database() AS db`);
    const serverDb = rows[0]?.db ?? '';
    if (!serverDb.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `refusing to run: server-side current_database()="${serverDb}" does not start with ` +
          `"${REQUIRED_DB_PREFIX}". Teardown disables an append-only DELETE trigger and must only ` +
          `run against a disposable database.`
      );
    }

    await pool.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
      [orgA, orgB]
    );

    for (const [userId, organizationId, role, membership] of [
      [activeAdmin, orgA, 'ADMIN', 'ACTIVE'],
      [revokedAdmin, orgA, 'ADMIN', 'REVOKED'],
      [noMembership, orgA, 'ADMIN', null],
      [superNoMembership, orgA, 'SUPERADMIN', null],
      [foreignAdmin, orgB, 'ADMIN', 'ACTIVE'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'x',$4,'active')`,
        [userId, organizationId, `${userId}@test.invalid`, role]
      );
      if (membership) {
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
           VALUES($1,$2,$3,$4,$5)`,
          [randomUUID(), organizationId, userId, role === 'SUPERADMIN' ? 'ADMIN' : role, membership]
        );
      }
    }

    const [
      { default: benefits },
      { default: kpiReports },
      { default: vnextKpi },
      { default: v8Results },
      authModule,
    ] = await Promise.all([
      import('../../server/src/routes/benefits.routes.js'),
      import('../../server/src/routes/results-kpi-reports.routes.js'),
      import('../../server/src/routes/resultsVnext/kpi.routes.js'),
      import('../../server/src/routes/v8/results.routes.js'),
      import('../../server/src/middleware/auth.middleware.js'),
    ]);

    app = express();
    app.use(express.json());
    // Each router mounts its own verifyToken + requireActiveMembership.
    app.use('/benefits', benefits);
    app.use('/results', kpiReports);
    app.use('/vnext/kpi', vnextKpi);
    // v8/results mounts the wall but takes authentication from the v8 chain, so
    // the REAL verifyToken is mounted ahead of it here (not a stub).
    app.use('/v8-results', authModule.verifyToken, v8Results);
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    // ONE pinned client for the whole destructive sequence: BEGIN, every DELETE,
    // the residue read and COMMIT/ROLLBACK all run on the SAME connection. With a
    // pool, `DISABLE TRIGGER` could otherwise land on a different backend than the
    // DELETE it is meant to permit, and the residue read could observe a state
    // predating the commit.
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      try {
        // Deterministic key, transaction-scoped: released on COMMIT or ROLLBACK.
        await client.query(`SELECT pg_advisory_xact_lock($1)`, [ADVISORY_LOCK_KEY]);

        const guard = await client.query<{ db: string }>(`SELECT current_database() AS db`);
        if (!(guard.rows[0]?.db ?? '').startsWith(REQUIRED_DB_PREFIX)) {
          throw new Error('database-name guard failed inside the teardown transaction');
        }

        const orgs = [orgA, orgB];

        await client.query(
          `ALTER TABLE results_writer_observations DISABLE TRIGGER ${DELETE_TRIGGER}`
        );
        await client.query(
          `DELETE FROM results_writer_observations WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `ALTER TABLE results_writer_observations ENABLE TRIGGER ${DELETE_TRIGGER}`
        );

        await client.query(
          `DELETE FROM legacy_cutover_signal_intents WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );

        // Report Builder artifacts created by the KPI-reports writer reference both
        // the organization and the acting user: children first, then the report,
        // or the later `users` delete trips report_builder_reports_created_by_fkey.
        const reports = await client.query<{ id: string }>(
          `SELECT id FROM report_builder_reports WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        const reportIds = reports.rows.map((r) => r.id);
        if (reportIds.length > 0) {
          for (const table of [
            'report_builder_comment_activity',
            'report_builder_comments',
            'report_builder_activity',
            'report_builder_sections',
            'report_builder_sessions',
            'report_builder_versions',
          ]) {
            await client.query(`DELETE FROM ${table} WHERE report_id = ANY($1::text[])`, [
              reportIds,
            ]);
          }
          await client.query(`DELETE FROM report_builder_reports WHERE id = ANY($1::text[])`, [
            reportIds,
          ]);
        }
        await client.query(
          `DELETE FROM report_builder_templates WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `DELETE FROM report_builder_block_types WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );

        await client.query(
          `DELETE FROM results_kpi_report_snapshots WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `DELETE FROM kpi_metric_audit_log WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        // initiative_kpis.current_definition_version and kpi_definition_versions.kpi_id
        // reference each other: break the pointer, then versions, then the KPIs.
        await client.query(
          `UPDATE initiative_kpis SET current_definition_version = NULL WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `DELETE FROM kpi_definition_versions WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(`DELETE FROM initiative_kpis WHERE organization_id = ANY($1::text[])`, [
          orgs,
        ]);

        await client.query(
          `DELETE FROM rvn_kpi_definition_versions WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(
          `DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`,
          [orgs]
        );
        await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [orgs]);
        await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [orgs]);

        // Full residue0, read on the SAME pinned connection before COMMIT.
        const residue = await client.query<{ n: string }>(
          `SELECT (
             (SELECT count(*) FROM results_writer_observations WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM legacy_cutover_signal_intents WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM legacy_cutover_usage_events WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM initiative_kpis WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM kpi_definition_versions WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM results_kpi_report_snapshots WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM report_builder_reports WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM organization_members WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM users WHERE organization_id = ANY($1::text[])) +
             (SELECT count(*) FROM organizations WHERE id = ANY($1::text[]))
           )::text AS n`,
          [orgs]
        );
        if (Number(residue.rows[0]?.n ?? '0') !== 0) {
          throw new Error(
            `teardown left ${residue.rows[0]?.n} row(s) behind for this run's tenants`
          );
        }

        // Exact named triggers must be back to 'O' BEFORE we commit.
        const trg = await client.query<{ tgname: string; tgenabled: string }>(
          `SELECT tgname, tgenabled::text FROM pg_trigger
            WHERE tgrelid = 'results_writer_observations'::regclass AND NOT tgisinternal
              AND tgname = ANY($1::text[])`,
          [[DELETE_TRIGGER, UPDATE_TRIGGER]]
        );
        if (trg.rows.length !== 2) {
          throw new Error(`expected both append-only triggers, found ${trg.rows.length}`);
        }
        for (const row of trg.rows) {
          if (row.tgenabled !== 'O') {
            throw new Error(`trigger ${row.tgname} left in state ${row.tgenabled}, expected O`);
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client?.release();
      await pool.end();
    }
  }, 90_000);

  it('ACTIVE ADMIN passes the wall on all three newly-walled routers', async () => {
    const bearer = token(activeAdmin, orgA);
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      // The wall must not be what stops an ACTIVE member. Downstream governance
      // (e.g. vNext's NO_ACTIVE_VISIBILITY_POLICY) may still refuse — a different,
      // pre-existing decision and not this gate's subject.
      expect(res.body?.code, `${surface.name} denied by the wall`).not.toBe(
        MEMBERSHIP_REVOKED_CODE
      );
      expect(res.status, surface.name).not.toBe(403);
    }
  });

  it('ACTIVE ADMIN write records EXACTLY ONE observation and yields a real org-A resource', async () => {
    const bearer = token(activeAdmin, orgA);
    const before = await deltas(orgA);

    const created = await WALLED_WRITES[0].exec(bearer);
    expect(created.status).toBe(200);
    orgAKpiId = String(created.body?.data?.id ?? '');
    expect(orgAKpiId).toMatch(/^[0-9a-f-]{36}$/i);

    await settle();
    const after = await deltas(orgA);
    expect(after.writerObservations).toBe(before.writerObservations + 1);
    expect(after.business).toBe(before.business + 1);

    const { rows } = await pool.query<{ writer_family: string; operation: string }>(
      `SELECT writer_family, operation FROM results_writer_observations
        WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orgA]
    );
    expect(rows[0]).toMatchObject({ writer_family: 'legacy_kpi_crud', operation: 'createKpi' });
  });

  it('MISSING identity: 401 on every walled router with delta 0/0/0/0', async () => {
    const before = await deltas(orgA);
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(undefined);
      expect(res.status, surface.name).toBe(401);
    }
    await settle();
    expect(await deltas(orgA)).toEqual(before);
  });

  it('INVALID identity (bad signature): 401 with delta 0/0/0/0', async () => {
    const before = await deltas(orgA);
    const forged = jwt.sign(
      { id: activeAdmin, organizationId: orgA, role: 'ADMIN' },
      'not-the-real-signing-secret-at-all',
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(forged);
      expect(res.status, surface.name).toBe(401);
    }
    await settle();
    expect(await deltas(orgA)).toEqual(before);
  });

  it('REVOKED membership: first request 403 ORG_MEMBERSHIP_REVOKED with delta 0/0/0/0', async () => {
    const before = await deltas(orgA);
    const bearer = token(revokedAdmin, orgA);
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect(res.status, surface.name).toBe(403);
      expect(res.body?.code, surface.name).toBe(MEMBERSHIP_REVOKED_CODE);
    }
    await settle();
    expect(await deltas(orgA)).toEqual(before);
  });

  it('MISSING membership row: 403 with delta 0/0/0/0', async () => {
    const before = await deltas(orgA);
    const bearer = token(noMembership, orgA);
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect(res.status, surface.name).toBe(403);
      expect(res.body?.code, surface.name).toBe(MEMBERSHIP_REVOKED_CODE);
    }
    await settle();
    expect(await deltas(orgA)).toEqual(before);
  });

  it('SUPERADMIN without membership: 403 — a role claim is no bypass — delta 0/0/0/0', async () => {
    const before = await deltas(orgA);
    const bearer = token(superNoMembership, orgA, 'SUPERADMIN', { isSuperAdmin: true });
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect(res.status, surface.name).toBe(403);
      expect(res.body?.code, surface.name).toBe(MEMBERSHIP_REVOKED_CODE);
    }
    await settle();
    expect(await deltas(orgA)).toEqual(before);
  });

  it('FOREIGN tenant writing a REAL org-A resource: exact 404, delta 0/0/0/0 in BOTH tenants', async () => {
    // A real, existing org-A KPI id — not a fabricated uuid, so the request is
    // genuinely cross-tenant rather than merely "not found for everyone".
    expect(orgAKpiId).toBeTruthy();
    const beforeA = await deltas(orgA);
    const beforeB = await deltas(orgB);

    const res = await request(app)
      .post(`/benefits/kpis/${orgAKpiId}/time-series`)
      .set('Authorization', `Bearer ${token(foreignAdmin, orgB)}`)
      .send({ value: 42, periodStart: '2026-08-19', source: 'manual' });

    // The foreign actor IS an active ADMIN of its own tenant, so both the wall and
    // the role policy admit it; org scoping is what refuses, with this exact code.
    expect(res.status).toBe(404);
    expect(res.body?.code).toBe('RESULTS_KPI_NOT_FOUND');

    await settle();
    expect(await deltas(orgA)).toEqual(beforeA);
    // The foreign tenant gains nothing either — a denied write is not attributed
    // to the caller's own tenant as consolation.
    expect(await deltas(orgB)).toEqual(beforeB);
  });

  it('membership lookup DB FAILURE (bounded to organization_members): 503 fail-closed, delta 0/0/0/0', async () => {
    const before = await deltas(orgA);
    const bearer = token(activeAdmin, orgA);

    membershipLookup.failing = true;
    membershipLookup.interceptedHits = 0;
    try {
      for (const surface of WALLED_WRITES) {
        const res = await surface.exec(bearer);
        expect(res.status, surface.name).toBe(503);
        expect(res.body?.code, surface.name).toBe(MEMBERSHIP_UNVERIFIABLE_CODE);
      }
      // EXACTLY TWO intercepted `organization_members` lookups per request, and
      // the distinction between them is the whole reason the strict wall exists:
      //   1. `verifyToken` -> `attachUser` (auth.middleware.ts:807) reads
      //      membership to RESOLVE org context, inside a `try/catch` that
      //      swallows failures — fail-OPEN, and not an authorization decision;
      //   2. `requireActiveMembership` reads it to AUTHORIZE — fail-CLOSED.
      // Under this injection both reads fail; the request still ends 503 (asserted
      // above), proving the fail-open reader cannot rescue an unverifiable tenant
      // and that the authoritative decision is the wall's. Two reads per request
      // also confirm neither reader is served from a cache.
      expect(membershipLookup.interceptedHits).toBe(WALLED_WRITES.length * 2);
    } finally {
      membershipLookup.failing = false;
    }

    await settle();
    expect(await deltas(orgA)).toEqual(before);

    // After restore an ACTIVE request must pass again — the outage must not have
    // left the wall either open or permanently closed.
    const recovered = await WALLED_WRITES[1].exec(bearer);
    expect(recovered.status).toBe(200);
    expect(recovered.body?.code).not.toBe(MEMBERSHIP_UNVERIFIABLE_CODE);
  });

  it('BODY SPOOF: a spoofed org/actor in the body does not change attribution', async () => {
    const bearer = token(activeAdmin, orgA);
    const spoofCorrelation = randomUUID();
    const beforeB = await deltas(orgB);

    const res = await request(app)
      .post('/results/kpi-reports')
      .set('Authorization', `Bearer ${bearer}`)
      .set('X-Correlation-ID', spoofCorrelation)
      .send({
        periodStart: '2026-08-02',
        organizationId: orgB,
        organization_id: orgB,
        userId: foreignAdmin,
        actorUserId: foreignAdmin,
        createdBy: foreignAdmin,
      });
    expect(res.status).toBe(200);

    await settle();
    const { rows } = await pool.query<{ organization_id: string; actor_user_id: string }>(
      `SELECT organization_id, actor_user_id FROM results_writer_observations WHERE correlation_id = $1`,
      [spoofCorrelation]
    );
    expect(rows).toHaveLength(1);
    // Attribution comes from the signed token, never from the body.
    expect(rows[0].organization_id).toBe(orgA);
    expect(rows[0].actor_user_id).toBe(activeAdmin);
    expect(await deltas(orgB)).toEqual(beforeB);
  });

  it('v8/results REGRESSION: the pre-existing wall still denies revoked and missing membership', async () => {
    const beforeRevoked = await deltas(orgA);
    const revoked = await request(app)
      .post('/v8-results/reconciliations/pull')
      .set('Authorization', `Bearer ${token(revokedAdmin, orgA)}`)
      .send({ initiativeId: 'none', mappings: [{ kpiId: 'k', driverKey: 'd' }] });
    expect(revoked.status).toBe(403);
    expect(revoked.body?.code).toBe(MEMBERSHIP_REVOKED_CODE);
    await settle();
    expect(await deltas(orgA)).toEqual(beforeRevoked);

    const beforeMissing = await deltas(orgA);
    const missing = await request(app)
      .post('/v8-results/reconciliations/pull')
      .set('Authorization', `Bearer ${token(noMembership, orgA)}`)
      .send({ initiativeId: 'none', mappings: [{ kpiId: 'k', driverKey: 'd' }] });
    expect(missing.status).toBe(403);
    expect(missing.body?.code).toBe(MEMBERSHIP_REVOKED_CODE);
    await settle();
    expect(await deltas(orgA)).toEqual(beforeMissing);

    const active = await request(app)
      .post('/v8-results/reconciliations/pull')
      .set('Authorization', `Bearer ${token(activeAdmin, orgA)}`)
      .send({ initiativeId: 'none', mappings: [{ kpiId: 'k', driverKey: 'd' }] });
    expect(active.body?.code).not.toBe(MEMBERSHIP_REVOKED_CODE);
  });
});
