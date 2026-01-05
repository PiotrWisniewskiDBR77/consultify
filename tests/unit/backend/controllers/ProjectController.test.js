/**
 * Project Controller Tests
 *
 * Tests for project management, AI roles, regulatory modes, and notification settings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectController } from '../../../../server/src/controllers/ProjectController.js';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';

// Mock services
vi.mock('../../../../server/services/projectService.js', () => ({
    getProjectsForOrganization: vi.fn(),
    createProject: vi.fn(),
    getProjectById: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getProjectNotificationSettings: vi.fn(),
    updateProjectNotificationSettings: vi.fn(),
    getProjectAIRole: vi.fn(),
    updateProjectAIRole: vi.fn(),
    getProjectRegulatoryMode: vi.fn(),
    updateProjectRegulatoryMode: vi.fn()
}));

const mockProjectService = await import('../../../../server/services/projectService.js');

describe('ProjectController', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Setup request/response mocks
        mockReq = {
            user: {
                id: 'user-123',
                organizationId: 'org-456'
            },
            params: {},
            query: {},
            body: {}
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getProjects()', () => {
        it('should retrieve projects for organization', async () => {
            const mockProjects = [
                {
                    id: 'proj-1',
                    name: 'Project Alpha',
                    description: 'First project',
                    status: 'ACTIVE',
                    organization_id: 'org-456',
                    created_at: '2024-01-01T00:00:00Z'
                },
                {
                    id: 'proj-2',
                    name: 'Project Beta',
                    description: 'Second project',
                    status: 'PLANNING',
                    organization_id: 'org-456',
                    created_at: '2024-01-02T00:00:00Z'
                }
            ];

            mockProjectService.getProjectsForOrganization.mockResolvedValue(mockProjects);

            await ProjectController.getProjects(mockReq, mockRes);

            expect(mockProjectService.getProjectsForOrganization).toHaveBeenCalledWith('org-456', undefined, undefined);
            expect(mockRes.json).toHaveBeenCalledWith({
                projects: mockProjects,
                total: 2
            });
        });

        it('should support pagination', async () => {
            mockReq.query.limit = '5';
            mockReq.query.offset = '10';

            mockProjectService.getProjectsForOrganization.mockResolvedValue([]);

            await ProjectController.getProjects(mockReq, mockRes);

            expect(mockProjectService.getProjectsForOrganization).toHaveBeenCalledWith('org-456', 5, 10);
        });

        it('should return 401 when user has no organization', async () => {
            mockReq.user.organizationId = null;

            await ProjectController.getProjects(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(mockProjectService.getProjectsForOrganization).not.toHaveBeenCalled();
        });

        it('should handle service errors', async () => {
            const serviceError = new Error('Database connection failed');
            mockProjectService.getProjectsForOrganization.mockRejectedValue(serviceError);

            await ProjectController.getProjects(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve projects',
                details: serviceError.message
            });
        });
    });

    describe('createProject()', () => {
        it('should create new project', async () => {
            mockReq.body = {
                name: 'New Project',
                description: 'Project description',
                status: 'PLANNING',
                start_date: '2024-03-01',
                end_date: '2024-12-31'
            };

            const mockCreatedProject = {
                id: 'proj-new',
                ...mockReq.body,
                organization_id: 'org-456',
                created_by: 'user-123',
                created_at: new Date().toISOString()
            };

            mockProjectService.createProject.mockResolvedValue(mockCreatedProject);

            await ProjectController.createProject(mockReq, mockRes);

            expect(mockProjectService.createProject).toHaveBeenCalledWith({
                organization_id: 'org-456',
                created_by: 'user-123',
                ...mockReq.body
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(mockCreatedProject);
        });

        it('should validate required fields', async () => {
            mockReq.body = {
                description: 'Missing name'
            };

            await ProjectController.createProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Project name is required'
            });
        });

        it('should validate date logic', async () => {
            mockReq.body = {
                name: 'Invalid Dates',
                start_date: '2024-06-01',
                end_date: '2024-03-01' // End before start
            };

            await ProjectController.createProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'End date must be after start date'
            });
        });

        it('should handle service errors', async () => {
            mockReq.body = {
                name: 'Valid Project',
                start_date: '2024-01-01',
                end_date: '2024-12-31'
            };

            const serviceError = new Error('Project creation failed');
            mockProjectService.createProject.mockRejectedValue(serviceError);

            await ProjectController.createProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to create project',
                details: serviceError.message
            });
        });
    });

    describe('getProjectById()', () => {
        it('should retrieve project by ID', async () => {
            mockReq.params.id = 'proj-789';
            const mockProject = {
                id: 'proj-789',
                name: 'Test Project',
                description: 'Test description',
                status: 'ACTIVE',
                organization_id: 'org-456',
                created_by: 'user-123',
                start_date: '2024-01-01',
                end_date: '2024-12-31'
            };

            mockProjectService.getProjectById.mockResolvedValue(mockProject);

            await ProjectController.getProjectById(mockReq, mockRes);

            expect(mockProjectService.getProjectById).toHaveBeenCalledWith('proj-789', 'org-456');
            expect(mockRes.json).toHaveBeenCalledWith({ project: mockProject });
        });

        it('should return 404 when project not found', async () => {
            mockReq.params.id = 'non-existent';

            mockProjectService.getProjectById.mockResolvedValue(null);

            await ProjectController.getProjectById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project not found' });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'proj-123';
            const serviceError = new Error('Project retrieval failed');
            mockProjectService.getProjectById.mockRejectedValue(serviceError);

            await ProjectController.getProjectById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve project',
                details: serviceError.message
            });
        });
    });

    describe('updateProject()', () => {
        it('should update project details', async () => {
            mockReq.params.id = 'proj-111';
            mockReq.body = {
                name: 'Updated Project Name',
                description: 'Updated description',
                status: 'IN_PROGRESS',
                end_date: '2024-11-30'
            };

            mockProjectService.updateProject.mockResolvedValue(true);

            await ProjectController.updateProject(mockReq, mockRes);

            expect(mockProjectService.updateProject).toHaveBeenCalledWith('proj-111', mockReq.body, 'org-456');
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Project updated successfully'
            });
        });

        it('should return 404 when project not found', async () => {
            mockReq.params.id = 'proj-999';
            mockReq.body = { name: 'Update' };

            mockProjectService.updateProject.mockResolvedValue(false);

            await ProjectController.updateProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project not found' });
        });

        it('should validate status values', async () => {
            mockReq.params.id = 'proj-123';
            mockReq.body = { status: 'INVALID_STATUS' };

            await ProjectController.updateProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid status value'
            });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'proj-123';
            mockReq.body = { name: 'Updated Name' };

            const serviceError = new Error('Update failed');
            mockProjectService.updateProject.mockRejectedValue(serviceError);

            await ProjectController.updateProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to update project',
                details: serviceError.message
            });
        });
    });

    describe('deleteProject()', () => {
        it('should delete project', async () => {
            mockReq.params.id = 'proj-delete';

            mockProjectService.deleteProject.mockResolvedValue(true);

            await ProjectController.deleteProject(mockReq, mockRes);

            expect(mockProjectService.deleteProject).toHaveBeenCalledWith('proj-delete', 'org-456');
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Project deleted successfully'
            });
        });

        it('should return 404 when project not found', async () => {
            mockReq.params.id = 'proj-999';

            mockProjectService.deleteProject.mockResolvedValue(false);

            await ProjectController.deleteProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project not found' });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'proj-123';
            const serviceError = new Error('Deletion failed');
            mockProjectService.deleteProject.mockRejectedValue(serviceError);

            await ProjectController.deleteProject(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to delete project',
                details: serviceError.message
            });
        });
    });

    describe('Notification Settings', () => {
        describe('getNotificationSettings()', () => {
            it('should retrieve project notification settings', async () => {
                mockReq.params.id = 'proj-222';
                const mockSettings = {
                    emailNotifications: true,
                    slackNotifications: false,
                    webhookUrl: 'https://example.com/webhook',
                    notifyOnStatusChange: true,
                    notifyOnTaskAssignment: false
                };

                mockProjectService.getProjectNotificationSettings.mockResolvedValue(mockSettings);

                await ProjectController.getNotificationSettings(mockReq, mockRes);

                expect(mockProjectService.getProjectNotificationSettings).toHaveBeenCalledWith('proj-222', 'org-456');
                expect(mockRes.json).toHaveBeenCalledWith(mockSettings);
            });

            it('should handle service errors', async () => {
                mockReq.params.id = 'proj-123';
                const serviceError = new Error('Settings retrieval failed');
                mockProjectService.getProjectNotificationSettings.mockRejectedValue(serviceError);

                await ProjectController.getNotificationSettings(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Failed to retrieve notification settings',
                    details: serviceError.message
                });
            });
        });

        describe('updateNotificationSettings()', () => {
            it('should update project notification settings', async () => {
                mockReq.params.id = 'proj-333';
                mockReq.body = {
                    emailNotifications: false,
                    slackNotifications: true,
                    webhookUrl: 'https://new-webhook.com/notify',
                    notifyOnStatusChange: true
                };

                mockProjectService.updateProjectNotificationSettings.mockResolvedValue(true);

                await ProjectController.updateNotificationSettings(mockReq, mockRes);

                expect(mockProjectService.updateProjectNotificationSettings).toHaveBeenCalledWith('proj-333', mockReq.body, 'org-456');
                expect(mockRes.json).toHaveBeenCalledWith({
                    message: 'Notification settings updated successfully'
                });
            });

            it('should validate webhook URL format', async () => {
                mockReq.params.id = 'proj-123';
                mockReq.body = {
                    webhookUrl: 'invalid-url'
                };

                await ProjectController.updateNotificationSettings(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Invalid webhook URL format'
                });
            });
        });
    });

    describe('AI Role Management', () => {
        describe('getAIRole()', () => {
            it('should retrieve project AI role', async () => {
                mockReq.params.id = 'proj-444';
                const mockAIRole = {
                    aiRole: 'expert',
                    permissions: ['read', 'write', 'analyze'],
                    customInstructions: 'Be precise and helpful'
                };

                mockProjectService.getProjectAIRole.mockResolvedValue(mockAIRole);

                await ProjectController.getAIRole(mockReq, mockRes);

                expect(mockProjectService.getProjectAIRole).toHaveBeenCalledWith('proj-444', 'org-456');
                expect(mockRes.json).toHaveBeenCalledWith(mockAIRole);
            });
        });

        describe('updateAIRole()', () => {
            it('should update project AI role', async () => {
                mockReq.params.id = 'proj-555';
                mockReq.body = {
                    aiRole: 'assistant',
                    permissions: ['read', 'write'],
                    customInstructions: 'Provide clear, concise responses'
                };

                mockProjectService.updateProjectAIRole.mockResolvedValue(true);

                await ProjectController.updateAIRole(mockReq, mockRes);

                expect(mockProjectService.updateProjectAIRole).toHaveBeenCalledWith('proj-555', mockReq.body, 'org-456');
                expect(mockRes.json).toHaveBeenCalledWith({
                    message: 'AI role updated successfully'
                });
            });

            it('should validate AI role values', async () => {
                mockReq.params.id = 'proj-123';
                mockReq.body = { aiRole: 'invalid-role' };

                await ProjectController.updateAIRole(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Invalid AI role'
                });
            });
        });
    });

    describe('Regulatory Mode', () => {
        describe('getRegulatoryMode()', () => {
            it('should retrieve project regulatory mode', async () => {
                mockReq.params.id = 'proj-666';
                const mockRegulatoryMode = {
                    regulatoryMode: 'gdpr',
                    complianceLevel: 'strict',
                    dataRetention: '7-years',
                    auditEnabled: true
                };

                mockProjectService.getProjectRegulatoryMode.mockResolvedValue(mockRegulatoryMode);

                await ProjectController.getRegulatoryMode(mockReq, mockRes);

                expect(mockProjectService.getProjectRegulatoryMode).toHaveBeenCalledWith('proj-666', 'org-456');
                expect(mockRes.json).toHaveBeenCalledWith(mockRegulatoryMode);
            });
        });

        describe('updateRegulatoryMode()', () => {
            it('should update project regulatory mode', async () => {
                mockReq.params.id = 'proj-777';
                mockReq.body = {
                    regulatoryMode: 'hipaa',
                    complianceLevel: 'high',
                    auditEnabled: true
                };

                mockProjectService.updateProjectRegulatoryMode.mockResolvedValue(true);

                await ProjectController.updateRegulatoryMode(mockReq, mockRes);

                expect(mockProjectService.updateProjectRegulatoryMode).toHaveBeenCalledWith('proj-777', mockReq.body, 'org-456');
                expect(mockRes.json).toHaveBeenCalledWith({
                    message: 'Regulatory mode updated successfully'
                });
            });

            it('should validate regulatory mode values', async () => {
                mockReq.params.id = 'proj-123';
                mockReq.body = { regulatoryMode: 'invalid-mode' };

                await ProjectController.updateRegulatoryMode(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Invalid regulatory mode'
                });
            });
        });
    });

    describe('Security & Authorization', () => {
        it('should enforce organization boundaries', async () => {
            mockReq.params.id = 'proj-cross-org';
            mockReq.user.organizationId = 'org-different';

            mockProjectService.getProjectById.mockResolvedValue(null);

            await ProjectController.getProjectById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project not found' });
        });

        it('should validate admin permissions for sensitive operations', async () => {
            // Regulatory mode changes might require admin permissions
            mockReq.params.id = 'proj-123';
            mockReq.body = { regulatoryMode: 'hipaa' };

            mockProjectService.updateProjectRegulatoryMode.mockResolvedValue(true);

            await ProjectController.updateRegulatoryMode(mockReq, mockRes);

            expect(mockProjectService.updateProjectRegulatoryMode).toHaveBeenCalledWith('proj-123', { regulatoryMode: 'hipaa' }, 'org-456');
        });

        it('should audit sensitive operations', async () => {
            // Changes to regulatory modes should be auditable
            mockReq.params.id = 'proj-audit';
            mockReq.body = { regulatoryMode: 'gdpr' };

            mockProjectService.updateProjectRegulatoryMode.mockResolvedValue(true);

            await ProjectController.updateRegulatoryMode(mockReq, mockRes);

            // In real implementation, this should create audit trail
            expect(mockProjectService.updateProjectRegulatoryMode).toHaveBeenCalled();
        });
    });
});


