/**
 * System Module API Integration Tests
 */

const request = require('supertest');
const express = require('express');
const auditLogRoutes = require('../../../server/routes/auditLog');
const featureFlagsRoutes = require('../../../server/routes/featureFlags');
const systemHealthRoutes = require('../../../server/routes/systemHealth');

describe('System Module API Integration', () => {
    let app;
    let authToken;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        // Mock auth middleware
        app.use((req, res, next) => {
            req.user = { id: 'test-user', role: 'SUPERADMIN' };
            next();
        });
        app.use('/api/audit-logs', auditLogRoutes);
        app.use('/api/feature-flags', featureFlagsRoutes);
        app.use('/api/system-health', systemHealthRoutes);
    });

    describe('Audit Log API', () => {
        test('GET /api/audit-logs should return audit logs', async () => {
            const response = await request(app)
                .get('/api/audit-logs')
                .expect(200);

            expect(response.body).toHaveProperty('logs');
            expect(response.body).toHaveProperty('pagination');
        });

        test('GET /api/audit-logs/stats should return statistics', async () => {
            const response = await request(app)
                .get('/api/audit-logs/stats/summary')
                .expect(200);

            expect(response.body).toHaveProperty('total');
        });
    });

    describe('Feature Flags API', () => {
        test('GET /api/feature-flags/admin should return feature flags', async () => {
            const response = await request(app)
                .get('/api/feature-flags/admin')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        test('POST /api/feature-flags should create a feature flag', async () => {
            const flagData = {
                flag_key: 'test_api_flag',
                name: 'Test API Flag',
                enabled: false,
                flag_type: 'boolean',
                environment: 'production'
            };

            const response = await request(app)
                .post('/api/feature-flags')
                .send(flagData)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.flag_key).toBe('test_api_flag');
        });
    });

    describe('System Health API', () => {
        test('GET /api/system-health should return health status', async () => {
            const response = await request(app)
                .get('/api/system-health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
        });

        test('GET /api/system-health/detailed should return detailed health', async () => {
            const response = await request(app)
                .get('/api/system-health/detailed')
                .expect(200);

            expect(response.body).toHaveProperty('api');
            expect(response.body).toHaveProperty('database');
            expect(response.body).toHaveProperty('system');
        });
    });
});








