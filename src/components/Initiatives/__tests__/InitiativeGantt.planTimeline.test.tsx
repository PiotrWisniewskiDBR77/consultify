/** @vitest-environment jsdom */
/**
 * DEC-608 / DEC-615 — oś czasu planu (etap 1, SPEC §7.1 pkt 1, 4, 5, 6, 7).
 *
 * Fikstura = 8 inicjatyw Northwind z zaakceptowanej makiety PL3
 * (`~/Developer/cto-codex/makieta-pl3-20260917/makieta.html`) na horyzoncie
 * 12 tygodni (2026-09-14 → 2026-12-07). Geometria pasków jest tu liczona tak
 * samo jak w makiecie (left 16.667% / width 33.333% dla „Energy Monitoring"),
 * więc test trzyma nie tylko obecność elementów, ale i samą siatkę.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/utils/planTimelineV2Flag', () => ({
  isPlanTimelineV2Enabled: () => flagState.on,
}));

/**
 * Mini-i18next. Repozytoryjny mock `(_key, fallback) => fallback ?? _key`
 * zwróciłby OBIEKT dla `t(key, { date, defaultValue })` — React nie umie go
 * wyrenderować. Słownik wygrywa z `defaultValue`, bo część domyślnych wartości
 * w kodzie jest po polsku (np. `planCard.noDependencies`), a asercje są po
 * angielsku (DEC-461).
 */
