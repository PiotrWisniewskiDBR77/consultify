import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransformationCaseDto } from '@/services/api/v8/transformation-cases';

const {
  listMock,
  getMock,
  finalOutputMock,
  runtimeMock,
  reviseMock,
  ideasProposalMock,
  getGovernanceMock,
  reviewScopeMock,
  rejectScopeMock,
  requestRevisionMock,
  reviseGovernanceMock,
  rebaselineMock,
  preparePublicationMock,
  generateFinalOutputsMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  getMock: vi.fn(),
  finalOutputMock: vi.fn(),
  runtimeMock: vi.fn(),
  reviseMock: vi.fn(),
  ideasProposalMock: vi.fn(),
  getGovernanceMock: vi.fn(),
  reviewScopeMock: vi.fn(),
  rejectScopeMock: vi.fn(),
  requestRevisionMock: vi.fn(),
  reviseGovernanceMock: vi.fn(),
  rebaselineMock: vi.fn(),
  preparePublicationMock: vi.fn(),
  generateFinalOutputsMock: vi.fn(),
}));

vi.mock('@/services/api/v8/transformation-cases', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/v8/transformation-cases')>(
    '@/services/api/v8/transformation-cases'
  );
  return {
    ...actual,
    TransformationCasesApi: {
      list: listMock,
      get: getMock,
      getGovernedProposal: getGovernanceMock,
      reviewGovernedProposalScope: reviewScopeMock,
      rejectGovernedProposalScope: rejectScopeMock,
      requestGovernedProposalRevision: requestRevisionMock,
      reviseGovernedProposal: reviseGovernanceMock,
      rebaselineGovernedProposal: rebaselineMock,
      prepareFinalOutputPublication: preparePublicationMock,
      revise: reviseMock,
      getCanonicalRuntime: runtimeMock,
      reconcileCanonicalRuntime: vi.fn(),
      cancel: vi.fn(),
      getInitialIdeasProposal: ideasProposalMock,
      approvePlan: vi.fn(),
      proposeInitialIdeas: vi.fn(),
      reviewInitialIdeasProposal: vi.fn(),
      getInterviewsProposal: vi.fn().mockRejectedValue(new Error('not found')),
      proposeInterviews: vi.fn(),
      reviewInterviewsProposal: vi.fn(),
      acceptInterviewResults: vi.fn(),
      getDrdAssessmentProposal: vi.fn().mockRejectedValue(new Error('not found')),
      proposeDrdAssessment: vi.fn(),
      reviewDrdAssessmentProposal: vi.fn(),
      acceptDrdResults: vi.fn(),
      getOpportunitySynthesisProposal: vi.fn().mockRejectedValue(new Error('not found')),
      proposeOpportunitySynthesis: vi.fn(),
      reviewOpportunitySynthesis: vi.fn(),
      acceptInitiativeResults: vi.fn(),
      getFinanceKpiPackProposal: vi.fn().mockRejectedValue(new Error('not found')),
      proposeFinanceKpiPack: vi.fn(),
      reviewFinanceKpiPack: vi.fn(),
      acceptFinanceKpiResults: vi.fn(),
      getPortfolioDecisionProposal: vi.fn().mockRejectedValue(new Error('not found')),
      proposePortfolioDecision: vi.fn(),
      reviewPortfolioDecision: vi.fn(),
      acceptPortfolioDecisionResults: vi.fn(),
      getMobilizationBlueprintProposal: vi.fn().mockRejectedValue(new Error('not found')),
      proposeMobilizationBlueprint: vi.fn(),
      reviewMobilizationBlueprint: vi.fn(),
      acceptMobilizationResults: vi.fn(),
      getExecutionCheckpoint: vi.fn().mockRejectedValue(new Error('not found')),
      acceptExecutionStart: vi.fn(),
      acceptExecutionResults: vi.fn(),
      getBenefitsCheckpoint: vi.fn().mockRejectedValue(new Error('not found')),
      acceptDeliveryHandoff: vi.fn(),
      acceptBenefitsReview: vi.fn(),
      getSustainabilityCheckpoint: vi.fn().mockRejectedValue(new Error('not found')),
      acceptSustainabilityReview: vi.fn(),
      getLatestFinalOutputs: finalOutputMock,
      generateFinalOutputs: generateFinalOutputsMock,
    },
  };
});

