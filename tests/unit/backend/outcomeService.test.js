/**
 * Outcome Service Unit Tests
 * 
 * Tests for tracking and measuring initiative outcomes.
 * 
 * @module tests/unit/backend/outcomeService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create outcome service implementation
const createOutcomeService = () => {
    const outcomes = new Map();
    const measurements = new Map();

    return {
        // Create outcome definition
        createOutcome: async (data) => {
            if (!data.initiativeId || !data.name) {
                throw new Error('Initiative ID and name are required');
            }

            const id = `outcome-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const outcome = {
                id,
                initiativeId: data.initiativeId,
                name: data.name,
                description: data.description || '',
                targetValue: data.targetValue || 0,
                targetDate: data.targetDate,
                currentValue: 0,
                unit: data.unit || 'count',
                status: 'in_progress',
                createdAt: new Date().toISOString()
            };

            outcomes.set(id, outcome);
            measurements.set(id, []);
            return outcome;
        },

        // Get outcome by ID
        getById: async (id) => {
            return outcomes.get(id) || null;
        },

        // Get outcomes for initiative
        getByInitiative: async (initiativeId) => {
            return Array.from(outcomes.values())
                .filter(o => o.initiativeId === initiativeId);
        },

        // Record measurement
        recordMeasurement: async (outcomeId, value, notes = '') => {
            const outcome = outcomes.get(outcomeId);
            if (!outcome) throw new Error('Outcome not found');

            const measurement = {
                id: `m-${Date.now()}`,
                outcomeId,
                value,
                notes,
                recordedAt: new Date().toISOString()
            };

            const history = measurements.get(outcomeId) || [];
            history.push(measurement);
            measurements.set(outcomeId, history);

            // Update current value
            outcome.currentValue = value;

            // Check if target achieved
            if (value >= outcome.targetValue) {
                outcome.status = 'achieved';
            }

            outcomes.set(outcomeId, outcome);
            return measurement;
        },

        // Get measurement history
        getMeasurements: async (outcomeId) => {
            return measurements.get(outcomeId) || [];
        },

        // Calculate progress
        getProgress: async (outcomeId) => {
            const outcome = outcomes.get(outcomeId);
            if (!outcome) throw new Error('Outcome not found');

            const progress = outcome.targetValue > 0
                ? (outcome.currentValue / outcome.targetValue) * 100
                : 0;

            return {
                outcomeId,
                name: outcome.name,
                current: outcome.currentValue,
                target: outcome.targetValue,
                progress: Math.min(100, Math.round(progress)),
                status: outcome.status,
                onTrack: progress >= 50 || outcome.status === 'achieved'
            };
        },

        // Update outcome target
        updateTarget: async (outcomeId, updates) => {
            const outcome = outcomes.get(outcomeId);
            if (!outcome) throw new Error('Outcome not found');

            const updated = { ...outcome, ...updates };
            outcomes.set(outcomeId, updated);
            return updated;
        },

        // Calculate ROI
        calculateROI: async (initiativeId, investmentCost) => {
            const initiativeOutcomes = Array.from(outcomes.values())
                .filter(o => o.initiativeId === initiativeId);

            let totalValue = 0;
            for (const outcome of initiativeOutcomes) {
                totalValue += outcome.currentValue;
            }

            const roi = investmentCost > 0
                ? ((totalValue - investmentCost) / investmentCost) * 100
                : 0;

            return {
                initiativeId,
                totalValue,
                investmentCost,
                roi: Math.round(roi * 100) / 100,
                outcomesCount: initiativeOutcomes.length
            };
        },

        // Clear for testing
        clear: () => {
            outcomes.clear();
            measurements.clear();
        }
    };
};

describe('OutcomeService', () => {
    let outcomeService;

    beforeEach(() => {
        outcomeService = createOutcomeService();
    });

    describe('Outcome Creation', () => {
        it('should create an outcome', async () => {
            const outcome = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Reduce Cycle Time',
                targetValue: 20,
                unit: 'percent'
            });

            expect(outcome.id).toBeDefined();
            expect(outcome.name).toBe('Reduce Cycle Time');
            expect(outcome.status).toBe('in_progress');
        });

        it('should require initiative ID and name', async () => {
            await expect(outcomeService.createOutcome({}))
                .rejects.toThrow('Initiative ID and name are required');
        });
    });

    describe('Measurements', () => {
        it('should record measurements', async () => {
            const outcome = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Test Outcome',
                targetValue: 100
            });

            await outcomeService.recordMeasurement(outcome.id, 25, 'Week 1');
            await outcomeService.recordMeasurement(outcome.id, 50, 'Week 2');
            await outcomeService.recordMeasurement(outcome.id, 75, 'Week 3');

            const history = await outcomeService.getMeasurements(outcome.id);
            expect(history).toHaveLength(3);

            const updated = await outcomeService.getById(outcome.id);
            expect(updated.currentValue).toBe(75);
        });

        it('should mark outcome as achieved when target reached', async () => {
            const outcome = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Complete Task',
                targetValue: 100
            });

            await outcomeService.recordMeasurement(outcome.id, 100);

            const updated = await outcomeService.getById(outcome.id);
            expect(updated.status).toBe('achieved');
        });
    });

    describe('Progress Tracking', () => {
        it('should calculate progress percentage', async () => {
            const outcome = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Progress Test',
                targetValue: 100
            });

            await outcomeService.recordMeasurement(outcome.id, 40);

            const progress = await outcomeService.getProgress(outcome.id);
            expect(progress.progress).toBe(40);
            expect(progress.onTrack).toBe(false);
        });

        it('should cap progress at 100%', async () => {
            const outcome = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Over Achiever',
                targetValue: 50
            });

            await outcomeService.recordMeasurement(outcome.id, 75);

            const progress = await outcomeService.getProgress(outcome.id);
            expect(progress.progress).toBe(100);
        });
    });

    describe('Initiative Outcomes', () => {
        it('should get all outcomes for an initiative', async () => {
            await outcomeService.createOutcome({ initiativeId: 'init-1', name: 'Outcome 1', targetValue: 10 });
            await outcomeService.createOutcome({ initiativeId: 'init-1', name: 'Outcome 2', targetValue: 20 });
            await outcomeService.createOutcome({ initiativeId: 'init-2', name: 'Outcome 3', targetValue: 30 });

            const outcomes = await outcomeService.getByInitiative('init-1');
            expect(outcomes).toHaveLength(2);
        });
    });

    describe('ROI Calculation', () => {
        it('should calculate ROI for initiative', async () => {
            const o1 = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Cost Savings',
                targetValue: 100000
            });
            await outcomeService.recordMeasurement(o1.id, 50000);

            const o2 = await outcomeService.createOutcome({
                initiativeId: 'init-1',
                name: 'Revenue Increase',
                targetValue: 200000
            });
            await outcomeService.recordMeasurement(o2.id, 75000);

            const roi = await outcomeService.calculateROI('init-1', 100000);

            expect(roi.totalValue).toBe(125000); // 50000 + 75000
            expect(roi.roi).toBe(25); // (125000 - 100000) / 100000 * 100
        });
    });
});
