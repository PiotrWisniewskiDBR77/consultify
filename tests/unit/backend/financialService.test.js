import { describe, it, expect } from 'vitest';
import FinancialService from '../../../server/services/financialService.js';

describe('FinancialService', () => {
    describe('estimateCost', () => {
        it('should estimate cost for High complexity', () => {
            const result = FinancialService.estimateCost('High');
            expect(result.cost).toBe(75000);
            expect(result.costRange).toBe('High (>$50k)');
        });

        it('should estimate cost for Medium complexity', () => {
            const result = FinancialService.estimateCost('Medium');
            expect(result.cost).toBe(25000);
        });

        it('should fallback to Low complexity', () => {
            const result = FinancialService.estimateCost('Low');
            expect(result.cost).toBe(5000);
        });
    });

    describe('estimateBenefit', () => {
        it('should estimate benefit for High priority', () => {
            const result = FinancialService.estimateBenefit('High', 1000);
            expect(result.benefit).toBe(2500); // 1000 * 2.5
        });

        it('should estimate benefit for Medium priority', () => {
            const result = FinancialService.estimateBenefit('Medium', 1000);
            expect(result.benefit).toBe(1500); // 1000 * 1.5
        });

        it('should fallback to Low priority', () => {
            const result = FinancialService.estimateBenefit('Low', 1000);
            expect(result.benefit).toBe(1200); // 1000 * 1.2
        });

        it('should return correct benefit range', () => {
            const resultLow = FinancialService.estimateBenefit('Low', 1000);
            expect(resultLow.benefitRange).toBe('Low (<$20k/yr)');

            const resultHigh = FinancialService.estimateBenefit('High', 50000); // 125000
            expect(resultHigh.benefitRange).toContain('High');
        });
    });

    describe('simulatePortfolio', () => {
        it('should calculate aggregated metrics', () => {
            const initiatives = [
                { complexity: 'High', priority: 'High' }, // Cost: 75000, Benefit: 187500
                { complexity: 'Low', priority: 'Low' }    // Cost: 5000, Benefit: 6000
            ];

            const result = FinancialService.simulatePortfolio(initiatives);

            expect(result.totalCapex).toBe(80000);
            expect(result.annualBenefit).toBe(193500);
            expect(result.annualOpex).toBe(12000); // 15% of 80000
            expect(result.roi).toBeGreaterThan(0);
        });

        it('should handle empty portfolio', () => {
            const result = FinancialService.simulatePortfolio([]);

            expect(result.totalCapex).toBe(0);
            expect(result.efficiencyGains).toBe(0);
        });
    });
});
