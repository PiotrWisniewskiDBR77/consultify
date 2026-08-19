/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'actor-1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  },
}));

vi.mock('../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/results/kpiPermissions.js', () => ({
  assertKpiPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: dbGet,
  run: dbRun,
}));

describe('retired Benefits deviation resolve second door', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the governed V8 successor and performs no legacy read or write', async () => {
    const router = (await import('../benefits.routes.js')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/benefits', router);

    const response = await request(app)
      .post('/api/benefits/deviation-cases/case-1/resolve')
      .send({});

    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'RESULTS_LEGACY_WRITER_DISABLED',
      writerId: 'RESULTS-W23-BENEFITS-SECOND-DOOR',
      successor: '/api/v8/results/deviation-cases/case-1/resolve',
    });
    expect(dbGet).not.toHaveBeenCalled();
    expect(dbRun).not.toHaveBeenCalled();
  });
});
