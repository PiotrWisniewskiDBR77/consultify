/** @vitest-environment node */

/**
 * Notebook containers (Notatniki, L1) — smoke round-trip (WS-02 unification).
 *
 * Verifies the new container layer that previously hard-failed at startup
 * (untracked migration + requireTables guard):
 *   GET  /api/my-work/notebooks                 → { notebooks: [] } (not 503)
 *   POST /api/my-work/notebooks                 → 201 + public notebook
 *   GET  /api/my-work/notebooks (after create)  → contains it, page_count=0
 *   GET  /api/my-work/notebooks/:id             → access-checked single
 *   DELETE /api/my-work/notebooks/:id (non-empty) → 409
 *
 * The DB layer is mocked with an in-memory `notebooks` store mirroring the SQL
 * shapes in notebook.routes.ts, exercising the real router + service mapping.
 * Also covers the pure access helpers in notebookContainerService.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface NbRow {
  id: string;
  owner_user_id: string;
  organization_id: string;
  title: string;
  icon: string | null;
  scope: string;
  team_id: string | null;
  context_sharing: string;
  created_at: string;
  updated_at: string;
}

const store: { notebooks: NbRow[]; pageCounts: Record<string, number> } = {
  notebooks: [],
  pageCounts: {},
};

const mockQueryAll = vi.fn(async (sql: string, params: unknown[]) => {
  if (/FROM notebooks/i.test(sql)) {
    const [orgId, userId] = params as string[];
    return store.notebooks
      .filter((n) => n.organization_id === orgId && n.owner_user_id === userId)
      .map((n) => ({ ...n, page_count: store.pageCounts[n.id] ?? 0 }));
  }
  return [];
});

const mockQueryOne = vi.fn(async (sql: string, params: unknown[]) => {
  if (/COUNT\(\*\) AS c FROM notebook_pages/i.test(sql)) {
    const id = params[0] as string;
    return { c: store.pageCounts[id] ?? 0 };
  }
  // Any single-row notebook lookup (with or without `n.` alias / page_count subquery).
  if (/FROM notebooks/i.test(sql) && /WHERE\s+n?\.?id\s*=\s*\?/i.test(sql)) {
    const id = params[0];
    const n = store.notebooks.find((x) => x.id === id);
    if (!n) return null;
    return { ...n, page_count: store.pageCounts[n.id] ?? 0 };
  }
  return null;
});

const mockQueryRun = vi.fn(async (sql: string, params: unknown[]) => {
  if (/^\s*INSERT INTO notebooks/i.test(sql)) {
    const [id, owner, org, title, icon, scope, teamId, ctx, created, updated] = params as string[];
    store.notebooks.unshift({
      id,
      owner_user_id: owner,
      organization_id: org,
      title,
      icon: icon ?? null,
      scope,
      team_id: teamId ?? null,
      context_sharing: ctx,
      created_at: created,
      updated_at: updated,
    });
  } else if (/^\s*DELETE FROM notebooks/i.test(sql)) {
    const id = params[0];
    store.notebooks = store.notebooks.filter((n) => n.id !== id);
  }
  return { changes: 1 };
});

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(a[0] as string, (a[1] as unknown[]) ?? []),
  queryOne: (...a: unknown[]) => mockQueryOne(a[0] as string, (a[1] as unknown[]) ?? []),
  queryRun: (...a: unknown[]) => mockQueryRun(a[0] as string, (a[1] as unknown[]) ?? []),
}));

// requireTables() reads getTableColumns — return non-empty so the guard passes.
vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () => new Set(['id', 'notebook_id'])),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1', email: 'u@e.com' };
    next();
  },
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
  // my-work.routes.ts now runs this in the router chain (router.use(validateOrgMembership)
  // after verifyToken). This is a container-layer smoke test, not a membership-gate test —
  // pass through like the other stubbed middlewares below.
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import myWorkRoutes from '../../routes/my-work.routes.js';
import {
  canAccessNotebook,
  canMutateNotebook,
  defaultNotebookId,
  normalizeContextSharing,
  normalizeScope,
} from '../notebookContainerService.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

describe('Notebook containers — smoke round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.notebooks = [];
    store.pageCounts = {};
  });

  it('GET /notebooks returns { notebooks: [] } for a fresh user (not 503)', async () => {
    const res = await request(createApp()).get('/api/my-work/notebooks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notebooks: [] });
  });

  it('POST → GET round-trip: create, then list contains it with page_count 0', async () => {
    const create = await request(createApp())
      .post('/api/my-work/notebooks')
      .send({ title: 'Atelier Project Notes', contextSharing: 'org_context' });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe('Atelier Project Notes');
    expect(create.body.scope).toBe('personal');
    expect(create.body.contextSharing).toBe('org_context');
    const id = create.body.id;

    const list = await request(createApp()).get('/api/my-work/notebooks');
    expect(list.status).toBe(200);
    expect(list.body.notebooks).toHaveLength(1);
    expect(list.body.notebooks[0].id).toBe(id);
    expect(list.body.notebooks[0].pageCount).toBe(0);
  });

  it('GET /notebooks/:id returns the access-checked notebook', async () => {
    const create = await request(createApp())
      .post('/api/my-work/notebooks')
      .send({ title: 'Strategy 2026' });
    const id = create.body.id;

    const one = await request(createApp()).get(`/api/my-work/notebooks/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.title).toBe('Strategy 2026');
  });

  it('POST without title is rejected (400)', async () => {
    const res = await request(createApp()).post('/api/my-work/notebooks').send({});
    expect(res.status).toBe(400);
  });

  it('DELETE refuses a non-empty notebook (409)', async () => {
    const create = await request(createApp())
      .post('/api/my-work/notebooks')
      .send({ title: 'Has notes' });
    const id = create.body.id;
    store.pageCounts[id] = 2; // simulate 2 pages

    const del = await request(createApp()).delete(`/api/my-work/notebooks/${id}`);
    expect(del.status).toBe(409);
  });

  it('DELETE removes an empty notebook (204)', async () => {
    const create = await request(createApp())
      .post('/api/my-work/notebooks')
      .send({ title: 'Empty' });
    const id = create.body.id;

    const del = await request(createApp()).delete(`/api/my-work/notebooks/${id}`);
    expect(del.status).toBe(204);
    expect(store.notebooks).toHaveLength(0);
  });
});

describe('notebookContainerService — access helpers', () => {
  it('normalizeScope / normalizeContextSharing default safely', () => {
    expect(normalizeScope('team')).toBe('team');
    expect(normalizeScope('garbage')).toBe('personal');
    expect(normalizeContextSharing('org_context')).toBe('org_context');
    expect(normalizeContextSharing(undefined)).toBe('private');
  });

  it('defaultNotebookId is deterministic per (org, user)', () => {
    expect(defaultNotebookId('org-1', 'user-1')).toBe('nb_default_org-1_user-1');
  });

  it('owner can access + mutate their personal notebook', async () => {
    const row = {
      owner_user_id: 'user-1',
      organization_id: 'org-1',
      scope: 'personal',
      team_id: null,
    };
    expect(await canAccessNotebook('user-1', 'org-1', row)).toBe(true);
    expect(canMutateNotebook('user-1', 'org-1', row)).toBe(true);
  });

  it('non-owner cannot access a personal notebook, even same org', async () => {
    const row = {
      owner_user_id: 'user-1',
      organization_id: 'org-1',
      scope: 'personal',
      team_id: null,
    };
    expect(await canAccessNotebook('user-2', 'org-1', row)).toBe(false);
    expect(canMutateNotebook('user-2', 'org-1', row)).toBe(false);
  });

  it('cross-org access is always denied', async () => {
    const row = {
      owner_user_id: 'user-1',
      organization_id: 'org-1',
      scope: 'personal',
      team_id: null,
    };
    expect(await canAccessNotebook('user-1', 'org-2', row)).toBe(false);
  });
});