let language = 'pl';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language },
    t: (_key: string, fallback: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

let userRole = 'OWNER';
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector({ currentUser: { id: 'user-1', role: userRole } }),
}));

vi.mock('@/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedItem, renderPreview, renderPreviewFooter }: any) => (
    <div>
      {children}
      {selectedItem ? renderPreview(selectedItem) : null}
      {selectedItem ? renderPreviewFooter?.(selectedItem) : null}
    </div>
  ),
}));

vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data }: any) => <div data-testid="case-table">{data.length}</div>,
}));

vi.mock('@/components/shared/PreviewPane', () => ({
  PreviewActionButton: ({ label, disabled, onClick, ariaDescribedBy, ariaBusy }: any) => (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-describedby={ariaDescribedBy}
      aria-busy={ariaBusy || undefined}
    >
      {label}
    </button>
  ),
  PreviewDetailsSection: ({ text }: any) => <p>{text}</p>,
  PreviewMetaCard: () => <div data-testid="preview-meta" />,
}));

import {
  deriveMobilizationDates,
  deriveTransformationCaseTitle,
  TransformationCasesPanel,
} from '../TransformationCasesPanel';

function makeCase(): TransformationCaseDto {
  return {
    transformationCaseId: 'case-linked',
    organizationId: 'org-1',
    projectId: null,
    conversationId: 'conversation-1',
    contextSnapshotId: 'snapshot-1',
    executionRunId: 'run-1',
    initiatedByUserId: 'user-1',
    mandate: 'Przygotuj plan transformacji operacyjnej',
    desiredOutcomes: [],
    status: 'plan_proposed',
    lifecycleStage: 'mandate',
    autonomyLevel: 'A1_prepare',
    assumptions: [],
    missingInputs: ['Sponsor'],
    activePlanId: 'plan-1',
    lineageId: 'lineage-1',
    version: 1,
    createdAt: '2026-08-07T12:00:00.000Z',
    updatedAt: '2026-08-07T12:00:00.000Z',
    activePlan: {
      planId: 'plan-1',
      version: 1,
      status: 'pending_review',
      summary: 'Plan',
      steps: Array.from({ length: 15 }, (_, index) => ({
        stepId: `step-${index}`,
        stepIndex: index,
        lifecycleStage: `stage-${index}`,
        businessPurpose: `Etap ${index + 1}`,
        moduleTarget: 'Agent',
        capabilityStatus: index === 0 ? 'PARTIAL' : 'NOT_CONNECTED',
        inputs: [],
        outputs: [],
        ownerRole: 'Owner',
        dependsOn: [],
        approvalClass: 'requires_human_approval',
        riskClass: 'safe_additive',
        executionMode: 'background',
        estimatedEffort: '1 h',
        blockerReason: 'Adapter niepodłączony',
      })),
    },
  };
}

