import { describe, it, expect, vi, beforeEach } from 'vitest';
import AIAuditLogger from '../../../server/src/services/aiAuditLogger.js';

describe('AIAuditLogger', () => {
    const mockDb = {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock behaviors (Promises)
        mockDb.run.mockResolvedValue({ success: true, changes: 1, lastID: 1 });
        mockDb.get.mockResolvedValue(null);
        mockDb.all.mockResolvedValue([]);

        AIAuditLogger._setDependencies({
            db: mockDb
        });
    });

    describe('logInteraction', () => {
        it('should log a basic AI interaction', async () => {
            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                projectId: 'proj-1',
                actionType: 'AI_RESPONSE',
                aiRole: 'CONSULTANT'
            };

            const result = await AIAuditLogger.logInteraction(entry);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should store correlation_id if provided', async () => {
            const entry = {
                userId: 'user-1',
                organizationId: 'org-1',
                projectId: 'proj-1',
                actionType: 'AI_RESPONSE',
                correlationId: 'corr-123'
            };

            const result = await AIAuditLogger.logInteraction(entry);

            expect(result).toBeDefined();
            const sqlArgs = mockDb.run.mock.calls[0][1];
            // Last argument in params array is correlationId
            expect(sqlArgs[sqlArgs.length - 1]).toBe('corr-123');
        });

        it('should handle database error', async () => {
            // Mock run to return "success: false" or throw error depending on how DbPromise.run works
            // Based on service code: if (!result.success) throw new Error...
            // But checking aiAuditLogger.ts, it calls run() and checks result.success.
            // Wait, DbPromise.ts usually returns { success: true/false, error?: string } or throws.
            // Let's assume DbPromise.run returns generic object.
            // Actually, looking at aiAuditLogger.ts:127: if (!result.success) ...
            // So we need to mock it to return { success: false, error: '...' }

            mockDb.run.mockResolvedValue({ success: false, error: 'Database write failed' });

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
                    confidenceLevel: 'HIGH',
                    reasoningSummary: 'Test reasoning',
                    dataUsed: { externalSources: ['source1'] },
                    aiRole: 'ADVISOR',
                    regulatoryMode: false,
                    constraintsApplied: ['constraint1']
                },
                aiResponse: 'Success',
                actionType: 'AI_RESPONSE'
            };

            const result = await AIAuditLogger.logWithExplanation(params);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
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
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('getAuditLogs', () => {
        it('should return audit logs for organization', async () => {
            mockDb.all.mockResolvedValue([
                {
                    id: 'audit-1',
                    action_type: 'AI_RESPONSE',
                    ai_role: 'ADVISOR',
                    created_at: '2024-12-20T10:00:00Z',
                    data_sources_used: '["source1"]'
                }
            ]);

            const result = await AIAuditLogger.getAuditLogs('org-1');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('audit-1');
            expect(result[0].dataSourcesUsed[0]).toBe('source1');
        });
    });

    describe('getAuditStats', () => {
        it('should return statistics for organization', async () => {
            mockDb.get.mockResolvedValue({
                total: 100, accepted: 60, rejected: 10,
                modified: 20, ignored: 5, pending: 5
            });

            const result = await AIAuditLogger.getAuditStats('org-1');

            expect(result.total).toBe(100);
            expect(result.acceptanceRate).toBe(60);
        });
    });
});
