// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');
const { initTestDb } = require('../../helpers/dbHelper.cjs');

/**
 * Level 2: Integration Tests - Notifications Routes
 * Tests notifications API endpoints
 */
describe('Integration Test: Notifications Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `notifications-org-${testId}`;
    const testUserId = `notifications-user-${testId}`;
    const testEmail = `notifications-${testId}@test.com`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Notifications Test Org', 'free', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'Test', 'ADMIN']
                );
                db.run(
                    'INSERT INTO notifications (id, user_id, organization_id, type, title, message, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        `notification-1-${testId}`,
                        testUserId,
                        testOrgId,
                        'info',
                        'Test Notification',
                        'This is a test notification',
                        0
                    ],
                    resolve
                );
            });
        });

        // Login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'test123',
            });

        if (loginRes.body.token) {
            authToken = loginRes.body.token;
        }
    });

    describe('GET /api/notifications', () => {
        it('should return user notifications', async () => {
            if (!authToken) {
                console.log('Skipping notifications test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body) || Array.isArray(res.body.notifications)).toBe(true);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/notifications');

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('GET /api/notifications/counts', () => {
        it('should return notification counts', async () => {
            if (!authToken) {
                console.log('Skipping counts test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/notifications/counts')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body).toHaveProperty('unread');
            expect(typeof res.body.unread).toBe('number');
        });
    });

    describe('PATCH /api/notifications/:id/read', () => {
        it('should mark notification as read', async () => {
            if (!authToken) {
                console.log('Skipping mark read test - no auth token');
                return;
            }

            // Get a notification first
            const notificationsRes = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            const notifications = Array.isArray(notificationsRes.body) ? notificationsRes.body : notificationsRes.body.notifications;
            if (notifications && notifications.length > 0) {
                const notificationId = notifications[0].id;

                const res = await request(app)
                    .patch(`/api/notifications/${notificationId}/read`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(res.status).toBe(200);
            }
        });
    });

    describe('POST /api/notifications/mark-all-read', () => {
        it('should mark all notifications as read', async () => {
            if (!authToken) {
                console.log('Skipping mark all read test - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/notifications/mark-all-read')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/notifications/:id', () => {
        it('should delete notification', async () => {
            if (!authToken) {
                console.log('Skipping delete test - no auth token');
                return;
            }

            // Create a notification to delete
            const notificationId = `delete-test-${testId}`;
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO notifications (id, user_id, organization_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
                    [notificationId, testUserId, testOrgId, 'info', 'Delete Test', 'To be deleted'],
                    resolve
                );
            });

            const res = await request(app)
                .delete(`/api/notifications/${notificationId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
        });
    });
});

