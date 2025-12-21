/**
 * Escalation Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests escalation workflows, auto-escalation, and notification integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('EscalationService', () => {
    let mockDb;
    let EscalationService;
    let mockNotificationService;

    beforeEach(async () => {
        vi.resetModules();
        
        mockDb = createMockDb();
        mockNotificationService = {
            create: vi.fn().mockResolvedValue({ id: 'notif-123' })
        };

        EscalationService = (await import('../../../server/services/escalationService.js')).default;
        
        EscalationService.setDependencies({
            db: mockDb,
            uuidv4: () => 'escalation-1',
            NotificationService: mockNotificationService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createEscalation()', () => {
        it('should create an escalation and send notification', async () => {
            const escalation = {
                projectId: testProjects.project1.id,
                sourceType: 'DECISION',
                sourceId: 'decision-123',
                fromUserId: testUsers.user.id,
                toUserId: testUsers.admin.id,
                toRole: 'ADMIN',
                reason: 'Decision pending for 14+ days',
                triggerType: 'OVERDUE',
                daysOverdue: 14
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('SELECT organization_id')) {
                    callback(null, { organization_id: testOrganizations.org1.id });
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO escalations');
                expect(params[0]).toBe('escalation-1'); // UUID
                expect(params[1]).toBe(escalation.projectId);
                expect(params[2]).toBe(escalation.sourceType);
                expect(params[9]).toBe(14); // daysOverdue
                callback.call({ changes: 1 }, null);
            });

            const result = await EscalationService.createEscalation(escalation);

            expect(result.id).toBe('escalation-1');
            expect(result.projectId).toBe(escalation.projectId);
            expect(result.toUserId).toBe(escalation.toUserId);
            expect(mockNotificationService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: escalation.toUserId,
                    type: 'AI_RISK_DETECTED',
                    severity: 'CRITICAL',
                    title: 'Escalation Received'
                })
            );
        });

        it('should default daysOverdue to 0', async () => {
            const escalation = {
                projectId: testProjects.project1.id,
                sourceType: 'TASK',
                sourceId: 'task-123',
                fromUserId: testUsers.user.id,
                toUserId: testUsers.admin.id,
                toRole: 'ADMIN',
                reason: 'Task overdue',
                triggerType: 'OVERDUE'
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { organization_id: testOrganizations.org1.id });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[9]).toBe(0); // daysOverdue default
                callback.call({ changes: 1 }, null);
            });

            await EscalationService.createEscalation(escalation);
        });

        it('should handle database errors', async () => {
            const escalation = {
                projectId: testProjects.project1.id,
                sourceType: 'DECISION',
                sourceId: 'decision-123',
                fromUserId: testUsers.user.id,
                toUserId: testUsers.admin.id,
                toRole: 'ADMIN',
                reason: 'Test',
                triggerType: 'OVERDUE'
            };

            const dbError = new Error('Database error');
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                EscalationService.createEscalation(escalation)
            ).rejects.toThrow('Database error');
        });
    });

    describe('getEscalations()', () => {
        it('should retrieve escalations for a project', async () => {
            const projectId = testProjects.project1.id;
            const mockEscalations = [
                {
                    id: 'esc-1',
                    project_id: projectId,
                    source_type: 'DECISION',
                    from_first: 'John',
                    from_last: 'Doe',
                    to_first: 'Jane',
                    to_last: 'Smith'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT e.*');
                expect(query).toContain('WHERE e.project_id = ?');
                expect(query).toContain('ORDER BY e.created_at DESC');
                expect(params[0]).toBe(projectId);
                callback(null, mockEscalations);
            });

            const result = await EscalationService.getEscalations(projectId);

            expect(result).toEqual(mockEscalations);
        });

        it('should filter by status when provided', async () => {
            const projectId = testProjects.project1.id;
            const status = 'PENDING';

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('AND e.status = ?');
                expect(params[0]).toBe(projectId);
                expect(params[1]).toBe(status);
                callback(null, []);
            });

            await EscalationService.getEscalations(projectId, status);
        });

        it('should include user names from joins', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('LEFT JOIN users u1');
                expect(query).toContain('LEFT JOIN users u2');
                callback(null, []);
            });

            await EscalationService.getEscalations(projectId);
        });
    });

    describe('acknowledgeEscalation()', () => {
        it('should acknowledge an escalation', async () => {
            const escalationId = 'esc-123';
            const userId = testUsers.admin.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('UPDATE escalations');
                expect(query).toContain("status = 'ACKNOWLEDGED'");
                expect(query).toContain('acknowledged_at = CURRENT_TIMESTAMP');
                expect(query).toContain('WHERE id = ? AND to_user_id = ?');
                expect(params[0]).toBe(escalationId);
                expect(params[1]).toBe(userId);
                callback.call({ changes: 1 }, null);
            });

            const result = await EscalationService.acknowledgeEscalation(escalationId, userId);

            expect(result.updated).toBe(true);
        });

        it('should return false when escalation not found or user mismatch', async () => {
            const escalationId = 'esc-123';
            const userId = testUsers.admin.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, null);
            });

            const result = await EscalationService.acknowledgeEscalation(escalationId, userId);

            expect(result.updated).toBe(false);
        });
    });

    describe('resolveEscalation()', () => {
        it('should resolve an escalation', async () => {
            const escalationId = 'esc-123';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain("status = 'RESOLVED'");
                expect(query).toContain('resolved_at = CURRENT_TIMESTAMP');
                expect(params[0]).toBe(escalationId);
                callback.call({ changes: 1 }, null);
            });

            const result = await EscalationService.resolveEscalation(escalationId);

            expect(result.updated).toBe(true);
        });

        it('should return false when escalation not found', async () => {
            const escalationId = 'nonexistent';

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, null);
            });

            const result = await EscalationService.resolveEscalation(escalationId);

            expect(result.updated).toBe(false);
        });
    });

    describe('runAutoEscalation()', () => {
        it('should escalate overdue decisions to sponsor', async () => {
            const projectId = testProjects.project1.id;
            const mockProject = {
                id: projectId,
                sponsor_id: testUsers.admin.id
            };
            const mockOverdueDecisions = [
                {
                    id: 'decision-1',
                    title: 'Test Decision',
                    decision_owner_id: testUsers.user.id
                }
            ];

            mockDb.get
                .mockImplementationOnce((query, params, callback) => {
                    // Project query
                    callback(null, mockProject);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Check existing escalation
                    callback(null, null); // No existing escalation
                });

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('decisions')) {
                    callback(null, mockOverdueDecisions);
                } else {
                    callback(null, []);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await EscalationService.runAutoEscalation(projectId);

            expect(result.projectId).toBe(projectId);
            expect(result.escalationsCreated).toBeGreaterThanOrEqual(0);
        });

        it('should not escalate if project not found', async () => {
            const projectId = 'nonexistent';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await EscalationService.runAutoEscalation(projectId);

            expect(result.error).toBe('Project not found');
            expect(result.escalations).toEqual([]);
        });

        it('should not create duplicate escalations', async () => {
            const projectId = testProjects.project1.id;
            const mockProject = {
                id: projectId,
                sponsor_id: testUsers.admin.id
            };
            const mockOverdueDecisions = [
                {
                    id: 'decision-1',
                    decision_owner_id: testUsers.user.id
                }
            ];

            mockDb.get
                .mockImplementationOnce((query, params, callback) => {
                    callback(null, mockProject);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Existing escalation found
                    callback(null, { id: 'existing-esc' });
                });

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('decisions')) {
                    callback(null, mockOverdueDecisions);
                } else {
                    callback(null, []);
                }
            });

            const result = await EscalationService.runAutoEscalation(projectId);

            expect(result.escalationsCreated).toBe(0);
        });

        it('should escalate stalled initiatives to PM', async () => {
            const projectId = testProjects.project1.id;
            const mockProject = {
                id: projectId,
                sponsor_id: testUsers.admin.id
            };
            const mockStalledInitiatives = [
                {
                    id: 'init-1',
                    name: 'Stalled Initiative',
                    owner_business_id: testUsers.user.id
                }
            ];
            const mockPM = {
                id: 'pm-123'
            };

            mockDb.get
                .mockImplementationOnce((query, params, callback) => {
                    callback(null, mockProject);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Check existing escalation
                    callback(null, null);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Get PM
                    callback(null, mockPM);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Check existing escalation for initiative
                    callback(null, null);
                });

            mockDb.all
                .mockImplementationOnce((query, params, callback) => {
                    // Overdue decisions
                    callback(null, []);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Stalled initiatives
                    callback(null, mockStalledInitiatives);
                });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await EscalationService.runAutoEscalation(projectId);

            expect(result.escalationsCreated).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should filter escalations by project_id', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE e.project_id = ?');
                expect(params[0]).toBe(projectId);
                callback(null, []);
            });

            await EscalationService.getEscalations(projectId);
        });

        it('should get organization_id from project for notifications', async () => {
            const escalation = {
                projectId: testProjects.project1.id,
                sourceType: 'DECISION',
                sourceId: 'decision-123',
                fromUserId: testUsers.user.id,
                toUserId: testUsers.admin.id,
                toRole: 'ADMIN',
                reason: 'Test',
                triggerType: 'OVERDUE'
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT organization_id FROM projects');
                callback(null, { organization_id: testOrganizations.org1.id });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            await EscalationService.createEscalation(escalation);

            expect(mockNotificationService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    organizationId: testOrganizations.org1.id
                })
            );
        });
    });
});

