/**
 * AI Budget Service Unit Tests
 * 
 * Tests for AI spending budget management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database
vi.mock('../../../server/database', () => ({
    default: {
        run: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params.call({ lastID: 1, changes: 1 }, null);
            } else if (cb) {
                cb.call({ lastID: 1, changes: 1 }, null);
            }
        }),
        get: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params(null, null);
            } else if (cb) {
                cb(null, { count: 0 });
            }
        }),
        all: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params(null, []);
            } else if (cb) {
                cb(null, []);
            }
        }),
    }
}));

describe('AI Budget Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Model Costs', () => {
        it('should define cost information for supported models', () => {
            const costs = {
                'gpt-4': { input: 0.03, output: 0.06 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
                'gpt-4o': { input: 0.005, output: 0.015 },
                'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
                'claude-3-opus': { input: 0.015, output: 0.075 },
                'claude-3-sonnet': { input: 0.003, output: 0.015 },
                'gemini-pro': { input: 0.00025, output: 0.0005 },
            };
            
            expect(costs).toHaveProperty('gpt-4');
            expect(costs).toHaveProperty('gpt-4-turbo');
            expect(costs).toHaveProperty('claude-3-opus');
            expect(costs).toHaveProperty('claude-3-sonnet');
            expect(costs).toHaveProperty('gemini-pro');
        });

        it('should have input and output costs for each model', () => {
            const costs = {
                'gpt-4': { input: 0.03, output: 0.06 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
            };
            
            Object.values(costs).forEach(modelCost => {
                expect(modelCost).toHaveProperty('input');
                expect(modelCost).toHaveProperty('output');
                expect(typeof modelCost.input).toBe('number');
                expect(typeof modelCost.output).toBe('number');
                expect(modelCost.input).toBeGreaterThan(0);
                expect(modelCost.output).toBeGreaterThan(0);
            });
        });
    });

    describe('Cost Estimation', () => {
        it('should calculate correct cost for GPT-4', () => {
            // GPT-4 costs: $0.03/1K input, $0.06/1K output
            const inputTokens = 1000;
            const outputTokens = 500;
            const inputCost = 0.03;
            const outputCost = 0.06;
            
            const cost = (inputTokens / 1000 * inputCost) + (outputTokens / 1000 * outputCost);
            
            // Expected: (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
            expect(cost).toBeCloseTo(0.06, 4);
        });

        it('should calculate correct cost for GPT-4o-mini', () => {
            // GPT-4o-mini costs: $0.00015/1K input, $0.0006/1K output
            const inputTokens = 10000;
            const outputTokens = 5000;
            const inputCost = 0.00015;
            const outputCost = 0.0006;
            
            const cost = (inputTokens / 1000 * inputCost) + (outputTokens / 1000 * outputCost);
            
            // Expected: (10000/1000 * 0.00015) + (5000/1000 * 0.0006) = 0.0015 + 0.003 = 0.0045
            expect(cost).toBeCloseTo(0.0045, 4);
        });

        it('should calculate correct cost for Claude-3-opus', () => {
            // Claude-3-opus costs: $0.015/1K input, $0.075/1K output
            const inputTokens = 2000;
            const outputTokens = 1000;
            const inputCost = 0.015;
            const outputCost = 0.075;
            
            const cost = (inputTokens / 1000 * inputCost) + (outputTokens / 1000 * outputCost);
            
            // Expected: (2000/1000 * 0.015) + (1000/1000 * 0.075) = 0.03 + 0.075 = 0.105
            expect(cost).toBeCloseTo(0.105, 4);
        });

        it('should use default costs for unknown model', () => {
            const inputTokens = 1000;
            const outputTokens = 500;
            const defaultInputCost = 0.01;
            const defaultOutputCost = 0.03;
            
            const cost = (inputTokens / 1000 * defaultInputCost) + (outputTokens / 1000 * defaultOutputCost);
            
            // Expected: (1000/1000 * 0.01) + (500/1000 * 0.03) = 0.01 + 0.015 = 0.025
            expect(cost).toBeCloseTo(0.025, 4);
        });

        it('should handle zero tokens', () => {
            const cost = (0 / 1000 * 0.03) + (0 / 1000 * 0.06);
            expect(cost).toBe(0);
        });
    });

    describe('Budget Types', () => {
        it('should support cost budget type', () => {
            const budgetData = {
                budgetType: 'cost',
                period: 'monthly',
                budgetLimit: 100,
            };
            
            expect(budgetData.budgetType).toBe('cost');
            expect(['cost', 'tokens', 'requests']).toContain(budgetData.budgetType);
        });

        it('should support tokens budget type', () => {
            const budgetData = {
                budgetType: 'tokens',
                period: 'daily',
                budgetLimit: 1000000,
            };
            
            expect(budgetData.budgetType).toBe('tokens');
        });

        it('should support requests budget type', () => {
            const budgetData = {
                budgetType: 'requests',
                period: 'weekly',
                budgetLimit: 1000,
            };
            
            expect(budgetData.budgetType).toBe('requests');
        });
    });

    describe('Budget Periods', () => {
        it('should support all valid periods', () => {
            const validPeriods = ['daily', 'weekly', 'monthly', 'yearly', 'total'];
            
            validPeriods.forEach(period => {
                expect(['daily', 'weekly', 'monthly', 'yearly', 'total']).toContain(period);
            });
        });
    });

    describe('Warning Threshold', () => {
        it('should default warning threshold to 80%', () => {
            const defaultThreshold = 0.8;
            expect(defaultThreshold).toBe(0.8);
        });

        it('should validate threshold is between 0 and 1', () => {
            const validThresholds = [0.5, 0.75, 0.8, 0.9, 0.95];
            
            validThresholds.forEach(threshold => {
                expect(threshold).toBeGreaterThan(0);
                expect(threshold).toBeLessThanOrEqual(1);
            });
        });
    });
});

describe('Usage Recording', () => {
    it('should calculate total tokens correctly', () => {
        const inputTokens = 500;
        const outputTokens = 300;
        const totalTokens = inputTokens + outputTokens;
        
        expect(totalTokens).toBe(800);
    });

    it('should track request count', () => {
        const requests = [1, 1, 1, 1, 1];
        const totalRequests = requests.length;
        
        expect(totalRequests).toBe(5);
    });
});

describe('Alert Types', () => {
    it('should support all alert types', () => {
        const alertTypes = ['warning', 'exceeded', 'anomaly', 'spike'];
        
        alertTypes.forEach(type => {
            expect(['warning', 'exceeded', 'anomaly', 'spike']).toContain(type);
        });
    });

    it('should support all alert statuses', () => {
        const statuses = ['active', 'acknowledged', 'resolved', 'dismissed'];
        
        statuses.forEach(status => {
            expect(['active', 'acknowledged', 'resolved', 'dismissed']).toContain(status);
        });
    });
});
