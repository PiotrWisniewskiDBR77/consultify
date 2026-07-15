/**
 * Billing Webhook Service Tests
 * 
 * Tests for billing event triggering and webhook delivery management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';
import { BillingWebhookServiceClass, BILLING_EVENT_TYPES } from '../../../server/src/services/BillingWebhookService.ts';

describe('BillingWebhookService', () => {
    let mockWebhookService;
    let deps;
    let mocks;

    beforeEach(async () => {
        mocks = setupStandardTest();

        // Setup specific webhook service mock
        mockWebhookService = {
            trigger: vi.fn().mockResolvedValue({ triggered: 1, results: [{ success: true }] })
        };

        deps = {
            db: mocks.db,
            uuidv4: mocks.uuid,
            webhookService: mockWebhookService
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('BILLING_EVENT_TYPES', () => {
        it('should define all subscription event types', () => {
            expect(BILLING_EVENT_TYPES.SUBSCRIPTION_CREATED).toBe('subscription.created');
            expect(BILLING_EVENT_TYPES.SUBSCRIPTION_UPDATED).toBe('subscription.updated');
            expect(BILLING_EVENT_TYPES.SUBSCRIPTION_CANCELED).toBe('subscription.canceled');
        });

        it('should define all invoice event types', () => {
            expect(BILLING_EVENT_TYPES.INVOICE_CREATED).toBe('invoice.created');
            expect(BILLING_EVENT_TYPES.INVOICE_PAID).toBe('invoice.paid');
            expect(BILLING_EVENT_TYPES.INVOICE_PAYMENT_FAILED).toBe('invoice.payment_failed');
        });

        it('should define all payment event types', () => {
            expect(BILLING_EVENT_TYPES.PAYMENT_SUCCEEDED).toBe('payment.succeeded');
            expect(BILLING_EVENT_TYPES.PAYMENT_FAILED).toBe('payment.failed');
            expect(BILLING_EVENT_TYPES.PAYMENT_REFUNDED).toBe('payment.refunded');
        });

        it('should define all credit note event types', () => {
            expect(BILLING_EVENT_TYPES.CREDIT_NOTE_ISSUED).toBe('credit_note.issued');
            expect(BILLING_EVENT_TYPES.CREDIT_NOTE_APPLIED).toBe('credit_note.applied');
        });

        it('should define all dunning event types', () => {
            expect(BILLING_EVENT_TYPES.DUNNING_STARTED).toBe('dunning.started');
            expect(BILLING_EVENT_TYPES.DUNNING_COMPLETED).toBe('dunning.completed');
            expect(BILLING_EVENT_TYPES.DUNNING_FAILED).toBe('dunning.failed');
        });
    });

    describe('recordBillingWebhookEvent()', () => {
        it('should record a new billing webhook event', async () => {
            const orgId = 'org-123';
            const eventType = 'subscription.created';
            const payload = { subscription_id: 'sub-456' };

            mocks.db.run.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ changes: 1 }, null);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.recordBillingWebhookEvent(orgId, eventType, payload);

            expect(result).toHaveProperty('id');
            expect(result.organizationId).toBe(orgId);
            expect(result.eventType).toBe(eventType);
            expect(result.status).toBe('pending');
            // Mock call verification
            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO billing_webhook_events'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should handle database errors', async () => {
            mocks.db.run.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(new Error('DB Error'));
            });

            const service = new BillingWebhookServiceClass(deps);
            await expect(
                service.recordBillingWebhookEvent('org-123', 'test.event', {})
            ).rejects.toThrow('DB Error');
        });
    });

    describe('getEventById()', () => {
        it('should retrieve event by ID with parsed payload', async () => {
            const eventId = 'evt-123';
            const mockEvent = {
                id: eventId,
                event_type: 'invoice.paid',
                payload: JSON.stringify({ amount: 1000 }),
                status: 'sent'
            };

            mocks.db.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, mockEvent);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.getEventById(eventId);

            expect(result.id).toBe(eventId);
            expect(result.payload).toEqual({ amount: 1000 });
        });

        it('should return null for non-existent event', async () => {
            mocks.db.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, null);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.getEventById('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('getPendingRetries()', () => {
        it('should retrieve pending events for retry', async () => {
            const mockEvents = [
                { id: 'evt-1', status: 'pending', payload: JSON.stringify({}) },
                { id: 'evt-2', status: 'retrying', payload: JSON.stringify({}) }
            ];

            mocks.db.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, mockEvents);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.getPendingRetries(50);

            expect(result).toHaveLength(2);
            expect(mocks.db.all).toHaveBeenCalledWith(
                expect.stringContaining('status IN'),
                [50],
                expect.any(Function)
            );
        });

        it('should respect limit parameter', async () => {
            mocks.db.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, []);
            });

            const service = new BillingWebhookServiceClass(deps);
            await service.getPendingRetries(10);

            expect(mocks.db.all).toHaveBeenCalledWith(
                expect.any(String),
                [10],
                expect.any(Function)
            );
        });
    });

    describe('triggerEvent()', () => {
        it('should record and trigger webhook event', async () => {
            const orgId = 'org-123';
            const eventType = 'invoice.paid';
            const data = { invoice_id: 'inv-456', amount: 5000 };

            mocks.db.run.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ changes: 1 }, null);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.triggerEvent(orgId, eventType, data);

            expect(result.recorded).toBe(true);
            expect(result).toHaveProperty('eventId');
        });

        it('should only record when recordOnly option is true', async () => {
            mocks.db.run.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ changes: 1 }, null);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.triggerEvent('org-123', 'test.event', {}, { recordOnly: true });

            expect(result.recorded).toBe(true);
            expect(result.triggered).toBe(false);
        });
    });

    describe('Convenience Methods', () => {
        beforeEach(() => {
            mocks.db.run.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb.call({ changes: 1 }, null);
            });
        });

        it('subscriptionCreated() should trigger correct event', async () => {
            const service = new BillingWebhookServiceClass(deps);
            const result = await service.subscriptionCreated('org-123', { id: 'sub-456', plan: 'pro' });

            expect(result.recorded).toBe(true);
        });

        it('invoicePaid() should trigger correct event', async () => {
            const service = new BillingWebhookServiceClass(deps);
            const result = await service.invoicePaid('org-123', { id: 'inv-456', amount: 1000 });

            expect(result.recorded).toBe(true);
        });

        it('paymentFailed() should include error information', async () => {
            const service = new BillingWebhookServiceClass(deps);
            const result = await service.paymentFailed('org-123', { id: 'pay-456' }, 'Card declined');

            expect(result.recorded).toBe(true);
        });

        it('creditNoteIssued() should trigger correct event', async () => {
            const service = new BillingWebhookServiceClass(deps);
            const result = await service.creditNoteIssued('org-123', { id: 'cn-456', amount: 500 });

            expect(result.recorded).toBe(true);
        });
    });

    describe('getEventStats()', () => {
        it('should return event statistics grouped by type and status', async () => {
            const mockStats = [
                { event_type: 'invoice.paid', status: 'sent', count: 10 },
                { event_type: 'payment.failed', status: 'failed', count: 2 }
            ];

            mocks.db.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, mockStats);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.getEventStats('org-123', '30 days');

            expect(result).toHaveLength(2);
            expect(mocks.db.all).toHaveBeenCalledWith(
                expect.stringContaining('GROUP BY event_type, status'),
                ['org-123'],
                expect.any(Function)
            );
        });
    });

    describe('getRecentEvents()', () => {
        it('should return recent events with parsed payloads', async () => {
            const mockEvents = [
                { id: 'evt-1', payload: JSON.stringify({ amount: 100 }) },
                { id: 'evt-2', payload: JSON.stringify({ amount: 200 }) }
            ];

            mocks.db.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, mockEvents);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.getRecentEvents('org-123', 50);

            expect(result).toHaveLength(2);
            expect(result[0].payload).toEqual({ amount: 100 });
        });
    });

    describe('getFailedEvents()', () => {
        it('should return failed events under retry limit', async () => {
            mocks.db.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (cb) cb(null, [{ id: 'evt-1', status: 'failed', attempt_count: 3 }]);
            });

            const service = new BillingWebhookServiceClass(deps);
            const result = await service.getFailedEvents(50);

            expect(mocks.db.all).toHaveBeenCalledWith(
                expect.stringContaining("status = 'failed'"),
                [50],
                expect.any(Function)
            );
        });
    });
});


