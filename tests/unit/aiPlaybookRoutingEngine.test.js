/**
 * AI Playbook Routing Engine Unit Tests
 * Step 12: Conditional Branching & Dynamic Playbooks
 * 
 * Tests condition evaluation, first_match routing, else_goto fallback, and fail-safe behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database before importing the module
vi.mock('../../server/database', () => ({
    default: {
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn()
    }
}));

const AIPlaybookRoutingEngine = require('../../server/ai/aiPlaybookRoutingEngine');

describe('AIPlaybookRoutingEngine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('evaluateCondition', () => {
        describe('metric_lte', () => {
            it('should match when metric is less than threshold', () => {
                const context = { metrics: { help_adoption: 0.15 } };
                const condition = { metric_lte: ['help_adoption', 0.2] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
                expect(result.reason).toContain('0.15');
                expect(result.reason).toContain('<=');
            });

            it('should match when metric equals threshold', () => {
                const context = { metrics: { help_adoption: 0.2 } };
                const condition = { metric_lte: ['help_adoption', 0.2] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should not match when metric is greater than threshold', () => {
                const context = { metrics: { help_adoption: 0.5 } };
                const condition = { metric_lte: ['help_adoption', 0.2] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
            });

            it('should not match when metric is not found', () => {
                const context = { metrics: {} };
                const condition = { metric_lte: ['unknown_metric', 0.2] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
                expect(result.reason).toContain('not found');
            });

            it('should return false for invalid format', () => {
                const context = { metrics: { help_adoption: 0.15 } };
                const condition = { metric_lte: 'invalid' };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
                expect(result.reason).toContain('Invalid');
            });
        });

        describe('metric_gte', () => {
            it('should match when metric is greater than threshold', () => {
                const context = { metrics: { score: 75 } };
                const condition = { metric_gte: ['score', 50] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should match when metric equals threshold', () => {
                const context = { metrics: { score: 50 } };
                const condition = { metric_gte: ['score', 50] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should not match when metric is less than threshold', () => {
                const context = { metrics: { score: 25 } };
                const condition = { metric_gte: ['score', 50] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
            });
        });

        describe('flag_eq', () => {
            it('should match when flag equals expected value', () => {
                const context = { flags: { is_premium: true } };
                const condition = { flag_eq: ['is_premium', true] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should not match when flag does not equal expected value', () => {
                const context = { flags: { is_premium: false } };
                const condition = { flag_eq: ['is_premium', true] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
            });

            it('should work with string values', () => {
                const context = { flags: { plan: 'enterprise' } };
                const condition = { flag_eq: ['plan', 'enterprise'] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });
        });

        describe('has_open_tasks', () => {
            it('should match when open tasks exist and condition is true', () => {
                const context = { tasks: [{ status: 'open' }, { status: 'completed' }] };
                const condition = { has_open_tasks: true };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should match when no open tasks and condition is false', () => {
                const context = { tasks: [{ status: 'completed' }] };
                const condition = { has_open_tasks: false };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should recognize in_progress as open', () => {
                const context = { tasks: [{ status: 'in_progress' }] };
                const condition = { has_open_tasks: true };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should recognize PENDING as open', () => {
                const context = { tasks: [{ status: 'PENDING' }] };
                const condition = { has_open_tasks: true };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });
        });

        describe('signal_present', () => {
            it('should match when signal is present', () => {
                const context = { signals: [{ type: 'USER_AT_RISK' }] };
                const condition = { signal_present: 'USER_AT_RISK' };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should not match when signal is not present', () => {
                const context = { signals: [{ type: 'BLOCKED_INITIATIVE' }] };
                const condition = { signal_present: 'USER_AT_RISK' };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
            });

            it('should handle simple string signals', () => {
                const context = { signals: ['USER_AT_RISK', 'LOW_ADOPTION'] };
                const condition = { signal_present: 'LOW_ADOPTION' };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });
        });

        describe('time_since_step_gte', () => {
            it('should match when enough time has passed', () => {
                const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 mins ago
                const context = { stepTimestamps: { 'step-001': pastTime } };
                const condition = { time_since_step_gte: ['step-001', 30] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(true);
            });

            it('should not match when not enough time has passed', () => {
                const recentTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
                const context = { stepTimestamps: { 'step-001': recentTime } };
                const condition = { time_since_step_gte: ['step-001', 30] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
            });

            it('should not match when step timestamp not found', () => {
                const context = { stepTimestamps: {} };
                const condition = { time_since_step_gte: ['step-001', 30] };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
                expect(result.reason).toContain('not found');
            });
        });

        describe('unknown conditions', () => {
            it('should fail safely for unknown condition type', () => {
                const context = {};
                const condition = { unknown_condition: 'test' };

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
                expect(result.reason).toContain('Unknown condition type');
            });

            it('should fail safely for empty condition', () => {
                const context = {};
                const condition = {};

                const result = AIPlaybookRoutingEngine.evaluateCondition(condition, context);

                expect(result.matched).toBe(false);
                expect(result.reason).toContain('Empty condition');
            });
        });
    });

    describe('evaluateRouting', () => {
        it('should select first matching rule in first_match mode', () => {
            const currentStep = {
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['adoption', 0.2] }, goto: 'step-low', reason: 'Low adoption' },
                        { if: { metric_lte: ['adoption', 0.5] }, goto: 'step-medium', reason: 'Medium adoption' }
                    ],
                    else_goto: 'step-high'
                }
            };
            const context = { metrics: { adoption: 0.15 } };

            const result = AIPlaybookRoutingEngine.evaluateRouting({
                runId: 'run-001',
                currentStep,
                context
            });

            expect(result.nextStepId).toBe('step-low');
            expect(result.reason).toContain('Low adoption');
            expect(result.trace.matched_rule).toBeDefined();
        });

        it('should use else_goto when no rules match', () => {
            const currentStep = {
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['adoption', 0.2] }, goto: 'step-low', reason: 'Low adoption' }
                    ],
                    else_goto: 'step-default'
                }
            };
            const context = { metrics: { adoption: 0.8 } };

            const result = AIPlaybookRoutingEngine.evaluateRouting({
                runId: 'run-001',
                currentStep,
                context
            });

            expect(result.nextStepId).toBe('step-default');
            expect(result.trace.fell_through_to_else).toBe(true);
        });

        it('should return null when no rules match and no else_goto', () => {
            const currentStep = {
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['adoption', 0.2] }, goto: 'step-low' }
                    ]
                }
            };
            const context = { metrics: { adoption: 0.8 } };

            const result = AIPlaybookRoutingEngine.evaluateRouting({
                runId: 'run-001',
                currentStep,
                context
            });

            expect(result.nextStepId).toBeNull();
            expect(result.reason).toContain('no else_goto');
        });

        it('should use linear flow when no branch_rules defined', () => {
            const currentStep = {
                nextStepId: 'step-next',
                branchRules: null
            };
            const context = {};

            const result = AIPlaybookRoutingEngine.evaluateRouting({
                runId: 'run-001',
                currentStep,
                context
            });

            expect(result.nextStepId).toBe('step-next');
            expect(result.trace.mode).toBe('linear');
        });

        it('should record evaluation trace', () => {
            const currentStep = {
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['adoption', 0.2] }, goto: 'step-low' },
                        { if: { metric_lte: ['adoption', 0.5] }, goto: 'step-medium' }
                    ],
                    else_goto: 'step-high'
                }
            };
            const context = { metrics: { adoption: 0.35 } };

            const result = AIPlaybookRoutingEngine.evaluateRouting({
                runId: 'run-001',
                currentStep,
                context
            });

            expect(result.trace.rules_evaluated).toHaveLength(2);
            expect(result.trace.rules_evaluated[0].matched).toBe(false);
            expect(result.trace.rules_evaluated[1].matched).toBe(true);
            expect(result.trace.context_used).toBeDefined();
        });

        it('should skip rules with invalid conditions', () => {
            const currentStep = {
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: null, goto: 'step-invalid' },
                        { if: { metric_lte: ['adoption', 0.2] }, goto: 'step-valid' }
                    ],
                    else_goto: 'step-else'
                }
            };
            const context = { metrics: { adoption: 0.1 } };

            const result = AIPlaybookRoutingEngine.evaluateRouting({
                runId: 'run-001',
                currentStep,
                context
            });

            expect(result.nextStepId).toBe('step-valid');
            expect(result.trace.rules_evaluated[0].skipped).toBe(true);
        });
    });
});
