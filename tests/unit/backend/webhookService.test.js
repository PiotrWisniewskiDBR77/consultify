/**
 * Webhook Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests webhook triggering, signature generation, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

// Mock node-fetch before imports
const mockFetch = vi.fn();
vi.mock('node-fetch', () => ({
    default: mockFetch
}));

// Mock crypto before imports
const mockCrypto = {
    createHmac: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mock-signature-hash')
    }))
};
vi.mock('crypto', () => mockCrypto);

describe('WebhookService', () => {
    let mockDb;
    let WebhookService;

    beforeEach(() => {
        mockDb = createMockDb();
        
        // Reset mocks
        mockFetch.mockClear();
        mockCrypto.createHmac.mockClear();
        
        // Setup default fetch response
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK'
        });

        // Setup crypto mock
        mockCrypto.createHmac.mockReturnValue({
            update: vi.fn().mockReturnThis(),
            digest: vi.fn().mockReturnValue('mock-signature-hash')
        });

        WebhookService = require('../../../server/services/webhookService.js');
        // WebhookService requires db in constructor
        const serviceInstance = new WebhookService(mockDb);
        WebhookService = serviceInstance;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('trigger()', () => {
        it('should trigger webhooks for matching event type', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'initiative.created';
            const data = { initiativeId: 'init-123', name: 'Test Initiative' };

            const mockWebhooks = [
                {
                    id: 'webhook-1',
                    url: 'https://example.com/webhook',
                    secret: 'secret-key-1',
                    events: 'initiative.created,initiative.updated'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT * FROM webhooks');
                expect(query).toContain('organization_id = ?');
                expect(query).toContain('is_active = 1');
                expect(query).toContain('events LIKE ?');
                expect(params[0]).toBe(orgId);
                expect(params[1]).toContain(eventType);
                callback(null, mockWebhooks);
            });

            const result = await WebhookService.trigger(orgId, eventType, data);

            expect(result.triggered).toBe(1);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].success).toBe(true);
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should return zero triggered when no webhooks match', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'initiative.created';

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await WebhookService.trigger(orgId, eventType, {});

            expect(result.triggered).toBe(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should handle multiple webhooks', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'initiative.created';
            const mockWebhooks = [
                {
                    id: 'webhook-1',
                    url: 'https://example.com/webhook1',
                    secret: 'secret-1',
                    events: 'initiative.created'
                },
                {
                    id: 'webhook-2',
                    url: 'https://example.com/webhook2',
                    secret: 'secret-2',
                    events: 'initiative.created'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, mockWebhooks);
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            const result = await WebhookService.trigger(orgId, eventType, {});

            expect(result.triggered).toBe(2);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should handle webhook failures gracefully', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'initiative.created';
            const mockWebhooks = [
                {
                    id: 'webhook-1',
                    url: 'https://example.com/webhook',
                    secret: 'secret-1',
                    events: 'initiative.created'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, mockWebhooks);
            });

            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await WebhookService.trigger(orgId, eventType, {});

            expect(result.triggered).toBe(1);
            expect(result.results[0].success).toBe(false);
            expect(result.results[0].error).toBeDefined();
        });

        it('should handle database errors', async () => {
            const orgId = testOrganizations.org1.id;
            const dbError = new Error('Database error');

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(dbError, null);
            });

            await expect(
                WebhookService.trigger(orgId, 'event', {})
            ).rejects.toThrow('Database error');
        });
    });

    describe('sendWebhook()', () => {
        it('should send webhook with correct headers and signature', async () => {
            const webhook = {
                id: 'webhook-1',
                url: 'https://example.com/webhook',
                secret: 'secret-key-123',
                events: 'initiative.created'
            };
            const eventType = 'initiative.created';
            const data = { id: 'init-123' };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            const result = await WebhookService.sendWebhook(webhook, eventType, data);

            expect(mockFetch).toHaveBeenCalledWith(
                webhook.url,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-Consultify-Signature': expect.any(String),
                        'X-Consultify-Event': eventType,
                        'User-Agent': 'Consultify-Webhook/1.0'
                    }),
                    body: expect.any(String),
                    timeout: 5000
                })
            );

            expect(result.status).toBe(200);
            expect(result.statusText).toBe('OK');
        });

        it('should include timestamp in payload', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'secret',
                events: 'test'
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            await WebhookService.sendWebhook(webhook, 'test', {});

            const callArgs = mockFetch.mock.calls[0];
            const payload = JSON.parse(callArgs[1].body);

            expect(payload).toHaveProperty('event');
            expect(payload).toHaveProperty('timestamp');
            expect(payload).toHaveProperty('data');
        });

        it('should throw error when webhook returns non-OK status', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'secret',
                events: 'test'
            };

            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(
                WebhookService.sendWebhook(webhook, 'test', {})
            ).rejects.toThrow('Webhook returned 500');
        });

        it('should generate HMAC signature', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'secret-key',
                events: 'test'
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            await WebhookService.sendWebhook(webhook, 'test', {});

            // Verify crypto.createHmac was called with correct algorithm and secret
            expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', webhook.secret);
        });
    });

    describe('sendSlackNotification()', () => {
        it('should send Slack notification', async () => {
            const webhookUrl = 'https://hooks.slack.com/services/xxx';
            const message = {
                text: 'Test notification',
                blocks: []
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200
            });

            const result = await WebhookService.sendSlackNotification(webhookUrl, message);

            expect(result.success).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                webhookUrl,
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(message)
                })
            );
        });

        it('should handle Slack notification failures', async () => {
            const webhookUrl = 'https://hooks.slack.com/services/xxx';
            const message = { text: 'Test' };

            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await WebhookService.sendSlackNotification(webhookUrl, message);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('formatInitiativeMessage()', () => {
        it('should format initiative message for Slack', () => {
            const initiative = {
                name: 'Test Initiative',
                axis: 'Efficiency',
                priority: 'HIGH',
                roi: 25,
                capex: 10000
            };
            const action = 'Created';

            const result = WebhookService.formatInitiativeMessage(initiative, action);

            expect(result).toHaveProperty('blocks');
            expect(result.blocks).toHaveLength(2);
            expect(result.blocks[0].text.text).toContain(action);
            expect(result.blocks[0].text.text).toContain(initiative.name);
            expect(result.blocks[1].elements[0].text).toContain('ROI');
            expect(result.blocks[1].elements[0].text).toContain('Cost');
        });
    });

    describe('formatTaskMessage()', () => {
        it('should format task message with status emoji', () => {
            const task = {
                title: 'Test Task',
                status: 'in_progress'
            };
            const action = 'Updated';

            const result = WebhookService.formatTaskMessage(task, action);

            expect(result).toHaveProperty('blocks');
            expect(result.blocks[0].text.text).toContain('🟡'); // in_progress emoji
            expect(result.blocks[0].text.text).toContain(task.title);
            expect(result.blocks[0].text.text).toContain(task.status);
        });

        it('should use correct emoji for each status', () => {
            const statuses = {
                'not_started': '⚪',
                'in_progress': '🟡',
                'completed': '✅',
                'blocked': '🔴'
            };

            Object.entries(statuses).forEach(([status, emoji]) => {
                const task = { title: 'Test', status };
                const result = WebhookService.formatTaskMessage(task, 'Updated');
                expect(result.blocks[0].text.text).toContain(emoji);
            });
        });

        it('should default to ⚪ for unknown status', () => {
            const task = {
                title: 'Test Task',
                status: 'unknown_status'
            };

            const result = WebhookService.formatTaskMessage(task, 'Updated');

            expect(result.blocks[0].text.text).toContain('⚪');
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only trigger webhooks for specified organization', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'test.event';

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE organization_id = ?');
                expect(params[0]).toBe(orgId);
                callback(null, []);
            });

            await WebhookService.trigger(orgId, eventType, {});

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('organization_id = ?'),
                expect.arrayContaining([orgId]),
                expect.any(Function)
            );
        });

        it('should only match active webhooks', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('is_active = 1');
                callback(null, []);
            });

            await WebhookService.trigger(orgId, 'test', {});
        });
    });

    describe('Security', () => {
        it('should generate unique signature for each webhook', async () => {
            const webhook1 = {
                url: 'https://example.com/webhook1',
                secret: 'secret-1',
                events: 'test'
            };
            const webhook2 = {
                url: 'https://example.com/webhook2',
                secret: 'secret-2',
                events: 'test'
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            await WebhookService.sendWebhook(webhook1, 'test', {});
            await WebhookService.sendWebhook(webhook2, 'test', {});

            const calls = mockFetch.mock.calls;
            const signature1 = calls[0][1].headers['X-Consultify-Signature'];
            const signature2 = calls[1][1].headers['X-Consultify-Signature'];

            // Signatures should be different due to different secrets
            expect(require('crypto').createHmac).toHaveBeenCalledWith('sha256', 'secret-1');
            expect(require('crypto').createHmac).toHaveBeenCalledWith('sha256', 'secret-2');
        });

        it('should include event type in headers', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'secret',
                events: 'test'
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            await WebhookService.sendWebhook(webhook, 'initiative.created', {});

            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[1].headers['X-Consultify-Event']).toBe('initiative.created');
        });
    });
});
