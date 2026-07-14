/**
 * Module 13 (Inicjatywy) — economics-links additive route contract test.
 *
 * Verifies the read-side of the M16 Finance → M13 Initiatives integration:
 *   GET /api/initiatives/:initiativeId/economics-links
 *
 * Contract:
 *   - Owning org → 200 with the linkages M16 wrote for that initiative.
 *   - Foreign / unknown org (initiative not in org) → 404, and the finance
 *     service is never even consulted (no cross-org read).
 *   - Empty linkage set for an in-org initiative → 200 with [].
 *   - Unauthenticated → 401.
 *
 * Auth/RBAC, the org-scoped existence check (queryHelpers.queryOne) and the
 * finance service are mocked so the test is deterministic and DB-free.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-econ-1';
const FOREIGN_ORG = 'org-econ-2';
const UID = 'user-econ-1';

let mockUser: { id: string; organizationId: string } | null = { id: UID, organizationId: ORG };

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
}));

// Org-scoped initiative existence check hits queryHelpers.queryOne.
const mockQueryOne = vi.fn();
vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

// Read-only finance integration service (M16 owns writes; we only read).
const mockGetLinkages = vi.fn();
vi.mock('../../services/v8/financeIntegrationService.js', () => ({
  getLinkagesByInitiative: (...args: unknown[]) => mockGetLinkages(...args),
}));

// The additive router also imports these; harmless no-op mocks keep it isolated.
vi.mock('../../services/initiative/suggestedChangesService.js', () => ({
  createSuggestedChange: vi.fn(),
  listSuggestedChanges: vi.fn(),
  resolveSuggestedChange: vi.fn(),
}));
vi.mock('../../services/initiative/proposeEngineService.js', () => ({
  proposeCandidates: vi.fn(),
}));

import additiveRoutes from '../initiatives-additive.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', additiveRoutes);
  return app;
}

function makeLinkage(overrides: Record<string, unknown> = {}) {
  return {
    linkageId: 'lnk_1',
    organizationId: ORG,
    financeModelRef: 'fm_apator_2026_base',
    initiativeId: 'init-1',
    linkageType: 'budget',
    status: 'linked_to_finance_model',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockUser = { id: UID, organizationId: ORG };
  mockQueryOne.mockReset();
  mockGetLinkages.mockReset();
});

describe('GET /api/initiatives/:id/economics-links — contract', () => {
  it('returns the linkages for the owning org (200)', async () => {
    mockQueryOne.mockResolvedValue({ id: 'init-1' }); // initiative exists in ORG
    mockGetLinkages.mockResolvedValue([
      makeLinkage(),
      makeLinkage({
        linkageId: 'lnk_2',
        linkageType: 'forecast',
        status: 'stale_vs_finance_model',
      }),
    ]);

    const res = await request(createApp()).get('/api/initiatives/init-1/economics-links');

    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.links[0]).toMatchObject({
      linkageId: 'lnk_1',
      financeModelRef: 'fm_apator_2026_base',
      linkageType: 'budget',
      status: 'linked_to_finance_model',
    });
    // Service was called org-scoped with (initiativeId, orgId).
    expect(mockGetLinkages).toHaveBeenCalledWith('init-1', ORG);
    // Internal org_id must never leak to the wire.
    expect(res.body.links[0].organizationId).toBeUndefined();
  });

  it('returns 404 for a foreign org and NEVER reads the finance linkages', async () => {
    // Caller is in FOREIGN_ORG; the initiative lives in ORG → existence check misses.
    mockUser = { id: UID, organizationId: FOREIGN_ORG };
    mockQueryOne.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/initiatives/init-1/economics-links');

    expect(res.status).toBe(404);
    expect(mockGetLinkages).not.toHaveBeenCalled();
    // The existence check itself was org-scoped to the (foreign) caller.
    expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), ['init-1', FOREIGN_ORG]);
  });

  it('returns 200 with an empty array when the in-org initiative has no linkages', async () => {
    mockQueryOne.mockResolvedValue({ id: 'init-1' });
    mockGetLinkages.mockResolvedValue([]);

    const res = await request(createApp()).get('/api/initiatives/init-1/economics-links');

    expect(res.status).toBe(200);
    expect(res.body.links).toEqual([]);
    expect(res.body.items).toEqual([]);
  });

  it('rejects unauthenticated requests (401)', async () => {
    mockUser = null;
    const res = await request(createApp()).get('/api/initiatives/init-1/economics-links');
    expect(res.status).toBe(401);
    expect(mockGetLinkages).not.toHaveBeenCalled();
  });
});
