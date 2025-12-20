import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit Tests for AsyncJobService
 * Step 11: Tests async job lifecycle management
 * 
 * Note: These tests focus on pure function logic and exported constants.
 * DB/queue interactions are tested via integration tests.
 */

describe('AsyncJobService Constants and Logic', () => {
    let AsyncJobService;

    beforeEach(async () => {
        vi.resetModules();

        // Mock the dependencies before requiring the service
        vi.doMock('../../server/database', () => ({
            default: {
                run: vi.fn((sql, params, cb) => {
                    if (typeof params === 'function') params(null);
                    else if (cb) cb(null);
                }),
                get: vi.fn((sql, params, cb) => cb(null, null)),
                all: vi.fn((sql, params, cb) => cb(null, []))
            }
        }));

        vi.doMock('../../server/queues/aiQueue', () => ({
            default: {
                add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
                getJob: vi.fn().mockResolvedValue(null)
            }
        }));

        vi.doMock('../../server/utils/auditLogger', () => ({
            default: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn()
            }
        }));

        vi.doMock('uuid', () => ({
            v4: () => 'test-uuid-1234'
        }));

        // Now require the service
        AsyncJobService = (await import('../../server/ai/asyncJobService')).default;
    });

    describe('JOB_TYPES Constants', () => {
        it('should export EXECUTE_DECISION type', () => {
            expect(AsyncJobService.JOB_TYPES).toBeDefined();
            expect(AsyncJobService.JOB_TYPES.EXECUTE_DECISION).toBe('EXECUTE_DECISION');
        });

        it('should export ADVANCE_PLAYBOOK_STEP type', () => {
            expect(AsyncJobService.JOB_TYPES.ADVANCE_PLAYBOOK_STEP).toBe('ADVANCE_PLAYBOOK_STEP');
        });
    });

    describe('JOB_STATUSES Constants', () => {
        it('should export all required statuses', () => {
            const statuses = AsyncJobService.JOB_STATUSES;

            expect(statuses.QUEUED).toBe('QUEUED');
            expect(statuses.RUNNING).toBe('RUNNING');
            expect(statuses.SUCCESS).toBe('SUCCESS');
            expect(statuses.FAILED).toBe('FAILED');
            expect(statuses.DEAD_LETTER).toBe('DEAD_LETTER');
            expect(statuses.CANCELLED).toBe('CANCELLED');
        });

        it('should have 6 status types', () => {
            expect(Object.keys(AsyncJobService.JOB_STATUSES)).toHaveLength(6);
        });
    });

    describe('Service Methods Existence', () => {
        it('should export enqueueActionExecution', () => {
            expect(typeof AsyncJobService.enqueueActionExecution).toBe('function');
        });

        it('should export enqueuePlaybookAdvance', () => {
            expect(typeof AsyncJobService.enqueuePlaybookAdvance).toBe('function');
        });

        it('should export getJob', () => {
            expect(typeof AsyncJobService.getJob).toBe('function');
        });

        it('should export listJobs', () => {
            expect(typeof AsyncJobService.listJobs).toBe('function');
        });

        it('should export retryJob', () => {
            expect(typeof AsyncJobService.retryJob).toBe('function');
        });

        it('should export cancelJob', () => {
            expect(typeof AsyncJobService.cancelJob).toBe('function');
        });

        it('should export updateJobStatus', () => {
            expect(typeof AsyncJobService.updateJobStatus).toBe('function');
        });

        it('should export markDeadLetter', () => {
            expect(typeof AsyncJobService.markDeadLetter).toBe('function');
        });

        it('should export incrementAttempts', () => {
            expect(typeof AsyncJobService.incrementAttempts).toBe('function');
        });
    });
});

describe('Action Error Codes', () => {
    it('should include async job error codes', async () => {
        const { ACTION_ERROR_CODES } = await import('../../server/ai/actionErrors');

        expect(ACTION_ERROR_CODES.JOB_NOT_FOUND).toBe('JOB_NOT_FOUND');
        expect(ACTION_ERROR_CODES.JOB_INVALID_STATE).toBe('JOB_INVALID_STATE');
        expect(ACTION_ERROR_CODES.JOB_MAX_RETRIES).toBe('JOB_MAX_RETRIES');
        expect(ACTION_ERROR_CODES.JOB_ORG_MISMATCH).toBe('JOB_ORG_MISMATCH');
        expect(ACTION_ERROR_CODES.PLAYBOOK_ADVANCE_FAILED).toBe('PLAYBOOK_ADVANCE_FAILED');
    });
});

describe('AsyncJobProcessor', () => {
    it('should export processDecisionExecution', async () => {
        vi.doMock('../../server/database', () => ({
            default: {
                run: vi.fn((sql, params, cb) => cb && cb(null)),
                get: vi.fn((sql, params, cb) => cb(null, null))
            }
        }));

        const AsyncJobProcessor = (await import('../../server/workers/asyncJobProcessor')).default;
        expect(typeof AsyncJobProcessor.processDecisionExecution).toBe('function');
    });

    it('should export processPlaybookAdvance', async () => {
        vi.doMock('../../server/database', () => ({
            default: {
                run: vi.fn((sql, params, cb) => cb && cb(null)),
                get: vi.fn((sql, params, cb) => cb(null, null))
            }
        }));

        const AsyncJobProcessor = (await import('../../server/workers/asyncJobProcessor')).default;
        expect(typeof AsyncJobProcessor.processPlaybookAdvance).toBe('function');
    });
});
