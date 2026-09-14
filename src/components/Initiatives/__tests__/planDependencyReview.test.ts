import { describe, expect, it } from 'vitest';

import { applyDependencyObservationReviews, type ObservationReview } from '../planDependencyReview';

const windowFor = (initiativeId: string, dependencySnapshot: string[] = []) => ({
  initiativeId,
  earliest: null,
  target: null,
  latest: null,
  rationale: '',
  dependencySnapshot,
  constraintSnapshot: [],
});

const review = (
  observationId: string,
  predecessorId: string,
  successorId: string,
  outcome: ObservationReview['outcome'] = 'ACCEPTED',
  kind: ObservationReview['finalObservation']['kind'] = 'ABSOLUTE',
  conditionActive: boolean | null = null
): ObservationReview => ({
  observationId,
  outcome,
  conditionActive,
  humanComment: outcome === 'ACCEPTED' ? 'Confirmed after reviewing the delivery evidence.' : '',
  finalObservation: {
    observationId,
    predecessorId,
    successorId,
    kind,
    condition: kind === 'CONDITIONAL' ? 'The rollout uses the production cohort.' : null,
    rationale: 'The predecessor produces the required input.',
    evidenceRefs: ['deliverables'],
    confidence: 'HIGH',
  },
});

describe('applyDependencyObservationReviews', () => {
  it('persists only accepted observations and produces a stable logical order', () => {
    const result = applyDependencyObservationReviews(
      [windowFor('C'), windowFor('A'), windowFor('B')],
      [review('o1', 'A', 'B'), review('o2', 'B', 'C'), review('o3', 'C', 'A', 'REJECTED')]
    );

    expect(result.map((item) => item.initiativeId)).toEqual(['A', 'B', 'C']);
    expect(result.find((item) => item.initiativeId === 'B')?.dependencySnapshot).toEqual(['A']);
    expect(result.find((item) => item.initiativeId === 'C')?.dependencySnapshot).toEqual(['B']);
    expect(result.find((item) => item.initiativeId === 'A')?.dependencySnapshot).toEqual([]);
  });

  it('retains existing human dependencies while adding an accepted proposal', () => {
    const result = applyDependencyObservationReviews(
      [windowFor('A'), windowFor('B'), windowFor('C', ['A'])],
      [review('o1', 'B', 'C')]
    );
    expect(result.find((item) => item.initiativeId === 'C')?.dependencySnapshot).toEqual(['A', 'B']);
  });

  it('preserves conditional edges and hardens only a condition that is currently active', () => {
    const result = applyDependencyObservationReviews(
      [windowFor('C'), windowFor('A'), windowFor('B')],
      [
        review('inactive', 'A', 'B', 'ACCEPTED', 'CONDITIONAL', false),
        review('active', 'B', 'C', 'ACCEPTED', 'CONDITIONAL', true),
      ]
    );

    expect(result.map((item) => item.initiativeId)).toEqual(['A', 'B', 'C']);
    expect(result.find((item) => item.initiativeId === 'B')).toMatchObject({
      dependencySnapshot: [],
      conditionalDependencySnapshot: [
        {
          predecessorId: 'A',
          condition: 'The rollout uses the production cohort.',
          active: false,
        },
      ],
    });
    expect(result.find((item) => item.initiativeId === 'C')).toMatchObject({
      dependencySnapshot: [],
      conditionalDependencySnapshot: [
        {
          predecessorId: 'B',
          condition: 'The rollout uses the production cohort.',
          active: true,
        },
      ],
    });
  });
});
