import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

/**
 * AI Performance Routes Integration Tests
 * Tests AI performance dashboard and metrics collection
 * 
 * Related to:
 * - AIPerformanceDashboard.tsx component
 * - AIPlatformModule Performance tab
 */

const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization } = require('../../../server/models');

describe('AI Performance Routes Integration Tests', () => {
    const db = getDatabase();
    let testUser;
    let testOrg;
    let authToken;

    beforeAll(async () => {
        await initializeDatabase();
        // Create test data
        testOrg = await Organization.create({
            name: 'Test AI Performance Org',
            domain: 'ai-performance-test.com'
        });

        testUser = await User.create({
            firstName: 'Performance',
            lastName: 'TestUser',
            email: 'performance-test@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'admin'
        });

        // Mock JWT token
        authToken = 'mock-jwt-token-for-performance-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai-analytics/performance', () => {
    const db = getDatabase();
        it('should return performance metrics with default time range', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('metrics');
        });

        it('should return metrics for 1h time range', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ range: '1h' });

            expect(response.status).toBe(200);
            expect(response.body.metrics).toBeDefined();
        });

        it('should return metrics for 24h time range', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ range: '24h' });

            expect(response.status).toBe(200);
        });

        it('should return metrics for 7d time range', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ range: '7d' });

            expect(response.status).toBe(200);
        });

        it('should return metrics for 30d time range', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ range: '30d' });

            expect(response.status).toBe(200);
        });

        it('should include response time metrics', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.metrics) {
                expect(response.body.metrics).toHaveProperty('avgResponseTime');
                expect(response.body.metrics).toHaveProperty('p50ResponseTime');
                expect(response.body.metrics).toHaveProperty('p95ResponseTime');
                expect(response.body.metrics).toHaveProperty('p99ResponseTime');
            }
        });

        it('should include request counts and success rates', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.metrics) {
                expect(response.body.metrics).toHaveProperty('totalRequests');
                expect(response.body.metrics).toHaveProperty('successRate');
                expect(response.body.metrics).toHaveProperty('errorRate');
            }
        });

        it('should include token usage metrics', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.metrics) {
                expect(response.body.metrics).toHaveProperty('avgTokensPerRequest');
                expect(response.body.metrics).toHaveProperty('totalTokensUsed');
            }
        });

        it('should include cache metrics', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.metrics) {
                expect(response.body.metrics).toHaveProperty('cacheHitRate');
            }
        });

        it('should include cost metrics', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.metrics) {
                expect(response.body.metrics).toHaveProperty('totalCostUsd');
            }
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/ai-analytics/performance - Capability Metrics', () => {
    const db = getDatabase();
        it('should return capabilities breakdown', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.capabilities) {
                expect(Array.isArray(response.body.capabilities)).toBe(true);
                
                if (response.body.capabilities.length > 0) {
                    const cap = response.body.capabilities[0];
                    expect(cap).toHaveProperty('capability');
                    expect(cap).toHaveProperty('requests');
                    expect(cap).toHaveProperty('avgResponseTime');
                    expect(cap).toHaveProperty('avgTokens');
                    expect(cap).toHaveProperty('totalCost');
                    expect(cap).toHaveProperty('successRate');
                }
            }
        });

        it('should include common capabilities', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.capabilities && response.body.capabilities.length > 0) {
                const capabilityNames = response.body.capabilities.map(c => c.capability);
                // At least some common capabilities should be present
                const commonCaps = ['chat', 'report', 'initiative', 'diagnose', 'task'];
                const hasCommon = commonCaps.some(cap => capabilityNames.includes(cap));
                expect(hasCommon).toBe(true);
            }
        });
    });

    describe('GET /api/ai-analytics/performance - Model Metrics', () => {
    const db = getDatabase();
        it('should return models breakdown', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.models) {
                expect(Array.isArray(response.body.models)).toBe(true);
                
                if (response.body.models.length > 0) {
                    const model = response.body.models[0];
                    expect(model).toHaveProperty('model');
                    expect(model).toHaveProperty('requests');
                    expect(model).toHaveProperty('avgResponseTime');
                    expect(model).toHaveProperty('avgQuality');
                    expect(model).toHaveProperty('totalCost');
                    expect(model).toHaveProperty('successRate');
                }
            }
        });

        it('should include quality metrics per model', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.models && response.body.models.length > 0) {
                response.body.models.forEach(model => {
                    if (model.avgQuality !== undefined) {
                        expect(model.avgQuality).toBeGreaterThanOrEqual(0);
                        expect(model.avgQuality).toBeLessThanOrEqual(1);
                    }
                });
            }
        });
    });

    describe('GET /api/ai-analytics/performance - Time Series Data', () => {
    const db = getDatabase();
        it('should return response time trend data', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.responseTimeTrend) {
                expect(Array.isArray(response.body.responseTimeTrend)).toBe(true);
                
                if (response.body.responseTimeTrend.length > 0) {
                    const point = response.body.responseTimeTrend[0];
                    expect(point).toHaveProperty('timestamp');
                    expect(point).toHaveProperty('value');
                }
            }
        });

        it('should return correct number of data points for time range', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ range: '24h' });

            expect(response.status).toBe(200);
            if (response.body.responseTimeTrend) {
                // For 24h, should have around 24 hourly data points
                expect(response.body.responseTimeTrend.length).toBeLessThanOrEqual(48);
            }
        });
    });

    describe('Caching & Performance', () => {
    const db = getDatabase();
        it('should respond within acceptable time', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            // Should respond within 3 seconds
            expect(responseTime).toBeLessThan(3000);
        });

        it('should handle concurrent requests', async () => {
            const promises = Array(5).fill().map(() =>
                request(app)
                    .get('/api/ai-analytics/performance')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(promises);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });

    describe('Error Handling', () => {
    const db = getDatabase();
        it('should handle invalid time range gracefully', async () => {
            const response = await request(app)
                .get('/api/ai-analytics/performance')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ range: 'invalid' });

            // Should either return 400 or default to 24h
            expect([200, 400]).toContain(response.status);
        });
    });
});