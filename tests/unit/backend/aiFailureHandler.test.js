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
        vi.resetModules();
        
        mockDb = createMockDb();
        
        // Mock database before importing
        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        AIFailureHandler = require('../../../server/services/aiFailureHandler.js');
        
        // Inject dependencies
        AIFailureHandler.setDependencies({ 
            db: mockDb,
            uuidv4: () => 'test-uuid-1234'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        vi.doUnmock('../../../server/database');
    });

    describe('withFallback()', () => {
        it('should execute AI function successfully', async () => {
            const aiFunction = async () => 'success';
            const fallbackFn = vi.fn();

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) callback.call({ changes: 1 }, null);
            });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { overall_status: 'healthy' });
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
                if (callback) callback.call({ changes: 1 }, null);
            });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { overall_status: 'healthy' });
            });

            const result = await AIFailureHandler.withFallback(aiFunction, fallbackFn);

            expect(result.success).toBe(true);
            expect(fallbackFn).toHaveBeenCalled();
        });

        it('should handle timeout', async () => {
            vi.useFakeTimers();
            
            const slowFunction = async () => {
                await new Promise(resolve => setTimeout(resolve, 60000));
                return 'slow result';
            };
            const fallbackFn = vi.fn().mockResolvedValue('timeout fallback');

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) callback.call({ changes: 1 }, null);
            });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { overall_status: 'healthy' });
            });

            const resultPromise = AIFailureHandler.withFallback(slowFunction, fallbackFn, { timeoutMs: 100 });
            
            vi.advanceTimersByTime(200);
            
            const result = await resultPromise;
            
            expect(fallbackFn).toHaveBeenCalled();
            
            vi.useRealTimers();
        });

        it('should return graceful degradation when fallback also fails', async () => {
            const aiFunction = async () => {
                throw new Error('AI Error');
            };
            const fallbackFn = vi.fn().mockRejectedValue(new Error('Fallback Error'));

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) callback.call({ changes: 1 }, null);
            });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { overall_status: 'healthy' });
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

            const result = await AIFailureHandler.logFailure(failureType, context);

            expect(result).toBeDefined();
            expect(result.logged).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ai_failure_log'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('getRecentFailures()', () => {
        it('should return recent failures', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    { failure_type: 'timeout', count: 1, last_occurred: new Date().toISOString() },
                    { failure_type: 'rate_limited', count: 1, last_occurred: new Date().toISOString() }
                ]);
            });

            const failures = await AIFailureHandler.getRecentFailures(null, 24);

            expect(failures.totalFailures).toBe(2);
            expect(failures.byType).toBeDefined();
            expect(failures.lastHours).toBe(24);
        });
    });

    describe('degrade()', () => {
        it('should return degradation info for model unavailable', () => {
            const result = AIFailureHandler.degrade(AIFailureHandler.FAILURE_SCENARIOS.MODEL_UNAVAILABLE);
            
            expect(result.message).toBeDefined();
            expect(result.capabilities).toBeDefined();
            expect(result.limitations).toBeDefined();
        });

        it('should return degradation info for budget exceeded', () => {
            const result = AIFailureHandler.degrade(AIFailureHandler.FAILURE_SCENARIOS.BUDGET_EXCEEDED);
            
            expect(result.message).toContain('limit');
            expect(result.capabilities).toContain('cached_insights');
        });

        it('should return degradation info for timeout', () => {
            const result = AIFailureHandler.degrade(AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT);
            
            expect(result.message).toBeDefined();
            expect(result.action).toBeDefined();
        });
    });

    describe('explainFailure()', () => {
        it('should return user-friendly explanation for timeout', () => {
            const explanation = AIFailureHandler.explainFailure(AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT);
            
            expect(explanation).toBeDefined();
            expect(explanation.title).toBeDefined();
            expect(explanation.message).toBeDefined();
            expect(explanation.userAction).toBeDefined();
        });

        it('should return explanation for budget exceeded', () => {
            const explanation = AIFailureHandler.explainFailure(AIFailureHandler.FAILURE_SCENARIOS.BUDGET_EXCEEDED);
            
            expect(explanation).toBeDefined();
            expect(explanation.title).toContain('Limit');
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
                throw new Error('AI failed');
            };
            const defaultValue = 'default value';

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const result = await AIFailureHandler.nonBlocking(aiFunction, defaultValue);

            expect(result.value).toBe(defaultValue);
            expect(result.fromAI).toBe(false);
        });
    });

    describe('FAILURE_SCENARIOS and HEALTH_STATUS constants', () => {
        it('should have all expected failure scenarios', () => {
            expect(AIFailureHandler.FAILURE_SCENARIOS.MODEL_UNAVAILABLE).toBe('model_unavailable');
            expect(AIFailureHandler.FAILURE_SCENARIOS.BUDGET_EXCEEDED).toBe('budget_exceeded');
            expect(AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT).toBe('timeout');
            expect(AIFailureHandler.FAILURE_SCENARIOS.RATE_LIMITED).toBe('rate_limited');
        });

        it('should have all expected health statuses', () => {
            expect(AIFailureHandler.HEALTH_STATUS.HEALTHY).toBe('healthy');
            expect(AIFailureHandler.HEALTH_STATUS.DEGRADED).toBe('degraded');
            expect(AIFailureHandler.HEALTH_STATUS.UNAVAILABLE).toBe('unavailable');
        });
    });
});

