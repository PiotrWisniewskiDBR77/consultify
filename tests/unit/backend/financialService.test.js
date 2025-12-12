import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const FinancialService = require('../../../server/services/financialService.js');

describe('Backend Service Test: FinancialService', () => {
    describe('estimateCost', () => {
        it('returns correct cost for High complexity', () => {
            const result = FinancialService.estimateCost('High');
            expect(result.cost).toBe(75000);
            expect(result.costRange).toBe('High (>$50k)');
        });

        it('returns correct cost for Medium complexity', () => {
            const result = FinancialService.estimateCost('Medium');
            expect(result.cost).toBe(25000);
            expect(result.costRange).toBe('Medium ($10k-$50k)');
        });

        it('returns correct cost for Low complexity', () => {
            const result = FinancialService.estimateCost('Low');
            expect(result.cost).toBe(5000);
            expect(result.costRange).toBe('Low (<$10k)');
        });
    });

    describe('estimateBenefit', () => {
        it('calculates benefit for High priority', () => {
            const result = FinancialService.estimateBenefit('High', 10000);
            expect(result.benefit).toBe(25000);
            expect(result.benefitRange).toBe('Medium ($20k-$100k/yr)');
        });

        it('calculates benefit for Medium priority', () => {
            const result = FinancialService.estimateBenefit('Medium', 10000);
            expect(result.benefit).toBe(15000);
            expect(result.benefitRange).toBe('Low (<$20k/yr)');
        });

        it('calculates benefit for Low priority', () => {
            const result = FinancialService.estimateBenefit('Low', 10000);
            expect(result.benefit).toBe(12000);
            expect(result.benefitRange).toBe('Low (<$20k/yr)');
        });

        it('returns High benefit range for large benefits', () => {
            const result = FinancialService.estimateBenefit('High', 50000);
            expect(result.benefit).toBe(125000);
            expect(result.benefitRange).toBe('High (>$100k/yr)');
        });
    });

    describe('simulatePortfolio', () => {
        it('calculates portfolio economics correctly', () => {
            const initiatives = [
                { complexity: 'High', priority: 'High' },
                { complexity: 'Medium', priority: 'Medium' },
            ];

            const result = FinancialService.simulatePortfolio(initiatives);

            expect(result.totalCapex).toBe(100000); // 75000 + 25000
            expect(result.annualOpex).toBe(15000); // 100000 * 0.15
            expect(result.annualBenefit).toBeGreaterThan(0);
            expect(result.roi).toBeGreaterThan(0);
            expect(result.paybackPeriodMonths).toBeGreaterThan(0);
            expect(result.initiatives).toHaveLength(2);
        });

        it('handles empty portfolio', () => {
            const result = FinancialService.simulatePortfolio([]);
            
            expect(result.totalCapex).toBe(0);
            expect(result.annualBenefit).toBe(0);
            expect(result.roi).toBe(0);
            expect(result.initiatives).toHaveLength(0);
        });

        it('uses custom revenue base', () => {
            const initiatives = [{ complexity: 'Low', priority: 'Low' }];
            const result = FinancialService.simulatePortfolio(initiatives, 5000000);
            
            expect(result.efficiencyGains).toBeGreaterThan(0);
        });
    });
});

