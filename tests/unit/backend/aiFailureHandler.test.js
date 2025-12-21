/**
 * AI Failure Handler Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests failure handling, graceful degradation, and resilience.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('AIFailureHandler', () => {
    let mockDb;
    let AIFailureHandler;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        AIFailureHandler = require('../../../server/services/aiFailureHandler.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('withFallback()', () => {
        it('should execute AI function successfully', async () => {
            const aiFunction = async () => 'success';
            const fallbackFn = vi.fn();

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.withFallback(aiFunction, fallbackFn);

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.usedFallback).toBe(false);
            expect(fallbackFn).not.toHaveBeenCalled();
        });

        it('should use fallback when AI function fails', async () => {
            const aiFunction = async () => {
                throw new Error('AI Error');
            };
            const fallbackFn = vi.fn().mockResolvedValue('fallback result');

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.withFallback(aiFunction, fallbackFn);

            expect(result.success).toBe(true);
            expect(result.data).toBe('fallback result');
            expect(result.usedFallback).toBe(true);
            expect(fallbackFn).toHaveBeenCalled();
        });

        it('should handle timeout', async () => {
            vi.useFakeTimers();
            
            const aiFunction = async () => {
                return new Promise(resolve => setTimeout(resolve, 10000));
            };
            const fallbackFn = vi.fn().mockResolvedValue('timeout fallback');

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const promise = AIFailureHandler.withFallback(aiFunction, fallbackFn, { timeoutMs: 1000 });
            
            vi.advanceTimersByTime(1000);
            
            const result = await promise;

            expect(result.usedFallback).toBe(true);
            expect(result.failureType).toBe(AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT);
        });

        it('should return graceful degradation when fallback also fails', async () => {
            const aiFunction = async () => {
                throw new Error('AI Error');
            };
            const fallbackFn = vi.fn().mockRejectedValue(new Error('Fallback Error'));

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.withFallback(aiFunction, fallbackFn);

            expect(result.success).toBe(false);
            expect(result.fallbackFailed).toBe(true);
            expect(result.gracefulDegradation).toBeDefined();
        });
    });

    describe('_identifyFailureType()', () => {
        it('should identify timeout errors', () => {
            const error = new Error('AI_TIMEOUT');
            const type = AIFailureHandler._identifyFailureType(error);
            expect(type).toBe(AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT);
        });

        it('should identify rate limit errors', () => {
            const error = { message: 'Rate limit exceeded', code: '429' };
            const type = AIFailureHandler._identifyFailureType(error);
            expect(type).toBe(AIFailureHandler.FAILURE_SCENARIOS.RATE_LIMITED);
        });

        it('should identify budget exceeded errors', () => {
            const error = { message: 'Budget exceeded' };
            const type = AIFailureHandler._identifyFailureType(error);
            expect(type).toBe(AIFailureHandler.FAILURE_SCENARIOS.BUDGET_EXCEEDED);
        });

        it('should identify authentication errors', () => {
            const error = { message: 'Authentication failed', code: '401' };
            const type = AIFailureHandler._identifyFailureType(error);
            expect(type).toBe(AIFailureHandler.FAILURE_SCENARIOS.AUTHENTICATION_ERROR);
        });

        it('should default to unknown error', () => {
            const error = new Error('Unknown error');
            const type = AIFailureHandler._identifyFailureType(error);
            expect(type).toBeDefined();
        });
    });

    describe('logFailure()', () => {
        it('should log failure to database', async () => {
            const failureType = AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT;
            const context = {
                userId: testUsers.user.id,
                projectId: testProjects.project1.id,
                errorMessage: 'Test error'
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            await AIFailureHandler.logFailure(failureType, context);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ai_failure_logs'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('getHealthStatus()', () => {
        it('should return health status', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    overall_status: AIFailureHandler.HEALTH_STATUS.HEALTHY,
                    last_successful_call: new Date().toISOString()
                });
            });

            const status = await AIFailureHandler.getHealthStatus();

            expect(status.overall).toBe(AIFailureHandler.HEALTH_STATUS.HEALTHY);
        });

        it('should return default status when not found', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const status = await AIFailureHandler.getHealthStatus();

            expect(status.overall).toBe(AIFailureHandler.HEALTH_STATUS.HEALTHY);
        });
    });

    describe('getRecentFailures()', () => {
        it('should return recent failures', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    { failure_type: 'timeout', occurred_at: new Date().toISOString() },
                    { failure_type: 'rate_limited', occurred_at: new Date().toISOString() }
                ]);
            });

            const failures = await AIFailureHandler.getRecentFailures(null, 24);

            expect(failures.totalFailures).toBe(2);
            expect(Array.isArray(failures.failures)).toBe(true);
        });
    });

    describe('forceHealthCheck()', () => {
        it('should return HEALTHY status when no recent failures', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.forceHealthCheck();

            expect(result.status).toBe(AIFailureHandler.HEALTH_STATUS.HEALTHY);
        });

        it('should return DEGRADED status with 3+ failures', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {}, {}, {}, {} // 4 failures
                ]);
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.forceHealthCheck();

            expect(result.status).toBe(AIFailureHandler.HEALTH_STATUS.DEGRADED);
        });

        it('should return UNAVAILABLE status with 10+ failures', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, new Array(10).fill({}));
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.forceHealthCheck();

            expect(result.status).toBe(AIFailureHandler.HEALTH_STATUS.UNAVAILABLE);
        });
    });

    describe('nonBlocking()', () => {
        it('should return AI result when successful', async () => {
            const aiFunction = async () => 'ai result';
            const defaultValue = 'default';

            const result = await AIFailureHandler.nonBlocking(aiFunction, defaultValue);

            expect(result.value).toBe('ai result');
            expect(result.fromAI).toBe(true);
        });

        it('should return default value when AI fails', async () => {
            const aiFunction = async () => {
                throw new Error('AI Error');
            };
            const defaultValue = 'default';

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.nonBlocking(aiFunction, defaultValue);

            expect(result.value).toBe(defaultValue);
            expect(result.fromAI).toBe(false);
            expect(result.reason).toContain('unavailable');
        });
    });

    describe('explainFailure()', () => {
        it('should return user-friendly explanation for timeout', () => {
            const explanation = AIFailureHandler.explainFailure(
                AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT
            );
            expect(explanation).toBeDefined();
            expect(typeof explanation).toBe('string');
        });
    });

    describe('degrade()', () => {
        it('should return graceful degradation response', () => {
            const degradation = AIFailureHandler.degrade(
                AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT,
                { projectId: testProjects.project1.id }
            );
            expect(degradation).toBeDefined();
            expect(degradation.message).toBeDefined();
        });
    });
});
