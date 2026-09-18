/** @vitest-environment jsdom */
/**
 * DEC-627 — oś czasu planu, ETAP 2 (SPEC §4.2/§4.6/§7.2/§7.3, §8 wiersz „2").
 *
 * Trzyma zachowanie przeciągania i klawiatury na osi planu:
 *  - drag paska planowanego w DRAFT zapisuje RAZ (na `pointerup`), nigdy na
 *    `pointermove` — cały scenariusz idzie przez CAS, więc naiwny zapis na każdy
 *    ruch wywaliłby 409 i zgubił cudzą zmianę (SPEC „trzy rzeczy, które
 *    najłatwiej zepsuć" pkt 1);
 *  - okno przesuwa się o Δ dni (snap dzienny), długość okna bez zmian;
 *  - błąd/409 → pasek WRACA na pozycję wyjściową (optimistic UI cofnięty);
 *  - klawiatura §13.3c: ←/→ tydzień, Shift+←/→ dzień, Enter zapisuje, Esc cofa,
 *    Ctrl/Cmd+Z = undo ostatniego przesunięcia;
 *  - zamrożone/opublikowane: `aria-disabled`, strzałki nic nie robią.
 *
 * Fikstura = te same 8 inicjatyw Northwind co `planTimeline.test.tsx`
 * (horyzont 12 tygodni 2026-09-14 → 2026-12-07, więc 1 px = 84/1000 dnia przy
 * szerokości siatki 1000 px — dx 167 px = +14 dni).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/utils/planTimelineV2Flag', () => ({
  isPlanTimelineV2Enabled: () => flagState.on,
}));

const DICT: Record<string, string> = {
  'initiatives.status.IN_EXECUTION': 'In execution',
  'initiatives.timelineSection.planned': 'Planned',
  'initiatives.planCard.noDependencies': 'no dependencies',
  'initiatives.gantt.dragHint': 'Drag to move · {{count}} weeks',
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

// Powłoka karty: stub renderuje wszystkie sekcje lewej kolumny (= „centrum").
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
import type { PlanCardScenario, PlanCardWindowPatch } from '../cards/PlanCard';
import type { ScheduleItem } from '@/types/initiativeSchedule';

// ── Fikstura Northwind (jak w planTimeline.test.tsx) ──
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
const HORIZON = { rangeStart: local('2026-09-14') ?? undefined, rangeEnd: local('2026-12-07') ?? undefined };

/** Północ CZASU LOKALNEGO (bez `Z`) — patrz komentarz w planTimeline.test.tsx. */
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

const isBar = (el: Element) =>
  el.className.includes('bg-c-') && !el.className.includes('border-dashed');

function barOf(container: HTMLElement, id: string): HTMLElement | null {
  const row = NORTHWIND.find((r) => r.id === id)!;
  return (
    (Array.from(container.querySelectorAll(`[title^="${row.name}"]`)).find(isBar) as HTMLElement) ??
    null
  );
}

function renderPlan(props: {
  planStatus?: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  onReschedule?: (
    itemId: string,
    sourceKind: string,
    sourceId: string,
    start: string,
    end: string
  ) => void | Promise<void>;
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
      {...HORIZON}
      initialZoom="week"
    />
  );
}

