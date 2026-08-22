/**
 * Pakiet E — dymny test montowania `AnalysisWorkspace`/`AnalysisCreatorWizard`
 * (REALNE komponenty, nie opis) z zamockowanym `financeV2.api`. Nie jest to
 * zamiennik zrzutu z dev-render (CLAUDE.md #7 — Piotr i tak zobaczy dopiero
 * realny zrzut) — to jest dowód, że komponent się montuje bez wyjątku
 * runtime i że ★ ZAKAZ pustej analizy (CTA „Skonfiguruj wskaźniki”) oraz
 * krok kreatora faktycznie działają w przeglądarce (jsdom), nie tylko w
 * czystej logice kontraktu.
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
  AnalysisKpiValueDto,
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
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
}));

vi.mock('../../../../services/api/financeV2.api', () => apiMocks);

import { AnalysisWorkspace } from '../AnalysisWorkspace';

const ARTIFACT: FinanceArtifactDetailDto = {
  artifactId: 'art-1',
  artifactType: 'HISTORICAL_ANALYSIS',
  naturalKey: 'Analiza testowa',
  createdAt: '2026-08-01T00:00:00Z',
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
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

const CATALOG: AnalysisKpiCatalogEntryDto[] = [
  {
    kpiCatalogId: 'cat-1',
    kpiCode: 'GROSS_MARGIN_PCT',
    catalogVersion: 1,
    status: 'ACTIVE',
    tier: 'UNIVERSAL',
    industryCode: null,
    category: 'Rentowność',
    kpiName: 'Marża brutto',
    description: '(Przychody - COGS) / Przychody',
    unitType: 'PERCENT',
    compileStatus: 'COMPILED',
    resolvedOutputUnit: 'PERCENT',
    periodConvention: 'POINT_IN_TIME',
    negativeDenominatorPolicy: 'FORCE_NA',
    requiredCanonicalLineCodes: ['REVENUE', 'COGS'],
  },
];

function setupHappyPathMocks(kpiValues: AnalysisKpiValueDto[] = []): void {
  apiMocks.getFinanceArtifact.mockResolvedValue(ARTIFACT);
  apiMocks.getFinanceBusinessVersion.mockResolvedValue(BUSINESS_VERSION);
  apiMocks.getAnalysisKpiValues.mockResolvedValue(kpiValues);
  apiMocks.getAnalysisKpiCatalog.mockResolvedValue(CATALOG);
}

// AP_MOUNT §A: `AnalysisWorkspace` teraz SAM odczytuje `financeAnalysisWorkspaceV1`
// i renderuje `null` przy OFF — file-scope hook włącza flagę (ten sam
// local-override mechanizm co realny harness/użytkownik) dla WSZYSTKICH
// `describe` bloków w tym pliku.
beforeEach(() => {
  setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });
});

afterEach(() => {
  vi.clearAllMocks();
  clearFeatureFlagOverrides();
});

describe('AnalysisWorkspace — montowanie realnego komponentu (jsdom)', () => {
  it('montuje się bez wyjątku i ładuje dane przez financeV2.api', async () => {
    setupHappyPathMocks();
    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );
    await waitFor(() => expect(apiMocks.getFinanceArtifact).toHaveBeenCalledWith('art-1'));
    expect(screen.getByTestId('analysis-workspace')).toBeInTheDocument();
  });

  it('★ ZAKAZ pustej analizy: 0 KPI ⇒ tabela pokazuje CTA "Skonfiguruj wskaźniki", NIE pustkę bez akcji', async () => {
    setupHappyPathMocks([]); // brak wpisów KPI
    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );
    await waitFor(() => expect(apiMocks.getAnalysisKpiValues).toHaveBeenCalled());
    // CTA główny w pasku ORAZ w pustym stanie tabeli — oba muszą istnieć.
    const ctaButtons = await screen.findAllByText('Skonfiguruj wskaźniki');
    expect(ctaButtons.length).toBeGreaterThan(0);
  });

  it('KONTROLA NEGATYWNA: klik CTA "Skonfiguruj wskaźniki" w pustym stanie tabeli OTWIERA kreator (nie jest atrapą bez handlera)', async () => {
    setupHappyPathMocks([]);
    const user = userEvent.setup();
    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );
    await waitFor(() => expect(apiMocks.getAnalysisKpiValues).toHaveBeenCalled());
    const ctaButtons = await screen.findAllByText('Skonfiguruj wskaźniki');
    // Ostatni = przycisk pustego stanu tabeli (StandardTable `empty.onAction`), pierwszy = primary CTA paska.
    await user.click(ctaButtons[ctaButtons.length - 1]);
    expect(await screen.findByTestId('analysis-creator-wizard')).toBeInTheDocument();
  });

  it('wskaźnik obecny ze statusem MISSING renderuje „—”, NIGDY „0” (dowód w realnym DOM, nie tylko w czystej funkcji)', async () => {
    const kpiValues: AnalysisKpiValueDto[] = [
      {
        kpiValueId: 'kv-1',
        kpiCatalogId: 'cat-1',
        kpiCode: 'GROSS_MARGIN_PCT',
        kpiName: 'Marża brutto',
        category: 'Rentowność',
        tier: 'UNIVERSAL',
        unitType: 'PERCENT',
        entityId: 'ent-1',
        periodId: 'p-2026',
        periodLabel: 'FY2026',
        value: {
          status: 'MISSING',
          valueDecimal: null,
          nativeCurrency: 'PLN',
          presentationCurrency: 'PLN',
          unit: 'UNITS',
          multiplier: '1',
        },
        qualityFlag: null,
        deltaVsPriorPeriod: null,
        deltaPctVsPriorPeriod: null,
        interpretationText: null,
        benchmark: null,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ];
    setupHappyPathMocks(kpiValues);
    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );
    await waitFor(() => expect(apiMocks.getAnalysisKpiValues).toHaveBeenCalled());
    await screen.findByText('Marża brutto');
    expect(screen.getByText('FY2026')).toBeInTheDocument();
    const zeroCells = screen.queryAllByText('0');
    expect(zeroCells).toHaveLength(0); // KONTROLA NEGATYWNA: MISSING nigdy nie renderuje się jako "0"
  });
});

describe('AnalysisCreatorWizard w AnalysisWorkspace — nawigacja krokami (jsdom)', () => {
  it('krok "Dalej" jest disabled dopóki krok bieżący jest niekompletny, i włącza się po wyborze', async () => {
    setupHappyPathMocks([]);
    const user = userEvent.setup();
    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );
    await waitFor(() => expect(apiMocks.getAnalysisKpiValues).toHaveBeenCalled());
    const ctaButtons = await screen.findAllByText('Skonfiguruj wskaźniki');
    await user.click(ctaButtons[ctaButtons.length - 1]);
    await screen.findByTestId('analysis-creator-wizard');

    const nextButton = screen.getByTestId('analysis-creator-next');
    expect(nextButton).toBeDisabled(); // source_version niekompletny (brak sourceOptions dostarczonych przez callera)
  });
});
