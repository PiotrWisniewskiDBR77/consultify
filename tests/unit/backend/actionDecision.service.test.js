import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => {
    const mockDb = {
        run: vi.fn((sql, params, callback) => {
            if (typeof params === 'function') {
                params(null);
            } else if (callback) {
                callback(null);
            }
        }),
        all: vi.fn((sql, params, callback) => {
            if (sql.includes('WHERE proposal_id = ?')) {
                callback(null, [
                    { id: 'ad-1', proposal_id: 'ap-001', decision: 'APPROVED', decided_by_user_id: 'u-1', created_at: '2025-12-20T10:00:00Z' }
                ]);
            } else {
                callback(null, [
                    { id: 'ad-1', proposal_id: 'ap-001', decision: 'APPROVED', decided_by_user_id: 'u-1', first_name: 'Admin', last_name: 'User' }
                ]);
            }
        }),
        get: vi.fn((sql, params, callback) => callback(null, null))
    };
    return {
        ...mockDb,
        default: mockDb
    };
});

describe('ActionDecisionService', () => {
    let ActionDecisionService;

    beforeEach(async () => {
        vi.clearAllMocks();
        ActionDecisionService = (await import('../../../server/ai/actionDecisionService')).default;
    });

    describe('recordDecision', () => {
        it('should record an APPROVED decision', async () => {
            const decision = await ActionDecisionService.recordDecision({
                proposal_id: 'ap-001',
                decision: 'APPROVED',
                decided_by_user_id: 'u-1',
                reason: 'Looks good'
            });

            expect(decision).toBeDefined();
            expect(decision.decision).toBe('APPROVED');
            expect(decision.proposal_id).toBe('ap-001');
        });

        it('should record a MODIFIED decision with payload', async () => {
            const modifiedPayload = { test: 123 };
            const decision = await ActionDecisionService.recordDecision({
                proposal_id: 'ap-002',
                decision: 'MODIFIED',
                decided_by_user_id: 'u-1',
                reason: 'Adjusted units',
                modified_payload: modifiedPayload
            });

            expect(decision.decision).toBe('MODIFIED');
            expect(decision.modified_payload).toEqual(modifiedPayload);
        });

        it('should throw error for invalid decision type', async () => {
            await expect(ActionDecisionService.recordDecision({
                proposal_id: 'ap-001',
                decision: 'INVALID_TYPE',
                decided_by_user_id: 'u-1'
            })).rejects.toThrow('Invalid decision: INVALID_TYPE');
        });

        it('should throw error for missing proposal_id', async () => {
            await expect(ActionDecisionService.recordDecision({
                decision: 'APPROVED',
                decided_by_user_id: 'u-1'
            })).rejects.toThrow('Missing required decision fields');
        });
    });

    describe('getDecisionsByProposal', () => {
        it('should return decisions for a proposal', async () => {
            const decisions = await ActionDecisionService.getDecisionsByProposal('ap-001');
            expect(decisions).toHaveLength(1);
            expect(decisions[0].proposal_id).toBe('ap-001');
        });
    });

    describe('getAuditLog', () => {
        it('should return the full audit log', async () => {
            const log = await ActionDecisionService.getAuditLog();
            expect(log).toHaveLength(1);
            expect(log[0].first_name).toBe('Admin');
        });
    });
});
