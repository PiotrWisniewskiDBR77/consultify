/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | Record<string, unknown>) =>
      typeof options === 'string' ? options : `${key}${options && 'count' in options ? `:${options.count}` : ''}`,
  }),
}));

import { PlanDependencyAnalysisPanel } from '../PlanDependencyAnalysisPanel';

const proposal = {
  status: 'PENDING_REVIEW',
  analysisSource: 'AI' as const,
  analysisModel: 'gpt-plan',
  dependencyObservations: [
    {
      observationId: 'obs-1',
      predecessorId: 'a',
      successorId: 'b',
      kind: 'ABSOLUTE' as const,
      condition: null,
      rationale: 'A creates the operating input required by B.',
      evidenceRefs: ['deliverables'],
      confidence: 'HIGH' as const,
    },
    {
      observationId: 'obs-2',
      predecessorId: 'b',
      successorId: 'c',
      kind: 'CONDITIONAL' as const,
      condition: 'When the production cohort is used.',
      rationale: 'C uses the production cohort produced by B.',
      evidenceRefs: ['scopeIn'],
      confidence: 'MEDIUM' as const,
    },
  ],
  criticalPaths: [
    {
      pathId: 'path-1',
      kind: 'ABSOLUTE' as const,
      initiativeIds: ['a', 'b'],
      condition: null,
      rationale: 'Hard delivery gate.',
    },
  ],
};

describe('PlanDependencyAnalysisPanel', () => {
  it('supports item and bulk review, persists edits and distinguishes critical path kinds', () => {
    const onReview = vi.fn();
    render(
      <PlanDependencyAnalysisPanel
        proposal={proposal}
        editable
        resolveName={(id) => ({ a: 'Foundation', b: 'Rollout', c: 'Training' })[id] ?? id}
        onReview={onReview}
      />
    );

    expect(screen.getAllByText(/Foundation → Rollout/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Rollout → Training/)).toBeInTheDocument();
    expect(screen.getAllByText('initiatives.planAnalysis.kind.ABSOLUTE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('initiatives.planAnalysis.kind.CONDITIONAL').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('combobox', { name: 'initiatives.planAnalysis.dependencyType' })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'initiatives.planAnalysis.dependencyType' })
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'initiatives.planAnalysis.acceptAll' }));
    const rationale = screen.getAllByLabelText('initiatives.planAnalysis.rationale')[0];
    fireEvent.change(rationale, { target: { value: 'Reviewer-confirmed operating dependency.' } });
    const comments = screen.getAllByLabelText('initiatives.planAnalysis.humanComment');
    fireEvent.change(comments[0], { target: { value: 'Confirmed with the delivery owner.' } });
    fireEvent.click(screen.getByLabelText('initiatives.planAnalysis.conditionActive'));
    fireEvent.click(screen.getByRole('button', { name: /initiatives.planAnalysis.applyAccepted:2/ }));

    expect(onReview).toHaveBeenCalledWith(
      'ACCEPT',
      expect.arrayContaining([
        expect.objectContaining({
          observationId: 'obs-1',
          outcome: 'ACCEPTED',
          conditionActive: null,
          humanComment: 'Confirmed with the delivery owner.',
          finalObservation: expect.objectContaining({
            rationale: 'Reviewer-confirmed operating dependency.',
          }),
        }),
        expect.objectContaining({
          observationId: 'obs-2',
          outcome: 'ACCEPTED',
          conditionActive: true,
          finalObservation: expect.objectContaining({
            kind: 'CONDITIONAL',
            condition: 'When the production cohort is used.',
          }),
        }),
      ])
    );
  });
});
