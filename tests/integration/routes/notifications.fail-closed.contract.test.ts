// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
const getNotificationsMock = vi.fn();
const sendNotificationMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
    } else {
      req.user = {
        id: 'user-notif-1',
        organizationId: 'org-notif-1',
        role: req.get('x-test-role') || 'ADMIN',
      };
    }
    next();
  },
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: {
    getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
    send: (...args: unknown[]) => sendNotificationMock(...args),
  },
}));

vi.mock('../../../server/src/services/escalationService.js', () => ({
  EscalationService: {},
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));

import notificationsRoutes from '../../../server/src/routes/notifications/notifications.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('notifications fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/notifications', notificationsRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    getNotificationsMock.mockResolvedValue([]);
    sendNotificationMock.mockResolvedValue({ id: 'notif-1' });
    dbAllMock.mockResolvedValue([{ id: 'user-target-1' }]);
  });

  it('returns coded 401 for notifications list when auth is missing', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('x-test-auth', 'none')
      .set('X-Correlation-ID', 'pack10s4-notifications-unauthorized-1');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('NOTIFICATIONS_UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication is required to access notifications.');
    expect(res.body.correlationId).toBe('pack10s4-notifications-unauthorized-1');
  });

  it('returns coded 500 for notifications read failures without leaking internals', async () => {
    getNotificationsMock.mockRejectedValueOnce(new Error('PG_CONNSTRING_INTERNAL_SECRET'));
    const res = await request(app)
      .get('/api/notifications')
      .set('X-Correlation-ID', 'pack10s4-notifications-read-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('NOTIFICATIONS_READ_FAILED');
    expect(res.body.error.message).toBe('Failed to load notifications.');
    expect(res.body.stack).toBeUndefined();
    expect(res.body.correlationId).toBe('pack10s4-notifications-read-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('PG_CONNSTRING_INTERNAL_SECRET');
  });

  it('returns coded 400 for broadcast payload missing type', async () => {
    const res = await request(app)
      .post('/api/notifications/broadcast')
      .send({ title: 'Maintenance' })
      .set('X-Correlation-ID', 'pack10s4-notifications-broadcast-type-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('NOTIFICATIONS_BROADCAST_TYPE_REQUIRED');
    expect(res.body.error.message).toBe('Notification type is required.');
    expect(res.body.correlationId).toBe('pack10s4-notifications-broadcast-type-1');
  });

  it('returns coded 503 for broadcast when notifications service is not configured', async () => {
    dbAllMock.mockRejectedValueOnce(new Error('no such table: users'));
    const res = await request(app)
      .post('/api/notifications/broadcast')
      .send({ type: 'system', title: 'Maintenance' })
      .set('X-Correlation-ID', 'pack10s4-notifications-not-configured-1');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('NOTIFICATIONS_SERVICE_NOT_CONFIGURED');
    expect(res.body.error.message).toBe('Notifications service is temporarily unavailable.');
    expect(res.body.correlationId).toBe('pack10s4-notifications-not-configured-1');
  });
});
