import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

import myWorkRoutes from '../my-work.routes.js';

const ORG = 'org-calendar-v8';
const USER_ID = 'user-calendar-v8';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: USER_ID,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/my-work', myWorkRoutes);
  return app;
}

describe('V8 My Work calendar routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockImplementation((table: string) => {
      if (table === 'tasks') {
        return Promise.resolve(
          new Map([
            ['id', { name: 'id' }],
            ['due_date', { name: 'due_date' }],
            ['assignee_id', { name: 'assignee_id' }],
            ['project_id', { name: 'project_id' }],
          ]),
        );
      }
      return Promise.resolve(new Map());
    });
  });

  it('lists unified calendar events through the V8 envelope', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Finish closure proof',
        status: 'todo',
        priority: 'high',
        description: 'Bounded V8 task',
        due_date: '2026-03-27',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/my-work/calendar/unified')
      .query({ start: '2026-03-01', end: '2026-04-01', sources: 'task' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_calendar_v1' });
    expect(res.body.data.events).toEqual([
      expect.objectContaining({
        id: 'task-task-1',
        source: 'task',
        title: 'Finish closure proof',
        start: '2026-03-27',
      }),
    ]);
  });

  it('creates task-backed calendar events through the V8 namespace', async () => {
    const res = await request(createApp()).post('/api/v8/my-work/calendar/events').send({
      title: 'Calendar task',
      start: '2026-03-27',
      allDay: true,
      source: 'task',
    });

    expect(res.status).toBe(201);
    expect(res.body.meta.contract).toBe('my_work_calendar_v1');
    expect(res.body.data.source).toBe('task');
    expect(mockQueryRun).toHaveBeenCalledTimes(1);
  });

  it('loads calendar conflicts through the V8 namespace', async () => {
    mockQueryAll
      .mockResolvedValueOnce([{ id: 'task-7', title: 'Prepare deck', due_date: '2026-03-27' }])
      .mockResolvedValueOnce([{ id: 'decision-4', title: 'Approve scope', deadline: '2026-03-27' }]);

    const res = await request(createApp())
      .get('/api/v8/my-work/calendar/conflicts')
      .query({ date: '2026-03-27' });

    expect(res.status).toBe(200);
    expect(res.body.meta.contract).toBe('my_work_calendar_v1');
    expect(res.body.data).toMatchObject({
      date: '2026-03-27',
      totalItems: 2,
      hasConflicts: false,
    });
  });
});
