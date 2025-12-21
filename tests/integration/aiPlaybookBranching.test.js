/**
 * AI Playbook Branching Integration Tests
 * Step 12: Conditional Branching & Dynamic Playbooks
 * 
 * Tests full playbook execution with BRANCH steps.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockDb = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn((sql, params, callback) => {
        if (callback) callback(null);
    })
};

vi.mock('../../server/database', () => ({
    default: mockDb
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'test-uuid-12345'
}));

const AIPlaybookExecutor = require('../../server/ai/aiPlaybookExecutor');
const AIPlaybookRoutingEngine = require('../../server/ai/aiPlaybookRoutingEngine');
const AIPlaybookService = require('../../server/ai/aiPlaybookService');

describe('AI Playbook Branching Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('BRANCH step execution', () => {
        it('should route to correct step based on branch rules', async () => {
            // Mock run data
            const mockRun = {
                id: 'apr-001',
                organizationId: 'org-001',
                correlationId: 'corr-001',
                status: 'IN_PROGRESS',
                steps: [
                    {
                        id: 'aprs-001',
                        templateStepId: 'aps-001',
                        stepType: 'BRANCH',
                        title: 'Check Adoption Level',
                        status: 'PENDING'
                    },
                    {
                        id: 'aprs-002',
                        templateStepId: 'aps-002',
                        stepType: 'ACTION',
                        title: 'Low Adoption Flow',
                        status: 'PENDING'
                    }
                ]
            };

            // Mock template step with branch rules
            const mockTemplateStep = {
                id: 'aps-001',
                stepType: 'BRANCH',
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['help_adoption', 0.2] }, goto: 'aps-002', reason: 'Low adoption' }
                    ],
                    else_goto: 'aps-003'
                }
            };

            // Mock context with low adoption
            const mockContext = {
                runId: 'apr-001',
                organizationId: 'org-001',
                metrics: { help_adoption: 0.15 },
                tasks: [],
                signals: [],
                stepTimestamps: {}
            };

            vi.spyOn(AIPlaybookService, 'getRun').mockResolvedValue(mockRun);
            vi.spyOn(AIPlaybookService, 'updateRunStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateStepStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateRunStepWithRouting').mockResolvedValue(true);
            vi.spyOn(AIPlaybookRoutingEngine, 'getTemplateStep').mockResolvedValue(mockTemplateStep);
            vi.spyOn(AIPlaybookRoutingEngine, 'buildContext').mockResolvedValue(mockContext);

            const result = await AIPlaybookExecutor.advanceRun('apr-001', 'user-001');

            expect(result.success).toBe(true);
            expect(result.step.stepType).toBe('BRANCH');
            expect(result.step.selectedNextStepId).toBe('aps-002');
            expect(result.trace).toBeDefined();
            expect(result.trace.matched_rule).toBeDefined();
        });

        it('should fall through to else_goto when no rules match', async () => {
            const mockRun = {
                id: 'apr-002',
                organizationId: 'org-001',
                correlationId: 'corr-002',
                status: 'IN_PROGRESS',
                steps: [
                    {
                        id: 'aprs-001',
                        templateStepId: 'aps-001',
                        stepType: 'BRANCH',
                        title: 'Check Adoption Level',
                        status: 'PENDING'
                    }
                ]
            };

            const mockTemplateStep = {
                id: 'aps-001',
                stepType: 'BRANCH',
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['help_adoption', 0.2] }, goto: 'aps-low' }
                    ],
                    else_goto: 'aps-high'
                }
            };

            const mockContext = {
                metrics: { help_adoption: 0.85 } // High adoption - no rules match
            };

            vi.spyOn(AIPlaybookService, 'getRun').mockResolvedValue(mockRun);
            vi.spyOn(AIPlaybookService, 'updateRunStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateStepStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateRunStepWithRouting').mockResolvedValue(true);
            vi.spyOn(AIPlaybookRoutingEngine, 'getTemplateStep').mockResolvedValue(mockTemplateStep);
            vi.spyOn(AIPlaybookRoutingEngine, 'buildContext').mockResolvedValue(mockContext);

            const result = await AIPlaybookExecutor.advanceRun('apr-002', 'user-001');

            expect(result.step.selectedNextStepId).toBe('aps-high');
            expect(result.trace.fell_through_to_else).toBe(true);
        });
    });

    describe('dry-run-route', () => {
        it('should return routing preview without persisting', async () => {
            const mockRun = {
                id: 'apr-003',
                organizationId: 'org-001',
                steps: [
                    {
                        id: 'aprs-001',
                        templateStepId: 'aps-001',
                        stepType: 'BRANCH',
                        title: 'Check Status',
                        status: 'PENDING'
                    }
                ]
            };

            const mockTemplateStep = {
                id: 'aps-001',
                branchRules: {
                    mode: 'first_match',
                    rules: [{ if: { has_open_tasks: true }, goto: 'aps-tasks' }],
                    else_goto: 'aps-done'
                }
            };

            const mockContext = {
                tasks: [{ status: 'open' }]
            };

            vi.spyOn(AIPlaybookService, 'getRun').mockResolvedValue(mockRun);
            vi.spyOn(AIPlaybookRoutingEngine, 'getTemplateStep').mockResolvedValue(mockTemplateStep);
            vi.spyOn(AIPlaybookRoutingEngine, 'buildContext').mockResolvedValue(mockContext);

            const result = await AIPlaybookExecutor.dryRunRoute('apr-003');

            expect(result.dry_run).toBe(true);
            expect(result.nextStepId).toBe('aps-tasks');
            expect(result.trace).toBeDefined();

            // Verify no persistence methods were called
            expect(AIPlaybookService.updateStepStatus).not.toHaveBeenCalled();
            expect(AIPlaybookService.updateRunStepWithRouting).not.toHaveBeenCalled();
        });

        it('should handle ACTION steps in dry-run', async () => {
            const mockRun = {
                id: 'apr-004',
                organizationId: 'org-001',
                steps: [
                    {
                        id: 'aprs-001',
                        templateStepId: 'aps-001',
                        stepType: 'ACTION',
                        title: 'Create Task',
                        status: 'PENDING',
                        nextStepId: 'aps-002'
                    }
                ]
            };

            vi.spyOn(AIPlaybookService, 'getRun').mockResolvedValue(mockRun);

            const result = await AIPlaybookExecutor.dryRunRoute('apr-004');

            expect(result.dry_run).toBe(true);
            expect(result.currentStep.stepType).toBe('ACTION');
            expect(result.message).toContain('Action Proposal');
        });
    });

    describe('evaluation_trace recording', () => {
        it('should record evaluation trace for BRANCH steps', async () => {
            const mockRun = {
                id: 'apr-005',
                organizationId: 'org-001',
                correlationId: 'corr-005',
                status: 'IN_PROGRESS',
                steps: [{
                    id: 'aprs-001',
                    templateStepId: 'aps-001',
                    stepType: 'BRANCH',
                    title: 'Branch Step',
                    status: 'PENDING'
                }]
            };

            const mockTemplateStep = {
                id: 'aps-001',
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { metric_lte: ['score', 30] }, goto: 'step-low' },
                        { if: { metric_lte: ['score', 70] }, goto: 'step-mid' }
                    ],
                    else_goto: 'step-high'
                }
            };

            const mockContext = { metrics: { score: 45 } };

            vi.spyOn(AIPlaybookService, 'getRun').mockResolvedValue(mockRun);
            vi.spyOn(AIPlaybookService, 'updateRunStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateStepStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateRunStepWithRouting').mockResolvedValue(true);
            vi.spyOn(AIPlaybookRoutingEngine, 'getTemplateStep').mockResolvedValue(mockTemplateStep);
            vi.spyOn(AIPlaybookRoutingEngine, 'buildContext').mockResolvedValue(mockContext);

            await AIPlaybookExecutor.advanceRun('apr-005', 'user-001');

            // Verify updateRunStepWithRouting was called with trace
            expect(AIPlaybookService.updateRunStepWithRouting).toHaveBeenCalledWith(
                'aprs-001',
                expect.objectContaining({
                    evaluationTrace: expect.objectContaining({
                        rules_evaluated: expect.arrayContaining([
                            expect.objectContaining({ matched: false }),
                            expect.objectContaining({ matched: true })
                        ])
                    }),
                    selectedNextStepId: 'step-mid'
                })
            );
        });
    });

    describe('unknown condition fail-safe', () => {
        it('should fall back to else_goto for unknown condition', async () => {
            const mockRun = {
                id: 'apr-006',
                organizationId: 'org-001',
                status: 'IN_PROGRESS',
                steps: [{
                    id: 'aprs-001',
                    templateStepId: 'aps-001',
                    stepType: 'BRANCH',
                    status: 'PENDING'
                }]
            };

            const mockTemplateStep = {
                id: 'aps-001',
                branchRules: {
                    mode: 'first_match',
                    rules: [
                        { if: { unknown_future_condition: 'value' }, goto: 'step-future' }
                    ],
                    else_goto: 'step-safe'
                }
            };

            vi.spyOn(AIPlaybookService, 'getRun').mockResolvedValue(mockRun);
            vi.spyOn(AIPlaybookService, 'updateRunStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateStepStatus').mockResolvedValue(true);
            vi.spyOn(AIPlaybookService, 'updateRunStepWithRouting').mockResolvedValue(true);
            vi.spyOn(AIPlaybookRoutingEngine, 'getTemplateStep').mockResolvedValue(mockTemplateStep);
            vi.spyOn(AIPlaybookRoutingEngine, 'buildContext').mockResolvedValue({});

            const result = await AIPlaybookExecutor.advanceRun('apr-006', 'user-001');

            // Should safely fall back to else_goto
            expect(result.step.selectedNextStepId).toBe('step-safe');
        });
    });
});
