/**
 * Execution Monitor Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests execution monitoring, issue detection, and notification generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('ExecutionMonitorService', () => {
    let mockDb;
    let ExecutionMonitorService;
    let mockNotificationService;

    beforeEach(async () => {
        vi.resetModules();
        
        mockDb = createMockDb();
        mockNotificationService = {
            create: vi.fn().mockResolvedValue({ id: 'notif-123' })
        };

        ExecutionMonitorService = (await import('../../../server/services/executionMonitorService.js')).default;
        
        ExecutionMonitorService.setDependencies({
            db: mockDb,
            NotificationService: mockNotificationService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('runDailyMonitor()', () => {
        it('should detect stalled tasks', async () => {
            const projectId = testProjects.project1.id;
            const mockStalledTasks = [
                {
                    id: 'task-1',
                    title: 'Stalled Task',
                    status: 'in_progress',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('tasks') && query.includes('updated_at < datetime')) {
                    callback(null, mockStalledTasks);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.projectId).toBe(projectId);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('STALLED_TASKS');
            expect(result.issues[0].severity).toBe('WARNING');
            expect(result.issues[0].count).toBe(1);
        });

        it('should detect overdue tasks and generate notifications', async () => {
            const projectId = testProjects.project1.id;
            const mockOverdueTasks = [
                {
                    id: 'task-1',
                    title: 'Overdue Task',
                    assignee_id: testUsers.user.id,
                    due_date: '2024-01-01'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('due_date < date')) {
                    callback(null, mockOverdueTasks);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('OVERDUE_TASKS');
            expect(result.notificationsGenerated).toBe(1);
            expect(result.notifications[0].userId).toBe(testUsers.user.id);
            expect(result.notifications[0].type).toBe('TASK_OVERDUE');
        });

        it('should detect overdue decisions', async () => {
            const projectId = testProjects.project1.id;
            const mockOverdueDecisions = [
                {
                    id: 'decision-1',
                    title: 'Overdue Decision',
                    decision_owner_id: testUsers.admin.id,
                    status: 'PENDING',
                    created_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('decisions') && query.includes('status = \'PENDING\'')) {
                    callback(null, mockOverdueDecisions);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('DECISION_INERTIA');
            expect(result.issues[0].severity).toBe('CRITICAL');
            expect(result.notifications[0].type).toBe('DECISION_OVERDUE');
        });

        it('should detect stalled initiatives', async () => {
            const projectId = testProjects.project1.id;
            const mockStalledInitiatives = [
                {
                    id: 'init-1',
                    name: 'Stalled Initiative',
                    status: 'IN_EXECUTION',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('initiatives') && query.includes('updated_at < datetime')) {
                    callback(null, mockStalledInitiatives);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('STALLED_INITIATIVES');
        });

        it('should detect silent blockers', async () => {
            const projectId = testProjects.project1.id;
            const mockSilentBlockers = [
                {
                    id: 'task-1',
                    title: 'Blocked Task',
                    type: 'TASK'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('UNION ALL')) {
                    callback(null, mockSilentBlockers);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('SILENT_BLOCKERS');
        });

        it('should return healthy status when no issues detected', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.issueCount).toBe(0);
            expect(result.issues).toEqual([]);
            expect(result.notificationsGenerated).toBe(0);
        });

        it('should include monitoredAt timestamp', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.monitoredAt).toBeDefined();
            expect(new Date(result.monitoredAt).getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('_detectStalledTasks()', () => {
        it('should detect tasks not updated in 7+ days', async () => {
            const projectId = testProjects.project1.id;
            const mockTasks = [
                {
                    id: 'task-1',
                    title: 'Stalled Task',
                    status: 'in_progress'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE t.project_id = ?');
                expect(query).toContain("status IN ('in_progress', 'IN_PROGRESS')");
                expect(query).toContain("updated_at < datetime('now', '-7 days')");
                expect(params[0]).toBe(projectId);
                callback(null, mockTasks);
            });

            const result = await ExecutionMonitorService._detectStalledTasks(projectId);

            expect(result).toEqual(mockTasks);
        });
    });

    describe('_detectOverdueTasks()', () => {
        it('should detect tasks with due_date in the past', async () => {
            const projectId = testProjects.project1.id;
            const mockTasks = [
                {
                    id: 'task-1',
                    title: 'Overdue Task',
                    due_date: '2024-01-01'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain("status NOT IN ('done', 'DONE')");
                expect(query).toContain("due_date < date('now')");
                callback(null, mockTasks);
            });

            const result = await ExecutionMonitorService._detectOverdueTasks(projectId);

            expect(result).toEqual(mockTasks);
        });
    });

    describe('_detectOverdueDecisions()', () => {
        it('should detect decisions pending for 7+ days', async () => {
            const projectId = testProjects.project1.id;
            const mockDecisions = [
                {
                    id: 'decision-1',
                    title: 'Overdue Decision',
                    status: 'PENDING'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain("status = 'PENDING'");
                expect(query).toContain("created_at < datetime('now', '-7 days')");
                callback(null, mockDecisions);
            });

            const result = await ExecutionMonitorService._detectOverdueDecisions(projectId);

            expect(result).toEqual(mockDecisions);
        });
    });

    describe('_detectStalledInitiatives()', () => {
        it('should detect initiatives not updated in 7+ days', async () => {
            const projectId = testProjects.project1.id;
            const mockInitiatives = [
                {
                    id: 'init-1',
                    name: 'Stalled Initiative',
                    status: 'IN_EXECUTION'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain("status IN ('IN_EXECUTION', 'APPROVED')");
                expect(query).toContain("updated_at < datetime('now', '-7 days')");
                callback(null, mockInitiatives);
            });

            const result = await ExecutionMonitorService._detectStalledInitiatives(projectId);

            expect(result).toEqual(mockInitiatives);
        });
    });

    describe('_detectSilentBlockers()', () => {
        it('should detect blocked items without reason', async () => {
            const projectId = testProjects.project1.id;
            const mockBlockers = [
                {
                    id: 'task-1',
                    title: 'Blocked Task',
                    type: 'TASK'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('UNION ALL');
                expect(query).toContain("status IN ('blocked', 'BLOCKED')");
                expect(query).toContain("blocked_reason IS NULL OR t.blocked_reason = ''");
                callback(null, mockBlockers);
            });

            const result = await ExecutionMonitorService._detectSilentBlockers(projectId);

            expect(result).toEqual(mockBlockers);
        });
    });

    describe('generateExecutionSummary()', () => {
        it('should generate summary when no issues', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await ExecutionMonitorService.generateExecutionSummary(projectId);

            expect(result.projectId).toBe(projectId);
            expect(result.summaryText).toContain('✅ Execution is healthy');
            expect(result.issues).toEqual([]);
        });

        it('should generate summary with issues', async () => {
            const projectId = testProjects.project1.id;
            const mockStalledTasks = [
                { id: 'task-1', title: 'Stalled Task' }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('tasks') && query.includes('updated_at < datetime')) {
                    callback(null, mockStalledTasks);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.generateExecutionSummary(projectId);

            expect(result.summaryText).toContain('⚠️');
            // Summary text uses human-readable text, not type constants
            expect(result.summaryText).toContain('task(s) have not been updated');
            expect(result.issues).toHaveLength(1);
        });

        it('should include all issue types in summary', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('due_date < date')) {
                    callback(null, [{ id: 'task-1', assignee_id: testUsers.user.id }]);
                } else if (query.includes('decisions') && query.includes('PENDING')) {
                    callback(null, [{ id: 'decision-1', decision_owner_id: testUsers.admin.id }]);
                } else if (query.includes('initiatives') && query.includes('updated_at')) {
                    callback(null, [{ id: 'init-1' }]);
                } else if (query.includes('UNION ALL')) {
                    callback(null, [{ id: 'blocker-1' }]);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.generateExecutionSummary(projectId);

            // Summary text uses human-readable text
            expect(result.summaryText).toContain('task(s) are overdue');
            expect(result.summaryText).toContain('decision(s) have been pending');
            expect(result.summaryText).toContain('initiative(s) are stalled');
            expect(result.summaryText).toContain('blocked without explanation');
        });

        it('should include generatedAt timestamp', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await ExecutionMonitorService.generateExecutionSummary(projectId);

            expect(result.generatedAt).toBeDefined();
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should filter all queries by project_id', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE');
                expect(query).toContain('project_id = ?');
                expect(params[0]).toBe(projectId);
                callback(null, []);
            });

            await ExecutionMonitorService.runDailyMonitor(projectId);
        });

        it('should scope notifications to correct users', async () => {
            const projectId = testProjects.project1.id;
            const mockOverdueTasks = [
                {
                    id: 'task-1',
                    title: 'Overdue Task',
                    assignee_id: testUsers.user.id
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('due_date < date')) {
                    callback(null, mockOverdueTasks);
                } else {
                    callback(null, []);
                }
            });

            const result = await ExecutionMonitorService.runDailyMonitor(projectId);

            expect(result.notifications[0].userId).toBe(testUsers.user.id);
            expect(result.notifications[0].relatedObjectId).toBe('task-1');
        });
    });
});

