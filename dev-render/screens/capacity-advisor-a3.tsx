import React from 'react';

import { CapacityScenarioSurface } from '../../src/components/Initiatives/CapacityScenarioSurface';
import { AppProviders } from '../../src/providers/AppProviders';

const params = new URLSearchParams(window.location.search);
const empty = params.get('state') === 'empty';
let proposed = params.get('phase') === 'after';
const originalFetch = window.fetch.bind(window);

const range = (base: number, ownerId: string) => ({
  knowledgeState: 'ESTIMATED',
  low: base - 1,
  base,
  high: base + 1,
  sourceRef: 'capacity-a3-evidence',
  sourceVersion: 1,
  asOf: '2026-08-28T08:00:00.000Z',
  confidence: 'MEDIUM',
  ownerId,
  reason: null,
});

const scenario = {
  scenarioId: 'capacity-a3',
  scenarioVersion: 3,
  status: 'PUBLISHED',
  planScenarioId: 'plan-a3',
  planScenarioVersion: 4,
  windowUnit: 'FTE-week',
  timezone: 'Europe/Warsaw',
  periods: [
    {
      periodId: '2026-W36',
      start: '2026-08-31T00:00:00.000Z',
      end: '2026-09-07T00:00:00.000Z',
      demand: range(12, 'transformation-office'),
      supply: range(8, 'resource-manager'),
    },
  ],
  constraints: [
    {
      constraintId: 'engineering-capacity',
      state: 'KNOWN',
      detail: 'Potwierdzona luka dostępności zespołu inżynierskiego.',
      ownerId: 'resource-manager',
    },
  ],
  proposedAssignments: [
    {
      assignmentId: 'assignment-a3',
      initiativeId: 'initiative-a3',
      resourceOrRoleId: 'engineering-team',
      periodIds: ['2026-W36'],
      demand: range(6, 'resource-manager'),
      rationale: 'Krytyczna zależność planu transformacji.',
    },
  ],
  createdBy: 'owner-a3',
  updatedBy: 'owner-a3',
  publishedBy: 'owner-a3',
  publishedAt: '2026-08-28T08:00:00.000Z',
};

const unknownImpact = (unit: string) => ({
  low: null,
  base: null,
  high: null,
  unit,
  knowledgeState: 'UNKNOWN',
  confidence: 'UNKNOWN',
  sourceRefs: [],
});
const estimatedImpact = (unit: string, base: number) => ({
  low: base,
  base,
  high: base,
  unit,
  knowledgeState: 'ESTIMATED',
  confidence: 'MEDIUM',
  sourceRefs: [{ ref: 'capacity:capacity-a3', version: 3 }],
});
const option = (kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY') => ({
  optionId: `a3-${kind.toLowerCase()}`,
  kind,
  assumptions: [
    {
      assumption: 'Wariant oparty na opublikowanym planie i scenariuszu mocy.',
      ownerId: 'resource-manager',
      sourceRef: { ref: 'capacity:capacity-a3', version: 3 },
      knowledgeState: 'ESTIMATED',
    },
  ],
  affectedMemberships: [{ initiativeId: 'initiative-a3', membershipVersion: 1 }],
  affectedPeriods: ['2026-W36'],
  affectedResources: [{ resourceRef: 'engineering-team', version: 1 }],
  impact: {
    date: kind === 'RESEQUENCE' ? estimatedImpact('weeks', 1) : unknownImpact('weeks'),
    scope:
      kind === 'SCOPE_SPLIT' ? estimatedImpact('assignments', 1) : unknownImpact('assignments'),
    cost: unknownImpact('PLN'),
    risk: unknownImpact('points'),
  },
  rationale:
    kind === 'RESEQUENCE'
      ? 'Przesuń pracę z przeciążonego okresu 2026-W36 dla engineering-team.'
      : kind === 'SCOPE_SPLIT'
        ? 'Podziel przydział initiative-a3 w okresie 2026-W36.'
        : 'Uzupełnij brakujące 4 FTE-week engineering-team; koszt pozostaje nieznany.',
});

const comparisons = () =>
  proposed
    ? [
        {
          version: 1,
          comparisonId: 'advisor-capacity-a3',
          planRef: { scenarioId: 'plan-a3', version: 4 },
          capacityRef: { scenarioId: 'capacity-a3', version: 3 },
          status: 'DRAFT',
          options: [option('RESEQUENCE'), option('SCOPE_SPLIT'), option('ADD_CAPACITY')],
          selectedOptionId: null,
          nextGovernedInput: null,
        },
      ]
    : [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, window.location.origin).pathname;
  if (path === '/api/initiatives/runtime-v1/capacity-scenarios') {
    return json({
      scenarios: empty
        ? []
        : [
            {
              id: 'capacity-a3',
              name: 'Obciążenie programu transformacji',
              state: 'PUBLISHED',
              planRef: { scenarioId: 'plan-a3', scenarioVersion: 4 },
              window: { start: scenario.periods[0].start, end: scenario.periods[0].end },
              knowledgeSummary: { known: 0, estimated: 2, unknown: 0, unconfirmed: 0 },
              updatedAt: scenario.publishedAt,
              version: 3,
            },
          ],
    });
  }
  if (path === '/api/initiatives/runtime-v1/capacity-scenarios/capacity-a3') {
    return json({ version: 3, scenario });
  }
  if (path === '/api/initiatives/runtime-v1/plan-scenarios') {
    return json({
      scenarios: empty
        ? []
        : [
            {
              id: 'plan-a3',
              name: 'Plan transformacji',
              state: 'PUBLISHED',
              version: 4,
              timeBasis: {
                windowUnit: 'FTE-week',
                timezone: 'Europe/Warsaw',
                knowledgeState: 'KNOWN',
                periods: scenario.periods.map(({ periodId, start, end }) => ({
                  periodId,
                  start,
                  end,
                })),
              },
            },
          ],
    });
  }
  if (
    path === '/api/initiatives/runtime-v1/capacity-options' &&
    (init?.method ?? 'GET') === 'GET'
  ) {
    return json({ items: empty ? [] : comparisons() });
  }
  if (path.startsWith('/api/initiatives/runtime-v1/capacity-options/') && init?.method === 'POST') {
    proposed = true;
    return json({ status: 'APPLIED', aggregateVersion: 1 });
  }
  return originalFetch(input, init);
};

export default function CapacityAdvisorA3Screen() {
  return (
    <AppProviders>
      {/*
       * HARNESS-ONLY FIX (2026-09-02, pomiar --wysokosc): `min-h-screen`
       * (tylko min-height) nie daje `CapacityScenarioSurface` (h-full
       * flex flex-col) definitywnej wysokosci — `h-screen` (definitywna,
       * wzorzec dev-render/screens/execution-tab.tsx) to naprawia.
       */}
      <div className="h-screen bg-c-background p-4 text-c-text">
        <CapacityScenarioSurface demoMode={false} />
      </div>
    </AppProviders>
  );
}
