import React from 'react';

import { PlanScenarioSurface } from '../../src/components/Initiatives/PlanScenarioSurface';
import { AppProviders } from '../../src/providers/AppProviders';

const params = new URLSearchParams(window.location.search);
const empty = params.get('state') === 'empty';
const originalFetch = window.fetch.bind(window);

const initiatives = [
  { id: 'init-onboarding', name: 'Cyfrowe wdrożenie klienta', lifecycle: 'EXECUTION' },
  { id: 'init-pricing', name: 'Rewizja cennika usług doradczych', lifecycle: 'EXECUTION' },
  { id: 'init-data-platform', name: 'Platforma danych dla zespołu analiz', lifecycle: 'PLANNING' },
  { id: 'init-partner-portal', name: 'Portal partnerski dla podwykonawców', lifecycle: 'PLANNING' },
  { id: 'init-risk-register', name: 'Rejestr ryzyk programowych', lifecycle: 'EXECUTION' },
];

const periods = [
  { periodId: 'NOW · Wrz–Paź', start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
  { periodId: 'NEXT · Lis–Gru', start: '2026-10-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' },
  { periodId: 'LATER · Q1', start: '2026-12-01T00:00:00.000Z', end: '2027-03-01T00:00:00.000Z' },
];

const scenario = {
  scenarioId: 'plan-d1',
  scenarioVersion: 2,
  status: 'PUBLISHED',
  portfolioScenarioId: 'portfolio-d1',
  portfolioScenarioVersion: 3,
  windowUnit: 'MONTH',
  timezone: 'Europe/Warsaw',
  periods,
  windows: [
    {
      initiativeId: 'init-onboarding',
      initiativeVersion: 2,
      earliest: '2026-09-01T00:00:00.000Z',
      target: '2026-09-15T00:00:00.000Z',
      latest: '2026-09-30T00:00:00.000Z',
      confidence: 'HIGH',
      rationale: 'Zatwierdzony zakres, zespół dostępny od września.',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
    {
      initiativeId: 'init-pricing',
      initiativeVersion: 1,
      earliest: '2026-10-05T00:00:00.000Z',
      target: '2026-10-20T00:00:00.000Z',
      latest: '2026-11-10T00:00:00.000Z',
      confidence: 'MEDIUM',
      rationale: 'Czeka na wynik analizy konkurencji.',
      dependencySnapshot: ['init-onboarding'],
      constraintSnapshot: [],
    },
    {
      initiativeId: 'init-data-platform',
      initiativeVersion: 1,
      earliest: '2026-12-01T00:00:00.000Z',
      target: '2027-01-15T00:00:00.000Z',
      latest: '2027-02-28T00:00:00.000Z',
      confidence: 'LOW',
      rationale: 'Wymaga potwierdzenia budżetu na Q1.',
      dependencySnapshot: [],
      constraintSnapshot: [
        {
          constraintId: 'data-eng-capacity',
          state: 'UNKNOWN',
          detail: 'Potwierdź dostępność specjalisty danych.',
        },
      ],
    },
  ],
  assumptions: ['Budżet programu pozostaje w mocy', 'Wyznaczeni właściciele są dostępni'],
  createdBy: 'owner-piotr',
  updatedBy: 'owner-piotr',
  publishedBy: 'owner-piotr',
  publishedAt: '2026-08-25T09:00:00.000Z',
};

const history = [
  { ...scenario, scenarioVersion: 1, status: 'SUPERSEDED' as const },
  scenario,
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, window.location.origin).pathname;

  if (path === '/api/initiatives/runtime-v1/plan-scenarios' && (init?.method ?? 'GET') === 'GET') {
    return json({
      scenarios: empty
        ? []
        : [
            {
              id: scenario.scenarioId,
              name: 'Plan transformacji operacyjnej',
              state: scenario.status,
              version: scenario.scenarioVersion,
              portfolioRef: {
                scenarioId: scenario.portfolioScenarioId,
                scenarioVersion: scenario.portfolioScenarioVersion,
              },
              window: { earliest: periods[0].start, latest: periods[2].end },
              updatedAt: scenario.publishedAt,
              timeBasis: {
                windowUnit: scenario.windowUnit,
                timezone: scenario.timezone,
                periods,
                knowledgeState: 'KNOWN',
              },
            },
          ],
    });
  }
  if (path === `/api/initiatives/runtime-v1/plan-scenarios/${scenario.scenarioId}/history`) {
    return json({ versions: empty ? [] : history });
  }
  if (path === `/api/initiatives/runtime-v1/plan-scenarios/${scenario.scenarioId}/diff`) {
    return json({ changes: [] });
  }
  if (path === `/api/initiatives/runtime-v1/plan-scenarios/${scenario.scenarioId}`) {
    return json({ version: scenario.scenarioVersion, scenario });
  }
  return originalFetch(input, init);
};

export default function PlanScenarioD1Screen() {
  /*
   * ★ `onOpenInitiative` JEST WYMAGANY, ŻEBY TEN ZRZUT POKAZYWAŁ PRODUKT
   *   (odbiór grafiki 2026-09-01, uwaga `plan-scenario-d1`).
   *
   * Uwaga właściciela z 30.08 brzmiała: „narzędzie otwiera tę wybraną linię
   * jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę." — czyli
   * NIE była o szerokości tabeli (pomiar 01.09: tabela 1366 z 1440 px = 94,9%
   * okna, jedyne ubytki to `p-4` powłoki i ramka karty).
   *
   * W PRODUKCIE zgłoszenie jest już naprawione: `InitiativesHub.tsx:1636`
   * podaje `onOpenInitiative`, które prowadzi do KARTY INICJATYWY (komentarz
   * przy tym propie mówi wprost: „Wcześniej otwierał warsztat planu pod
   * tabelą"). Ale TEN host propa nie podawał, a `PlanScenarioSurface`
   * świadomie degraduje bez niego: `openCardDisabledReason`
   * (`PlanScenarioSurface.tsx:588`) wyszarza „Otwórz" w podglądzie i wyłącza
   * dwuklik. Zrzut odbiorowy pokazywał więc DEFEKT, KTÓREGO W PRODUKCIE JUŻ
   * NIE MA — dokładnie kształt „harness kłamie".
   *
   * Handler jest zaślepką (harness nie ma routera modułu Inicjatywy), ale
   * SAMA JEGO OBECNOŚĆ odblokowuje ścieżkę do karty tak jak w produkcji.
   */
  const [otwartaKarta, setOtwartaKarta] = React.useState<string | null>(null);
  return (
    <AppProviders>
      {/*
       * HARNESS-ONLY FIX (2026-09-02, pomiar --wysokosc): `min-h-screen`
       * (tylko min-height) nie daje `PlanScenarioSurface` (h-full flex
       * flex-col) definitywnej wysokosci — `h-screen` (definitywna,
       * wzorzec dev-render/screens/execution-tab.tsx) to naprawia.
       */}
      <div className="h-screen bg-c-background p-4 text-c-text">
        <PlanScenarioSurface
          demoMode={false}
          initiatives={empty ? [] : initiatives}
          onOpenInitiative={(id, title) => setOtwartaKarta(`${title} (${id})`)}
        />
        {otwartaKarta ? (
          <p className="mt-3 text-xs text-c-text-muted" data-testid="plan-scenario-otwarta-karta">
            Harness: żądanie otwarcia karty inicjatywy — {otwartaKarta}
          </p>
        ) : null}
      </div>
    </AppProviders>
  );
}
