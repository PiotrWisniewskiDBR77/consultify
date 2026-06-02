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
  mockUser = { id: UID, organizationId: ORG };
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
    mockDbRun.mockResolvedValue({ changes: 1 });
    const res = await request(createApp())
      .put('/api/initiative-generator/g1')
      .send({ status: 'approved', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('PUT /:id with no updatable fields returns 400', async () => {
    const res = await request(createApp()).put('/api/initiative-generator/g1').send({});
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockUser = null;
    const res = await request(createApp()).get('/api/initiative-generator');
    expect(res.status).toBe(401);
  });
});
