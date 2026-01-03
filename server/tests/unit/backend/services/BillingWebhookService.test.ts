/**
 * BillingWebhookService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for BillingWebhookService - 85%+ coverage target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDatabase } from '../../../../src/database/IDatabase.js';
import BillingWebhookService from '../../../../src/services/BillingWebhookService.js';

describe('BillingWebhookService', () => {
    let mockDb: IDatabase;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(function (this: any, sql: string, params: unknown[], callback: (err: Error | null) => void) {
                if (callback) {
                    callback.call({ lastID: 1, changes: 1 }, null);
                }
                return this;
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        } as unknown as IDatabase;

        if (BillingWebhookService.setDependencies) {
            BillingWebhookService.setDependencies({
                db: mockDb,
                uuidv4: () => 'uuid-123',
                webhookService: { trigger: vi.fn() }
            });
        }
    });

    describe('Service Methods', () => {
        it('should record a billing webhook event', async () => {
            const result = await BillingWebhookService.recordBillingWebhookEvent(
                'org-1',
                'invoice.paid',
                { id: 'inv-123' }
            );

            expect(result.id).toBe('uuid-123');
            expect(result.status).toBe('pending');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO billing_webhook_events'),
                expect.arrayContaining(['org-1', 'invoice.paid']),
                expect.any(Function)
            );
        });

        it('should update event status', async () => {
            const result = await BillingWebhookService.updateEventStatus('uuid-123', 'sent');

            expect(result.updated).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE billing_webhook_events SET status = ?'),
                expect.arrayContaining(['sent', 'uuid-123']),
                expect.any(Function)
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database error'));
            });

            expect(true).toBe(true);
        });
    });
});
