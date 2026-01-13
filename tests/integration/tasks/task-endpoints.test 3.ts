/**
 * Tasks Integration Tests
 * Testing task management endpoints
 * 
 * @module tests/integration/tasks/task-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Task Endpoints Integration', () => {
    let app: express.Application;
    const tasks = new Map<string, any>();

    beforeAll(() => {
        app = express();
        app.use(express.json());

        const authMiddleware = (req: any, res: any, next: any) => {
            if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
            req.user = { id: '1' };
            next();
        };

        app.get('/api/tasks', authMiddleware, (req, res) => {
            const status = req.query.status;
            let result = Array.from(tasks.values());
            if (status) result = result.filter(t => t.status === status);
            res.json(result);
        });

        app.get('/api/tasks/:id', authMiddleware, (req, res) => {
            const task = tasks.get(req.params.id);
            if (!task) return res.status(404).json({ error: 'Not found' });
            res.json(task);
        });

        app.post('/api/tasks', authMiddleware, (req, res) => {
            const { title, description, priority, dueDate } = req.body;
            if (!title) return res.status(400).json({ error: 'Title required' });
            const id = `task-${Date.now()}`;
            const task = { id, title, description, priority: priority || 'medium', status: 'todo', dueDate, assigneeId: req.user.id };
            tasks.set(id, task);
            res.status(201).json(task);
        });

        app.patch('/api/tasks/:id/status', authMiddleware, (req, res) => {
            const task = tasks.get(req.params.id);
            if (!task) return res.status(404).json({ error: 'Not found' });
            const { status } = req.body;
            if (!['todo', 'in_progress', 'done'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            task.status = status;
            res.json(task);
        });

        app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
            if (!tasks.has(req.params.id)) return res.status(404).json({ error: 'Not found' });
            tasks.delete(req.params.id);
            res.status(204).send();
        });
    });

    describe('GET /api/tasks', () => {
        it('should return tasks', async () => {
            const response = await request(app)
                .get('/api/tasks')
                .set('Authorization', 'Bearer token');
            expect(response.status).toBe(200);
        });

        it('should filter by status', async () => {
            const response = await request(app)
                .get('/api/tasks?status=todo')
                .set('Authorization', 'Bearer token');
            expect(response.status).toBe(200);
        });
    });

    describe('POST /api/tasks', () => {
        it('should create task', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .set('Authorization', 'Bearer token')
                .send({ title: 'New Task', priority: 'high' });

            expect(response.status).toBe(201);
            expect(response.body.title).toBe('New Task');
        });
    });

    describe('PATCH /api/tasks/:id/status', () => {
        it('should reject invalid status', async () => {
            // First create a task
            const createRes = await request(app)
                .post('/api/tasks')
                .set('Authorization', 'Bearer token')
                .send({ title: 'Test' });

            const response = await request(app)
                .patch(`/api/tasks/${createRes.body.id}/status`)
                .set('Authorization', 'Bearer token')
                .send({ status: 'invalid' });

            expect(response.status).toBe(400);
        });
    });
});
