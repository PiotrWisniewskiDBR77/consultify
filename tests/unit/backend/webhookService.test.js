/**
 * Webhook Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests webhook triggering, signature generation, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testOrganizations } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);
const WebhookServiceClass = require('../../../server/services/webhookService.js');

describe('WebhookService', () => {
    let mockDb;
    let mockFetch;
    let WebhookService;

    beforeEach(() => {
        mockDb = createMockDb();
        
        // Create fetch mock
        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK'
        });
        
        // Create service with injected fetch mock
        WebhookService = new WebhookServiceClass(mockDb, { fetch: mockFetch });
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

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await WebhookService.trigger(orgId, eventType, {});

            expect(result.triggered).toBe(1);
            expect(result.results[0].success).toBe(false);
            expect(result.results[0].error).toContain('Network error');
        });

        it('should handle database errors', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'initiative.created';

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('Database error'));
            });

            await expect(WebhookService.trigger(orgId, eventType, {})).rejects.toThrow('Database error');
        });

        it('should only trigger webhooks for specified organization', async () => {
            const orgId = testOrganizations.org1.id;
            const eventType = 'test.event';

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(params[0]).toBe(orgId);
                callback(null, []);
            });

            await WebhookService.trigger(orgId, eventType, {});
            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('sendWebhook()', () => {
        it('should send webhook with correct headers', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'test-secret',
                events: 'test'
            };
            const eventType = 'test.event';
            const data = { key: 'value' };

            await WebhookService.sendWebhook(webhook, eventType, data);

            expect(mockFetch).toHaveBeenCalled();
            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[0]).toBe(webhook.url);
            expect(callArgs[1].method).toBe('POST');
            expect(callArgs[1].headers['Content-Type']).toBe('application/json');
            expect(callArgs[1].headers['X-Consultify-Event']).toBe(eventType);
            expect(callArgs[1].headers['X-Consultify-Signature']).toBeDefined();
            expect(callArgs[1].headers['User-Agent']).toBe('Consultify-Webhook/1.0');
        });

        it('should include payload in body', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'test-secret',
                events: 'test'
            };
            const eventType = 'test.event';
            const data = { key: 'value' };

            await WebhookService.sendWebhook(webhook, eventType, data);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.event).toBe(eventType);
            expect(body.data).toEqual(data);
            expect(body.timestamp).toBeDefined();
        });

        it('should throw on non-ok response', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'test-secret',
                events: 'test'
            };

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(WebhookService.sendWebhook(webhook, 'test', {}))
                .rejects.toThrow('Webhook returned 500: Internal Server Error');
        });
    });

    describe('sendSlackNotification()', () => {
        it('should send Slack notification', async () => {
            const webhookUrl = 'https://hooks.slack.com/services/xxx';
            const message = { text: 'Test message' };

            await WebhookService.sendSlackNotification(webhookUrl, message);

            expect(mockFetch).toHaveBeenCalledWith(
                webhookUrl,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                })
            );
        });

        it('should handle Slack API errors', async () => {
            const webhookUrl = 'https://hooks.slack.com/services/xxx';

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request'
            });

            const result = await WebhookService.sendSlackNotification(webhookUrl, { text: 'test' });
            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
        });
        
        it('should handle network errors', async () => {
            const webhookUrl = 'https://hooks.slack.com/services/xxx';

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await WebhookService.sendSlackNotification(webhookUrl, { text: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });
    });

    describe('Multi-tenant Isolation', () => {
        it('should not leak webhooks between organizations', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            const capturedParams = [];
            mockDb.all.mockImplementation((query, params, callback) => {
                capturedParams.push([...params]);
                callback(null, []);
            });

            await WebhookService.trigger(org1Id, 'test', {});
            await WebhookService.trigger(org2Id, 'test', {});

            expect(capturedParams[0][0]).toBe(org1Id);
            expect(capturedParams[1][0]).toBe(org2Id);
            expect(capturedParams[0][0]).not.toBe(capturedParams[1][0]);
        });

        it('should filter webhooks by organization_id', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('organization_id = ?');
                callback(null, []);
            });

            await WebhookService.trigger(orgId, 'test', {});
        });

        it('should only query active webhooks', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('is_active = 1');
                callback(null, []);
            });

            await WebhookService.trigger(orgId, 'test', {});
        });
    });

    describe('Security', () => {
        it('should generate HMAC signature for each webhook', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'test-secret',
                events: 'test'
            };

            await WebhookService.sendWebhook(webhook, 'test', {});

            const callArgs = mockFetch.mock.calls[0];
            const signature = callArgs[1].headers['X-Consultify-Signature'];
            // Signature should be a hex string (SHA256 = 64 hex chars)
            expect(signature).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should include event type in headers', async () => {
            const webhook = {
                url: 'https://example.com/webhook',
                secret: 'secret',
                events: 'test'
            };

            await WebhookService.sendWebhook(webhook, 'initiative.created', {});

            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[1].headers['X-Consultify-Event']).toBe('initiative.created');
        });
        
        it('should generate different signatures for different secrets', async () => {
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
            const data = { same: 'data' };

            await WebhookService.sendWebhook(webhook1, 'test', data);
            await WebhookService.sendWebhook(webhook2, 'test', data);

            const sig1 = mockFetch.mock.calls[0][1].headers['X-Consultify-Signature'];
            const sig2 = mockFetch.mock.calls[1][1].headers['X-Consultify-Signature'];
            
            expect(sig1).not.toBe(sig2);
        });
    });

    describe('formatInitiativeMessage()', () => {
        it('should format initiative message correctly', () => {
            const initiative = {
                name: 'Test Initiative',
                axis: 'Strategic',
                priority: 'HIGH',
                roi: 150,
                capex: 10000
            };

            const result = WebhookService.formatInitiativeMessage(initiative, 'Created');

            expect(result.blocks).toHaveLength(2);
            expect(result.blocks[0].text.text).toContain('Test Initiative');
            expect(result.blocks[0].text.text).toContain('Strategic');
            expect(result.blocks[1].elements[0].text).toContain('150%');
            expect(result.blocks[1].elements[0].text).toContain('$10000');
        });
    });

    describe('formatTaskMessage()', () => {
        it('should format task message with status emoji', () => {
            const task = {
                title: 'Test Task',
                status: 'in_progress'
            };

            const result = WebhookService.formatTaskMessage(task, 'Updated');

            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0].text.text).toContain('🟡');
            expect(result.blocks[0].text.text).toContain('Test Task');
            expect(result.blocks[0].text.text).toContain('in_progress');
        });

        it('should handle completed status', () => {
            const task = {
                title: 'Test Task',
                status: 'completed'
            };

            const result = WebhookService.formatTaskMessage(task, 'Completed');

            expect(result.blocks[0].text.text).toContain('✅');
        });
    });
});