const DICT: Record<string, string> = {
  'initiatives.status.IN_EXECUTION': 'In execution',
  'initiatives.timelineSection.planned': 'Planned',
  'initiatives.planCard.noDependencies': 'no dependencies',
  'initiatives.planCard.afterList': 'after: {{list}}',
  'initiatives.planAnalysis.timelineTitle': 'Plan timeline',
  'initiatives.planAnalysis.horizonMonths': '{{count}} months',
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

// Powłoka renderuje TYLKO aktywną sekcję, a pkt 7 dotyczy sekcji „Dependencies
// and conflicts" (domyślnie aktywna jest `horizon`). Stub renderuje wszystkie
// sekcje lewej kolumny = „centrum" karty, bez prawego panelu.
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

import { InitiativeGantt } from '../gantt/InitiativeGantt';
import type { GanttRowLabel } from '../gantt/InitiativeGantt';
import { PlanCard } from '../cards/PlanCard';
import type { PlanCardScenario } from '../cards/PlanCard';
import type { ScheduleItem } from '@/types/initiativeSchedule';

// ── Fikstura: makieta PL3, 8 inicjatyw Northwind, horyzont 12 tygodni ──
interface NorthwindRow {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  exec: boolean;
  role: string;
}
const NORTHWIND: readonly NorthwindRow[] = [
  { id: 'energy', name: 'Energy Monitoring and ISO 50001', start: '2026-09-28', end: '2026-10-26', exec: false, role: 'Energy lead' },
  { id: 'supplier', name: 'Supplier Quality Gate', start: '2026-11-02', end: '2026-11-30', exec: false, role: 'Quality lead' },
  { id: 'scrap', name: 'Scrap Reduction Programme', start: '2027-01-12', end: '2027-06-30', exec: false, role: 'Ops lead' },
  { id: 'shift', name: 'Shift Handover Digitisation', start: '2026-11-09', end: '2026-12-07', exec: false, role: 'Ops lead' },
  { id: 'cnc', name: 'Predictive Maintenance for CNC Line', start: '2026-06-02', end: '2026-11-02', exec: true, role: 'Maintenance' },
  { id: 'mes', name: 'MES Rollout Line 3', start: '2026-04-07', end: '2027-03-01', exec: true, role: 'IT / MES' },
  { id: 'warehouse', name: 'Warehouse Automation Pilot', start: '2026-07-21', end: '2026-10-26', exec: true, role: 'Logistics' },
  { id: 'skills', name: 'Skills Matrix and Upskilling', start: '2026-09-21', end: '2026-11-30', exec: true, role: 'Quality lead' },
];
const HORIZON = {
  rangeStart: local('2026-09-14') ?? undefined,
  rangeEnd: local('2026-12-07') ?? undefined,
};

/**
 * Data BEZ `Z` = północ CZASU LOKALNEGO. Maszyna pomiarowa stoi w
 * America/Chicago (UTC-5/-6), więc `new Date('2026-09-28')` (ISO date-only =
 * UTC) wypada tam na 27.09 19:00 i cała geometria osi przesuwa się o dzień.
 * Północ lokalna daje te same 12 kolumn i te same procenty w każdej strefie.
 */
function local(iso: string | null): string | null {
  return iso == null ? null : `${iso}T00:00:00`;
}

const items = (): ScheduleItem[] =>
  NORTHWIND.map((row) => ({
    id: row.id,
    type: 'phase',
    title: row.name,
    start: local(row.start),
    end: local(row.end),
    status: row.exec ? 'IN_EXECUTION' : 'APPROVED',
    sourceId: row.id,
    sourceKind: 'phase',
  }));

const rowLabels = (): GanttRowLabel[] =>
  NORTHWIND.map((row) => ({
    id: row.id,
    name: row.name,
    meta: `${row.exec ? 'In execution' : 'Planned'} · ${row.role}`,
    frozen: row.exec,
  }));

const frozenIds = (): string[] => NORTHWIND.filter((row) => row.exec).map((row) => row.id);

const NAME_COLUMN = '.w-\\[208px\\]';

function reactProps(el: Element | null): Record<string, unknown> {
  if (!el) return {};
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return key ? ((el as unknown as Record<string, unknown>)[key] as Record<string, unknown>) : {};
}

/**
 * Pasek, NIE plakietka „poza horyzontem" — obie niosą `title` zaczynający się
 * od nazwy inicjatywy, więc rozróżnia je wypełnienie tokenem `bg-c-*`.
 */
const isBar = (el: Element) =>
  el.className.includes('bg-c-') && !el.className.includes('border-dashed');

function barOf(container: HTMLElement, id: string): HTMLElement | null {
  const row = NORTHWIND.find((r) => r.id === id)!;
  return (
    (Array.from(container.querySelectorAll(`[title^="${row.name}"]`)).find(isBar) as HTMLElement) ??
    null
  );
}

function pctOf(value: string | undefined): number {
  return Number.parseFloat((value ?? '0').replace('%', ''));
}

function renderPlan(props: {
  planStatus?: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  onReschedule?: () => void;
  onNewDraftVersion?: () => void;
}) {
  return render(
    <InitiativeGantt
      items={items()}
      dependencies={[{ fromId: 'energy', toId: 'supplier' }]}
      criticalPathIds={['energy', 'supplier']}
      frozenItemIds={frozenIds()}
      rowLabels={rowLabels()}
      planStatus={props.planStatus}
      onReschedule={props.onReschedule}
      onNewDraftVersion={props.onNewDraftVersion}
      {...HORIZON}
      initialZoom="week"
    />
  );
}

describe('InitiativeGantt — oś czasu planu (DEC-615, etap 1)', () => {
  it('pkt 1: 8 wierszy Northwind, nazwy W KOLUMNIE 208px, a nie w paskach', () => {
    const { container } = renderPlan({ planStatus: 'DRAFT' });

    const nameColumn = container.querySelector(NAME_COLUMN) as HTMLElement;
    expect(nameColumn).not.toBeNull();
    // nagłówek „Initiative" + 8 wierszy.
    expect(nameColumn.children).toHaveLength(9);
    expect(nameColumn.children[0].textContent).toBe('Initiative');
    NORTHWIND.forEach((row, idx) => {
      expect(nameColumn.children[idx + 1].textContent).toContain(row.name);
    });

    // 7 pasków + 1 wiersz „poza horyzontem" (Scrap Reduction startuje 2027-01-12)
    // = 8 wierszy osi, dokładnie jak w makiecie (row 3 nie ma paska).
    const bars = NORTHWIND.map((row) => barOf(container, row.id)).filter((bar) => bar != null);
    expect(bars).toHaveLength(7);

    // Nazwa NIGDY w pasku — pasek niesie tylko daty okna.
    bars.forEach((bar) => {
      const title = bar.getAttribute('title') ?? '';
      const row = NORTHWIND.find((r) => title.startsWith(r.name));
      expect(row).toBeDefined();
      expect(bar.textContent).not.toContain(row!.name);
      expect(bar.textContent).toMatch(/^[A-Z][a-z]{2} \d{2} → [A-Z][a-z]{2} \d{2}$/);
    });
  });

  it('pkt 1: siatka = 12 kolumn tygodniowych bez marginesu, geometria paska jak w makiecie', () => {
    const { container } = renderPlan({ planStatus: 'DRAFT' });
    const track = container.querySelector(NAME_COLUMN)!.nextElementSibling as HTMLElement;
    const header = track.firstElementChild as HTMLElement;
    expect(header.children).toHaveLength(12);
    expect(header.children[0].textContent).toBe('Sep 14');
    expect(header.children[11].textContent).toBe('Nov 30');

    // Makieta: `left:16.667%; width:33.333%` (Sep 28 → Oct 26 na osi 84 dni).
    const energy = barOf(container, 'energy') as HTMLElement;
    expect(pctOf(energy.style.left)).toBeCloseTo(16.667, 2);
    expect(pctOf(energy.style.width)).toBeCloseTo(33.333, 2);
    expect(energy.style.height).toBe('22px');
    expect(energy.className).toContain('bg-c-chart-1');

    // Ścieżka krytyczna = dana kategoryczna → c-chart-2, nigdy crimson (pułapka nr 1).
    expect(energy.className).toContain('ring-c-chart-2');
    expect(energy.className).not.toContain('c-' + 'danger');
    expect(container.querySelector('svg path')).toHaveAttribute('stroke', 'var(--c-chart-2)');

    // Pozycja w realizacji = odwrócone tokeny, nie surowy navy-900 z makiety.
    const cnc = barOf(container, 'cnc') as HTMLElement;
    expect(cnc.className).toContain('bg-c-text');
    expect(cnc.className).toContain('text-c-surface');
    expect(cnc.getAttribute('title')).toContain('frozen in execution');
    expect(cnc.getAttribute('title')).toContain('clipped to horizon');
  });

  it('pkt 4: PUBLISHED — żaden pasek nie ma onPointerDown, widoczny komunikat read-only', () => {
    const onReschedule = vi.fn();
    const onNewDraftVersion = vi.fn();
    const { container } = renderPlan({
      planStatus: 'PUBLISHED',
      onReschedule,
      onNewDraftVersion,
    });

    const bars = NORTHWIND.map((row) => barOf(container, row.id)).filter(Boolean) as HTMLElement[];
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach((bar) => {
      expect(reactProps(bar).onPointerDown).toBeUndefined();
      expect(bar.getAttribute('title')).toContain('published');
    });

    expect(
      screen.getByText(/This plan is published — create a new version \(draft\) to change it\./)
    ).toBeTruthy();
    expect(screen.getByText('Create a new version (draft)')).toBeTruthy();
  });

  it('pkt 5: IN_EXECUTION nieprzeciągalne TAKŻE na DRAFT (planowany pasek — przeciwnie)', () => {
    const onReschedule = vi.fn();
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });

    // Kontrola pozytywna: bez niej test przeszedłby, gdyby ŻADEN pasek nie miał
    // uchwytu (np. po zgubieniu `onReschedule` w propsach).
    expect(reactProps(barOf(container, 'energy')).onPointerDown).toBeTypeOf('function');
    expect(reactProps(barOf(container, 'supplier')).onPointerDown).toBeTypeOf('function');

    frozenIds().forEach((id) => {
      const bar = barOf(container, id) as HTMLElement;
      expect(reactProps(bar).onPointerDown).toBeUndefined();
      expect(bar.className).toContain('cursor-not-allowed');
    });
  });

  it('pkt 6: pozycja poza horyzontem — plakietka przy PRAWEJ krawędzi, wiersz ma nazwę', () => {
    const { container } = renderPlan({ planStatus: 'DRAFT' });

    const badge = screen.getByText('Starts Jan 12 — outside this horizon');
    expect(badge.closest('.absolute')!.className).toContain('right-1');
    expect(badge.closest('.absolute')!.className).toContain('border-dashed');
    // Wiersz nie jest pusty: nazwa zostaje w kolumnie po lewej.
    const nameColumn = container.querySelector(NAME_COLUMN) as HTMLElement;
    expect(nameColumn.textContent).toContain('Scrap Reduction Programme');
    // I nie udaje paska.
    expect(barOf(container, 'scrap')).toBeNull();
  });
});

