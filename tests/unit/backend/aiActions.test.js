// AI Action Executor and Audit Logger Tests
// Focus on structure and constants (database integration tests in separate suite)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        get: vi.fn((sql, params, callback) => callback(null, null)),
        run: vi.fn((sql, params, callback) => callback && callback.call({ changes: 1 }, null)),
        all: vi.fn((sql, params, callback) => callback(null, []))
    }
}));

describe('AIActionExecutor', () => {
    let AIActionExecutor;

    beforeEach(async () => {
        vi.clearAllMocks();
        AIActionExecutor = (await import('../../../server/services/aiActionExecutor.js')).default;
    });

    describe('ACTION_TYPES', () => {
        it('should have 7 action types', () => {
            expect(Object.keys(AIActionExecutor.ACTION_TYPES)).toHaveLength(7);
        });

        it('should define CREATE_DRAFT_TASK type', () => {
            expect(AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK).toBe('CREATE_DRAFT_TASK');
        });

        it('should define CREATE_DRAFT_INITIATIVE type', () => {
            expect(AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_INITIATIVE).toBe('CREATE_DRAFT_INITIATIVE');
        });

        it('should define SUGGEST_ROADMAP_CHANGE type', () => {
            expect(AIActionExecutor.ACTION_TYPES.SUGGEST_ROADMAP_CHANGE).toBe('SUGGEST_ROADMAP_CHANGE');
        });

        it('should define GENERATE_REPORT type', () => {
            expect(AIActionExecutor.ACTION_TYPES.GENERATE_REPORT).toBe('GENERATE_REPORT');
        });

        it('should define PREPARE_DECISION_SUMMARY type', () => {
            expect(AIActionExecutor.ACTION_TYPES.PREPARE_DECISION_SUMMARY).toBe('PREPARE_DECISION_SUMMARY');
        });

        it('should define EXPLAIN_CONTEXT type', () => {
            expect(AIActionExecutor.ACTION_TYPES.EXPLAIN_CONTEXT).toBe('EXPLAIN_CONTEXT');
        });

        it('should define ANALYZE_RISKS type', () => {
            expect(AIActionExecutor.ACTION_TYPES.ANALYZE_RISKS).toBe('ANALYZE_RISKS');
        });
    });

    describe('ACTION_STATUS', () => {
        it('should define PENDING status', () => {
            expect(AIActionExecutor.ACTION_STATUS.PENDING).toBe('PENDING');
        });

        it('should define APPROVED status', () => {
            expect(AIActionExecutor.ACTION_STATUS.APPROVED).toBe('APPROVED');
        });

        it('should define REJECTED status', () => {
            expect(AIActionExecutor.ACTION_STATUS.REJECTED).toBe('REJECTED');
        });

        it('should define EXECUTED status', () => {
            expect(AIActionExecutor.ACTION_STATUS.EXECUTED).toBe('EXECUTED');
        });
    });

    describe('Service Structure', () => {
        it('should export requestAction function', () => {
            expect(typeof AIActionExecutor.requestAction).toBe('function');
        });

        it('should export createDraft function', () => {
            expect(typeof AIActionExecutor.createDraft).toBe('function');
        });

        it('should export approveAction function', () => {
            expect(typeof AIActionExecutor.approveAction).toBe('function');
        });

        it('should export rejectAction function', () => {
            expect(typeof AIActionExecutor.rejectAction).toBe('function');
        });

        it('should export getPendingActions function', () => {
            expect(typeof AIActionExecutor.getPendingActions).toBe('function');
        });

        it('should export executeAction function', () => {
            expect(typeof AIActionExecutor.executeAction).toBe('function');
        });
    });
});

describe('AIAuditLogger', () => {
    let AIAuditLogger;

    beforeEach(async () => {
        vi.clearAllMocks();
        AIAuditLogger = (await import('../../../server/services/aiAuditLogger.js')).default;
    });

    describe('Service Structure', () => {
        it('should export logInteraction function', () => {
            expect(typeof AIAuditLogger.logInteraction).toBe('function');
        });

        it('should export logSuggestion function', () => {
            expect(typeof AIAuditLogger.logSuggestion).toBe('function');
        });

        it('should export recordUserDecision function', () => {
            expect(typeof AIAuditLogger.recordUserDecision).toBe('function');
        });

        it('should export getAuditLogs function', () => {
            expect(typeof AIAuditLogger.getAuditLogs).toBe('function');
        });

        it('should export getAuditStats function', () => {
            expect(typeof AIAuditLogger.getAuditStats).toBe('function');
        });

    });
});
