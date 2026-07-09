import { describe, expect, it, vi } from 'vitest';

import { applyOperationalPendingAction } from '@/hooks/discovery/toolAi/operationalTool';
import type { OperationalToolData } from '@/store/useToolStore';

/**
 * W4 regression test (O-C grounding fix, 2026-07-09): parseItems (private to
 * operationalTool.ts) used to keep only title/description/impact/effort/...
 * and silently drop confidence/evidenceType/derivation/rationale/state/
 * requires_evidence — even when the AI response (following GROUNDING_RULES)
 * correctly marked a number as a hypothesis, the marking never reached the
 * stored item. Exercised indirectly through applyOperationalPendingAction
 * since parseItems itself is not exported (keeps the public surface small).
 */
describe('operationalTool — grounding metadata pass-through (W4)', () => {
  const baseOperationalData: OperationalToolData = {
    context: { goal: 'g', scope: 's', successSignal: 'ss', constraints: 'c' } as any,
    sections: { diagnose: [] },
  };

  const makeActions = () => ({
    updateInputData: vi.fn(),
    setInitiatives: vi.fn(),
    setSessionGenerationStatus: vi.fn(),
  });

  it('passes through confidence/evidenceType/derivation/rationale/state/requires_evidence for "suggestions"', () => {
    const actions = makeActions();
    applyOperationalPendingAction({
      pendingAction: 'suggestions',
      currentStepId: 'diagnose',
      operationalData: baseOperationalData,
      toolType: 'sop-builder' as any,
      actions,
      parsed: {
        items: [
          {
            title: 'Hypothetical saving',
            description: 'Estimated ROI',
            impact: 'high',
            effort: 'low',
            confidence: 2,
            evidenceType: 'assumption',
            derivation: 'savings = Δdeviations × GMV × margin = 120 × 45000 × 0.08',
            rationale: 'No client financials in session input; directional estimate only.',
            state: 'proposed',
            requires_evidence: true,
          },
        ],
      },
    });

    expect(actions.updateInputData).toHaveBeenCalledTimes(1);
    const call = actions.updateInputData.mock.calls[0][0];
    const item = call.sections.diagnose[0];
    expect(item.title).toBe('Hypothetical saving');
    expect(item.confidence).toBe(2);
    expect(item.evidenceType).toBe('assumption');
    expect(item.derivation).toBe('savings = Δdeviations × GMV × margin = 120 × 45000 × 0.08');
    expect(item.rationale).toBe('No client financials in session input; directional estimate only.');
    expect(item.state).toBe('proposed');
    expect(item.requires_evidence).toBe(true);
  });

  it('drops invalid evidenceType/state values instead of passing them through', () => {
    const actions = makeActions();
    applyOperationalPendingAction({
      pendingAction: 'suggestions',
      currentStepId: 'diagnose',
      operationalData: baseOperationalData,
      toolType: 'sop-builder' as any,
      actions,
      parsed: {
        items: [
          {
            title: 'Bad enum values',
            description: 'x',
            evidenceType: 'not-a-real-type',
            state: 'not-a-real-state',
          },
        ],
      },
    });

    const item = actions.updateInputData.mock.calls[0][0].sections.diagnose[0];
    expect(item.evidenceType).toBeUndefined();
    expect(item.state).toBeUndefined();
  });

  it('preserves existing behavior: still parses title/description/impact/effort/category/owner/target/frequency/threshold/durationMinutes without the new optional fields', () => {
    const actions = makeActions();
    applyOperationalPendingAction({
      pendingAction: 'suggestions',
      currentStepId: 'diagnose',
      operationalData: baseOperationalData,
      toolType: 'sop-builder' as any,
      actions,
      parsed: {
        items: [
          {
            title: 'Legacy item',
            description: 'No grounding fields at all',
            impact: 'medium',
            effort: 'medium',
            category: 'process',
            owner: 'Ops Lead',
            target: '95%',
            frequency: 'weekly',
            threshold: '5%',
            durationMinutes: 30,
          },
        ],
      },
    });

    const item = actions.updateInputData.mock.calls[0][0].sections.diagnose[0];
    expect(item.title).toBe('Legacy item');
    expect(item.description).toBe('No grounding fields at all');
    expect(item.impact).toBe('medium');
    expect(item.effort).toBe('medium');
    expect(item.category).toBe('process');
    expect(item.owner).toBe('Ops Lead');
    expect(item.target).toBe('95%');
    expect(item.frequency).toBe('weekly');
    expect(item.threshold).toBe('5%');
    expect(item.durationMinutes).toBe(30);
    expect(item.confidence).toBeUndefined();
    expect(item.evidenceType).toBeUndefined();
    expect(item.derivation).toBeUndefined();
    expect(item.rationale).toBeUndefined();
    expect(item.state).toBeUndefined();
    expect(item.requires_evidence).toBeUndefined();
  });

  it('passes through grounding metadata in "full-session" section items too', () => {
    const actions = makeActions();
    applyOperationalPendingAction({
      pendingAction: 'full-session',
      operationalData: baseOperationalData,
      toolType: 'sop-builder' as any,
      actions,
      parsed: {
        sections: {
          diagnose: [
            {
              title: 'Full session item',
              description: 'desc',
              confidence: 1,
              evidenceType: 'hypothesis',
              derivation: '15h / (4×40h) = 9.4%',
            },
          ],
        },
        summary: { executiveSummary: 'exec', keyInsights: [], appliedConclusions: [] },
        initiatives: [],
      },
    });

    const call = actions.updateInputData.mock.calls[0][0];
    const item = call.sections.diagnose[0];
    expect(item.confidence).toBe(1);
    expect(item.evidenceType).toBe('hypothesis');
    expect(item.derivation).toBe('15h / (4×40h) = 9.4%');
  });
});
