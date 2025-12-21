/**
 * Outcome Service Unit Tests
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * Tests for deterministic measurement computation and success criteria evaluation.
 */

const OutcomeService = require('../../../server/services/outcomeService');

describe('OutcomeService', () => {
    // ==========================================
    // DELTA COMPUTATION TESTS
    // ==========================================

    describe('_computeDelta', () => {
        it('should compute positive delta correctly', () => {
            const baseline = { tasks_completed: 5, blocked: 2 };
            const after = { tasks_completed: 8, blocked: 1 };

            const delta = OutcomeService._computeDelta(baseline, after);

            expect(delta.tasks_completed).toBe(3);
            expect(delta.blocked).toBe(-1);
        });

        it('should handle empty baseline', () => {
            const baseline = {};
            const after = { tasks_completed: 5 };

            const delta = OutcomeService._computeDelta(baseline, after);

            expect(delta.tasks_completed).toBe(5);
        });

        it('should handle empty after', () => {
            const baseline = { tasks_completed: 5 };
            const after = {};

            const delta = OutcomeService._computeDelta(baseline, after);

            expect(delta.tasks_completed).toBe(-5);
        });

        it('should handle identical values', () => {
            const baseline = { tasks_completed: 5, blocked: 2 };
            const after = { tasks_completed: 5, blocked: 2 };

            const delta = OutcomeService._computeDelta(baseline, after);

            expect(delta.tasks_completed).toBe(0);
            expect(delta.blocked).toBe(0);
        });

        it('should be deterministic', () => {
            const baseline = { a: 10, b: 20, c: 30 };
            const after = { a: 15, b: 18, c: 35 };

            const delta1 = OutcomeService._computeDelta(baseline, after);
            const delta2 = OutcomeService._computeDelta(baseline, after);

            expect(delta1).toEqual(delta2);
        });
    });

    // ==========================================
    // SUCCESS CRITERIA EVALUATION TESTS
    // ==========================================

    describe('_evaluateSuccess', () => {
        it('should return true for positive delta with no criteria', () => {
            const delta = { tasks_completed: 5, time_saved: 10 };

            const result = OutcomeService._evaluateSuccess(delta, {});

            expect(result).toBe(true);
        });

        it('should return false for all-zero delta with no criteria', () => {
            const delta = { tasks_completed: 0, time_saved: 0 };

            const result = OutcomeService._evaluateSuccess(delta, {});

            expect(result).toBe(false);
        });

        it('should evaluate ">" criterion correctly', () => {
            const delta = { tasks_completed: 5 };

            expect(OutcomeService._evaluateSuccess(delta, { tasks_completed: '> 0' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { tasks_completed: '> 5' })).toBe(false);
            expect(OutcomeService._evaluateSuccess(delta, { tasks_completed: '> 10' })).toBe(false);
        });

        it('should evaluate ">=" criterion correctly', () => {
            const delta = { tasks_completed: 5 };

            expect(OutcomeService._evaluateSuccess(delta, { tasks_completed: '>= 5' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { tasks_completed: '>= 6' })).toBe(false);
        });

        it('should evaluate "<" criterion correctly', () => {
            const delta = { errors: 2 };

            expect(OutcomeService._evaluateSuccess(delta, { errors: '< 5' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { errors: '< 2' })).toBe(false);
        });

        it('should evaluate "<=" criterion correctly', () => {
            const delta = { errors: 2 };

            expect(OutcomeService._evaluateSuccess(delta, { errors: '<= 2' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { errors: '<= 1' })).toBe(false);
        });

        it('should evaluate "==" criterion correctly', () => {
            const delta = { status_changes: 1 };

            expect(OutcomeService._evaluateSuccess(delta, { status_changes: '== 1' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { status_changes: '== 2' })).toBe(false);
        });

        it('should evaluate "!=" criterion correctly', () => {
            const delta = { status_changes: 1 };

            expect(OutcomeService._evaluateSuccess(delta, { status_changes: '!= 0' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { status_changes: '!= 1' })).toBe(false);
        });

        it('should require all criteria to pass', () => {
            const delta = { tasks: 5, errors: 0 };

            // Both criteria met
            expect(OutcomeService._evaluateSuccess(delta, { tasks: '> 0', errors: '== 0' })).toBe(true);

            // One criterion fails
            expect(OutcomeService._evaluateSuccess(delta, { tasks: '> 10', errors: '== 0' })).toBe(false);
        });

        it('should handle negative values', () => {
            const delta = { change: -5 };

            expect(OutcomeService._evaluateSuccess(delta, { change: '< 0' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { change: '>= -5' })).toBe(true);
        });

        it('should handle decimal values', () => {
            const delta = { rate: 0.75 };

            expect(OutcomeService._evaluateSuccess(delta, { rate: '> 0.5' })).toBe(true);
            expect(OutcomeService._evaluateSuccess(delta, { rate: '>= 0.75' })).toBe(true);
        });
    });
});
