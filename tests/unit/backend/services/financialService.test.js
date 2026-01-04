/**
 * Financial Service Tests
 *
 * Tests for financial calculations, cost estimation, and portfolio simulation.
 * Critical business logic for initiative valuation and ROI calculations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';

// Remove createRequire - using ESM imports

let financialService;

describe('FinancialService', () => {
    let mockDb;
    let mockLogger;

    beforeEach(async () => {
        // Use unified mock setup
        const { mocks } = setupStandardTest();
        mockDb = mocks.db;
        mockLogger = mocks.logger;

        // Import service using dynamic import
        const module = await import('../../../../server/src/services/financialService.js');
        financialService = module.default;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('estimateCost()', () => {
        it('should estimate low cost for low complexity initiatives', () => {
            const result = financialService.estimateCost('Low');

            expect(result.cost).toBe(5000);
            expect(result.costRange).toBe('Low (<$10k)');
        });

        it('should estimate medium cost for medium complexity initiatives', () => {
            const result = financialService.estimateCost('Medium');

            expect(result.cost).toBe(25000);
            expect(result.costRange).toBe('Medium ($10k-$50k)');
        });

        it('should estimate high cost for high complexity initiatives', () => {
            const result = financialService.estimateCost('High');

            expect(result.cost).toBe(75000);
            expect(result.costRange).toBe('High (>$50k)');
        });

        it('should default to low cost for unknown complexity', () => {
            const result = financialService.estimateCost('Unknown');

            expect(result.cost).toBe(5000);
            expect(result.costRange).toBe('Low (<$10k)');
        });
    });

    describe('estimateBenefit()', () => {
        it('should estimate low benefit for low priority initiatives', () => {
            const result = financialService.estimateBenefit('Low', 10000);

            expect(result.benefit).toBe(12000); // 10000 * 1.2
            expect(result.benefitRange).toBe('Low (<$20k/yr)');
        });

        it('should estimate medium benefit for medium priority initiatives', () => {
            const result = financialService.estimateBenefit('Medium', 10000);

            expect(result.benefit).toBe(15000); // 10000 * 1.5
            expect(result.benefitRange).toBe('Low (<$20k/yr)');
        });

        it('should estimate high benefit for high priority initiatives', () => {
            const result = financialService.estimateBenefit('High', 10000);

            expect(result.benefit).toBe(25000); // 10000 * 2.5
            expect(result.benefitRange).toBe('Medium ($20k-$100k/yr)');
        });

        it('should classify benefits correctly by range', () => {
            // Low range (< $20k)
            expect(financialService.estimateBenefit('Low', 10000).benefitRange)
                .toBe('Low (<$20k/yr)');

            // Medium range ($20k - $100k)
            expect(financialService.estimateBenefit('High', 5000).benefitRange)
                .toBe('Low (<$20k/yr)'); // 12500 < 20000

            expect(financialService.estimateBenefit('High', 20000).benefitRange)
                .toBe('Medium ($20k-$100k/yr)'); // 50000

            // High range (> $100k)
            expect(financialService.estimateBenefit('High', 100000).benefitRange)
                .toBe('High (>$100k/yr)'); // 250000
        });

        it('should default to low priority for unknown priority', () => {
            const result = financialService.estimateBenefit('Unknown', 10000);

            expect(result.benefit).toBe(12000); // 10000 * 1.2 (low priority multiplier)
        });
    });

    describe('simulatePortfolio()', () => {
        const sampleInitiatives = [
            { name: 'Initiative 1', complexity: 'Low', priority: 'Medium' },
            { name: 'Initiative 2', complexity: 'High', priority: 'High' },
            { name: 'Initiative 3', complexity: 'Medium', priority: 'Low' }
        ];

        it('should simulate portfolio with multiple initiatives', () => {
            const result = financialService.simulatePortfolio(sampleInitiatives);

            expect(result.totalCapex).toBe(5000 + 75000 + 25000); // 105000
            expect(result.annualBenefit).toBeGreaterThan(0);
            expect(result.roi).toBeGreaterThan(0);
            expect(result.paybackPeriodMonths).toBeGreaterThan(0);
            expect(result.initiatives).toHaveLength(3);
        });

        it('should calculate ROI correctly', () => {
            const simpleInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            const result = financialService.simulatePortfolio(simpleInitiative);

            // Low complexity = $5000 cost, Low priority = $6000 benefit (5000 * 1.2)
            // ROI = (6000 / 5000) * 100 = 120%
            expect(result.roi).toBe(120);
        });

        it('should calculate payback period correctly', () => {
            const simpleInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            const result = financialService.simulatePortfolio(simpleInitiative);

            // Payback = cost / annual benefit = 5000 / 6000 = 0.833 years = ~10 months
            expect(result.paybackPeriodMonths).toBeCloseTo(10, 0);
        });

        it('should calculate efficiency gains correctly', () => {
            const simpleInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            const result = financialService.simulatePortfolio(simpleInitiative, 100000); // $100k revenue base

            // Efficiency gains = (benefit / revenue) * 100 = (6000 / 100000) * 100 = 6%
            expect(result.efficiencyGains).toBe(6);
        });

        it('should calculate annual Opex as 15% of Capex', () => {
            const simpleInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            const result = financialService.simulatePortfolio(simpleInitiative);

            expect(result.annualOpex).toBe(5000 * 0.15); // 750
        });

        it('should enrich initiatives with cost and benefit details', () => {
            const simpleInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            const result = financialService.simulatePortfolio(simpleInitiative);

            expect(result.initiatives[0]).toHaveProperty('estimatedCost', 5000);
            expect(result.initiatives[0]).toHaveProperty('costRange', 'Low (<$10k)');
            expect(result.initiatives[0]).toHaveProperty('estimatedAnnualBenefit', 6000);
            expect(result.initiatives[0]).toHaveProperty('benefitRange', 'Low (<$20k/yr)');
        });

        it('should handle empty portfolio', () => {
            const result = financialService.simulatePortfolio([]);

            expect(result.totalCapex).toBe(0);
            expect(result.annualBenefit).toBe(0);
            expect(result.roi).toBe(0);
            expect(result.paybackPeriodMonths).toBe(0);
            expect(result.initiatives).toHaveLength(0);
        });

        it('should handle custom revenue base', () => {
            const simpleInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            const result = financialService.simulatePortfolio(simpleInitiative, 5000000); // $5M revenue

            // Efficiency gains = (6000 / 5000000) * 100 = 0.12%
            expect(result.efficiencyGains).toBe(0.12);
        });

        it('should handle zero benefit initiatives gracefully', () => {
            // Create initiative with negative cost (loss) to test ROI = 0 protection
            const zeroBenefitInitiative = [{ name: 'Test', complexity: 'Low', priority: 'Low' }];
            // Mock the estimateBenefit to return zero benefit
            const originalEstimateBenefit = financialService.estimateBenefit;
            financialService.estimateBenefit = () => ({ benefit: 0, benefitRange: 'Low (<$20k/yr)' });

            const result = financialService.simulatePortfolio(zeroBenefitInitiative);

            // Restore original function
            financialService.estimateBenefit = originalEstimateBenefit;

            expect(result.roi).toBe(0); // Division by zero protection when benefit = 0
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete business case simulation', () => {
            const businessCase = [
                { name: 'Digital Transformation', complexity: 'High', priority: 'High' },
                { name: 'Process Optimization', complexity: 'Medium', priority: 'Medium' },
                { name: 'Training Program', complexity: 'Low', priority: 'Low' }
            ];

            const result = financialService.simulatePortfolio(businessCase, 10000000); // $10M revenue base

            // Verify all calculations are reasonable
            expect(result.totalCapex).toBeGreaterThan(0);
            expect(result.annualBenefit).toBeGreaterThan(result.totalCapex);
            expect(result.roi).toBeGreaterThan(100); // Profitable
            expect(result.paybackPeriodMonths).toBeLessThan(24); // Payback within 2 years
            expect(result.efficiencyGains).toBeGreaterThan(0);
            expect(result.efficiencyGains).toBeLessThan(10); // Reasonable percentage

            // Verify initiative details
            result.initiatives.forEach(initiative => {
                expect(initiative).toHaveProperty('estimatedCost');
                expect(initiative).toHaveProperty('estimatedAnnualBenefit');
                expect(initiative).toHaveProperty('costRange');
                expect(initiative).toHaveProperty('benefitRange');
            });
        });

        it('should handle high-risk high-reward scenarios', () => {
            const highRiskInitiative = [
                { name: 'High Risk Project', complexity: 'High', priority: 'High' }
            ];

            const result = financialService.simulatePortfolio(highRiskInitiative);

            // High complexity ($75k) + High priority (2.5x multiplier) = $187.5k benefit
            expect(result.totalCapex).toBe(75000);
            expect(result.annualBenefit).toBe(187500); // 75000 * 2.5
            expect(result.roi).toBe(250); // 250%
            expect(result.paybackPeriodMonths).toBeCloseTo(4.8, 1); // ~4.8 months
        });
    });
});
