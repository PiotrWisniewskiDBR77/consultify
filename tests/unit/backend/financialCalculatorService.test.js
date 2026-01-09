/**
 * Financial Calculator Service Unit Tests
 * Tests financial calculations: ROI, NPV, IRR, payback period
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Financial Calculator Service implementation
const createFinancialCalculatorService = () => {
    return {
        calculateROI: (gain, cost) => {
            if (cost === 0) throw new Error('Cost cannot be zero');
            const roi = ((gain - cost) / cost) * 100;
            return {
                value: Math.round((gain / cost) * 100) / 100,
                percentage: `${roi.toFixed(1)}%`,
                profit: gain - cost
            };
        },

        calculateNPV: (cashFlows, discountRate) => {
            let npv = 0;
            for (let t = 0; t < cashFlows.length; t++) {
                npv += cashFlows[t] / Math.pow(1 + discountRate, t);
            }
            return Math.round(npv * 100) / 100;
        },

        calculateIRR: (cashFlows, guess = 0.1) => {
            // Newton-Raphson approximation
            let rate = guess;
            const maxIterations = 100;
            const tolerance = 0.0001;

            for (let i = 0; i < maxIterations; i++) {
                let npv = 0;
                let derivative = 0;

                for (let t = 0; t < cashFlows.length; t++) {
                    const factor = Math.pow(1 + rate, t);
                    npv += cashFlows[t] / factor;
                    if (t > 0) {
                        derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
                    }
                }

                if (Math.abs(npv) < tolerance) break;
                if (derivative === 0) break;

                rate = rate - npv / derivative;
            }

            return Math.round(rate * 10000) / 100; // Return as percentage
        },

        calculatePaybackPeriod: (initialInvestment, annualCashFlow) => {
            if (annualCashFlow <= 0) throw new Error('Cash flow must be positive');
            const years = initialInvestment / annualCashFlow;
            return {
                years: Math.round(years * 100) / 100,
                months: Math.round(years * 12)
            };
        },

        calculateProfitMargin: (revenue, costs) => {
            if (revenue === 0) return 0;
            return Math.round(((revenue - costs) / revenue) * 10000) / 100;
        },

        calculateCAGR: (beginningValue, endingValue, years) => {
            if (years <= 0 || beginningValue <= 0) return 0;
            const cagr = Math.pow(endingValue / beginningValue, 1 / years) - 1;
            return Math.round(cagr * 10000) / 100;
        },

        calculateBreakeven: (fixedCosts, pricePerUnit, variableCostPerUnit) => {
            const margin = pricePerUnit - variableCostPerUnit;
            if (margin <= 0) throw new Error('Contribution margin must be positive');
            return Math.ceil(fixedCosts / margin);
        }
    };
};

describe('FinancialCalculatorService', () => {
    let calculator;

    beforeEach(() => {
        calculator = createFinancialCalculatorService();
    });

    describe('ROI Calculation', () => {
        it('should calculate ROI', () => {
            const result = calculator.calculateROI(125000, 100000);

            expect(result.percentage).toBe('25.0%');
            expect(result.profit).toBe(25000);
        });

        it('should handle negative ROI', () => {
            const result = calculator.calculateROI(80000, 100000);
            expect(result.profit).toBe(-20000);
        });

        it('should throw for zero cost', () => {
            expect(() => calculator.calculateROI(100, 0)).toThrow('Cost cannot be zero');
        });
    });

    describe('NPV Calculation', () => {
        it('should calculate NPV', () => {
            const cashFlows = [-100000, 30000, 40000, 50000, 60000];
            const npv = calculator.calculateNPV(cashFlows, 0.1);

            expect(npv).toBeGreaterThan(0);
        });

        it('should handle simple positive NPV', () => {
            const cashFlows = [-1000, 600, 600];
            const npv = calculator.calculateNPV(cashFlows, 0.1);

            expect(npv).toBeGreaterThan(0);
        });
    });

    describe('IRR Calculation', () => {
        it('should calculate IRR', () => {
            const cashFlows = [-1000, 400, 400, 400];
            const irr = calculator.calculateIRR(cashFlows);

            expect(irr).toBeGreaterThan(0);
        });
    });

    describe('Payback Period', () => {
        it('should calculate payback period', () => {
            const result = calculator.calculatePaybackPeriod(100000, 25000);

            expect(result.years).toBe(4);
            expect(result.months).toBe(48);
        });
    });

    describe('Profit Margin', () => {
        it('should calculate profit margin', () => {
            const margin = calculator.calculateProfitMargin(100000, 60000);
            expect(margin).toBe(40);
        });
    });

    describe('CAGR', () => {
        it('should calculate CAGR', () => {
            const cagr = calculator.calculateCAGR(100, 200, 5);
            expect(cagr).toBeGreaterThan(0);
        });
    });

    describe('Breakeven', () => {
        it('should calculate breakeven units', () => {
            const units = calculator.calculateBreakeven(50000, 100, 60);
            expect(units).toBe(1250);
        });
    });
});
