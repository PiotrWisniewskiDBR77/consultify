import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Webhooks Routes Tests
 * Tests for webhook management API endpoints
 * CRITICAL FOR ENTERPRISE INTEGRATION CAPABILITIES
 */

import webhooksRouter from '../../../../server/src/routes/webhooks.routes.ts';

describe('Webhooks Routes', () => {
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

        app.use('/api/webhooks', webhooksRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/webhooks', () => {
        it('should get webhooks for organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'webhook-1',
                        url: 'https://example.com/webhook',
                        events: ['task.completed', 'project.updated'],
                        organization_id: 'test-org',
                        active: 1
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/webhooks')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/webhooks', () => {
        it('should create new webhook', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const webhookData = {
                url: 'https://example.com/webhook',
                events: ['task.completed'],
                secret: 'webhook-secret'
            };

            const response = await request(app)
                .post('/api/webhooks')
                .send(webhookData)
                .expect(201);

            expect(response.body.id).toBeDefined();
        });

        it('should validate URL format', async () => {
            const response = await request(app)
                .post('/api/webhooks')
                .send({ url: 'invalid-url', events: ['task.completed'] })
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/webhooks/:id', () => {
        it('should get webhook by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'webhook-1',
                    url: 'https://example.com/webhook',
                    events: JSON.stringify(['task.completed']),
                    organization_id: 'test-org'
                });
            });

            const response = await request(app)
                .get('/api/webhooks/webhook-1')
                .expect(200);

            expect(response.body.url).toBe('https://example.com/webhook');
            expect(Array.isArray(response.body.events)).toBe(true);
        });
    });

    describe('PUT /api/webhooks/:id', () => {
        it('should update webhook', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                url: 'https://updated-example.com/webhook',
                events: ['task.completed', 'project.created']
            };

            const response = await request(app)
                .put('/api/webhooks/webhook-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/webhooks/:id', () => {
        it('should delete webhook', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/webhooks/webhook-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/webhooks/:id/test', () => {
        it('should send test webhook', async () => {
            // Mock successful webhook delivery
            const response = await request(app)
                .post('/api/webhooks/webhook-1/test')
                .send({ event: 'task.completed', data: { taskId: 'task-1' } })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/webhooks/:id/deliveries', () => {
        it('should get webhook delivery history', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'delivery-1',
                        webhook_id: 'webhook-1',
                        status: 'success',
                        response_code: 200,
                        delivered_at: '2025-01-01T10:00:00Z'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/webhooks/webhook-1/deliveries')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});



