/**
 * economics.routes.ts — POST /analyses/:id/business-case (BUG-07 fix).
 *
 * This endpoint used to be a stub that returned a fake `status: 'generated'`
 * document with `sections: []` — silently claiming success while doing no
 * work. It now fails loudly (501) and points callers at the real generator
 * (POST /api/v8/advisory/business-case) instead.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    next();
  },
}));

const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

import economicsRoutes from '../../../server/src/routes/economics.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/economics', economicsRoutes);
  return app;
}

const ORG = 'org-econ-1';
const ANALYSIS_ID = 'analysis-1';

describe('POST /api/economics/analyses/:id/business-case (BUG-07 stub fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', organizationId: ORG };
  });

  it('returns 501 (not a fake success) pointing at the real v8 advisory endpoint', async () => {
    mockDbGet.mockResolvedValue({ id: ANALYSIS_ID, organization_id: ORG, name: 'Digitize invoicing' });

    const res = await request(createApp()).post(`/api/economics/analyses/${ANALYSIS_ID}/business-case`);

    expect(res.status).toBe(501);
    expect(res.body.error).toBe('not_implemented');
    expect(res.body.replacement?.path).toBe('/api/v8/advisory/business-case');
    // The old stub's shape — must never appear again.
    expect(res.body.data?.sections).toBeUndefined();
    expect(res.body.status).not.toBe('generated');
  });

  it('still 404s for an analysis outside the caller org (org isolation preserved)', async () => {
    mockDbGet.mockResolvedValue(null); // scoped query found nothing for this org

    const res = await request(createApp()).post(`/api/economics/analyses/${ANALYSIS_ID}/business-case`);

    expect(res.status).toBe(404);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('organization_id'), [
      ANALYSIS_ID,
      ORG,
    ]);
  });

  it('401s with no authenticated user', async () => {
    mockUser = null;
    const res = await request(createApp()).post(`/api/economics/analyses/${ANALYSIS_ID}/business-case`);
    expect(res.status).toBe(401);
  });
});
