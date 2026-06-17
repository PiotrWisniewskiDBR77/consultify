// @vitest-environment node

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';

const { queryAll, queryOne, queryRun, getTableColumns } = vi.hoisted(() => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  getTableColumns: vi.fn(async (table: string) => {
    if (table === 'my_work_decision_snoozes') return new Set(['user_id', 'decision_id', 'snoozed_until']);
    if (table === 'my_work_decision_prefs') return new Set(['user_id', 'prefs_json', 'updated_at']);
    if (table === 'decisions')
      return new Set([
        'id',
        'organization_id',
        'title',
        'description',
        'type',
        'status',
        'priority',
        'impact',
        'deadline',
        'created_at',
        'updated_at',
        'project_id',
        'initiative_id',
        'task_id',
        'decision_maker_id',
        'created_by',
      ]);
    return new Set(['id']);
  }),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  },
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: any[]) => getTableColumns(...args),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: any[]) => queryAll(...args),
  queryOne: (...args: any[]) => queryOne(...args),
  queryRun: (...args: any[]) => queryRun(...args),
}));

async function makeMyWorkApp() {
  const router = (await import('../../../server/src/routes/my-work.routes.js')).default;
  return makeTestApp({ mountPath: '/api/my-work', router });
}

describe('My Work Decisions endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryAll.mockResolvedValue([]);
    queryOne.mockResolvedValue(null);
    queryRun.mockResolvedValue({ changes: 1 });
  });

  it('GET /api/my-work/decisions/queue returns items with canRemind/lastRemindedAt', async () => {
    queryAll.mockResolvedValue([
      {
        id: 'd-1',
        title: 'Decision 1',
        description: 'desc',
        decisionType: 'approval',
        status: 'pending',
        priority: 'HIGH',
        impact: 'MEDIUM',
        escalation_level: 'none',
        dueDate: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        projectId: null,
        initiativeId: null,
        taskId: null,
        decisionOwnerId: 'u-1',
        requestedById: 'u-2',
        ownerName: ' Owner',
        requestedByName: ' Requester',
        projectName: 'Project',
        blockedItemsCount: 0,
        snoozedUntil: null,
      },
    ]);

    const app = await makeMyWorkApp();
    const res = await request(app).get('/api/my-work/decisions/queue').expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        mode: 'my',
        nextCursor: null,
        items: [
          expect.objectContaining({
            id: 'd-1',
            canRemind: true,
            lastRemindedAt: null,
          }),
        ],
      })
    );

    const [sql] = queryAll.mock.calls[0] || [];
    // ensure it excludes snoozed in default mode
    expect(String(sql)).toContain('(s.snoozed_until IS NULL OR s.snoozed_until <= ?)');
  });

  it('GET /api/my-work/decisions/queue?mode=snoozed uses snoozed-only filter', async () => {
    const app = await makeMyWorkApp();
    await request(app).get('/api/my-work/decisions/queue?mode=snoozed').expect(200);

    const [sql] = queryAll.mock.calls[0] || [];
    expect(String(sql)).toContain('(s.snoozed_until IS NOT NULL AND s.snoozed_until > ?)');
  });

  it('POST /api/my-work/decisions/:id/snooze returns 400 for invalid until', async () => {
    const app = await makeMyWorkApp();
    const res = await request(app)
      .post('/api/my-work/decisions/d-1/snooze')
      .send({ until: 'not-a-date' })
      .expect(400);

    expect(res.body?.error).toMatch(/Invalid until/i);
    expect(queryOne).not.toHaveBeenCalled();
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('POST /api/my-work/decisions/:id/snooze stores snooze when decision is relevant', async () => {
    queryOne.mockResolvedValue({ ok: 1 });
    queryRun.mockResolvedValue({ changes: 1 });

    const app = await makeMyWorkApp();
    const res = await request(app)
      .post('/api/my-work/decisions/d-1/snooze')
      .send({ preset: 'tomorrow' })
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        decisionId: 'd-1',
        snoozedUntil: expect.any(String),
      })
    );
    expect(() => new Date(res.body.snoozedUntil)).not.toThrow();

    const [sql] = queryRun.mock.calls[0] || [];
    expect(String(sql)).toContain('INSERT INTO my_work_decision_snoozes');
  });

  it('POST /api/my-work/decisions/:id/snooze returns 404 when decision is not relevant', async () => {
    queryOne.mockResolvedValue(null);
    const app = await makeMyWorkApp();
    await request(app).post('/api/my-work/decisions/d-404/snooze').send({ preset: 'tomorrow' }).expect(404);
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('POST /api/my-work/decisions/:id/unsnooze deletes snooze row', async () => {
    const app = await makeMyWorkApp();
    const res = await request(app).post('/api/my-work/decisions/d-1/unsnooze').expect(200);

    expect(res.body).toEqual(expect.objectContaining({ success: true, decisionId: 'd-1' }));

    const [sql] = queryRun.mock.calls[0] || [];
    expect(String(sql)).toContain('DELETE FROM my_work_decision_snoozes');
  });

  it('GET /api/my-work/decisions/preferences returns defaults when missing', async () => {
    queryOne.mockResolvedValue(null);
    const app = await makeMyWorkApp();
    const res = await request(app).get('/api/my-work/decisions/preferences').expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        updatedAt: null,
        prefs: expect.objectContaining({
          defaultViewMode: 'split',
          defaultFilterMode: 'my',
          savedViews: [],
        }),
      })
    );
  });

  it('PUT /api/my-work/decisions/preferences returns 400 for non-object payload', async () => {
    const app = await makeMyWorkApp();
    await request(app).put('/api/my-work/decisions/preferences').send([]).expect(400);
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('PUT /api/my-work/decisions/preferences upserts preferences', async () => {
    const app = await makeMyWorkApp();
    const res = await request(app)
      .put('/api/my-work/decisions/preferences')
      .send({ prefs: { defaultViewMode: 'review_next', defaultFilterMode: 'all', savedViews: [] } })
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        updatedAt: expect.any(String),
        prefs: expect.objectContaining({ defaultViewMode: 'review_next', defaultFilterMode: 'all' }),
      })
    );
    expect(queryRun).toHaveBeenCalled();
  });
});

