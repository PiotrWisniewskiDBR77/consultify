/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listPortfolioScenarioRegister: vi.fn(),
  listGovernedOrganizationContextVersions: vi.fn(),
  createPortfolioAnalysis: vi.fn(),
  readPortfolioAnalysis: vi.fn(),
  requestPortfolioDecision: vi.fn(),
  decidePortfolioDecision: vi.fn(),
  readPortfolioDecision: vi.fn(),
  readInitiativeCapabilities: vi.fn(),
}));
const locale = vi.hoisted(() => ({ language: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      const labels: Record<string, Record<string, string>> = {
        en: {
          'initiatives.analysis.kinds.OBSERVATION': 'Observation',
          'initiatives.analysis.kinds.RECOMMENDATION': 'Recommendation',
          'initiatives.analysis.kinds.DECISION': 'Decision',
          'initiatives.analysis.criteria.COVERAGE_GAP': 'Coverage gap',
          'initiatives.analysis.criteria.OVERLAP': 'Overlap',
          'initiatives.analysis.criteria.PRIORITY': 'Priority',
          'initiatives.analysis.criteria.NEW_VS_EXTENSION': 'New or extension',
          'initiatives.analysis.confidence.HIGH': 'High',
          'initiatives.analysis.confidence.MEDIUM': 'Medium',
          'initiatives.analysis.confidence.LOW': 'Low',
          'initiatives.analysis.confidence.UNKNOWN': 'Unknown',
        },
        pl: {
          'initiatives.analysis.kinds.OBSERVATION': 'Obserwacja',
          'initiatives.analysis.kinds.RECOMMENDATION': 'Rekomendacja',
          'initiatives.analysis.kinds.DECISION': 'Decyzja',
          'initiatives.analysis.criteria.COVERAGE_GAP': 'Luka pokrycia',
          'initiatives.analysis.criteria.OVERLAP': 'Nakładanie się',
          'initiatives.analysis.criteria.PRIORITY': 'Priorytet',
          'initiatives.analysis.criteria.NEW_VS_EXTENSION': 'Nowa lub rozszerzenie',
          'initiatives.analysis.confidence.HIGH': 'Wysoka',
          'initiatives.analysis.confidence.MEDIUM': 'Średnia',
          'initiatives.analysis.confidence.LOW': 'Niska',
          'initiatives.analysis.confidence.UNKNOWN': 'Nieznana',
        },
      };
      return (
        labels[locale.language]?.[key] ??
        (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key))
      );
    },
    i18n: {
      get language() {
        return locale.language;
      },
    },
  }),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  ...api,
}));

import { InitiativeConsultingAnalysisView } from '../InitiativeConsultingAnalysisView';

