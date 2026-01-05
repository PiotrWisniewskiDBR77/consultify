/**
 * Health Routes Tests
 *
 * Tests for health check API endpoints
 * CRITICAL FOR INFRASTRUCTURE MONITORING
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

import healthRouter from '../../../../server/src/routes/healthRoutes.ts';

// Mock HealthCheckController
vi.mock('../../../../server/src/controllers/HealthCheckController.js', () => ({
    HealthCheckController: {
        ping: vi.fn(),
        checkHealth: vi.fn(),
        checkReadiness: vi.fn(),
        checkLiveness: vi.fn()
    }
}));

// Mock rate limiting middleware
vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
    defaultRateLimiter: vi.fn((req, res, next) => next())
}));

const { HealthCheckController } = await import('../../../../server/src/controllers/HealthCheckController.js');

describe('Health Routes', () => {
    let app;
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        app = express();
        app.use(express.json());

        // Mock rate limiter middleware
        app.use((req, res, next) => next());

        app.use('/health', healthRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /health/ping', () => {
        it('should respond with pong for ping endpoint', async () => {
            HealthCheckController.ping.mockImplementation((req, res) => {
                res.json({ status: 'pong', timestamp: new Date().toISOString() });
            });

            const response = await request(app)
                .get('/health/ping')
                .expect(200);

            expect(HealthCheckController.ping).toHaveBeenCalled();
            expect(response.body.status).toBe('pong');
            expect(response.body.timestamp).toBeDefined();
        });

        it('should handle ping errors gracefully', async () => {
            HealthCheckController.ping.mockImplementation((req, res) => {
                res.status(500).json({ error: 'Ping failed' });
            });

            const response = await request(app)
                .get('/health/ping')
                .expect(500);

            expect(response.body.error).toBe('Ping failed');
        });
    });

    describe('GET /health', () => {
        it('should return health status for main health endpoint', async () => {
            HealthCheckController.checkHealth.mockImplementation((req, res) => {
                res.json({
                    status: 'healthy',
                    uptime: 3600,
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'connected',
                        redis: 'connected',
                        external: 'operational'
                    }
                });
            });

            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(HealthCheckController.checkHealth).toHaveBeenCalled();
            expect(response.body.status).toBe('healthy');
            expect(response.body.uptime).toBeDefined();
            expect(response.body.services).toBeDefined();
        });

        it('should handle health check failures', async () => {
            HealthCheckController.checkHealth.mockImplementation((req, res) => {
                res.status(503).json({
                    status: 'unhealthy',
                    error: 'Database connection failed',
                    timestamp: new Date().toISOString()
                });
            });

            const response = await request(app)
                .get('/health')
                .expect(503);

            expect(response.body.status).toBe('unhealthy');
            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /health/ready', () => {
        it('should check application readiness', async () => {
            HealthCheckController.checkReadiness.mockImplementation((req, res) => {
                res.json({
                    status: 'ready',
                    checks: {
                        database: 'ready',
                        migrations: 'applied',
                        cache: 'warm'
                    },
                    timestamp: new Date().toISOString()
                });
            });

            const response = await request(app)
                .get('/health/ready')
                .expect(200);

            expect(HealthCheckController.checkReadiness).toHaveBeenCalled();
            expect(response.body.status).toBe('ready');
            expect(response.body.checks).toBeDefined();
        });

        it('should return not ready when dependencies are down', async () => {
            HealthCheckController.checkReadiness.mockImplementation((req, res) => {
                res.status(503).json({
                    status: 'not ready',
                    checks: {
                        database: 'down',
                        migrations: 'pending',
                        cache: 'cold'
                    },
                    timestamp: new Date().toISOString()
                });
            });

            const response = await request(app)
                .get('/health/ready')
                .expect(503);

            expect(response.body.status).toBe('not ready');
            expect(response.body.checks.database).toBe('down');
        });
    });

    describe('GET /health/live', () => {
        it('should check application liveness', async () => {
            HealthCheckController.checkLiveness.mockImplementation((req, res) => {
                res.json({
                    status: 'alive',
                    memory: { used: 100, free: 900 },
                    cpu: { usage: 45 },
                    timestamp: new Date().toISOString()
                });
            });

            const response = await request(app)
                .get('/health/live')
                .expect(200);

            expect(HealthCheckController.checkLiveness).toHaveBeenCalled();
            expect(response.body.status).toBe('alive');
            expect(response.body.memory).toBeDefined();
            expect(response.body.cpu).toBeDefined();
        });

        it('should detect application death', async () => {
            HealthCheckController.checkLiveness.mockImplementation((req, res) => {
                res.status(503).json({
                    status: 'dead',
                    error: 'Memory leak detected',
                    memory: { used: 950, free: 50 },
                    timestamp: new Date().toISOString()
                });
            });

            const response = await request(app)
                .get('/health/live')
                .expect(503);

            expect(response.body.status).toBe('dead');
            expect(response.body.error).toBeDefined();
        });
    });

    describe('Rate Limiting', () => {
        it('should apply default rate limiter to all health endpoints', async () => {
            const { defaultRateLimiter } = await import('../../../../server/src/middleware/rateLimiting.middleware.js');

            HealthCheckController.ping.mockImplementation((req, res) => {
                res.json({ status: 'pong' });
            });

            await request(app).get('/health/ping');

            expect(defaultRateLimiter).toHaveBeenCalled();
        });

        it('should handle rate limit exceeded', async () => {
            const { defaultRateLimiter } = await import('../../../../server/src/middleware/rateLimiting.middleware.js');

            // Mock rate limiter to reject requests
            defaultRateLimiter.mockImplementation((req, res, next) => {
                res.status(429).json({ error: 'Too many requests' });
            });

            const response = await request(app)
                .get('/health/ping')
                .expect(429);

            expect(response.body.error).toBe('Too many requests');
        });
    });

    describe('Error Handling', () => {
        it('should handle controller exceptions', async () => {
            HealthCheckController.checkHealth.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const response = await request(app)
                .get('/health')
                .expect(500);

            expect(response.body).toBeDefined();
        });

        it('should handle async errors in controllers', async () => {
            HealthCheckController.checkReadiness.mockImplementation(async () => {
                throw new Error('Database timeout');
            });

            const response = await request(app)
                .get('/health/ready')
                .expect(500);

            expect(response.body).toBeDefined();
        });
    });

    describe('Response Format', () => {
        it('should return JSON responses', async () => {
            HealthCheckController.ping.mockImplementation((req, res) => {
                res.json({ test: 'data' });
            });

            const response = await request(app)
                .get('/health/ping')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body.test).toBe('data');
        });

        it('should include timestamps in responses', async () => {
            const timestamp = new Date().toISOString();

            HealthCheckController.checkLiveness.mockImplementation((req, res) => {
                res.json({ timestamp });
            });

            const response = await request(app)
                .get('/health/live')
                .expect(200);

            expect(response.body.timestamp).toBe(timestamp);
        });
    });

    describe('Performance', () => {
        it('should respond quickly to ping', async () => {
            HealthCheckController.ping.mockImplementation((req, res) => {
                res.json({ status: 'pong' });
            });

            const startTime = Date.now();

            await request(app)
                .get('/health/ping')
                .expect(200);

            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(100); // Should respond in less than 100ms
        });

        it('should handle concurrent health checks', async () => {
            HealthCheckController.checkHealth.mockImplementation((req, res) => {
                setTimeout(() => res.json({ status: 'healthy' }), 10);
            });

            const promises = [
                request(app).get('/health'),
                request(app).get('/health'),
                request(app).get('/health')
            ];

            const responses = await Promise.all(promises);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.status).toBe('healthy');
            });
        });
    });
});



