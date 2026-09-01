/**
 * Cross-org IDOR regression against a REAL Postgres database (no mocks) for
 * the three "żywe" (live, unconditionally mounted) permission holes found in
 * docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md (2026-09-01):
 *
 *   1. PMO Project Members  — server/src/routes/pmo/project-members.routes.ts
 *      mounted at /api/project-members. Worst finding: an org-B token could
 *      inject its own user as ADMIN into an org-A project (privilege
 *      injection, not just read/write).
 *   2. Consultify Studio    — server/src/routes/studio.routes.ts mounted at
 *      /api/studio. Full CRUD cross-org: read, overwrite, and delete another
 *      organization's canvas/mind-map document, plus its snapshot history.
 *   3. Notifications Escalations — server/src/routes/notifications/notifications.routes.ts
 *      mounted at /api/notifications. Cross-org admin could read and mutate
 *      (`decisions.escalation_level`/`status`) another organization's board
 *      decision escalation state.
 *
 * Follows the exact harness convention established by
 * tests/integration/table-platform.idor.realdb.test.ts: a real Express
 * router (not a hand-rolled stub), the real `verifyToken` auth middleware via
 * the E2E_MODE unsigned-JWT bypass (server/src/middleware/auth.middleware.ts
 * ~L1030-1123 — the same mechanism tests/e2e/tools/collab-*.spec.ts use for
 * real two-user runs), and a `pgReachable()` precondition so the suite
 * reports a clean, non-failing skip when no Postgres is configured.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name fix-upr-pg -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=fix_upr -p 6215:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test RUN_DB_TESTS=1 DB_TYPE=postgres \
 *     DATABASE_URL=postgresql://postgres:postgres@localhost:6215/fix_upr \
 *     npx tsx server/scripts/migrate.postgres.ts
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:6215/fix_upr \
 *     npx vitest run tests/integration/uprawnienia-trzy-zywe.idor.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import projectMembersRoutes from '../../server/src/routes/pmo/project-members.routes.js';
import studioRoutes from '../../server/src/routes/studio.routes.js';
import notificationsRoutes from '../../server/src/routes/notifications/notifications.routes.js';

// ---------------------------------------------------------------------------
// Same env-gate convention as table-platform.idor.realdb.test.ts — only flips
// MOCK_DB/RUN_DB_TESTS/DB_TYPE/E2E_MODE when a database is actually
// configured, and only before any `beforeAll`/`it` body runs a real request.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

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

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role: string = 'ADMIN'): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'Uprawnienia RealDB Test User',
    role,
    userRole: role,
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Family 1 — PMO Project Members (/api/project-members)
// ---------------------------------------------------------------------------

interface PmHarness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  projectId: string;
  memberId: string;
  cleanup: () => Promise<void>;
}

const PM_REQUIRED_TABLES = ['organizations', 'users', 'projects', 'project_members'] as const;

function buildPmApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/project-members', projectMembersRoutes);
  return app;
}

async function setupPmHarness(): Promise<PmHarness | null> {
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
    if (!(await tablesExist(client, PM_REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_pm_a_${tag}`;
  const orgBId = `org_pm_b_${tag}`;
  const userAId = `user_pm_a_${tag}`;
  const userBId = `user_pm_b_${tag}`;
  const projectId = `proj_pm_${tag}`;
  const memberId = `member_pm_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'PM RealDB Org A', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'PM RealDB Org B', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );
  await client.query(
    `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, 'PM RealDB Project (org A)')`,
    [projectId, orgAId]
  );
  // project_members.user_id / added_by_id are FK'd to users(id) — seed both
  // test identities so a (hypothetically) successful cross-org write would
  // not be masked by an unrelated "user not found" 404 from the route's own
  // user-existence check.
  await client.query(
    `INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [userBId, orgBId, `${userBId}@local.test`]
  );
  await client.query(
    `INSERT INTO project_members (id, project_id, user_id, project_role, added_by_id) VALUES ($1, $2, $3, 'TASK_ASSIGNEE', $4)`,
    [memberId, projectId, userAId, userAId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM project_members WHERE project_id = $1`, [projectId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // leaking a few rows is acceptable; a hung/throwing cleanup is not
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userBId, projectId, memberId, cleanup };
}

describe('M-project-members — GET/POST/PUT/DELETE /project-members/:projectId(/:memberId) IDOR fix (real Postgres)', () => {
  let harness: PmHarness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — project-members IDOR realdb tests skipped.'
    );
  }

  beforeAll(async () => {
    harness = await setupPmHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: PmHarness) => Promise<void>, timeoutMs = 20_000) =>
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

  itDB(
    'POST /project-members/:projectId — cross-org attacker CANNOT inject itself as ADMIN (worst finding)',
    async (h) => {
      const app = buildPmApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const res = await request(app)
        .post(`/api/project-members/${h.projectId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ userId: h.userBId, role: 'ADMIN' });

      expect(res.status).toBe(404);

      const injected = await h.client.query(
        `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [h.projectId, h.userBId]
      );
      expect(injected.rows.length).toBe(0);
    }
  );

  itDB('POST /project-members/:projectId — owner (same org) can still add a member', async (h) => {
    const app = buildPmApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const newUserId = `user_pm_new_${suffix()}`;
    await h.client.query(
      `INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [newUserId, h.orgAId, `${newUserId}@local.test`]
    );

    const res = await request(app)
      .post(`/api/project-members/${h.projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: newUserId, role: 'MEMBER' });

    expect(res.status).toBe(201);
    const row = await h.client.query(
      `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [h.projectId, newUserId]
    );
    expect(row.rows.length).toBe(1);
  });

  itDB('GET /project-members/:projectId — cross-org attacker gets 404, not the member list', async (h) => {
    const app = buildPmApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);
    const res = await request(app)
      .get(`/api/project-members/${h.projectId}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);
  });

  itDB('GET /project-members/:projectId — owner (same org) still sees the member list', async (h) => {
    const app = buildPmApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get(`/api/project-members/${h.projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((m: any) => m.id === h.memberId)).toBe(true);
  });

  itDB(
    'PUT /project-members/:projectId/:memberId — cross-org attacker gets 404, victim role unchanged',
    async (h) => {
      const before = await h.client.query(`SELECT project_role FROM project_members WHERE id = $1`, [
        h.memberId,
      ]);
      const app = buildPmApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .put(`/api/project-members/${h.projectId}/${h.memberId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(404);
      const after = await h.client.query(`SELECT project_role FROM project_members WHERE id = $1`, [
        h.memberId,
      ]);
      expect(after.rows[0]?.project_role).toBe(before.rows[0]?.project_role);
      expect(after.rows[0]?.project_role).not.toBe('ADMIN');
    }
  );

  itDB('PUT /project-members/:projectId/:memberId — owner (same org) can still update the role', async (h) => {
    const app = buildPmApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .put(`/api/project-members/${h.projectId}/${h.memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'LEAD' });

    expect(res.status).toBe(200);
    const row = await h.client.query(`SELECT project_role FROM project_members WHERE id = $1`, [
      h.memberId,
    ]);
    expect(row.rows[0]?.project_role).toBe('LEAD');
  });

  itDB(
    'DELETE /project-members/:projectId/:memberId — cross-org attacker gets 404, victim member still exists',
    async (h) => {
      const app = buildPmApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .delete(`/api/project-members/${h.projectId}/${h.memberId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
      const after = await h.client.query(`SELECT id FROM project_members WHERE id = $1`, [h.memberId]);
      expect(after.rows.length).toBe(1);
    }
  );

  itDB('DELETE /project-members/:projectId/:memberId — owner (same org) can still remove the member', async (h) => {
    const app = buildPmApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .delete(`/api/project-members/${h.projectId}/${h.memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const after = await h.client.query(`SELECT id FROM project_members WHERE id = $1`, [h.memberId]);
    expect(after.rows.length).toBe(0);
  });

  itDB('POST /project-members/:projectId/invite — cross-org attacker gets 404, no invite created', async (h) => {
    const app = buildPmApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);
    const email = `victim-invite-${suffix()}@local.test`;
    const res = await request(app)
      .post(`/api/project-members/${h.projectId}/invite`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ email });

    expect(res.status).toBe(404);
  });

  itDB('GET /project-members/:projectId — nonexistent projectId gets 404 (not a leak)', async (h) => {
    const app = buildPmApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get(`/api/project-members/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Family 2 — Consultify Studio (/api/studio)
// ---------------------------------------------------------------------------

interface StudioHarness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  documentId: string;
  snapshotId: string;
  cleanup: () => Promise<void>;
}

const STUDIO_REQUIRED_TABLES = ['organizations', 'users', 'studio_documents', 'studio_snapshots'] as const;

function buildStudioApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/studio', studioRoutes);
  return app;
}

async function setupStudioHarness(): Promise<StudioHarness | null> {
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
    if (!(await tablesExist(client, STUDIO_REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_studio_a_${tag}`;
  const orgBId = `org_studio_b_${tag}`;
  const userAId = `user_studio_a_${tag}`;
  const userBId = `user_studio_b_${tag}`;
  const documentId = `doc_studio_${tag}`;
  const snapshotId = `snap_studio_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Studio RealDB Org A', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Studio RealDB Org B', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );
  // created_by is intentionally a THIRD identity (neither userA nor userB) so
  // the only path to access in getDocument()'s `organization_id === orgId ||
  // created_by === userId` check is the organization_id match — exactly the
  // guard this suite proves.
  const createdBy = `user_studio_creator_${tag}`;
  // studio_snapshots.created_by is FK'd to users(id) — seed the row so the
  // snapshot insert below doesn't violate the constraint.
  await client.query(
    `INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [createdBy, orgAId, `${createdBy}@local.test`]
  );
  await client.query(
    `INSERT INTO studio_documents (id, organization_id, name, nodes_json, edges_json, created_by)
     VALUES ($1, $2, 'OrgA Secret Canvas', '[]', '[]', $3)`,
    [documentId, orgAId, createdBy]
  );
  await client.query(
    `INSERT INTO studio_snapshots (id, document_id, version, nodes_json, edges_json, snapshot_reason, created_by)
     VALUES ($1, $2, 1, '[]', '[]', 'seed', $3)`,
    [snapshotId, documentId, createdBy]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM studio_snapshots WHERE document_id = $1`, [documentId]);
      await client.query(`DELETE FROM studio_documents WHERE id = $1`, [documentId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // leaking a few rows is acceptable; a hung/throwing cleanup is not
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userBId, documentId, snapshotId, cleanup };
}

describe('M-studio — GET/PUT/DELETE /studio/documents/:id + snapshots IDOR fix (real Postgres)', () => {
  let harness: StudioHarness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error('[skip] Postgres not reachable (or schema incomplete) — studio IDOR realdb tests skipped.');
  }

  beforeAll(async () => {
    harness = await setupStudioHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: StudioHarness) => Promise<void>, timeoutMs = 20_000) =>
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

  itDB('GET /studio/documents/:id — cross-org attacker gets 404, not the document content', async (h) => {
    const app = buildStudioApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);
    const res = await request(app)
      .get(`/api/studio/documents/${h.documentId}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);
  });

  itDB('GET /studio/documents/:id — owner (same org) still reads the document', async (h) => {
    const app = buildStudioApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get(`/api/studio/documents/${h.documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(h.documentId);
    expect(res.body?.name).toBe('OrgA Secret Canvas');
  });

  itDB(
    'PUT /studio/documents/:id — cross-org attacker gets 404 and the victim document is provably unchanged',
    async (h) => {
      const before = await h.client.query(`SELECT name FROM studio_documents WHERE id = $1`, [
        h.documentId,
      ]);
      const app = buildStudioApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .put(`/api/studio/documents/${h.documentId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ name: 'PWNED BY ORG B' });

      expect(res.status).toBe(404);
      const after = await h.client.query(`SELECT name FROM studio_documents WHERE id = $1`, [
        h.documentId,
      ]);
      expect(after.rows[0]?.name).toBe(before.rows[0]?.name);
      expect(after.rows[0]?.name).not.toBe('PWNED BY ORG B');
    }
  );

  itDB('PUT /studio/documents/:id — owner (same org) can still rename the document', async (h) => {
    const app = buildStudioApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .put(`/api/studio/documents/${h.documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Renamed by owner' });

    expect(res.status).toBe(200);
    expect(res.body?.name).toBe('Renamed by owner');
    const row = await h.client.query(`SELECT name FROM studio_documents WHERE id = $1`, [
      h.documentId,
    ]);
    expect(row.rows[0]?.name).toBe('Renamed by owner');
  });

  itDB(
    'GET /studio/documents/:id/snapshots — cross-org attacker gets an empty list, not the victim snapshot history',
    async (h) => {
      const app = buildStudioApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .get(`/api/studio/documents/${h.documentId}/snapshots`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  );

  itDB('GET /studio/documents/:id/snapshots — owner (same org) still sees the snapshot history', async (h) => {
    const app = buildStudioApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get(`/api/studio/documents/${h.documentId}/snapshots`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((s: any) => s.id === h.snapshotId)).toBe(true);
  });

  itDB(
    'POST /studio/documents/:id/snapshots — cross-org attacker cannot create a snapshot of the victim document',
    async (h) => {
      const before = await h.client.query(`SELECT id FROM studio_snapshots WHERE document_id = $1`, [
        h.documentId,
      ]);
      const app = buildStudioApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .post(`/api/studio/documents/${h.documentId}/snapshots`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ reason: 'attacker' });

      expect(res.status).not.toBe(201);
      const after = await h.client.query(`SELECT id FROM studio_snapshots WHERE document_id = $1`, [
        h.documentId,
      ]);
      expect(after.rows.length).toBe(before.rows.length);
    }
  );

  itDB(
    'POST /studio/snapshots/:snapshotId/restore — cross-org attacker gets 404, victim document is unchanged',
    async (h) => {
      const before = await h.client.query(`SELECT name FROM studio_documents WHERE id = $1`, [
        h.documentId,
      ]);
      const app = buildStudioApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .post(`/api/studio/snapshots/${h.snapshotId}/restore`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
      const after = await h.client.query(`SELECT name FROM studio_documents WHERE id = $1`, [
        h.documentId,
      ]);
      expect(after.rows[0]?.name).toBe(before.rows[0]?.name);
    }
  );

  itDB(
    'DELETE /studio/documents/:id — cross-org attacker gets 404 and the victim document provably still exists',
    async (h) => {
      const app = buildStudioApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .delete(`/api/studio/documents/${h.documentId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
      const after = await h.client.query(`SELECT id FROM studio_documents WHERE id = $1`, [
        h.documentId,
      ]);
      expect(after.rows.length).toBe(1);
    }
  );

  itDB('DELETE /studio/documents/:id — owner (same org) can still delete the document', async (h) => {
    const app = buildStudioApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .delete(`/api/studio/documents/${h.documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const after = await h.client.query(`SELECT id FROM studio_documents WHERE id = $1`, [
      h.documentId,
    ]);
    expect(after.rows.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Family 3 — Notifications Escalations (/api/notifications/escalations)
// ---------------------------------------------------------------------------

interface EscHarness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  projectId: string;
  decisionId: string;
  cleanup: () => Promise<void>;
}

const ESC_REQUIRED_TABLES = ['organizations', 'users', 'projects', 'decisions'] as const;

function buildEscApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRoutes);
  return app;
}

async function setupEscHarness(): Promise<EscHarness | null> {
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
    if (!(await tablesExist(client, ESC_REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_esc_a_${tag}`;
  const orgBId = `org_esc_b_${tag}`;
  const userAId = `user_esc_a_${tag}`;
  const userBId = `user_esc_b_${tag}`;
  const projectId = `proj_esc_${tag}`;
  const decisionId = `dec_esc_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Esc RealDB Org A', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Esc RealDB Org B', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );
  await client.query(
    `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, 'Esc RealDB Project (org A)')`,
    [projectId, orgAId]
  );
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  await client.query(
    `INSERT INTO decisions (id, organization_id, project_id, title, status, deadline, priority, escalation_level)
     VALUES ($1, $2, $3, 'OrgA Confidential Board Decision', 'pending', $4, 'HIGH', 'NORMAL')`,
    [decisionId, orgAId, projectId, tenDaysAgo]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM decisions WHERE id = $1`, [decisionId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // leaking a few rows is acceptable; a hung/throwing cleanup is not
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userBId, projectId, decisionId, cleanup };
}

describe('M-escalations — GET/POST /notifications/escalations/:projectId(/run) IDOR fix (real Postgres)', () => {
  let harness: EscHarness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — notifications escalations IDOR realdb tests skipped.'
    );
  }

  beforeAll(async () => {
    harness = await setupEscHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: EscHarness) => Promise<void>, timeoutMs = 20_000) =>
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

  itDB(
    'GET /notifications/escalations/:projectId — cross-org attacker gets an empty list, not the victim decision',
    async (h) => {
      const app = buildEscApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId, 'ADMIN');
      const res = await request(app)
        .get(`/api/notifications/escalations/${h.projectId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  );

  itDB('GET /notifications/escalations/:projectId — owner (same org) still sees the decision', async (h) => {
    const app = buildEscApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId, 'ADMIN');
    const res = await request(app)
      .get(`/api/notifications/escalations/${h.projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((d: any) => d.id === h.decisionId)).toBe(true);
  });

  itDB(
    'POST /notifications/escalations/:projectId/run — cross-org admin gets a no-op result and the victim decision is provably unchanged',
    async (h) => {
      const before = await h.client.query(
        `SELECT escalation_level, status, updated_at FROM decisions WHERE id = $1`,
        [h.decisionId]
      );
      const app = buildEscApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId, 'ADMIN');
      const res = await request(app)
        .post(`/api/notifications/escalations/${h.projectId}/run`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ processed: 0, redAlerts: 0, escalated: 0 });

      const after = await h.client.query(
        `SELECT escalation_level, status, updated_at FROM decisions WHERE id = $1`,
        [h.decisionId]
      );
      expect(after.rows[0]?.escalation_level).toBe(before.rows[0]?.escalation_level);
      expect(after.rows[0]?.status).toBe(before.rows[0]?.status);
      expect(after.rows[0]?.updated_at).toEqual(before.rows[0]?.updated_at);
    }
  );

  itDB(
    'POST /notifications/escalations/:projectId/run — owner admin can still run escalation and the decision is actually updated',
    async (h) => {
      const app = buildEscApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId, 'ADMIN');
      const res = await request(app)
        .post(`/api/notifications/escalations/${h.projectId}/run`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body?.processed).toBeGreaterThanOrEqual(1);

      const row = await h.client.query(`SELECT escalation_level FROM decisions WHERE id = $1`, [
        h.decisionId,
      ]);
      // A HIGH-priority overdue decision escalates straight to 'red'
      // (calculateEscalationLevel: isCritical short-circuit).
      expect(row.rows[0]?.escalation_level).toBe('red');
    }
  );
});
