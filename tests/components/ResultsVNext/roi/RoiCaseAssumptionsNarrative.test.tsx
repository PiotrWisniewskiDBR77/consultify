/**
 * @vitest-environment jsdom
 *
 * Odrzucenie właściciela 2026-09-05 („Nie. Ma być taka jak zatwierdzona.") —
 * test broni JEDNEJ rzeczy, której brak wywołał odrzucenie: sekcja „Założenia"
 * karty ROI musi renderować NARRACJĘ z REALNYCH rekordów sprawy, a nie surowe
 * tabele edycyjne ani tekst wpisany na sztywno.
 *
 * Dowód mutacyjny (wykonany ręcznie przy pisaniu): podmiana źródła bloku
 * „Na co idzie …" na stałą listę pozycji z prototypu wywraca asercje na
 * kwotach i sumie poniżej — test celuje w PRZEPŁYW DANYCH `RoiCostLine` →
 * ekran, nie w samo istnienie nagłówka.
 *
 * Sieć jest mockowana na poziomie `global.fetch` (tak jak
 * `RoiCaseToolPage.test.tsx`), więc przechodzi przez prawdziwego klienta
 * `roiCaseDetailApi.ts` — nie przez atrapę modułu, która mogłaby ukryć błąd
 * ścieżki/koperty odpowiedzi.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { RoiCaseAssumptionsNarrative } from '../../../../src/components/ResultsVNext/roi/RoiCaseAssumptionsNarrative';
import { API_URL } from '../../../../src/services/api';

const CASE_ID = '44444444-4444-4444-4444-444444444444';

const ROI_CASE = {
  caseId: CASE_ID,
  organizationId: 'org-1',
  initiativeId: 'init-1',
  title: 'Program poprawy realizacji korzyści',
  ownerUserId: 'user-owner',
  status: 'modeling',
  currency: 'PLN',
  granularity: 'monthly',
  analysisStart: '2026-09-01',
  analysisEnd: '2028-09-01',
  nextActionType: null,
  nextActionDueAt: null,
  nextReviewAt: null,
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  changesRequestedAt: null,
  changesRequestedReason: null,
  archivedAt: null,
  rowVersion: 1,
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
} as any;

const COST_LINE_BASE = {
  caseId: CASE_ID,
  organizationId: 'org-1',
  category: 'capex',
  currency: 'PLN',
  timingType: 'one_time',
  oneTimePeriodDate: '2026-09-01',
  recurrenceStartDate: null,
  recurrenceEndDate: null,
  recurrenceCadence: null,
  confidence: 'medium',
  source: null,
  ownerUserId: null,
  deletedAt: null,
  deletedBy: null,
  frozenAt: null,
  frozenBy: null,
  rowVersion: 1,
  createdBy: 'user-owner',
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
};

const COST_LINES = [
  {
    ...COST_LINE_BASE,
    costLineId: 'cl-1',
    label: 'Szkolenie operatorów SMED',
    description: '3 zmiany, 24 osoby',
    amount: 140000,
  },
  {
    ...COST_LINE_BASE,
    costLineId: 'cl-2',
    label: 'Wózki narzędziowe i oznakowanie stanowisk',
    description: null,
    amount: 165000,
  },
  {
    ...COST_LINE_BASE,
    costLineId: 'cl-usuniety',
    label: 'Pozycja wycofana',
    description: null,
    amount: 999000,
    deletedAt: '2026-08-20T09:00:00.000Z',
  },
];

const ASSUMPTIONS = [
  {
    assumptionId: 'as-1',
    caseId: CASE_ID,
    organizationId: 'org-1',
    category: 'operational',
    label: 'Czas przezbrojenia przed programem',
    unit: 'min',
    baseValue: 47,
    downsideValue: null,
    upsideValue: null,
    confidence: 'high',
    evidenceRef: null,
    source: 'raport SAP PM, styczeń–czerwiec 2026',
    ownerUserId: null,
    sensitivityRank: 1,
    notes: null,
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 1,
    createdBy: 'user-owner',
    createdAt: '2026-08-13T09:00:00.000Z',
    updatedAt: '2026-08-13T09:00:00.000Z',
  },
];

const BASELINE = {
  baselineId: 'bl-1',
  caseId: CASE_ID,
  organizationId: 'org-1',
  baselinePeriodStart: '2026-01-01',
  baselinePeriodEnd: '2026-06-30',
  currentMeasuredValue: 1118,
  currentMeasuredUnit: 'przezbrojeń',
  currentMeasuredAsOf: '2026-06-30',
  bauProjectionMethod: 'flat',
  bauGrowthRatePct: 0,
  bauReferenceValue: 1118,
  interventionComparisonNotes: null,
  source: 'kontroling zakładu',
  confidence: 'high',
  ownerUserId: null,
  frozenAt: null,
  frozenBy: null,
  rowVersion: 1,
  createdBy: 'user-owner',
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
};

const POLICY = {
  policyRowId: 'pol-1',
  caseId: CASE_ID,
  organizationId: 'org-1',
  discountRatePct: 10,
  taxTreatment: 'pre_tax',
  inflationRatePct: 0,
  roundingPolicy: 'half_up_2dp',
  requiredMetrics: ['NPV', 'IRR', 'payback'],
  notes: null,
  confidence: 'medium',
  ownerUserId: null,
  frozenAt: null,
  frozenBy: null,
  rowVersion: 1,
  createdBy: 'user-owner',
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function mockFetch(overrides: { costLines?: unknown[]; assumptions?: unknown[]; baseline?: unknown } = {}) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith(`${API_URL}/vnext/results/roi/cases/${CASE_ID}/baseline`)) {
      return jsonResponse({ baseline: 'baseline' in overrides ? overrides.baseline : BASELINE });
    }
    if (url.startsWith(`${API_URL}/vnext/results/roi/cases/${CASE_ID}/calculation-policy`)) {
      return jsonResponse({ calculationPolicy: POLICY });
    }
    if (url.startsWith(`${API_URL}/vnext/results/roi/cases/${CASE_ID}/assumptions`)) {
      return jsonResponse({ assumptions: overrides.assumptions ?? ASSUMPTIONS });
    }
    if (url.startsWith(`${API_URL}/vnext/results/roi/cases/${CASE_ID}/cost-lines`)) {
      return jsonResponse({ costLines: overrides.costLines ?? COST_LINES });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
}

function renderNarrative(props: Partial<React.ComponentProps<typeof RoiCaseAssumptionsNarrative>> = {}) {
  return render(
    <RoiCaseAssumptionsNarrative
      roiCase={ROI_CASE}
      isPolish
      onEditAssumptions={props.onEditAssumptions ?? (() => undefined)}
      onEditCostLines={props.onEditCostLines ?? (() => undefined)}
    />
  );
}

describe('RoiCaseAssumptionsNarrative — sekcja „Założenia" karty ROI w zatwierdzonej kompozycji', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renderuje trzy bloki narracji z REALNYCH pozycji kosztowych sprawy (suma + wiersze + opisy)', async () => {
    mockFetch();
    renderNarrative();

    await waitFor(() => expect(screen.getByTestId('roi-assumptions-narrative')).toBeInTheDocument());

    // ① nagłówek bloku niesie SUMĘ policzoną z RoiCostLine (140 000 + 165 000),
    //    a pozycja skasowana miękko (999 000) do niej NIE wchodzi.
    expect(screen.getByText(/Na co idzie/)).toHaveTextContent('305');
    expect(screen.queryByText('Pozycja wycofana')).not.toBeInTheDocument();

    // ② każdy żywy RoiCostLine to jeden wiersz tabeli Pozycja/Kwota…
    const rows = screen.getAllByTestId('roi-narrative-cost-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Szkolenie operatorów SMED')).toBeInTheDocument();
    // …wraz z opisem pozycji (`description`), którego stary warsztat nie pokazywał.
    expect(within(rows[0]).getByText('3 zmiany, 24 osoby')).toBeInTheDocument();
    expect(rows[0].textContent?.replace(/ | /g, ' ')).toContain('140 000');
    expect(rows[1].textContent?.replace(/ | /g, ' ')).toContain('165 000');

    // ③ „Parametry przypadku biznesowego" — z polityki kalkulacji i okna analizy.
    expect(screen.getByText('Parametry przypadku biznesowego')).toBeInTheDocument();
    expect(screen.getByText('Inwestycja początkowa')).toBeInTheDocument();
    expect(screen.getByText(/24 miesiące/)).toBeInTheDocument();
    expect(screen.getByText(/10\s*% rocznie|10% rocznie/)).toBeInTheDocument();

    // ④ „Źródła liczb" — bullety z baseline'u i założeń, nie z prototypu.
    expect(screen.getByText('Źródła liczb')).toBeInTheDocument();
    expect(screen.getByText(/raport SAP PM/)).toBeInTheDocument();
    expect(screen.getByText(/kontroling zakładu/)).toBeInTheDocument();
    // treść prototypu (fikcyjny NordFood) nie ma prawa się pojawić
    expect(screen.queryByText(/NordFood/)).not.toBeInTheDocument();
  });

  it('sprawa bez pozycji kosztowych i bez źródeł: uczciwy stan pusty + CTA do warsztatu (a nie zmyślona narracja)', async () => {
    mockFetch({ costLines: [], assumptions: [], baseline: null });
    renderNarrative();

    await waitFor(() => expect(screen.getByTestId('roi-assumptions-narrative')).toBeInTheDocument());

    expect(screen.getByTestId('roi-narrative-costs-empty')).toBeInTheDocument();
    expect(screen.getByTestId('roi-narrative-sources-empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dodaj pozycje kosztowe/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uzupełnij założenia i baseline/ })).toBeInTheDocument();
    // brak danych → brak zmyślonej kwoty w nagłówku bloku
    expect(screen.queryByText(/Na co idzie/)).not.toBeInTheDocument();
  });
});
