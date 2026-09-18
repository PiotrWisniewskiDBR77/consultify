/** @vitest-environment jsdom */
/**
 * Wpis 102 P1 (akceptacja etapu 2, `371481fae5`) — CAS zapisu planu.
 *
 * Pomiar akceptacji: zamiana `expectedVersion: aggregateVersion` na stałą `1`
 * w `PlanScenarioSurface.tsx` zostawiała 16/16 testów zielonych, czyli żaden test
 * nie trzymał wersji wysyłanej do serwera. Ten test trzyma: po DRAGU paska na osi
 * `writePlanScenario` dostaje wersję agregatu z OSTATNIEGO udanego odczytu/zapisu,
 * a drugi drag niesie wersję NOWĄ (zwróconą przez pierwszy zapis) — bez tego
 * każdy kolejny zapis w tej samej sesji karty kończyłby się 409 albo, gorzej,
 * nadpisywał cudzą zmianę.
 *
 * MUTACJA (dowód RED, cofnięta): `PlanScenarioSurface.tsx` →
 * `expectedVersion: 1` — oba wywołania wysyłają 1 zamiast 7 i 9.
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listPlanScenarioRegister, readPlanScenario, writePlanScenario, translate } = vi.hoisted(
  () => {
    const en = require('../../../../public/locales/en/translation.json') as unknown;
    return {
      listPlanScenarioRegister: vi.fn(),
      readPlanScenario: vi.fn(),
      writePlanScenario: vi.fn(),
      translate: (key: string, options?: unknown) => {
        const resolved = key
          .split('.')
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
            en
          );
        if (typeof resolved === 'string') return resolved;
        if (typeof options === 'string') return options;
        const fallback = (options as { defaultValue?: unknown } | undefined)?.defaultValue;
        return typeof fallback === 'string' ? fallback : key;
      },
    };
  }
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'en' } }),
}));
vi.mock('@/i18n', () => ({ default: { language: 'en', t: translate } }));
vi.mock('@/utils/planTimelineV2Flag', () => ({ isPlanTimelineV2Enabled: () => true }));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff: vi.fn(async () => ({ changes: [] })),
  readPlanScenarioHistory: vi.fn(async () => ({ versions: [] })),
  createPlanAnalysisProposal: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  listPlannableInitiatives: vi.fn(async () => ({ initiatives: [] })),
  listCapacityScenarioRegister: vi.fn(async () => ({ scenarios: [] })),
  readCapacityScenario: vi.fn(),
  listPlanAnalysisProposals: vi.fn(async () => ({ items: [] })),
  registerInitiativeForPlanning: vi.fn(),
  writeInitiativeDependencies: vi.fn(),
  writePlanScenario,
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly rule?: string
    ) {
      super(code);
    }
  },
}));

// Powłoka karty: stub renderuje wszystkie sekcje (jak w `planDrag.test.tsx`).
vi.mock('@/components/standard/StandardArtifactShell', async () => {
  const React = await import('react');
  return {
    StandardArtifactShell: (props: { sections?: Array<{ id: string; component: unknown }> }) =>
      React.createElement(
        'div',
        null,
        (props.sections ?? []).map((section) =>
          React.createElement(
            'div',
            { key: section.id, 'data-section': section.id },
            section.component as React.ReactNode
          )
        )
      ),
  };
});
vi.mock('@/components/standard/DocumentCardMenu5', async () => {
  const React = await import('react');
  return { DocumentCardMenu5: () => React.createElement('div', null) };
});
vi.mock('../PlanDependencyAnalysisPanel', async () => {
  const React = await import('react');
  return { PlanDependencyAnalysisPanel: () => React.createElement('div', null) };
});
vi.mock('../Generator/GeneratorPlanuModal', async () => {
  const React = await import('react');
  return { GeneratorPlanuModal: () => React.createElement('div', null) };
});
vi.mock('../cards/PlanRoleDemandEditor', async () => {
  const React = await import('react');
  return { PlanRoleDemandEditor: () => React.createElement('div', null) };
});

import { PlanScenarioSurface } from '../PlanScenarioSurface';

const PLAN_ID = 'plan-cas-1';
const FIRST_VERSION = 7;

/** Północ CZASU LOKALNEGO (bez `Z`) — patrz komentarz w `planTimeline.test.tsx`. */
const local = (iso: string) => `${iso}T00:00:00`;

const scenario = (version: number, energyStart: string, energyEnd: string) => ({
  scenarioId: PLAN_ID,
  name: 'Northwind 2027 portfolio plan',
  scenarioVersion: version,
  status: 'DRAFT' as const,
  portfolioScenarioId: 'portfolio-1',
  portfolioScenarioVersion: 3,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'P1', start: '2026-09-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' },
    { periodId: 'P2', start: '2026-11-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' },
  ],
  windows: [
    {
      initiativeId: 'energy',
      earliest: local(energyStart),
      target: local(energyStart),
      latest: local(energyEnd),
      rationale: '',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
    {
      initiativeId: 'supplier',
      earliest: local('2026-11-02'),
      target: local('2026-11-02'),
      latest: local('2026-11-30'),
      rationale: '',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
  ],
  assumptions: [],
  createdBy: 'cto',
  updatedBy: 'cto',
  publishedBy: null,
  publishedAt: null,
});

