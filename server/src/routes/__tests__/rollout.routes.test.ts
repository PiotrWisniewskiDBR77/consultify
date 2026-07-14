/**
 * M14 Wdrożenie (Execution) — Rollout register route tests (teczka L-08, Story 4.1).
 *
 * Covers the four persisted Rollout registers exposed by
 * server/src/routes/rollout.routes.ts (KPIs, Risks, Changes, Closures):
 *
 *   - persist + reload: POST creates a row, GET reads it back (per-org store)
 *   - org-scope: a second org never sees / mutates the first org's rows
 *   - L-01 server-side write gating: USER/GUEST (pilot) writes get 403, reads 200;
 *     ADMIN keeps full CRUD. Exercises the REAL rbac.middleware (requireOrgRole).
 *
 * Strategy:
 *   - Mocks `utils/DbPromise` with a tiny in-memory store keyed by table so the
 *     route SQL (INSERT … RETURNING / SELECT … WHERE organization_id = ?) behaves
 *     like a real org-scoped table without a database.
 *   - Mocks only `verifyToken` / `isAuthenticated` (auth is out of scope here) and
 *     injects a configurable `mockUser` (id, organizationId, role).
 *   - Uses the REAL rbac.middleware + validation.middleware so the 403 write gate
 *     and zod body validation are genuinely exercised.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock DB primitives ────────────────────────────────────────────────

const { mockDbAll, mockDbGet, mockDbRun } = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => mockDbAll(...args),
  get: (...args: any[]) => mockDbGet(...args),
  run: (...args: any[]) => mockDbRun(...args),
}));

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── In-memory org-scoped store standing in for the DB ─────────────────────────

interface Row {
  id: string;
  organization_id: string;
  [k: string]: unknown;
}

let store: Record<string, Row[]> = {};
let idSeq = 0;

/** Map an INSERT statement to its target table. */
function tableForInsert(sql: string): string {
  const m = sql.match(/INSERT INTO\s+(\w+)/i);
  return m ? m[1] : 'unknown';
}

/** Map a SELECT/UPDATE/DELETE statement to its target table. */
function tableForMutateOrSelect(sql: string): string {
  const m = sql.match(/(?:FROM|UPDATE)\s+(\w+)/i);
  return m ? m[1] : 'unknown';
}

/**
 * Minimal column extractor: parses `(col_a, col_b, …)` from an INSERT and zips it
 * with the bound params (the first param is always organization_id in these routes).
 */
function columnsForInsert(sql: string): string[] {
  const m = sql.match(/INSERT INTO\s+\w+\s*\(([^)]+)\)/i);
  if (!m) return [];
  return m[1].split(',').map((c) => c.trim());
}

function applyDbMocks() {
  mockDbAll.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = String(sql);
    if (/^\s*INSERT/i.test(s)) {
      const table = tableForInsert(s);
      const cols = columnsForInsert(s);
      const row: Row = {
        id: `row-${++idSeq}`,
        organization_id: String(params[0]),
        created_at: '2026-06-16T00:00:00.000Z',
        updated_at: '2026-06-16T00:00:00.000Z',
      };
      cols.forEach((c, i) => {
        row[c] = params[i] as unknown;
      });
      (store[table] ||= []).push(row);
      return [row];
    }
    if (/^\s*UPDATE/i.test(s)) {
      // Params end with (…, id, organization_id) for the WHERE clause.
      const orgId = String(params[params.length - 1]);
      const id = String(params[params.length - 2]);
      const table = tableForMutateOrSelect(s);
      const row = (store[table] || []).find((r) => r.id === id && r.organization_id === orgId);
      if (!row) return [];
      // Apply `col = COALESCE(?, col)` SET pairs positionally so a reload
      // reflects the PATCH (route binds SET params first, then id, org).
      const setCols = [...s.matchAll(/(\w+)\s*=\s*COALESCE\(\?,\s*\w+\)/gi)].map((m) => m[1]);
      setCols.forEach((col, i) => {
        const val = params[i];
        if (val !== null && val !== undefined) row[col] = val as unknown;
      });
      return [row];
    }
    if (/^\s*SELECT/i.test(s)) {
      const table = tableForMutateOrSelect(s);
      const orgId = String(params[0]);
      return (store[table] || []).filter((r) => r.organization_id === orgId);
    }
    return [];
  });

  mockDbGet.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = String(sql);
    const table = tableForMutateOrSelect(s);
    // exist-checks look up by (id, organization_id)
    const id = String(params[0]);
    const orgId = String(params[1]);
    const row = (store[table] || []).find((r) => r.id === id && r.organization_id === orgId);
    return row;
  });

  mockDbRun.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = String(sql);
    if (/^\s*DELETE/i.test(s)) {
      const table = tableForMutateOrSelect(s);
      const id = String(params[0]);
      const orgId = String(params[1]);
      const list = store[table] || [];
      const idx = list.findIndex((r) => r.id === id && r.organization_id === orgId);
      if (idx >= 0) {
        list.splice(idx, 1);
        return { success: true, changes: 1 };
      }
      return { success: true, changes: 0 };
    }
    return { success: true, changes: 1 };
  });
}

