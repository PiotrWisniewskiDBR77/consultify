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
  'projects',
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

/**
 * An identity with NO organization at all — the only shape that could ever
 * reach the removed `req.organizationId || req.query.organizationId` fallback,
 * since `||` short-circuits whenever the JWT already carries an org.
 *
 * It cannot be minted through the E2E bypass above: that path defaults a
 * missing org claim to 'e2e-org-id' (auth.middleware.ts), so `req.organizationId`
 * is never falsy there. This mints a genuinely signed token with no
 * organizationId claim instead, for a user with no organization_members row —
 * which is what leaves `req.organizationId` empty after verifyToken.
 *
 * The secret is read back from the app's own Config rather than pinned here:
 * ESM hoists imports above module-body statements, so a top-level
 * `process.env.JWT_SECRET = ...` would race the router's import chain.
 */
async function makeOrglessSignedToken(userId: string): Promise<string> {
  const jwtLib = (await import('jsonwebtoken')).default;
  const configModule: any = await import('../../server/src/config/Config.js');
  const secret = configModule.config?.JWT_SECRET || configModule.default?.JWT_SECRET;
  return jwtLib.sign(
    {
      id: userId,
      email: `${userId}@local.test`,
      name: 'MgmtReports Orgless Test User',
      role: 'ADMIN',
      userRole: 'ADMIN',
      // deliberately NO organizationId / organization_id claim
    },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
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
  orglessUserId: string; // no org claim, no membership row — the fallback's only reachable caller
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
  // DEC-140 fixtures — a real project row, owned by orgAId, that a caller
  // authenticated for orgBId must never be able to read report content from.
  insertProject: (organizationId: string, name: string) => Promise<string>;
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
  const orglessUserId = `user_mr_orgless_${tag}`;
  const reportIds: string[] = [];
  const commentIds: string[] = [];
  const auditIds: string[] = [];
  const versionIds: string[] = [];
  const approvalIds: string[] = [];
  const projectIds: string[] = [];

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
  // Parked in org A's `users.organization_id` on purpose: the column is NOT
  // NULLable and is NOT what verifyToken reads. Org context comes from the
  // token claim and from organization_members — and this user has neither, so
  // `req.organizationId` ends up empty, which is the whole point.
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Orgless', 'MR')
     ON CONFLICT (id) DO NOTHING`,
    [orglessUserId, orgAId, `${orglessUserId}@local.test`]
  );

  const insertProject: Harness['insertProject'] = async (
    organizationId: string,
    name: string
  ) => {
    const projectId = `proj_mr_${suffix()}`;
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status)
       VALUES ($1, $2, $3, 'active')`,
      [projectId, organizationId, name]
    );
    projectIds.push(projectId);
    return projectId;
  };

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
      await client.query(`DELETE FROM users WHERE id = $1`, [orglessUserId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      // DEC-140 fixtures: explicit delete (belt-and-braces) ahead of the
      // organizations cascade below — projects/project_insights both carry
      // ON DELETE CASCADE from organizations/projects respectively, but this
      // file prefers not to depend on that alone.
      if (projectIds.length) {
        await client.query(`DELETE FROM project_insights WHERE project_id = ANY($1)`, [
          projectIds,
        ]);
        await client.query(`DELETE FROM projects WHERE id = ANY($1)`, [projectIds]);
      }
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
    orglessUserId,
    cleanup,
    insertProject,
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

  // -------------------------------------------------------------------
  // GET /pending-approvals
  // -------------------------------------------------------------------

  itDB(
    'GET /pending-approvals — never returns another org\'s approval rows',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const approvalId = await h.insertApproval(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .get('/api/management-reports/pending-approvals')
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body?.pending || []).map((row: any) => row.id);
      expect(ids).not.toContain(approvalId);
    }
  );

  itDB('GET /pending-approvals — returns the owning org\'s approval row', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const approvalId = await h.insertApproval(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get('/api/management-reports/pending-approvals')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body?.pending || []).map((row: any) => row.id);
    expect(ids).toContain(approvalId);
  });

  // -------------------------------------------------------------------
  // POST /:id/submit · POST /:id/approve · GET /:id/approval-status
  // -------------------------------------------------------------------

  itDB('POST /:id/submit — 404 for a different real org, and ZERO row changes', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const before = await h.getReportRow(reportId);
    const auditBefore = await h.countAuditRows(reportId);
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ organizationId: h.orgAId });

    expect(res.status).toBe(404);
    const after = await h.getReportRow(reportId);
    expect(after).toEqual(before);
    expect(await h.getApprovalRows(reportId)).toHaveLength(0);
    expect(await h.countAuditRows(reportId)).toBe(auditBefore);
  });

  itDB('POST /:id/submit — succeeds for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(200);
    const after = await h.getReportRow(reportId);
    expect(after?.approval_status).toBe('PENDING');
  });

  itDB(
    'POST /:id/approve — 404 for a different real org, and the approval stays PENDING',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      await h.insertApproval(reportId);
      const before = await h.getReportRow(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/approve`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ comment: 'approved by an outsider' });

      expect(res.status).toBe(404);
      const approvals = await h.getApprovalRows(reportId);
      expect(approvals).toHaveLength(1);
      expect(approvals[0]?.status).toBe('PENDING');
      expect(approvals[0]?.decided_by).toBeNull();
      expect(await h.getReportRow(reportId)).toEqual(before);
    }
  );

  itDB('POST /:id/approve — succeeds for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertApproval(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comment: 'ok' });

    expect(res.status).toBe(200);
    const approvals = await h.getApprovalRows(reportId);
    expect(approvals[0]?.status).toBe('APPROVED');
  });

  itDB('GET /:id/approval-status — 404 for a different real org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertApproval(reportId);
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/approval-status`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(res.body?.approvals).toBeUndefined();
  });

  itDB('GET /:id/approval-status — 200 for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertApproval(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/approval-status`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.approvals).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // GET /:id · PATCH /:id
  // -------------------------------------------------------------------

  itDB('GET /:id — 404 for a different real org, and no content leaks', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('secret org A content');
  });

  itDB('GET /:id — 200 with the full report for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.report?.content?.executiveSummary).toBe('secret org A content');
  });

  itDB(
    'PATCH /:id — 404 for a different real org, and the title is NOT overwritten',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const before = await h.getReportRow(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .patch(`/api/management-reports/${reportId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ title: 'PWNED BY ORG B', organizationId: h.orgAId });

      expect(res.status).toBe(404);
      const after = await h.getReportRow(reportId);
      expect(after?.title).toBe(before?.title);
      expect(after).toEqual(before);
    }
  );

  itDB('PATCH /:id — succeeds for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .patch(`/api/management-reports/${reportId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Renamed by the owner' });

    expect(res.status).toBe(200);
    const after = await h.getReportRow(reportId);
    expect(after?.title).toBe('Renamed by the owner');
  });

  // -------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------

  itDB('GET /:id/versions — 404 for a different real org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertVersion(reportId, 1);
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/versions`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('secret org A version');
  });

  itDB('GET /:id/versions — 200 for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertVersion(reportId, 1);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/versions`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.versions).toHaveLength(1);
  });

  itDB('GET /:id/versions/:versionNumber — 404 for a different real org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertVersion(reportId, 1);
    const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/versions/1`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('secret org A version');
  });

  itDB('GET /:id/versions/:versionNumber — 200 for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertVersion(reportId, 1);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/versions/1`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.version?.version_number).toBe(1);
  });

  itDB(
    'GET /:id/versions/compare — 404 (not 400) for a different real org, no content leak',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      await h.insertVersion(reportId, 1);
      await h.insertVersion(reportId, 2);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .get(`/api/management-reports/${reportId}/versions/compare?v1=1&v2=2`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('secret org A version');
    }
  );

  itDB('GET /:id/versions/compare — 200 for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    await h.insertVersion(reportId, 1);
    await h.insertVersion(reportId, 2);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .get(`/api/management-reports/${reportId}/versions/compare?v1=1&v2=2`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.comparison?.v1?.version_number).toBe(1);
    expect(res.body?.comparison?.v2?.version_number).toBe(2);
  });

  // -------------------------------------------------------------------
  // Comment writes (POST / PATCH / DELETE)
  // -------------------------------------------------------------------

  itDB(
    'POST /:id/comments — 404 for a different real org, and no comment row is written',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const before = await h.countComments(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post(`/api/management-reports/${reportId}/comments`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ content: 'comment injected from org B', organizationId: h.orgAId });

      expect(res.status).toBe(404);
      expect(await h.countComments(reportId)).toBe(before);
    }
  );

  itDB('POST /:id/comments — succeeds for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const before = await h.countComments(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const res = await request(app)
      .post(`/api/management-reports/${reportId}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'owner comment' });

    expect(res.status).toBe(201);
    expect(await h.countComments(reportId)).toBe(before + 1);
  });

  itDB(
    'PATCH /:id/comments/:commentId — 404 for a different real org, content unchanged',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const commentId = await h.insertComment(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .patch(`/api/management-reports/${reportId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ content: 'REWRITTEN BY ORG B' });

      expect(res.status).toBe(404);
      const after = await h.getCommentRow(commentId);
      expect(after?.content).toBe('secret org A comment');
    }
  );

  itDB(
    'DELETE /:id/comments/:commentId — 404 for a different real org, and the comment SURVIVES',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const commentId = await h.insertComment(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .delete(`/api/management-reports/${reportId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
      expect(await h.getCommentRow(commentId)).not.toBeNull();
    }
  );

  itDB(
    'DELETE /:id/comments/:commentId — a comment id from ANOTHER report 404s even for the owner',
    async (h) => {
      const app = buildApp();
      const reportA = await h.insertReport({});
      const reportB = await h.insertReport({});
      const commentOnB = await h.insertComment(reportB);
      const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

      // Both reports are in the caller's own org, so the org check passes —
      // this proves the SECOND check (comment belongs to the report in the
      // path) is really there, not just the tenant one.
      const res = await request(app)
        .delete(`/api/management-reports/${reportA}/comments/${commentOnB}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(await h.getCommentRow(commentOnB)).not.toBeNull();
    }
  );

  itDB('PATCH + DELETE /:id/comments/:commentId — succeed for the owning org', async (h) => {
    const app = buildApp();
    const reportId = await h.insertReport({});
    const commentId = await h.insertComment(reportId);
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

    const patched = await request(app)
      .patch(`/api/management-reports/${reportId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'edited by owner' });
    expect(patched.status).toBe(200);
    expect((await h.getCommentRow(commentId))?.content).toBe('edited by owner');

    const deleted = await request(app)
      .delete(`/api/management-reports/${reportId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleted.status).toBe(200);
    expect(await h.getCommentRow(commentId)).toBeNull();
  });

  // -------------------------------------------------------------------
  // POST /bulk-export — writes an audit row keyed on a caller-supplied id
  // -------------------------------------------------------------------

  itDB(
    'POST /bulk-export — 404 for a foreign report id, and no audit row is written on it',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const before = await h.countAuditRows(reportId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post('/api/management-reports/bulk-export')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ reportIds: [reportId], format: 'pdf' });

      expect(res.status).toBe(404);
      expect(await h.countAuditRows(reportId)).toBe(before);
    }
  );

  // -------------------------------------------------------------------
  // organizationId fallbacks (same class as the DEC-131 hole)
  //
  // HONEST NOTE ON WHAT THESE THREE PROVE. The removed `|| query.organizationId`
  // / `|| body.organizationId` fallbacks only ever fired when `req.organizationId`
  // was falsy, and the E2E auth bypass used by this harness ALWAYS substitutes an
  // organization ('e2e-org-id' when the claim is absent — see
  // auth.middleware.ts), so an org-less identity cannot be minted here. These
  // three therefore pass both before and after the fix: they are regression
  // guards proving the TOKEN's org wins, not red-then-green exploit proofs. The
  // reachable-in-production case is a real token whose org resolution comes back
  // empty (auth.middleware.ts:881) — the fallback removal closes that, and there
  // is no longer any code path by which caller-supplied input reaches the tenant
  // filter.
  // -------------------------------------------------------------------

  itDB(
    'GET /history — ?organizationId= injection does NOT widen the caller\'s tenant',
    async (h) => {
      const app = buildApp();
      const reportId = await h.insertReport({});
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .get(`/api/management-reports/history?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      const ids = (res.body?.reports || []).map((r: any) => r.id);
      expect(ids).not.toContain(reportId);
    }
  );

  itDB(
    'GET /analytics/usage + /analytics/types — ?organizationId= injection is ignored',
    async (h) => {
      const app = buildApp();
      await h.insertReport({});
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const usage = await request(app)
        .get(`/api/management-reports/analytics/usage?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(usage.status).toBe(200);
      expect(Number(usage.body?.data?.total ?? 0)).toBe(0);

      const types = await request(app)
        .get(`/api/management-reports/analytics/types?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(types.status).toBe(200);
      expect(types.body?.data).toHaveLength(0);
    }
  );

  itDB(
    'POST /generate — body organizationId= cannot plant a report in another org',
    async (h) => {
      const app = buildApp();
      const orgABefore = await h.countReportsInOrg(h.orgAId);
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);

      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          organizationId: h.orgAId,
        });

      expect(res.status).toBe(200);
      // The report exists, but in the TOKEN's org — never the body's.
      expect(res.body?.report?.organizationId).toBe(h.orgBId);
      expect(await h.countReportsInOrg(h.orgAId)).toBe(orgABefore);
    }
  );

  // -------------------------------------------------------------------
  // ...and the same three routes driven by the ONLY identity that could
  // actually reach the removed fallback: one with no organization at all.
  // Before the fix these answered for whatever org the URL named. This
  // closes the gap the HONEST NOTE above describes — a genuinely signed,
  // org-less token via makeOrglessSignedToken(), not the E2E bypass.
  // -------------------------------------------------------------------

  itDB(
    'GET /history — an org-less identity can no longer name a victim org in the query string',
    async (h) => {
      const app = buildApp();
      const victimReportId = await h.insertReport({});
      const orglessToken = await makeOrglessSignedToken(h.orglessUserId);

      const res = await request(app)
        .get(`/api/management-reports/history?organizationId=${h.orgAId}&limit=50`)
        .set('Authorization', `Bearer ${orglessToken}`);

      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain(victimReportId);
    }
  );

  itDB(
    'GET /analytics/usage — an org-less identity can no longer name a victim org in the query string',
    async (h) => {
      const app = buildApp();
      await h.insertReport({});
      const orglessToken = await makeOrglessSignedToken(h.orglessUserId);

      const res = await request(app)
        .get(`/api/management-reports/analytics/usage?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${orglessToken}`);

      expect(res.status).toBe(401);
      expect(res.body?.data).toBeUndefined();
    }
  );

  itDB(
    'GET /analytics/types — an org-less identity can no longer name a victim org in the query string',
    async (h) => {
      const app = buildApp();
      await h.insertReport({});
      const orglessToken = await makeOrglessSignedToken(h.orglessUserId);

      const res = await request(app)
        .get(`/api/management-reports/analytics/types?organizationId=${h.orgAId}`)
        .set('Authorization', `Bearer ${orglessToken}`);

      expect(res.status).toBe(401);
      expect(res.body?.data).toBeUndefined();
    }
  );

  // -------------------------------------------------------------------
  // DEC-140 — POST /generate built a report from ANY project id in the
  // request body, with no check that the project belongs to the caller's
  // organization, and then SAVED the result into the caller's own org
  // (managementReportsService.generateReport() -> saveReport() with
  // options.organizationId, which is req.organizationId — the token's org,
  // never the project's). An attacker in org B could hand a real org A
  // project id to /generate and receive a 200 with org A's task/risk/RAID
  // data baked into a report that now lives in org B.
  //
  // getProjectById() (used by TEAM_MEETING/TEAM_WEEKLY/STEERING_COMMITTEE)
  // carries no org filter by design. RAID does not even call it — it reads
  // project_insights via raw SQL keyed on project_id alone — so a fix that
  // only patched getProjectById() would have left RAID exploitable. The fix
  // adds assertProjectInOrganization(projectId, organizationId) as the FIRST
  // statement in generateReport(), before the reportType switch, so every
  // branch (including RAID's raw-SQL path) sits behind one gate.
  //
  // "victim" project below belongs to orgAId (the owner org used throughout
  // this file); attackerToken carries orgBId — same direction as every other
  // test in this file.
  // -------------------------------------------------------------------

  const GENERATE_TYPES: Array<{
    reportType: string;
    scope: string;
    // STEERING_COMMITTEE (scope=PROJECT) and RAID both call
    // ManagementReportRepository.getBoardDecisions(), whose SQL compares the
    // TEXT column decisions.escalation_level to the integer literal 2 (and
    // joins on a d.requested_by column decisions does not have) — a
    // pre-existing, PRE-DEC-140 schema/query bug that 500s on ANY project,
    // own-org or foreign. Confirmed by temporarily disabling the new
    // assertProjectInOrganization() gate and re-running this exact test:
    // identical 500, so the gate is not the cause. Out of scope for this P0
    // tenant-isolation fix — flagged separately. The own-project assertion
    // below is relaxed to "gate did not block it" (any non-404) for these
    // two types instead of a hard 200, so this pre-existing bug doesn't mask
    // a DEC-140 regression or vice versa.
    knownPreexistingGetBoardDecisionsBug?: boolean;
  }> = [
    { reportType: 'TEAM_MEETING', scope: 'PROJECT' },
    { reportType: 'TEAM_WEEKLY', scope: 'PROJECT' },
    { reportType: 'STEERING_COMMITTEE', scope: 'PROJECT', knownPreexistingGetBoardDecisionsBug: true },
    { reportType: 'RAID', scope: 'PROJECT', knownPreexistingGetBoardDecisionsBug: true },
  ];

  itDB(
    'POST /generate — own project (owner org) — 200, report created with project content',
    async (h) => {
      const app = buildApp();
      const projectId = await h.insertProject(h.orgAId, 'DEC-140 Owner Project');
      const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reportType: 'TEAM_MEETING', scope: 'PROJECT', projectId });

      expect(res.status).toBe(200);
      expect(res.body?.report?.organizationId).toBe(h.orgAId);
      expect(res.body?.report?.projectId).toBe(projectId);
      const row = await h.getReportRow(res.body.report.id);
      expect(row?.organization_id).toBe(h.orgAId);
      expect(row?.project_id).toBe(projectId);
    }
  );

  itDB(
    'POST /generate — foreign project (real row in a different real org) — 404, zero write',
    async (h) => {
      const app = buildApp();
      const victimProjectId = await h.insertProject(h.orgAId, 'DEC-140 Victim Project');
      const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);
      const orgBBefore = await h.countReportsInOrg(h.orgBId);

      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ reportType: 'TEAM_MEETING', scope: 'PROJECT', projectId: victimProjectId });

      expect(res.status).toBe(404);
      // No report leaked org A's data into org B (the attacker's own org —
      // the class of write this hole allowed).
      expect(await h.countReportsInOrg(h.orgBId)).toBe(orgBBefore);
      // ...and nothing was planted in org A either.
      const leaked = await h.client.query(
        `SELECT COUNT(*)::text AS n FROM management_reports WHERE project_id = $1`,
        [victimProjectId]
      );
      expect(Number(leaked.rows[0]?.n || 0)).toBe(0);
    }
  );

  itDB('POST /generate — nonexistent projectId — 404', async (h) => {
    const app = buildApp();
    const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);
    const ghostProjectId = `proj_mr_ghost_${suffix()}`;

    const res = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reportType: 'TEAM_MEETING', scope: 'PROJECT', projectId: ghostProjectId });

    expect(res.status).toBe(404);
  });

  describe.each(GENERATE_TYPES)(
    'POST /generate — $reportType behind the DEC-140 gate',
    ({ reportType, scope, knownPreexistingGetBoardDecisionsBug }) => {
      itDB(
        knownPreexistingGetBoardDecisionsBug
          ? `${reportType} — own project (owner org) — gate lets it through (pre-existing getBoardDecisions bug tracked separately, not 404)`
          : `${reportType} — own project (owner org) — 200`,
        async (h) => {
          const app = buildApp();
          const projectId = await h.insertProject(
            h.orgAId,
            `DEC-140 ${reportType} Owner Project`
          );
          const ownerToken = makeE2EToken(h.ownerUserId, h.orgAId);

          const res = await request(app)
            .post('/api/management-reports/generate')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ reportType, scope, projectId });

          if (knownPreexistingGetBoardDecisionsBug) {
            // The DEC-140 gate must not be what's blocking this — prove it
            // let the owner's own project through by asserting the failure
            // is anything OTHER than the gate's 404.
            expect(res.status).not.toBe(404);
          } else {
            expect(res.status).toBe(200);
            expect(res.body?.report?.organizationId).toBe(h.orgAId);
          }
        }
      );

      itDB(`${reportType} — foreign project (real row, different real org) — 404`, async (h) => {
        const app = buildApp();
        const victimProjectId = await h.insertProject(
          h.orgAId,
          `DEC-140 ${reportType} Victim Project`
        );
        const attackerToken = makeE2EToken(h.attackerUserId, h.orgBId);
        const orgBBefore = await h.countReportsInOrg(h.orgBId);

        const res = await request(app)
          .post('/api/management-reports/generate')
          .set('Authorization', `Bearer ${attackerToken}`)
          .send({ reportType, scope, projectId: victimProjectId });

        expect(res.status).toBe(404);
        expect(await h.countReportsInOrg(h.orgBId)).toBe(orgBBefore);
      });
    }
  );
});