// ── jsdom: brak PointerEvent + setPointerCapture; siatka ma szerokość 0 ──
class FakePointerEvent extends Event {
  clientX: number;
  pointerId: number;
  constructor(type: string, init: { clientX?: number; pointerId?: number } = {}) {
    super(type, { bubbles: true, cancelable: true });
    this.clientX = init.clientX ?? 0;
    this.pointerId = init.pointerId ?? 1;
  }
}
const GRID_W = 1000;
/** Zakres karty z zegarem przypiętym na 2026-09-14 = 14 tygodni = 98 dni osi. */
const pxForCardDays = (days: number) => Math.round((days * GRID_W) / 98);

const isBar = (el: Element) => {
  const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '';
  return cls.includes('bg-c-') && !cls.includes('border-dashed');
};
const barOf = (container: HTMLElement): HTMLElement | null =>
  (Array.from(container.querySelectorAll('[title^="Energy Monitoring"]')).find(isBar) as
    | HTMLElement
    | undefined) ?? null;

async function dragBy(el: HTMLElement, dx: number) {
  await act(async () => {
    el.dispatchEvent(new FakePointerEvent('pointerdown', { clientX: 0, pointerId: 1 }));
    el.dispatchEvent(new FakePointerEvent('pointermove', { clientX: dx, pointerId: 1 }));
    el.dispatchEvent(new FakePointerEvent('pointerup', { clientX: dx, pointerId: 1 }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
  // @ts-expect-error — minimalny polyfill pointerów dla komponentu.
  global.PointerEvent = FakePointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: GRID_W,
    height: 32,
    top: 0,
    left: 0,
    right: GRID_W,
    bottom: 32,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  listPlanScenarioRegister.mockResolvedValue({
    scenarios: [
      {
        id: PLAN_ID,
        name: 'Northwind 2027 portfolio plan',
        state: 'DRAFT',
        version: FIRST_VERSION,
        portfolioRef: { scenarioId: 'portfolio-1', scenarioVersion: 3 },
        window: { earliest: '2026-09-28T00:00:00.000Z', latest: '2026-11-30T00:00:00.000Z' },
        updatedAt: '2026-09-14T10:00:00.000Z',
        initiativeCount: 2,
        conflicts: 0,
        author: 'CTO',
        timeBasis: {
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [
            { periodId: 'P1', start: '2026-09-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' },
          ],
          knowledgeState: 'KNOWN',
        },
      },
    ],
  });
  readPlanScenario.mockResolvedValue({
    version: FIRST_VERSION,
    scenario: scenario(FIRST_VERSION, '2026-09-28', '2026-10-26'),
  });
  // Serwer podbija wersję agregatu o 2 przy każdym zapisie — dokładnie ten
  // mechanizm musi przenieść się do `expectedVersion` następnego zapisu.
  writePlanScenario.mockImplementation(async (_id: string, payload: { expectedVersion: number; scenario: unknown }) => ({
    aggregateVersion: payload.expectedVersion + 2,
    response: { ...(payload.scenario as object), scenarioVersion: payload.expectedVersion + 2 },
  }));
});

/** Otwarcie warsztatu karty planu: dwuklik wiersza rejestru (`onRowDoubleClick` → `open`). */
async function openPlanWorkspace() {
  const view = render(
    <MemoryRouter>
      <PlanScenarioSurface
        activePreset="all"
        initiatives={[
          { id: 'energy', name: 'Energy Monitoring and ISO 50001', lifecycle: 'APPROVED' },
          { id: 'supplier', name: 'Supplier Quality Gate', lifecycle: 'APPROVED' },
        ]}
      />
    </MemoryRouter>
  );
  const cells = await screen.findAllByText('Northwind 2027 portfolio plan');
  const row = cells.map((cell) => cell.closest('tr')).find(Boolean) as HTMLElement;
  fireEvent.doubleClick(row);
  await waitFor(() => expect(barOf(view.container as HTMLElement)).not.toBeNull());
  return view;
}

describe('Wpis 102 P1 — CAS: `expectedVersion` niesie wersję ostatniego udanego zapisu', () => {
  it('drag → zapis z wersją odczytaną (7), drugi drag → wersja zwrócona przez pierwszy zapis (9)', async () => {
    const { container } = await openPlanWorkspace();

    await dragBy(barOf(container)!, pxForCardDays(14));

    expect(writePlanScenario).toHaveBeenCalledTimes(1);
    expect(writePlanScenario.mock.calls[0][0]).toBe(PLAN_ID);
    expect(writePlanScenario.mock.calls[0][1].expectedVersion).toBe(FIRST_VERSION);

    await dragBy(barOf(container)!, pxForCardDays(14));

    expect(writePlanScenario).toHaveBeenCalledTimes(2);
    expect(writePlanScenario.mock.calls[1][1].expectedVersion).toBe(FIRST_VERSION + 2);
    // Drugi zapis przesuwa okno o kolejne 14 dni — dowód, że karta pracuje na
    // odpowiedzi serwera, a nie na stanie sprzed pierwszego zapisu. Adapter
    // przeciągania zapisuje granice jako północ UTC (`…T00:00:00.000Z`).
    const secondWindow = writePlanScenario.mock.calls[1][1].scenario.windows.find(
      (window: { initiativeId: string }) => window.initiativeId === 'energy'
    );
    expect(secondWindow.earliest).toBe('2026-10-26T00:00:00.000Z');
    vi.useRealTimers();
  });
});
