/**
 * Economics Financials Service - Unit Tests
 * Tests for ROI, NPV, IRR, Payback Period calculations
 * 
 * Coverage: calculateFinancialMetrics, validateFinancialData, applyScenarioAdjustments
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    calculateFinancialMetrics,
    validateFinancialData,
    applyScenarioAdjustments,
    normalizeFinancialData,
    defaultFinancialData,
    type FinancialData,
} from '../../../../server/src/services/economicsFinancials';

describe('EconomicsFinancials Service', () => {
    describe('normalizeFinancialData', () => {
        it('should return default values for null input', () => {
            const result = normalizeFinancialData(null);
            expect(result).toEqual(defaultFinancialData);
        });

        it('should return default values for undefined input', () => {
            const result = normalizeFinancialData(undefined);
            expect(result).toEqual(defaultFinancialData);
        });

        it('should merge partial input with defaults', () => {
            const result = normalizeFinancialData({
                initialInvestment: 100000,
                annualCostSavings: 50000,
            });
            expect(result.initialInvestment).toBe(100000);
            expect(result.annualCostSavings).toBe(50000);
            expect(result.discountRate).toBe(defaultFinancialData.discountRate);
        });

        it('should handle non-array assumptions', () => {
            const result = normalizeFinancialData({
                assumptions: 'not an array',
            });
            expect(result.assumptions).toEqual([]);
        });

        it('should preserve valid assumptions array', () => {
            const assumptions = ['Assumption 1', 'Assumption 2'];
            const result = normalizeFinancialData({ assumptions });
            expect(result.assumptions).toEqual(assumptions);
        });
    });

    describe('calculateFinancialMetrics', () => {
        let baseData: FinancialData;

        beforeEach(() => {
            baseData = {
                initialInvestment: 100000,
                implementationCost: 50000,
                annualOperatingCost: 20000,
                trainingCost: 10000,
                contingencyPercent: 15,
                annualCostSavings: 80000,
                annualRevenueIncrease: 40000,
                productivityGainsPercent: 10,
                riskReductionValue: 10000,
                implementationMonths: 12,
                benefitRealizationMonths: 6,
                analysisHorizonYears: 5,
                discountRate: 10,
                currency: 'PLN',
                assumptions: [],
            };
        });

        it('should calculate positive NPV for profitable investment', () => {
            const result = calculateFinancialMetrics(baseData);
            expect(result.npv).toBeGreaterThan(0);
        });

        it('should calculate negative NPV for unprofitable investment', () => {
            const unprofitableData = {
                ...baseData,
                annualCostSavings: 10000,
                annualRevenueIncrease: 0,
                riskReductionValue: 0,
                productivityGainsPercent: 0,
            };
            const result = calculateFinancialMetrics(unprofitableData);
            expect(result.npv).toBeLessThan(0);
        });

        it('should calculate correct total costs', () => {
            const result = calculateFinancialMetrics(baseData);
            // Total = initial + implementation + training + contingency + (operating * years)
            const upfront = (100000 + 50000 + 10000) * 1.15; // with 15% contingency
            const operating = 20000 * 5;
            expect(result.totalCosts).toBe(upfront + operating);
        });

        it('should calculate cash flows for each year', () => {
            const result = calculateFinancialMetrics(baseData);
            expect(result.cashFlows).toHaveLength(6); // Year 0 + 5 years
            expect(result.cashFlows[0].year).toBe(0);
            expect(result.cashFlows[0].netCashFlow).toBeLessThan(0); // Initial investment is negative
        });

        it('should calculate cumulative cash flow correctly', () => {
            const result = calculateFinancialMetrics(baseData);
            let cumulative = 0;
            result.cashFlows.forEach((cf) => {
                cumulative += cf.netCashFlow;
                expect(cf.cumulativeCashFlow).toBeCloseTo(cumulative, 0);
            });
        });

        it('should calculate payback period when investment is recovered', () => {
            const result = calculateFinancialMetrics(baseData);
            expect(result.paybackPeriod).not.toBeNull();
            expect(result.paybackPeriod).toBeGreaterThan(0);
            expect(result.paybackPeriod).toBeLessThan(baseData.analysisHorizonYears);
        });

        it('should return null payback period when investment is never recovered', () => {
            const neverRecoverData = {
                ...baseData,
                annualCostSavings: 5000,
                annualRevenueIncrease: 0,
                riskReductionValue: 0,
                productivityGainsPercent: 0,
                annualOperatingCost: 50000,
            };
            const result = calculateFinancialMetrics(neverRecoverData);
            expect(result.paybackPeriod).toBeNull();
        });

        it('should calculate positive ROI for profitable investment', () => {
            const result = calculateFinancialMetrics(baseData);
            expect(result.roi).toBeGreaterThan(0);
        });

        it('should calculate IRR for valid cash flows', () => {
            const result = calculateFinancialMetrics(baseData);
            expect(result.irr).not.toBeNull();
            expect(result.irr).toBeGreaterThan(0);
        });

        it('should handle zero discount rate', () => {
            const zeroDiscountData = { ...baseData, discountRate: 0 };
            const result = calculateFinancialMetrics(zeroDiscountData);
            expect(result.npv).toBeDefined();
            expect(Number.isFinite(result.npv)).toBe(true);
        });

        it('should handle single year analysis horizon', () => {
            const singleYearData = { ...baseData, analysisHorizonYears: 1 };
            const result = calculateFinancialMetrics(singleYearData);
            expect(result.cashFlows).toHaveLength(2); // Year 0 + 1 year
        });

        it('should apply productivity gains multiplier correctly', () => {
            const noProductivityData = { ...baseData, productivityGainsPercent: 0 };
            const withProductivityData = { ...baseData, productivityGainsPercent: 20 };

            const resultNo = calculateFinancialMetrics(noProductivityData);
            const resultWith = calculateFinancialMetrics(withProductivityData);

            expect(resultWith.totalBenefits).toBeGreaterThan(resultNo.totalBenefits);
        });
    });

    describe('applyScenarioAdjustments', () => {
        let baseData: FinancialData;

        beforeEach(() => {
            baseData = {
                ...defaultFinancialData,
                annualCostSavings: 100000,
                annualRevenueIncrease: 50000,
                annualOperatingCost: 30000,
                discountRate: 10,
            };
        });

        it('should increase benefits for optimistic scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'optimistic');
            expect(result.annualCostSavings).toBe(baseData.annualCostSavings * 1.15);
            expect(result.annualRevenueIncrease).toBe(baseData.annualRevenueIncrease * 1.2);
        });

        it('should decrease operating costs for optimistic scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'optimistic');
            expect(result.annualOperatingCost).toBe(baseData.annualOperatingCost * 0.9);
        });

        it('should lower discount rate for optimistic scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'optimistic');
            expect(result.discountRate).toBe(baseData.discountRate - 1);
        });

        it('should decrease benefits for conservative scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'conservative');
            expect(result.annualCostSavings).toBe(baseData.annualCostSavings * 0.85);
            expect(result.annualRevenueIncrease).toBe(baseData.annualRevenueIncrease * 0.85);
        });

        it('should increase operating costs for conservative scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'conservative');
            expect(result.annualOperatingCost).toBe(baseData.annualOperatingCost * 1.1);
        });

        it('should increase discount rate for conservative scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'conservative');
            expect(result.discountRate).toBe(baseData.discountRate + 1);
        });

        it('should return unchanged data for unknown scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'unknown');
            expect(result.annualCostSavings).toBe(baseData.annualCostSavings);
            expect(result.annualRevenueIncrease).toBe(baseData.annualRevenueIncrease);
        });

        it('should return unchanged data for base scenario', () => {
            const result = applyScenarioAdjustments(baseData, 'base');
            expect(result).toEqual(baseData);
        });
    });

    describe('validateFinancialData', () => {
        let validData: FinancialData;

        beforeEach(() => {
            validData = {
                ...defaultFinancialData,
                initialInvestment: 100000,
                annualCostSavings: 50000,
                discountRate: 10,
                analysisHorizonYears: 5,
            };
        });

        it('should return no errors for valid data', () => {
            const result = validateFinancialData(validData);
            expect(result.errors).toHaveLength(0);
        });

        it('should report error for zero analysis horizon', () => {
            const invalidData = { ...validData, analysisHorizonYears: 0 };
            const result = validateFinancialData(invalidData);
            expect(result.errors.some((e) => e.includes('analysis_horizon_years'))).toBe(true);
        });

        it('should report error for negative analysis horizon', () => {
            const invalidData = { ...validData, analysisHorizonYears: -1 };
            const result = validateFinancialData(invalidData);
            expect(result.errors.some((e) => e.includes('analysis_horizon_years'))).toBe(true);
        });

        it('should report error for discount rate over 100', () => {
            const invalidData = { ...validData, discountRate: 150 };
            const result = validateFinancialData(invalidData);
            expect(result.errors.some((e) => e.includes('discount_rate'))).toBe(true);
        });

        it('should report error for negative discount rate', () => {
            const invalidData = { ...validData, discountRate: -5 };
            const result = validateFinancialData(invalidData);
            expect(result.errors.some((e) => e.includes('discount_rate'))).toBe(true);
        });

        it('should report error for negative investment values', () => {
            const invalidData = { ...validData, initialInvestment: -10000 };
            const result = validateFinancialData(invalidData);
            expect(result.errors.some((e) => e.includes('initial_investment'))).toBe(true);
        });

        it('should warn when no annual benefits defined', () => {
            const noBenefitsData = {
                ...validData,
                annualCostSavings: 0,
                annualRevenueIncrease: 0,
                riskReductionValue: 0,
            };
            const result = validateFinancialData(noBenefitsData);
            expect(result.warnings.some((w) => w.includes('No annual benefits'))).toBe(true);
        });

        it('should warn when benefits are less than operating costs', () => {
            const lowBenefitsData = {
                ...validData,
                annualCostSavings: 10000,
                annualOperatingCost: 50000,
                annualRevenueIncrease: 0,
                riskReductionValue: 0,
            };
            const result = validateFinancialData(lowBenefitsData);
            expect(result.warnings.some((w) => w.includes('cashflow may stay negative'))).toBe(true);
        });

        it('should warn when implementation time exceeds horizon', () => {
            const longImplData = {
                ...validData,
                implementationMonths: 100,
                analysisHorizonYears: 5,
            };
            const result = validateFinancialData(longImplData);
            expect(result.warnings.some((w) => w.includes('exceeds the analysis horizon'))).toBe(true);
        });

        it('should recommend approval for complete valid data', () => {
            const result = validateFinancialData(validData);
            expect(result.recommendations.some((r) => r.includes('Consider approving'))).toBe(true);
        });

        it('should recommend complete inputs when data is incomplete', () => {
            const incompleteData = {
                ...validData,
                initialInvestment: 0,
                annualCostSavings: 0,
            };
            const result = validateFinancialData(incompleteData);
            expect(result.recommendations.some((r) => r.includes('complete cost and benefit'))).toBe(true);
        });
    });
});