describe('TransformationCasesPanel', () => {
  it('uses a concise business outcome instead of exposing the full mandate in the registry', () => {
    const item = makeCase();
    item.desiredOutcomes = ['Skrócić czas od decyzji do mierzalnego rezultatu.'];
    item.mandate = 'Bardzo długi mandat z pełnym zakresem technicznym i operacyjnym.';
    expect(deriveTransformationCaseTitle(item)).toBe(
      'Skrócić czas od decyzji do mierzalnego rezultatu.'
    );
  });

  it('derives future mobilization dates deterministically from the current clock', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2031-02-10T23:30:00.000Z'));
      expect(deriveMobilizationDates()).toEqual({
        startDate: '2031-02-24',
        endDate: '2031-06-24',
      });
    } finally {
      vi.useRealTimers();
    }
  });
  beforeEach(() => {
    language = 'pl';
    userRole = 'OWNER';
    listMock.mockReset().mockResolvedValue([]);
    getMock.mockReset().mockResolvedValue(makeCase());
    finalOutputMock.mockReset().mockRejectedValue(new Error('not found'));
    runtimeMock.mockReset().mockResolvedValue({
      canonicalRunId: 'run-1',
      transformationCaseId: 'case-linked',
      lineageId: 'lineage-1',
      identityRegistered: true,
      actualState: 'planning',
      projectedState: 'drafting',
      stateDrift: true,
      caseStatus: 'plan_proposed',
      lifecycleStage: 'mandate',
      planVersion: 1,
      aliases: [],
      proposals: [],
      timeline: [],
    });
    reviseMock.mockReset().mockImplementation(async () => ({ ...makeCase(), version: 2 }));
    ideasProposalMock.mockReset().mockRejectedValue(new Error('not found'));
    getGovernanceMock.mockReset();
    reviewScopeMock.mockReset();
    rejectScopeMock.mockReset();
    requestRevisionMock.mockReset();
    reviseGovernanceMock.mockReset();
    rebaselineMock.mockReset();
    preparePublicationMock.mockReset();
    generateFinalOutputsMock.mockReset();
  });

  it('shows a business workspace to a normal user without raw runtime diagnostics', async () => {
    userRole = 'MEMBER';
    const item = makeCase();
    item.desiredOutcomes = ['Skrócić czas od decyzji do rezultatu o 30%.'];
    listMock.mockResolvedValue([item]);

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    expect(await screen.findByText('Zlecenie transformacyjne')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Widoki zlecenia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kontynuuj z Teresą' })).toBeInTheDocument();
    expect(screen.getByText('Warsztat z Teresą')).toBeInTheDocument();
    expect(screen.queryByText('Kanoniczny przebieg agenta')).not.toBeInTheDocument();
    expect(screen.queryByText('NOT_CONNECTED')).not.toBeInTheDocument();
    expect(screen.queryByText('case-linked')).not.toBeInTheDocument();
  });

  it('resolves a Teresa deep-link and renders complete capability truth with blocked run', async () => {
    const contextChange = vi.fn();
    const openOperations = vi.fn();
    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel
          fullView
          onCanonicalContextChange={contextChange}
          onOpenOperations={openOperations}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('case-linked'));
    expect(
      (await screen.findAllByText('Przygotuj plan transformacji operacyjnej')).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('NOT_CONNECTED')).toHaveLength(14);
    expect(screen.getByRole('button', { name: 'Uruchom (zablokowane)' })).toBeDisabled();
    expect(
      screen.getByText(/część etapów wymaga konfiguracji technicznej albo przypisania człowiekowi/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Kanoniczny przebieg agenta')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Plany transformacji' })).toBeInTheDocument();
    expect(screen.getByTestId('canonical-runtime')).toHaveAttribute('role', 'status');
    expect(screen.getByText(/Stan zapisany.*planning.*drafting/)).toBeInTheDocument();
    expect(
      screen.getByText(/Automatyczna spójność nie jest jeszcze dowiedziona/)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(contextChange).toHaveBeenCalledWith({
        transformationCaseId: 'case-linked',
        canonicalRunId: 'run-1',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz diagnostykę przebiegu' }));
    expect(openOperations).toHaveBeenCalledWith({
      transformationCaseId: 'case-linked',
      canonicalRunId: 'run-1',
    });
  });

  it('shows governed final Word and PowerPoint downloads with the shared facts digest', async () => {
    const finalCase = { ...makeCase(), lifecycleStage: 'final_outputs' as const, version: 24 };
    listMock.mockResolvedValue([finalCase]);
    getMock.mockResolvedValue(finalCase);
    finalOutputMock.mockResolvedValue({
      runId: 'run-final',
      transformationCaseId: finalCase.transformationCaseId,
      caseVersion: 24,
      factsDigest: 'dca5c568bb6319a6de46b53dd9ca59aff8e1a7cf82326f1deb66b577fbf7c223',
      docxSha256: '0b99987900005c9690974c5819f840dd98344488b01a01b05a08d6adf1d8d260',
      pptxSha256: 'e2c92a488d0a132c7be41f75790e1cb3a71cbf111c25c45c2d94f17a86d4aac5',
      generatedAt: '2026-08-07T17:20:29.000Z',
      idempotentReplay: true,
    });

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    expect(await screen.findByText('Końcowy Word + PowerPoint')).toBeInTheDocument();
    expect(screen.getByText(/dca5c568bb6319a6/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Word' })).toHaveAttribute(
      'href',
      '/api/v8/transformation-cases/case-linked/final-outputs/docx/download'
    );
    expect(screen.getByRole('link', { name: 'PowerPoint' })).toHaveAttribute(
      'href',
      '/api/v8/transformation-cases/case-linked/final-outputs/pptx/download'
    );
  });

  it('prepares, scope-approves, then generates the exact final-output digest', async () => {
    const finalCase = { ...makeCase(), lifecycleStage: 'final_outputs' as const, version: 24 };
    const factsDigest = 'digest-exact-final-output-v24';
    listMock.mockResolvedValue([finalCase]);
    getMock.mockResolvedValue(finalCase);
    preparePublicationMock.mockResolvedValue({
      publicationMappingId: 'publication-map-1',
      proposalVersionId: 'publication-proposal-v1',
      transformationCaseId: 'case-linked',
      caseVersion: 24,
      factsDigest,
      scopeKey: 'final_outputs.publish',
      status: 'pending',
    });
    const pendingProjection = {
      proposalVersionId: 'publication-proposal-v1',
      proposalVersion: 1,
      planVersion: 1,
      contextDigest: 'context-v24',
      status: 'pending_review' as const,
      before: { published: false, caseVersion: 24 },
      after: { published: true, factsDigest, outputContractVersion: 'v3' },
      approvalScopes: ['final_outputs.publish'],
      reviewerAuthorityByScope: { 'final_outputs.publish': ['user-1'] },
      reviews: [],
      scopes: [],
      expiresAt: '2099-08-15T12:00:00.000Z',
    };
    getGovernanceMock.mockResolvedValueOnce(pendingProjection).mockResolvedValueOnce({
      ...pendingProjection,
      status: 'approved',
      reviews: [
        {
          scopeKey: 'final_outputs.publish',
          decision: 'approved',
          reason: 'Exact digest accepted',
          reviewedAt: '2026-08-08T08:00:00.000Z',
        },
      ],
    });
    reviewScopeMock.mockResolvedValue({
      proposalVersionId: 'publication-proposal-v1',
      status: 'approved',
      approvedScopes: 1,
      totalScopes: 1,
    });
    generateFinalOutputsMock.mockResolvedValue({
      runId: 'run-final-approved',
      transformationCaseId: 'case-linked',
      caseVersion: 24,
      factsDigest,
      docxSha256: 'docx-sha',
      pptxSha256: 'pptx-sha',
      generatedAt: '2026-08-08T08:01:00.000Z',
      idempotentReplay: false,
    });
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Exact digest accepted');

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    const generate = await screen.findByRole('button', {
      name: 'Wygeneruj końcowy Word + PowerPoint',
    });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAttribute('aria-describedby', 'final-publication-state-case-linked');
    expect(document.getElementById('final-publication-state-case-linked')).toHaveTextContent(
      'Najpierw przygotuj publikację'
    );
    expect(generateFinalOutputsMock).not.toHaveBeenCalled();

    const prepare = screen.getByRole('button', { name: 'Przygotuj publikację' });
    prepare.focus();
    fireEvent.keyDown(prepare, { key: 'Enter' });
    fireEvent.click(prepare);
    const publication = await screen.findByTestId('final-output-publication');
    expect(publication).toHaveTextContent(factsDigest);
    expect(publication).toHaveTextContent('stan zgody pending_review');
    expect(screen.getByTestId('proposal-governance')).toHaveTextContent('published');
    expect(
      screen.getByRole('button', { name: 'Zatwierdź zakres Publikacja raportu końcowego' })
    ).toBeEnabled();
    expect(document.activeElement).toBe(prepare);

    const approve = screen.getByRole('button', {
      name: 'Zatwierdź zakres Publikacja raportu końcowego',
    });
    approve.focus();
    fireEvent.click(approve);
    await waitFor(() =>
      expect(reviewScopeMock).toHaveBeenCalledWith(
        'publication-proposal-v1',
        'final_outputs.publish',
        { decision: 'approved', reason: 'Exact digest accepted' }
      )
    );
    await waitFor(() => expect(generate).toBeEnabled());
    expect(document.activeElement).toBe(approve);
    expect(publication).toHaveTextContent('Publikacja odblokowana');
    const liveState = document.getElementById('final-publication-state-case-linked');
    expect(liveState).toHaveAttribute('aria-live', 'polite');
    expect(liveState).toHaveAttribute('aria-atomic', 'true');

    fireEvent.click(generate);
    await waitFor(() => expect(generateFinalOutputsMock).toHaveBeenCalledWith('case-linked'));
    expect(await screen.findByText('Końcowy Word + PowerPoint')).toBeInTheDocument();
  });

  it('exposes English atomic publication reasons and mobile governance reflow', async () => {
    language = 'en';
    const finalCase = { ...makeCase(), lifecycleStage: 'final_outputs' as const, version: 24 };
    listMock.mockResolvedValue([finalCase]);

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    const generate = await screen.findByRole('button', {
      name: 'Generate final Word + PowerPoint',
    });
    const reason = document.getElementById(generate.getAttribute('aria-describedby')!);
    expect(generate).toBeDisabled();
    expect(reason).toHaveAttribute('aria-live', 'polite');
    expect(reason).toHaveAttribute('aria-atomic', 'true');
    expect(reason).toHaveTextContent('Prepare the publication and approve the exact facts digest');
  });

  it('reorders an editable plan and persists a new reviewed version', async () => {
    listMock.mockResolvedValue([makeCase()]);
    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    const moveDiscoveryUp = await screen.findByRole('button', {
      name: 'Przesuń w górę stage-1',
    });
    fireEvent.click(moveDiscoveryUp);
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nową wersję planu' }));

    await waitFor(() => expect(reviseMock).toHaveBeenCalledTimes(1));
    const [, command] = reviseMock.mock.calls[0];
    expect(command.expectedVersion).toBe(1);
    expect(command.steps[0].lifecycleStage).toBe('stage-1');
    expect(command.steps[1].lifecycleStage).toBe('stage-0');
    expect(command.steps[0]).not.toHaveProperty('stepId');
    expect(command.steps[0].sourceStepId).toBe('step-1');
  });

  it('edits rich step fields, adds a safe custom step, and keeps capability truth read-only', async () => {
    listMock.mockResolvedValue([makeCase()]);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555');
    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByLabelText('Cel biznesowy stage-0'), {
      target: { value: 'Zweryfikuj mandat i mierzalne wyniki' },
    });
    fireEvent.change(screen.getByLabelText('Moduł docelowy stage-0'), {
      target: { value: 'Chat / Agent' },
    });
    fireEvent.change(screen.getByLabelText('Wejścia stage-0'), {
      target: { value: 'mandat, zakres' },
    });
    fireEvent.change(screen.getByLabelText('Wyjścia stage-0'), {
      target: { value: 'plan, decyzja' },
    });
    fireEvent.change(screen.getByLabelText('Właściciel stage-0'), { target: { value: 'Sponsor' } });
    fireEvent.change(screen.getByLabelText('Szacowany wysiłek stage-0'), {
      target: { value: '2 h' },
    });
    fireEvent.change(screen.getByLabelText('Klasa akceptacji stage-0'), {
      target: { value: 'policy_approvable' },
    });
    fireEvent.change(screen.getByLabelText('Klasa ryzyka stage-0'), {
      target: { value: 'read_only' },
    });
    fireEvent.change(screen.getByLabelText('Tryb wykonania stage-0'), {
      target: { value: 'foreground' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj krok' }));
    expect(
      screen.getByText(/custom_11111111_2222_4333_8444_555555555555 · PROPOSAL_ONLY/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nową wersję planu' }));
    await waitFor(() => expect(reviseMock).toHaveBeenCalledTimes(1));
    const command = reviseMock.mock.calls[0][1];
    expect(command.steps).toHaveLength(16);
    expect(command.steps[0]).toEqual(
      expect.objectContaining({
        sourceStepId: 'step-0',
        businessPurpose: 'Zweryfikuj mandat i mierzalne wyniki',
        moduleTarget: 'Chat / Agent',
        inputs: ['mandat', 'zakres'],
        outputs: ['plan', 'decyzja'],
        ownerRole: 'Sponsor',
        approvalClass: 'policy_approvable',
        riskClass: 'read_only',
        executionMode: 'foreground',
        estimatedEffort: '2 h',
        capabilityStatus: 'PARTIAL',
      })
    );
    expect(command.steps[15]).toEqual(
      expect.objectContaining({
        lifecycleStage: 'custom_11111111_2222_4333_8444_555555555555',
        capabilityStatus: 'PROPOSAL_ONLY',
        blockerReason: 'No verified runtime capability binding.',
      })
    );
  });

  it('blocks removal while another step still references the lifecycle stage', async () => {
    listMock.mockResolvedValue([makeCase()]);
    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByLabelText('Zależności stage-1'), {
      target: { value: 'stage-0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Usuń krok stage-0' }));
    expect(
      await screen.findByText(/Najpierw usuń zależność w etapach: stage-1/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nową wersję planu' }));
    await waitFor(() => expect(reviseMock).toHaveBeenCalledTimes(1));
    expect(reviseMock.mock.calls[0][1].steps).toHaveLength(15);
  });

  it('fails closed when a stage proposal has no A05 governance projection', async () => {
    listMock.mockResolvedValue([makeCase()]);
    ideasProposalMock.mockResolvedValue({
      proposalId: 'proposal-legacy',
      transformationCaseId: 'case-linked',
      planId: 'plan-1',
      planVersion: 1,
      status: 'pending_review',
      candidates: [],
    });

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('proposal-governance')).toHaveTextContent(
      /nie zwrócił wersjonowanego before\/after/i
    );
    expect(screen.getByRole('button', { name: 'Zatwierdź zakres' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Poproś o korektę' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Utwórz rewizję' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rebaseline' })).toBeDisabled();
  });

  it('renders before/after, partial scope truth and invalidation without enabling missing APIs', async () => {
    listMock.mockResolvedValue([makeCase()]);
    ideasProposalMock.mockResolvedValue({
      proposalId: 'proposal-a05',
      transformationCaseId: 'case-linked',
      planId: 'plan-1',
      planVersion: 1,
      status: 'pending_review',
      candidates: [],
      governance: {
        proposalVersionId: 'proposal-version-2',
        proposalVersion: 2,
        status: 'invalidated',
        before: { owner: 'Operations' },
        after: { owner: 'Transformation Office' },
        scopes: [
          {
            scopeKey: 'owner',
            label: 'Właściciel',
            decision: 'approved',
            authority: { canReview: true, reviewerRole: 'Sponsor' },
          },
          {
            scopeKey: 'budget',
            label: 'Budżet',
            decision: 'pending',
            authority: { canReview: false, deniedReason: 'CFO required' },
          },
        ],
        expiresAt: '2026-08-08T12:00:00.000Z',
        invalidationReason: 'context_changed',
        accessState: 'available',
      },
    });

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    const governance = await screen.findByTestId('proposal-governance');
    expect(governance).toHaveTextContent('Governance propozycji · v2');
    expect(governance).toHaveTextContent('Operations');
    expect(governance).toHaveTextContent('Transformation Office');
    expect(governance).toHaveTextContent('Uprawniony: Sponsor · approved');
    expect(governance).toHaveTextContent('Brak uprawnienia: CFO required · pending');
    expect(screen.getByRole('alert')).toHaveTextContent(/unieważniona.*context_changed/i);
    expect(screen.getByRole('button', { name: 'Zatwierdź zakres Właściciel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zatwierdź zakres Budżet' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rebaseline' })).toBeEnabled();
    expect(screen.getByTestId('proposal-governance-scope-owner')).toHaveClass(
      'flex-col',
      'sm:flex-row',
      'bg-c-card'
    );
  });

  it('approves a governed scope, refreshes it, and leaves stage materialization separate', async () => {
    listMock.mockResolvedValue([makeCase()]);
    const governance = {
      proposalVersionId: 'proposal-version-1',
      proposalVersion: 1,
      status: 'pending_review' as const,
      before: { owner: 'Operations' },
      after: { owner: 'Transformation Office' },
      scopes: [
        {
          scopeKey: 'owner',
          label: 'Właściciel',
          decision: 'pending' as const,
          authority: { canReview: true, reviewerRole: 'Sponsor' },
        },
      ],
      expiresAt: '2026-08-08T12:00:00.000Z',
    };
    ideasProposalMock.mockResolvedValue({
      proposalId: 'proposal-a05',
      transformationCaseId: 'case-linked',
      planId: 'plan-1',
      planVersion: 1,
      status: 'pending_review',
      candidates: [],
      governance,
    });
    reviewScopeMock.mockResolvedValue({
      proposalVersionId: 'proposal-version-1',
      status: 'approved',
    });
    getGovernanceMock.mockResolvedValue({
      ...governance,
      status: 'approved',
      approvalScopes: ['owner'],
      reviews: [
        {
          scopeKey: 'owner',
          decision: 'approved',
          reason: 'Sponsor confirms scope',
          reviewedAt: '2026-08-07T12:30:00.000Z',
        },
      ],
    });
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Sponsor confirms scope');

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Zatwierdź zakres Właściciel' }));
    await waitFor(() =>
      expect(reviewScopeMock).toHaveBeenCalledWith('proposal-version-1', 'owner', {
        decision: 'approved',
        reason: 'Sponsor confirms scope',
      })
    );
    expect(getGovernanceMock).toHaveBeenCalledWith('proposal-version-1');
    expect(await screen.findByTestId('proposal-governance')).toHaveTextContent('approved');
    expect(screen.getByRole('button', { name: 'Zatwierdź i utwórz Ideas' })).toBeInTheDocument();
  });

  it('keeps unauthorized and expired governance actions disabled', async () => {
    listMock.mockResolvedValue([makeCase()]);
    ideasProposalMock.mockResolvedValue({
      proposalId: 'proposal-expired',
      transformationCaseId: 'case-linked',
      planId: 'plan-1',
      planVersion: 1,
      status: 'pending_review',
      candidates: [],
      governance: {
        proposalVersionId: 'proposal-version-expired',
        proposalVersion: 1,
        status: 'expired',
        before: {},
        after: {},
        scopes: [
          {
            scopeKey: 'finance',
            label: 'Finanse',
            decision: 'pending',
            authority: { canReview: false, deniedReason: 'CFO required' },
          },
        ],
        expiresAt: '2026-08-01T12:00:00.000Z',
      },
    });

    render(
      <MemoryRouter initialEntries={['/my-work?tab=agent&transformationCaseId=case-linked']}>
        <TransformationCasesPanel fullView />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: 'Zatwierdź zakres Finanse' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Odrzuć zakres Finanse' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Poproś o korektę zakresu Finanse' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rebaseline' })).toBeDisabled();
  });
});