const analysis = {
  analysisId: 'analysis-a',
  aggregateVersion: 2 as const,
  status: 'PENDING_REVIEW' as const,
  rubricVersion: 'portfolio-consulting-v1',
  requestDigest: 'digest-a',
  requestedBy: 'manager-a',
  snapshot: {
    snapshotVersion: 1,
    asOf: '2026-09-13T12:00:00.000Z',
    source: {
      system: 'initiativeUnifiedReader' as const,
      version: 'runtime-v1',
      capturedAt: '2026-09-13T12:00:00.000Z',
    },
    portfolio: { scenarioId: 'scenario-a', aggregateVersion: 3, scenarioVersion: 2, facts: {} },
    initiatives: [
      {
        initiativeId: 'initiative-a',
        initiativeVersion: 4,
        projectId: null,
        source: 'CANONICAL' as const,
        facts: { name: 'Initiative Alpha' },
        evidenceRefs: ['initiative:initiative-a:v4'] as [string],
      },
      {
        initiativeId: 'initiative-b',
        initiativeVersion: 8,
        projectId: 'project-b',
        source: 'CANONICAL' as const,
        facts: { title: 'Initiative Beta' },
        evidenceRefs: ['initiative:initiative-b:v8'] as [string],
      },
      {
        initiativeId: 'initiative-c',
        initiativeVersion: 3,
        projectId: 'project-c',
        source: 'CANONICAL' as const,
        facts: { name: 'Initiative Gamma' },
        evidenceRefs: ['initiative:initiative-c:v3'] as [string],
      },
    ],
  },
  model: {
    runId: 'run-a',
    provider: 'provider-a',
    modelId: 'model-a',
    modelVersion: '1',
    promptVersion: 'prompt-a',
    generatedAt: '2026-09-13T12:01:00.000Z',
  },
  items: [
    {
      itemId: 'decision-b',
      position: 1,
      kind: 'DECISION' as const,
      criterion: 'PRIORITY' as const,
      initiativeIds: ['initiative-b'],
      rationale: 'Choose B.',
      evidence: [
        {
          initiativeId: 'initiative-b',
          field: 'priority',
          source: 'initiativeUnifiedReader' as const,
          sourceRef: 'initiative:initiative-b:v8',
        },
      ],
      confidence: 'MEDIUM' as const,
      alternatives: ['Park B'],
      missingData: [],
      proposedDisposition: {
        kind: 'PARKING' as const,
        reason: 'Wait',
        returnCondition: 'Capacity available',
      },
    },
    {
      itemId: 'recommendation-a',
      position: 9,
      kind: 'RECOMMENDATION' as const,
      criterion: 'OVERLAP' as const,
      initiativeIds: ['initiative-a'],
      rationale: 'Resolve overlap.',
      evidence: [
        {
          initiativeId: 'initiative-a',
          field: 'problem',
          source: 'initiativeUnifiedReader' as const,
          sourceRef: 'initiative:initiative-a:v4',
        },
      ],
      confidence: 'LOW' as const,
      alternatives: ['Merge'],
      missingData: ['Owner confirmation'],
      proposedDisposition: null,
    },
    {
      itemId: 'observation-a',
      position: 20,
      kind: 'OBSERVATION' as const,
      criterion: 'COVERAGE_GAP' as const,
      initiativeIds: ['initiative-a'],
      rationale: 'Coverage gap.',
      evidence: [
        {
          initiativeId: 'initiative-a',
          field: 'outcome',
          source: 'initiativeUnifiedReader' as const,
          sourceRef: 'initiative:initiative-a:v4',
        },
      ],
      confidence: 'HIGH' as const,
      alternatives: [],
      missingData: [],
      proposedDisposition: null,
    },
    {
      itemId: 'decision-a',
      position: 2,
      kind: 'DECISION' as const,
      criterion: 'NEW_VS_EXTENSION' as const,
      initiativeIds: ['initiative-a'],
      rationale: 'Choose A.',
      evidence: [
        {
          initiativeId: 'initiative-a',
          field: 'priority',
          source: 'initiativeUnifiedReader' as const,
          sourceRef: 'initiative:initiative-a:v4',
        },
      ],
      confidence: 'HIGH' as const,
      alternatives: ['Archive A'],
      missingData: ['Finance confirmation'],
      proposedDisposition: { kind: 'IN' as const, reason: 'Aligned', returnCondition: null },
    },
    {
      itemId: 'decision-c',
      position: 3,
      kind: 'DECISION' as const,
      criterion: 'PRIORITY' as const,
      initiativeIds: ['initiative-c'],
      rationale: 'Choose C.',
      evidence: [
        {
          initiativeId: 'initiative-c',
          field: 'priority',
          source: 'initiativeUnifiedReader' as const,
          sourceRef: 'initiative:initiative-c:v3',
        },
      ],
      confidence: 'UNKNOWN' as const,
      alternatives: [],
      missingData: ['Sponsor'],
      proposedDisposition: {
        kind: 'ARCHIVE' as const,
        reason: 'Not aligned',
        returnCondition: 'Strategy changes',
      },
    },
  ],
};

