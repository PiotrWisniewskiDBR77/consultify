/**
 * Unit Tests: Assessment Audit Logger
 * Complete test coverage for audit logging functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

vi.mock('../../../server/database', () => ({ default: mockDb }));
vi.mock('uuid', () => ({ v4: () => 'mock-audit-uuid' }));

describe('AssessmentAuditLogger', () => {
    let AssessmentAuditLogger;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Import fresh module
        const module = await import('../../../server/utils/assessmentAuditLogger.js');
        AssessmentAuditLogger = module.default || module.AssessmentAuditLogger || module;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // log() TESTS
    // =========================================================================

    describe('log', () => {
        it('should log audit event with all required fields', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const auditData = {
                userId: 'user-123',
                organizationId: 'org-456',
                action: 'ASSESSMENT_APPROVED',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789',
                details: { notes: 'Approved by manager' },
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0'
            };

            await AssessmentAuditLogger.log(auditData);

            expect(mockDb.run).toHaveBeenCalled();
            const [sql, params] = mockDb.run.mock.calls[0];

            expect(sql).toContain('INSERT INTO');
            expect(params).toContain('user-123');
            expect(params).toContain('org-456');
            expect(params).toContain('ASSESSMENT_APPROVED');
            expect(params).toContain('ASSESSMENT');
            expect(params).toContain('assessment-789');
        });

        it('should handle missing optional fields', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const auditData = {
                userId: 'user-123',
                action: 'ASSESSMENT_CREATED',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789'
            };

            await AssessmentAuditLogger.log(auditData);

            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should stringify details object', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const details = { axis: 'processes', oldScore: 3, newScore: 4 };

            await AssessmentAuditLogger.log({
                userId: 'user-123',
                action: 'AXIS_UPDATED',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789',
                details
            });

            const params = mockDb.run.mock.calls[0][1];
            const detailsParam = params.find(p => typeof p === 'string' && p.includes('axis'));

            expect(JSON.parse(detailsParam)).toMatchObject(details);
        });

        it('should reject on database error', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'));
            });

            await expect(
                AssessmentAuditLogger.log({
                    userId: 'user-123',
                    action: 'TEST_ACTION',
                    resourceType: 'ASSESSMENT',
                    resourceId: 'assessment-789'
                })
            ).rejects.toThrow('Database error');
        });

        it('should include timestamp in log', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            await AssessmentAuditLogger.log({
                userId: 'user-123',
                action: 'TEST_ACTION',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789'
            });

            const sql = mockDb.run.mock.calls[0][0];
            expect(sql).toContain('datetime');
        });
    });

    // =========================================================================
    // Action Types Coverage
    // =========================================================================

    describe('Action Types', () => {
        const actionTypes = [
            'WORKFLOW_INITIALIZED',
            'SUBMITTED_FOR_REVIEW',
            'REVIEW_SUBMITTED',
            'ASSESSMENT_APPROVED',
            'ASSESSMENT_REJECTED',
            'VERSION_RESTORED',
            'PDF_EXPORTED',
            'EXCEL_EXPORTED',
            'COMMENT_ADDED',
            'AXIS_UPDATED',
            'SCORE_CHANGED'
        ];

        actionTypes.forEach(action => {
            it(`should log ${action} action`, async () => {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback.call({ lastID: 1 }, null);
                });

                await AssessmentAuditLogger.log({
                    userId: 'user-123',
                    organizationId: 'org-456',
                    action,
                    resourceType: 'ASSESSMENT',
                    resourceId: 'assessment-789'
                });

                const params = mockDb.run.mock.calls[0][1];
                expect(params).toContain(action);
            });
        });
    });

    // =========================================================================
    // Resource Types Coverage
    // =========================================================================

    describe('Resource Types', () => {
        const resourceTypes = [
            'ASSESSMENT',
            'ASSESSMENT_WORKFLOW',
            'ASSESSMENT_REVIEW',
            'ASSESSMENT_VERSION',
            'ASSESSMENT_REPORT',
            'ASSESSMENT_COMMENT'
        ];

        resourceTypes.forEach(resourceType => {
            it(`should log ${resourceType} resource type`, async () => {
                mockDb.run.mockImplementation((sql, params, callback) => {
                    callback.call({ lastID: 1 }, null);
                });

                await AssessmentAuditLogger.log({
                    userId: 'user-123',
                    action: 'TEST_ACTION',
                    resourceType,
                    resourceId: 'resource-789'
                });

                const params = mockDb.run.mock.calls[0][1];
                expect(params).toContain(resourceType);
            });
        });
    });

    // =========================================================================
    // getAuditLog() TESTS
    // =========================================================================

    describe('getAuditLog', () => {
        it('should retrieve audit logs for assessment', async () => {
            const mockLogs = [
                { id: 'log-1', action: 'ASSESSMENT_CREATED', timestamp: '2024-01-01' },
                { id: 'log-2', action: 'ASSESSMENT_APPROVED', timestamp: '2024-01-02' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockLogs);
            });

            const result = await AssessmentAuditLogger.getAuditLog('assessment-123');

            expect(result).toHaveLength(2);
            expect(result[0].action).toBe('ASSESSMENT_CREATED');
        });

        it('should filter by date range', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('timestamp');
                callback(null, []);
            });

            await AssessmentAuditLogger.getAuditLog('assessment-123', {
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            });

            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should filter by action type', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            await AssessmentAuditLogger.getAuditLog('assessment-123', {
                action: 'ASSESSMENT_APPROVED'
            });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('action'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should filter by user', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            await AssessmentAuditLogger.getAuditLog('assessment-123', {
                userId: 'user-456'
            });

            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should return empty array for no logs', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            const result = await AssessmentAuditLogger.getAuditLog('assessment-123');

            expect(result).toEqual([]);
        });

        it('should handle database error', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Query failed'));
            });

            await expect(
                AssessmentAuditLogger.getAuditLog('assessment-123')
            ).rejects.toThrow('Query failed');
        });
    });

    // =========================================================================
    // getAuditLogByOrganization() TESTS
    // =========================================================================

    describe('getAuditLogByOrganization', () => {
        it('should retrieve audit logs for organization', async () => {
            const mockLogs = [
                { id: 'log-1', resource_id: 'assessment-1' },
                { id: 'log-2', resource_id: 'assessment-2' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(params).toContain('org-123');
                callback(null, mockLogs);
            });

            const result = await AssessmentAuditLogger.getAuditLogByOrganization('org-123');

            expect(result).toHaveLength(2);
        });

        it('should support pagination', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('LIMIT');
                expect(sql).toContain('OFFSET');
                callback(null, []);
            });

            await AssessmentAuditLogger.getAuditLogByOrganization('org-123', {
                limit: 10,
                offset: 20
            });

            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // exportAuditLog() TESTS
    // =========================================================================

    describe('exportAuditLog', () => {
        it('should export audit log as JSON', async () => {
            const mockLogs = [
                { id: 'log-1', action: 'TEST', timestamp: '2024-01-01' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockLogs);
            });

            const result = await AssessmentAuditLogger.exportAuditLog('assessment-123', 'json');

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(JSON.parse(result)).toHaveLength(1);
        });

        it('should export audit log as CSV', async () => {
            const mockLogs = [
                { id: 'log-1', action: 'TEST', timestamp: '2024-01-01', user_id: 'user-1' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockLogs);
            });

            const result = await AssessmentAuditLogger.exportAuditLog('assessment-123', 'csv');

            expect(result).toBeDefined();
            expect(result).toContain('action');
            expect(result).toContain('TEST');
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge Cases', () => {
        it('should handle null details', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            await AssessmentAuditLogger.log({
                userId: 'user-123',
                action: 'TEST_ACTION',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789',
                details: null
            });

            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should handle empty string values', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            await AssessmentAuditLogger.log({
                userId: 'user-123',
                action: 'TEST_ACTION',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789',
                ipAddress: '',
                userAgent: ''
            });

            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should handle special characters in details', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const details = {
                message: "User's \"comment\" with special <characters> & symbols"
            };

            await AssessmentAuditLogger.log({
                userId: 'user-123',
                action: 'COMMENT_ADDED',
                resourceType: 'ASSESSMENT_COMMENT',
                resourceId: 'comment-789',
                details
            });

            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should handle very long details', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const details = {
                longText: 'A'.repeat(10000)
            };

            await AssessmentAuditLogger.log({
                userId: 'user-123',
                action: 'TEST_ACTION',
                resourceType: 'ASSESSMENT',
                resourceId: 'assessment-789',
                details
            });

            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Concurrency Tests
    // =========================================================================

    describe('Concurrency', () => {
        it('should handle multiple simultaneous log writes', async () => {
            let writeCount = 0;

            mockDb.run.mockImplementation((sql, params, callback) => {
                writeCount++;
                setTimeout(() => {
                    callback.call({ lastID: writeCount }, null);
                }, Math.random() * 10);
            });

            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    AssessmentAuditLogger.log({
                        userId: `user-${i}`,
                        action: 'CONCURRENT_TEST',
                        resourceType: 'ASSESSMENT',
                        resourceId: `assessment-${i}`
                    })
                );
            }

            await Promise.all(promises);

            expect(writeCount).toBe(10);
        });
    });
});

