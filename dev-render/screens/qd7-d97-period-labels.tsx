/**
 * QD7 / D-97 — etykieta okresu planu z klucza i18n, widoczna okiem.
 *
 * `createPeriods` (REALNY generator z `PlanScenarioSurface.tsx`, przed paczką
 * zaszyty polski literał `Tydzień N`/`Miesiąc N`) produkuje `periodId`, który
 * jest DANĄ zapisywaną w planie; na ekranie pokazuje go arkusz scenariusza
 * mocy (`CapacityScenarioSurface.tsx:334` — `title: period.periodId`).
 * Ten harness spina oba REALNE końce ogniwa: generator → arkusz.
 *
 * Query: `?lang=en|pl&theme=light|dark` (jak wszędzie w dev-render).
 * Oczekiwanie dowodowe: lang=en → wiersze „Week 1..4", zero słowa „Tydzień";
 * lang=pl → „Tydzień 1..4" (słowo z zasobu `initiatives.plan.period.week`).
 */
import React from 'react';

import { CapacityScenarioSurface } from '../../src/components/Initiatives/CapacityScenarioSurface';
import { createPeriods } from '../../src/components/Initiatives/PlanScenarioSurface';
import { AppProviders } from '../../src/providers/AppProviders';

const originalFetch = window.fetch.bind(window);

const range = (base: number, ownerId: string) => ({
  knowledgeState: 'ESTIMATED',
  low: base - 1,
  base,
  high: base + 1,
  sourceRef: 'qd7-d97-evidence',
  sourceVersion: 1,
  asOf: '2026-09-18T08:00:00.000Z',
  confidence: 'MEDIUM',
  ownerId,
  reason: null,
});

// REALNY generator okresów z karty planu (ten sam, który zapisuje
// `writePlanScenario` przy „Create plan") — 4 tygodnie od 2026-09-28.
const generated = createPeriods('2026-09-28', 4);

const scenario = {
  scenarioId: 'capacity-qd7',
  scenarioVersion: 1,
  status: 'PUBLISHED',
  planScenarioId: 'plan-qd7',
  planScenarioVersion: 1,
  windowUnit: 'FTE-week',
  timezone: 'Europe/Warsaw',
  periods: generated.map((period) => ({
    ...period,
    demand: range(12, 'transformation-office'),
    supply: range(8, 'resource-manager'),
  })),
  constraints: [
    {
      constraintId: 'engineering-capacity',
      state: 'KNOWN',
      detail: 'Confirmed availability gap for the engineering team.',
      ownerId: 'resource-manager',
    },
  ],
  proposedAssignments: [
    {
      assignmentId: 'assignment-qd7',
      initiativeId: 'initiative-qd7',
      resourceOrRoleId: 'engineering-team',
      periodIds: generated.map((period) => period.periodId),
      demand: range(6, 'resource-manager'),
      rationale: 'Critical dependency of the transformation plan.',
    },
  ],
  createdBy: 'owner-qd7',
  updatedBy: 'owner-qd7',
  publishedBy: 'owner-qd7',
  publishedAt: '2026-09-18T08:00:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, window.location.origin).pathname;
  if (path === '/api/organizations/current') {
    return json({
      organizations: [
        {
          id: 'org-demo',
          name: 'Northwind',
          role: 'OWNER',
          access_type: 'OWNER',
          is_current: true,
        },
      ],
    });
  }
  if (path === '/api/v8/admin/flags') return json({ flags: [] });
  if (/^\/api\/organizations\/[^/]+\/members$/.test(path)) {
    return json([
      {
        userId: 'resource-manager',
        name: 'Anna Kowalska',
        email: 'anna@example.test',
        role: 'OWNER',
        status: 'active',
        joinedAt: '2026-08-01T08:00:00.000Z',
      },
    ]);
  }
  if (path === '/api/initiatives/runtime-v1/capacity-scenarios') {
    return json({
      scenarios: [
        {
          id: 'capacity-qd7',
          name: 'Transformation programme load',
          state: 'PUBLISHED',
          planRef: { scenarioId: 'plan-qd7', scenarioVersion: 1 },
          window: { start: generated[0].start, end: generated[generated.length - 1].end },
          knowledgeSummary: { known: 0, estimated: 2, unknown: 0, unconfirmed: 0 },
          updatedAt: scenario.publishedAt,
          version: 1,
        },
      ],
    });
  }
  if (path === '/api/initiatives/runtime-v1/capacity-scenarios/capacity-qd7') {
    return json({ version: 1, scenario });
  }
  if (path === '/api/initiatives/runtime-v1/plan-scenarios') {
    return json({
      scenarios: [
        {
          id: 'plan-qd7',
          name: 'Transformation plan',
          state: 'PUBLISHED',
          version: 1,
          timeBasis: {
            windowUnit: 'FTE-week',
            timezone: 'Europe/Warsaw',
            knowledgeState: 'KNOWN',
            periods: generated,
          },
        },
      ],
    });
  }
  if (
    path === '/api/initiatives/runtime-v1/capacity-options' &&
    (init?.method ?? 'GET') === 'GET'
  ) {
    return json({ items: [] });
  }
  return originalFetch(input, init);
};

export default function Qd7D97PeriodLabelsScreen() {
  return (
    <AppProviders>
      <div className="h-screen bg-c-background p-4 text-c-text">
        <CapacityScenarioSurface demoMode={false} />
      </div>
    </AppProviders>
  );
}
