/** @vitest-environment jsdom */
/**
 * D-96 (Wpis 102) — szkic BEZ okien pod flagą VITE_PLAN_TIMELINE_V2 ląduje NA OSI
 * i oś ma paski z terminów inicjatyw, a nie pusty tor.
 *
 * Pomiar KROK 0 (meldunek 17.09 22:52 CDT): centrum karty planu to aktywna
 * sekcja, startowo `horizon` dla szkicu i opublikowanego jednakowo
 * (`PlanCard.tsx`), a paski osi brały się WYŁĄCZNIE z `scenario.windows` — więc
 * szkic utworzony przez „New plan" (`windows: []`) otwierał się na liście
 * okresów, a po przejściu na oś pokazywał pusty tor. Właściciel czytał to jako
 * „oś się nie renderuje".
 *
 * MUTACJE (dowód RED, obie cofnięte):
 *  M1 — `ganttItems` z powrotem tylko z `scenario.windows` (bez `fallbackItems`)
 *       → test 1 nie znajduje żadnych pasków;
 *  M2 — startowa sekcja z powrotem `'horizon'` bez względu na flagę
 *       → test 1 i 2 widzą centrum na `horizon` (brak osi).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/utils/planTimelineV2Flag', () => ({
  isPlanTimelineV2Enabled: () => flagState.on,
}));

const DICT: Record<string, string> = {
  'initiatives.status.IN_EXECUTION': 'In execution',
  'initiatives.timelineSection.planned': 'Planned',
  'initiatives.planCard.noDependencies': 'no dependencies',
  'initiatives.planAnalysis.timelineTitle': 'Plan timeline',
  'initiatives.planAnalysis.horizonMonths': '{{count}} months',
  'initiatives.planCard.emptyWindows': 'The plan has no windows yet.',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, arg?: unknown) => {
      let template = DICT[key] ?? String(key);
      const vars: Record<string, unknown> = {};
      if (typeof arg === 'string') {
        if (!(key in DICT)) template = arg;
      } else if (arg && typeof arg === 'object') {
        const opts = arg as Record<string, unknown>;
        Object.assign(vars, opts);
        if (!(key in DICT) && typeof opts.defaultValue === 'string') template = opts.defaultValue;
      }
      return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars[name] ?? ''));
    },
  }),
}));

/**
 * Powłoka jako PRZEŁĄCZNIK sekcji: renderuje WYŁĄCZNIE aktywną sekcję (jak
 * prawdziwe centrum karty) plus przyciski nawigacji, żeby test mógł sprawdzić
 * dostępność formularza dat po naprawie.
 */
