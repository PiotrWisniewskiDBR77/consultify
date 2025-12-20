/**
 * Promo Code Service Unit Tests
 * 
 * Tests for promo code validation, usage tracking, and management functions.
 */

import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';

// Create mock database object
const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
    serialize: vi.fn((fn) => fn())
};

// Mock the database module before any imports
vi.mock('../../../server/database', () => ({
    default: mockDb,
    __esModule: true
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-uuid-1234')
}));

// Import after mocks are set up
const PromoCodeService = await vi.importActual('../../../server/services/promoCodeService');
const promoService = PromoCodeService.default || PromoCodeService;

describe('PromoCodeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constants', () => {
        it('should export PROMO_TYPES', () => {
            expect(PromoCodeService.PROMO_TYPES).toEqual({
                DISCOUNT: 'DISCOUNT',
                PARTNER: 'PARTNER',
                CAMPAIGN: 'CAMPAIGN'
            });
        });

        it('should export DISCOUNT_TYPES', () => {
            expect(PromoCodeService.DISCOUNT_TYPES).toEqual({
                PERCENT: 'PERCENT',
                FIXED: 'FIXED',
                NONE: 'NONE'
            });
        });
    });

    describe('validatePromoCode', () => {
        it('should return invalid for empty code', async () => {
            const result = await PromoCodeService.validatePromoCode('');
            expect(result).toEqual({ valid: false, reason: 'Invalid promo code format' });
        });

        it('should return invalid for null code', async () => {
            const result = await PromoCodeService.validatePromoCode(null);
            expect(result).toEqual({ valid: false, reason: 'Invalid promo code format' });
        });

        it('should return invalid when code not found', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await PromoCodeService.validatePromoCode('INVALID');
            expect(result).toEqual({ valid: false, reason: 'Promo code not found' });
        });

        it('should return invalid for expired code', async () => {
            const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'code-1',
                    code: 'EXPIRED',
                    type: 'DISCOUNT',
                    is_active: 1,
                    valid_from: '2020-01-01',
                    valid_until: pastDate,
                    max_uses: 100,
                    used_count: 0,
                    metadata: '{}'
                });
            });

            const result = await PromoCodeService.validatePromoCode('EXPIRED');
            expect(result).toEqual({ valid: false, reason: 'Promo code has expired' });
        });

        it('should return invalid for code not yet active', async () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'code-1',
                    code: 'FUTURE',
                    type: 'DISCOUNT',
                    is_active: 1,
                    valid_from: futureDate,
                    valid_until: null,
                    max_uses: 100,
                    used_count: 0,
                    metadata: '{}'
                });
            });

            const result = await PromoCodeService.validatePromoCode('FUTURE');
            expect(result).toEqual({ valid: false, reason: 'Promo code is not yet active' });
        });

        it('should return invalid when usage limit reached', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'code-1',
                    code: 'LIMITED',
                    type: 'DISCOUNT',
                    is_active: 1,
                    valid_from: '2020-01-01',
                    valid_until: null,
                    max_uses: 10,
                    used_count: 10,
                    metadata: '{}'
                });
            });

            const result = await PromoCodeService.validatePromoCode('LIMITED');
            expect(result).toEqual({ valid: false, reason: 'Promo code usage limit reached' });
        });

        it('should return valid for good code with discount', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'code-1',
                    code: 'SAVE20',
                    type: 'DISCOUNT',
                    discount_type: 'PERCENT',
                    discount_value: 20,
                    is_active: 1,
                    valid_from: '2020-01-01',
                    valid_until: null,
                    max_uses: 100,
                    used_count: 5,
                    metadata: '{}'
                });
            });

            const result = await PromoCodeService.validatePromoCode('SAVE20');
            expect(result.valid).toBe(true);
            expect(result.code).toBe('SAVE20');
            expect(result.type).toBe('DISCOUNT');
            expect(result.discountType).toBe('PERCENT');
            expect(result.discountValue).toBe(20);
            expect(result.discountMessage).toBe('-20%');
        });

        it('should return valid for partner code without discount', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'code-1',
                    code: 'PARTNER123',
                    type: 'PARTNER',
                    discount_type: 'NONE',
                    discount_value: null,
                    is_active: 1,
                    valid_from: '2020-01-01',
                    valid_until: null,
                    max_uses: null,
                    used_count: 0,
                    metadata: '{}'
                });
            });

            const result = await PromoCodeService.validatePromoCode('partner123'); // case-insensitive
            expect(result.valid).toBe(true);
            expect(result.code).toBe('PARTNER123');
            expect(result.type).toBe('PARTNER');
            expect(result.partnerCode).toBe('PARTNER123');
            expect(result.discountMessage).toBeUndefined();
        });
    });

    describe('markPromoCodeUsed', () => {
        it('should return error for already used org code', async () => {
            // Mock validatePromoCode to return valid
            db.get.mockImplementation((query, params, callback) => {
                // First call is for validation
                if (query.includes('promo_codes')) {
                    callback(null, {
                        id: 'code-1',
                        code: 'USED',
                        type: 'DISCOUNT',
                        is_active: 1,
                        valid_from: '2020-01-01',
                        valid_until: null,
                        max_uses: null,
                        used_count: 0,
                        metadata: '{}'
                    });
                }
                // Second call checks if already used by org
                if (query.includes('promo_code_usage')) {
                    callback(null, { id: 'usage-1' }); // Already used
                }
            });

            const result = await PromoCodeService.markPromoCodeUsed('USED', 'org-1', 'user-1');
            expect(result.success).toBe(false);
            expect(result.reason).toBe('Promo code already used by this organization');
        });
    });

    describe('createPromoCode', () => {
        it('should throw error for missing required fields', async () => {
            await expect(PromoCodeService.createPromoCode({}))
                .rejects.toThrow('Code, type, and validFrom are required');
        });

        it('should throw error for invalid promo type', async () => {
            await expect(PromoCodeService.createPromoCode({
                code: 'TEST',
                type: 'INVALID',
                validFrom: '2024-01-01'
            })).rejects.toThrow('Invalid promo type: INVALID');
        });

        it('should throw error for invalid discount type', async () => {
            await expect(PromoCodeService.createPromoCode({
                code: 'TEST',
                type: 'DISCOUNT',
                discountType: 'INVALID',
                validFrom: '2024-01-01'
            })).rejects.toThrow('Invalid discount type: INVALID');
        });

        it('should create promo code successfully', async () => {
            db.run.mockImplementation(function (query, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const result = await PromoCodeService.createPromoCode({
                code: 'newcode',
                type: 'PARTNER',
                validFrom: '2024-01-01',
                createdByUserId: 'user-1'
            });

            expect(result.id).toBe('test-uuid-1234');
            expect(result.code).toBe('NEWCODE'); // Uppercased
            expect(result.type).toBe('PARTNER');
            expect(result.isActive).toBe(true);
        });
    });

    describe('listPromoCodes', () => {
        it('should return list of promo codes', async () => {
            db.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'code-1',
                        code: 'CODE1',
                        type: 'DISCOUNT',
                        discount_type: 'PERCENT',
                        discount_value: 10,
                        valid_from: '2024-01-01',
                        valid_until: null,
                        max_uses: null,
                        used_count: 5,
                        is_active: 1,
                        created_by_user_id: 'user-1',
                        metadata: '{}',
                        created_at: '2024-01-01'
                    }
                ]);
            });

            const result = await PromoCodeService.listPromoCodes();
            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('CODE1');
            expect(result[0].isActive).toBe(true);
        });
    });

    describe('deactivatePromoCode', () => {
        it('should deactivate promo code', async () => {
            db.run.mockImplementation(function (query, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const result = await PromoCodeService.deactivatePromoCode('code-1');
            expect(result.success).toBe(true);
        });

        it('should return false if code not found', async () => {
            db.run.mockImplementation(function (query, params, callback) {
                callback.call({ changes: 0 }, null);
            });

            const result = await PromoCodeService.deactivatePromoCode('not-found');
            expect(result.success).toBe(false);
        });
    });
});