const cardScenario = (status: 'DRAFT' | 'PUBLISHED'): PlanCardScenario => ({
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

function renderCard(
  status: 'DRAFT' | 'PUBLISHED',
  onWindowChange?: (initiativeId: string, patch: PlanCardWindowPatch) => void | Promise<boolean | void>,
  errorLabel?: string | null
) {
  return render(
    <PlanCard
      scenario={cardScenario(status)}
      initiatives={NORTHWIND.map((row) => ({
        id: row.id,
        name: row.name,
        lifecycle: row.exec ? 'IN_EXECUTION' : 'APPROVED',
      }))}
      onBack={() => {}}
      onAnalyze={() => {}}
      onReview={() => {}}
      onPublish={() => {}}
      onWindowChange={onWindowChange}
      errorLabel={errorLabel}
    />
  );
}

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
/** 1 px = 84 dni / 1000 px → dx px = round(dx·84/1000) dni. 167 px = +14 dni. */
const pxForDays = (days: number) => Math.round((days * GRID_W) / 84);
/**
 * PlanCard nie dostaje HORIZON — sam liczy zakres od `startOfWeekMonday(dziś)`
 * do `dziś + horizonMonths(3)`, a granice zapisuje jako UTC-północ ISO. Zegar
 * przypięty na 2026-09-14 → zakres kwantyzuje się do 14 całych tygodni, więc
 * `totalDays = weeks·7 = 98` (dni osi, nie dni kalendarzowe). Bez przypięcia
 * `totalDays` pływa (91/98), więc stały dx nie dawałby zawsze +14 dni.
 */
const pxForCardDays = (days: number) => Math.round((days * GRID_W) / 98);

beforeEach(() => {
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
});

/** Pełny drag: down(0) → move(dx) → up(dx). `moves` pozwala dowodzić „zapis raz". */
async function dragBy(el: HTMLElement, dx: number, moves = 1) {
  await act(async () => {
    el.dispatchEvent(new FakePointerEvent('pointerdown', { clientX: 0, pointerId: 1 }));
    for (let i = 1; i <= moves; i += 1) {
      el.dispatchEvent(new FakePointerEvent('pointermove', { clientX: (dx * i) / moves, pointerId: 1 }));
    }
    el.dispatchEvent(new FakePointerEvent('pointerup', { clientX: dx, pointerId: 1 }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe('InitiativeGantt — etap 2: przeciąganie (SPEC §7.2)', () => {
  it('drag planowanego paska w DRAFT zapisuje RAZ z oknem +14 dni (snap dzienny)', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;

    await dragBy(bar, pxForDays(14));

    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule).toHaveBeenCalledWith(
      'energy',
      'phase',
      'energy',
      '2026-10-12',
      '2026-11-09'
    );
  });

  it('wiele pointermove + jeden pointerup = JEDEN zapis (nigdy zapis na każdy ruch)', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;

    await dragBy(bar, pxForDays(14), 4);

    expect(onReschedule).toHaveBeenCalledTimes(1);
  });

  it('błąd zapisu (409) → pasek WRACA na pozycję wyjściową', async () => {
    const onReschedule = vi.fn().mockRejectedValue(new Error('409 CONFLICT'));
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;
    const originalLeft = bar.style.left;

    await dragBy(bar, pxForDays(14));

    expect(onReschedule).toHaveBeenCalledTimes(1);
    const after = barOf(container, 'energy')!;
    expect(after.style.left).toBe(originalLeft);
  });

  it('uchwyty (kropki) są na pasku planowanym, a NIE na zamrożonym', () => {
    const onReschedule = vi.fn();
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    expect(barOf(container, 'energy')!.querySelectorAll('i.rounded-full').length).toBe(6);
    expect(barOf(container, 'cnc')!.querySelectorAll('i.rounded-full').length).toBe(0);
  });

  it('podpowiedź „Drag to move · N weeks" pojawia się na fokusablenym pasku (N = długość okna)', () => {
    const onReschedule = vi.fn();
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;
    expect(screen.queryByText('Drag to move · 4 weeks')).toBeNull();
    fireEvent.focus(bar);
    expect(screen.getByText('Drag to move · 4 weeks')).toBeTruthy();
  });
});

describe('InitiativeGantt — etap 2: klawiatura §13.3c (SPEC §4.6)', () => {
  it('←/→ przesuwa o tydzień (podgląd), Enter zapisuje RAZ (+7 dni)', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;

    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(onReschedule).not.toHaveBeenCalled(); // podgląd bez zapisu
    fireEvent.keyDown(bar, { key: 'Enter' });
    await flush();

    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule).toHaveBeenCalledWith(
      'energy',
      'phase',
      'energy',
      '2026-10-05',
      '2026-11-02'
    );
  });

  it('Shift+→ przesuwa o JEDEN dzień', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;

    fireEvent.keyDown(bar, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(bar, { key: 'Enter' });
    await flush();

    expect(onReschedule).toHaveBeenCalledWith(
      'energy',
      'phase',
      'energy',
      '2026-09-29',
      '2026-10-27'
    );
  });

  it('Esc cofa podgląd do pozycji sprzed edycji i NIE zapisuje', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;
    const originalLeft = bar.style.left;

    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    fireEvent.keyDown(bar, { key: 'Escape' });
    await flush();

    expect(onReschedule).not.toHaveBeenCalled();
    expect(barOf(container, 'energy')!.style.left).toBe(originalLeft);
  });

  it('Ctrl/Cmd+Z po zapisie cofa okno (undo jednego poziomu)', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const bar = barOf(container, 'energy')!;

    await dragBy(bar, pxForDays(14));
    expect(onReschedule).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(barOf(container, 'energy')!, { key: 'z', metaKey: true });
    await flush();

    expect(onReschedule).toHaveBeenCalledTimes(2);
    expect(onReschedule).toHaveBeenLastCalledWith(
      'energy',
      'phase',
      'energy',
      '2026-09-28',
      '2026-10-26'
    );
  });

  it('przycisk „Undo move" jest wyłączony bez ruchu i aktywny po zapisie', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const undo = screen.getByRole('button', { name: 'Undo the last window move' });
    expect((undo as HTMLButtonElement).disabled).toBe(true);

    await dragBy(barOf(container, 'energy')!, pxForDays(14));
    expect((screen.getByRole('button', { name: 'Undo the last window move' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('pasek zamrożony: aria-disabled, strzałki NIC nie robią', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'DRAFT', onReschedule });
    const cnc = barOf(container, 'cnc')!;
    expect(cnc.getAttribute('aria-disabled')).toBe('true');

    fireEvent.keyDown(cnc, { key: 'ArrowRight' });
    fireEvent.keyDown(cnc, { key: 'Enter' });
    await flush();

    expect(onReschedule).not.toHaveBeenCalled();
  });

  it('PUBLISHED: każdy pasek aria-disabled, drag i strzałki bez zapisu', async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const { container } = renderPlan({ planStatus: 'PUBLISHED', onReschedule });
    const bar = barOf(container, 'energy')!;
    expect(bar.getAttribute('aria-disabled')).toBe('true');

    await dragBy(bar, pxForDays(14));
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    fireEvent.keyDown(bar, { key: 'Enter' });
    await flush();

    expect(onReschedule).not.toHaveBeenCalled();
  });
});

describe('PlanCard — etap 2: zapis przez onWindowChange (SPEC §4.2/§7.2)', () => {
  beforeEach(() => {
    flagState.on = true;
    // Tylko `Date` — `setTimeout` zostaje prawdziwy, więc `flush()` działa.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drag paska w karcie → onWindowChange RAZ z oknem +14 dni (całe {earliest,target,latest})', async () => {
    const onWindowChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderCard('DRAFT', onWindowChange);
    const bar = barOf(container, 'energy')!;

    await dragBy(bar, pxForCardDays(14));

    expect(onWindowChange).toHaveBeenCalledTimes(1);
    const [id, patch] = onWindowChange.mock.calls[0] as [string, PlanCardWindowPatch];
    expect(id).toBe('energy');
    expect(patch).toEqual({
      earliest: '2026-10-12T00:00:00.000Z',
      target: '2026-10-12T00:00:00.000Z',
      latest: '2026-11-09T00:00:00.000Z',
    });
  });

  it('onWindowChange = false (409 z CAS) → pasek WRACA, brak cichej utraty', async () => {
    const onWindowChange = vi.fn().mockResolvedValue(false);
    const { container } = renderCard('DRAFT', onWindowChange);
    const bar = barOf(container, 'energy')!;
    const originalLeft = bar.style.left;

    await dragBy(bar, pxForCardDays(14));

    expect(onWindowChange).toHaveBeenCalledTimes(1);
    expect(barOf(container, 'energy')!.style.left).toBe(originalLeft);
  });

  it('PUBLISHED: karta nie podpina onReschedule → drag nie zapisuje', async () => {
    const onWindowChange = vi.fn();
    const { container } = renderCard('PUBLISHED', onWindowChange);
    const bar = barOf(container, 'energy')!;

    await dragBy(bar, pxForCardDays(14));

    expect(onWindowChange).not.toHaveBeenCalled();
  });

  it('409 → komunikat konfliktu widoczny PRZY osi czasu (sekcja zależności)', () => {
    const msg = 'Plan changed or its Portfolio basis is stale. Reopen before retrying.';
    const { container } = renderCard('DRAFT', vi.fn(), msg);
    const alert = container.querySelector('[data-testid="plan-window-conflict"]');
    expect(alert).not.toBeNull();
    expect(alert!.getAttribute('role')).toBe('alert');
    expect(alert!.textContent).toBe(msg);
  });
});
