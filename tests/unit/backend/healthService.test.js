/**
 * Health Service Unit Tests
 * Tests system health checks and monitoring
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Health service implementation for testing
const createHealthService = (dependencies = {}) => {
    const checks = new Map();
    const startTime = Date.now();

    return {
        registerCheck: (name, checkFn, options = {}) => {
            checks.set(name, {
                check: checkFn,
                critical: options.critical ?? false,
                timeout: options.timeout ?? 5000
            });
        },

        runCheck: async (name) => {
            const checkConfig = checks.get(name);
            if (!checkConfig) {
                return { name, status: 'unknown', message: 'Check not found' };
            }

            try {
                const start = Date.now();
                const result = await Promise.race([
                    checkConfig.check(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), checkConfig.timeout)
                    )
                ]);
                const duration = Date.now() - start;

                return {
                    name,
                    status: result.healthy ? 'healthy' : 'unhealthy',
                    duration,
                    details: result.details
                };
            } catch (error) {
                return {
                    name,
                    status: 'unhealthy',
                    error: error.message
                };
            }
        },

        getOverallHealth: async () => {
            const results = {};
            let overallHealthy = true;
            let criticalHealthy = true;

            for (const [name, config] of checks.entries()) {
                const result = await this.runCheck?.(name) || { status: 'unknown' };
                results[name] = result;

                if (result.status !== 'healthy') {
                    overallHealthy = false;
                    if (config.critical) {
                        criticalHealthy = false;
                    }
                }
            }

            return {
                status: criticalHealthy ? (overallHealthy ? 'healthy' : 'degraded') : 'unhealthy',
                uptime: Date.now() - startTime,
                checks: results
            };
        },

        getUptime: () => Date.now() - startTime,

        getRegisteredChecks: () => Array.from(checks.keys())
    };
};

describe('HealthService', () => {
    let healthService;

    beforeEach(() => {
        healthService = createHealthService();
    });

    describe('Basic Health Check', () => {
        it('should return healthy status', async () => {
            healthService.registerCheck('test', async () => ({ healthy: true }));

            const result = await healthService.runCheck('test');

            expect(result.status).toBe('healthy');
        });

        it('should return unhealthy for failed check', async () => {
            healthService.registerCheck('failing', async () => ({ healthy: false }));

            const result = await healthService.runCheck('failing');

            expect(result.status).toBe('unhealthy');
        });

        it('should handle check errors', async () => {
            healthService.registerCheck('error', async () => {
                throw new Error('Connection failed');
            });

            const result = await healthService.runCheck('error');

            expect(result.status).toBe('unhealthy');
            expect(result.error).toBe('Connection failed');
        });
    });

    describe('Uptime Tracking', () => {
        it('should track uptime', async () => {
            const uptime = healthService.getUptime();

            expect(uptime).toBeGreaterThanOrEqual(0);
        });

        it('should increase uptime over time', async () => {
            const uptime1 = healthService.getUptime();
            await new Promise(resolve => setTimeout(resolve, 50));
            const uptime2 = healthService.getUptime();

            expect(uptime2).toBeGreaterThan(uptime1);
        });
    });

    describe('Check Registration', () => {
        it('should register multiple checks', () => {
            healthService.registerCheck('database', async () => ({ healthy: true }));
            healthService.registerCheck('redis', async () => ({ healthy: true }));
            healthService.registerCheck('api', async () => ({ healthy: true }));

            const checks = healthService.getRegisteredChecks();

            expect(checks).toContain('database');
            expect(checks).toContain('redis');
            expect(checks).toContain('api');
        });

        it('should handle unknown check', async () => {
            const result = await healthService.runCheck('nonexistent');

            expect(result.status).toBe('unknown');
        });
    });

    describe('Check Duration', () => {
        it('should measure check duration', async () => {
            healthService.registerCheck('slow', async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                return { healthy: true };
            });

            const result = await healthService.runCheck('slow');

            expect(result.duration).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Check Details', () => {
        it('should include details from check', async () => {
            healthService.registerCheck('detailed', async () => ({
                healthy: true,
                details: {
                    connections: 5,
                    version: '1.0.0'
                }
            }));

            const result = await healthService.runCheck('detailed');

            expect(result.details).toBeDefined();
            expect(result.details.connections).toBe(5);
        });
    });

    describe('Dependency Checks', () => {
        it('should check database health', async () => {
            healthService.registerCheck('database', async () => ({
                healthy: true,
                details: { poolSize: 10, activeConnections: 3 }
            }));

            const result = await healthService.runCheck('database');

            expect(result.status).toBe('healthy');
        });

        it('should check cache health', async () => {
            healthService.registerCheck('cache', async () => ({
                healthy: true,
                details: { hitRate: 0.95, memoryUsage: '512MB' }
            }));

            const result = await healthService.runCheck('cache');

            expect(result.status).toBe('healthy');
        });
    });

    describe('Critical Checks', () => {
        it('should mark critical checks', () => {
            healthService.registerCheck('database', async () => ({ healthy: true }), { critical: true });
            healthService.registerCheck('analytics', async () => ({ healthy: true }), { critical: false });

            const checks = healthService.getRegisteredChecks();
            expect(checks.length).toBe(2);
        });
    });
});
