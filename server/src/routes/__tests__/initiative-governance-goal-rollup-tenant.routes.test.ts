/**
 * RES-10 — GET /api/initiatives-v4/goals/:goalId/rollup must fail closed across tenants.
 *
 * Discovery found the one goal endpoint the M13 L-09 IDOR sweep missed: the service
 * ran its org-scoped ownership lookup but did not short-circuit on null, then read
 * `goal_initiative_links` and child `goals` with NO organization_id filter. A caller
 * from org A hitting org B's goalId got HTTP 200 with org B's link count, child-goal
 * count and rollup progress.
 *
 * These tests pin the HTTP contract (404, empty of tenant data) on the REAL router,
 * with the DB layer and auth mocked. The sibling service-level assertions — "not one
 * rollup query is issued after the guard" — live in
 * tests/unit/backend/services/initiativeGovernanceService.crossorg.test.ts.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import initiativeGovernanceRoutes from '../initiative-governance.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives-v4', initiativeGovernanceRoutes);
  return app;
}

const ORG_A = 'org-A';
const ORG_B = 'org-B';

/**
 * Arms the two previously-unscoped reads with org B rows. If the guard regresses,
 * these are exactly the numbers that surface in the response body.
 */
function armForeignTenantRows() {
  mockQueryAll.mockImplementation(async (sql: string) => {
    if (/goal_initiative_links/i.test(sql) && !/JOIN\s+initiatives/i.test(sql)) {
      return [
        { contribution_weight: 1, initiative_id: 'init-of-B-1' },
        { contribution_weight: 1, initiative_id: 'init-of-B-2' },
      ];
    }
    if (/FROM\s+goals\s+WHERE\s+parent_goal_id/i.test(sql)) {
      return [
        { id: 'child-of-B-1', progress: 80 },
        { id: 'child-of-B-2', progress: 40 },
      ];
    }
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRun.mockResolvedValue({ changes: 1 });
  mockQueryAll.mockResolvedValue([]);
  mockUser = { id: 'user-A', organizationId: ORG_A };
});

describe('RES-10 — goal rollup tenant fail-closed', () => {
  it("returns 404 and no payload for another org's goal", async () => {
    // Ownership lookup is scoped to ORG_A, so org B's goal resolves to null.
    mockQueryFirst.mockResolvedValue(null);
    armForeignTenantRows();

    const res = await request(createApp()).get('/api/initiatives-v4/goals/goal-of-B/rollup');

    expect(res.status).toBe(404);
    // Not one field of the foreign tenant's rollup may appear — not even as zeros,
    // and not the counts that used to leak (2 links, 2 children, progress 60).
    const body = JSON.stringify(res.body);
    expect(res.body).not.toHaveProperty('linkedInitiatives');
    expect(res.body).not.toHaveProperty('childGoals');
    expect(res.body).not.toHaveProperty('rollupProgress');
    expect(res.body).not.toHaveProperty('initiativeProgressCount');
    expect(res.body).not.toHaveProperty('goal');
    expect(body).not.toMatch(/init-of-B|child-of-B/);
  });

  it('issues no rollup query at all once the ownership lookup misses', async () => {
    mockQueryFirst.mockResolvedValue(null);
    armForeignTenantRows();

    await request(createApp()).get('/api/initiatives-v4/goals/goal-of-B/rollup');

    // The leak lived in the reads, not in the response shape — assert the reads
    // never happened rather than trusting the serializer.
    expect(mockQueryAll).not.toHaveBeenCalled();
    expect(mockQueryRun).not.toHaveBeenCalled();
    // The gate itself was org-bound.
    expect(mockQueryFirst).toHaveBeenCalledTimes(1);
    expect(String(mockQueryFirst.mock.calls[0][0])).toMatch(/organization_id\s*=\s*\$2/i);
    expect(mockQueryFirst.mock.calls[0][1]).toEqual(['goal-of-B', ORG_A]);
  });

  it('returns 404 for a goal id that exists in no org', async () => {
    mockQueryFirst.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/initiatives-v4/goals/goal-nowhere/rollup');

    expect(res.status).toBe(404);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('serves the rollup unchanged for a goal the caller owns (positive control)', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'goal-of-A', organization_id: ORG_A, progress: 10 });
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (/goal_initiative_links/i.test(sql) && !/JOIN\s+initiatives/i.test(sql)) {
        return [{ contribution_weight: 1, initiative_id: 'init-of-A' }];
      }
      if (/FROM\s+goals\s+WHERE\s+parent_goal_id/i.test(sql)) {
        return [{ id: 'child-of-A', progress: 60 }];
      }
      if (/JOIN\s+initiatives/i.test(sql)) {
        return [{ id: 'init-of-A', progress: 40, contribution_weight: 1 }];
      }
      return [];
    });

    const res = await request(createApp()).get('/api/initiatives-v4/goals/goal-of-A/rollup');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      goal: { id: 'goal-of-A' },
      linkedInitiatives: 1,
      childGoals: 1,
      initiativeProgressCount: 1,
      rollupProgress: 50,
    });
  });

  it('negative control — the guard blocks cross-tenant only, not the same id per se', async () => {
    // Same goalId, same arming, only the caller's org differs. ORG_B sees it, ORG_A does not.
    mockQueryFirst.mockImplementation(async (_sql: string, params: unknown[]) =>
      params[1] === ORG_B ? { id: 'goal-of-B', organization_id: ORG_B } : null
    );
    armForeignTenantRows();

    mockUser = { id: 'user-A', organizationId: ORG_A };
    const denied = await request(createApp()).get('/api/initiatives-v4/goals/goal-of-B/rollup');
    expect(denied.status).toBe(404);

    mockUser = { id: 'user-B', organizationId: ORG_B };
    const allowed = await request(createApp()).get('/api/initiatives-v4/goals/goal-of-B/rollup');
    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({ childGoals: 2, linkedInitiatives: 2 });
  });

  it('requires authentication (401, no lookup)', async () => {
    mockUser = null;

    const res = await request(createApp()).get('/api/initiatives-v4/goals/goal-of-B/rollup');

    expect(res.status).toBe(401);
    expect(mockQueryFirst).not.toHaveBeenCalled();
    expect(mockQueryAll).not.toHaveBeenCalled();
  });
});
