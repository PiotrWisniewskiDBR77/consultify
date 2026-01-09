/**
 * AI Playbook Branching Integration Tests
 * Tests for AI-driven playbook execution and decision branching
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock playbook engine
const createPlaybookEngine = () => {
    const playbooks = new Map([
        ['onboarding', {
            id: 'onboarding',
            steps: [
                { id: 'welcome', next: ['profile', 'skip'] },
                { id: 'profile', next: ['preferences'] },
                { id: 'preferences', next: ['complete'] },
                { id: 'complete', next: [] }
            ]
        }],
        ['assessment', {
            id: 'assessment',
            steps: [
                { id: 'start', next: ['gather-data', 'quick-scan'] },
                { id: 'gather-data', next: ['analyze'] },
                { id: 'quick-scan', next: ['analyze'] },
                { id: 'analyze', next: ['recommend', 'manual-review'] },
                { id: 'recommend', next: ['complete'] }
            ]
        }]
    ]);

    const executionHistory = [];

    return {
        executeStep: async (playbookId, stepId, context = {}) => {
            const playbook = playbooks.get(playbookId);
            if (!playbook) {
                return { success: false, error: 'Playbook not found' };
            }

            const step = playbook.steps.find(s => s.id === stepId);
            if (!step) {
                return { success: false, error: 'Step not found' };
            }

            executionHistory.push({ playbookId, stepId, timestamp: Date.now(), context });

            return {
                success: true,
                stepId,
                executed: true,
                nextSteps: step.next,
                context: { ...context, lastStep: stepId }
            };
        },

        getNextSteps: async (playbookId, currentStepId, aiDecision = null) => {
            const playbook = playbooks.get(playbookId);
            const step = playbook?.steps.find(s => s.id === currentStepId);

            if (!step) return { branches: [] };

            // AI can influence branch selection
            let selected = step.next[0];
            if (aiDecision?.preferredBranch && step.next.includes(aiDecision.preferredBranch)) {
                selected = aiDecision.preferredBranch;
            }

            return {
                branches: step.next.map(b => ({
                    id: b,
                    recommended: b === selected,
                    confidence: b === selected ? 0.85 : 0.5
                })),
                selectedBranch: selected
            };
        },

        dryRun: async (playbookId, stepId, context = {}) => {
            // Dry run doesn't modify state
            const initialHistoryLength = executionHistory.length;

            const playbook = playbooks.get(playbookId);
            const step = playbook?.steps.find(s => s.id === stepId);

            const result = {
                wouldExecute: !!step,
                stepId,
                nextSteps: step?.next || [],
                sideEffects: [],
                dryRun: true
            };

            // Verify no side effects
            expect(executionHistory.length).toBe(initialHistoryLength);

            return result;
        },

        getBranchOptions: async (playbookId, stepId) => {
            const playbook = playbooks.get(playbookId);
            const step = playbook?.steps.find(s => s.id === stepId);

            return {
                stepId,
                options: step?.next.map(b => ({
                    branchId: b,
                    description: `Branch to ${b}`,
                    riskLevel: b.includes('manual') ? 'low' : 'medium'
                })) || []
            };
        },

        selectSafeStep: async (playbookId, stepId, guardrailMode = true) => {
            const playbook = playbooks.get(playbookId);
            const step = playbook?.steps.find(s => s.id === stepId);

            if (!step || step.next.length === 0) {
                return { selected: null, reason: 'No next steps' };
            }

            // In guardrail mode, prefer manual/review steps
            if (guardrailMode) {
                const safeStep = step.next.find(s =>
                    s.includes('manual') || s.includes('review') || s.includes('skip')
                );
                if (safeStep) {
                    return { selected: safeStep, reason: 'Guardrail mode: selected safe option' };
                }
            }

            return { selected: step.next[0], reason: 'Default selection' };
        },

        getHistory: () => [...executionHistory]
    };
};

describe('AI Playbook Branching Integration', () => {
    let engine;

    beforeEach(() => {
        vi.clearAllMocks();
        engine = createPlaybookEngine();
    });

    it('should execute playbook step with branch selection', async () => {
        const result = await engine.executeStep('onboarding', 'welcome', { userId: '123' });

        expect(result.success).toBe(true);
        expect(result.stepId).toBe('welcome');
        expect(result.nextSteps).toContain('profile');
        expect(result.executed).toBe(true);
    });

    it('should return next steps based on AI decision', async () => {
        const aiDecision = { preferredBranch: 'quick-scan', confidence: 0.9 };
        const result = await engine.getNextSteps('assessment', 'start', aiDecision);

        expect(result.branches.length).toBeGreaterThan(0);
        expect(result.selectedBranch).toBe('quick-scan');

        const recommended = result.branches.find(b => b.recommended);
        expect(recommended.confidence).toBeGreaterThan(0.8);
    });

    it('should perform dry run without side effects', async () => {
        const initialHistory = engine.getHistory().length;

        const result = await engine.dryRun('onboarding', 'welcome', { test: true });

        expect(result.dryRun).toBe(true);
        expect(result.wouldExecute).toBe(true);
        expect(engine.getHistory().length).toBe(initialHistory);
    });

    it('should return multiple branch options', async () => {
        const result = await engine.getBranchOptions('assessment', 'analyze');

        expect(result.options.length).toBeGreaterThan(1);
        expect(result.options.some(o => o.riskLevel === 'low')).toBe(true);
    });

    it('should select safe step in guardrail mode', async () => {
        const result = await engine.selectSafeStep('assessment', 'analyze', true);

        expect(result.selected).toBe('manual-review');
        expect(result.reason).toContain('Guardrail');
    });

    it('should track execution history', async () => {
        await engine.executeStep('onboarding', 'welcome');
        await engine.executeStep('onboarding', 'profile');

        const history = engine.getHistory();
        expect(history.length).toBe(2);
        expect(history[0].stepId).toBe('welcome');
        expect(history[1].stepId).toBe('profile');
    });
});
