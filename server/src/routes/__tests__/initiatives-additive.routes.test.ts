/**
 * Module 05 (Inicjatywy) — additive routes (suggested-changes + propose) tests.
 *
 * Verifies the additive router serves:
 *   - POST/GET /:initiativeId/suggested-changes
 *   - PATCH /suggested-changes/:id (accepted|rejected)
 *   - POST /propose (always returns { candidates }, never hangs/500s)
 *
 * Auth/RBAC/validation middleware and the two services are mocked so the test is
 * deterministic and DB/AI-free.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-add-1';
const UID = 'user-add-1';

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

// Service mocks.
const mockCreate = vi.fn();
const mockList = vi.fn();
const mockResolve = vi.fn();
vi.mock('../../services/initiative/suggestedChangesService.js', () => ({
  createSuggestedChange: (...args: unknown[]) => mockCreate(...args),
  listSuggestedChanges: (...args: unknown[]) => mockList(...args),
  resolveSuggestedChange: (...args: unknown[]) => mockResolve(...args),
}));

const mockPropose = vi.fn();
vi.mock('../../services/initiative/proposeEngineService.js', () => ({
  proposeCandidates: (...args: unknown[]) => mockPropose(...args),
}));

import additiveRoutes from '../initiatives-additive.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', additiveRoutes);
  return app;
}

beforeEach(() => {
  mockUser = { id: UID, organizationId: ORG };
  mockQueryOne.mockReset();
  mockCreate.mockReset();
  mockList.mockReset();
  mockResolve.mockReset();
  mockPropose.mockReset();
});

describe('initiatives additive routes — suggested changes', () => {
  it('POST /:id/suggested-changes creates a PENDING change (201)', async () => {
    mockQueryOne.mockResolvedValue({ id: 'init-1' }); // initiative exists in org
    mockCreate.mockResolvedValue({ id: 'isc_1', status: 'pending', kind: 'extend' });

    const res = await request(createApp())
      .post('/api/initiatives/init-1/suggested-changes')
      .send({ kind: 'extend', title: 'Add scope', rationale: 'New evidence' });

    expect(res.status).toBe(201);
    expect(res.body.change.id).toBe('isc_1');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        initiativeId: 'init-1',
        organizationId: ORG,
        kind: 'extend',
        title: 'Add scope',
      })
    );
  });

  it('POST /:id/suggested-changes returns 404 when initiative is not in org', async () => {
    mockQueryOne.mockResolvedValue(null);
    const res = await request(createApp())
      .post('/api/initiatives/missing/suggested-changes')
      .send({ kind: 'evidence', title: 'X' });
    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('POST /:id/suggested-changes rejects an invalid kind (400)', async () => {
    mockQueryOne.mockResolvedValue({ id: 'init-1' });
    const res = await request(createApp())
      .post('/api/initiatives/init-1/suggested-changes')
      .send({ kind: 'nonsense', title: 'X' });
    expect(res.status).toBe(400);
  });

  it('GET /:id/suggested-changes lists changes (filtered by status)', async () => {
    mockQueryOne.mockResolvedValue({ id: 'init-1' });
    mockList.mockResolvedValue([{ id: 'isc_1', status: 'pending' }]);

    const res = await request(createApp()).get(
      '/api/initiatives/init-1/suggested-changes?status=pending'
    );

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.changes).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ initiativeId: 'init-1', organizationId: ORG, status: 'pending' })
    );
  });

  it('PATCH /suggested-changes/:id resolves to accepted (200)', async () => {
    mockResolve.mockResolvedValue({ id: 'isc_1', status: 'accepted' });
    const res = await request(createApp())
      .patch('/api/initiatives/suggested-changes/isc_1')
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.change.status).toBe('accepted');
    expect(mockResolve).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isc_1', organizationId: ORG, status: 'accepted' })
    );
  });

  it('PATCH /suggested-changes/:id returns 404 when not found', async () => {
    mockResolve.mockResolvedValue(null);
    const res = await request(createApp())
      .patch('/api/initiatives/suggested-changes/missing')
      .send({ status: 'rejected' });
    expect(res.status).toBe(404);
  });

  it('PATCH /suggested-changes/:id rejects an invalid status (400)', async () => {
    const res = await request(createApp())
      .patch('/api/initiatives/suggested-changes/isc_1')
      .send({ status: 'maybe' });
    expect(res.status).toBe(400);
  });
});

describe('initiatives additive routes — propose engine', () => {
  it('POST /propose returns candidates from the engine (200)', async () => {
    mockPropose.mockResolvedValue([{ title: 'Reduce cycle time' }]);
    const res = await request(createApp())
      .post('/api/initiatives/propose')
      .send({ text: 'We should reduce cycle time and automate QA.', max: 3 });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([{ title: 'Reduce cycle time' }]);
  });

  it('POST /propose degrades to empty candidates when the engine throws (still 200)', async () => {
    mockPropose.mockRejectedValue(new Error('llm down'));
    const res = await request(createApp())
      .post('/api/initiatives/propose')
      .send({ text: 'anything' });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
  });

  it('POST /propose rejects empty text (400)', async () => {
    const res = await request(createApp()).post('/api/initiatives/propose').send({ text: '' });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated requests (401)', async () => {
    mockUser = null;
    const res = await request(createApp())
      .post('/api/initiatives/propose')
      .send({ text: 'hello' });
    expect(res.status).toBe(401);
  });
});
