import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Tasks Routes Tests
 * Tests for task management API endpoints
 * CRITICAL FOR ENTERPRISE TASK MANAGEMENT
 */

import tasksRouter from '../../../../server/src/routes/tasks.routes.ts';

describe('Tasks Routes', () => {
    let app;
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        app = express();
        app.use(express.json());

        // Mock auth middleware
        app.use((req, res, next) => {
            req.user = { id: 'test-user', organizationId: 'test-org' };
            req.organizationId = 'test-org';
            next();
        });

        app.use('/api/tasks', tasksRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/tasks', () => {
        it('should get tasks for organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'task-1',
                        title: 'Test Task',
                        status: 'todo',
                        organization_id: 'test-org'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/tasks')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should handle database errors', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'), null);
            });

            const response = await request(app)
                .get('/api/tasks')
                .expect(500);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('POST /api/tasks', () => {
        it('should create new task', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const taskData = {
                title: 'New Task',
                description: 'Task description',
                priority: 'high'
            };

            const response = await request(app)
                .post('/api/tasks')
                .send(taskData)
                .expect(201);

            expect(response.body.id).toBeDefined();
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .send({})
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/tasks/:id', () => {
        it('should update task', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                status: 'completed',
                title: 'Updated Task'
            };

            const response = await request(app)
                .put('/api/tasks/task-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should handle task not found', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 0 }, null);
            });

            const response = await request(app)
                .put('/api/tasks/non-existent')
                .send({ status: 'completed' })
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('DELETE /api/tasks/:id', () => {
        it('should delete task', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/tasks/task-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});





