import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Settings Routes Tests
 * Tests user and organization settings API endpoints
 * CRITICAL FOR ENTERPRISE CONFIGURATION MANAGEMENT
 */

import settingsRouter from '../../../../server/src/routes/settings.routes.ts';

describe('Settings Routes', () => {
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

        app.use('/api/settings', settingsRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/settings/user', () => {
        it('should get user settings', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    user_id: 'test-user',
                    theme: 'dark',
                    language: 'en',
                    timezone: 'UTC',
                    email_notifications: true,
                    dashboard_layout: 'grid'
                });
            });

            const response = await request(app)
                .get('/api/settings/user')
                .expect(200);

            expect(response.body.theme).toBe('dark');
            expect(response.body.language).toBe('en');
        });
    });

    describe('PUT /api/settings/user', () => {
        it('should update user settings', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const settingsData = {
                theme: 'light',
                language: 'pl',
                timezone: 'Europe/Warsaw'
            };

            const response = await request(app)
                .put('/api/settings/user')
                .send(settingsData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should validate timezone format', async () => {
            const invalidData = {
                timezone: 'Invalid/Timezone'
            };

            const response = await request(app)
                .put('/api/settings/user')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/settings/organization', () => {
        it('should get organization settings', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    organization_id: 'test-org',
                    name: 'Test Organization',
                    domain: 'test.com',
                    logo_url: 'https://test.com/logo.png',
                    primary_color: '#007bff',
                    allow_guest_access: false
                });
            });

            const response = await request(app)
                .get('/api/settings/organization')
                .expect(200);

            expect(response.body.name).toBe('Test Organization');
        });

        it('should require admin access', async () => {
            // Mock non-admin user
            app.use((req, res, next) => {
                req.user = { id: 'test-user', role: 'MEMBER' };
                next();
            });

            const response = await request(app)
                .get('/api/settings/organization')
                .expect(403);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/settings/organization', () => {
        it('should update organization settings', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const orgSettings = {
                name: 'Updated Organization',
                domain: 'updated.com',
                primary_color: '#28a745'
            };

            const response = await request(app)
                .put('/api/settings/organization')
                .send(orgSettings)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/settings/security', () => {
        it('should get security settings', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    user_id: 'test-user',
                    two_factor_enabled: true,
                    session_timeout: 3600,
                    password_policy: 'strong',
                    login_notifications: true
                });
            });

            const response = await request(app)
                .get('/api/settings/security')
                .expect(200);

            expect(response.body.two_factor_enabled).toBe(true);
        });
    });

    describe('PUT /api/settings/security', () => {
        it('should update security settings', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const securitySettings = {
                session_timeout: 7200,
                login_notifications: false
            };

            const response = await request(app)
                .put('/api/settings/security')
                .send(securitySettings)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/settings/preferences', () => {
        it('should get user preferences', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    user_id: 'test-user',
                    default_view: 'kanban',
                    items_per_page: 25,
                    auto_save: true,
                    keyboard_shortcuts: true
                });
            });

            const response = await request(app)
                .get('/api/settings/preferences')
                .expect(200);

            expect(response.body.default_view).toBe('kanban');
        });
    });

    describe('PUT /api/settings/preferences', () => {
        it('should update user preferences', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const preferences = {
                default_view: 'list',
                items_per_page: 50,
                auto_save: false
            };

            const response = await request(app)
                .put('/api/settings/preferences')
                .send(preferences)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/settings/integrations', () => {
        it('should get integration settings', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'integration-1',
                        type: 'slack',
                        enabled: true,
                        config: JSON.stringify({ webhook_url: 'https://hooks.slack.com/...' })
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/settings/integrations')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/settings/reset', () => {
        it('should reset user settings to defaults', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .post('/api/settings/reset')
                .send({ confirm: true })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should require confirmation', async () => {
            const response = await request(app)
                .post('/api/settings/reset')
                .send({})
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });
});





