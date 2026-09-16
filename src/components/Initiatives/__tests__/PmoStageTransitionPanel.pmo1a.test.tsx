import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listLog = vi.fn();
const requestDecision = vi.fn();
const requestAnalysis = vi.fn();
const startAnalysis = vi.fn();
const run = vi.fn();
const reload = vi.fn();
const lifecycle = vi.hoisted(() => ({ targetStatus: 'READY_FOR_DECISION' as string }));

vi.mock('@/services/initiativeTransitionInboxApi', () => ({
  listLifecycleGateDecisions: (...args: unknown[]) => listLog(...args),
  requestTransitionDecision: (...args: unknown[]) => requestDecision(...args),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  requestAnalysisDecision: (...args: unknown[]) => requestAnalysis(...args),
  startInitiativeAnalysis: (...args: unknown[]) => startAnalysis(...args),
}));

vi.mock('../lifecycle/useInitiativeLifecycle', () => ({
  useInitiativeLifecycle: () => ({
    actions: [
      {
        id: `transition:${lifecycle.targetStatus}`,
        kind: 'transition',
        gate: 'SUBMIT_FOR_REVIEW',
        targetStatus: lifecycle.targetStatus,
        label: 'Submit for review',
        variant: 'primary',
        disabled: false,
        disabledReason: '',
        requiresReason: false,
      },
    ],
    loading: false,
    loadError: null,
    pendingActionId: null,
    preflight: {
      currentStatus: lifecycle.targetStatus === 'ANALYZING' ? 'DEFINED' : 'ANALYZING',
      transitions: [
        {
          targetStatus: lifecycle.targetStatus,
          roleAllowed: true,
          conditionSatisfied: true,
          blockingItems: [],
          requiredRoles: ['SPONSOR'],
        },
      ],
      flags: [],
    },
    run,
    reload,
  }),
}));

import { PmoStageTransitionPanel } from '../PmoStageTransitionPanel';

describe('PmoStageTransitionPanel PMO-1a wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycle.targetStatus = 'READY_FOR_DECISION';
    listLog.mockResolvedValue([
      {
        decisionId: 'decision-1',
        pmoDomain: 'PORTFOLIO_GO',
        version: 1,
        decisionStatus: 'approved',
        rationale: 'Business case accepted.',
        decidedAt: '2026-09-16T12:00:00Z',
        humanActorName: 'Irina Dubois',
      },
    ]);
    requestDecision.mockResolvedValue({ proposalVersionId: 'proposal-1' });
    run.mockResolvedValue(null);
    reload.mockResolvedValue(undefined);
  });

  it('starts canonical analysis for the 2→3 boundary', async () => {
    lifecycle.targetStatus = 'ANALYZING';
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={7}
        reviewerUserId="pmo-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request decision' }));
    await waitFor(() =>
      expect(startAnalysis).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({ expectedVersion: 7 })
      )
    );
    expect(requestDecision).not.toHaveBeenCalled();
  });

  it('renders server preflight and immutable actor log, then creates a proposal', async () => {
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={7}
        reviewerUserId="sponsor-1"
      />
    );

    expect(screen.getByText('ANALYZING → READY_FOR_DECISION')).toBeInTheDocument();
    expect(screen.getByText('SPONSOR')).toBeInTheDocument();
    await screen.findByText('Irina Dubois');

    fireEvent.click(screen.getByRole('button', { name: 'Request decision' }));
    await waitFor(() =>
      expect(requestAnalysis).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({ expectedVersion: 7, authorityId: 'sponsor-1' })
      )
    );
  });

  it('applies approval through the canonical lifecycle hook', async () => {
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={7}
        reviewerUserId="sponsor-1"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve transition' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });
});