beforeEach(() => {
  locale.language = 'en';
  vi.clearAllMocks();
  api.listPortfolioScenarioRegister.mockResolvedValue({
    scenarios: [
      {
        id: 'scenario-a',
        name: 'Approved portfolio',
        state: 'PUBLISHED',
        version: 2,
        scope: { portfolioId: 'portfolio-a', asOf: '2026-09-13T12:00:00.000Z' },
        updatedAt: '2026-09-13T12:00:00.000Z',
      },
    ],
  });
  api.listGovernedOrganizationContextVersions.mockResolvedValue([
    {
      snapshotId: 'context-a',
      version: 7,
      schemaVersion: 1,
      contentHash: 'hash-a',
      claimCount: 3,
      createdAt: '2026-09-13T11:00:00.000Z',
    },
  ]);
  api.createPortfolioAnalysis.mockResolvedValue({
    capture: { status: 'APPLIED', aggregateVersion: 1 },
    analysis,
  });
  api.readPortfolioAnalysis.mockResolvedValue({ version: 2, analysis });
  api.readInitiativeCapabilities.mockResolvedValue({
    actorId: 'manager-a',
    canView: true,
    canUpdate: true,
    canReview: true,
    canSelfApprove: true,
  });
  api.requestPortfolioDecision.mockResolvedValue({ status: 'APPLIED' });
  api.decidePortfolioDecision.mockResolvedValue({ status: 'APPLIED' });
  api.readPortfolioDecision.mockImplementation(async (initiativeId: string) => ({
    version: 2,
    decision: {
      decisionId: `portfolio-analysis:analysis-a:decision-${initiativeId.slice(-1)}:${initiativeId}`,
      initiativeId,
      status: 'APPROVED',
      scenarioId: 'scenario-a',
      scenarioVersion: 2,
      initiativeVersion: initiativeId.endsWith('a') ? 4 : 8,
      authorityId: 'manager-a',
      requestedAt: '',
      decidedAt: '',
      disposition: {
        kind: 'IN',
        reason: 'Proceed',
        returnCondition: null,
        actorId: 'manager-a',
        decidedAt: '',
        inputSnapshot: {
          analysisId: 'analysis-a',
          analysisVersion: 2,
          itemId: `decision-${initiativeId.slice(-1)}`,
          asOf: '2026-09-13T12:00:00.000Z',
        },
        frozenInput: {},
      },
    },
  }));
});
afterEach(cleanup);

const renderView = (scopeKey = 'org-a:manager-a') => {
  const onNavigatePlan = vi.fn();
  const onNavigateCapacity = vi.fn();
  return {
    ...render(
      <MemoryRouter>
        <InitiativeConsultingAnalysisView
          scopeKey={scopeKey}
          authorityId="manager-a"
          onNavigatePlan={onNavigatePlan}
          onNavigateCapacity={onNavigateCapacity}
        />
      </MemoryRouter>
    ),
    onNavigatePlan,
    onNavigateCapacity,
  };
};

