import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit Tests for WorkqueueService
 * Step 16: Tests approval assignment management
 */

describe('WorkqueueService Constants and Logic', () => {
    let WorkqueueService;

    beforeEach(async () => {
        vi.resetModules();

        // Mock database
        vi.doMock('../../server/database', () => ({
            default: {
                run: vi.fn((sql, params, cb) => {
                    if (typeof params === 'function') params(null);
                    else if (cb) cb.call({ changes: 1 }, null);
                }),
                get: vi.fn((sql, params, cb) => cb(null, null)),
                all: vi.fn((sql, params, cb) => cb(null, []))
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

        WorkqueueService = (await import('../../server/services/workqueueService')).default;
    });

    describe('ASSIGNMENT_STATUSES Constants', () => {
        it('should export PENDING status', () => {
            expect(WorkqueueService.ASSIGNMENT_STATUSES).toBeDefined();
            expect(WorkqueueService.ASSIGNMENT_STATUSES.PENDING).toBe('PENDING');
        });

        it('should export ACKED status', () => {
            expect(WorkqueueService.ASSIGNMENT_STATUSES.ACKED).toBe('ACKED');
        });

        it('should export DONE status', () => {
            expect(WorkqueueService.ASSIGNMENT_STATUSES.DONE).toBe('DONE');
        });

        it('should export EXPIRED status', () => {
            expect(WorkqueueService.ASSIGNMENT_STATUSES.EXPIRED).toBe('EXPIRED');
        });

        it('should have 4 status types', () => {
            expect(Object.keys(WorkqueueService.ASSIGNMENT_STATUSES)).toHaveLength(4);
        });
    });

    describe('DEFAULT_SLA_HOURS', () => {
        it('should default to 48 hours', () => {
            expect(WorkqueueService.DEFAULT_SLA_HOURS).toBe(48);
        });
    });

    describe('Service Methods Existence', () => {
        it('should export assignApproval', () => {
            expect(typeof WorkqueueService.assignApproval).toBe('function');
        });

        it('should export acknowledgeApproval', () => {
            expect(typeof WorkqueueService.acknowledgeApproval).toBe('function');
        });

        it('should export completeApproval', () => {
            expect(typeof WorkqueueService.completeApproval).toBe('function');
        });

        it('should export getMyApprovals', () => {
            expect(typeof WorkqueueService.getMyApprovals).toBe('function');
        });

        it('should export getOrgApprovals', () => {
            expect(typeof WorkqueueService.getOrgApprovals).toBe('function');
        });

        it('should export getOverdueCount', () => {
            expect(typeof WorkqueueService.getOverdueCount).toBe('function');
        });

        it('should export getAssignmentByProposal', () => {
            expect(typeof WorkqueueService.getAssignmentByProposal).toBe('function');
        });
    });
});
