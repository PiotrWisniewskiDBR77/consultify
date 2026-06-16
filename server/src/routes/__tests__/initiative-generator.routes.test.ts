/**
 * Module 05 (Inicjatywy) — Initiative Generator route tests.
 *
 * Verifies the promoted /api/initiative-generator router (previously a
 * production-disabled mountStub) actually serves: list, generate (no more silent
 * 503), and update. DB access and auth are mocked.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: vi.fn(),
}));

let mockUser: { id: string; organizationId: string; role?: string } | null = null;

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

import initiativeGeneratorRoutes from '../initiative-generator.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/initiative-generator', initiativeGeneratorRoutes);
  return app;
}

const ORG = 'org-gen-1';
const UID = 'user-gen-1';

beforeEach(() => {
  mockDbAll.mockReset();
  mockDbRun.mockReset();
  // Generate/update are create-band actions: a pilot USER/GUEST is blocked by
  // requireInitiativeWriteAccess(). Authorized callers carry an admin/lead role.
  mockUser = { id: UID, organizationId: ORG, role: 'admin' };
});

describe('initiative-generator routes', () => {
  it('GET / lists generated initiatives for the org (200)', async () => {
    mockDbAll.mockResolvedValue([
      { id: 'g1', title: 'AI Generated Initiative', priority: 'medium', status: 'draft' },
    ]);
    const res = await request(createApp()).get('/api/initiative-generator');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe('g1');
    // Scoped to the authenticated org.
    expect(mockDbAll).toHaveBeenCalledWith(expect.stringContaining('generated_initiatives'), [ORG]);
  });

  it('POST /generate persists a draft and returns success (200, not 503)', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    const res = await request(createApp())
      .post('/api/initiative-generator/generate')
      .send({ source: 'teresa', context: { projectId: 'p1' }, assessmentId: 'a1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('string');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    // Insert targets the generated_initiatives table.
    expect(mockDbRun.mock.calls[0][0]).toContain('INSERT INTO generated_initiatives');
  });

  it('PUT /:id updates fields (200)', async () => {
    // Ownership lookup (org-scoped SELECT) finds the row in the caller's org.
    mockDbAll.mockResolvedValue([{ id: 'g1' }]);
    mockDbRun.mockResolvedValue({ changes: 1 });
    const res = await request(createApp())
      .put('/api/initiative-generator/g1')
      .send({ status: 'approved', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    // The UPDATE is org-scoped (WHERE id = ? AND organization_id = ?).
    expect(mockDbRun.mock.calls[0][0]).toMatch(/AND organization_id = \?/i);
    const updateParams = mockDbRun.mock.calls[0][1] as unknown[];
    expect(updateParams[updateParams.length - 1]).toBe(ORG);
  });

  it('PUT /:id with no updatable fields returns 400', async () => {
    // Row exists in the caller's org → reaches the "No updates" guard.
    mockDbAll.mockResolvedValue([{ id: 'g1' }]);
    const res = await request(createApp()).put('/api/initiative-generator/g1').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /:id for a foreign-org initiative returns 404 (no cross-org write)', async () => {
    // Org-scoped ownership lookup returns nothing → the row is not in caller's org.
    mockDbAll.mockResolvedValue([]);
    const res = await request(createApp())
      .put('/api/initiative-generator/g-from-org-b')
      .send({ status: 'approved' });
    expect(res.status).toBe(404);
    // The ownership SELECT was org-scoped to the caller's org…
    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringMatching(/FROM generated_initiatives WHERE id = \? AND organization_id = \?/i),
      ['g-from-org-b', ORG]
    );
    // …and no UPDATE ran.
    const updateCall = mockDbRun.mock.calls.find((c) =>
      /UPDATE generated_initiatives/i.test(String(c?.[0]))
    );
    expect(updateCall).toBeFalsy();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockUser = null;
    const res = await request(createApp()).get('/api/initiative-generator');
    expect(res.status).toBe(401);
  });

  it('POST /generate is blocked for a pilot (viewer) role → 403', async () => {
    mockUser = { id: UID, organizationId: ORG, role: 'viewer' };
    const res = await request(createApp())
      .post('/api/initiative-generator/generate')
      .send({ source: 'teresa', context: {} });
    expect(res.status).toBe(403);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('PUT /:id is blocked for a pilot (viewer) role → 403 (no write)', async () => {
    mockUser = { id: UID, organizationId: ORG, role: 'viewer' };
    const res = await request(createApp())
      .put('/api/initiative-generator/g1')
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});
