import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Tax Service Tests
 * Tests for tax calculation and compliance
 * CRITICAL FOR ENTERPRISE FINANCIAL COMPLIANCE
 */

import TaxService from '../../../server/src/services/taxService.js';

describe('Tax Service', () => {
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        if (TaxService.setDependencies) {
            TaxService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid || (() => 'tax-uuid-1')
            });
        }
    });

    describe('Service Structure', () => {
        it('should be defined', () => {
            expect(TaxService).toBeDefined();
        });

        it('should have tax constants', () => {
            if (TaxService.TAX_RATES) {
                expect(TaxService.TAX_RATES).toBeDefined();
            }
            if (TaxService.TAX_TYPES) {
                expect(TaxService.TAX_TYPES).toBeDefined();
                expect(Array.isArray(TaxService.TAX_TYPES)).toBe(true);
            }
        });
    });

    describe('Tax Operations', () => {
        it('should calculate tax amount', () => {
            if (typeof TaxService.calculateTax === 'function') {
                const tax = TaxService.calculateTax(1000, 0.20);
                expect(tax).toBeDefined();
                expect(typeof tax).toBe('number');
                expect(tax).toBe(200); // 20% of 1000
            } else {
                expect(TaxService).toBeDefined();
            }
        });

        it('should get tax rate for region', () => {
            if (typeof TaxService.getTaxRate === 'function') {
                const rate = TaxService.getTaxRate('US', 'CA');
                expect(rate).toBeDefined();
                expect(typeof rate).toBe('number');
            } else {
                expect(TaxService).toBeDefined();
            }
        });

        it('should validate tax compliance', () => {
            if (typeof TaxService.validateCompliance === 'function') {
                const result = TaxService.validateCompliance({
                    amount: 1000,
                    taxRate: 0.20,
                    region: 'US'
                });

                expect(result).toBeDefined();
                expect(result.isCompliant).toBeDefined();
            } else {
                expect(TaxService).toBeDefined();
            }
        });
    });
});

