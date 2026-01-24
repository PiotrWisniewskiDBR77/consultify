import app from '../../../server/src/index.js';
import db from '../../../server/database';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabase, getDatabaseInstance } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

import DbPromise from '../../../server/src/utils/DbPromise.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

/**
 * Tasks Routes Integration Tests
 */

// Mock other dependencies globally (ESM mocks)
vi.mock('../../../server/routes/notifications', () => ({
  default: {
    createNotification: vi.fn(),
  },
}));

vi.mock('../../../server/services/activityService', () => ({
  default: { log: vi.fn() },
}));

vi.mock('../../../server/services/initiativeService', () => ({
  default: { recalculateProgress: vi.fn().mockResolvedValue() },
}));

vi.mock('../../../server/utils/cacheHelper', () => ({
  default: {
    invalidate: vi.fn(),
    invalidateProjectCache: vi.fn(),
    invalidateUserCache: vi.fn(),
  },
}));

vi.mock('../../../server/services/taskAssignmentService', () => ({
  default: { assignTask: vi.fn() },
}));

vi.mock('../../../server/services/projectMemberService', () => ({
  default: { getMembers: vi.fn() },
}));

describe('Tasks Routes', () => {
  let db;

  beforeAll(async () => {
    await initializeDatabase();
    db = getDatabaseInstance();
  });

  let app;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Enable Auth Bypass for this test suite
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.NODE_ENV = 'test';

    // Spy on the real DB instance methods
    // We need to restore mocks first to avoid stacking spies
    vi.restoreAllMocks();

    // Default implementations
    vi.spyOn(db, 'all').mockImplementation((sql, params, callback) => {
      const cb = typeof params === 'function' ? params : callback;
      if (cb) cb(null, []);
    });
    vi.spyOn(db, 'get').mockImplementation((sql, params, callback) => {
      const cb = typeof params === 'function' ? params : callback;
      if (cb) cb(null, null);
    });
    vi.spyOn(db, 'run').mockImplementation(function (sql, params, callback) {
      const cb = typeof params === 'function' ? params : callback;
      if (cb) cb.call({ changes: 1, lastID: 1 }, null);
    });
    // POST uses db.prepare
    if (!db.prepare) {
      db.prepare = vi.fn(() => ({
        run: vi.fn((...args) => {
          const cb = args.pop();
          if (typeof cb === 'function') cb.call({ changes: 1, lastID: 1 }, null);
        }),
        finalize: vi.fn(),
      }));
    } else {
      vi.spyOn(db, 'prepare').mockImplementation(() => ({
        run: vi.fn((...args) => {
          const cb = args.pop();
          if (typeof cb === 'function') cb.call({ changes: 1, lastID: 1 }, null);
        }),
        finalize: vi.fn(),
      }));
    }

    app = express();
    app.use(express.json());

    // Import the router - Vitest handles ESM/TS
    const tasksRouter = (await import('../../../server/src/routes/pmo/tasks.routes.ts')).default;

    app.use('/api/tasks', tasksRouter);

    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/tasks', () => {
    it('returns list of tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Review proposal',
          status: 'todo',
          priority: 'high',
          assignee_id: 'user-1',
          assignee_first_name: 'John',
          assignee_last_name: 'Doe',
          project_name: 'Project A',
        },
        {
          id: 'task-2',
          title: 'Prepare report',
          status: 'in_progress',
          priority: 'medium',
          project_name: 'Project A',
        },
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockTasks);
      });

      const response = await request(app)
        .get('/api/tasks')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Review proposal');
    });

    it('filters by projectId', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('t.project_id = ?');
        expect(params).toContain('proj-1');
        callback(null, []);
      });

      await request(app).get('/api/tasks?projectId=proj-1').expect(200);
    });

    it('filters by status', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('t.status = ?');
        expect(params).toContain('completed');
        callback(null, []);
      });

      await request(app).get('/api/tasks?status=completed').expect(200);
    });

    it('filters by assigneeId', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('t.assignee_id = ?');
        expect(params).toContain('user-2');
        callback(null, []);
      });

      await request(app).get('/api/tasks?assigneeId=user-2').expect(200);
    });

    it('filters by priority', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('t.priority = ?');
        expect(params).toContain('urgent');
        callback(null, []);
      });

      await request(app).get('/api/tasks?priority=urgent').expect(200);
    });

    it('filters by initiativeId', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('t.initiative_id = ?');
        expect(params).toContain('init-1');
        callback(null, []);
      });

      await request(app).get('/api/tasks?initiativeId=init-1').expect(200);
    });

    it('parses JSON fields correctly', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test',
        checklist: JSON.stringify([{ text: 'Item 1', done: false }]),
        attachments: JSON.stringify(['file1.pdf']),
        tags: JSON.stringify(['important']),
        assignees: JSON.stringify(['user-1', 'user-2']),
      };

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, [mockTask]);
      });

      const response = await request(app).get('/api/tasks').expect(200);

      expect(response.body[0].checklist).toEqual([{ text: 'Item 1', done: false }]);
      expect(response.body[0].attachments).toEqual(['file1.pdf']);
      expect(response.body[0].tags).toEqual(['important']);
      expect(response.body[0].assignees).toEqual(['user-1', 'user-2']);
    });

    it('orders by priority and due date', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('ORDER BY');
        expect(sql).toContain('CASE t.priority');
        expect(sql).toContain('t.due_date ASC');
        callback(null, []);
      });

      await request(app).get('/api/tasks').expect(200);
    });

    it('handles database errors by returning empty list (graceful fallback)', async () => {
      // Mock db.all to return error
      db.all.mockImplementation((sql, params, callback) => {
        const cb = typeof params === 'function' ? params : callback;
        if (cb) cb(new Error('Database error'), null);
      });

      const response = await request(app).get('/api/tasks').expect(200);

      // DbPromise fallback returns [] on error
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns single task', async () => {
      const mockTask = {
        id: 'task-1',
        organization_id: 'org-1',
        title: 'Review proposal',
        status: 'todo',
        priority: 'high',
      };

      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockTask);
      });

      const response = await request(app).get('/api/tasks/task-1').expect(200);

      expect(response.body.id).toBe('task-1');
      expect(response.body.title).toBe('Review proposal');
    });

    it('returns 404 for non-existent task', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/tasks/non-existent').expect(404);

      expect(response.body.error).toBe('Task not found');
    });
  });
});
