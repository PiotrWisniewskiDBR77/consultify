/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const history = vi.fn();
vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/resultsInternalBetaVisibility.middleware.js', () => ({
  requireResultsInternalBetaVisibility: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: ['*'] })),
  hasEffectiveCapability: () => true,
}));
vi.mock('../../../services/resultsVnext/kpi/kpiHistoryRepository.js', () => ({
  getKpiHistory: (...args: unknown[]) => history(...args),
}));

const router = (await import('../kpi.routes.js')).default;
const KPI = '11111111-1111-4111-8111-111111111111';
function app() {
  const value = express();
  value.use(express.json());
  value.use('/api/vnext/results/kpi', router);
  return value;
}

describe('Day 17 KPI HTTP contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns the history contract and token-derived tenant', async () => {
    history.mockResolvedValue({
      found: true,
      entries: [
        {
          entryId: 'e',
          occurredAt: '2026-01-01T00:00:00.000Z',
          kind: 'LIFECYCLE',
          summaryCode: 'KPI_ACTIVATED',
          actorUserId: null,
          sourceVersion: 2,
          references: {},
        },
      ],
      nextCursor: null,
    });
    const response = await request(app()).get(`/api/vnext/results/kpi/${KPI}/history?limit=2`);
    expect(response.status).toBe(200);
    expect(response.body.entries[0]).toMatchObject({ kind: 'LIFECYCLE', sourceVersion: 2 });
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', kpiId: KPI, limit: 2 })
    );
  });
  it('returns 404 instead of an empty history for an invisible KPI', async () => {
    history.mockResolvedValue({ found: false, entries: [], nextCursor: null });
    expect((await request(app()).get(`/api/vnext/results/kpi/${KPI}/history`)).status).toBe(404);
  });
  it('returns an honestly empty visible history', async () => {
    history.mockResolvedValue({ found: true, entries: [], nextCursor: null });
    const response = await request(app()).get(`/api/vnext/results/kpi/${KPI}/history`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ entries: [], nextCursor: null });
  });
});
