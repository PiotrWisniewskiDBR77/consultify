/**
 * Mounted auth matrix for the Results strict membership wall — real routers,
 * real `verifyToken`, real `requireActiveMembership`, real signed JWTs, real
 * PostgreSQL.
 *
 * WHAT THIS GATE EXISTS TO PROVE
 * Three Results routers had NO per-request membership check: after revoking a
 * user's `organization_members` row their still-valid signed JWT could keep
 * WRITING, and a SUPERADMIN with no membership row at all was accepted. The wall
 * (`services/legacyCutover/requireActiveMembership.ts`, already guarding
 * `v8/results.routes.ts`) is now mounted on all three. This suite proves the
 * denial AND that a denial writes nothing — neither a business row nor an
 * observation row.
 *
 * NOTHING IS MOCKED HERE. In particular the membership middleware is NOT stubbed
 * (the resultsVnext unit suites stub it because they test route logic; this gate
 * exists precisely to test the thing they stub). Tokens are signed with the real
 * `config.JWT_SECRET`, and every membership state is a real row.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/consultify_wobs_<something> \
 *   npx vitest run --retry=0 tests/acceptance/results-strict-membership.mounted.pg.test.ts
 *
 * The DB-failure case renames `organization_members` for one request to make the
 * membership lookup genuinely fail (a real error, not a mocked rejection) and
 * renames it back. That is destructive, so — like the observation suite — this
 * file refuses to run unless the SERVER reports a database name starting with
 * `consultify_wobs`.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REQUIRED_DB_PREFIX = 'consultify_wobs';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

const MEMBERSHIP_REVOKED_CODE = 'ORG_MEMBERSHIP_REVOKED';
const MEMBERSHIP_UNVERIFIABLE_CODE = 'ORG_MEMBERSHIP_UNVERIFIABLE';

describe.skipIf(!enabled).sequential('mounted Results strict membership wall', () => {
  const runId = randomUUID();
  const orgA = `sm-${runId}-org-a`;
  const orgB = `sm-${runId}-org-b`;

  const activeAdmin = `sm-${runId}-admin`;
  const revokedAdmin = `sm-${runId}-revoked`;
  const noMembership = `sm-${runId}-nomember`;
  const superNoMembership = `sm-${runId}-super`;
  const foreignAdmin = `sm-${runId}-foreign`;

  let db: pg.Client;
  let app: Express;

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

  /** Observation rows for a tenant — the telemetry side of every delta assertion. */
  async function observations(organizationId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM results_writer_observations WHERE organization_id = $1`,
      [organizationId]
    );
    return Number(rows[0]?.n ?? '0');
  }

  /** Business rows a denied request must not have created. */
  async function businessRows(organizationId: string): Promise<number> {
    const { rows } = await db.query<{ n: string }>(
      `SELECT (
         (SELECT count(*) FROM initiative_kpis WHERE organization_id = $1) +
         (SELECT count(*) FROM results_kpi_report_snapshots WHERE organization_id = $1)
       )::text AS n`,
      [organizationId]
    );
    return Number(rows[0]?.n ?? '0');
  }

  /** The three newly-walled write surfaces, exercised as real HTTP requests. */
  const WALLED_WRITES = [
    {
      name: 'benefits POST /kpis',
      exec: (bearer: string, body?: Record<string, unknown>) =>
        request(app)
          .post('/benefits/kpis')
          .set('Authorization', `Bearer ${bearer}`)
          .send({
            name: `sm-${runId}-kpi-${randomUUID().slice(0, 8)}`,
            unit: '%',
            targetValue: 90,
            direction: 'HIGHER_IS_BETTER',
            ...(body ?? {}),
          }),
    },
    {
      name: 'results POST /kpi-reports',
      exec: (bearer: string, body?: Record<string, unknown>) =>
        request(app)
          .post('/results/kpi-reports')
          .set('Authorization', `Bearer ${bearer}`)
          .send({ periodStart: '2026-08-01', ...(body ?? {}) }),
    },
    {
      name: 'vnext POST /kpi',
      exec: (bearer: string, body?: Record<string, unknown>) =>
        request(app)
          .post('/vnext/kpi')
          .set('Authorization', `Bearer ${bearer}`)
          .send({
            kpiCode: `SM-${randomUUID().slice(0, 8)}`,
            name: 'sm vnext kpi',
            targetGeometry: 'threshold_min',
            targetValue: 1,
            ...(body ?? {}),
          }),
    },
  ] as const;

  beforeAll(async () => {
    db = new pg.Client({ connectionString: DATABASE_URL });
    await db.connect();

    const { rows } = await db.query<{ db: string }>(`SELECT current_database() AS db`);
    const serverDb = rows[0]?.db ?? '';
    if (!serverDb.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `refusing to run: server-side current_database()="${serverDb}" does not start with ` +
          `"${REQUIRED_DB_PREFIX}". This suite temporarily renames organization_members and must ` +
          `only run against a disposable database.`
      );
    }

    await db.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
      [orgA, orgB]
    );

    // Real users + real membership rows in every state the wall must distinguish.
    for (const [userId, organizationId, role, membership] of [
      [activeAdmin, orgA, 'ADMIN', 'ACTIVE'],
      [revokedAdmin, orgA, 'ADMIN', 'REVOKED'],
      [noMembership, orgA, 'ADMIN', null],
      [superNoMembership, orgA, 'SUPERADMIN', null],
      [foreignAdmin, orgB, 'ADMIN', 'ACTIVE'],
    ] as const) {
      await db.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'x',$4,'active')`,
        [userId, organizationId, `${userId}@test.invalid`, role]
      );
      if (membership) {
        await db.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
           VALUES($1,$2,$3,$4,$5)`,
          [randomUUID(), organizationId, userId, role === 'SUPERADMIN' ? 'ADMIN' : role, membership]
        );
      }
    }

    const [{ default: benefits }, { default: kpiReports }, { default: vnextKpi }, { default: v8Results }, authModule] =
      await Promise.all([
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
    if (!db) return;
    try {
      // Exact, FK-safe teardown in dependency order. No LIKE sweeps on shared
      // tables, no swallowed errors.
      await db.query(
        `ALTER TABLE results_writer_observations DISABLE TRIGGER trg_results_writer_observation_no_delete`
      );
      await db.query(`DELETE FROM results_writer_observations WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(
        `ALTER TABLE results_writer_observations ENABLE TRIGGER trg_results_writer_observation_no_delete`
      );

      await db.query(`DELETE FROM kpi_metric_audit_log WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      // `initiative_kpis.current_definition_version` and `kpi_definition_versions.kpi_id`
      // reference each other, so neither table can simply be deleted first
      // (`fk_initiative_kpis_current_version` fires either way). Break the
      // pointer, then delete versions, then the KPIs themselves.
      await db.query(
        `UPDATE initiative_kpis SET current_definition_version = NULL WHERE organization_id = ANY($1::text[])`,
        [[orgA, orgB]]
      );
      await db.query(`DELETE FROM kpi_definition_versions WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(`DELETE FROM initiative_kpis WHERE organization_id = ANY($1::text[])`, [[orgA, orgB]]);
      await db.query(`DELETE FROM results_kpi_report_snapshots WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);

      // The KPI-reports writer also materializes a Report Builder artifact, whose
      // rows reference BOTH the organization and the acting user. Children first,
      // then the report, or the later `users` delete trips
      // `report_builder_reports_created_by_fkey`. Enumerated from the live FK
      // graph rather than guessed.
      const reportIds = await db.query<{ id: string }>(
        `SELECT id FROM report_builder_reports WHERE organization_id = ANY($1::text[])`,
        [[orgA, orgB]]
      );
      const reportIdList = reportIds.rows.map((r) => r.id);
      if (reportIdList.length > 0) {
        for (const table of [
          'report_builder_comment_activity',
          'report_builder_comments',
          'report_builder_activity',
          'report_builder_sections',
          'report_builder_sessions',
          'report_builder_versions',
        ]) {
          await db.query(`DELETE FROM ${table} WHERE report_id = ANY($1::text[])`, [reportIdList]);
        }
        await db.query(`DELETE FROM report_builder_reports WHERE id = ANY($1::text[])`, [reportIdList]);
      }
      await db.query(`DELETE FROM report_builder_templates WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(`DELETE FROM report_builder_block_types WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await db.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[orgA, orgB]]);
      await db.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);

      // Exact residue0 for this run's tenants.
      const { rows } = await db.query<{ n: string }>(
        `SELECT (
           (SELECT count(*) FROM results_writer_observations WHERE organization_id = ANY($1::text[])) +
           (SELECT count(*) FROM initiative_kpis WHERE organization_id = ANY($1::text[])) +
           (SELECT count(*) FROM results_kpi_report_snapshots WHERE organization_id = ANY($1::text[])) +
           (SELECT count(*) FROM organization_members WHERE organization_id = ANY($1::text[])) +
           (SELECT count(*) FROM organizations WHERE id = ANY($1::text[]))
         )::text AS n`,
        [[orgA, orgB]]
      );
      if (Number(rows[0]?.n ?? '0') !== 0) {
        throw new Error(`teardown left ${rows[0]?.n} row(s) behind for this run's tenants`);
      }

      // Trigger state O — the append-only guard must be back on.
      const trg = await db.query<{ tgname: string; tgenabled: string }>(
        `SELECT tgname, tgenabled::text FROM pg_trigger
          WHERE tgrelid = 'results_writer_observations'::regclass AND NOT tgisinternal`
      );
      for (const row of trg.rows) {
        if (row.tgenabled !== 'O') {
          throw new Error(`trigger ${row.tgname} left in state ${row.tgenabled}, expected O`);
        }
      }
    } finally {
      await db.end();
    }
  }, 90_000);

  it('ACTIVE ADMIN passes the wall on all three newly-walled routers', async () => {
    const bearer = token(activeAdmin, orgA);
    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      // The wall must not be what stops an ACTIVE member. Downstream governance
      // (e.g. vNext's NO_ACTIVE_VISIBILITY_POLICY) may still refuse the write —
      // that is a different, pre-existing decision and not this gate's subject.
      expect(res.body?.code, `${surface.name} denied by the wall for an ACTIVE member`).not.toBe(
        MEMBERSHIP_REVOKED_CODE
      );
      expect(res.status, `${surface.name}`).not.toBe(403);
    }
  });

  it('ACTIVE ADMIN write records EXACTLY ONE observation per invoked writer', async () => {
    const bearer = token(activeAdmin, orgA);
    const before = await observations(orgA);

    const created = await WALLED_WRITES[0].exec(bearer); // benefits POST /kpis
    expect(created.status).toBe(200);

    // observeWriter is fire-and-forget (documented best-effort), so allow the
    // dispatch to land before counting — this asserts exactly-one, not at-least-one.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await observations(orgA)).toBe(before + 1);

    const { rows } = await db.query<{ writer_family: string; operation: string }>(
      `SELECT writer_family, operation FROM results_writer_observations
        WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orgA]
    );
    expect(rows[0]).toMatchObject({ writer_family: 'legacy_kpi_crud', operation: 'createKpi' });
  });

  it('REVOKED membership: first request denied 403 with delta business=0 observation=0', async () => {
    const bearer = token(revokedAdmin, orgA);
    const businessBefore = await businessRows(orgA);
    const obsBefore = await observations(orgA);

    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect(res.status, surface.name).toBe(403);
      expect(res.body?.code, surface.name).toBe(MEMBERSHIP_REVOKED_CODE);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await businessRows(orgA)).toBe(businessBefore);
    expect(await observations(orgA)).toBe(obsBefore);
  });

  it('MISSING membership row: 403 with delta 0/0', async () => {
    const bearer = token(noMembership, orgA);
    const businessBefore = await businessRows(orgA);
    const obsBefore = await observations(orgA);

    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect(res.status, surface.name).toBe(403);
      expect(res.body?.code, surface.name).toBe(MEMBERSHIP_REVOKED_CODE);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await businessRows(orgA)).toBe(businessBefore);
    expect(await observations(orgA)).toBe(obsBefore);
  });

  it('SUPERADMIN without membership: 403 — a role claim is no bypass — delta 0/0', async () => {
    const bearer = token(superNoMembership, orgA, 'SUPERADMIN', { isSuperAdmin: true });
    const businessBefore = await businessRows(orgA);
    const obsBefore = await observations(orgA);

    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect(res.status, surface.name).toBe(403);
      expect(res.body?.code, surface.name).toBe(MEMBERSHIP_REVOKED_CODE);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await businessRows(orgA)).toBe(businessBefore);
    expect(await observations(orgA)).toBe(obsBefore);
  });

  it('FOREIGN tenant: an org-B member writing into org-A leaves org-A untouched (delta 0/0)', async () => {
    // The foreign actor IS an active member of its own org, so the wall admits
    // it; tenant scoping then keeps it inside org B. Either outcome is
    // acceptable per route contract — what must hold is that org A gains nothing.
    const bearer = token(foreignAdmin, orgB);
    const aBusinessBefore = await businessRows(orgA);
    const aObsBefore = await observations(orgA);

    for (const surface of WALLED_WRITES) {
      const res = await surface.exec(bearer);
      expect([200, 201, 400, 403, 404, 409], `${surface.name} -> ${res.status}`).toContain(res.status);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await businessRows(orgA)).toBe(aBusinessBefore);
    expect(await observations(orgA)).toBe(aObsBefore);
  });

  it('membership lookup DB FAILURE: 503 fail-closed with delta 0/0 (never proceeds)', async () => {
    const bearer = token(activeAdmin, orgA);
    const businessBefore = await businessRows(orgA);
    const obsBefore = await observations(orgA);

    // A REAL lookup failure: the table the wall reads is gone for the duration
    // of one request. Not a mocked rejection.
    await db.query(`ALTER TABLE organization_members RENAME TO organization_members_sm_hidden`);
    try {
      for (const surface of WALLED_WRITES) {
        const res = await surface.exec(bearer);
        expect(res.status, surface.name).toBe(503);
        expect(res.body?.code, surface.name).toBe(MEMBERSHIP_UNVERIFIABLE_CODE);
      }
    } finally {
      await db.query(`ALTER TABLE organization_members_sm_hidden RENAME TO organization_members`);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await businessRows(orgA)).toBe(businessBefore);
    expect(await observations(orgA)).toBe(obsBefore);

    // The wall works again afterwards — the outage did not leave it open.
    const after = await WALLED_WRITES[1].exec(bearer);
    expect(after.status).not.toBe(503);
  });

  it('BODY SPOOF: a spoofed org/actor in the body does not change attribution', async () => {
    const bearer = token(activeAdmin, orgA);
    const spoofCorrelation = randomUUID();
    const bObsBefore = await observations(orgB);

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

    await new Promise((resolve) => setTimeout(resolve, 400));
    const { rows } = await db.query<{ organization_id: string; actor_user_id: string }>(
      `SELECT organization_id, actor_user_id FROM results_writer_observations WHERE correlation_id = $1`,
      [spoofCorrelation]
    );
    expect(rows).toHaveLength(1);
    // Attribution comes from the signed token, never from the body.
    expect(rows[0].organization_id).toBe(orgA);
    expect(rows[0].actor_user_id).toBe(activeAdmin);
    expect(await observations(orgB)).toBe(bObsBefore);
  });

  it('v8/results REGRESSION: the pre-existing wall still denies revoked and missing membership', async () => {
    // Separate regression for the router that already had the wall before this
    // packet — it must not have been weakened by mounting the same middleware
    // elsewhere.
    const revoked = await request(app)
      .post('/v8-results/reconciliations/pull')
      .set('Authorization', `Bearer ${token(revokedAdmin, orgA)}`)
      .send({ initiativeId: 'none', mappings: [{ kpiId: 'k', driverKey: 'd' }] });
    expect(revoked.status).toBe(403);
    expect(revoked.body?.code).toBe(MEMBERSHIP_REVOKED_CODE);

    const missing = await request(app)
      .post('/v8-results/reconciliations/pull')
      .set('Authorization', `Bearer ${token(noMembership, orgA)}`)
      .send({ initiativeId: 'none', mappings: [{ kpiId: 'k', driverKey: 'd' }] });
    expect(missing.status).toBe(403);
    expect(missing.body?.code).toBe(MEMBERSHIP_REVOKED_CODE);

    const active = await request(app)
      .post('/v8-results/reconciliations/pull')
      .set('Authorization', `Bearer ${token(activeAdmin, orgA)}`)
      .send({ initiativeId: 'none', mappings: [{ kpiId: 'k', driverKey: 'd' }] });
    expect(active.body?.code).not.toBe(MEMBERSHIP_REVOKED_CODE);
  });
});
