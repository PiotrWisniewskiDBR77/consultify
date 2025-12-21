import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AI Integration Service', () => {
    let AIIntegrationService;
    let mockDb;
    let mockUuid;

    beforeEach(async () => {
        vi.resetModules();

        mockDb = {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        };

        mockUuid = {
            v4: vi.fn(() => 'mock-uuid-action')
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('uuid', () => ({ v4: mockUuid.v4 }));

        AIIntegrationService = (await import('../../../server/services/aiIntegrationService.js')).default;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Logic: getProviderCapabilities', () => {
        it('should return correct capabilities for known providers', () => {
            const jiraCaps = AIIntegrationService.getProviderCapabilities('jira');
            expect(jiraCaps).toContain('create_task');
            expect(jiraCaps).toContain('update_task');
            expect(jiraCaps).not.toContain('send_notification');

            const slackCaps = AIIntegrationService.getProviderCapabilities('slack');
            expect(slackCaps).toContain('send_notification');
        });

        it('should return empty array for unknown provider', () => {
            expect(AIIntegrationService.getProviderCapabilities('unknown')).toEqual([]);
        });
    });

    describe('suggestSync', () => {
        it('should create pending action', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) { 
                if (cb) cb.call({ changes: 1, lastID: 'mock-action-id' }, null); 
            });

            const suggestion = {
                organizationId: 'org-1',
                projectId: 'p-1',
                integrationId: 'int-1',
                actionType: 'create_task',
                targetEntityType: 'task',
                targetEntityId: 't-1',
                payload: { title: 'New Task' },
                reason: 'Sync'
            };

            const result = await AIIntegrationService.suggestSync(suggestion);
            expect(result.status).toBe('pending');
            expect(result.requiresApproval).toBe(true);
            expect(result.id).toBeDefined();
        });
    });

    describe('executeAction', () => {
        it('should execute approved action and update status', async () => {
            // Mock fetching the action
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    id: 'a-1',
                    integration_id: 'int-1',
                    action_type: 'create_task',
                    status: 'approved',
                    payload: JSON.stringify({ title: 'Task' }),
                    provider: 'jira',
                    target_entity_type: 'task',
                    target_entity_id: 't-1'
                });
            });

            // Mock updates
            mockDb.run.mockImplementation(function (sql, params, cb) { 
                if (cb) cb.call({ changes: 1 }, null); 
            });

            const result = await AIIntegrationService.executeAction('a-1', 'user-1');

            expect(result.status).toBe('executed');
            expect(result.result).toBeDefined();
        });

        it('should throw if action not found or not approved', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));
            await expect(AIIntegrationService.executeAction('bad-id', 'u-1')).rejects.toThrow();
        });
    });

    describe('handleWebhook', () => {
        it('should process webhook if integration active', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                const s = sql.toLowerCase();
                if (s.includes('is_active') || s.includes('where provider')) {
                    return cb(null, { id: 'int-1', is_active: 1, provider: 'jira' });
                }
                cb(null, { id: 'int-1', is_active: 1 });
            });
            mockDb.run.mockImplementation(function (sql, params, cb) { 
                if (cb) cb.call({ changes: 1 }, null); 
            }); // Log sync

            const result = await AIIntegrationService.handleWebhook('jira', { id: 'evt-1' });
            expect(result.handled).toBe(true);
        });
    });
});