describe('F2-1 E1 Slice 3 Initiative consulting analysis', () => {
  it('discovers named persisted inputs, runs POST then GET, and orders governed items Observation to Recommendation to Decision', async () => {
    renderView();
    expect(await screen.findByRole('option', { name: /Approved portfolio/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run portfolio analysis' }));
    await screen.findByText('Coverage gap.');

    expect(api.createPortfolioAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: 'scenario-a',
        contextSnapshotId: 'context-a',
        contextVersion: 7,
        expectedVersion: 0,
      })
    );
    expect(api.readPortfolioAnalysis).toHaveBeenCalledWith(
      api.createPortfolioAnalysis.mock.calls[0][0].analysisId
    );
    const primaryTable = within(screen.getByTestId('initiatives-analysis-table')).getAllByRole(
      'table'
    )[0];
    const bodyRows = within(primaryTable).getAllByRole('row').slice(1);
    expect(
      bodyRows.map(
        (row) => within(row).queryByText(/^(Observation|Recommendation|Decision)$/)?.textContent
      )
    ).toEqual(['Observation', 'Recommendation', 'Decision', 'Decision', 'Decision']);
    expect(screen.getByText('initiativeUnifiedReader · outcome')).toBeInTheDocument();
  });

  it('shows rationale, evidence, confidence, alternatives, missing data and provenance in StandardPreview', async () => {
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    fireEvent.click((await screen.findByText('Resolve overlap.')).closest('tr')!);

    const preview = await screen.findByTestId('initiatives-analysis-preview');
    await waitFor(() => {
      expect(preview).toHaveTextContent('Low');
      expect(preview).toHaveTextContent('problem · initiative:initiative-a:v4');
      expect(preview).toHaveTextContent('Merge');
      expect(preview).toHaveTextContent('Owner confirmation');
      expect(preview).toHaveTextContent('provider-a · model-a · prompt-a');
      expect(preview).toHaveTextContent('Initiative Alpha');
    });
  });

  it('applies a single DEC479 decision through request, decide and exact persisted readback', async () => {
    const view = renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const main = screen.getByTestId('initiatives-analysis-table');
    fireEvent.click((await within(main).findByText('Choose A.')).closest('tr')!);
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    fireEvent.change(within(preview).getByLabelText('Decision reason'), {
      target: { value: 'Proceed now' },
    });
    fireEvent.change(within(preview).getByLabelText('Decision due date'), {
      target: { value: '2026-09-20' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Decide item' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Decide item' }));

    await waitFor(() => expect(api.readPortfolioDecision).toHaveBeenCalledWith('initiative-a'));
    expect(api.requestPortfolioDecision).toHaveBeenCalledWith(
      'initiative-a',
      expect.objectContaining({ expectedVersion: 4, authorityId: 'manager-a', scenarioVersion: 2 })
    );
    expect(api.decidePortfolioDecision).toHaveBeenCalledWith(
      'initiative-a',
      expect.objectContaining({
        expectedVersion: 5,
        outcome: 'APPROVED',
        disposition: {
          kind: 'IN',
          reason: 'Proceed now',
          returnCondition: null,
          inputSnapshot: {
            analysisId: 'analysis-a',
            analysisVersion: 2,
            itemId: 'decision-a',
            asOf: '2026-09-13T12:00:00.000Z',
          },
        },
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open Plan' }));
    expect(view.onNavigatePlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Open Capacity' })).toBeInTheDocument();
  });

  it('bulk-decides only selected Decision items and requires reason and return condition for parking', async () => {
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    await screen.findByText('Choose A.');
    const rowFor = (text: string) =>
      screen
        .getAllByText(text)
        .map((node) => node.closest('tr'))
        .find(Boolean)!;
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.selectAll' }));
    await waitFor(() =>
      expect(screen.getByTestId('initiatives-analysis-table')).toHaveAttribute(
        'data-selected-count',
        '3'
      )
    );
    const batchPreview = await screen.findByTestId('initiatives-analysis-batch-preview');
    expect(batchPreview).toHaveTextContent('Selected decisions');
    fireEvent.click(within(rowFor('Choose C.')).getByRole('checkbox'));
    fireEvent.change(within(batchPreview).getByLabelText('Disposition'), {
      target: { value: 'PARKING' },
    });
    fireEvent.change(within(batchPreview).getByLabelText('Decision reason'), {
      target: { value: 'Wait for capacity' },
    });
    fireEvent.change(within(batchPreview).getByLabelText('Decision due date'), {
      target: { value: '2026-09-20' },
    });
    expect(
      within(batchPreview).getByRole('button', { name: 'Decide selected items' })
    ).toBeDisabled();
    fireEvent.change(within(batchPreview).getByLabelText('Return condition'), {
      target: { value: 'Capacity is available' },
    });
    fireEvent.click(within(batchPreview).getByRole('button', { name: 'Decide selected items' }));

    await waitFor(() => expect(api.decidePortfolioDecision).toHaveBeenCalledTimes(2));
    expect(api.decidePortfolioDecision).toHaveBeenCalledWith(
      'initiative-a',
      expect.objectContaining({
        outcome: 'REJECTED',
        disposition: expect.objectContaining({
          kind: 'PARKING',
          returnCondition: 'Capacity is available',
        }),
      })
    );
    expect(api.decidePortfolioDecision).toHaveBeenCalledWith('initiative-b', expect.anything());
    expect(api.decidePortfolioDecision).not.toHaveBeenCalledWith('initiative-c', expect.anything());
    expect(screen.queryByRole('button', { name: 'Open Plan' })).toBeNull();
  });

  it('does not guess an approval authority when the resolved policy forbids self-approval', async () => {
    api.readInitiativeCapabilities.mockResolvedValue({
      actorId: 'manager-a',
      canView: true,
      canUpdate: true,
      canReview: true,
      canSelfApprove: false,
    });
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const table = screen.getByTestId('initiatives-analysis-table');
    fireEvent.click((await within(table).findByText('Choose A.')).closest('tr')!);
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    expect(
      await within(preview).findByText(
        'Approval authority configuration is required before this decision can be saved.'
      )
    ).toBeInTheDocument();
    fireEvent.change(within(preview).getByLabelText('Decision reason'), {
      target: { value: 'Proceed now' },
    });
    fireEvent.change(within(preview).getByLabelText('Decision due date'), {
      target: { value: '2026-09-20' },
    });
    expect(within(preview).getByRole('button', { name: 'Decide item' })).toBeDisabled();
    expect(api.requestPortfolioDecision).not.toHaveBeenCalled();
    expect(api.decidePortfolioDecision).not.toHaveBeenCalled();
  });

  it('ignores stale option responses after an organization or actor scope switch', async () => {
    let resolveOld!: (value: unknown) => void;
    api.listPortfolioScenarioRegister.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    const view = renderView('org-old:user');
    view.rerender(
      <MemoryRouter>
        <InitiativeConsultingAnalysisView
          scopeKey="org-new:user"
          authorityId="manager-a"
          onNavigatePlan={vi.fn()}
          onNavigateCapacity={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(await screen.findByRole('option', { name: /Approved portfolio/ })).toBeInTheDocument();
    resolveOld({
      scenarios: [
        {
          id: 'old',
          name: 'Old tenant portfolio',
          state: 'PUBLISHED',
          version: 1,
          scope: { portfolioId: 'old', asOf: '2026-01-01T00:00:00.000Z' },
          updatedAt: '',
        },
      ],
    });
    await Promise.resolve();
    expect(screen.queryByRole('option', { name: /Old tenant portfolio/ })).toBeNull();
  });

  it('invalidates an in-flight analysis when its scenario and context inputs change', async () => {
    api.listPortfolioScenarioRegister.mockResolvedValue({
      scenarios: [
        {
          id: 'scenario-a',
          name: 'Portfolio A',
          state: 'PUBLISHED',
          version: 2,
          scope: { portfolioId: 'portfolio-a', asOf: '2026-09-13T12:00:00.000Z' },
          updatedAt: '2026-09-13T12:00:00.000Z',
        },
        {
          id: 'scenario-b',
          name: 'Portfolio B',
          state: 'PUBLISHED',
          version: 3,
          scope: { portfolioId: 'portfolio-b', asOf: '2026-09-13T13:00:00.000Z' },
          updatedAt: '2026-09-13T13:00:00.000Z',
        },
      ],
    });
    api.listGovernedOrganizationContextVersions.mockResolvedValue([
      {
        snapshotId: 'context-a',
        version: 7,
        schemaVersion: 1,
        contentHash: 'hash-a',
        claimCount: 3,
        createdAt: '2026-09-13T11:00:00.000Z',
      },
      {
        snapshotId: 'context-b',
        version: 8,
        schemaVersion: 1,
        contentHash: 'hash-b',
        claimCount: 4,
        createdAt: '2026-09-13T12:00:00.000Z',
      },
    ]);
    let resolveAnalysisA!: (value: unknown) => void;
    api.createPortfolioAnalysis.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAnalysisA = resolve;
        })
    );
    const analysisB = {
      ...analysis,
      analysisId: 'analysis-b',
      snapshot: {
        ...analysis.snapshot,
        portfolio: { ...analysis.snapshot.portfolio, scenarioId: 'scenario-b' },
      },
      items: [{ ...analysis.items[3], itemId: 'decision-new-b', rationale: 'Decision from B.' }],
    };
    api.readPortfolioAnalysis.mockResolvedValueOnce({ version: 2, analysis: analysisB });
    const view = renderView();
    await screen.findByRole('option', { name: /Portfolio B/ });

    fireEvent.click(screen.getByRole('button', { name: 'Run portfolio analysis' }));
    await waitFor(() => expect(api.createPortfolioAnalysis).toHaveBeenCalledTimes(1));
    const firstIdentity = {
      analysisId: api.createPortfolioAnalysis.mock.calls[0][0].analysisId,
      clientRequestId: api.createPortfolioAnalysis.mock.calls[0][0].clientRequestId,
    };
    fireEvent.change(screen.getByLabelText('Published portfolio scenario'), {
      target: { value: 'scenario-b' },
    });
    fireEvent.change(screen.getByLabelText('Organization context snapshot'), {
      target: { value: 'context-b:8' },
    });
    resolveAnalysisA({ capture: { status: 'APPLIED', aggregateVersion: 1 }, analysis });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.readPortfolioAnalysis).not.toHaveBeenCalled();
    expect(screen.queryByText('Coverage gap.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decide item' })).toBeNull();
    expect(screen.queryByText('The selected decisions were saved.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Plan' })).toBeNull();
    expect(view.onNavigatePlan).not.toHaveBeenCalled();
    expect(view.onNavigateCapacity).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Run portfolio analysis' }));
    expect(await screen.findByText('Decision from B.')).toBeInTheDocument();
    expect(api.createPortfolioAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scenarioId: 'scenario-b',
        contextSnapshotId: 'context-b',
        contextVersion: 8,
      })
    );
    const secondCommand = api.createPortfolioAnalysis.mock.calls[1][0];
    expect(secondCommand.analysisId).not.toBe(firstIdentity.analysisId);
    expect(secondCommand.clientRequestId).not.toBe(firstIdentity.clientRequestId);
  });

  it('renders the frozen Initiative title and an honest non-UUID fallback', async () => {
    const uuidWithoutTitle = '47d81f06-7830-46df-a60f-03149e2e681d';
    const analysisWithUntitledInitiative = {
      ...analysis,
      snapshot: {
        ...analysis.snapshot,
        initiatives: [
          ...analysis.snapshot.initiatives,
          {
            initiativeId: uuidWithoutTitle,
            initiativeVersion: 1,
            projectId: null,
            source: 'CANONICAL' as const,
            facts: {},
            evidenceRefs: [`initiative:${uuidWithoutTitle}:v1`] as [string],
          },
        ],
      },
      items: [
        {
          ...analysis.items[0],
          itemId: 'decision-without-title',
          initiativeIds: [uuidWithoutTitle],
          rationale: 'Review the untitled Initiative.',
          evidence: [],
        },
        analysis.items[3],
      ],
    };
    api.readPortfolioAnalysis.mockResolvedValueOnce({
      version: 2,
      analysis: analysisWithUntitledInitiative,
    });

    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    expect((await within(preview).findAllByText('Unnamed Initiative')).length).toBeGreaterThan(0);
    expect(preview).not.toHaveTextContent(uuidWithoutTitle);
    expect(within(preview).queryByText('No relations')).toBeNull();

    cleanup();
    api.readPortfolioAnalysis.mockResolvedValueOnce({ version: 2, analysis });
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const namedPreview = await screen.findByTestId('initiatives-analysis-preview');
    expect((await within(namedPreview).findAllByText('Initiative Beta')).length).toBeGreaterThan(0);
  });

  it('does not render an analysis from the prior organization scope during a scope switch', async () => {
    const view = renderView('org-a:manager-a');
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    fireEvent.click((await screen.findByText('Choose A.')).closest('tr')!);
    expect(screen.getByRole('button', { name: 'Decide item' })).toBeInTheDocument();

    view.rerender(
      <MemoryRouter>
        <InitiativeConsultingAnalysisView
          scopeKey="org-b:manager-a"
          authorityId="manager-a"
          onNavigatePlan={view.onNavigatePlan}
          onNavigateCapacity={view.onNavigateCapacity}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('Choose A.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decide item' })).toBeNull();
    expect(screen.getByTestId('initiatives-analysis-table')).toHaveAttribute(
      'data-selected-count',
      '0'
    );
    expect(view.onNavigatePlan).not.toHaveBeenCalled();
    expect(view.onNavigateCapacity).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run portfolio analysis' })).toBeEnabled()
    );
  });

  it('renders governed kind, criterion and confidence labels in Polish without raw enum codes', async () => {
    locale.language = 'pl';
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const table = screen.getByTestId('initiatives-analysis-table');
    expect(await within(table).findByText('Obserwacja')).toBeInTheDocument();
    expect(within(table).getByText('Luka pokrycia')).toBeInTheDocument();
    expect(within(table).getByText('Niska')).toBeInTheDocument();
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    await waitFor(() => expect(preview).toHaveTextContent('Średnia'));
    expect(within(table).queryByText('OBSERVATION')).toBeNull();
    expect(within(table).queryByText('COVERAGE_GAP')).toBeNull();
    expect(preview).not.toHaveTextContent(/\bMEDIUM\b/);
  });

  it('omits unknown confidence from preview meta while retaining the explicit table value', async () => {
    const unknownAnalysis = { ...analysis, items: [analysis.items[4]] };
    api.readPortfolioAnalysis.mockResolvedValueOnce({ version: 2, analysis: unknownAnalysis });
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const table = screen.getByTestId('initiatives-analysis-table');
    expect(await within(table).findByText('Unknown')).toBeInTheDocument();
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    expect(preview).toHaveTextContent('Choose C.');
    expect(within(preview).queryByText('Unknown')).toBeNull();
    expect(within(preview).queryByText('No relations')).toBeNull();
    expect((await within(preview).findAllByText('Initiative Gamma')).length).toBeGreaterThan(0);
  });

  it('passes the active i18n locale to every visible date formatter', async () => {
    locale.language = 'pl';
    const dateOnly = vi.spyOn(Date.prototype, 'toLocaleDateString');
    const dateTime = vi.spyOn(Date.prototype, 'toLocaleString');
    try {
      renderView();
      await screen.findByRole('option', { name: /Approved portfolio/ });
      fireEvent.click(screen.getByRole('button', { name: 'Run portfolio analysis' }));
      await screen.findByTestId('initiatives-analysis-preview');
      expect(dateOnly).toHaveBeenCalledWith('pl');
      expect(dateTime).toHaveBeenCalledWith('pl');
    } finally {
      dateOnly.mockRestore();
      dateTime.mockRestore();
    }
  });
});