// ── App factory ───────────────────────────────────────────────────────────────

async function makeApp(): Promise<Express> {
  const { default: router } = await import('../rollout.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/rollout', router);
  return app;
}

const ORG_A = 'org-aaa';
const ORG_B = 'org-bbb';
const ADMIN_A = { id: 'admin-a', organizationId: ORG_A, role: 'ADMIN' };
const ADMIN_B = { id: 'admin-b', organizationId: ORG_B, role: 'ADMIN' };
const USER_A = { id: 'user-a', organizationId: ORG_A, role: 'USER' };
const GUEST_A = { id: 'guest-a', organizationId: ORG_A, role: 'GUEST' };
// M14 PMO tier: project-manager gets MANAGE_ROLLOUT; a plain team member does not.
const PM_A = { id: 'pm-a', organizationId: ORG_A, role: 'PROJECT_MANAGER' };
const MEMBER_A = { id: 'member-a', organizationId: ORG_A, role: 'TEAM_MEMBER' };

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  idSeq = 0;
  applyDbMocks();
  mockUser = ADMIN_A;
});

// ── Persist + reload ──────────────────────────────────────────────────────────

describe('Rollout registers — persist + reload (admin)', () => {
  it('KPIs: POST persists and GET reads it back', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const create = await request(app)
      .post('/api/rollout/kpis')
      .send({ name: 'Adoption', target: 90, currentValue: 10 });
    expect(create.status).toBe(201);
    expect(create.body.kpi.organization_id).toBe(ORG_A);

    const list = await request(app).get('/api/rollout/kpis');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.kpis[0].name).toBe('Adoption');
  });

  it('Risks / Changes / Closures: POST persists and GET reads it back', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;

    await request(app).post('/api/rollout/risks').send({ title: 'Vendor delay' });
    await request(app).post('/api/rollout/changes').send({ title: 'Scope change' });
    await request(app).post('/api/rollout/closures').send({ title: 'Sign-off' });

    const risks = await request(app).get('/api/rollout/risks');
    const changes = await request(app).get('/api/rollout/changes');
    const closures = await request(app).get('/api/rollout/closures');

    expect(risks.body.count).toBe(1);
    expect(changes.body.count).toBe(1);
    expect(closures.body.count).toBe(1);
  });

  it('PATCH persists the update and a reload returns the new value', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const create = await request(app)
      .post('/api/rollout/kpis')
      .send({ name: 'Adoption', currentValue: 10 });
    const id = create.body.kpi.id;

    const patch = await request(app)
      .patch(`/api/rollout/kpis/${id}`)
      .send({ name: 'Adoption v2', currentValue: 42 });
    expect(patch.status).toBe(200);

    const list = await request(app).get('/api/rollout/kpis');
    expect(list.body.count).toBe(1);
    expect(list.body.kpis[0].name).toBe('Adoption v2');
    expect(Number(list.body.kpis[0].current_value)).toBe(42);
  });

  it('PATCH on a risk persists status and reload reflects it', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const create = await request(app).post('/api/rollout/risks').send({ title: 'Vendor delay' });
    const id = create.body.risk.id;

    const patch = await request(app).patch(`/api/rollout/risks/${id}`).send({ status: 'CLOSED' });
    expect(patch.status).toBe(200);

    const list = await request(app).get('/api/rollout/risks');
    expect(list.body.risks[0].status).toBe('CLOSED');
  });

  it('DELETE removes the row so a reload no longer returns it', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const create = await request(app).post('/api/rollout/risks').send({ title: 'Temp' });
    const id = create.body.risk.id;

    const del = await request(app).delete(`/api/rollout/risks/${id}`);
    expect(del.status).toBe(200);

    const list = await request(app).get('/api/rollout/risks');
    expect(list.body.count).toBe(0);
  });
});

// ── Org-scope isolation ───────────────────────────────────────────────────────

