import React from 'react';
import { CapacityAnalysisCard } from '../../src/components/Initiatives/cards/CapacityAnalysisCard';
import { AppProviders } from '../../src/providers/AppProviders';

const range = (base: number) => ({ knowledgeState: 'ESTIMATED', base });
const scenario = {
  scenarioId: 'capacity-demo',
  name: 'Obciążenie planu transformacji',
  status: 'PUBLISHED' as const,
  scenarioVersion: 2,
  planScenarioId: 'plan-demo',
  planScenarioVersion: 1,
  periods: [
    { periodId: 'Tydzień 1', demand: range(12), supply: range(8) },
    { periodId: 'Tydzień 2', demand: range(7), supply: range(9) },
  ],
  proposedAssignments: [
    {
      resourceOrRoleId: 'Controls Engineer',
      periodIds: ['Tydzień 1'],
      rationale: 'Krytyczna kompetencja',
    },
  ],
  constraints: [],
  publishedAt: '2026-09-06T10:00:00Z',
};

export default function KartaCapacityAnalysisScreen() {
  return (
    <AppProviders>
      <div className="h-screen bg-c-background text-c-text">
        <CapacityAnalysisCard
          scenario={scenario}
          onBack={() => undefined}
          onAnalyze={() => undefined}
          onPublish={() => undefined}
        />
      </div>
    </AppProviders>
  );
}
