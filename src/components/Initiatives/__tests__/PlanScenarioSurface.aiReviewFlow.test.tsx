/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listPlanScenarioRegister: vi.fn(),
  readPlanScenario: vi.fn(),
  createPlanAnalysisProposal: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  writePlanScenario: vi.fn(),
  writeInitiativeDependencies: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key, i18n: { language: 'en' } }),
}));
vi.mock('@/i18n', () => ({ default: { language: 'en', t: (_key: string, fallback?: string) => fallback ?? _key } }));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  ...api,
  listPlannableInitiatives: vi.fn(async () => ({ initiatives: [] })),
  listCapacityScenarioRegister: vi.fn(async () => ({ scenarios: [] })),
  readCapacityScenario: vi.fn(),
  listPlanAnalysisProposals: vi.fn(async () => ({ items: [] })),
  registerInitiativeForPlanning: vi.fn(),
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(async () => ({ versions: [] })),
  RuntimeApiError: class RuntimeApiError extends Error {},
}));
vi.mock('../cards/PlanCard', () => ({
  PlanCard: (props: any) => (
    <div>
      <button onClick={() => props.onAnalyze('DEPENDENCIES')}>Run AI</button>
      {props.proposal?.analysisSource === 'AI' && (
        <button
          onClick={() =>
            props.onReview('ACCEPT', [
              {
                observationId: 'obs-a-b',
                outcome: 'ACCEPTED',
                humanComment: 'Confirmed by the program owner.',
                finalObservation: props.proposal.dependencyObservations[0],
              },
            ])
          }
        >
          Apply review
        </button>
      )}
    </div>
  ),
}));

import { PlanScenarioSurface } from '../PlanScenarioSurface';

const windows = [
  { initiativeId: 'b', initiativeVersion: 1, earliest: null, target: null, latest: null, confidence: 'UNKNOWN', rationale: '', dependencySnapshot: [], constraintSnapshot: [] },
  { initiativeId: 'a', initiativeVersion: 1, earliest: null, target: null, latest: null, confidence: 'UNKNOWN', rationale: '', dependencySnapshot: [], constraintSnapshot: [] },
];
const scenario = {
  scenarioId: 'plan-ai', name: 'AI plan', scenarioVersion: 1, status: 'DRAFT',
  portfolioScenarioId: 'portfolio', portfolioScenarioVersion: 1, windowUnit: 'WEEK', timezone: 'Europe/Warsaw',
  periods: [{ periodId: 'W1', start: '2026-09-14T00:00:00.000Z', end: '2026-09-21T00:00:00.000Z' }],
  windows, assumptions: [], createdBy: 'owner', updatedBy: 'owner', publishedBy: null, publishedAt: null,
};
const observation = {
  observationId: 'obs-a-b', predecessorId: 'a', successorId: 'b', kind: 'ABSOLUTE', condition: null,
  rationale: 'A provides B input.', evidenceRefs: ['deliverables'], confidence: 'HIGH',
};

describe('PlanScenarioSurface AI dependency review flow', () => {
  it('requests AI analysis and applies approved dependencies plus logical order through canonical writers', async () => {
    api.listPlanScenarioRegister.mockResolvedValue({ scenarios: [{ id: 'plan-ai', name: 'AI plan', state: 'DRAFT', version: 1, portfolioRef: { scenarioId: 'portfolio', scenarioVersion: 1 }, window: { earliest: null, latest: null }, updatedAt: '2026-09-14T00:00:00.000Z', timeBasis: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: scenario.periods, knowledgeState: 'KNOWN' } }] });
    api.readPlanScenario.mockResolvedValue({ version: 1, scenario });
    api.createPlanAnalysisProposal.mockResolvedValue({ response: { proposalId: 'proposal', inputAggregateVersion: 1, inputScenarioVersion: 1, status: 'PENDING_REVIEW', assumptions: [], rationale: '', conflicts: [], changes: [], analysisSource: 'AI', dependencyObservations: [observation], criticalPaths: [] } });
    api.writeInitiativeDependencies.mockResolvedValue({ dependsOn: ['a'] });
    api.writePlanScenario.mockImplementation(async (_id, command) => ({ aggregateVersion: 2, response: command.scenario }));
    api.reviewPlanAnalysisProposal.mockResolvedValue({ response: { status: 'ACCEPTED' } });

    render(<MemoryRouter><PlanScenarioSurface activePreset="all" initiatives={[{ id: 'a', name: 'Foundation' }, { id: 'b', name: 'Rollout' }]} /></MemoryRouter>);
    const planLabels = await screen.findAllByText('AI plan');
    fireEvent.doubleClick(planLabels[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Run AI' }));
    await waitFor(() => expect(api.createPlanAnalysisProposal).toHaveBeenCalled());
    expect(api.createPlanAnalysisProposal.mock.calls[0][2]).toMatchObject({ analysisKind: 'AI_DEPENDENCY', useCapacity: false });

    fireEvent.click(await screen.findByRole('button', { name: 'Apply review' }));
    await waitFor(() => expect(api.reviewPlanAnalysisProposal).toHaveBeenCalled());
    expect(api.writeInitiativeDependencies).toHaveBeenCalledWith('b', expect.objectContaining({ dependsOn: ['a'] }));
    expect(api.writePlanScenario.mock.calls.at(-1)?.[1].scenario.windows.map((item: any) => item.initiativeId)).toEqual(['a', 'b']);
    expect(api.reviewPlanAnalysisProposal.mock.calls[0][1].observationReviews[0]).toMatchObject({ outcome: 'ACCEPTED', humanComment: 'Confirmed by the program owner.' });
  });
});
