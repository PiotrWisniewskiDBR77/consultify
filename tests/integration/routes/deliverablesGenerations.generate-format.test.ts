import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M02 / L-05 — POST /deliverables/generations/:id/generate must FAIL LOUDLY
 * (400) when `format` is absent or invalid, instead of silently defaulting to
 * 'deck'. Generating a deck for a doc/sheet request is a worse, harder-to-debug
 * outcome than a clear rejection; every live FE caller sends an explicit format.
 */

// Flag gate must be ON or the whole router 404s before our handler runs.
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_DELIVERABLES_LIGHT: true },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'OWNER' };
    req.userId = 'user-1';
    req.userRole = 'OWNER';
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: () => true,
}));

const startMock = vi.fn();
vi.mock('../../../server/src/services/deliverables/deliverablesGenerationService.js', () => ({
  DeliverablesGenerationError: class extends Error {},
  plan: vi.fn(),
  start: (...args: any[]) => startMock(...args),
  status: vi.fn(),
}));

vi.mock('../../../server/src/services/deliverables/deliverablesMetricsService.js', () => ({
  getDeliverableMetrics: vi.fn(),
}));

const { default: router } = await import(
  '../../../server/src/routes/deliverablesGenerations.routes.js'
);

const app = express();
app.use(express.json());
app.use('/api/deliverables/generations', router);

describe('deliverables generate — format contract (M02/L-05)', () => {
  beforeEach(() => {
    startMock.mockReset();
    startMock.mockResolvedValue({ generationId: 'gen-1', status: 'running' });
  });
  afterEach(() => vi.clearAllMocks());

  it('returns 400 when format is missing (no silent deck default)', async () => {
    const res = await request(app)
      .post('/api/deliverables/generations/gen-1/generate')
      .send({ setup: {} })
      .expect(400);
    expect(res.body.error).toMatch(/format is required/i);
    expect(startMock).not.toHaveBeenCalled();
  });

  it('returns 400 when format is invalid', async () => {
    const res = await request(app)
      .post('/api/deliverables/generations/gen-1/generate')
      .send({ format: 'pdf', setup: {} })
      .expect(400);
    expect(res.body.error).toMatch(/must be one of/i);
    expect(startMock).not.toHaveBeenCalled();
  });

  it('accepts an explicit valid format and reaches the generation service', async () => {
    await request(app)
      .post('/api/deliverables/generations/gen-1/generate')
      .send({ format: 'doc', setup: {} })
      .expect(202);
    expect(startMock).toHaveBeenCalledWith(expect.objectContaining({ format: 'doc' }));
  });
});
