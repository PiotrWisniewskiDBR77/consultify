import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../helpers/unifiedMockSetup.js';

/**
 * Connector Adapter Tests
 * Tests for external connector integration and adapter pattern
 * CRITICAL FOR ENTERPRISE INTEGRATIONS
 */

describe('ConnectorAdapter', () => {
    let connectorAdapter;
    let mocks;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mocks = setupStandardTest();

        // Service-specific mocks
        mocks.connectorService = {
            getSecrets: vi.fn(),
            getConfig: vi.fn()
        };

        mocks.connectorRegistry = {
            getConnector: vi.fn((key) => {
                const catalog = {
                    slack: { key: 'slack', capabilities: ['message_send'] },
                    jira: { key: 'jira', capabilities: ['issue_create'] },
                    google_calendar: { key: 'google_calendar', capabilities: ['event_create'] }
                };
                return catalog[key] || null;
            })
        };

        mocks.auditLogger = {
            info: vi.fn(),
            error: vi.fn()
        };

        // Re-import after mocks (ensures vi.mock applies reliably)
        const mod = await import('../../server/ai/connectorAdapter.js');
        connectorAdapter = mod.default || mod;

        connectorAdapter.setDependencies({
            connectorService: mocks.connectorService,
            connectorRegistry: mocks.connectorRegistry,
            auditLogger: mocks.auditLogger
        });
    });

    describe('Dry-run Mode', () => {
        it('should return plan without execution in dry-run mode', async () => {
            mocks.connectorService.getConfig.mockResolvedValue({
                status: 'CONNECTED',
                sandbox_mode: false
            });

            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'message_send',
                { channel: '#general', text: 'Hello world' },
                { dry_run: true }
            );

            expect(result.success).toBe(true);
            expect(result.dry_run).toBe(true);
            expect(result.would_do).toBeDefined();
            expect(result.external_calls).toBeDefined();

            // Should NOT call getSecrets in dry-run
            expect(mocks.connectorService.getSecrets).not.toHaveBeenCalled();
        });

        it('should respect sandbox_mode flag on config', async () => {
            mocks.connectorService.getConfig.mockResolvedValue({
                status: 'CONNECTED',
                sandbox_mode: true  // Sandbox mode enabled
            });

            const result = await connectorAdapter.execute(
                'org-123',
                'jira',
                'issue_create',
                { title: 'Test Issue' },
                { dry_run: false }  // Not explicitly dry-run
            );

            expect(result.success).toBe(true);
            expect(result.dry_run).toBe(true);
            expect(result.sandbox_mode).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should return error for unknown connector', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'nonexistent_connector',
                'some_action',
                {},
                {}
            );

            expect(result.success).toBe(false);
            expect(result.error_code).toBe('UNKNOWN_CONNECTOR');
        });

        it('should return error for unsupported action', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'unsupported_action',
                {},
                {}
            );

            expect(result.success).toBe(false);
            expect(result.error_code).toBe('UNSUPPORTED_ACTION');
        });

        it('should return error when connector not configured', async () => {
            mockConnectorService.getConfig.mockResolvedValue(null);

            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'message_send',
                { channel: '#general', text: 'Hello' },
                {}
            );

            expect(result.success).toBe(false);
            expect(result.error_code).toBe('NOT_CONFIGURED');
        });

        it('should return error when connector disconnected', async () => {
            mocks.connectorService.getConfig.mockResolvedValue({
                status: 'DISCONNECTED',
                sandbox_mode: false
            });

            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'message_send',
                { channel: '#general', text: 'Hello' },
                {}
            );

            expect(result.success).toBe(false);
            expect(result.error_code).toBe('NOT_CONFIGURED');
        });
    });

    describe('Plan Generation', () => {
        beforeEach(() => {
            mocks.connectorService.getConfig.mockResolvedValue({
                status: 'CONNECTED',
                sandbox_mode: false
            });
        });

        it('should generate Jira plan for issue_create', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'jira',
                'issue_create',
                { title: 'Test', description: 'Desc' },
                { dry_run: true }
            );

            expect(result.would_do).toContain('Create Jira issue');
            expect(result.external_calls).toContain('POST /rest/api/3/issue');
        });

        it('should generate Slack plan for message_send', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'message_send',
                { channel: '#general', text: 'Hello world' },
                { dry_run: true }
            );

            expect(result.would_do).toContain('Send Slack message');
            expect(result.external_calls).toContain('POST /api/chat.postMessage');
        });

        it('should generate Google Calendar plan for event_create', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'google_calendar',
                'event_create',
                { summary: 'Meeting', start_time: '2025-01-01T10:00:00Z' },
                { dry_run: true }
            );

            expect(result.would_do).toContain('Create Google Calendar event');
        });
    });

    describe('Execution (Mock)', () => {
        beforeEach(() => {
            mocks.connectorService.getConfig.mockResolvedValue({
                status: 'CONNECTED',
                sandbox_mode: false
            });
            mocks.connectorService.getSecrets.mockResolvedValue({
                bot_token: 'xoxb-test-token'
            });
        });

        it('should execute Slack message_send successfully', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'message_send',
                { channel: '#general', text: 'Hello world' },
                { dry_run: false }
            );

            expect(result.success).toBe(true);
            expect(result.connector_key).toBe('slack');
            expect(result.action).toBe('message_send');
            expect(result.result).toBeDefined();
            expect(result.result.mock).toBe(true);
        });

        it('should include duration_ms in result', async () => {
            const result = await connectorAdapter.execute(
                'org-123',
                'slack',
                'message_send',
                { channel: '#general', text: 'Hello' },
                { dry_run: false }
            );

            expect(result.duration_ms).toBeDefined();
            expect(typeof result.duration_ms).toBe('number');
        });
    });
});