vi.mock('@/components/standard/StandardArtifactShell', async () => {
  const ReactLocal = await import('react');
  return {
    StandardArtifactShell: (props: {
      sections?: Array<{ id: string; component: unknown }>;
      activeSection?: string;
      onSectionChange?: (id: string) => void;
    }) =>
      ReactLocal.createElement(
        'div',
        null,
        ReactLocal.createElement(
          'nav',
          null,
          (props.sections ?? []).map((section) =>
            ReactLocal.createElement(
              'button',
              {
                key: section.id,
                type: 'button',
                'data-section-nav': section.id,
                onClick: () => props.onSectionChange?.(section.id),
              },
              section.id
            )
          )
        ),
        ReactLocal.createElement(
          'div',
          { 'data-active-section': props.activeSection },
          (props.sections ?? [])
            .filter((section) => section.id === props.activeSection)
            .map((section) =>
              ReactLocal.createElement('div', { key: section.id }, section.component as React.ReactNode)
            )
        )
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

import { PlanCard } from '../cards/PlanCard';
import type { PlanCardScenario } from '../cards/PlanCard';
import type { GeneratorInitiative } from '../Generator/GeneratorPlanuModal';

const DATED: Array<{ id: string; name: string; start: string; end: string }> = [
  { id: 'energy', name: 'Energy Monitoring and ISO 50001', start: '2026-09-28', end: '2026-10-26' },
  { id: 'supplier', name: 'Supplier Quality Gate', start: '2026-11-02', end: '2026-11-30' },
  { id: 'shift', name: 'Shift Handover Digitisation', start: '2026-11-09', end: '2026-12-07' },
];
const UNDATED: Array<{ id: string; name: string }> = [
  { id: 'scrap', name: 'Scrap Reduction Programme' },
];

const initiatives = [...DATED, ...UNDATED].map((row) => ({
  id: row.id,
  name: row.name,
  lifecycle: 'APPROVED',
}));

const plannable: GeneratorInitiative[] = [
  ...DATED.map((row) => ({
    id: row.id,
    name: row.name,
    status: 'APPROVED' as const,
    conditional: false,
    plannedStartDate: row.start,
    plannedEndDate: row.end,
  })),
  ...UNDATED.map((row) => ({
    id: row.id,
    name: row.name,
    status: 'APPROVED' as const,
    conditional: false,
    plannedStartDate: null,
    plannedEndDate: null,
  })),
];

const windowlessDraft: PlanCardScenario = {
  scenarioId: 'sc-d96',
  name: 'Northwind 2027 portfolio plan (draft)',
  status: 'DRAFT',
  scenarioVersion: 5,
  portfolioScenarioId: 'p-1',
  portfolioScenarioVersion: 14,
  windowUnit: 'MONTH',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'P1', start: '2026-09-30T00:00:00.000Z', end: '2026-10-31T00:00:00.000Z' },
    { periodId: 'P2', start: '2026-11-01T00:00:00.000Z', end: '2026-12-31T00:00:00.000Z' },
  ],
  windows: [],
  assumptions: [],
  updatedBy: 'cto',
  publishedBy: null,
  publishedAt: null,
};

const withWindows: PlanCardScenario = {
  ...windowlessDraft,
  windows: DATED.map((row) => ({
    initiativeId: row.id,
    earliest: `${row.start}T00:00:00`,
    target: `${row.start}T00:00:00`,
    latest: `${row.end}T00:00:00`,
    rationale: '',
    dependencySnapshot: [],
    constraintSnapshot: [],
  })),
};

const NAME_COLUMN = '.w-\\[208px\\]';
function barsOf(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('[data-gantt-bar-kind]'));
}

function classOf(el: Element): string {
  return typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '';
}

function renderCard(scenario: PlanCardScenario) {
  return render(
    <PlanCard
      scenario={scenario}
      initiatives={initiatives}
      plannable={plannable}
      onBack={() => {}}
      onAnalyze={() => {}}
      onReview={() => {}}
      onPublish={() => {}}
      onWindowChange={() => undefined}
    />
  );
}

describe('D-96 (Wpis 102): szkic bez okien pod flagą ON ląduje na osi z paskami', () => {
  it('ON + szkic BEZ okien: centrum = oś z N paskami = liczba inicjatyw z terminami', () => {
    flagState.on = true;
    const { container } = renderCard(windowlessDraft);

    const active = container.querySelector('[data-active-section]') as HTMLElement;
    expect(active.getAttribute('data-active-section')).toBe('dependencies');
    expect(screen.getByText('Plan timeline')).toBeTruthy();

    // 3 paski = 3 inicjatywy z terminami; czwarta (bez terminu) nie dostaje paska.
    const bars = barsOf(container);
    expect(bars).toHaveLength(DATED.length);
    expect(bars.every((bar) => bar.getAttribute('data-gantt-bar-kind') === 'planned-hint')).toBe(true);
    expect(bars.every((bar) => classOf(bar).includes('border-dashed'))).toBe(true);
    expect(bars.every((bar) => classOf(bar).includes('opacity-70'))).toBe(true);
    expect(screen.getByText('From initiative dates — no plan window yet')).toBeTruthy();
    expect(
      screen.getByText(
        'Dashed bars come from initiative dates because this draft has no plan windows yet.'
      )
    ).toBeTruthy();
    const nameColumn = container.querySelector(NAME_COLUMN) as HTMLElement;
    expect(nameColumn).not.toBeNull();
    DATED.forEach((row) => {
      expect(nameColumn.textContent).toContain(row.name);
    });
    expect(nameColumn.textContent).not.toContain(UNDATED[0].name);

    // Centrum osi nie niesie formularza dat — ten zostaje w swojej sekcji.
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0);
  });

  it('ON + szkic bez okien: formularz dat zostaje dostępny w swojej sekcji', () => {
    flagState.on = true;
    const { container } = renderCard(withWindows);
    const nav = container.querySelector('[data-section-nav="windows"]') as HTMLElement;
    expect(nav).not.toBeNull();
    fireEvent.click(nav);
    expect(container.querySelectorAll('input[type="date"]').length).toBeGreaterThan(0);
  });

  it('ON + szkic Z oknami: paski nadal z okien (fallback nie przejmuje)', () => {
    flagState.on = true;
    const { container } = renderCard(withWindows);
    const bars = barsOf(container);
    expect(bars).toHaveLength(withWindows.windows.length);
    expect(bars.every((bar) => bar.getAttribute('data-gantt-bar-kind') === 'phase')).toBe(true);
    expect(bars.every((bar) => !classOf(bar).includes('border-dashed'))).toBe(true);
  });

  it('OFF + szkic bez okien: centrum = horizon, osi i pasków zastępczych nie ma', () => {
    flagState.on = false;
    const { container } = renderCard(windowlessDraft);

    const active = container.querySelector('[data-active-section]') as HTMLElement;
    expect(active.getAttribute('data-active-section')).toBe('horizon');
    expect(screen.queryByText('Plan timeline')).toBeNull();
    expect(container.querySelector(NAME_COLUMN)).toBeNull();
    expect(barsOf(container)).toHaveLength(0);
    flagState.on = true;
  });
});
