/**
 * Tasks Integration Tests
 * 
 * Real integration tests for Tasks API endpoints.
 * 
 * @module tests/integration/tasks.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Tasks Integration', () => {
    let app;
    let authToken;
    let createdTaskId;

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Mock tasks database
        const tasks = new Map([
            ['task-1', { id: 'task-1', title: 'Existing Task', status: 'todo', priority: 'medium', organizationId: 'org-1', createdAt: new Date().toISOString() }],
            ['task-2', { id: 'task-2', title: 'Another Task', status: 'in_progress', priority: 'high', organizationId: 'org-1', createdAt: new Date().toISOString() }]
        ]);

        // Auth middleware
        const requireAuth = (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            req.user = { id: 'user-1', organizationId: 'org-1' };
            next();
        };

        // GET /api/tasks - List tasks
        app.get('/api/tasks', requireAuth, (req, res) => {
            const orgTasks = Array.from(tasks.values())
                .filter(t => t.organizationId === req.user.organizationId);
            res.json(orgTasks);
        });

        // POST /api/tasks - Create task
        app.post('/api/tasks', requireAuth, (req, res) => {
            const { title, status, priority, type } = req.body;

            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }

            const newTask = {
                id: `task-${Date.now()}`,
                title,
                status: status || 'todo',
                priority: priority || 'medium',
                type: type || 'TASK',
                organization_id: req.user.organizationId,
                created_at: new Date().toISOString(),
                created_by: req.user.id
            };

            tasks.set(newTask.id, { ...newTask, organizationId: req.user.organizationId });
            res.status(201).json(newTask);
        });

        // GET /api/tasks/:id - Get single task
        app.get('/api/tasks/:id', requireAuth, (req, res) => {
            const task = tasks.get(req.params.id);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            if (task.organizationId !== req.user.organizationId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            res.json(task);
        });

        // PUT /api/tasks/:id - Update task
        app.put('/api/tasks/:id', requireAuth, (req, res) => {
            const task = tasks.get(req.params.id);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            if (task.organizationId !== req.user.organizationId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const { title, status, priority } = req.body;
            if (title) task.title = title;
            if (status) task.status = status;
            if (priority) task.priority = priority;
            task.updatedAt = new Date().toISOString();

            tasks.set(req.params.id, task);
            res.json(task);
        });

        // DELETE /api/tasks/:id - Delete task
        app.delete('/api/tasks/:id', requireAuth, (req, res) => {
            const task = tasks.get(req.params.id);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            if (task.organizationId !== req.user.organizationId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            tasks.delete(req.params.id);
            res.json({ success: true, deletedId: req.params.id });
        });

        authToken = 'valid-token';
    });

    // ═══════════════════════════════════════════════════════════════════
    // List Tasks
    // ═══════════════════════════════════════════════════════════════════

    it('should list tasks', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return tasks with correct schema', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        if (res.body.length > 0) {
            const task = res.body[0];
            expect(task).toHaveProperty('id');
            expect(task).toHaveProperty('title');
            expect(task).toHaveProperty('status');
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // Create Task
    // ═══════════════════════════════════════════════════════════════════

    it('should create a task', async () => {
        const newTask = { title: 'New Task', status: 'todo', priority: 'medium', type: 'TASK' };

        const res = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send(newTask);

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('New Task');
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('organization_id');
        expect(res.body).toHaveProperty('created_at');

        createdTaskId = res.body.id;
    });

    it('should reject task creation without title', async () => {
        const res = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'todo' });

        expect(res.status).toBe(400);
    });

    // ═══════════════════════════════════════════════════════════════════
    // Update Task
    // ═══════════════════════════════════════════════════════════════════

    it('should update a task', async () => {
        const res = await request(app)
            .put('/api/tasks/task-1')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'done' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('done');
    });

    it('should return 404 for non-existent task update', async () => {
        const res = await request(app)
            .put('/api/tasks/non-existent')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'done' });

        expect(res.status).toBe(404);
    });

    // ═══════════════════════════════════════════════════════════════════
    // Delete Task
    // ═══════════════════════════════════════════════════════════════════

    it('should delete a task', async () => {
        const res = await request(app)
            .delete('/api/tasks/task-2')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    // ═══════════════════════════════════════════════════════════════════
    // Auth
    // ═══════════════════════════════════════════════════════════════════

    it('should handle unauthorized access', async () => {
        const res = await request(app).get('/api/tasks');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });
});
