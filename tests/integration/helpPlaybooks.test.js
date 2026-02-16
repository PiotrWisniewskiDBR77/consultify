import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll } = vi.hoisted(() => ({
  dbAll: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args) => dbAll(...args),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req, _res, next) => next(),
}));

async function loadHelpRouter() {
  return (await import('../../server/src/routes/help.routes.ts')).default;
}

describe('Help playbooks routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
  });

  it('GET /playbooks returns recommendedKey and list', async () => {
    dbAll.mockResolvedValueOnce([{ key: 'k1' }]);
    const router = await loadHelpRouter();
    const app = makeTestApp({ mountPath: '/api/help', router });
    const res = await request(app).get('/api/help/playbooks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, playbooks: expect.any(Array), recommendedKey: 'k1' })
    );
  });

  it('GET /playbooks falls back to empty list on DB error', async () => {
    dbAll.mockRejectedValueOnce(new Error('db'));
    const router = await loadHelpRouter();
    const app = makeTestApp({ mountPath: '/api/help', router });
    const res = await request(app).get('/api/help/playbooks');
    expect(res.status).toBe(200);
    expect(res.body.playbooks).toEqual([]);
    expect(res.body.recommendedKey).toBe('getting-started');
  });
});
