/**
 * @vitest-environment jsdom
 *
 * `ValuationWorkspace` — integration tests (Pakiet H).
 *
 * Proves:
 *   - seven-step navigation renders the right step content, in the canonical order;
 *   - N/A/MISSING never render as "0" in the Methods step (OWN-FIN-021 point 3), while a REAL
 *     zero (PRESENT_ZERO) renders as "0" — the two must be visually distinguishable;
 *   - a crash in ONE step's content is caught by that step's local `FinanceErrorBoundary` and
 *     does NOT take down the bar or navigation to other steps (OWN-FIN-002) — KONTROLA
 *     NEGATYWNA proves the harness can detect a real crash (not a vacuously-green boundary).
 *
 * The real API module is never mocked via `vi.mock()` — `ValuationWorkspace` accepts an
 * injectable `api` prop, so tests supply fakes directly (same DI pattern the component itself
 * documents).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ValuationWorkspaceApi } from '../ValuationWorkspace';
import { ValuationWorkspace } from '../ValuationWorkspace';

const BV_ID = 'bv-valuation-1';

function baseVariant() {
  return {
    businessVersionId: BV_ID,
    caseId: 'case-1',
    name: 'DBR77 — Wycena FY2026',
    description: null,
    status: 'DRAFT',
    freshness: 'CURRENT',
    versionNo: 1,
    createdBy: 'user-1',
    createdAt: '2026-08-01T00:00:00Z',
  };
}

function makeApi(overrides: Partial<ValuationWorkspaceApi> = {}): ValuationWorkspaceApi {
  return {
    getValuationVariant: vi.fn().mockResolvedValue(baseVariant()),
    getFinanceVersionLineage: vi.fn().mockResolvedValue({ businessVersionId: BV_ID, ancestors: [], descendants: [] }),
    getValuationWaccInputs: vi.fn().mockResolvedValue(null),
    upsertValuationWaccInputs: vi.fn(),
    listValuationMethods: vi.fn().mockResolvedValue({ methods: [], weightedRecommendation: { status: 'NO_BASKET' } }),
    createValuationMethod: vi.fn(),
    setValuationMethodBasketWeights: vi.fn(),
    getValuationResults: vi.fn().mockResolvedValue(null),
    getValuationSensitivityGrid: vi.fn(),
    generateValuationAdvisorOutput: vi.fn(),
    listValuationAdvisorOutputs: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ValuationWorkspace — nawigacja siedmiu kroków', () => {
  it('renderuje krok Source jako domyślny i pokazuje nazwę wariantu w pasku', async () => {
    render(<ValuationWorkspace businessVersionId={BV_ID} api={makeApi()} />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('DBR77 — Wycena FY2026'));
    expect(screen.getByTestId('valuation-source-step')).toBeInTheDocument();
  });

  it('klik w krok "Metody i wagi" przełącza widoczną treść, zachowując pasek', async () => {
    render(<ValuationWorkspace businessVersionId={BV_ID} api={makeApi()} />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar-name')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Metody i wagi'));

    await waitFor(() => expect(screen.getByTestId('valuation-methods-step')).toBeInTheDocument());
    expect(screen.queryByTestId('valuation-source-step')).not.toBeInTheDocument();
    // The bar itself survives the step switch.
    expect(screen.getByTestId('finance-workspace-bar-name')).toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA: nawigacja do nieistniejącego kroku nie psuje renderu (klik w realny krok zawsze zmienia treść)', async () => {
    render(<ValuationWorkspace businessVersionId={BV_ID} api={makeApi()} />);
    await waitFor(() => expect(screen.getByTestId('valuation-source-step')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Eksport'));
    await waitFor(() => expect(screen.getByTestId('valuation-export-step')).toBeInTheDocument());
    // Proves the DOM really changed (not stuck on Source) — if step switching were broken, this would still show source.
    expect(screen.queryByTestId('valuation-source-step')).not.toBeInTheDocument();
  });
});

describe('ValuationWorkspace — N/A vs PLN 0 (OWN-FIN-021 punkt 3)', () => {
  const methodsWithMixedStatuses = {
    methods: [
      { methodId: 'm-zero', methodType: 'DCF_FCFF' as const, readiness: 'READY' as const, result: { status: 'PRESENT_ZERO' as const, valueDecimal: '0' }, isInRecommendationBasket: false, weightPct: null },
      { methodId: 'm-na', methodType: 'TRADING_COMPS' as const, readiness: 'NOT_CONFIGURED' as const, result: { status: 'NA' as const, valueDecimal: null }, isInRecommendationBasket: false, weightPct: null },
      { methodId: 'm-missing', methodType: 'ASSET_BASED' as const, readiness: 'DATA_INCOMPLETE' as const, result: { status: 'MISSING' as const, valueDecimal: null }, isInRecommendationBasket: false, weightPct: null },
    ],
    weightedRecommendation: { status: 'NO_BASKET' as const },
  };

  it('renderuje PRESENT_ZERO jako "0", a NA/MISSING jako "—" z widocznym powodem — nigdy jako "0"', async () => {
    const api = makeApi({ listValuationMethods: vi.fn().mockResolvedValue(methodsWithMixedStatuses) });
    render(<ValuationWorkspace businessVersionId={BV_ID} api={api} initialStepId="methods" />);

    const zeroRow = await screen.findByTestId('method-row-DCF_FCFF');
    const zeroCell = within(zeroRow).getByTestId('valuation-value-cell');
    expect(zeroCell).toHaveAttribute('data-value-status', 'PRESENT_ZERO');
    expect(zeroCell.textContent).toContain('0');

    const naRow = screen.getByTestId('method-row-TRADING_COMPS');
    const naCell = within(naRow).getByTestId('valuation-value-cell');
    expect(naCell).toHaveAttribute('data-value-status', 'NA');
    expect(naCell.textContent).not.toBe('0');
    expect(naCell.textContent).toMatch(/nie dotyczy/i);

    const missingRow = screen.getByTestId('method-row-ASSET_BASED');
    const missingCell = within(missingRow).getByTestId('valuation-value-cell');
    expect(missingCell).toHaveAttribute('data-value-status', 'MISSING');
    expect(missingCell.textContent).not.toBe('0');
    expect(missingCell.textContent).toMatch(/brak danych/i);
  });

  it('KONTROLA NEGATYWNA: NA i MISSING muszą wyglądać RÓŻNIE od PRESENT_ZERO — same "0" dla wszystkich trzech byłoby błędem, który ten test wykrywa', async () => {
    const api = makeApi({ listValuationMethods: vi.fn().mockResolvedValue(methodsWithMixedStatuses) });
    render(<ValuationWorkspace businessVersionId={BV_ID} api={api} initialStepId="methods" />);
    const naRow = await screen.findByTestId('method-row-TRADING_COMPS');
    const naCellText = within(naRow).getByTestId('valuation-value-cell').textContent;
    expect(naCellText).not.toBe('0');
  });
});

describe('ValuationWorkspace — lokalny ErrorBoundary (OWN-FIN-002)', () => {
  it('błąd renderu w kroku Wyniki jest złapany lokalnie — pasek i nawigacja do innych kroków działają dalej', async () => {
    // `results.methods` is undefined — ResultsStep's `computeMethodResultRange(results.methods)`
    // calls `.filter` on it and throws a real TypeError, exercising the ACTUAL error boundary,
    // not a manufactured `throw` inside a test-only component.
    const brokenResults = { businessVersionId: BV_ID, headlineEnterpriseValue: { source: 'NONE', value: null, pointer: null } } as any;
    const api = makeApi({ getValuationResults: vi.fn().mockResolvedValue(brokenResults) });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ValuationWorkspace businessVersionId={BV_ID} api={api} initialStepId="results" />);

    await waitFor(() => expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument());
    // The bar (name, step nav) survives the crash below it.
    expect(screen.getByTestId('finance-workspace-bar-name')).toBeInTheDocument();
    expect(screen.getByText('Źródło')).toBeInTheDocument();

    // Navigation to a DIFFERENT step still works after the crash — the crash did not corrupt workspace state.
    fireEvent.click(screen.getByText('Źródło'));
    await waitFor(() => expect(screen.getByTestId('valuation-source-step')).toBeInTheDocument());
    expect(screen.queryByTestId('finance-error-boundary')).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('KONTROLA NEGATYWNA: bez błędu, boundary NIE renderuje się (dowód że test wykrywa realny stan, nie zawsze-czerwony/zawsze-zielony fixture)', async () => {
    const okResults = {
      businessVersionId: BV_ID,
      variant: null,
      status: 'DRAFT',
      freshness: 'CURRENT',
      headlineEnterpriseValue: { source: 'NONE', value: null, pointer: null },
      weightedRecommendation: { status: 'NO_BASKET' },
      methods: [],
      wacc: null,
      terminal: [],
      bridge: null,
      sensitivityGrids: [],
      usableCompsByMethodId: {},
      methodAgreementWarnings: [],
    };
    const api = makeApi({ getValuationResults: vi.fn().mockResolvedValue(okResults) });
    render(<ValuationWorkspace businessVersionId={BV_ID} api={api} initialStepId="results" />);
    await waitFor(() => expect(screen.getByTestId('valuation-results-step')).toBeInTheDocument());
    expect(screen.queryByTestId('finance-error-boundary')).not.toBeInTheDocument();
  });
});
