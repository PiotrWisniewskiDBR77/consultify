/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchResults = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (req: any, res: any, next: () => void) =>
    req.headers['x-test-revoked'] === '1'
      ? res.status(403).json({ code: 'ORG_MEMBERSHIP_REVOKED' })
      : next(),
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/resultsInternalBetaVisibility.middleware.js', () => ({
  requireResultsInternalBetaVisibility: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../services/resultsVnext/platform/resultsSearchRepository.js', () => ({
  searchResults: (...args: unknown[]) => mockSearchResults(...args),
}));

const routes = (await import('../search.routes.js')).default;

function app() {
  const instance = express();
  instance.use('/api/vnext/results/search', routes);
  return instance;
}

describe('GET /api/vnext/results/search (Day 14 S.1)', () => {
  beforeEach(() => {
    mockSearchResults.mockReset();
    mockSearchResults.mockResolvedValue({
      results: [
        {
          kind: 'kpi',
          id: 'k1',
          title: 'Margin',
          subtitle: 'GM',
          status: 'active',
          updatedAt: '2026-08-25T10:00:00.000Z',
          matchedField: 'title',
          href: '/results/kpi/k1',
        },
        {
          kind: 'okr_set',
          id: 'o1',
          title: 'Margin',
          subtitle: null,
          status: 'active',
          updatedAt: '2026-08-24T10:00:00.000Z',
          matchedField: 'title',
          href: '/results/okr/sets/o1',
        },
      ],
      nextCursor: null,
    });
  });

  it('returns one governed page spanning multiple kinds', async () => {
    const response = await request(app()).get(
      '/api/vnext/results/search?q=margin&kinds=kpi,okr_set'
    );
    expect(response.status).toBe(200);
    expect(response.body.results.map((item: any) => item.kind)).toEqual(['kpi', 'okr_set']);
    expect(mockSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        query: 'margin',
        kinds: ['kpi', 'okr_set'],
      })
    );
  });

  it('returns an honest empty result for a one-character query without touching the repository', async () => {
    const response = await request(app()).get('/api/vnext/results/search?q=x');
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(mockSearchResults).not.toHaveBeenCalled();
  });

  it('rejects a query over 200 characters', async () => {
    const response = await request(app()).get(`/api/vnext/results/search?q=${'x'.repeat(201)}`);
    expect(response.status).toBe(400);
    expect(mockSearchResults).not.toHaveBeenCalled();
  });

  it('denies a revoked foreign tenant before executing search', async () => {
    const response = await request(app())
      .get('/api/vnext/results/search?q=margin')
      .set('x-test-revoked', '1');
    expect(response.status).toBe(403);
    expect(mockSearchResults).not.toHaveBeenCalled();
  });
});
