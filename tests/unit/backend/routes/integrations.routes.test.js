import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Integrations Routes Tests
 * Tests external integrations management API endpoints
 * CRITICAL FOR ENTERPRISE ECOSYSTEM INTEGRATION
 */

import integrationsRouter from '../../../../server/src/routes/integrations.routes.ts';

describe('Integrations Routes', () => {
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

        app.use('/api/integrations', integrationsRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/integrations', () => {
        it('should get organization integrations', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'integration-1',
                        name: 'Slack Integration',
                        type: 'slack',
                        status: 'connected',
                        last_sync: '2025-01-01T10:00:00Z'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/integrations')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/integrations', () => {
        it('should create new integration', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const integrationData = {
                name: 'Jira Integration',
                type: 'jira',
                config: {
                    base_url: 'https://company.atlassian.net',
                    username: 'api-user',
                    api_token: 'token123'
                }
            };

            const response = await request(app)
                .post('/api/integrations')
                .send(integrationData)
                .expect(201);

            expect(response.body.integrationId).toBeDefined();
        });

        it('should validate integration type', async () => {
            const invalidData = {
                name: 'Invalid Integration',
                type: 'invalid-type'
            };

            const response = await request(app)
                .post('/api/integrations')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/integrations/:id', () => {
        it('should get integration by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'integration-1',
                    name: 'Slack Integration',
                    type: 'slack',
                    status: 'connected',
                    config: JSON.stringify({ webhook_url: 'https://hooks.slack.com/...' })
                });
            });

            const response = await request(app)
                .get('/api/integrations/integration-1')
                .expect(200);

            expect(response.body.name).toBe('Slack Integration');
        });
    });

    describe('PUT /api/integrations/:id', () => {
        it('should update integration settings', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                name: 'Updated Slack Integration',
                config: {
                    webhook_url: 'https://hooks.slack.com/new-webhook'
                }
            };

            const response = await request(app)
                .put('/api/integrations/integration-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/integrations/:id', () => {
        it('should delete integration', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/integrations/integration-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/integrations/:id/test', () => {
        it('should test integration connection', async () => {
            const response = await request(app)
                .post('/api/integrations/integration-1/test')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBeDefined();
        });
    });

    describe('POST /api/integrations/:id/sync', () => {
        it('should trigger manual sync', async () => {
            const response = await request(app)
                .post('/api/integrations/integration-1/sync')
                .send({ full_sync: true })
                .expect(200);

            expect(response.body.syncId).toBeDefined();
        });
    });

    describe('GET /api/integrations/:id/logs', () => {
        it('should get integration sync logs', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'log-1',
                        integration_id: 'integration-1',
                        status: 'success',
                        records_processed: 150,
                        created_at: '2025-01-01T10:00:00Z'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/integrations/integration-1/logs')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/integrations/types', () => {
        it('should get available integration types', async () => {
            const response = await request(app)
                .get('/api/integrations/types')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/integrations/:id/status', () => {
        it('should get integration health status', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    status: 'healthy',
                    last_check: '2025-01-01T10:00:00Z',
                    uptime_percentage: 99.9
                });
            });

            const response = await request(app)
                .get('/api/integrations/integration-1/status')
                .expect(200);

            expect(response.body.status).toBe('healthy');
        });
    });

    describe('POST /api/integrations/:id/oauth/authorize', () => {
        it('should initiate OAuth flow', async () => {
            const response = await request(app)
                .post('/api/integrations/integration-1/oauth/authorize')
                .send({ scopes: ['read', 'write'] })
                .expect(200);

            expect(response.body.authorizationUrl).toBeDefined();
        });
    });
});




