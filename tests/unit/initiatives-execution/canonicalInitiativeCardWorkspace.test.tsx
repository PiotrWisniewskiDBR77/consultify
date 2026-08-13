import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanonicalInitiativeCardWorkspace } from '../../../src/components/Initiatives/CanonicalInitiativeCardWorkspace';
import {
  createDefinitionRemediationWork,
  createMaterialChange,
  decideDefinition,
  listMyAnalysisDecisions,
  listMyDefinitionDecisions,
  publishInitiativeCard,
  readAnalysisReadiness,
  readDefinitionReadiness,
  readInitiativeCapabilities,
  readInitiativeCards,
  readRegisteredInitiative,
  refreshInitiativeSource,
  requestAnalysisDecision,
  requestDefinitionDecision,
  requestScheduleDecision,
  reviewInitiativeCard,
  startInitiativeAnalysis,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', async () => {
  class RuntimeApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string
    ) {
      super(code);
    }
  }
  return {
    RuntimeApiError,
    readRegisteredInitiative: vi.fn(),
    readInitiativeCards: vi.fn(),
    readDefinitionReadiness: vi.fn(),
    readAnalysisReadiness: vi.fn(),
    readInitiativeCapabilities: vi.fn(),
    listMyDefinitionDecisions: vi.fn(),
    listMyAnalysisDecisions: vi.fn(),
    publishInitiativeCard: vi.fn(),
    reviewInitiativeCard: vi.fn(),
    requestDefinitionDecision: vi.fn(),
    decideDefinition: vi.fn(),
    createDefinitionRemediationWork: vi.fn(),
    createMaterialChange: vi.fn(),
    refreshInitiativeSource: vi.fn(),
    startInitiativeAnalysis: vi.fn(),
    requestAnalysisDecision: vi.fn(),
    requestScheduleDecision: vi.fn(),
  };
});

const initiative = {
  version: 1,
  updatedAt: '2026-08-09T20:00:00.000Z',
  initiative: {
    initiativeId: 'initiative-card-ui',
    lifecycleState: 'REGISTERED_DRAFT' as const,
    title: 'Automated Changeover Optimization',
    projectId: 'project-a',
    readiness: 'NOT_EVALUATED' as const,
    source: {
      proposalId: 'proposal-a',
      proposalVersion: 2,
      sourceType: 'assessment',
      sourceId: 'finding-a',
      sourceVersion: 3,
    },
  },
};

const readiness = {
  initiativeId: 'initiative-card-ui',
  initiativeVersion: 1,
  lifecycleState: 'REGISTERED_DRAFT',
  readiness: 'NOT_READY' as const,
  cardVersions: {},
  findings: [],
};

