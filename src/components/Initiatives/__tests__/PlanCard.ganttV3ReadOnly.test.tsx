/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const flagState = vi.hoisted(() => ({ on: true }));
const ganttProps = vi.hoisted(() => ({ last: null as null | { onReschedule?: unknown; items?: unknown[] } }));

vi.mock('@/utils/planTimelineV2Flag', () => ({
  isPlanTimelineV2Enabled: () => flagState.on,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, arg?: unknown) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object' && typeof (arg as Record<string, unknown>).defaultValue === 'string') {
        return String((arg as Record<string, unknown>).defaultValue);
      }
      if (key === 'initiatives.planAnalysis.timelineTitle') return 'Plan timeline';
      if (key === 'initiatives.planAnalysis.horizonMonths') return '3 months';
      return key;
    },
  }),
}));

vi.mock('@/components/standard/StandardArtifactShell', async () => {
  const ReactLocal = await import('react');
  return {
    StandardArtifactShell: (props: {
      sections?: Array<{ id: string; component: unknown }>;
      activeSection?: string;
    }) =>
      ReactLocal.createElement(
        'div',
        { 'data-active-section': props.activeSection },
        (props.sections ?? [])
          .filter((section) => section.id === props.activeSection)
          .map((section) => ReactLocal.createElement('div', { key: section.id }, section.component as React.ReactNode))
      ),
  };
});
vi.mock('@/components/standard/DocumentCardMenu5', async () => {
  const ReactLocal = await import('react');
  return { DocumentCardMenu5: () => ReactLocal.createElement('div', null) };
});
vi.mock('../PlanDependencyAnalysisPanel', async () => {
  const ReactLocal = await import('react');
  return { PlanDependencyAnalysisPanel: () => ReactLocal.createElement('div', null) };
});
vi.mock('../Generator/GeneratorPlanuModal', async () => {
  const ReactLocal = await import('react');
  return { GeneratorPlanuModal: () => ReactLocal.createElement('div', null) };
});
vi.mock('../cards/PlanRoleDemandEditor', async () => {
  const ReactLocal = await import('react');
  return { PlanRoleDemandEditor: () => ReactLocal.createElement('div', null) };
});
vi.mock('../gantt', async () => {
  const ReactLocal = await import('react');
  return {
    InitiativeGantt: (props: { onReschedule?: unknown; items?: unknown[] }) => {
      ganttProps.last = props;
      return ReactLocal.createElement('div', { 'data-testid': 'mock-gantt' }, 'mock gantt');
    },
  };
});

import { PlanCard } from '../cards/PlanCard';
import type { PlanCardScenario } from '../cards/PlanCard';
import type { GeneratorInitiative } from '../Generator/GeneratorPlanuModal';

const initiatives = [{ id: 'energy', name: 'Energy Monitoring', lifecycle: 'APPROVED' }];
const plannable: GeneratorInitiative[] = [
  {
    id: 'energy',
    name: 'Energy Monitoring',
    status: 'APPROVED',
    conditional: false,
    plannedStartDate: '2026-09-28',
    plannedEndDate: '2026-10-26',
  },
];

const baseScenario: PlanCardScenario = {
  scenarioId: 'sc-readonly',
  name: 'Read-only fallback proof',
  status: 'DRAFT',
  scenarioVersion: 1,
  portfolioScenarioId: 'p-1',
  portfolioScenarioVersion: 1,
  windowUnit: 'MONTH',
  timezone: 'Europe/Warsaw',
  periods: [{ periodId: 'P1', start: '2026-09-01T00:00:00.000Z', end: '2026-10-31T00:00:00.000Z' }],
  windows: [],
  assumptions: [],
  updatedBy: 'cto',
  publishedBy: null,
  publishedAt: null,
};

function renderCard(scenario: PlanCardScenario, onWindowChange = vi.fn()) {
  ganttProps.last = null;
  return render(
    <PlanCard
      scenario={scenario}
      initiatives={initiatives}
      plannable={plannable}
      onBack={() => {}}
      onAnalyze={() => {}}
      onReview={() => {}}
      onPublish={() => {}}
      onWindowChange={onWindowChange}
    />
  );
}

describe('GANTT v3: fallback initiative bars remain read-only', () => {
  it('does not pass onReschedule when the draft has no plan windows', () => {
    flagState.on = true;
    renderCard(baseScenario);

    expect(screen.getByTestId('mock-gantt')).toBeTruthy();
    expect(ganttProps.last?.items).toHaveLength(1);
    expect(ganttProps.last?.onReschedule).toBeUndefined();
  });

  it('passes onReschedule only when real plan windows exist', () => {
    flagState.on = true;
    renderCard({
      ...baseScenario,
      windows: [
        {
          initiativeId: 'energy',
          earliest: '2026-09-28T00:00:00.000Z',
          target: '2026-09-28T00:00:00.000Z',
          latest: '2026-10-26T00:00:00.000Z',
          rationale: '',
          dependencySnapshot: [],
          constraintSnapshot: [],
        },
      ],
    });

    expect(typeof ganttProps.last?.onReschedule).toBe('function');
  });
});