describe('Rollout registers — org-scope isolation', () => {
  it('org B never sees org A rows', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    await request(app).post('/api/rollout/kpis').send({ name: 'A-only' });

    mockUser = ADMIN_B;
    const list = await request(app).get('/api/rollout/kpis');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(0);
  });

  it('org B cannot PATCH org A rows (404, value unchanged)', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const create = await request(app)
      .post('/api/rollout/kpis')
      .send({ name: 'A-only', currentValue: 10 });
    const id = create.body.kpi.id;

    // Org B admin attempts a cross-org update by id → existence check is
    // org-scoped (WHERE id = ? AND organization_id = ?) so it 404s, no-op.
    mockUser = ADMIN_B;
    const patch = await request(app)
      .patch(`/api/rollout/kpis/${id}`)
      .send({ name: 'hijacked', currentValue: 999 });
    expect(patch.status).toBe(404);

    // Org A's row is untouched.
    mockUser = ADMIN_A;
    const list = await request(app).get('/api/rollout/kpis');
    expect(list.body.count).toBe(1);
    expect(list.body.kpis[0].name).toBe('A-only');
  });

  it('org B cannot delete org A rows (404, row survives)', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const create = await request(app).post('/api/rollout/kpis').send({ name: 'A-only' });
    const id = create.body.kpi.id;

    mockUser = ADMIN_B;
    const del = await request(app).delete(`/api/rollout/kpis/${id}`);
    expect(del.status).toBe(404);

    mockUser = ADMIN_A;
    const list = await request(app).get('/api/rollout/kpis');
    expect(list.body.count).toBe(1);
  });
});

// ── L-01 server-side write gating ─────────────────────────────────────────────

describe('Rollout registers — L-01 server-side write gating', () => {
  it('USER (pilot) can READ rollout registers', async () => {
    const app = await makeApp();
    mockUser = USER_A;
    const list = await request(app).get('/api/rollout/kpis');
    expect(list.status).toBe(200);
  });

  it('USER (pilot) POST is rejected with 403, not 201', async () => {
    const app = await makeApp();
    mockUser = USER_A;
    const res = await request(app).post('/api/rollout/kpis').send({ name: 'tamper' });
    expect(res.status).toBe(403);
  });

  it('USER (pilot) PATCH and DELETE are rejected with 403', async () => {
    const app = await makeApp();
    // Seed a row as admin so the id exists.
    mockUser = ADMIN_A;
    const create = await request(app).post('/api/rollout/risks').send({ title: 'Seed' });
    const id = create.body.risk.id;

    mockUser = USER_A;
    const patch = await request(app).patch(`/api/rollout/risks/${id}`).send({ status: 'CLOSED' });
    expect(patch.status).toBe(403);

    const del = await request(app).delete(`/api/rollout/risks/${id}`);
    expect(del.status).toBe(403);
  });

  it('GUEST writes are rejected with 403 across all four registers', async () => {
    const app = await makeApp();
    mockUser = GUEST_A;
    const kpi = await request(app).post('/api/rollout/kpis').send({ name: 'x' });
    const risk = await request(app).post('/api/rollout/risks').send({ title: 'x' });
    const change = await request(app).post('/api/rollout/changes').send({ title: 'x' });
    const closure = await request(app).post('/api/rollout/closures').send({ title: 'x' });
    expect(kpi.status).toBe(403);
    expect(risk.status).toBe(403);
    expect(change.status).toBe(403);
    expect(closure.status).toBe(403);
  });

  it('ADMIN retains full write access (regression guard for the gate)', async () => {
    const app = await makeApp();
    mockUser = ADMIN_A;
    const res = await request(app).post('/api/rollout/changes').send({ title: 'ok' });
    expect(res.status).toBe(201);
  });

  it('PROJECT_MANAGER (PMO tier) can write — MANAGE_ROLLOUT granted', async () => {
    const app = await makeApp();
    mockUser = PM_A;
    const res = await request(app).post('/api/rollout/changes').send({ title: 'pmo' });
    expect(res.status).toBe(201);
  });

  it('TEAM_MEMBER write is rejected with 403 (no MANAGE_ROLLOUT)', async () => {
    const app = await makeApp();
    mockUser = MEMBER_A;
    const post = await request(app).post('/api/rollout/kpis').send({ name: 'x', target: 1 });
    expect(post.status).toBe(403);
    // ...but reads remain open to any org member.
    const list = await request(app).get('/api/rollout/kpis');
    expect(list.status).toBe(200);
  });
});
