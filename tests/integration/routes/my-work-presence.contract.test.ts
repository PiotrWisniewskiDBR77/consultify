import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

const listPresenceMock = vi.fn(async () => []);
const upsertPresenceMock = vi.fn(async () => ({ ok: true }));

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

const { default: myWorkRouter } = await import('../../../server/src/routes/my-work.routes.ts');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRouter);
  return app;
}

describe('my-work presence route contracts', () => {
  it('does not expose the retired idea presence polling endpoint', async () => {
    listPresenceMock.mockRejectedValueOnce(new Error('presence-store-unavailable'));
    const app = createApp();

    const res = await request(app).get('/api/my-work/my-ideas/idea-1/presence');
    expect(res.status).toBe(404);
  });

  it('does not expose the retired idea presence broadcast endpoint', async () => {
    upsertPresenceMock.mockRejectedValueOnce(new Error('presence-upsert-failed'));
    const app = createApp();

    const res = await request(app).post('/api/my-work/my-ideas/idea-1/presence').send({
      userId: 'u-1',
      userName: 'User One',
      color: '#6366f1',
      timestamp: Date.now(),
      activeCell: { nodeId: 'node-1', colKey: 'title' },
    });
    expect(res.status).toBe(404);
  });
});
