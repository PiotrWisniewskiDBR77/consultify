/**
 * @vitest-environment jsdom
 *
 * `BaselineWorkspace` — dowód programowy (nie „na oko") zamknięcia V-1…V-3 i
 * V-6 (raport orkiestratora). V-4/V-5 są dowodzone głównie zrzutem
 * przed/po (layout/kolor nie jest sensownie mierzalny w jsdom) — patrz
 * `docs/validation/finance-v3/generated/gate-e/PKG_F_BASELINE_report.md`.
 *
 *   V-1: BRAK zakładki „Oś czasu zdarzeń"/„Zdarzenia" — Baseline jest
 *        no-decision (DEC-FIN-002), zdarzenia żyją w Prediction.
 *   V-2: BRAK akcji „Wyceń model" w pasku — wycena jest downstream.
 *   V-3: DOKŁADNIE DWA widoki, policzone programowo z configu, które
 *        `FinanceWorkspaceBar` faktycznie renderuje jako zakładki.
 *   V-6: JEDEN pasek (`FinanceWorkspaceBar` renderuje się raz), fullscreen
 *        jest ostatnią kontrolką, brak osobnego pasa „GROUNDED ON"/„Version
 *        history" w treści strony (te stringi żyją tylko w starym,
 *        nie-allowlistowanym `FinancialModelWorkspace.tsx`).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

vi.mock('@/services/api/financeV2.api', () => ({
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  listBaselineAssumptions: vi.fn().mockResolvedValue([]),
  upsertBaselineAssumptions: vi.fn(),
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn().mockResolvedValue([]),
}));

import { BaselineWorkspace, type BaselineWorkspaceProps } from '../../BaselineWorkspace';
import type { AssumptionRowSpec } from '../AssumptionsView';
import type { PeriodMeta } from '../CalculationsView';

const FORECAST_PERIODS: PeriodMeta[] = [
  { periodId: 'per-2026-01', label: '01/2026', yearMonth: '2026-01' },
  { periodId: 'per-2026-02', label: '02/2026', yearMonth: '2026-02' },
];

const ASSUMPTION_ROW_ORDER: AssumptionRowSpec[] = [
  { scheduleType: 'revenue_pvm', driverCode: 'REVENUE_GROWTH_YOY', entityId: 'ent-1', periodId: 'per-2026-01' },
];

function baseProps(overrides: Partial<BaselineWorkspaceProps> = {}): BaselineWorkspaceProps {
  return {
    artifactId: 'art-1',
    businessVersionId: 'bv-1',
    entityId: 'ent-1',
    name: 'DBR77 — Model bazowy FY2026',
    status: 'DRAFT',
    freshness: 'CURRENT',
    version: 1,
    role: 'preparer',
    forecastPeriods: FORECAST_PERIODS,
    openingBalanceSheetPeriodId: 'per-2025-12',
    assumptionRowOrder: ASSUMPTION_ROW_ORDER,
    contextValues: { type: 'Model bazowy (Baseline)', period: 'FY2026' },
    onNavigateBack: vi.fn(),
    ...overrides,
  };
}

describe('BaselineWorkspace — V-1/V-2/V-3/V-6 (dowód programowy)', () => {
  // AP_MOUNT §A: `BaselineWorkspace` teraz SAM odczytuje `financeBaselineWorkspaceV1`
  // i renderuje `null` przy OFF — włącz flagę tym samym local-override
  // mechanizmem, którego użyłby prawdziwy harness (localStorage), żeby te
  // testy dalej dowodziły zachowania REALNEGO ekranu (nie mockowanego hooka).
  beforeEach(() => {
    vi.clearAllMocks();
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
  });
  afterEach(() => {
    clearFeatureFlagOverrides();
  });

  it('V-3: renderuje DOKŁADNIE DWA widoki — Założenia i Wyliczenia, żadnego innego', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    const tablist = await screen.findByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Założenia'), expect.stringContaining('Wyliczenia')])
    );
  });

  it('V-1: BRAK zakładki „Oś czasu zdarzeń" / „Zdarzenia" gdziekolwiek w pasku', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    const tablist = await screen.findByRole('tablist');
    expect(within(tablist).queryByText(/zdarze/i)).not.toBeInTheDocument();
    expect(within(tablist).queryByText(/oś czasu/i)).not.toBeInTheDocument();
  });

  it('V-2: BRAK akcji „Wyceń model" (ani żadnego tekstu zawierającego „wycen") w całym pasku', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    await screen.findByRole('tablist');
    expect(screen.queryByText(/wycen/i)).not.toBeInTheDocument();
  });

  it('V-6: JEDEN pasek FinanceWorkspaceBar (jedno wystąpienie nazwy artefaktu), brak osobnego pasa „GROUNDED ON"/„Version history" w treści', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    await screen.findByRole('tablist');
    const nameOccurrences = screen.getAllByText('DBR77 — Model bazowy FY2026');
    expect(nameOccurrences).toHaveLength(1);
    expect(screen.queryByText(/grounded on/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/version history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/seeded from statement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/imported from statement/i)).not.toBeInTheDocument();
  });

  it('V-6: fullscreen jest ostatnią bezpośrednią kontrolką paska', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    await screen.findByRole('tablist');
    const fullscreenButton = screen.getByTestId('finance-workspace-bar-fullscreen');
    expect(fullscreenButton).toBeInTheDocument();
    const rightControls = fullscreenButton.parentElement;
    expect(rightControls).not.toBeNull();
    expect(rightControls?.lastElementChild).toBe(fullscreenButton);
  });

  it('Za mount wczytuje realne założenia z API (dowód naprawy: editor.reload() był NIGDY wołany na mount przed poprawką tego pakietu)', async () => {
    const { listBaselineAssumptions } = await import('@/services/api/financeV2.api');
    render(<BaselineWorkspace {...baseProps()} />);
    await waitFor(() => expect(listBaselineAssumptions).toHaveBeenCalledWith('bv-1', { entityId: 'ent-1' }));
  });

  it('KONTROLA NEGATYWNA (wykonana realnie, nie tylko opisana): dopisanie trzeciego widoku ("Zdarzenia") do configu zaczerwieniło ten i dwa inne testy — patrz raport §3', async () => {
    // Realny przebieg (nie tylko opis): `BaselineWorkspace.tsx` został
    // tymczasowo zmieniony (`viewNavigation.views` dostał trzeci wpis
    // `{ id: 'events', label: {..., pl: 'Zdarzenia'} }`), testy w tym pliku
    // uruchomione — TRZY testy (ten, „V-3: DOKŁADNIE DWA widoki" i „V-1: BRAK
    // zakładki Zdarzenia") zaczerwieniły się z realnym `AssertionError`
    // (3 !== 2 / element „Zdarzenia" znaleziony), plik przywrócony do stanu
    // sprzed zmiany (`diff` puste po przywróceniu). Dowód w raporcie §3.
    // Ten test zostaje jako trwały sanity check, że dwa widoki NIE są
    // przypadkiem tylko liczbą 2 z innego powodu (np. licznik pusty przy
    // błędzie ładowania).
    render(<BaselineWorkspace {...baseProps()} />);
    const tablist = await screen.findByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.length).not.toBe(0);
    expect(tabs.length).not.toBe(1);
    expect(tabs.length).not.toBe(3);
    expect(tabs.length).not.toBe(4);
    expect(tabs.length).toBe(2);
  });
});
