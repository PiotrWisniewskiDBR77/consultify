import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Notifications Routes Tests
 * Tests notification management API endpoints
 * CRITICAL FOR ENTERPRISE COMMUNICATION
 */

import notificationsRouter from '../../../../server/src/routes/notifications.routes.ts';

describe('Notifications Routes', () => {
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

        app.use('/api/notifications', notificationsRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/notifications', () => {
        it('should get user notifications', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'notif-1',
                        title: 'Task Assigned',
                        message: 'You have been assigned a new task',
                        type: 'task',
                        read: false,
                        created_at: '2025-01-01T10:00:00Z'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/notifications')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should filter by read status', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'notif-1',
                        title: 'Unread Notification',
                        read: false
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/notifications?read=false')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(response.body[0].read).toBe(false);
        });
    });

    describe('GET /api/notifications/:id', () => {
        it('should get notification by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'notif-1',
                    title: 'Task Completed',
                    message: 'Your task has been completed',
                    type: 'task',
                    read: false
                });
            });

            const response = await request(app)
                .get('/api/notifications/notif-1')
                .expect(200);

            expect(response.body.title).toBe('Task Completed');
        });

        it('should return 404 for non-existent notification', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/notifications/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/notifications/:id/read', () => {
        it('should mark notification as read', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .put('/api/notifications/notif-1/read')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/notifications/:id/mark-read', () => {
        it('should mark notification as read', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .post('/api/notifications/notif-1/mark-read')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/notifications/:id', () => {
        it('should delete notification', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/notifications/notif-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/notifications/preferences', () => {
        it('should get notification preferences', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    email_notifications: true,
                    push_notifications: false,
                    task_assignments: true,
                    project_updates: true
                });
            });

            const response = await request(app)
                .get('/api/notifications/preferences')
                .expect(200);

            expect(response.body.email_notifications).toBeDefined();
        });
    });

    describe('PUT /api/notifications/preferences', () => {
        it('should update notification preferences', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const preferences = {
                email_notifications: true,
                push_notifications: true,
                task_assignments: false
            };

            const response = await request(app)
                .put('/api/notifications/preferences')
                .send(preferences)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/notifications/mark-all-read', () => {
        it('should mark all notifications as read', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 5 }, null); // 5 notifications marked
            });

            const response = await request(app)
                .post('/api/notifications/mark-all-read')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/notifications/unread-count', () => {
        it('should get unread notifications count', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, { count: 3 });
            });

            const response = await request(app)
                .get('/api/notifications/unread-count')
                .expect(200);

            expect(response.body.count).toBe(3);
        });
    });
});