describe('CanonicalInitiativeCardWorkspace', () => {
  beforeEach(() => {
    vi.mocked(readRegisteredInitiative).mockReset().mockResolvedValue(initiative);
    vi.mocked(readInitiativeCards)
      .mockReset()
      .mockResolvedValue({ initiativeVersion: 1, cards: [] });
    vi.mocked(readDefinitionReadiness).mockReset().mockResolvedValue(readiness);
    vi.mocked(readAnalysisReadiness).mockReset().mockResolvedValue(readiness);
    vi.mocked(readInitiativeCapabilities).mockReset().mockResolvedValue({
      actorId: 'initiative-owner',
      canView: true,
      canUpdate: true,
      canReview: true,
      canSelfApprove: false,
    });
    vi.mocked(listMyDefinitionDecisions).mockReset().mockResolvedValue([]);
    vi.mocked(listMyAnalysisDecisions).mockReset().mockResolvedValue([]);
    vi.mocked(publishInitiativeCard)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2, cardVersion: 1 });
    vi.mocked(createMaterialChange).mockReset().mockResolvedValue({ status: 'APPLIED' });
    vi.mocked(reviewInitiativeCard)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2, cardVersion: 2 });
    vi.mocked(requestDefinitionDecision)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
    vi.mocked(decideDefinition)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 3 });
    vi.mocked(createDefinitionRemediationWork)
      .mockReset()
      .mockResolvedValue({
        status: 'APPLIED',
        aggregateVersion: 2,
        response: {
          initiativeId: 'initiative-card-ui',
          findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
          taskId: 'task-1',
          decisionId: 'decision-1',
        },
      });
    vi.mocked(refreshInitiativeSource)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
    vi.mocked(startInitiativeAnalysis)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
    vi.mocked(requestAnalysisDecision)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
    vi.mocked(requestScheduleDecision)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
  });

  it('requests Schedule Decision with exact scenario refs and a frozen card handoff snapshot', async () => {
    vi.mocked(readRegisteredInitiative).mockResolvedValue({
      ...initiative,
      initiative: { ...initiative.initiative, lifecycleState: 'APPROVED_BACKLOG' },
    });
    render(<CanonicalInitiativeCardWorkspace initiativeId="initiative-card-ui" onBack={vi.fn()} />);
    await screen.findByRole('region', { name: 'Schedule readiness' });
    fireEvent.change(screen.getByLabelText('Schedule Portfolio reference'), {
      target: { value: 'portfolio-1@3' },
    });
    fireEvent.change(screen.getByLabelText('Schedule Plan reference'), {
      target: { value: 'plan-1@4' },
    });
    fireEvent.change(screen.getByLabelText('Schedule Capacity reference'), {
      target: { value: 'capacity-1@2' },
    });
    fireEvent.change(screen.getByLabelText('Schedule commitment IDs'), {
      target: { value: 'commitment-1' },
    });
    fireEvent.change(screen.getByLabelText('Schedule critical period IDs'), {
      target: { value: 'period-1' },
    });
    fireEvent.change(screen.getByLabelText('Schedule authority'), {
      target: { value: 'authority-1' },
    });
    fireEvent.change(screen.getByLabelText('Schedule Execution Manager'), {
      target: { value: 'manager-1' },
    });
    fireEvent.change(screen.getByLabelText('Schedule Decision due'), {
      target: { value: '2026-08-20T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request Schedule Decision' }));
    await waitFor(() =>
      expect(requestScheduleDecision).toHaveBeenCalledWith(
        'initiative-card-ui',
        expect.objectContaining({
          expectedVersion: 1,
          portfolioScenarioId: 'portfolio-1',
          portfolioScenarioVersion: 3,
          planScenarioId: 'plan-1',
          planScenarioVersion: 4,
          capacityScenarioId: 'capacity-1',
          capacityScenarioVersion: 2,
          commitmentIds: ['commitment-1'],
          criticalPeriodIds: ['period-1'],
          handoff: expect.objectContaining({ sourceVersions: { initiative: 1 } }),
        })
      )
    );
  });

  it('publishes a content version without self-accepting its review', async () => {
    render(<CanonicalInitiativeCardWorkspace initiativeId="initiative-card-ui" onBack={vi.fn()} />);
    expect(await screen.findByText('Automated Changeover Optimization')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Summary \/ ScopeEMPTY/ }));
    fireEvent.change(screen.getByLabelText('problem'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('outcome'), { target: { value: 'Outcome' } });
    fireEvent.change(screen.getByLabelText('inScope'), { target: { value: 'Line 4' } });
    fireEvent.change(screen.getByLabelText('outOfScope'), { target: { value: 'Line 5' } });
    fireEvent.change(screen.getByLabelText('Completion'), { target: { value: 'COMPLETE' } });
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: 'SUFFICIENT' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish first version/ }));
    await waitFor(() => expect(publishInitiativeCard).toHaveBeenCalled());
    expect(publishInitiativeCard).toHaveBeenCalledWith(
      'initiative-card-ui',
      'summary-scope',
      expect.objectContaining({
        expectedVersion: 1,
        expectedCardVersion: 0,
        completion: 'COMPLETE',
        reviewState: 'NOT_REQUESTED',
      })
    );
    expect(screen.queryByRole('button', { name: 'Accept review' })).not.toBeInTheDocument();
  });

  it('replaces an edit of published truth with a material-change proposal', async () => {
    vi.mocked(readInitiativeCards).mockResolvedValue({
      initiativeVersion: 7,
      cards: [
        {
          cardKey: 'summary-scope',
          cardVersion: 2,
          aggregateVersion: 7,
          applicability: 'REQUIRED',
          completion: 'COMPLETE',
          quality: 'SUFFICIENT',
          freshness: 'CURRENT',
          reviewState: 'ACCEPTED',
          content: { problem: 'Old truth', outcome: 'Old outcome', inScope: [], outOfScope: [] },
          evidenceRefs: [],
          waiverDecisionId: null,
        },
      ],
    });
    render(<CanonicalInitiativeCardWorkspace initiativeId="initiative-card-ui" onBack={vi.fn()} />);
    await screen.findByDisplayValue('Old truth');
    fireEvent.change(screen.getByLabelText('problem'), { target: { value: 'New truth' } });
    fireEvent.change(screen.getByLabelText('Material change authority'), {
      target: { value: 'authority-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create change proposal/ }));
    await waitFor(() =>
      expect(createMaterialChange).toHaveBeenCalledWith(
        expect.stringContaining('material-initiative-card-ui-summary-scope'),
        expect.objectContaining({
          target: expect.objectContaining({
            kind: 'INITIATIVE_CARD',
            version: 2,
            initiativeVersion: 7,
          }),
          oldSnapshot: expect.objectContaining({ problem: 'Old truth' }),
          newSnapshot: expect.objectContaining({ problem: 'New truth' }),
          classification: 'MATERIAL',
          authorityId: 'authority-2',
        })
      )
    );
    expect(publishInitiativeCard).not.toHaveBeenCalled();
  });

  it('refreshes the exact newer source snapshot with a stable governed command', async () => {
    vi.mocked(readDefinitionReadiness).mockResolvedValue({
      ...readiness,
      readiness: 'BLOCKED',
      sourceStatus: {
        proposalId: 'proposal-a',
        snapshotProposalVersion: 2,
        currentProposalVersion: 4,
        snapshotSourceVersion: 3,
        currentSourceVersion: 4,
        evidenceState: 'READY',
        freshness: 'STALE',
      },
      findings: [
        {
          findingId: 'definition:summary-scope:SOURCE_SNAPSHOT_STALE',
          cardKey: 'summary-scope',
          severity: 'BLOCKER',
          rule: 'SOURCE_SNAPSHOT_STALE',
          evidenceRefs: [],
          message: 'Source changed.',
        },
      ],
    });
    render(<CanonicalInitiativeCardWorkspace initiativeId="initiative-card-ui" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh source v4' }));
    await waitFor(() =>
      expect(refreshInitiativeSource).toHaveBeenCalledWith(
        'initiative-card-ui',
        expect.objectContaining({
          expectedVersion: 1,
          expectedProposalVersion: 4,
          expectedSourceVersion: 4,
        })
      )
    );
  });

  it('opens the exact deep-linked card and finding in the canonical shell', async () => {
    vi.mocked(readDefinitionReadiness).mockResolvedValue({
      ...readiness,
      findings: [
        {
          findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
          cardKey: 'financial-analysis',
          severity: 'BLOCKER',
          rule: 'EVIDENCE_REQUIRED',
          evidenceRefs: [],
          message: 'Finance evidence is required.',
        },
      ],
    });
    render(
      <CanonicalInitiativeCardWorkspace
        initiativeId="initiative-card-ui"
        initialCardKey="financial-analysis"
        initialFindingId="definition:financial-analysis:EVIDENCE_REQUIRED"
        onBack={vi.fn()}
      />
    );

    expect(await screen.findByRole('main', { name: 'Financial Analysis' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /BLOCKER: Finance evidence is required/ })
    ).toHaveAttribute('aria-current', 'true');
    expect(
      screen.getAllByText(/definition:financial-analysis:EVIDENCE_REQUIRED/).length
    ).toBeGreaterThan(0);
  });

  it('opens a selected card with Enter, reports context, and returns with Back', async () => {
    const onBack = vi.fn();
    const onContextChange = vi.fn();
    render(
      <CanonicalInitiativeCardWorkspace
        initiativeId="initiative-card-ui"
        onBack={onBack}
        onContextChange={onContextChange}
      />
    );
    await screen.findByText('Automated Changeover Optimization');
    const strategicFit = screen.getByRole('button', { name: /Strategic FitEMPTY/ });
    strategicFit.focus();
    fireEvent.keyDown(strategicFit, { key: 'Enter' });

    expect(screen.getByRole('main', { name: 'Strategic Fit' })).toHaveFocus();
    expect(onContextChange).toHaveBeenCalledWith({
      initiativeId: 'initiative-card-ui',
      cardKey: 'strategic-fit',
      findingId: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows exact Analysis findings and starts analysis without adding a top-level surface', async () => {
    vi.mocked(readRegisteredInitiative).mockResolvedValue({
      ...initiative,
      initiative: { ...initiative.initiative, lifecycleState: 'DEFINED' },
    });
    vi.mocked(readAnalysisReadiness).mockResolvedValue({
      ...readiness,
      lifecycleState: 'DEFINED',
      readiness: 'BLOCKED',
      findings: [
        {
          findingId: 'analysis:financial-analysis:EVIDENCE_REQUIRED',
          cardKey: 'financial-analysis',
          severity: 'BLOCKER',
          rule: 'EVIDENCE_REQUIRED',
          evidenceRefs: [],
          message: 'Governed evidence is required.',
        },
      ],
    });
    render(
      <CanonicalInitiativeCardWorkspace
        initiativeId="initiative-card-ui"
        initialCardKey="financial-analysis"
        onBack={vi.fn()}
      />
    );
    expect(await screen.findByText('Analysis · BLOCKED')).toBeInTheDocument();
    expect(screen.getByText('analysis:financial-analysis:EVIDENCE_REQUIRED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
    await waitFor(() =>
      expect(startInitiativeAnalysis).toHaveBeenCalledWith(
        'initiative-card-ui',
        expect.objectContaining({ expectedVersion: 1 })
      )
    );
  });
});
