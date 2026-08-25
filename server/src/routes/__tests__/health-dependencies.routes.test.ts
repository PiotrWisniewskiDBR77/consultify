import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import routes from '../admin/health-panel.routes.js';

const dbGet = vi.fn();
const getCachedResults = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'admin' };

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: vi.fn(),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (!user) return res.status(401).end();
    req.user = user;
    next();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../services/health/healthProbeService.js', () => ({
  HEALTH_PROBES: [],
  getCachedResults: (...args: any[]) => getCachedResults(...args),
  summarizeResults: vi.fn().mockReturnValue({}),
  isHealthPanelAllowedEnv: vi.fn().mockReturnValue(false),
  getProbeById: vi.fn(),
  runAllProbes: vi.fn(),
  runProbe: vi.fn(),
  cacheProbeResult: vi.fn(),
}));

const app = () => {
  const instance = express();
  instance.use('/api/admin/health-panel', routes);
  return instance;
};

describe('health dependencies route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: 'u1', organizationId: 'org-1', role: 'admin' };
    dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    getCachedResults.mockResolvedValue([]);
  });

  it('requires an active tenant admin membership', async () => {
    dbGet.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    expect((await request(app()).get('/api/admin/health-panel/dependencies')).status).toBe(403);
  });

  it('reads only cached results for the token tenant and never runs probes', async () => {
    const response = await request(app()).get('/api/admin/health-panel/dependencies');
    expect(response.status).toBe(200);
    expect(getCachedResults).toHaveBeenCalledWith('org-1');
    expect(response.body.dependencies).toHaveLength(2);
  });

  it('returns unknown for every dependency when cache is empty', async () => {
    const response = await request(app()).get('/api/admin/health-panel/dependencies');
    expect(response.body.dependencies.every((item: any) => item.status === 'unknown')).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/host|cpu|memory|credential|openai/i);
  });
});
