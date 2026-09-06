/**
 * KARTY N — Cel OKR. Ekran harnessu wymagany przez rejestr
 * (`src/components/standard/registry.ts`, wpis `objective` → `karta-cel-okr`)
 * i bramkę `scripts/karty-n-smoke.mjs`.
 *
 * Montuje REALNY `<OkrObjectiveCardPage />` na prawdziwej trasie poziomu 3
 * (`/results/okr/:setId/objectives/:objectiveId`). Zestaw ma status `draft`,
 * bo TO jest stan, w którym `getOkrSetChildEditLock` przepuszcza edycję —
 * karta pokazuje wtedy przełącznik „Edycja | Podgląd" i pełne trzy pozycje
 * „Pracuj z AI" (Zasada 2b SSOT `STEROWANIE_KART_N_I_AI.md`).
 *
 * URL: ?screen=karta-cel-okr[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { OkrObjectiveCardPage } from '../../src/components/ResultsVNext/okr/OkrObjectiveCardPage';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

try {
  localStorage.setItem('ff.results_vnext_okr_registry', '1');
} catch {
  /* prywatne okno — harness wyrenderuje stan wygaszony */
}

const SET_ID = 'okr-set-harness';
const OBJECTIVE_ID = 'okr-obj-harness';

const OBJECTIVE = {
  objectiveId: OBJECTIVE_ID,
  setId: SET_ID,
  organizationId: 'org-harness',
  ownerUserId: 'user-piotr-demo',
  title: 'Skrócić czas realizacji zamówienia standardowego',
  description:
    'Klient dostaje zamówienie standardowe w 10 dni roboczych zamiast 18, bez wzrostu kosztu jednostkowego.',
  rationale: null,
  ambitionType: 'committed',
  status: 'draft',
  progress: '0.42',
  progressCalcPolicyVersionId: null,
  progressCalcReason: 'equal_average over 2 calculable key result(s) (of 2 total)',
  confidence: 'medium',
  confidenceCalcReason: null,
  confidenceNumericValue: null,
  rowVersion: 3,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-07-02T08:00:00.000Z',
  updatedAt: '2026-09-05T08:00:00.000Z',
  keyResults: [
    {
      keyResultId: 'kr-1',
      objectiveId: OBJECTIVE_ID,
      organizationId: 'org-harness',
      ownerUserId: 'user-piotr-demo',
      title: 'Mediana czasu realizacji ≤ 10 dni roboczych',
      measurementType: 'numeric',
      direction: 'decrease',
      unit: 'dni',
      baselineValue: '18',
      targetValue: '10',
      startValue: '18',
      currentValue: '14',
      status: 'on_track',
      progress: '0.5',
      progressCalcReason: null,
      confidence: 'medium',
      sourceType: 'manual',
      rowVersion: 2,
      createdBy: 'user-piotr-demo',
      createdAt: '2026-07-02T08:00:00.000Z',
      updatedAt: '2026-09-05T08:00:00.000Z',
    },
  ],
};

const SET = {
  setId: SET_ID,
  organizationId: 'org-harness',
  cycleId: 'cycle-h2-2026',
  title: 'Operacje H2 2026',
  status: 'draft',
  overallProgress: '0.42',
  rowVersion: 5,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-09-05T08:00:00.000Z',
};

const CYCLE = {
  cycleId: 'cycle-h2-2026',
  organizationId: 'org-harness',
  programId: 'prog-1',
  name: 'H2 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  status: 'active',
  rowVersion: 1,
};

const ODPOWIEDZI: Array<[RegExp, unknown]> = [
  [/\/okr\/objectives\/[^/]+$/, { objective: OBJECTIVE }],
  [/\/okr\/objectives\/[^/]+\/alignments/, { alignments: [] }],
  [/\/okr\/sets\/[^/]+\/reviews/, { reviews: [] }],
  [/\/okr\/sets\/[^/]+$/, { set: SET }],
  [/\/okr\/cycles\/[^/]+$/, { cycle: CYCLE }],
  [/check-ins/, { checkIns: [] }],
];

const oryginalnyFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/api/')) return oryginalnyFetch(input as RequestInfo, init);
  const trafienie = ODPOWIEDZI.find(([wzorzec]) => wzorzec.test(url.split('?')[0]));
  return new Response(JSON.stringify(trafienie ? trafienie[1] : {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof window.fetch;

export default function KartaCelOkrScreen() {
  return (
    <MemoryRouter initialEntries={[`/results/okr/${SET_ID}/objectives/${OBJECTIVE_ID}`]}>
      <div className="h-screen bg-c-bg text-c-text">
        <Routes>
          <Route
            path="/results/okr/:setId/objectives/:objectiveId"
            element={<OkrObjectiveCardPage />}
          />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
