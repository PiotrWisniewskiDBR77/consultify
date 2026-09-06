/**
 * KARTY N — Miernik (KPI). Ekran harnessu wymagany przez rejestr
 * (`src/components/standard/registry.ts`, wpis `metric` → `karta-miernik`)
 * i bramkę `scripts/karty-n-smoke.mjs`.
 *
 * Montuje REALNY `<KpiToolPage />` — nie przepisuje ani jednego kawałka
 * ekranu. Dane idą przez `window.fetch` (cała warstwa HTTP tej paczki —
 * `Api.*`, `getJson`, `mutateJson` — kończy na `fetch`, sprawdzone w
 * `src/services/api.ts` i `okrObjectiveApi.ts`), więc jeden stub obsługuje
 * wszystkie zapytania karty. Trasa jest prawdziwa (`/results/kpi/:kpiId`),
 * bo karta czyta `useParams`.
 *
 * URL: ?screen=karta-miernik[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { KpiToolPage } from '../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Flaga domeny KPI — ekran jest za nią wygaszony (`resultsVNextFeatureFlags.ts`).
try {
  localStorage.setItem('ff.results_vnext_kpi_registry', '1');
} catch {
  /* prywatne okno / zablokowane cookies — harness i tak wyrenderuje stan wygaszony */
}

const KPI_ID = 'kpi-harness-terminowosc';
const VERSION_ID = 'kpi-harness-terminowosc-v3';

const KPI = {
  kpiId: KPI_ID,
  organizationId: 'org-harness',
  kpiCode: 'DELIVERY_ON_TIME',
  status: 'active',
  currentDefinitionVersionId: VERSION_ID,
  primaryProcessId: 'Realizacja zamówień',
  responsePolicyId: 'przeglad-tygodniowy',
  ownerUserId: 'user-piotr-demo',
  rowVersion: 4,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-06-12T08:00:00.000Z',
  updatedAt: '2026-09-05T09:00:00.000Z',
  name: 'Terminowość dostaw',
};

/** `approvalStatus: 'draft'` — świadomie, bo TO jest stan, w którym karta ma
 *  prawo edycji (serwerowa bramka `NOT_A_DRAFT`), a więc pokazuje przełącznik
 *  „Edycja | Podgląd" i pełne trzy pozycje „Pracuj z AI". */
const VERSION = {
  definitionVersionId: VERSION_ID,
  kpiId: KPI_ID,
  organizationId: 'org-harness',
  versionNumber: 3,
  name: 'Terminowość dostaw',
  description: 'Udział zamówień wydanych klientowi w terminie zadeklarowanym w potwierdzeniu.',
  unit: '%',
  targetGeometry: 'threshold_min',
  targetValue: 95,
  targetMin: null,
  targetMax: null,
  warningLow: 92,
  warningHigh: null,
  criticalLow: 88,
  criticalHigh: null,
  binarySuccessValue: null,
  formulaText: null,
  approvalStatus: 'draft',
  effectiveFrom: '2026-07-01',
  effectiveTo: null,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-09-05T09:00:00.000Z',
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  rowVersion: 2,
};

const MEASUREMENTS = [
  {
    measurementId: 'meas-1',
    kpiId: KPI_ID,
    definitionVersionId: VERSION_ID,
    organizationId: 'org-harness',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    actualValue: 91.4,
    periodTargetValue: 95,
    performanceStatus: 'warning',
    dataQualityStatus: 'verified',
    correctionOfMeasurementId: null,
    correctionReason: null,
    source: 'ERP',
    evidenceRefs: [],
    notes: null,
    recordedBy: 'user-piotr-demo',
    recordedAt: '2026-09-01T07:00:00.000Z',
  },
];

const ODPOWIEDZI: Array<[RegExp, unknown]> = [
  [/\/kpi\/[^/]+\/version$/, { definitionVersion: VERSION }],
  [/\/kpi\/[^/]+\/measurements/, { measurements: MEASUREMENTS, items: MEASUREMENTS }],
  [/\/kpi\/[^/]+\/history/, { entries: [], items: [], nextCursor: null }],
  [/\/kpi\/[^/]+\/initiative-impacts/, { impacts: [], items: [] }],
  [/\/kpi\/[^/]+\/scorecards/, { scorecards: [], items: [] }],
  [/deviation-cases/, { cases: [], items: [] }],
  [/action-cards/, { actionCards: [], items: [] }],
  [/\/kpi\/[^/?]+$/, { kpi: KPI }],
];

const oryginalnyFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  // Wywołania AI (`/api/ai/**`) idą do PRAWDZIWEGO backendu przez proxy vite —
  // inaczej „Uzupełnij…" nie miałoby czym wygenerować propozycji i zrzut
  // pokazywałby atrapę zamiast działającej funkcji. Zapis nadal trafia w stub,
  // więc żaden realny rekord nie jest dotykany.
  if (!url.includes('/api/') || url.includes('/api/ai/')) {
    return oryginalnyFetch(input as RequestInfo, init);
  }
  const trafienie = ODPOWIEDZI.find(([wzorzec]) => wzorzec.test(url.split('?')[0]));
  return new Response(JSON.stringify(trafienie ? trafienie[1] : {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof window.fetch;

export default function KartaMiernikScreen() {
  // Bez `AppProviders` — ono niesie własny `BrowserRouter`, a zagnieżdżenie
  // dwóch routerów wywraca `useParams`. Tak samo robi siostrzany harness
  // `results-vnext-okr-objectives.tsx`; i18n inicjuje `dev-render/main.tsx`.
  return (
    <MemoryRouter initialEntries={[`/results/kpi/${KPI_ID}`]}>
      <div className="h-screen bg-c-bg text-c-text">
        <Routes>
          <Route path="/results/kpi/:kpiId" element={<KpiToolPage />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