describe('PlanCard — centrum karty planu pod flagą VITE_PLAN_TIMELINE_V2 (pkt 7)', () => {
  const scenario = (status: 'DRAFT' | 'PUBLISHED'): PlanCardScenario => ({
    scenarioId: 'sc-1',
    name: 'Northwind 2027',
    status,
    scenarioVersion: 1,
    portfolioScenarioId: 'p-1',
    portfolioScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [],
    windows: NORTHWIND.map((row) => ({
      initiativeId: row.id,
      earliest: local(row.start),
      target: local(row.start),
      latest: local(row.end),
      rationale: '',
      dependencySnapshot: [],
      constraintSnapshot: [],
    })),
    assumptions: [],
    updatedBy: 'cto',
    publishedBy: null,
    publishedAt: null,
  });

  function renderCard(status: 'DRAFT' | 'PUBLISHED') {
    return render(
      <PlanCard
        scenario={scenario(status)}
        initiatives={NORTHWIND.map((row) => ({
          id: row.id,
          name: row.name,
          lifecycle: row.exec ? 'IN_EXECUTION' : 'APPROVED',
        }))}
        onBack={() => {}}
        onAnalyze={() => {}}
        onReview={() => {}}
        onPublish={() => {}}
      />
    );
  }

  it('pkt 7: flaga ON — lista „X — no dependencies" ZNIKA z centrum, oś dostaje kolumnę nazw', () => {
    flagState.on = true;
    const { container } = renderCard('DRAFT');
    expect(screen.queryByText(/no dependencies/i)).toBeNull();
    expect(container.querySelector(NAME_COLUMN)).not.toBeNull();
    expect(container.querySelector(NAME_COLUMN)!.textContent).toContain(
      'Predictive Maintenance for CNC Line'
    );
  });

  it('pkt 7 (kontrola): flaga OFF — lista jest, a kolumny nazw nie ma', () => {
    flagState.on = false;
    const { container } = renderCard('DRAFT');
    expect(screen.getAllByText(/no dependencies/i).length).toBe(8);
    expect(container.querySelector(NAME_COLUMN)).toBeNull();
    flagState.on = true;
  });

  it('pkt 4 w karcie: PUBLISHED — oś tylko do odczytu z akcją nowej wersji', () => {
    flagState.on = true;
    renderCard('PUBLISHED');
    expect(
      screen.getByText(/This plan is published — create a new version \(draft\) to change it\./)
    ).toBeTruthy();
  });
});
