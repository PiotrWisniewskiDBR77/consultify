/**
 * F-P5 §6 — kreator Analizy woła `derived-analysis`, NIE `POST /artifacts`.
 *
 * Przyczyna (zmierzona przed paczką): `handleWizardComplete` robiło
 * `createFinanceArtifact({artifactType:'HISTORICAL_ANALYSIS'})` + `computeAnalysisKpis` na
 * BIEŻĄCEJ wersji, a cały wybór z kreatora szedł do kosza (`void payload` w kodzie).
 * Artefakt powstawał BEZ krawędzi `STATEMENT_TO_ANALYSIS`, więc `compute` odbijał się o
 * `NO_SOURCE_STATEMENT_PACK_EDGE` i tabela wskaźników zostawała pusta.
 *
 * Zabezpieczenie, w które celuje mutacja: „analiza z kreatora ma rodowód i własne wskaźniki".
 * Dowód mutacyjny: przywrócenie `createFinanceArtifact` w `handleWizardComplete` wywraca
 * wszystkie trzy testy tego pliku.
 *
 * Kreator jest tu zastąpiony atrapą oddającą GOTOWY payload — testowanym obiektem jest
 * `handleWizardComplete` w realnym `AnalysisWorkspace` (klikanie 6 kroków kreatora ma własną
 * suitę: `analysisCreatorWizard.contract.test.ts` + `AnalysisCreatorWizard.a11y.test.tsx`).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

import type {
  AnalysisKpiCatalogEntryDto,
  FinanceArtifactDetailDto,
  FinanceBusinessVersionDetailDto,
} from '../../../../services/api/financeV2.types';

const apiMocks = vi.hoisted(() => ({
  getFinanceArtifact: vi.fn(),
  getFinanceBusinessVersion: vi.fn(),
  getAnalysisKpiValues: vi.fn(),
  getAnalysisKpiCatalog: vi.fn(),
  computeAnalysisKpis: vi.fn(),
  createFinanceArtifact: vi.fn(),
  createDerivedFinanceAnalysis: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
}));

vi.mock('../../../../services/api/financeV2.api', () => apiMocks);

const WIZARD_PAYLOAD = {
  sourceStatementPackVersionId: 'bv-pakiet-2025',
  selectedPeriodIds: ['p-2024', 'p-2025'],
  industryCode: 'MANUFACTURING',
  goal: 'GENERAL_OVERVIEW',
  selectedKpiCodes: ['CURRENT_RATIO', 'ROE'],
};

vi.mock('../AnalysisCreatorWizard', () => ({
  AnalysisCreatorWizard: ({ onComplete }: { onComplete: (payload: unknown) => void }) => (
    <button
      type="button"
      data-testid="wizard-complete-stub"
      onClick={() => onComplete(WIZARD_PAYLOAD)}
    >
      Utwórz i przelicz
    </button>
  ),
}));

import { AnalysisWorkspace } from '../AnalysisWorkspace';

const ARTIFACT: FinanceArtifactDetailDto = {
  artifactId: 'art-1',
  artifactType: 'HISTORICAL_ANALYSIS',
  naturalKey: 'Analiza testowa',
  createdAt: '2026-09-05T00:00:00Z',
  archivedAt: null,
  archivedReason: null,
  currentBusinessVersion: null,
};

const BUSINESS_VERSION: FinanceBusinessVersionDetailDto = {
  businessVersionId: 'bv-1',
  artifactId: 'art-1',
  versionNo: 1,
  version: 1,
  status: 'DRAFT',
  freshness: 'NEVER_COMPUTED',
  freshnessReason: null,
  staleSince: null,
  riskTier: 'LOW',
  versionKind: 'MAIN',
  parentVersionId: null,
  supersededByVersionId: null,
  computeSnapshotId: null,
  computeRunId: null,
  contentSemanticHash: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  reopenReason: null,
  reopenedBy: null,
  reopenedAt: null,
  createdAt: '2026-09-05T00:00:00Z',
  updatedAt: '2026-09-05T00:00:00Z',
};

const CATALOG: AnalysisKpiCatalogEntryDto[] = [];

const SOURCE_OPTIONS = [
  {
    statementPackArtifactId: 'art-pakiet',
    statementPackVersionId: 'bv-pakiet-2025',
    versionNo: 1,
    label: 'Sprawozdania DBR77 2023–2025',
    status: 'DRAFT',
    entityId: 'ent-1',
    entityLabel: 'DBR77',
  },
];

beforeEach(() => {
  setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });
  apiMocks.getFinanceArtifact.mockResolvedValue(ARTIFACT);
  apiMocks.getFinanceBusinessVersion.mockResolvedValue(BUSINESS_VERSION);
  apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
  apiMocks.getAnalysisKpiCatalog.mockResolvedValue(CATALOG);
  apiMocks.computeAnalysisKpis.mockResolvedValue({ resultsCount: 36 });
  apiMocks.createDerivedFinanceAnalysis.mockResolvedValue({
    artifactId: 'art-nowa',
    businessVersionId: 'bv-nowa',
    workingRevisionId: 'wr-nowa',
    edgeId: 'edge-1',
    sourceVersionId: 'bv-pakiet-2025',
    artifactType: 'HISTORICAL_ANALYSIS',
    replayed: false,
    selection: {
      definitionId: 'def-1',
      analysisName: 'Analiza: Sprawozdania DBR77 2023–2025',
      presentationCurrency: 'PLN',
      unit: 'UNITS',
      periodIds: ['p-2024', 'p-2025'],
      kpiCodes: ['CURRENT_RATIO', 'ROE'],
      selectionRowsInserted: 4,
      selectionRowsTotal: 4,
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  clearFeatureFlagOverrides();
});

async function openWizardAndComplete(onAnalysisCreated?: (created: unknown) => void) {
  const user = userEvent.setup();
  render(
    <AnalysisWorkspace
      artifactId="art-1"
      businessVersionId="bv-1"
      role="preparer"
      onNavigateBack={() => {}}
      creatorSourceOptions={SOURCE_OPTIONS}
      onAnalysisCreated={onAnalysisCreated as never}
    />
  );
  await waitFor(() => expect(apiMocks.getAnalysisKpiValues).toHaveBeenCalled());
  const ctaButtons = await screen.findAllByText('Skonfiguruj wskaźniki');
  await user.click(ctaButtons[ctaButtons.length - 1]);
  const complete = await screen.findByTestId('wizard-complete-stub');
  await user.click(complete);
}

describe('F-P5 — kreator Analizy tworzy analizę z rodowodem', () => {
  it('woła derived-analysis z wybranym pakietem, okresami i wskaźnikami — a NIE POST /artifacts', async () => {
    await openWizardAndComplete();

    await waitFor(() => expect(apiMocks.createDerivedFinanceAnalysis).toHaveBeenCalledTimes(1));
    expect(apiMocks.createFinanceArtifact).not.toHaveBeenCalled();

    const params = apiMocks.createDerivedFinanceAnalysis.mock.calls[0][0];
    expect(params.sourceBusinessVersionId).toBe('bv-pakiet-2025');
    expect(params.periodIds).toEqual(['p-2024', 'p-2025']);
    expect(params.kpiCodes).toEqual(['CURRENT_RATIO', 'ROE']);
    expect(params.industryCode).toBe('MANUFACTURING');
    expect(typeof params.idempotencyKey).toBe('string');
    expect(params.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('nazwa własna analizy jest proponowana z etykiety pakietu źródłowego', async () => {
    await openWizardAndComplete();
    await waitFor(() => expect(apiMocks.createDerivedFinanceAnalysis).toHaveBeenCalled());
    expect(apiMocks.createDerivedFinanceAnalysis.mock.calls[0][0].name).toBe(
      'Analiza: Sprawozdania DBR77 2023–2025'
    );
  });

  it('przelicza NOWĄ wersję i otwiera ją w osobnym ekranie (nie zostaje na poprzednim rekordzie)', async () => {
    const onAnalysisCreated = vi.fn();
    await openWizardAndComplete(onAnalysisCreated);

    await waitFor(() => expect(apiMocks.computeAnalysisKpis).toHaveBeenCalled());
    expect(apiMocks.computeAnalysisKpis).toHaveBeenCalledWith({ businessVersionId: 'bv-nowa' });
    await waitFor(() =>
      expect(onAnalysisCreated).toHaveBeenCalledWith({
        artifactId: 'art-nowa',
        businessVersionId: 'bv-nowa',
      })
    );
  });
});
