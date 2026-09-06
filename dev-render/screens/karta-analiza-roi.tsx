/**
 * KARTY N — Analiza ROI. Ekran harnessu wymagany przez rejestr
 * (`src/components/standard/registry.ts`, wpis `roi_case` → `karta-analiza-roi`)
 * i bramkę `scripts/karty-n-smoke.mjs`.
 *
 * Montuje REALNY `<RoiCaseCardPage />` na trasie `/results/roi/:roiCaseId`.
 * Sprawa ma przegląd po wdrożeniu (PIR) w statusie `draft`, bo TO jest jedyny
 * stan, w którym karta ma prawo edycji (serwerowy `NOT_EDITABLE`,
 * `roiPirCommands.ts:678`) — dopiero wtedy widać przełącznik „Edycja |
 * Podgląd" i pozycje „Uzupełnij…" (Zasada 2b).
 *
 * URL: ?screen=karta-analiza-roi[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { RoiCaseCardPage } from '../../src/components/ResultsVNext/roi/card/RoiCaseCardPage';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

try {
  localStorage.setItem('ff.results_vnext_roi_registry', '1');
} catch {
  /* prywatne okno — harness wyrenderuje stan wygaszony */
}

const CASE_ID = 'roi-case-harness';

const CARD = {
  caseId: CASE_ID,
  organizationId: 'org-harness',
  initiativeId: 'init-harness',
  title: 'Automatyzacja pakowania — linia 2',
  status: 'in_review',
  ownerUserId: 'user-piotr-demo',
  currency: 'PLN',
  granularity: 'yearly',
  analysisStart: '2026-01-01',
  analysisEnd: '2030-12-31',
  updatedAt: '2026-09-05T10:00:00.000Z',
  phase: 'realization',
  subjectType: 'Inwestycja produkcyjna',
  optionVariant: 2,
  optionVariantLabel: 'Wariant 2 — cobot + przenośnik',
  problemStatement:
    'Pakowanie ręczne na linii 2 wymaga trzech osób na zmianę i jest wąskim gardłem przy szczycie sezonu.',
  scopeSummary: 'Zakres obejmuje cobota pakującego, przenośnik i integrację z MES.',
  bauOptionLabel: 'Utrzymanie pakowania ręcznego',
  recommendation: 'conditional_go',
  recommendationCondition: 'Pod warunkiem utrzymania wolumenu powyżej 60 tys. szt./mies.',
  baseline: {
    currentMeasuredValue: 3,
    currentMeasuredUnit: 'osoby/zmianę',
    currentMeasuredAsOf: '2026-05-31',
    interventionComparisonNotes: null,
    source: 'Pomiar czasu pracy, maj 2026',
    confidence: 'medium',
  },
  calculationPolicy: {
    discountRatePct: 8,
    taxTreatment: 'pre_tax',
    inflationRatePct: 3,
    requiredMetrics: null,
    notes: null,
  },
  assumptions: [],
  costLines: [],
  benefitLines: [],
  risks: [],
  indicators: {
    capex: 480000,
    horizonYears: 5,
    npv: 612000,
    irrPct: 24,
    piRatio: 1.52,
    bcr: 2,
  },
  storedRun: {
    runId: 'run-1',
    roiPct: 128,
    npv: 612000,
    irrPct: 24,
    paybackPeriods: 2.4,
    computedAt: '2026-08-20T10:00:00.000Z',
  },
  cashFlow: [],
  sensitivity: [],
  scenarios: [],
  variances: [],
  pirs: [
    {
      pirId: 'pir-1',
      sequenceNumber: 1,
      milestoneMonths: 12,
      status: 'draft',
      outcome: null,
      lessonsLearned: null,
      recommendation: null,
      realizedRoiPct: null,
      realizedNpv: null,
      realizedPaybackYears: null,
      startedAt: '2026-09-01T08:00:00.000Z',
      finalizedAt: null,
    },
  ],
};

const ODPOWIEDZI: Array<[RegExp, unknown]> = [
  [/\/roi\/cases\/[^/]+\/card$/, { card: CARD }],
  [/\/roi\/[^/]+\/card$/, { card: CARD }],
  [/post-investment-reviews/, { postInvestmentReviews: [] }],
];

const oryginalnyFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/api/')) return oryginalnyFetch(input as RequestInfo, init);
  const sciezka = url.split('?')[0];
  const trafienie = ODPOWIEDZI.find(([wzorzec]) => wzorzec.test(sciezka));
  // Domyślnie oddajemy kartę — `getRoiCaseCard` czyta klucz `card`, a inne
  // zapytania tej strony i tak tolerują pusty kształt.
  return new Response(JSON.stringify(trafienie ? trafienie[1] : { card: CARD }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof window.fetch;

export default function KartaAnalizaRoiScreen() {
  return (
    <MemoryRouter initialEntries={[`/results/roi/${CASE_ID}`]}>
      <div className="h-screen bg-c-bg text-c-text">
        <Routes>
          <Route path="/results/roi/:roiCaseId" element={<RoiCaseCardPage />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
