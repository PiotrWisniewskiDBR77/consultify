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

describe('F2-1 E1 A2 — widoczna propozycja dyspozycji AI', () => {
  // A2 (DEC-498 §1): wlasciciel chce WIDZIEC, dlaczego AI proponuje parking i
  // pod jakim warunkiem inicjatywa wraca. Propozycja byla liczona i utrwalana,
  // ale w podgladzie nie istniala — decydent nie mial jej z czego przeczytac.
  // SWIADOMIE nie wypelniamy nia formularza: powod decyzji ma napisac czlowiek
  // (ta bramka jest osobno chroniona testem zbiorczego decydowania).
  it('pokazuje proponowana dyspozycje AI z powodem i warunkiem powrotu, nie wypelniajac formularza', async () => {
    const parkingOnly = { ...analysis, items: [analysis.items[0]] };
    api.readPortfolioAnalysis.mockResolvedValueOnce({ version: 2, analysis: parkingOnly });
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    await waitFor(() => expect(preview).toHaveTextContent('Choose B.'));

    expect(preview).toHaveTextContent('Proposed disposition');
    expect(preview).toHaveTextContent('Wait');
    expect(preview).toHaveTextContent('Return condition proposed');
    expect(preview).toHaveTextContent('Capacity available');

    const form = within(preview).getByTestId('initiatives-analysis-decision-form');
    expect(within(form).getByLabelText('Decision reason')).toHaveValue('');
    expect(within(form).getByRole('button', { name: 'Decide item' })).toBeDisabled();
  });

  it('nie pokazuje wiersza proponowanej dyspozycji przy obserwacji i rekomendacji', async () => {
    const observationOnly = { ...analysis, items: [analysis.items[2]] };
    api.readPortfolioAnalysis.mockResolvedValueOnce({ version: 2, analysis: observationOnly });
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: 'Run portfolio analysis' }));
    const preview = await screen.findByTestId('initiatives-analysis-preview');
    await waitFor(() => expect(preview).toHaveTextContent('Coverage gap.'));
    expect(preview).not.toHaveTextContent('Proposed disposition');
  });
});
