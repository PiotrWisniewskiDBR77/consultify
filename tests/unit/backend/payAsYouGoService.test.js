/**
 * Pay-as-You-Go Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testOrganizations } from '../../fixtures/testData.js';
import PayAsYouGoService from '../../../server/services/payAsYouGoService.js';

describe('PayAsYouGoService', () => {
    let mockDb;
    let mockUuid;

    beforeEach(() => {
        mockDb = createMockDb();
        let counter = 0;
        mockUuid = () => {
            counter++;
            return counter.toString();
        };

        PayAsYouGoService.setDependencies({
            db: mockDb,
            uuidv4: mockUuid
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('recordUsage()', () => {
        it('should record usage for PAYG billing', async () => {
            const orgId = testOrganizations.org1.id;
            const usageType = 'tokens';
            const quantity = 1000;
            const unitPrice = 0.000039;

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO pay_as_you_go_usage');
                expect(params[0]).toBe('payg-1');
                expect(params[1]).toBe(orgId);
                expect(params[4]).toBe(usageType);
                expect(params[5]).toBe(quantity);
                expect(params[6]).toBe(unitPrice);
                callback.call({ changes: 1 }, null);
            });

            const result = await PayAsYouGoService.recordUsage(orgId, usageType, quantity, unitPrice);
            expect(result).toBeDefined();
        });

        it('should reject invalid usage types', async () => {
            await expect(PayAsYouGoService.recordUsage('org1', 'invalid', 100, 1.0))
                .rejects.toThrow('Invalid usage type: invalid');
        });
    });

    describe('calculateUsageCost()', () => {
        it('should return 0 cost for subscription model', async () => {
            const orgId = 'org1';
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('organization_seats')) {
                    callback(null, { billing_model: 'subscription' });
                }
            });

            const result = await PayAsYouGoService.calculateUsageCost(orgId, 'tokens', 1000);
            expect(result.cost).toBe(0);
            expect(result.reason).toBe('Subscription model - no PAYG cost');
        });

        it('should calculate token cost for PAYG model', async () => {
            const orgId = 'org1';
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('organization_seats')) {
                    callback(null, { billing_model: 'pay_as_you_go' });
                } else if (query.includes('billing_margins')) {
                    callback(null, { base_cost_per_1k: 0.03, margin_percent: 30 });
                }
            });

            const result = await PayAsYouGoService.calculateUsageCost(orgId, 'tokens', 1000);
            // (0.03 * 1.3) / 1000 = 0.000039 per token
            // 1000 * 0.000039 = 0.039
            expect(result.cost).toBeCloseTo(0.039);
            expect(result.unitPrice).toBeCloseTo(0.000039);
        });
    });

    describe('generatePayAsYouGoInvoice()', () => {
        it('should return reason if no usage to invoice', async () => {
            const orgId = 'org1';
            const start = new Date();
            const end = new Date();

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []); // No usage records
            });

            const result = await PayAsYouGoService.generatePayAsYouGoInvoice(orgId, start, end);
            expect(result.invoiced).toBe(false);
            expect(result.reason).toBe('No usage to invoice');
        });
    });
});
