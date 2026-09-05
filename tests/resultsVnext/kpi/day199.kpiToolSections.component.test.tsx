/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { Api } from '../../../src/services/api';
import { KpiToolPage } from '../../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { ROUTES } from '../../../src/routes/routeConfig';

const KPI_ID = '11111111-1111-1111-1111-111111111111';
const KPI = {
  kpiId: KPI_ID,
  organizationId: 'org-1',
  kpiCode: 'KPI-MARZA-01',
  status: 'active',
  currentDefinitionVersionId: 'dv-1',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'owner-1',
  rowVersion: 1,
  createdBy: 'owner-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

function mockReads(options: { scorecards?: unknown[]; history?: unknown[] } = {}) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url === `/vnext/results/kpi/${KPI_ID}`) return { kpi: KPI };
    if (url === `/vnext/results/kpi/${KPI_ID}/version`) return { definitionVersion: null };
    if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) return { measurements: [] };
    if (url.startsWith('/vnext/results/kpi/deviation-cases')) return { cases: [] };
    if (url === `/vnext/results/kpi/${KPI_ID}/initiative-impacts`) return { impacts: [] };
    if (url === `/vnext/results/kpi/scorecards/for-kpi/${KPI_ID}`) {
      return { scorecards: options.scorecards ?? [] };
    }
    if (url === `/vnext/results/kpi/${KPI_ID}/history`) {
      return { entries: options.history ?? [], nextCursor: null };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
}

function renderTool() {
  window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  return render(
    <MemoryRouter initialEntries={[`/results/kpi/${KPI_ID}`]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.TOOL} element={<KpiToolPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function openSection(label: string) {
  await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());
  await userEvent.click((await screen.findAllByText(label))[0]);
}

describe('day199 KPI tool scorecards and history wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders an honest empty state for scorecards returned by the reverse lookup', async () => {
    mockReads();
    renderTool();
    await openSection('Zestawienia');
    expect(await screen.findByText('Brak kart wyników')).toBeInTheDocument();
    expect(Api.get).toHaveBeenCalledWith(`/vnext/results/kpi/scorecards/for-kpi/${KPI_ID}`);
  });

  it('renders scorecard data returned by the reverse lookup', async () => {
    mockReads({
      scorecards: [{
        scorecardId: 'scorecard-1', organizationId: 'org-1', name: 'Karta rentowności',
        description: 'Miesięczny przegląd marży', scopeType: 'organization', scopeId: null,
        ownerUserId: 'owner-1', ownerName: 'Anna Kowalska', reviewFrequency: 'monthly',
        lifecycleStatus: 'active', rowVersion: 1, createdBy: 'owner-1',
        createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z',
      }],
    });
    renderTool();
    await openSection('Zestawienia');
    // 2026-09-05 (trzypoziomowa formuła KPI): nazwa zestawienia pojawia się
    // teraz w DWÓCH miejscach — w ścieżce poziomów (środkowy stopień
    // „Rejestr KPI › <zestawienie> › <wskaźnik>") i na kafelku sekcji. Pierwsze
    // dopasowanie `findByText` bywa więc breadcrumbem, zanim sekcja zdąży się
    // rozwinąć — dlatego na LISTĘ sekcji czekamy osobno, zamiast czytać ją
    // synchronicznie.
    expect(await screen.findByTestId('kpi-tool-scorecards-list')).toBeInTheDocument();
    expect(screen.getAllByText('Karta rentowności').length).toBeGreaterThan(0);
  });

  it('renders an honest empty state for KPI history', async () => {
    mockReads();
    renderTool();
    await openSection('Rodowód');
    expect(await screen.findByText('Brak historii KPI')).toBeInTheDocument();
    expect(Api.get).toHaveBeenCalledWith(`/vnext/results/kpi/${KPI_ID}/history`);
  });

  it('renders immutable KPI history entries', async () => {
    mockReads({
      history: [{
        entryId: 'event-1', occurredAt: '2026-08-30T10:00:00.000Z', kind: 'LIFECYCLE',
        summaryCode: 'KPI_ACTIVATED', actorUserId: 'owner-1', sourceVersion: 2, references: {},
      }],
    });
    renderTool();
    await openSection('Rodowód');
    expect(await screen.findByText('KPI_ACTIVATED')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-tool-history-list')).toBeInTheDocument();
  });
});
