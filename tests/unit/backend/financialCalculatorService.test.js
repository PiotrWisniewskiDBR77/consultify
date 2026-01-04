/**
 * Financial Calculator Service Tests
 * 
 * Unit tests for NPV, IRR, Payback Period, ROI, and Sensitivity Analysis
 */

import { describe, it, expect } from 'vitest';
// Removed createRequire - using ESM imports

let FinancialCalculatorService;

// Dynamic import in beforeEach to ensure proper module loading
beforeEach(async () => {
    const module = await import('../../../server/src/services/financialCalculatorService.js');
    FinancialCalculatorService = module.default || module;
});

describe('FinancialCalculatorService', () => {
    describe('calculateNPV', () => {
        it('should calculate NPV correctly for positive cash flows', () => {
            const cashFlows = [
                { year: 0, amount: -100000 },
                { year: 1, amount: 40000 },
                { year: 2, amount: 40000 },
                { year: 3, amount: 40000 }
            ];
            const discountRate = 0.10;
            
            const npv = FinancialCalculatorService.calculateNPV(cashFlows, discountRate);
            
            // Expected: -100000 + 40000/1.1 + 40000/1.21 + 40000/1.331 ≈ -554
            expect(npv).toBeCloseTo(-553.66, 0);
        });

        it('should return positive NPV for profitable investment', () => {
            const cashFlows = [
                { year: 0, amount: -100000 },
                { year: 1, amount: 50000 },
                { year: 2, amount: 50000 },
                { year: 3, amount: 50000 }
            ];
            const discountRate = 0.10;
            
            const npv = FinancialCalculatorService.calculateNPV(cashFlows, discountRate);
            
            expect(npv).toBeGreaterThan(0);
        });

        it('should return 0 for empty cash flows', () => {
            const npv = FinancialCalculatorService.calculateNPV([], 0.10);
            expect(npv).toBe(0);
        });

        it('should handle zero discount rate', () => {
            const cashFlows = [
                { year: 0, amount: -100 },
                { year: 1, amount: 50 },
                { year: 2, amount: 50 }
            ];
            
            const npv = FinancialCalculatorService.calculateNPV(cashFlows, 0);
            
            // With 0% discount, NPV = sum of cash flows = 0
            expect(npv).toBe(0);
        });

        it('should handle null/undefined input', () => {
            expect(FinancialCalculatorService.calculateNPV(null, 0.10)).toBe(0);
            expect(FinancialCalculatorService.calculateNPV(undefined, 0.10)).toBe(0);
        });
    });

    describe('calculateIRR', () => {
        it('should calculate IRR for standard investment', () => {
            const cashFlows = [
                { year: 0, amount: -100000 },
                { year: 1, amount: 30000 },
                { year: 2, amount: 40000 },
                { year: 3, amount: 50000 }
            ];
            
            const irr = FinancialCalculatorService.calculateIRR(cashFlows);
            
            // Expected IRR around 8.9%
            expect(irr).toBeGreaterThan(0);
            expect(irr).toBeLessThan(0.15);
        });

        it('should return null for less than 2 cash flows', () => {
            expect(FinancialCalculatorService.calculateIRR([{ year: 0, amount: -100 }])).toBeNull();
            expect(FinancialCalculatorService.calculateIRR([])).toBeNull();
        });

        it('should find IRR where NPV = 0', () => {
            const cashFlows = [
                { year: 0, amount: -1000 },
                { year: 1, amount: 500 },
                { year: 2, amount: 500 },
                { year: 3, amount: 500 }
            ];
            
            const irr = FinancialCalculatorService.calculateIRR(cashFlows);
            
            if (irr !== null) {
                // Verify that NPV at IRR is approximately 0
                const npvAtIrr = FinancialCalculatorService.calculateNPV(cashFlows, irr);
                expect(Math.abs(npvAtIrr)).toBeLessThan(1);
            }
        });

        it('should handle high return investments', () => {
            const cashFlows = [
                { year: 0, amount: -100 },
                { year: 1, amount: 200 }
            ];
            
            const irr = FinancialCalculatorService.calculateIRR(cashFlows);
            
            // Should be around 100%
            expect(irr).toBeCloseTo(1.0, 1);
        });
    });

    describe('calculatePaybackPeriod', () => {
        it('should calculate payback period correctly', () => {
            const cashFlows = [
                { year: 0, amount: -100000 },
                { year: 1, amount: 30000 },
                { year: 2, amount: 40000 },
                { year: 3, amount: 50000 }
            ];
            
            const payback = FinancialCalculatorService.calculatePaybackPeriod(cashFlows);
            
            // Cumulative: Y0=-100k, Y1=-70k, Y2=-30k, Y3=+20k
            // Payback happens in year 3 at: 2 + 30000/50000 = 2.6 years
            expect(payback).toBeCloseTo(2.6, 1);
        });

        it('should return exact year when paid back exactly', () => {
            const cashFlows = [
                { year: 0, amount: -100 },
                { year: 1, amount: 100 }
            ];
            
            const payback = FinancialCalculatorService.calculatePaybackPeriod(cashFlows);
            
            expect(payback).toBe(1);
        });

        it('should return null when investment never pays back', () => {
            const cashFlows = [
                { year: 0, amount: -100000 },
                { year: 1, amount: 10000 },
                { year: 2, amount: 10000 }
            ];
            
            const payback = FinancialCalculatorService.calculatePaybackPeriod(cashFlows);
            
            expect(payback).toBeNull();
        });

        it('should return null for empty cash flows', () => {
            expect(FinancialCalculatorService.calculatePaybackPeriod([])).toBeNull();
            expect(FinancialCalculatorService.calculatePaybackPeriod(null)).toBeNull();
        });
    });

    describe('calculateROI', () => {
        it('should calculate ROI correctly', () => {
            const totalBenefits = 150000;
            const totalCosts = 100000;
            
            const roi = FinancialCalculatorService.calculateROI(totalBenefits, totalCosts);
            
            // ROI = (150000 - 100000) / 100000 = 0.5 (50%)
            expect(roi).toBe(0.5);
        });

        it('should return negative ROI for unprofitable investment', () => {
            const roi = FinancialCalculatorService.calculateROI(80000, 100000);
            
            expect(roi).toBe(-0.2);
        });

        it('should return null when costs are zero', () => {
            const roi = FinancialCalculatorService.calculateROI(50000, 0);
            
            expect(roi).toBeNull();
        });

        it('should return 0 when benefits equal costs', () => {
            const roi = FinancialCalculatorService.calculateROI(100000, 100000);
            
            expect(roi).toBe(0);
        });
    });

    describe('performSensitivityAnalysis', () => {
        it('should calculate NPV for different variable values', () => {
            const baseCashFlows = [
                { year: 0, amount: -100000 },
                { year: 1, amount: 50000 },
                { year: 2, amount: 50000 }
            ];
            const discountRate = 0.10;
            
            // Function to calculate NPV with modified investment
            const npvCalculationFunction = (investmentMultiplier) => {
                const modifiedCashFlows = baseCashFlows.map((cf, i) => 
                    i === 0 ? { ...cf, amount: cf.amount * investmentMultiplier } : cf
                );
                return FinancialCalculatorService.calculateNPV(modifiedCashFlows, discountRate);
            };
            
            const baseValue = 1;
            const sensitivityRange = [-0.2, -0.1, 0, 0.1, 0.2];
            
            const results = FinancialCalculatorService.performSensitivityAnalysis(
                npvCalculationFunction,
                baseValue,
                sensitivityRange
            );
            
            expect(results).toHaveLength(5);
            expect(results[2].change).toBe(0);
            expect(results[2].variableValue).toBe(1);
            
            // Higher investment (more negative) should result in lower NPV
            expect(results[4].npv).toBeLessThan(results[0].npv);
        });

        it('should return correct structure for each data point', () => {
            const npvFunction = (x) => 100 - x * 10;
            const results = FinancialCalculatorService.performSensitivityAnalysis(
                npvFunction,
                10,
                [-0.1, 0, 0.1]
            );
            
            expect(results[0]).toHaveProperty('change');
            expect(results[0]).toHaveProperty('variableValue');
            expect(results[0]).toHaveProperty('npv');
        });
    });

    describe('Integration Scenarios', () => {
        it('should correctly evaluate a real-world investment scenario', () => {
            // Scenario: 5-year project with initial investment and annual returns
            const initialInvestment = 500000;
            const annualBenefit = 150000;
            const annualCost = 20000;
            const discountRate = 0.12;
            const horizon = 5;
            
            // Build cash flows
            const cashFlows = [{ year: 0, amount: -initialInvestment }];
            for (let year = 1; year <= horizon; year++) {
                cashFlows.push({ year, amount: annualBenefit - annualCost });
            }
            
            const npv = FinancialCalculatorService.calculateNPV(cashFlows, discountRate);
            const irr = FinancialCalculatorService.calculateIRR(cashFlows);
            const payback = FinancialCalculatorService.calculatePaybackPeriod(cashFlows);
            const roi = FinancialCalculatorService.calculateROI(
                annualBenefit * horizon,
                initialInvestment + (annualCost * horizon)
            );
            
            // Validate results are reasonable
            expect(npv).toBeDefined();
            expect(irr).toBeGreaterThan(0);
            expect(payback).toBeLessThan(horizon);
            expect(roi).toBeGreaterThan(0);
            
            // Cross-validation: NPV at IRR should be ~0
            if (irr !== null) {
                const npvAtIrr = FinancialCalculatorService.calculateNPV(cashFlows, irr);
                expect(Math.abs(npvAtIrr)).toBeLessThan(100);
            }
        });

        it('should handle edge case of break-even investment', () => {
            // Investment that exactly breaks even with 10% discount
            const cashFlows = [
                { year: 0, amount: -1000 },
                { year: 1, amount: 1100 }
            ];
            
            const npv = FinancialCalculatorService.calculateNPV(cashFlows, 0.10);
            
            expect(Math.abs(npv)).toBeLessThan(1);
        });
    });
});






