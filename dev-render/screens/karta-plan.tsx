import React from 'react';
import { PlanCard } from '../../src/components/Initiatives/cards/PlanCard';
import { AppProviders } from '../../src/providers/AppProviders';

const initiatives = [
  { id: 'init-a', name: 'Automatyzacja kontroli jakości', lifecycle: 'EXECUTING' },
  { id: 'init-b', name: 'Cyfrowy plan produkcji', lifecycle: 'SCHEDULED' },
];
const scenario = {
  scenarioId: 'plan-demo',
  name: 'Plan transformacji operacyjnej',
  status: 'DRAFT' as const,
  scenarioVersion: 1,
  portfolioScenarioId: 'portfolio-demo',
  portfolioScenarioVersion: 3,
  windowUnit: 'TYDZIEŃ',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'Tydzień 1', start: '2026-09-07T00:00:00Z', end: '2026-09-14T00:00:00Z' },
    { periodId: 'Tydzień 2', start: '2026-09-14T00:00:00Z', end: '2026-09-21T00:00:00Z' },
  ],
  windows: [
    {
      initiativeId: 'init-a',
      target: '2026-09-08T00:00:00Z',
      rationale: 'Najpierw zamykamy zależność jakościową.',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
    {
      initiativeId: 'init-b',
      target: '2026-09-15T00:00:00Z',
      rationale: 'Start po gotowości danych jakościowych.',
      dependencySnapshot: ['init-a'],
      constraintSnapshot: [],
    },
  ],
  assumptions: ['Podaż wymaga potwierdzenia'],
  updatedBy: 'Anna Kowalska',
  publishedBy: null,
  publishedAt: null,
};

export default function KartaPlanScreen() {
  return (
    <AppProviders>
      <div className="h-screen bg-c-background text-c-text">
        <PlanCard
          scenario={scenario}
          initiatives={initiatives}
          proposal={{
            conflicts: ['Rola Controls Engineer wymaga potwierdzenia podaży.'],
            changes: [],
            status: 'PENDING_REVIEW',
          }}
          onBack={() => undefined}
          onAnalyze={() => undefined}
          onReview={() => undefined}
          onPublish={() => undefined}
        />
      </div>
    </AppProviders>
  );
}
