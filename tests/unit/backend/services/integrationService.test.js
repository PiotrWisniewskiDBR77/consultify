/**
 * Integration Service Tests
 *
 * Tests for third-party integrations management, CRUD operations, sync management,
 * health monitoring, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb, createMockLogger } from '../../../helpers/mockDb.js';
import { testOrganizations } from '../../../fixtures/testData.js';

// Mock getDatabase before importing the service
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: vi.fn()
}));

// Mock uuidv4
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-uuid-123')
}));

let integrationService;

describe('IntegrationService', () => {
    let mockDb;
    let mockLogger;
    let mockGetDatabase;

    beforeEach(async () => {
        // Use mock setup
        mockDb = createMockDb();
        mockLogger = createMockLogger();

        // Get the mocked getDatabase
        const dbModule = await import('../../../../server/src/database/Database.js');
        mockGetDatabase = dbModule.getDatabase;

        // Setup mock database
        mockGetDatabase.mockReturnValue(mockDb);

        // Import service using dynamic import
        const module = await import('../../../../server/src/services/integrationService.js');
        integrationService = module.default || module;

        // Set dependencies if service supports it
        if (integrationService && typeof integrationService.setDependencies === 'function') {
            integrationService.setDependencies({
                db: mockDb,
                uuidv4: () => 'test-uuid-123'
            });
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
            mockDb.all.mockImplementation(async (query, params) => {
                expect(query).toContain('type = ?');
                expect(params[1]).toBe('jira'); // params[0] is orgId
                return [];
            });

            await integrationService.getIntegrations(orgId, filters);
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should filter integrations by enabled status', async () => {
            const orgId = testOrganizations.org1.id;
            const filters = { enabled: true };

            mockDb.all.mockResolvedValue([]);
            mockDb.all.mockImplementation(async (query, params) => {
                expect(query).toContain('enabled = ?');
                expect(params[1]).toBe(1); // params[0] is orgId
                return [];
            });

            await integrationService.getIntegrations(orgId, filters);
            expect(mockDb.all).toHaveBeenCalled();
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

            vi.mocked(mockDb.get).mockImplementationOnce(() => Promise.resolve(mockIntegration));

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
                organizationId: testOrganizations.org1.id,
                type: 'trello',
                name: 'Trello Board Sync',
                config: { boardId: 'board123' },
                authConfig: { apiKey: 'key123', token: 'token123' },
                syncConfig: { syncLists: true, syncCards: false }
            };

            vi.mocked(mockDb.run).mockResolvedValueOnce({ lastID: 1, changes: 1 });
            vi.mocked(mockDb.get).mockResolvedValueOnce({
                id: 'test-uuid-123',
                organization_id: integrationData.organizationId,
                type: integrationData.type,
                name: integrationData.name,
                config: JSON.stringify(integrationData.config),
                auth_config: JSON.stringify(integrationData.authConfig),
                enabled: 1,
                sync_config: JSON.stringify(integrationData.syncConfig),
                created_at: '2024-01-01T00:00:00Z'
            });

            const result = await integrationService.createIntegration(integrationData);

            expect(mockDb.run).toHaveBeenCalled();
            expect(mockDb.get).toHaveBeenCalled();
            expect(result.id).toBe('test-uuid-123');
            expect(result.organizationId).toBe(integrationData.organizationId);
            expect(result.type).toBe('trello');
            expect(result.name).toBe('Trello Board Sync');
            expect(result.enabled).toBe(true);
        });

        it('should handle database insertion errors', async () => {
            const integrationData = {
                organizationId: testOrganizations.org1.id,
                type: 'asana',
                name: 'Asana Project',
                config: {},
                authConfig: {},
                syncConfig: {}
            };

            const dbError = new Error('Unique constraint violation');
            mockDb.run.mockRejectedValue(dbError);

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
                name: updates.name || 'Updated Integration',
                config: JSON.stringify(updates.config || {}),
                auth_config: '{}',
                enabled: updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : 1,
                sync_config: '{}',
                created_at: '2024-01-01T00:00:00Z'
            };
            vi.mocked(mockDb.run).mockResolvedValueOnce({ changes: 1 });
            vi.mocked(mockDb.get).mockResolvedValueOnce(mockIntegration);

            const result = await integrationService.updateIntegration(integrationId, updates);

            expect(mockDb.run).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should handle update of non-existent integration', async () => {
            const integrationId = 'non-existent';
            const updates = { name: 'New Name' };

            vi.mocked(mockDb.run).mockResolvedValueOnce({ changes: 0 });
            vi.mocked(mockDb.get).mockResolvedValueOnce(null); // Integration not found

            await expect(integrationService.updateIntegration(integrationId, updates))
                .rejects.toThrow('Integration not found');
        });
    });

    describe('deleteIntegration()', () => {
        it('should delete integration by ID', async () => {
            const integrationId = 'int-789';

            vi.mocked(mockDb.run).mockImplementationOnce(() => Promise.resolve({ changes: 1 }));

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

            // Mock all database calls - use sequential mockResolvedValueOnce
            vi.mocked(mockDb.get)
                .mockResolvedValueOnce({
                    id: integrationId,
                    type: 'slack',
                    enabled: 1,
                    config: '{"channel": "#general"}',
                    auth_config: '{"token": "secret"}',
                    sync_config: '{"interval": "hourly"}'
                })
                .mockResolvedValueOnce(null); // No existing sync log

            vi.mocked(mockDb.run).mockResolvedValueOnce({ lastID: 1, changes: 1 });

            const result = await integrationService.syncIntegration(integrationId, syncType);

            expect(result.syncLogId).toBe('test-uuid-123');
            expect(result.integrationId).toBe(integrationId);
        });

        it('should reject sync for disabled integration', async () => {
            const integrationId = 'int-disabled';

            mockDb.get.mockResolvedValue({
                id: integrationId,
                type: 'jira',
                enabled: 0 // disabled
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
                type: 'webhook',
                enabled: 1,
                last_sync_at: '2024-01-01T10:00:00Z',
                last_sync_status: 'success'
            });

            const result = await integrationService.checkHealth(integrationId);

            expect(result.healthy).toBe(true);
            expect(result.integrationId).toBe(integrationId);
            expect(result.lastSyncStatus).toBe('success');
            expect(result.timeSinceLastSync).toBeDefined();
        });

        it('should detect unhealthy integration', async () => {
            const integrationId = 'int-unhealthy';

            mockDb.get.mockResolvedValue({
                id: integrationId,
                type: 'api',
                enabled: 1,
                last_sync_at: '2024-01-01T00:00:00Z', // old sync
                last_sync_status: 'error'
            });

            const result = await integrationService.checkHealth(integrationId);

            expect(result.healthy).toBe(false);
            expect(result.lastSyncStatus).toBe('error');
        });
    });

    describe('getAvailableTypes()', () => {
        it('should return available integration types', () => {
            const types = integrationService.getAvailableTypes();

            expect(Array.isArray(types)).toBe(true);
            expect(types.length).toBeGreaterThan(0);

            types.forEach(type => {
                expect(type).toHaveProperty('id');
                expect(type).toHaveProperty('name');
                expect(type).toHaveProperty('description');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON in config fields', async () => {
            const integrationId = 'int-bad-json';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: integrationId,
                    config: 'invalid json',
                    auth_config: 'also invalid',
                    sync_config: '{"valid": true}'
                });
            });

            await expect(integrationService.getIntegrationById(integrationId))
                .rejects.toThrow('Failed to parse integration configuration');
        });

        it('should validate required fields on creation', async () => {
            const invalidData = {
                organizationId: testOrganizations.org1.id,
                type: '', // empty type
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
            expect(result.type).toBe('slack');
            expect(result.name).toBe('Slack Integration');
            expect(result.config).toEqual({ webhook: 'https://hooks.slack.com/test' });
            expect(result.authConfig).toEqual({ token: 'xoxb-123' });
            expect(result.syncConfig).toEqual({ channels: ['#general'] });
            expect(result.enabled).toBe(true);
            expect(result.lastSyncAt).toBe('2024-01-01T12:00:00.000Z');
            expect(result.lastSyncStatus).toBe('success');
        });

        it('should convert integration object to database record', async () => {
            const integrationData = {
                organizationId: 'org-789',
                type: 'github',
                name: 'GitHub Integration',
                config: { repo: 'org/repo', events: ['push'] },
                authConfig: { token: 'ghp_123' },
                syncConfig: { syncIssues: true, syncPRs: false },
                enabled: true
            };

            mockDb.run.mockResolvedValue({ lastID: 'int-new', changes: 1 });
            mockDb.run.mockImplementation(async (query, params) => {
                // Verify params are correctly serialized - check actual order from service
                expect(params[0]).toBe('test-uuid-123'); // id (generated by uuidv4)
                expect(params[1]).toBe('org-789'); // organization_id
                expect(params[2]).toBe('github'); // type
                expect(params[3]).toBe('GitHub Integration'); // name
                expect(JSON.parse(params[4])).toEqual(integrationData.config); // config
                expect(JSON.parse(params[5])).toEqual(integrationData.authConfig); // auth_config
                expect(params[6]).toBe(1); // enabled
                expect(JSON.parse(params[7])).toEqual(integrationData.syncConfig); // sync_config
                expect(JSON.parse(params[4])).toEqual(integrationData.config); // config
                expect(JSON.parse(params[5])).toEqual(integrationData.authConfig); // auth_config
                expect(params[6]).toBe(1); // enabled
                expect(JSON.parse(params[7])).toEqual(integrationData.syncConfig); // sync_config

                return { lastID: 'int-new', changes: 1 };
            });

            await integrationService.createIntegration(integrationData);
            expect(mockDb.run).toHaveBeenCalled();
        });
    });
});
