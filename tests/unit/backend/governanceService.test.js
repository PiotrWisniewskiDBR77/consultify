/**
 * Governance Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests Change Request creation, approval/rejection, and governance workflows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb, createMockUuid } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('GovernanceService', () => {
    let mockDb;
    let GovernanceService;
    let mockUuid;

    beforeEach(() => {
        mockDb = createMockDb();
        mockUuid = createMockUuid('cr');

        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.mock('uuid', () => ({
            v4: mockUuid
        }));

        GovernanceService = require('../../../server/services/governanceService.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createChangeRequest()', () => {
        it('should create a new Change Request with DRAFT status', async () => {
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Update API endpoint',
                description: 'Change API endpoint structure',
                type: 'TECHNICAL',
                riskAssessment: 'LOW',
                rationale: 'Improves performance',
                impactAnalysis: { affectedSystems: ['api'] },
                createdBy: testUsers.admin.id,
                aiAnalysis: 'AI recommends approval',
                aiRecommendedDecision: 'APPROVE'
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO change_requests');
                expect(params[0]).toBe('cr-1'); // UUID from mock
                expect(params[1]).toBe(crData.projectId);
                expect(params[5]).toBe('DRAFT'); // status
                callback.call({ changes: 1, lastID: 1 }, null);
            });

            const result = await GovernanceService.createChangeRequest(crData);

            expect(result.id).toBe('cr-1');
            expect(result.status).toBe('DRAFT');
            expect(result.projectId).toBe(crData.projectId);
            expect(result.title).toBe(crData.title);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should default riskAssessment to LOW if not provided', async () => {
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Test CR',
                description: 'Test',
                type: 'TECHNICAL',
                createdBy: testUsers.admin.id
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[6]).toBe('LOW'); // riskAssessment
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.createChangeRequest(crData);
        });

        it('should handle JSON stringification of impactAnalysis', async () => {
            const impactAnalysis = { systems: ['api', 'db'], risk: 'low' };
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Test CR',
                description: 'Test',
                type: 'TECHNICAL',
                impactAnalysis,
                createdBy: testUsers.admin.id
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                const impactParam = params[8]; // impact_analysis position
                expect(JSON.parse(impactParam)).toEqual(impactAnalysis);
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.createChangeRequest(crData);
        });

        it('should reject on database error', async () => {
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Test CR',
                description: 'Test',
                type: 'TECHNICAL',
                createdBy: testUsers.admin.id
            };

            const dbError = new Error('Database error');
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                GovernanceService.createChangeRequest(crData)
            ).rejects.toThrow('Database error');
        });
    });

    describe('decideChangeRequest()', () => {
        it('should approve a Change Request', async () => {
            const crId = 'cr-123';
            const userId = testUsers.admin.id;
            const status = 'APPROVED';
            const reason = 'Meets all requirements';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('UPDATE change_requests');
                expect(query).toContain('status = ?');
                expect(params[0]).toBe(status);
                expect(params[1]).toBe(userId); // approved_by
                expect(params[2]).toBe(reason);
                expect(params[3]).toBe(crId);
                callback.call({ changes: 1 }, null);
            });

            const result = await GovernanceService.decideChangeRequest(crId, status, userId, reason);

            expect(result.id).toBe(crId);
            expect(result.status).toBe(status);
            expect(result.userId).toBe(userId);
        });

        it('should reject a Change Request', async () => {
            const crId = 'cr-123';
            const userId = testUsers.admin.id;
            const status = 'REJECTED';
            const reason = 'Does not meet requirements';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[0]).toBe(status);
                expect(params[1]).toBe(null); // approved_by should be null for rejection
                expect(params[2]).toBe(reason);
                callback.call({ changes: 1 }, null);
            });

            const result = await GovernanceService.decideChangeRequest(crId, status, userId, reason);

            expect(result.status).toBe(status);
        });

        it('should set approved_by to null when rejecting', async () => {
            const crId = 'cr-123';
            const userId = testUsers.admin.id;
            const status = 'REJECTED';

            mockDb.run.mockImplementation((query, params, callback) => {
                // Only set approved_by if approved
                expect(params[1]).toBe(null);
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.decideChangeRequest(crId, status, userId);
        });

        it('should set approved_by when approving', async () => {
            const crId = 'cr-123';
            const userId = testUsers.admin.id;
            const status = 'APPROVED';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[1]).toBe(userId);
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.decideChangeRequest(crId, status, userId);
        });

        it('should handle database errors', async () => {
            const crId = 'cr-123';
            const dbError = new Error('Database error');

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                GovernanceService.decideChangeRequest(crId, 'APPROVED', testUsers.admin.id)
            ).rejects.toThrow('Database error');
        });

        it('should set approved_at timestamp', async () => {
            const crId = 'cr-123';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('approved_at = CURRENT_TIMESTAMP');
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.decideChangeRequest(crId, 'APPROVED', testUsers.admin.id);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should associate CR with specific project', async () => {
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Test CR',
                description: 'Test',
                type: 'TECHNICAL',
                createdBy: testUsers.admin.id
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[1]).toBe(testProjects.project1.id);
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.createChangeRequest(crData);
        });

        it('should track creator for audit purposes', async () => {
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Test CR',
                description: 'Test',
                type: 'TECHNICAL',
                createdBy: testUsers.admin.id
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[9]).toBe(testUsers.admin.id); // created_by position
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.createChangeRequest(crData);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty impactAnalysis', async () => {
            const crData = {
                projectId: testProjects.project1.id,
                title: 'Test CR',
                description: 'Test',
                type: 'TECHNICAL',
                createdBy: testUsers.admin.id,
                impactAnalysis: null
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                const impactParam = params[8];
                expect(JSON.parse(impactParam)).toEqual([]);
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.createChangeRequest(crData);
        });

        it('should handle optional reason in decideChangeRequest', async () => {
            const crId = 'cr-123';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[2]).toBe(undefined); // reason is optional
                callback.call({ changes: 1 }, null);
            });

            await GovernanceService.decideChangeRequest(crId, 'APPROVED', testUsers.admin.id);
        });
    });
});
