/**
 * DEC-131 P1-4 + DEC-136 — Management Reports were completely unscoped by
 * organization: any authenticated user, knowing (or guessing) a report id,
 * could read another org's comments/audit-log, finalize/unlock another org's
 * report, read its full content, rename it, comment on it, read its version
 * history, drive its approval workflow, or — worst of all — mint a PUBLIC
 * SHARE LINK to it. Tested against a REAL Postgres database (no mocks).
 *
 * Routes under test (server/src/routes/managementReports.routes.ts):
 *   DEC-131 P1-4 (already fixed, kept as regression cover):
 *     GET  /:id/comments
 *     GET  /:id/audit-log
 *     POST /:id/finalize
 *     POST /:id/unlock
 *   DEC-136 (this pass):
 *     POST   /:id/share                      <- P0: leak leaves the system
 *     GET    /pending-approvals
 *     POST   /:id/submit
 *     POST   /:id/approve
 *     GET    /:id/approval-status
 *     PATCH  /:id
 *     GET    /:id
 *     GET    /:id/versions
 *     GET    /:id/versions/:versionNumber
 *     GET    /:id/versions/compare
 *     POST   /:id/comments
 *     PATCH  /:id/comments/:commentId
 *     DELETE /:id/comments/:commentId
 *     POST   /bulk-export
 *     GET    /history, GET /analytics/* (organizationId fallback removed)
 *
 * Fix (server/src/services/managementReportsService.ts): each of the four
 * service methods now calls the new `assertReportInOrganization(reportId,
 * organizationId)` helper — built on the existing `getReportByIdForOrganization`
 * tenant-scoped lookup already used by generateExport() — BEFORE any read or
 * write, and it is fed `req.organizationId` ONLY (no query/body fallback), so
 * a foreign report always 404s exactly like a missing one, and no write can
 * land before the tenant check.
 *
 * Same shape/harness as tests/integration/table-platform.idor.realdb.test.ts:
 * REAL Express router, REAL verifyToken (E2E_MODE unsigned-JWT bypass), REAL
 * service/repository code, a fast Postgres reachability probe, and a vacuous
 * pass (`itDB`) when no database is configured so this file never breaks
 * `npm run test:integration` on a machine with no Postgres.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name consultify-mgmtreports-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 5507:5432 \
 *     pgvector/pgvector:pg16
 *   DATABASE_URL=postgres://iris:iris_test@localhost:5507/iris_test \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false npm run db:migrate
 *   DATABASE_URL=postgres://iris:iris_test@localhost:5507/iris_test \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *     npx vitest run tests/integration/managementReports.orgScope.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import managementReportsRoutes from '../../server/src/routes/managementReports.routes.js';

// ---------------------------------------------------------------------------
// Force the real Postgres pool + E2E auth bypass, ONLY when a database is
// actually configured — identical guard to table-platform.idor.realdb.test.ts.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// ---------------------------------------------------------------------------
// Connection probe
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

const REQUIRED_TABLES = [
  'management_reports',
  'management_report_comments',
  'management_report_audit_log',
  'management_report_versions',
  'management_report_approvals',
  'organizations',
  'users',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as table-platform.idor.realdb.test.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'MgmtReports RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

// ---------------------------------------------------------------------------
// App under test — REAL router, REAL verifyToken.
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/management-reports', managementReportsRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  ownerUserId: string; // member of org A, owns the fixture reports
  attackerUserId: string; // member of org B — must never reach org A's reports
  cleanup: () => Promise<void>;
  insertReport: (opts: {
    status?: string;
    lockedAt?: string | null;
  }) => Promise<string>;
  insertComment: (reportId: string) => Promise<string>;
  insertAuditLogRow: (reportId: string) => Promise<string>;
  insertVersion: (reportId: string, versionNumber: number) => Promise<string>;
  insertApproval: (reportId: string) => Promise<string>;
  getReportRow: (reportId: string) => Promise<Record<string, unknown> | null>;
  getCommentRow: (commentId: string) => Promise<Record<string, unknown> | null>;
  getApprovalRows: (reportId: string) => Promise<Record<string, unknown>[]>;
  countComments: (reportId: string) => Promise<number>;
  countAuditRows: (reportId: string) => Promise<number>;
  countReportsInOrg: (organizationId: string) => Promise<number>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_mr_a_${tag}`;
  const orgBId = `org_mr_b_${tag}`;
  const ownerUserId = `user_mr_owner_${tag}`;
  const attackerUserId = `user_mr_attacker_${tag}`;
  const reportIds: string[] = [];
  const commentIds: string[] = [];
  const auditIds: string[] = [];
  const versionIds: string[] = [];
  const approvalIds: string[] = [];

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'MgmtReports RealDB Org A', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'MgmtReports RealDB Org B', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Owner', 'MR')
     ON CONFLICT (id) DO NOTHING`,
    [ownerUserId, orgAId, `${ownerUserId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Attacker', 'MR')
     ON CONFLICT (id) DO NOTHING`,
    [attackerUserId, orgBId, `${attackerUserId}@local.test`]
  );

  const insertReport: Harness['insertReport'] = async ({ status = 'DRAFT', lockedAt = null }) => {
    const reportId = `mr_${suffix()}`;
    await client.query(
      `INSERT INTO management_reports
         (id, organization_id, project_id, report_type, scope, title, status, generated_by, content, locked_at, finalized_at, finalized_by)
       VALUES ($1, $2, NULL, 'TEAM_MEETING', 'PORTFOLIO', $3, $4, $5, $6, $7,
               CASE WHEN $4 = 'FINAL' THEN CURRENT_TIMESTAMP ELSE NULL END,
               CASE WHEN $4 = 'FINAL' THEN $5 ELSE NULL END)`,
      [
        reportId,
        orgAId,
        `Org A fixture report ${reportId}`,
        status,
        ownerUserId,
        JSON.stringify({ executiveSummary: 'secret org A content' }),
        lockedAt,
      ]
    );
    reportIds.push(reportId);
    return reportId;
  };

  const insertComment: Harness['insertComment'] = async (reportId: string) => {
    const commentId = `mrc_${suffix()}`;
    await client.query(
      `INSERT INTO management_report_comments (id, report_id, content, created_by)
       VALUES ($1, $2, $3, $4)`,
      [commentId, reportId, 'secret org A comment', ownerUserId]
    );
    commentIds.push(commentId);
    return commentId;
  };

  const insertAuditLogRow: Harness['insertAuditLogRow'] = async (reportId: string) => {
    const auditId = `mra_${suffix()}`;
    await client.query(
      `INSERT INTO management_report_audit_log (id, report_id, action, actor_id, details)
       VALUES ($1, $2, 'CREATED', $3, '{}')`,
      [auditId, reportId, ownerUserId]
    );
    auditIds.push(auditId);
    return auditId;
  };

  const insertVersion: Harness['insertVersion'] = async (
    reportId: string,
    versionNumber: number
  ) => {
    const versionId = `mrv_${suffix()}`;
    await client.query(
      `INSERT INTO management_report_versions
         (id, report_id, version_number, version_label, content, ai_narrative, ai_warnings, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5, 'secret org A narrative', '[]', 'fixture', $6)`,
      [
        versionId,
        reportId,
        versionNumber,
        `${versionNumber}.0`,
        JSON.stringify({ executiveSummary: `secret org A version ${versionNumber}` }),
        ownerUserId,
      ]
    );
    versionIds.push(versionId);
    return versionId;
  };

  const insertApproval: Harness['insertApproval'] = async (reportId: string) => {
    const approvalId = `mrap_${suffix()}`;
    await client.query(
      `INSERT INTO management_report_approvals (id, report_id, approval_level, required_role, status)
       VALUES ($1, $2, 1, 'MANAGER', 'PENDING')`,
      [approvalId, reportId]
    );
    approvalIds.push(approvalId);
    return approvalId;
  };

  const getReportRow: Harness['getReportRow'] = async (reportId: string) => {
    const res = await client.query(`SELECT * FROM management_reports WHERE id = $1`, [reportId]);
    return res.rows[0] || null;
  };

  const getCommentRow: Harness['getCommentRow'] = async (commentId: string) => {
    const res = await client.query(`SELECT * FROM management_report_comments WHERE id = $1`, [
      commentId,
    ]);
    return res.rows[0] || null;
  };

  const getApprovalRows: Harness['getApprovalRows'] = async (reportId: string) => {
    const res = await client.query(
      `SELECT * FROM management_report_approvals WHERE report_id = $1 ORDER BY approval_level`,
      [reportId]
    );
    return res.rows;
  };

  const countComments: Harness['countComments'] = async (reportId: string) => {
    const res = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM management_report_comments WHERE report_id = $1`,
      [reportId]
    );
    return Number(res.rows[0]?.n || 0);
  };

  const countAuditRows: Harness['countAuditRows'] = async (reportId: string) => {
    const res = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM management_report_audit_log WHERE report_id = $1`,
      [reportId]
    );
    return Number(res.rows[0]?.n || 0);
  };

  const countReportsInOrg: Harness['countReportsInOrg'] = async (organizationId: string) => {
    const res = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM management_reports WHERE organization_id = $1`,
      [organizationId]
    );
    return Number(res.rows[0]?.n || 0);
  };

  const cleanup = async () => {
    try {
      if (commentIds.length) {
        await client.query(`DELETE FROM management_report_comments WHERE id = ANY($1)`, [
          commentIds,
        ]);
      }
      if (auditIds.length) {
        await client.query(`DELETE FROM management_report_audit_log WHERE id = ANY($1)`, [
          auditIds,
        ]);
      }
      // Belt-and-braces: also sweep anything the routes themselves wrote
      // against these report ids during the test (comments/audit rows added
      // via HTTP, not just the ones inserted directly above).
      if (versionIds.length) {
        await client.query(`DELETE FROM management_report_versions WHERE id = ANY($1)`, [
          versionIds,
        ]);
      }
      if (approvalIds.length) {
        await client.query(`DELETE FROM management_report_approvals WHERE id = ANY($1)`, [
          approvalIds,
        ]);
      }
      if (reportIds.length) {
        await client.query(
          `DELETE FROM management_report_comments WHERE report_id = ANY($1)`,
          [reportIds]
        );
        await client.query(
          `DELETE FROM management_report_audit_log WHERE report_id = ANY($1)`,
          [reportIds]
        );
        await client.query(
          `DELETE FROM management_report_approvals WHERE report_id = ANY($1)`,
          [reportIds]
        );
        await client.query(
          `DELETE FROM management_report_versions WHERE report_id = ANY($1)`,
          [reportIds]
        );
        await client.query(`DELETE FROM management_reports WHERE id = ANY($1)`, [reportIds]);
      }
      // POST /generate creates reports this file never learns the ids of —
      // sweep anything left in either fixture org so no test rows survive.
      const orgs = [orgAId, orgBId];
      for (const child of [
        'management_report_comments',
        'management_report_audit_log',
        'management_report_approvals',
        'management_report_versions',
      ]) {
        await client.query(
          `DELETE FROM ${child} WHERE report_id IN
             (SELECT id FROM management_reports WHERE organization_id = ANY($1))`,
          [orgs]
        );
      }
      await client.query(`DELETE FROM management_reports WHERE organization_id = ANY($1)`, [orgs]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return {
    client,
    orgAId,
    orgBId,
    ownerUserId,
    attackerUserId,
    cleanup,
    insertReport,
    insertComment,
    insertAuditLogRow,
    insertVersion,
    insertApproval,
    getReportRow,
    getCommentRow,
    getApprovalRows,
    countComments,
    countAuditRows,
    countReportsInOrg,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DEC-131 P1-4 + DEC-136 — management-reports org scoping (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — management-reports org-scope ' +
        'realdb tests skipped. See file header for the docker run + migrate + vitest command.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  // -------------------------------------------------------------------
  // GET /:id/comments
  // -------------------------------------------------------------------

  itDB('GET /:id/comments — 404 for a real user in a different real org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertComment(reportId);
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/comments`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
  });

  itDB('GET /:id/comments — 200 with the comment for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertComment(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.comments)).toBe(true);
    expect(res.body.comments.length).toBeGreaterThan(0);
    expect(res.body.comments.some((c: any) => c.content === 'secret org A comment')).toBe(true);
  });

  itDB(
    'GET /:id/comments — a ?organizationId= injection from the attacker is ignored (still 404)',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      await h.insertComment(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .get(`/api/management-reports/${reportId}/comments?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
    }
  );

  // -------------------------------------------------------------------
  // GET /:id/audit-log
  // -------------------------------------------------------------------

  itDB('GET /:id/audit-log — 404 for a real user in a different real org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertAuditLogRow(reportId);
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/audit-log`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
  });

  itDB('GET /:id/audit-log — 200 with the log for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertAuditLogRow(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/audit-log`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.log)).toBe(true);
    expect(res.body.log.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------
  // POST /:id/finalize
  // -------------------------------------------------------------------

  itDB(
    'POST /:id/finalize — 404 for a different real org, and ZERO row changes',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({ status: 'DRAFT' });
      const before = await h.getReportRow(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/finalize`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({});

      expect(res.status).toBe(404);

      const after = await h.getReportRow(reportId);
      expect(after?.status).toBe('DRAFT');
      expect(after?.finalized_at).toBeNull();
      expect(after?.finalized_by).toBeNull();
      expect(after?.locked_at).toBeNull();
      expect(after).toEqual(before);
    }
  );

  itDB(
    'POST /:id/finalize — a body organizationId= injection from the attacker is ignored (still 404, zero changes)',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({ status: 'DRAFT' });
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/finalize`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ organizationId: h.orgAId });

      expect(res.status).toBe(404);
      const after = await h.getReportRow(reportId);
      expect(after?.status).toBe('DRAFT');
    }
  );

  itDB('POST /:id/finalize — succeeds for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({ status: 'DRAFT' });
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/finalize`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(200);
    const after = await h.getReportRow(reportId);
    expect(after?.status).toBe('FINAL');
    expect(after?.finalized_at).not.toBeNull();
  });

  // -------------------------------------------------------------------
  // POST /:id/unlock
  // -------------------------------------------------------------------

  itDB(
    'POST /:id/unlock — 404 for a different real org, and ZERO row changes to a FINAL report',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({ status: 'FINAL' });
      const before = await h.getReportRow(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/unlock`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ reason: 'attacker unlock attempt' });

      expect(res.status).toBe(404);

      const after = await h.getReportRow(reportId);
      expect(after?.status).toBe('FINAL');
      expect(after).toEqual(before);
    }
  );

  itDB('POST /:id/unlock — succeeds for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({ status: 'FINAL' });
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/unlock`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'owner unlock' });

    expect(res.status).toBe(200);
    const after = await h.getReportRow(reportId);
    expect(after?.status).toBe('DRAFT');
    expect(after?.locked_at).toBeNull();
  });

  // -------------------------------------------------------------------
  // Sanity: a genuinely missing report id still 404s the same way (no
  // behavioural difference between "missing" and "foreign tenant").
  // -------------------------------------------------------------------

  itDB('GET /:id/comments — a genuinely nonexistent report id also 404s', async (h) => {
    const app = buildApp();
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/mr_does_not_exist_${suffix()}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });

  // ===================================================================
  // DEC-136 — the rest of the router
  // ===================================================================

  // -------------------------------------------------------------------
  // POST /:id/share — P0. The consequence of this one leaves the system:
  // a share token is a URL that can be handed to anyone, so the proof that
  // matters is that NO TOKEN ROW IS EVER WRITTEN for a foreign caller.
  // -------------------------------------------------------------------

  itDB(
    'POST /:id/share — 404 for a different real org, and NO share link is created (zero rows)',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const before = await h.getReportRow(reportId);
      const auditBefore = await h.countAuditRows(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/share`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ expiresInDays: 30 });

      expect(res.status).toBe(404);
      // No share URL handed back to the attacker...
      expect(res.body?.shareUrl).toBeUndefined();

      // ...and, decisively, nothing was written: the report still has no
      // share token, so there is no link in existence to be handed on.
      const after = await h.getReportRow(reportId);
      expect(after?.share_token).toBeNull();
      expect(after?.share_expires_at).toBeNull();
      expect(after).toEqual(before);
      expect(await h.countAuditRows(reportId)).toBe(auditBefore);
    }
  );

  itDB(
    'POST /:id/share — a body organizationId= injection is ignored (still 404, still no token)',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/share?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ expiresInDays: 30, organizationId: h.orgAId });

      expect(res.status).toBe(404);
      const after = await h.getReportRow(reportId);
      expect(after?.share_token).toBeNull();
    }
  );

  itDB('POST /:id/share — succeeds for the owning org and mints a token', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expiresInDays: 7 });

    expect(res.status).toBe(200);
    expect(typeof res.body?.shareUrl).toBe('string');
    const after = await h.getReportRow(reportId);
    expect(after?.share_token).toBeTruthy();
  });

});
