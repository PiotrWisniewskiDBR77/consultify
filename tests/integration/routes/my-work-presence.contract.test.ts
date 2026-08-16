import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

const listPresenceMock = vi.fn(async () => []);
const upsertPresenceMock = vi.fn(async () => ({ ok: true }));
const dbGetMock = vi.fn(async () => ({ id: 'idea-1' }));

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = authState.userId
        ? {
            id: authState.userId,
            organizationId: authState.organizationId,
            role: authState.role || 'ADMIN',
          }
        : undefined;
      next();
    },
  };
});

vi.mock('../../../server/src/services/realtimePlatformService.js', () => ({
  default: {
    listPresence: (...args: unknown[]) => listPresenceMock(...args),
    upsertPresence: (...args: unknown[]) => upsertPresenceMock(...args),
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => dbGetMock(...args),
}));

const { default: myWorkRouter } = await import('../../../server/src/routes/my-work.routes.ts');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRouter);
  return app;
}

describe('my-work presence route contracts', () => {
  beforeEach(() => {
    listPresenceMock.mockClear();
    upsertPresenceMock.mockClear();
    dbGetMock.mockReset();
    dbGetMock.mockResolvedValue({ id: 'idea-1' });
  });

  it('degrades polling to an empty presence list when realtime is unavailable', async () => {
    listPresenceMock.mockRejectedValueOnce(new Error('presence-store-unavailable'));
    const app = createApp();

    const res = await request(app).get('/api/my-work/my-ideas/idea-1/presence');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [] });
  });

  it('reports a degraded broadcast without failing the primary collaboration flow', async () => {
    upsertPresenceMock.mockRejectedValueOnce(new Error('presence-upsert-failed'));
    const app = createApp();

    const res = await request(app).post('/api/my-work/my-ideas/idea-1/presence').send({
      userId: 'u-1',
      userName: 'User One',
      color: '#6366f1',
      timestamp: Date.now(),
      activeCell: { nodeId: 'node-1', colKey: 'title' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, degraded: true });
  });

  it('does not disclose presence for an idea outside the authenticated tenant', async () => {
    dbGetMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    const app = createApp();

    const read = await request(app).get('/api/my-work/my-ideas/foreign-idea/presence');
    const write = await request(app)
      .post('/api/my-work/my-ideas/foreign-idea/presence')
      .send({ activeCell: { nodeId: 'node-1', colKey: 'title' } });

    expect(read.status).toBe(404);
    expect(read.body).toEqual({ users: [] });
    expect(write.status).toBe(404);
    expect(write.body).toEqual({ error: 'Idea not found' });
    expect(listPresenceMock).not.toHaveBeenCalled();
    expect(upsertPresenceMock).not.toHaveBeenCalled();
  });
});
