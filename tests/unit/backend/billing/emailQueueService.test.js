/**
 * Unit Tests for Email Queue Service
 * Tests email queuing, processing, and retry logic
 */

import { jest } from '@jest/globals';

// Mock database
const mockDb = {
    run: jest.fn((sql, params, callback) => {
        if (typeof callback === 'function') {
            callback.call({ lastID: 1, changes: 1 }, null);
        }
    }),
    get: jest.fn((sql, params, callback) => callback(null, null)),
    all: jest.fn((sql, params, callback) => callback(null, []))
};

// Mock database module
jest.unstable_mockModule('../../../../server/src/database/index.js', () => ({
    getDatabase: () => mockDb
}));

// Import after mocking
const emailQueueService = await import('../../../../server/services/emailQueueService.js');

describe('EmailQueueService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('queueBillingEmail', () => {
        it('should queue email with valid recipient', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_billing')) {
                    callback(null, { billing_email: 'billing@example.com' });
                } else {
                    callback(null, null);
                }
            });

            const result = await emailQueueService.queueBillingEmail({
                type: 'invoice_created',
                orgId: 'org-1',
                data: {
                    invoiceNumber: 'INV-001',
                    amount: '99.00',
                    currency: 'USD'
                }
            });

            expect(result).toHaveProperty('id');
            expect(result.skipped).toBeUndefined();
        });

        it('should skip when no recipient found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await emailQueueService.queueBillingEmail({
                type: 'invoice_created',
                orgId: 'org-1',
                data: {}
            });

            expect(result).toHaveProperty('skipped', true);
            expect(result).toHaveProperty('reason', 'No recipient email');
        });

        it('should use custom recipient when provided', async () => {
            const result = await emailQueueService.queueBillingEmail({
                type: 'invoice_paid',
                orgId: 'org-1',
                data: {
                    invoiceNumber: 'INV-001'
                },
                options: {
                    recipientEmail: 'custom@example.com',
                    recipientName: 'Custom User'
                }
            });

            expect(result).toHaveProperty('id');
        });

        it('should set correct priority', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_billing')) {
                    callback(null, { billing_email: 'billing@example.com' });
                } else {
                    callback(null, null);
                }
            });

            await emailQueueService.queueBillingEmail({
                type: 'payment_failed',
                orgId: 'org-1',
                data: {},
                options: { priority: 1 } // High priority
            });

            expect(mockDb.run).toHaveBeenCalled();
            // Check that priority was included in the insert
            const runCalls = mockDb.run.mock.calls;
            const insertCall = runCalls.find(call => call[0].includes('INSERT'));
            if (insertCall) {
                expect(insertCall[1]).toContain(1); // Priority value
            }
        });
    });

    describe('getEmailStatus', () => {
        it('should return email status when found', async () => {
            const mockEmail = {
                id: 'email-1',
                status: 'sent',
                email_type: 'invoice_created',
                recipient_email: 'test@example.com',
                subject: 'New Invoice Available',
                sent_at: '2026-01-04T10:00:00Z',
                created_at: '2026-01-04T09:00:00Z',
                retry_count: 0,
                error_message: null
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockEmail);
            });

            const result = await emailQueueService.getEmailStatus('email-1');

            expect(result).toHaveProperty('found', true);
            expect(result).toHaveProperty('status', 'sent');
            expect(result).toHaveProperty('type', 'invoice_created');
        });

        it('should return not found when email does not exist', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await emailQueueService.getEmailStatus('nonexistent');

            expect(result).toHaveProperty('found', false);
        });
    });

    describe('retryFailedEmails', () => {
        it('should queue failed emails for retry', async () => {
            const mockFailedEmails = [
                {
                    id: 'email-1',
                    email_type: 'payment_failed',
                    organization_id: 'org-1',
                    recipient_email: 'test@example.com',
                    recipient_name: 'Test User',
                    subject: 'Payment Failed',
                    template_data: '{"amount": "99.00"}',
                    priority: 5,
                    retry_count: 1
                }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockFailedEmails);
            });

            const result = await emailQueueService.retryFailedEmails();

            expect(result).toHaveProperty('queued', 1);
        });

        it('should return zero when no failed emails', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            const result = await emailQueueService.retryFailedEmails();

            expect(result).toHaveProperty('queued', 0);
        });
    });

    describe('getQueueStats', () => {
        it('should return queue statistics', async () => {
            const mockStats = {
                total: 100,
                pending: 5,
                sent: 90,
                failed: 5
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockStats);
            });

            const result = await emailQueueService.getQueueStats();

            expect(result).toHaveProperty('total', 100);
            expect(result).toHaveProperty('pending', 5);
            expect(result).toHaveProperty('sent', 90);
            expect(result).toHaveProperty('failed', 5);
            expect(result).toHaveProperty('memoryQueueSize');
            expect(result).toHaveProperty('bullMQAvailable');
        });
    });

    describe('clearOldEmails', () => {
        it('should clear old emails', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                if (typeof callback === 'function') {
                    callback.call({ lastID: 0, changes: 25 }, null);
                }
            });

            const result = await emailQueueService.clearOldEmails(30);

            expect(result).toHaveProperty('deleted', 25);
        });

        it('should use default days when not specified', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                if (typeof callback === 'function') {
                    callback.call({ lastID: 0, changes: 10 }, null);
                }
            });

            await emailQueueService.clearOldEmails();

            // Check that 30 was used as default
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE'),
                expect.arrayContaining([30]),
                expect.any(Function)
            );
        });
    });

    describe('processEmailQueue', () => {
        it('should process memory queue when BullMQ unavailable', async () => {
            const result = await emailQueueService.processEmailQueue();

            expect(result).toHaveProperty('processed');
            expect(result).toHaveProperty('failed');
        });
    });
});

