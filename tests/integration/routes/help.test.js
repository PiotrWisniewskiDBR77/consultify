import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => db);
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req, res, next) => {
    const authorization = req.get('authorization');
    if (authorization !== 'Bearer help-test-token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = {
      id: 'help-user-1',
      organizationId: 'help-org-1',
      role: 'ADMIN',
    };
    req.userId = 'help-user-1';
    req.organizationId = 'help-org-1';
    return next();
  },
}));

import helpRouter from '../../../server/src/routes/help.routes.js';

const app = express();
app.use(express.json());
app.use('/api/help', helpRouter);

describe('Integration Test: Help Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.run.mockResolvedValue({ changes: 1 });
    db.all.mockResolvedValue([]);
  });

  it('rejects protected help routes without a bearer token', async () => {
    const [playbooks, event] = await Promise.all([
      request(app).get('/api/help/playbooks'),
      request(app).post('/api/help/events').send({ eventType: 'VIEWED' }),
    ]);

    expect(playbooks.status).toBe(401);
    expect(event.status).toBe(401);
    expect(db.all).not.toHaveBeenCalled();
    expect(db.run).not.toHaveBeenCalled();
  });

  it('returns published playbooks and a deterministic recommendation', async () => {
    db.all.mockResolvedValueOnce([
      { id: 'playbook-1', key: 'onboarding-tour', title: 'Onboarding' },
    ]);

    const res = await request(app)
      .get('/api/help/playbooks')
      .set('Authorization', 'Bearer help-test-token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      recommendedKey: 'onboarding-tour',
      playbooks: [{ id: 'playbook-1', key: 'onboarding-tour' }],
    });
    expect(db.all).toHaveBeenCalledWith(
      expect.stringContaining("FROM help_playbooks WHERE status = 'published'"),
      []
    );
  });

  // This is a route/adapter contract. Durable persistence is covered only by a
  // real-DB run; the endpoint deliberately exposes `stored` because help
  // telemetry is fail-soft and must not block the user's primary workflow.
  it('reports stored=true when the event adapter accepts the tenant-attributed write', async () => {
    const res = await request(app)
      .post('/api/help/events')
      .set('Authorization', 'Bearer help-test-token')
      .send({
        eventType: 'VIEWED',
        articleId: 'article-1',
        metadata: { route: '/dashboard' },
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Event logged', stored: true });
    expect(res.body.eventId).toMatch(/^evt-/);
    expect(db.run).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO help_events'),
      expect.arrayContaining([
        'help-user-1',
        'help-org-1',
        'VIEWED',
        'article-1',
        JSON.stringify({ route: '/dashboard' }),
      ])
    );
  });

  it('honestly reports fail-soft telemetry when the event write is unavailable', async () => {
    db.run.mockRejectedValueOnce(new Error('telemetry unavailable'));

    const res = await request(app)
      .post('/api/help/events')
      .set('Authorization', 'Bearer help-test-token')
      .send({ eventType: 'VIEWED' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, stored: false });
  });
});
