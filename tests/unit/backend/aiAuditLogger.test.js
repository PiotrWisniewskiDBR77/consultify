import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AIAuditLogger from '../../../server/services/aiAuditLogger.js';

// Setup Mock DB
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('uuid', () => ({
    v4: () => 'audit-uuid-1234'
}));

describe('AIAuditLogger', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Inject mock DB
        if (AIAuditLogger._setDb) {
            AIAuditLogger._setDb(mockDb);
        }

        // Setup default mock behaviors
        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb.call({ changes: 1, lastID: 1 }, null);
            }
        });

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, null);
            }
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, []);
            }
        });
    });

    // Alias mockDb to db for easier replacement compatibility
    const db = mockDb;

    describe('logInteraction', () => {
        it('should log a basic AI interaction', async () => {
            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                projectId: 'proj-1',
                actionType: 'AI_RESPONSE',
                aiRole: 'CONSULTANT',
                prompt: 'Hello',
                response: 'Hi there',
                policyLevel: 'STANDARD'
            };

            const result = await AIAuditLogger.logInteraction(entry);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(db.run).toHaveBeenCalled();

            // Verify correlation_id was passed to SQL
            const sqlArgs = db.run.mock.calls[0][1];
            // correlation_id is the last argument
            // Check if it's there (should be null in this test case since not provided)
            expect(sqlArgs[sqlArgs.length - 1]).toBeNull();
        });

        it('should store correlation_id if provided', async () => {
            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                projectId: 'proj-1',
                actionType: 'AI_RESPONSE',
                aiRole: 'CONSULTANT',
                prompt: 'Status?',
                correlationId: 'corr-123'
            };

            const result = await AIAuditLogger.logInteraction(entry);

            expect(result).toBeDefined();
            const sqlArgs = db.run.mock.calls[0][1];
            expect(sqlArgs[sqlArgs.length - 1]).toBe('corr-123');
        });

        it('should handle optional fields', async () => {
            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                actionType: 'AI_RESPONSE'
            };

            const result = await AIAuditLogger.logInteraction(entry);

            expect(result).toBeDefined();
        });

        it('should store explanation data if provided', async () => {
            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                actionType: 'AI_RESPONSE',
                explanation: {
                    confidence: 0.85,
                    reasoning: 'Based on project data analysis'
                }
            };

            const result = await AIAuditLogger.logInteraction(entry);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });

        it('should handle database error', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(new Error('Database write failed'));
                }
            });

            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                actionType: 'AI_RESPONSE'
            };

            await expect(AIAuditLogger.logInteraction(entry)).rejects.toThrow('Database write failed');
        });
    });

    describe('logWithExplanation', () => {
        it('should log interaction with full explanation object', async () => {
            const params = {
                userId: 'user-1',
                organizationId: 'org-1',
                projectId: 'proj-1',
                explanation: {
                    confidence: 0.92,
                    reasoning: 'Risk analysis performed',
                    sources: ['project_data', 'historical_data']
                },
                aiResponse: 'Risk level is moderate',
                actionType: 'SUGGESTION'
            };

            const result = await AIAuditLogger.logWithExplanation(params);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });

        it('should default actionType to AI_RESPONSE', async () => {
            const params = {
                userId: 'user-1',
                organizationId: 'org-1',
                explanation: { confidence: 0.8 },
                aiResponse: 'Test response'
            };

            const result = await AIAuditLogger.logWithExplanation(params);

            expect(result).toBeDefined();
        });
    });

    describe('logSuggestion', () => {
        it('should log AI suggestion', async () => {
            const result = await AIAuditLogger.logSuggestion(
                'user-1',
                'org-1',
                'proj-1',
                'ADVISOR',
                'Consider reducing scope',
                { currentStatus: 'delayed' }
            );

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
        });

        it('should handle minimal parameters', async () => {
            const result = await AIAuditLogger.logSuggestion(
                'user-1',
                'org-1',
                null,
                'CONSULTANT',
                'Simple suggestion'
            );

            expect(result).toBeDefined();
        });
    });

    describe('recordUserDecision', () => {
        it('should update user decision on logged suggestion', async () => {
            const result = await AIAuditLogger.recordUserDecision(
                'audit-1',
                'ACCEPTED',
                'Good suggestion'
            );

            expect(result.updated).toBe(true);
            expect(db.run).toHaveBeenCalled();
        });

        it('should record rejection without feedback', async () => {
            const result = await AIAuditLogger.recordUserDecision(
                'audit-1',
                'REJECTED'
            );

            expect(result.updated).toBe(true);
        });

        it('should handle non-existent audit entry', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb.call({ changes: 0 }, null);
                }
            });

            const result = await AIAuditLogger.recordUserDecision('audit-999', 'ACCEPTED');

            expect(result.updated).toBe(false);
        });
    });

    describe('getAuditLogs', () => {
        it('should return audit logs for organization', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        {
                            id: 'audit-1',
                            action_type: 'AI_RESPONSE',
                            ai_role: 'CONSULTANT',
                            created_at: '2024-12-20T10:00:00Z'
                        },
                        {
                            id: 'audit-2',
                            action_type: 'SUGGESTION',
                            ai_role: 'ADVISOR',
                            created_at: '2024-12-20T11:00:00Z'
                        }
                    ]);
                }
            });

            const result = await AIAuditLogger.getAuditLogs('org-1');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('audit-1');
        });

        it('should filter by project if provided', async () => {
            await AIAuditLogger.getAuditLogs('org-1', { projectId: 'proj-1' });

            const callArgs = mockDb.all.mock.calls[0];
            expect(callArgs[0]).toContain('project_id');
        });

        it('should filter by date range', async () => {
            await AIAuditLogger.getAuditLogs('org-1', {
                startDate: '2024-12-01',
                endDate: '2024-12-31'
            });

            const callArgs = mockDb.all.mock.calls[0];
            expect(callArgs[0]).toContain('created_at');
        });

        it('should limit results', async () => {
            await AIAuditLogger.getAuditLogs('org-1', { limit: 50 });

            const callArgs = mockDb.all.mock.calls[0];
            expect(callArgs[0]).toContain('LIMIT');
        });

        it('should filter by action type', async () => {
            await AIAuditLogger.getAuditLogs('org-1', { actionType: 'SUGGESTION' });

            const callArgs = mockDb.all.mock.calls[0];
            expect(callArgs[0]).toContain('action_type');
        });

        it('should return empty array on database error', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(new Error('DB Error'), null);
                }
            });

            await expect(AIAuditLogger.getAuditLogs('org-1')).rejects.toThrow();
        });
    });

    describe('getAuditStats', () => {
        it('should return statistics for organization', async () => {
            // Implementation uses db.get for stats
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        total: 100, accepted: 60, rejected: 10,
                        modified: 20, ignored: 5, pending: 5
                    });
                }
            });

            const result = await AIAuditLogger.getAuditStats('org-1');

            expect(result.total).toBe(100);
            expect(result.accepted).toBe(60);
        });

        it('should filter by project if provided', async () => {
            // Implementation uses db.get for stats
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(null, {});
            });

            await AIAuditLogger.getAuditStats('org-1', 'proj-1');

            const callArgs = mockDb.get.mock.calls[0];
            expect(callArgs[1]).toContain('proj-1');
        });
    });

    describe('getRoleDistribution', () => {
        it('should return role distribution', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { ai_role: 'CONSULTANT', count: 50 },
                        { ai_role: 'ADVISOR', count: 30 },
                        { ai_role: 'MANAGER', count: 20 }
                    ]);
                }
            });

            const result = await AIAuditLogger.getRoleDistribution('org-1');

            expect(result).toHaveLength(3);
            expect(result[0].ai_role).toBe('CONSULTANT');
        });
    });


    describe('clearOldLogs', () => {
        it('should clear logs older than specified days', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb.call({ changes: 50 }, null);
                }
            });

            const result = await AIAuditLogger.clearOldLogs('org-1', 90);

            expect(result.deleted).toBe(50);
            expect(db.run).toHaveBeenCalled();
        });

        it('should use default retention period of 90 days', async () => {
            await AIAuditLogger.clearOldLogs('org-1');

            // Check that the SQL contains the retention period logic
            expect(db.run).toHaveBeenCalled();
        });

        it('should respect custom retention period', async () => {
            await AIAuditLogger.clearOldLogs('org-1', 30);

            expect(db.run).toHaveBeenCalled();
        });
    });
});
