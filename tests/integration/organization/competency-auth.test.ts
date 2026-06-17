/**
 * M23 L-07 — Security regression: competency write + org-data export auth guards.
 *
 * Verifies that:
 *   1. Unauthenticated requests to competency write routes are rejected with 401.
 *   2. Member-role requests to competency write routes are rejected with 403.
 *   3. Admin/owner requests to competency write routes pass the auth layer.
 *   4. Member-role requests to /export/all are rejected with 403.
 *   5. Unauthenticated requests to /export/all are rejected with 401.
 *
 * Tests stop at the auth middleware layer — no real database is needed.
 * Auth middleware is mocked with a per-scenario control knob so we can
 * simulate unauthenticated (→ 401), member (→ 403 on write), and admin
 * (→ pass) callers precisely.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted control knobs — mutated per test ─────────────────────────────────

/**
 * 'none'   → verifyToken returns 401 (simulates no token / unauthenticated)
 * 'member' → verifyToken injects member user; requireRole blocks writes → 403
 * 'admin'  → verifyToken injects admin user; requireRole passes
 * 'owner'  → verifyToken injects owner user; requireRole passes
 */
const authMode = vi.hoisted(() => ({ value: 'admin' as 'none' | 'member' | 'admin' | 'owner' }));

// ── Mock auth middleware ──────────────────────────────────────────────────────

vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, res: any, next: () => void) => {
    if (authMode.value === 'none') {
      return res.status(401).json({ error: 'No token provided' });
    }
    req.user = {
      id: `u-${authMode.value}-1`,
      organizationId: 'org-test-1',
      role: authMode.value,
      isSuperAdmin: false,
      isDemo: false,
    };
    req.userId = `u-${authMode.value}-1`;
    req.organizationId = 'org-test-1';
    next();
  };

  const requireRole = (...roles: string[]) => {
    return (req: any, res: any, next: () => void): void => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const allowed = roles.map((r) => r.toLowerCase());
      if (!allowed.includes(user.role?.toLowerCase() ?? '')) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      next();
    };
  };

  return {
    verifyToken,
    requireRole,
    requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    default: verifyToken,
  };
});

// ── Silence logger ────────────────────────────────────────────────────────────

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Stub DbPromise (needed by organization-data routes) ───────────────────────

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn().mockResolvedValue(null),
  all: vi.fn().mockResolvedValue([]),
  run: vi.fn().mockResolvedValue({ changes: 0, lastID: 0 }),
}));

// ── Stub competency taxonomy service ─────────────────────────────────────────

vi.mock('../../../server/src/services/competencyTaxonomyService.js', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Test' }),
  updateCategory: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Updated' }),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  seedDefaultCategories: vi.fn().mockResolvedValue([]),
  getLevels: vi.fn().mockResolvedValue([]),
  seedDefaultLevels: vi.fn().mockResolvedValue([]),
  upsertLevel: vi.fn().mockResolvedValue({ value: 1 }),
  getCompetenciesWithStats: vi.fn().mockResolvedValue([]),
  updateCompetencyCategory: vi.fn().mockResolvedValue(undefined),
  getInitiativeRequirements: vi.fn().mockResolvedValue([]),
  addInitiativeRequirement: vi.fn().mockResolvedValue({ id: 'req-1' }),
  updateInitiativeRequirement: vi.fn().mockResolvedValue(undefined),
  deleteInitiativeRequirement: vi.fn().mockResolvedValue(undefined),
}));

// ── Routes under test ─────────────────────────────────────────────────────────

import competencyRoutes from '../../../server/src/routes/competency.routes.js';
import organizationDataRoutes from '../../../server/src/routes/organization/organization-data.routes.js';

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/competency', competencyRoutes);
  app.use('/api/organization-data', organizationDataRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('M23 L-07 — competency + org-data export auth guards', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  // ── Story 1.1: Unauthenticated → 401 on competency write ─────────────────

  describe('Story 1.1 — unauthenticated POST /api/competency/categories', () => {
    it('returns 401 when no auth token is provided', async () => {
      authMode.value = 'none';

      const res = await request(app)
        .post('/api/competency/categories')
        .send({ name: 'Attacker Category' });

      expect(res.status).toBe(401);
    });
  });

  // ── Story 1.2: Member role → 403 on competency write ─────────────────────

  describe('Story 1.2 — member role blocked on competency writes', () => {
    it('POST /categories returns 403 for member role', async () => {
      authMode.value = 'member';

      const res = await request(app)
        .post('/api/competency/categories')
        .send({ name: 'Should Be Blocked' });

      expect(res.status).toBe(403);
    });

    it('DELETE /categories/:id returns 403 for member role', async () => {
      authMode.value = 'member';

      const res = await request(app).delete('/api/competency/categories/cat-1');

      expect(res.status).toBe(403);
    });

    it('PUT /categories/:id returns 403 for member role', async () => {
      authMode.value = 'member';

      const res = await request(app)
        .put('/api/competency/categories/cat-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('GET /categories returns 200 for member role (read-only is permitted)', async () => {
      authMode.value = 'member';

      const res = await request(app).get('/api/competency/categories');

      // Members can read; never 401 or 403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
    });
  });

  // ── Story 1.1 variant: Admin/owner → pass auth layer ─────────────────────

  describe('Story 1.1 variant — admin/owner pass competency write guard', () => {
    it('admin role: POST /categories is not rejected with 401 or 403', async () => {
      authMode.value = 'admin';

      const res = await request(app)
        .post('/api/competency/categories')
        .send({ name: 'Admin Category' });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('owner role: POST /categories is not rejected with 401 or 403', async () => {
      authMode.value = 'owner';

      const res = await request(app)
        .post('/api/competency/categories')
        .send({ name: 'Owner Category' });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // ── Story 1.3: Member role → 403 on org data export ──────────────────────

  describe('Story 1.3 — member role blocked on org-data export', () => {
    it('POST /export/all returns 403 for member role', async () => {
      authMode.value = 'member';

      const res = await request(app).post('/api/organization-data/export/all').send({});

      expect(res.status).toBe(403);
    });

    it('POST /export/:category returns 403 for member role', async () => {
      authMode.value = 'member';

      const res = await request(app).post('/api/organization-data/export/users').send({});

      expect(res.status).toBe(403);
    });

    it('POST /export/all is not rejected for admin role (auth passes)', async () => {
      authMode.value = 'admin';

      const res = await request(app).post('/api/organization-data/export/all').send({});

      // Auth passed — may be 200 or 5xx depending on DB, but never 401/403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('POST /export/all returns 401 for unauthenticated caller', async () => {
      authMode.value = 'none';

      const res = await request(app).post('/api/organization-data/export/all').send({});

      expect(res.status).toBe(401);
    });
  });
});
