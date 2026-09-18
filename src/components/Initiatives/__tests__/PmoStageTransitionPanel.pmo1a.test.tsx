import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listLog = vi.fn();
const requestDecision = vi.fn();
const requestAnalysis = vi.fn();
const startAnalysis = vi.fn();
const readRegisteredInitiative = vi.fn();
const run = vi.fn();
const reload = vi.fn();
const lifecycle = vi.hoisted(() => ({
  targetStatus: 'READY_FOR_DECISION' as string,
  transitionCaseStatus: 'ready' as 'ready' | 'missing' | 'ambiguous' | 'execution_context_missing' | 'source_not_ready',
  transitions: null as
    | Array<{
        targetStatus: string;
        roleAllowed: boolean;
        conditionSatisfied: boolean;
        blockingItems: Array<{ key: string; label: string }>;
        requiredRoles: string[];
      }>
    | null,
}));

vi.mock('@/services/initiativeTransitionInboxApi', () => ({
  listLifecycleGateDecisions: (...args: unknown[]) => listLog(...args),
  requestTransitionDecision: (...args: unknown[]) => requestDecision(...args),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  readRegisteredInitiative: (...args: unknown[]) => readRegisteredInitiative(...args),
  requestAnalysisDecision: (...args: unknown[]) => requestAnalysis(...args),
  startInitiativeAnalysis: (...args: unknown[]) => startAnalysis(...args),
}));

vi.mock('../lifecycle/useInitiativeLifecycle', () => ({
  useInitiativeLifecycle: () => {
    const transitions =
      lifecycle.transitions ??
      [
        {
          targetStatus: lifecycle.targetStatus,
          roleAllowed: true,
          conditionSatisfied: true,
          blockingItems: [],
          requiredRoles: ['SPONSOR'],
        },
      ];
    const primary = transitions.find((item) => item.targetStatus === lifecycle.targetStatus);
    return {
      actions: [
        {
          id: `transition:${lifecycle.targetStatus}`,
          kind: 'transition',
          gate: 'SUBMIT_FOR_REVIEW',
          targetStatus: lifecycle.targetStatus,
          label: 'Submit for review',
          variant: 'primary',
          disabled: primary ? !primary.conditionSatisfied : false,
          disabledReason: primary?.conditionSatisfied === false ? 'Missing readiness' : '',
          requiresReason: false,
        },
      ],
      loading: false,
      loadError: null,
      pendingActionId: null,
      preflight: {
        currentStatus: lifecycle.targetStatus === 'ANALYZING' ? 'DEFINED' : 'ANALYZING',
        transitions,
        transitionCase: {
          status: lifecycle.transitionCaseStatus,
          transformationCaseId: lifecycle.transitionCaseStatus === 'ready' ? 'case-1' : null,
        },
        flags: [],
      },
      run,
      reload,
    };
  },
}));

import { PmoStageTransitionPanel } from '../PmoStageTransitionPanel';

describe('PmoStageTransitionPanel PMO-1a wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycle.targetStatus = 'READY_FOR_DECISION';
    lifecycle.transitionCaseStatus = 'ready';
    lifecycle.transitions = null;
    readRegisteredInitiative.mockResolvedValue({
      version: 11,
      initiative: { initiativeId: 'initiative-1' },
    });
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





  it('uses the runtime aggregate version when the legacy-first card has no canonicalVersion for analysis requests', async () => {
    lifecycle.targetStatus = 'READY_FOR_DECISION';
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={null}
        reviewerUserId="sponsor-1"
      />
    );

    await waitFor(() => expect(readRegisteredInitiative).toHaveBeenCalledWith('initiative-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Request decision' }));

    await waitFor(() =>
      expect(requestAnalysis).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({ expectedVersion: 11, authorityId: 'sponsor-1' })
      )
    );
  });

  it('shows blockers only for the primary transition and deduplicates readiness keys', async () => {
    lifecycle.targetStatus = 'SCHEDULED';
    lifecycle.transitions = [
      {
        targetStatus: 'SCHEDULED',
        roleAllowed: true,
        conditionSatisfied: false,
        blockingItems: [
          { key: 'schedule_milestones', label: 'Milestones defined' },
          { key: 'schedule_milestones', label: 'Milestones defined' },
        ],
        requiredRoles: ['SPONSOR'],
      },
      {
        targetStatus: 'IN_EXECUTION',
        roleAllowed: true,
        conditionSatisfied: false,
        blockingItems: [{ key: 'schedule_milestones', label: 'Milestones defined' }],
        requiredRoles: ['PMO'],
      },
    ];

    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={7}
        reviewerUserId="sponsor-1"
      />
    );

    await screen.findByText('Irina Dubois');
    expect(screen.getAllByText('Milestones defined')).toHaveLength(1);
    expect(screen.getByText('SPONSOR')).toBeInTheDocument();
    expect(screen.queryByText('PMO')).not.toBeInTheDocument();
  });

  it('does not require canonicalVersion for a 7-code lifecycle proposal when transition case lineage is ready', async () => {
    lifecycle.targetStatus = 'IN_EXECUTION';
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={null}
        reviewerUserId="sponsor-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request decision' }));
    await waitFor(() =>
      expect(requestDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          initiativeId: 'initiative-1',
          reviewerUserId: 'sponsor-1',
          targetStatus: 'EXECUTING',
        })
      )
    );
  });


  it('disables a ready D-37 proposal when the reviewer is the current actor', async () => {
    lifecycle.targetStatus = 'IN_EXECUTION';
    lifecycle.transitionCaseStatus = 'ready';
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={null}
        reviewerUserId="sponsor-1"
        currentUserId="sponsor-1"
      />
    );

    await screen.findByText('Irina Dubois');

    const requestButton = screen.getByRole('button', { name: 'Request decision' });
    expect(requestButton).toBeDisabled();
    expect(screen.getByTestId('pmo-decision-request-blocked-reason')).toHaveTextContent(
      'reviewer other than yourself'
    );
    fireEvent.click(requestButton);
    expect(requestDecision).not.toHaveBeenCalled();
  });

  it('keeps the decision request disabled with an honest reason when D-37 lineage is missing', async () => {
    lifecycle.targetStatus = 'IN_EXECUTION';
    lifecycle.transitionCaseStatus = 'missing';
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={null}
        reviewerUserId="sponsor-1"
      />
    );

    await screen.findByText('Irina Dubois');

    const requestButton = screen.getByRole('button', { name: 'Request decision' });
    expect(requestButton).toBeDisabled();
    expect(screen.getByTestId('pmo-decision-request-blocked-reason')).toHaveTextContent(
      'not linked to a transformation case'
    );
    fireEvent.click(requestButton);
    expect(requestDecision).not.toHaveBeenCalled();
  });


  it('keeps a disabled decision request honest when the transition target is outside the PMO proposal map', async () => {
    lifecycle.targetStatus = 'APPROVED';
    render(
      <PmoStageTransitionPanel
        initiativeId="initiative-1"
        expectedVersion={7}
        reviewerUserId="sponsor-1"
      />
    );

    await screen.findByText('Irina Dubois');

    const requestButton = screen.getByRole('button', { name: 'Request decision' });
    expect(requestButton).toBeDisabled();
    expect(screen.getByTestId('pmo-decision-request-blocked-reason')).toHaveTextContent(
      'not supported by the PMO decision request yet'
    );
    fireEvent.click(requestButton);
    expect(requestDecision).not.toHaveBeenCalled();
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
