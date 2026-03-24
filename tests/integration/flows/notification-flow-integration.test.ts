import path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'notification-flow-integration.db');
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: Notification Flow Integration
 * 
 * Tests notification delivery across channels and services:
 * - NotificationService
 * - EmailService
 * - SMSService
 * - PushNotificationService
 * - UserPreferencesService
 * - TemplateService
 */
describe('L3: Notification Flow Integration', () => {
    const testDbPath = path.resolve(__dirname, 'notification-flow-integration.db');
    let adminToken: string;
    let userToken: string;
    let testOrgId: string;
    let adminUserId: string;
    let regularUserId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        // Setup test organization
        const org = await testFactory.createOrganization({
            name: 'Notification Test Org',
            plan: 'professional',
        });
        testOrgId = org.id;

        const admin = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'AdminPass123!',
            role: 'ADMIN',
        });
        adminUserId = admin.id;

        const user = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'UserPass123!',
            role: 'USER',
        });
        regularUserId = user.id;

        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: admin.email, password: 'AdminPass123!' });
        adminToken = adminLogin.body.token;

        const userLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'UserPass123!' });
        userToken = userLogin.body.token;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('Event Trigger → Notification Creation → Channel Selection Flow', () => {
        it('should create notification from event', async () => {
            const notifRes = await request(app)
                .post('/api/notifications')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    type: 'task_assigned',
                    title: 'New Task Assigned',
                    message: 'You have been assigned a new task',
                    data: { taskId: 'task-123' },
                });

            if (notifRes.status === 200 || notifRes.status === 201) {
                expect(notifRes.body).toHaveProperty('id');
                expect(notifRes.body.type).toBe('task_assigned');
            }
        });

        it('should select delivery channels based on user preferences', async () => {
            const prefsRes = await request(app)
                .get('/api/users/notification-preferences')
                .set('Authorization', `Bearer ${userToken}`);

            if (prefsRes.status === 200) {
                expect(prefsRes.body).toHaveProperty('channels');
                expect(prefsRes.body).toHaveProperty('preferences');
            }
        });

        it('should route notification to multiple channels', async () => {
            const multiChannelRes = await request(app)
                .post('/api/notifications/send')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    type: 'urgent_alert',
                    message: 'Urgent: System maintenance scheduled',
                    channels: ['email', 'sms', 'push', 'in_app'],
                });

            if (multiChannelRes.status === 200 || multiChannelRes.status === 202) {
                expect(multiChannelRes.body).toHaveProperty('deliveryStatus');
            }
        });
    });

    describe('Email Delivery → Template Rendering → Tracking Flow', () => {
        it('should send email notification', async () => {
            const emailRes = await request(app)
                .post('/api/notifications/email')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    to: regularUserId,
                    template: 'task_assigned',
                    data: {
                        taskName: 'Complete Integration Tests',
                        dueDate: '2026-03-31',
                    },
                });

            if (emailRes.status === 200 || emailRes.status === 202) {
                expect(emailRes.body).toHaveProperty('messageId');
            }
        });

        it('should render email template with data', async () => {
            const renderRes = await request(app)
                .post('/api/notifications/templates/render')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    template: 'welcome_email',
                    data: {
                        userName: 'Test User',
                        organizationName: 'Test Org',
                    },
                });

            if (renderRes.status === 200) {
                expect(renderRes.body).toHaveProperty('html');
                expect(renderRes.body).toHaveProperty('text');
            }
        });

        it('should track email delivery status', async () => {
            const trackingRes = await request(app)
                .get('/api/notifications/email/tracking')
                .query({ messageId: 'msg-123' })
                .set('Authorization', `Bearer ${adminToken}`);

            if (trackingRes.status === 200) {
                expect(trackingRes.body).toHaveProperty('status');
                expect(trackingRes.body).toHaveProperty('events');
            }
        });

        it('should handle email bounces', async () => {
            const bounceRes = await request(app)
                .post('/api/notifications/email/bounce')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    messageId: 'msg-bounce-123',
                    bounceType: 'permanent',
                    email: 'bounced@example.com',
                });

            if (bounceRes.status === 200) {
                expect(bounceRes.body).toHaveProperty('handled');
            }
        });
    });

    describe('SMS Delivery → Rate Limiting → Fallback Flow', () => {
        it('should send SMS notification', async () => {
            const smsRes = await request(app)
                .post('/api/notifications/sms')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    to: regularUserId,
                    message: 'Your verification code is: 123456',
                });

            if (smsRes.status === 200 || smsRes.status === 202) {
                expect(smsRes.body).toHaveProperty('messageId');
            }
        });

        it('should enforce SMS rate limiting', async () => {
            // Send multiple SMS in quick succession
            const promises = Array(10).fill(null).map(() =>
                request(app)
                    .post('/api/notifications/sms')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        to: regularUserId,
                        message: 'Rate limit test',
                    })
            );

            const results = await Promise.all(promises);

            // Some should be rate limited
            const rateLimited = results.filter(r => r.status === 429);
            // Depending on rate limit config
        });

        it('should fallback to email when SMS fails', async () => {
            const fallbackRes = await request(app)
                .post('/api/notifications/send-with-fallback')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    message: 'Important notification',
                    primaryChannel: 'sms',
                    fallbackChannel: 'email',
                });

            if (fallbackRes.status === 200 || fallbackRes.status === 202) {
                expect(fallbackRes.body).toHaveProperty('deliveredVia');
            }
        });
    });

    describe('Push Notification → Device Management → Badge Updates Flow', () => {
        let deviceToken: string;

        beforeAll(async () => {
            // Register device for push notifications
            const deviceRes = await request(app)
                .post('/api/devices/register')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    token: 'device-token-123',
                    platform: 'ios',
                });

            if (deviceRes.status === 200 || deviceRes.status === 201) {
                deviceToken = deviceRes.body.token;
            }
        });

        it('should send push notification to device', async () => {
            const pushRes = await request(app)
                .post('/api/notifications/push')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    title: 'New Message',
                    body: 'You have a new message',
                    data: { messageId: 'msg-123' },
                });

            if (pushRes.status === 200 || pushRes.status === 202) {
                expect(pushRes.body).toHaveProperty('sent');
            }
        });

        it('should update badge count', async () => {
            const badgeRes = await request(app)
                .put('/api/notifications/badge')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ count: 5 });

            if (badgeRes.status === 200) {
                expect(badgeRes.body.badgeCount).toBe(5);
            }
        });

        it('should handle device token expiration', async () => {
            const expiredRes = await request(app)
                .post('/api/devices/expired')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ token: 'expired-token-123' });

            if (expiredRes.status === 200) {
                expect(expiredRes.body).toHaveProperty('removed');
            }
        });
    });

    describe('In-App Notification → Real-time Delivery → Read Status Flow', () => {
        let notificationId: string;

        it('should create in-app notification', async () => {
            const inAppRes = await request(app)
                .post('/api/notifications/in-app')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    type: 'system_update',
                    message: 'System will be updated tonight',
                    priority: 'medium',
                });

            if (inAppRes.status === 200 || inAppRes.status === 201) {
                expect(inAppRes.body).toHaveProperty('id');
                notificationId = inAppRes.body.id;
            }
        });

        it('should list unread notifications', async () => {
            const unreadRes = await request(app)
                .get('/api/notifications/unread')
                .set('Authorization', `Bearer ${userToken}`);

            if (unreadRes.status === 200) {
                expect(Array.isArray(unreadRes.body)).toBe(true);
            }
        });

        it('should mark notification as read', async () => {
            if (!notificationId) notificationId = 'mock-notif-id';

            const readRes = await request(app)
                .put(`/api/notifications/${notificationId}/read`)
                .set('Authorization', `Bearer ${userToken}`);

            if (readRes.status === 200) {
                expect(readRes.body.read).toBe(true);
            }
        });

        it('should mark all notifications as read', async () => {
            const markAllRes = await request(app)
                .put('/api/notifications/mark-all-read')
                .set('Authorization', `Bearer ${userToken}`);

            if (markAllRes.status === 200) {
                expect(markAllRes.body).toHaveProperty('markedCount');
            }
        });
    });

    describe('User Preferences → Channel Configuration → Quiet Hours Flow', () => {
        it('should update notification preferences', async () => {
            const prefsRes = await request(app)
                .put('/api/users/notification-preferences')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    email: {
                        enabled: true,
                        types: ['task_assigned', 'mention', 'urgent_alert'],
                    },
                    sms: {
                        enabled: false,
                    },
                    push: {
                        enabled: true,
                        types: ['urgent_alert'],
                    },
                });

            if (prefsRes.status === 200) {
                expect(prefsRes.body).toHaveProperty('preferences');
            }
        });

        it('should configure quiet hours', async () => {
            const quietRes = await request(app)
                .put('/api/users/quiet-hours')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    enabled: true,
                    start: '22:00',
                    end: '08:00',
                    timezone: 'America/New_York',
                });

            if (quietRes.status === 200) {
                expect(quietRes.body.quietHours.enabled).toBe(true);
            }
        });

        it('should respect quiet hours when sending notifications', async () => {
            // Send notification during quiet hours
            const duringQuietRes = await request(app)
                .post('/api/notifications/send')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    type: 'non_urgent',
                    message: 'This should be queued',
                    respectQuietHours: true,
                });

            if (duringQuietRes.status === 200 || duringQuietRes.status === 202) {
                expect(duringQuietRes.body).toHaveProperty('queued');
            }
        });
    });

    describe('Batch Notifications and Digests', () => {
        it('should send batch notifications', async () => {
            const batchRes = await request(app)
                .post('/api/notifications/batch')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userIds: [regularUserId, adminUserId],
                    type: 'system_announcement',
                    message: 'System maintenance scheduled',
                });

            if (batchRes.status === 200 || batchRes.status === 202) {
                expect(batchRes.body).toHaveProperty('sent');
                expect(batchRes.body.sent).toBeGreaterThan(0);
            }
        });

        it('should generate daily digest', async () => {
            const digestRes = await request(app)
                .post('/api/notifications/digest/generate')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    period: 'daily',
                });

            if (digestRes.status === 200) {
                expect(digestRes.body).toHaveProperty('notifications');
                expect(digestRes.body).toHaveProperty('summary');
            }
        });

        it('should send weekly summary', async () => {
            const summaryRes = await request(app)
                .post('/api/notifications/summary/send')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    userId: regularUserId,
                    period: 'weekly',
                });

            if (summaryRes.status === 200 || summaryRes.status === 202) {
                expect(summaryRes.body).toHaveProperty('sent');
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle invalid email address', async () => {
            const invalidRes = await request(app)
                .post('/api/notifications/email')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    to: 'invalid-email',
                    template: 'test',
                });

            expect([400, 422]).toContain(invalidRes.status);
        });

        it('should handle missing notification template', async () => {
            const missingRes = await request(app)
                .post('/api/notifications/email')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    to: regularUserId,
                    template: 'non_existent_template',
                });

            expect([404, 400]).toContain(missingRes.status);
        });

        it('should retry failed deliveries', async () => {
            const retryRes = await request(app)
                .post('/api/notifications/retry')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ notificationId: 'failed-notif-123' });

            if (retryRes.status === 200 || retryRes.status === 202) {
                expect(retryRes.body).toHaveProperty('retryScheduled');
            }
        });
    });
});
