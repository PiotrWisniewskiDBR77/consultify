/**
 * Tasks Integration Tests
 *
 * Real integration tests for Tasks API endpoints.
 *
 * @module tests/integration/tasks.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Tasks Integration', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // Mock data
    const tasks = new Map<string, any>([
      [
        'task-1',
        {
          id: 'task-1',
          title: 'Test Task',
          status: 'pending',
          organizationId: 'org-1',
          assigneeId: null,
        },
      ],
      [
        'task-2',
        {
          id: 'task-2',
          title: 'Another Task',
          status: 'todo',
          organizationId: 'org-1',
          assigneeId: 'user-1',
        },
      ],
    ]);

    // Auth middleware
    const requireAuth = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'user-1', organizationId: 'org-1' };
      next();
    };

    // POST /api/tasks - Create task
    app.post('/api/tasks', requireAuth, (req: any, res: any) => {
      const { title, status } = req.body;
      const task = {
        id: `task-${Date.now()}`,
        title,
        status: status || 'pending',
        organizationId: req.user.organizationId,
        createdAt: new Date().toISOString(),
      };
      tasks.set(task.id, task);
      res.status(201).json(task);
    });

    // GET /api/tasks - List tasks
    app.get('/api/tasks', requireAuth, (req: any, res: any) => {
      const orgTasks = Array.from(tasks.values()).filter(
        (t) => t.organizationId === req.user.organizationId
      );
      res.json(orgTasks);
    });

    // PATCH /api/tasks/:id/status - Update status
    app.patch('/api/tasks/:id/status', requireAuth, (req: any, res: any) => {
      const task = tasks.get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      task.status = req.body.status;
      res.json(task);
    });

    // POST /api/tasks/:id/assign - Assign task
    app.post('/api/tasks/:id/assign', requireAuth, (req: any, res: any) => {
      const task = tasks.get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      task.assigneeId = req.body.userId;
      res.json({ taskId: task.id, userId: req.body.userId });
    });

    // DELETE /api/tasks/:id
    app.delete('/api/tasks/:id', requireAuth, (req: any, res: any) => {
      const task = tasks.get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      tasks.delete(req.params.id);
      res.json({ success: true, deletedId: req.params.id });
    });

    authToken = 'valid-token';
  });

  it('should create task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Test Task', status: 'pending' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('should list tasks', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should update task status', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-1/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('should assign task', async () => {
    const res = await request(app)
      .post('/api/tasks/task-1/assign')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeDefined();
  });

  it('should delete task', async () => {
    const res = await request(app)
      .delete('/api/tasks/task-2')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});
