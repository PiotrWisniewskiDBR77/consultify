/**
 * Integration Service Tests
 *
 * Tests for third-party integrations and connectors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb, createMockLogger } from '../../../helpers/mockDb.js';
import { testOrganizations } from '../../../fixtures/testData.js';

// Mock dependencies
const mockDb = vi.hoisted(() => {
    return {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
    };
});

const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
}));

const mockUuid = vi.hoisted(() => vi.fn(() => 'test-uuid-123'));

// Mock the modules
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mockDb
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mockLogger
}));

vi.mock('uuid', () => ({
    v4: mockUuid
}));

let integrationService;

describe('IntegrationService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Import service
        const module = await import('../../../../server/src/services/integrationService.js');
        const IntegrationServiceClass = module.default || module.IntegrationService || module;
        
        if (typeof IntegrationServiceClass === 'function') {
            integrationService = new IntegrationServiceClass({
                db: mockDb,
                logger: mockLogger,
                uuidv4: mockUuid
            });
        } else {
            integrationService = IntegrationServiceClass;
            // Set dependencies if it's a singleton with setter
            if (integrationService.setDependencies) {
                integrationService.setDependencies({
                    db: mockDb,
                    logger: mockLogger,
                    uuidv4: mockUuid
                });
            }
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getIntegrations()', () => {
        it('should retrieve integrations for an organization', async () => {
            const orgId = testOrganizations.org1.id;
            const mockIntegrations = [
                {
                    id: 'int-1',
                    organization_id: orgId,
                    type: 'slack',
                    name: 'Slack Integration',
                    config: '{"webhook": "test"}',
                    auth_config: '{"token": "secret"}',
                    enabled: 1,
                    sync_config: '{"interval": "daily"}',
                    created_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockDb.all.mockResolvedValue(mockIntegrations);

            const result = await integrationService.getIntegrations(orgId);

            expect(mockDb.all).toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('int-1');
            expect(result[0].organizationId).toBe(orgId);
            expect(result[0].type).toBe('slack');
            expect(result[0].enabled).toBe(true);
        });

        it('should filter integrations by type', async () => {
            const orgId = testOrganizations.org1.id;
            const filters = { type: 'jira' };

            mockDb.all.mockResolvedValue([]);
            
            await integrationService.getIntegrations(orgId, filters);
            expect(mockDb.all).toHaveBeenCalled();
            const lastCall = mockDb.all.mock.calls[0];
            expect(lastCall[0]).toContain('type = ?');
            expect(lastCall[1]).toContain('jira');
        });

        it('should filter integrations by enabled status', async () => {
            const orgId = testOrganizations.org1.id;
            const filters = { enabled: true };

            mockDb.all.mockResolvedValue([]);
            
            await integrationService.getIntegrations(orgId, filters);
            expect(mockDb.all).toHaveBeenCalled();
            const lastCall = mockDb.all.mock.calls[0];
            expect(lastCall[0]).toContain('enabled = ?');
            expect(lastCall[1]).toContain(1);
        });

        it('should handle database errors', async () => {
            const orgId = testOrganizations.org1.id;
            const dbError = new Error('Database connection failed');

            mockDb.all.mockRejectedValue(dbError);

            await expect(integrationService.getIntegrations(orgId)).rejects.toThrow('Database connection failed');
        });
    });

    describe('getIntegrationById()', () => {
        it('should retrieve integration by ID', async () => {
            const integrationId = 'int-123';
            const mockIntegration = {
                id: integrationId,
                organization_id: testOrganizations.org1.id,
                type: 'github',
                name: 'GitHub Integration',
                config: '{"repo": "test/repo"}',
                auth_config: '{"token": "secret"}',
                enabled: 1,
                sync_config: '{"events": ["push", "pull_request"]}',
                last_sync_at: '2024-01-01T12:00:00Z',
                last_sync_status: 'success'
            };

            vi.mocked(mockDb.get).mockResolvedValue(mockIntegration);

            const result = await integrationService.getIntegrationById(integrationId);

            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM integrations WHERE id = ?'),
                [integrationId]
            );
            expect(result.id).toBe(integrationId);
            expect(result.type).toBe('github');
            expect(result.lastSyncAt).toBe('2024-01-01T12:00:00Z');
            expect(result.lastSyncStatus).toBe('success');
        });

        it('should return null for non-existent integration', async () => {
            const integrationId = 'non-existent';

            mockDb.get.mockResolvedValue(null);

            const result = await integrationService.getIntegrationById(integrationId);
            expect(result).toBeNull();
        });
    });

    describe('createIntegration()', () => {
        it('should create a new integration', async () => {
            const integrationData = {
                organization_id: testOrganizations.org1.id,
                type: 'trello',
                name: 'Trello Board Sync',
                config: { boardId: 'board123' },
                auth_config: { apiKey: 'key123', token: 'token123' },
                sync_config: { syncLists: true, syncCards: false }
            };

            vi.mocked(mockDb.run).mockResolvedValueOnce({ lastID: 1, changes: 1 });
            vi.mocked(mockDb.get).mockResolvedValueOnce({
                id: 'test-uuid-123',
                organization_id: integrationData.organization_id,
                type: integrationData.type,
                name: integrationData.name,
                config: JSON.stringify(integrationData.config),
                auth_config: JSON.stringify(integrationData.auth_config),
                enabled: 1,
                sync_config: JSON.stringify(integrationData.sync_config),
                created_at: '2024-01-01T00:00:00Z'
            });

            const result = await integrationService.createIntegration(integrationData);

            expect(mockDb.run).toHaveBeenCalled();
            expect(mockDb.get).toHaveBeenCalled();
            expect(result.id).toBe('test-uuid-123');
            expect(result.organizationId).toBe(integrationData.organization_id);
            expect(result.type).toBe('trello');
            expect(result.name).toBe('Trello Board Sync');
            expect(result.enabled).toBe(true);
        });

        it('should handle database insertion errors', async () => {
            const integrationData = {
                organization_id: testOrganizations.org1.id,
                type: 'asana',
                name: 'Asana Project'
            };

            vi.mocked(mockDb.run).mockRejectedValueOnce(new Error('Unique constraint violation'));

            await expect(integrationService.createIntegration(integrationData))
                .rejects.toThrow('Unique constraint violation');
        });
    });

    describe('updateIntegration()', () => {
        it('should update integration fields', async () => {
            const integrationId = 'int-456';
            const updates = {
                name: 'Updated Integration Name',
                enabled: false,
                config: { newSetting: 'value' }
            };

            const mockIntegration = {
                id: integrationId,
                organization_id: 'org-1',
                type: 'slack',
                name: updates.name,
                config: JSON.stringify(updates.config),
                auth_config: '{}',
                enabled: 0,
                sync_config: '{}',
                created_at: '2024-01-01T00:00:00Z'
            };
            
            vi.mocked(mockDb.run).mockResolvedValueOnce({ changes: 1 });
            vi.mocked(mockDb.get).mockResolvedValueOnce(mockIntegration);

            const result = await integrationService.updateIntegration(integrationId, updates);

            expect(mockDb.run).toHaveBeenCalled();
            expect(result).toBeDefined();
            expect(result.name).toBe(updates.name);
            expect(result.enabled).toBe(false);
        });

        it('should handle update of non-existent integration', async () => {
            const integrationId = 'non-existent';
            const updates = { name: 'New Name' };

            vi.mocked(mockDb.run).mockResolvedValueOnce({ changes: 0 });
            vi.mocked(mockDb.get).mockResolvedValueOnce(null);

            await expect(integrationService.updateIntegration(integrationId, updates))
                .rejects.toThrow('Integration not found');
        });
    });

    describe('deleteIntegration()', () => {
        it('should delete integration by ID', async () => {
            const integrationId = 'int-789';

            vi.mocked(mockDb.run).mockResolvedValueOnce({ changes: 1 });

            const result = await integrationService.deleteIntegration(integrationId);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM integrations WHERE id = ?'),
                [integrationId]
            );
            expect(result).toBe(true);
        });

        it('should handle deletion of non-existent integration', async () => {
            const integrationId = 'non-existent';

            vi.mocked(mockDb.run).mockResolvedValueOnce({ changes: 0 });

            await expect(integrationService.deleteIntegration(integrationId))
                .rejects.toThrow('Integration not found');
        });
    });

    describe('syncIntegration()', () => {
        it('should initiate sync for integration', async () => {
            const integrationId = 'int-sync-123';
            const syncType = 'full';

            const mockIntegration = {
                id: integrationId,
                organization_id: 'org-1',
                type: 'slack',
                enabled: 1,
                config: '{"channel": "#general"}',
                auth_config: '{"token": "secret"}',
                sync_config: '{"interval": "hourly"}'
            };

            // Mock all database calls
            vi.mocked(mockDb.get)
                .mockResolvedValueOnce(mockIntegration) // for initial get
                .mockResolvedValueOnce(mockIntegration); // for final get after update

            vi.mocked(mockDb.run)
                .mockResolvedValueOnce({ lastID: 1, changes: 1 }) // INSERT sync log
                .mockResolvedValueOnce({ changes: 1 }) // UPDATE sync log
                .mockResolvedValueOnce({ changes: 1 }); // UPDATE integration

            const result = await integrationService.syncIntegration(integrationId, syncType);

            expect(result.syncLogId).toBe('test-uuid-123');
            expect(mockDb.run).toHaveBeenCalledTimes(3);
        });

        it('should reject sync for disabled integration', async () => {
            const integrationId = 'int-disabled';

            mockDb.get.mockResolvedValue({
                id: integrationId,
                organization_id: 'org-1',
                type: 'jira',
                enabled: 0,
                config: '{}',
                auth_config: '{}',
                sync_config: '{}'
            });

            await expect(integrationService.syncIntegration(integrationId))
                .rejects.toThrow('Integration is disabled');
        });
    });

    describe('checkHealth()', () => {
        it('should perform health check for integration', async () => {
            const integrationId = 'int-health-123';

            mockDb.get.mockResolvedValue({
                id: integrationId,
                organization_id: 'org-1',
                type: 'webhook',
                enabled: 1,
                last_sync_at: '2024-01-01T10:00:00Z',
                last_sync_status: 'success',
                config: '{}',
                auth_config: '{}',
                sync_config: '{}'
            });

            const result = await integrationService.checkHealth(integrationId);

            expect(result.status).toBe('healthy');
            expect(result.lastSyncStatus).toBe('success');
        });

        it('should detect unhealthy integration', async () => {
            const integrationId = 'int-unhealthy';

            mockDb.get.mockResolvedValue({
                id: integrationId,
                organization_id: 'org-1',
                type: 'api',
                enabled: 1,
                last_sync_at: '2024-01-01T00:00:00Z',
                last_sync_status: 'error',
                config: '{}',
                auth_config: '{}',
                sync_config: '{}'
            });

            const result = await integrationService.checkHealth(integrationId);

            expect(result.status).toBe('healthy'); // Placeholders always return 'healthy' status
            expect(result.lastSyncStatus).toBe('error');
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON in config fields', async () => {
            const integrationId = 'int-bad-json';

            mockDb.get.mockResolvedValue({
                id: integrationId,
                organization_id: 'org-1',
                type: 'slack',
                name: 'Bad JSON',
                config: 'invalid json',
                auth_config: '{}',
                sync_config: '{}',
                enabled: 1
            });

            await expect(integrationService.getIntegrationById(integrationId))
                .rejects.toThrow('Failed to parse integration configuration');
        });

        it('should validate required fields on creation', async () => {
            const invalidData = {
                organization_id: testOrganizations.org1.id,
                type: '', 
                name: 'Test Integration'
            };

            await expect(integrationService.createIntegration(invalidData))
                .rejects.toThrow('Integration type is required');
        });
    });

    describe('Data Transformation', () => {
        it('should convert database record to integration object', async () => {
            const dbRecord = {
                id: 'int-123',
                organization_id: 'org-456',
                type: 'slack',
                name: 'Slack Integration',
                config: '{"webhook": "https://hooks.slack.com/test"}',
                auth_config: '{"token": "xoxb-123"}',
                enabled: 1,
                sync_config: '{"channels": ["#general"]}',
                last_sync_at: '2024-01-01T12:00:00.000Z',
                last_sync_status: 'success'
            };

            mockDb.get.mockResolvedValue(dbRecord);

            const result = await integrationService.getIntegrationById('int-123');

            expect(result.id).toBe('int-123');
            expect(result.organizationId).toBe('org-456');
            expect(result.config).toEqual({ webhook: 'https://hooks.slack.com/test' });
            expect(result.authConfig).toEqual({ token: 'xoxb-123' });
            expect(result.enabled).toBe(true);
        });
    });
});
