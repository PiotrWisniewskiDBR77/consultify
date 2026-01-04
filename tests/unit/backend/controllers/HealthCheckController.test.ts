/**
 * Health Check Controller Tests
 *
 * Tests for health monitoring endpoints including ping, readiness, and liveness probes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { HealthCheckController } from '../../../../server/src/controllers/HealthCheckController.ts';

// Mock external dependencies
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: vi.fn(() => ({
        query: vi.fn().mockResolvedValue({ rows: [] })
    }))
}));

vi.mock('../../../../server/src/services/ai/redisClient.js', () => ({
    isRedisConnected: vi.fn(() => true)
}));

vi.mock('../../../../server/src/services/MetricsService.js', () => ({
    getMetricsService: vi.fn(() => ({
        getMetrics: vi.fn().mockResolvedValue({})
    }))
}));

describe('HealthCheckController', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let jsonSpy: any;
    let statusSpy: any;
    let sendSpy: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup response mock
        jsonSpy = vi.fn();
        statusSpy = vi.fn().mockReturnThis();
        sendSpy = vi.fn();

        mockResponse = {
            status: statusSpy,
            json: jsonSpy,
            send: sendSpy
        };

        mockRequest = {};
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('ping()', () => {
        it('should respond with "pong" and 200 status', () => {
            HealthCheckController.ping(mockRequest as Request, mockResponse as Response);

            expect(statusSpy).toHaveBeenCalledWith(200);
            expect(sendSpy).toHaveBeenCalledWith('pong');
        });

        it('should not use request data', () => {
            const requestWithData = { body: { test: 'data' }, params: { id: '123' } };

            HealthCheckController.ping(requestWithData as Request, mockResponse as Response);

            expect(statusSpy).toHaveBeenCalledWith(200);
            expect(sendSpy).toHaveBeenCalledWith('pong');
        });
    });

    describe('checkHealth()', () => {
        it('should return healthy status with basic information', async () => {
            // Mock environment variables
            const originalEnv = process.env;
            process.env = { ...originalEnv, npm_package_version: '1.2.3', NODE_ENV: 'production' };

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);

            expect(jsonSpy).toHaveBeenCalledWith({
                status: 'ok',
                timestamp: expect.any(String),
                database: 'connected',
                redis: 'connected',
                version: '1.2.3',
                environment: 'production'
            });

            // Restore environment
            process.env = originalEnv;
        });

        it('should handle Redis connection failure', async () => {
            const { isRedisConnected } = await import('../../../../server/src/services/ai/redisClient.js');
            (isRedisConnected as any).mockReturnValue(false);

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.redis).toBe('disconnected');
            expect(response.status).toBe('ok'); // Still ok, Redis is optional
        });

        it('should handle Redis import error', async () => {
            const mockImport = vi.fn(() => {
                throw new Error('Module not found');
            });

            // Mock the dynamic import to fail
            vi.doMock('../../../../server/src/services/ai/redisClient.js', () => {
                throw new Error('Import failed');
            });

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.redis).toBe('error');
        });

        it('should include timestamp in ISO format', async () => {
            const beforeCall = new Date();

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);

            const afterCall = new Date();
            const response = jsonSpy.mock.calls[0][0];

            const responseTime = new Date(response.timestamp);
            expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
            expect(responseTime.getTime()).toBeLessThanOrEqual(afterCall.getTime());
        });

        it('should use default version when npm_package_version is not set', async () => {
            const originalEnv = process.env;
            process.env = { ...originalEnv };
            delete process.env.npm_package_version;

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.version).toBe('0.0.1');

            process.env = originalEnv;
        });

        it('should use default environment when NODE_ENV is not set', async () => {
            const originalEnv = process.env;
            process.env = { ...originalEnv };
            delete process.env.NODE_ENV;

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.environment).toBe('development');

            process.env = originalEnv;
        });
    });

    describe('checkReadiness()', () => {
        it('should return ready status when all checks pass', async () => {
            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            expect(statusSpy).toHaveBeenCalledWith(200);
            expect(jsonSpy).toHaveBeenCalledWith({
                status: 'ready',
                checks: {
                    database: true,
                    redis: true,
                    metrics: true
                },
                timestamp: expect.any(String)
            });
        });

        it('should return not ready status when database check fails', async () => {
            const { getDatabase } = await import('../../../../server/src/database/Database.js');
            (getDatabase as any).mockReturnValue({
                query: vi.fn().mockRejectedValue(new Error('DB connection failed'))
            });

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            expect(statusSpy).toHaveBeenCalledWith(503);
            expect(jsonSpy).toHaveBeenCalledWith({
                status: 'not ready',
                checks: {
                    database: false,
                    redis: true,
                    metrics: true
                },
                timestamp: expect.any(String)
            });
        });

        it('should return not ready status when Redis check fails', async () => {
            const { isRedisConnected } = await import('../../../../server/src/services/ai/redisClient.js');
            (isRedisConnected as any).mockReturnValue(false);

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            expect(statusSpy).toHaveBeenCalledWith(503);
            expect(jsonSpy).toHaveBeenCalledWith({
                status: 'not ready',
                checks: {
                    database: true,
                    redis: false,
                    metrics: true
                },
                timestamp: expect.any(String)
            });
        });

        it('should return not ready status when metrics check fails', async () => {
            const { getMetricsService } = await import('../../../../server/src/services/MetricsService.js');
            const mockMetricsService = { getMetrics: vi.fn().mockRejectedValue(new Error('Metrics failed')) };
            (getMetricsService as any).mockReturnValue(mockMetricsService);

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            expect(statusSpy).toHaveBeenCalledWith(503);
            expect(jsonSpy).toHaveBeenCalledWith({
                status: 'not ready',
                checks: {
                    database: true,
                    redis: true,
                    metrics: false
                },
                timestamp: expect.any(String)
            });
        });

        it('should handle Redis import failure gracefully', async () => {
            // Mock the dynamic import to fail
            vi.doMock('../../../../server/src/services/ai/redisClient.js', () => {
                throw new Error('Import failed');
            });

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.checks.redis).toBe(false);
            expect(response.status).toBe('not ready');
        });

        it('should handle metrics import failure gracefully', async () => {
            // Mock the dynamic import to fail
            vi.doMock('../../../../server/src/services/MetricsService.js', () => {
                throw new Error('Import failed');
            });

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            expect(response.checks.metrics).toBe(false);
            expect(response.status).toBe('not ready');
        });

        it('should perform actual database query to verify connectivity', async () => {
            const { getDatabase } = await import('../../../../server/src/database/Database.js');
            const mockDb = { query: vi.fn().mockResolvedValue({ rows: [] }) };
            (getDatabase as any).mockReturnValue(mockDb);

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);

            expect(mockDb.query).toHaveBeenCalledWith('SELECT 1');
        });
    });

    describe('checkLiveness()', () => {
        it('should return alive status with uptime information', async () => {
            const beforeCall = process.uptime();

            await HealthCheckController.checkLiveness(mockRequest as Request, mockResponse as Response);

            const afterCall = process.uptime();

            expect(statusSpy).toHaveBeenCalledWith(200);
            const response = jsonSpy.mock.calls[0][0];

            expect(response.status).toBe('alive');
            expect(response.timestamp).toBeDefined();
            expect(response.uptime).toBeDefined();
            expect(typeof response.uptime).toBe('number');
            expect(response.uptime).toBeGreaterThanOrEqual(beforeCall);
            expect(response.uptime).toBeLessThanOrEqual(afterCall);
        });

        it('should include valid ISO timestamp', async () => {
            await HealthCheckController.checkLiveness(mockRequest as Request, mockResponse as Response);

            const response = jsonSpy.mock.calls[0][0];
            const timestamp = new Date(response.timestamp);

            expect(timestamp).toBeInstanceOf(Date);
            expect(isNaN(timestamp.getTime())).toBe(false);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete health check workflow', async () => {
            // Test all endpoints in sequence
            HealthCheckController.ping(mockRequest as Request, mockResponse as Response);
            expect(sendSpy).toHaveBeenCalledWith('pong');

            // Reset response mock
            jsonSpy.mockClear();
            statusSpy.mockClear();

            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'ok',
                    database: 'connected',
                    redis: 'connected'
                })
            );

            jsonSpy.mockClear();
            statusSpy.mockClear();

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'ready',
                    checks: expect.objectContaining({
                        database: true,
                        redis: true,
                        metrics: true
                    })
                })
            );

            jsonSpy.mockClear();
            statusSpy.mockClear();

            await HealthCheckController.checkLiveness(mockRequest as Request, mockResponse as Response);
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'alive',
                    uptime: expect.any(Number)
                })
            );
        });

        it('should be resilient to external service failures', async () => {
            // Simulate all external services failing
            const { getDatabase } = await import('../../../../server/src/database/Database.js');
            (getDatabase as any).mockReturnValue({
                query: vi.fn().mockRejectedValue(new Error('DB down'))
            });

            // Mock Redis failure
            vi.doMock('../../../../server/src/services/ai/redisClient.js', () => {
                throw new Error('Redis down');
            });

            // Mock metrics failure
            vi.doMock('../../../../server/src/services/MetricsService.js', () => {
                throw new Error('Metrics down');
            });

            // Health check should still work (optimistic defaults)
            await HealthCheckController.checkHealth(mockRequest as Request, mockResponse as Response);
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'ok',
                    database: 'connected' // Still optimistic
                })
            );

            // Readiness check should fail appropriately
            jsonSpy.mockClear();
            statusSpy.mockClear();

            await HealthCheckController.checkReadiness(mockRequest as Request, mockResponse as Response);
            expect(statusSpy).toHaveBeenCalledWith(503);
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'not ready',
                    checks: expect.objectContaining({
                        database: false,
                        redis: false,
                        metrics: false
                    })
                })
            );

            // Liveness should still work (process-level check)
            jsonSpy.mockClear();
            statusSpy.mockClear();

            await HealthCheckController.checkLiveness(mockRequest as Request, mockResponse as Response);
            expect(statusSpy).toHaveBeenCalledWith(200);
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'alive'
                })
            );
        });
    });
});
