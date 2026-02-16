import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { dbGet, dbRun } = vi.hoisted(() => ({
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

async function loadNotificationSettingsRouter() {
  return (await import('../../../server/src/routes/notifications/notificationSettings.routes.ts'))
    .default;
}

async function makeNotificationSettingsApp() {
  const router = await loadNotificationSettingsRouter();
  return makeTestApp({
    mountPath: '/api/notification-settings',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1' };
        next();
      });
    },
  });
}

describe('Notification settings routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGet.mockResolvedValue(null);
    dbRun.mockResolvedValue({ success: true });
  });

  it('GET / returns defaults when no row exists', async () => {
    const app = await makeNotificationSettingsApp();
    const res = await request(app).get('/api/notification-settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ email: expect.any(Object) }));
  });

  it('PUT / returns 400 when body is not an object', async () => {
    const app = await makeNotificationSettingsApp();
    const res = await request(app).put('/api/notification-settings').send('nope');
    expect(res.status).toBe(400);
  });

  it('PATCH /:channel returns 400 for invalid channel', async () => {
    const app = await makeNotificationSettingsApp();
    const res = await request(app).patch('/api/notification-settings/nope').send({});
    expect(res.status).toBe(400);
  });
});
