/**
 * UserIntegrationService Tests
 * 
 * Tests for user-level integration management
 */

const UserIntegrationService = require('../../../server/services/userIntegrationService');

// Mock the database
jest.mock('../../../server/database', () => ({
    run: jest.fn((sql, params, callback) => {
        if (callback) callback.call({ lastID: 1, changes: 1 }, null);
        return { lastID: 1 };
    }),
    get: jest.fn((sql, params, callback) => {
        callback(null, {
            id: 'test-integration-id',
            user_id: 'test-user-id',
            provider: 'slack',
            status: 'active',
            external_workspace_name: 'Test Workspace',
            config_json: '{"default_channel": "general"}'
        });
    }),
    all: jest.fn((sql, params, callback) => {
        callback(null, [
            {
                id: 'integration-1',
                user_id: 'test-user-id',
                provider: 'slack',
                status: 'active',
                external_workspace_name: 'Slack Workspace'
            },
            {
                id: 'integration-2',
                user_id: 'test-user-id',
                provider: 'jira',
                status: 'active',
                external_workspace_name: 'Jira Site'
            }
        ]);
    })
}));

describe('UserIntegrationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('PROVIDERS', () => {
        it('should have all supported providers defined', () => {
            expect(UserIntegrationService.PROVIDERS.SLACK).toBe('slack');
            expect(UserIntegrationService.PROVIDERS.TEAMS).toBe('teams');
            expect(UserIntegrationService.PROVIDERS.JIRA).toBe('jira');
            expect(UserIntegrationService.PROVIDERS.CLICKUP).toBe('clickup');
        });
    });

    describe('STATUS', () => {
        it('should have all status constants defined', () => {
            expect(UserIntegrationService.STATUS.ACTIVE).toBe('active');
            expect(UserIntegrationService.STATUS.EXPIRED).toBe('expired');
            expect(UserIntegrationService.STATUS.REVOKED).toBe('revoked');
            expect(UserIntegrationService.STATUS.ERROR).toBe('error');
        });
    });

    describe('getAvailableProviders', () => {
        it('should return all available providers', () => {
            const providers = UserIntegrationService.getAvailableProviders();
            
            expect(providers).toHaveLength(4);
            expect(providers.map(p => p.id)).toEqual(['slack', 'teams', 'jira', 'clickup']);
        });

        it('should include capabilities for each provider', () => {
            const providers = UserIntegrationService.getAvailableProviders();
            
            providers.forEach(provider => {
                expect(provider).toHaveProperty('id');
                expect(provider).toHaveProperty('name');
                expect(provider).toHaveProperty('capabilities');
                expect(Array.isArray(provider.capabilities)).toBe(true);
            });
        });
    });

    describe('getUserIntegrations', () => {
        it('should return integrations for a user', async () => {
            const integrations = await UserIntegrationService.getUserIntegrations('test-user-id');
            
            expect(integrations).toHaveLength(2);
            expect(integrations[0].provider).toBe('slack');
            expect(integrations[1].provider).toBe('jira');
        });
    });

    describe('getConnection', () => {
        it('should return connection for user and provider', async () => {
            const connection = await UserIntegrationService.getConnection('test-user-id', 'slack');
            
            expect(connection).toBeDefined();
            expect(connection.provider).toBe('slack');
            expect(connection.status).toBe('active');
        });
    });

    describe('getConnectionStatus', () => {
        it('should return connection status without sensitive data', async () => {
            const status = await UserIntegrationService.getConnectionStatus('test-user-id', 'slack');
            
            expect(status).toBeDefined();
            expect(status.provider).toBe('slack');
            expect(status.isConnected).toBe(true);
            expect(status).not.toHaveProperty('accessToken');
            expect(status).not.toHaveProperty('refreshToken');
        });
    });

    describe('getOAuthUrl', () => {
        beforeEach(() => {
            process.env.SLACK_CLIENT_ID = 'test-slack-client-id';
            process.env.TEAMS_CLIENT_ID = 'test-teams-client-id';
            process.env.JIRA_CLIENT_ID = 'test-jira-client-id';
            process.env.CLICKUP_CLIENT_ID = 'test-clickup-client-id';
        });

        it('should generate Slack OAuth URL', async () => {
            const url = await UserIntegrationService.getOAuthUrl(
                'test-user-id',
                'slack',
                'http://localhost:3000/callback'
            );
            
            expect(url).toContain('slack.com/oauth');
            expect(url).toContain('client_id=test-slack-client-id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('state=');
        });

        it('should generate Teams OAuth URL', async () => {
            const url = await UserIntegrationService.getOAuthUrl(
                'test-user-id',
                'teams',
                'http://localhost:3000/callback'
            );
            
            expect(url).toContain('login.microsoftonline.com');
            expect(url).toContain('client_id=test-teams-client-id');
        });

        it('should generate Jira OAuth URL', async () => {
            const url = await UserIntegrationService.getOAuthUrl(
                'test-user-id',
                'jira',
                'http://localhost:3000/callback'
            );
            
            expect(url).toContain('auth.atlassian.com');
            expect(url).toContain('client_id=test-jira-client-id');
        });

        it('should generate ClickUp OAuth URL', async () => {
            const url = await UserIntegrationService.getOAuthUrl(
                'test-user-id',
                'clickup',
                'http://localhost:3000/callback'
            );
            
            expect(url).toContain('app.clickup.com');
            expect(url).toContain('client_id=test-clickup-client-id');
        });

        it('should throw error for unknown provider', async () => {
            await expect(
                UserIntegrationService.getOAuthUrl('test-user-id', 'unknown', 'http://localhost')
            ).rejects.toThrow('Unknown provider');
        });
    });

    describe('parseOAuthState', () => {
        it('should parse valid state', () => {
            const stateData = { userId: 'test-user', provider: 'slack', ts: Date.now() };
            const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
            
            const parsed = UserIntegrationService.parseOAuthState(state);
            
            expect(parsed.userId).toBe('test-user');
            expect(parsed.provider).toBe('slack');
        });

        it('should throw error for invalid state', () => {
            expect(() => {
                UserIntegrationService.parseOAuthState('invalid-state');
            }).toThrow('Invalid OAuth state');
        });
    });

    describe('isConnected', () => {
        it('should return true for active connection', async () => {
            const isConnected = await UserIntegrationService.isConnected('test-user-id', 'slack');
            expect(isConnected).toBe(true);
        });
    });
});









