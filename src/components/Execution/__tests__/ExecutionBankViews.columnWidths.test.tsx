/**
 * @vitest-environment jsdom
 *
 * K5 — SZEROKOŚCI KOLUMN BANKU REALIZACJI (odbiór 13.09, ciemny motyw).
 *
 * Słowa właściciela: „bez sensu jest to, że wszystkie kolumny są tej samej
 * szerokości, bo przez to ta pierwsza jest beznadziejna". Zmierzone na zrzucie:
 * kolumna „Initiative / Case" miała 125 px (najwęższa na ekranie), kolumny
 * z samymi myślnikami 140–191 px, nazwy inicjatyw łamały się na 3–4 linie.
 *
 * PRZYCZYNA (i dlatego test stoi w DWÓCH warstwach):
 *   1. JĄDRO rozpoznawało kolumnę główną po magicznym `id` (`title`/`name`),
 *      więc `initiativeCase` nie dostawał ani podłogi 200 px, ani zwolnienia
 *      ze zjazdu do podłogi przy przepełnieniu → warstwa „kanon" niżej.
 *   2. EKRAN nie deklarował `dataType` na żadnej z 15 kolumn, więc wszystkie
 *      dostawały tę samą podłogę `text` (140 px) → warstwa „bank" niżej.
 *
 * Asercje patrzą na WYRENDEROWANY DOM (`<th style="width">`), nie na źródło —
 * test źródła przeszedłby także wtedy, gdyby jądro zignorowało deklarację.
 *
 * DOWÓD MUTACYJNY:
 *   · usunięcie gałęzi `column.primary` z `isPrimaryColumn` łamie „kanon:
 *     deklaracja primary…" i „bank: kolumna tytułowa…",
 *   · skasowanie `dataType` z kolumn banku łamie „bank: kolumna liczbowa…",
 *   · skasowanie `align: 'right'` łamie „bank: liczby i daty do prawej".
 */
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FilterableTable,
  getColumnFitFloor,
  isPrimaryColumn,
  type TableColumn,
} from '../../shared/ModuleHub/FilterableTable';
import type {
  ExecutionBankEvidence,
  ExecutionBankEvidenceMeta,
  ExecutionBankRow,
  ExecutionBankUnknownReason,
} from '../executionBankModel';
import { ExecutionBankViews } from '../ExecutionBankViews';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

const META: ExecutionBankEvidenceMeta = {
  asOf: '2026-09-13',
  source: 'test',
  completeness: 'KNOWN',
  staleness: 'CURRENT',
  formula: { id: 'test', version: 1 },
  inputs: {},
  window: null,
};

const known = <T,>(value: T): ExecutionBankEvidence<T> => ({ status: 'KNOWN', value, meta: META });
const gap = <T,>(reason: ExecutionBankUnknownReason): ExecutionBankEvidence<T> => ({
  status: 'UNKNOWN',
  value: null,
  reason,
  meta: META,
});

/** Wiersz z DŁUGĄ nazwą — dokładnie te, na których łamanie widać na żywo. */
const row = (id: string, name: string): ExecutionBankRow =>
  ({
    id,
    initiativeId: `init-${id}`,
    executionCaseId: null,
    executionCaseVersion: null,
    name,
    description: null,
    lifecycleStatus: 'IN_EXECUTION',
    executionState: 'UNKNOWN',
    executionPhase: null,
    ownerId: null,
    ownerName: null,
    deliveryProfile: null,
    progress: gap('PROGRESS_MISSING'),
    confidence: gap('CONFIDENCE_MISSING'),
    baselineStart: gap('BASELINE_MISSING'),
    baselineFinish: gap('BASELINE_MISSING'),
    currentPlanStart: gap('CURRENT_PLAN_MISSING'),
    currentPlanFinish: gap('CURRENT_PLAN_MISSING'),
    forecastStart: gap('FORECAST_MISSING'),
    forecastFinish: gap('FORECAST_MISSING'),
    actualStart: gap('ACTUAL_MISSING'),
    actualFinish: gap('ACTUAL_MISSING'),
    varianceDays: gap('VALUE_MISSING') as ExecutionBankRow['varianceDays'],
    health: gap('HEALTH_MISSING'),
    blockerCount: null,
    pendingDecisionCount: null,
    resourceConstraint: null,
    nextAction: null,
    updatedAt: gap('VALUE_MISSING'),
    displayFinish: gap('VALUE_MISSING') as ExecutionBankRow['displayFinish'],
  }) as ExecutionBankRow;

const ROWS: ExecutionBankRow[] = [
  row('r1', '[ACCEPTANCE] Benefits realization'),
  row('r2', 'Automatyzacja magazynu WIP'),
  row('r3', 'Optymalizacja zapasów komponentów'),
  row('r4', 'Pełna identyfikowalność partii'),
  row('r5', 'Poprawa realizacji korzyści programu'),
  row('r6', 'Program poprawy OEE linii montażowej'),
];

const renderBank = () =>
  render(
    <ExecutionBankViews
      rows={ROWS}
      view="table"
      selected={null}
      calendarWindow={
        { asOf: '2026-09-13', months: 6, buckets: [] } as never
      }
      onSelect={() => {}}
      onOpen={() => {}}
      onHorizonChange={() => {}}
      onDrilldownMonth={() => {}}
    />
  );

const headerWidth = (container: HTMLElement, columnId: string): number => {
  const th = container.querySelector<HTMLTableCellElement>(`th[data-column-id="${columnId}"]`);
  if (!th) throw new Error(`Brak kolumny ${columnId} w wyrenderowanej tabeli`);
  return Number.parseInt(th.style.width, 10);
};

describe('Kanon: kolumna główna z DEKLARACJI, nie z magicznego id', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('deklaracja primary daje podłogę 200 px kolumnie o dowolnym id', () => {
    const { container } = render(
      <FilterableTable
        columns={[
          { id: 'caseName', label: 'Case', primary: true, width: '80px' },
          { id: 'other', label: 'Other', width: '80px' },
          { id: 'proza', label: 'Proza', dataType: 'text', width: '80px' },
        ]}
        data={[{ id: 'r1' }]}
        activeFilters={[]}
        onFilterChange={() => {}}
        hideRowActions
      />
    );

    // 200 px = FIT_MIN_PRIMARY_COLUMN_WIDTH — kolumna główna z DEKLARACJI.
    expect(headerWidth(container, 'caseName')).toBe(200);
    // 140 px = podłoga typu `text`, ale TYLKO gdy ekran typ ZADEKLAROWAŁ
    // (scalenie K5-7 2026-09-13: kolumna bez `dataType` siada na ZMIERZONEJ
    // podłodze nagłówka, żeby nie rozpychać tabeli poza obszar — patrz nota
    // przy `getColumnFitFloor`). Istotne jest jedno: kolumna wtórna NIE
    // dostaje podłogi kolumny głównej.
    expect(headerWidth(container, 'proza')).toBe(140);
    expect(headerWidth(container, 'other')).toBeLessThan(200);
  });

  it('primary: false odbiera rolę główną nawet kolumnie o id "title"', () => {
    expect(isPrimaryColumn({ id: 'initiativeCase', primary: true })).toBe(true);
    expect(isPrimaryColumn({ id: 'title' })).toBe(true); // zgodność wsteczna
    expect(isPrimaryColumn({ id: 'title', primary: false })).toBe(false);
    expect(isPrimaryColumn({ id: 'anything' })).toBe(false);
  });

  it('podłoga dopasowania (zjazd przy przepełnieniu) też czyta deklarację', () => {
    // To ta sama podłoga, której kolumna główna NIE przekracza w dół, gdy
    // tabela się nie mieści (`columnFit`, gałąź `budget < floorTotal`).
    expect(getColumnFitFloor({ id: 'initiativeCase', label: 'x', primary: true })).toBe(200);
    // Bez deklaracji roli: podłoga typu, gdy typ ZADEKLAROWANY (140 px dla
    // `text`), a bez typu — podłoga minimalna 90 px (scalenie K5-7).
    expect(getColumnFitFloor({ id: 'initiativeCase', label: 'x', dataType: 'text' })).toBe(140);
    expect(getColumnFitFloor({ id: 'initiativeCase', label: 'x' })).toBe(90);
  });
});

describe('Bank Realizacji — kolumna tytułowa szeroka, liczbowe wąskie', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('kolumna tytułowa jest co najmniej 2× szersza niż najwęższa liczbowa', () => {
    const { container } = renderBank();

    const title = headerWidth(container, 'initiativeCase');
    const numeric = Math.min(
      headerWidth(container, 'blockerCount'),
      headerWidth(container, 'varianceDays'),
      headerWidth(container, 'lifecycleStatus')
    );

    expect(title).toBeGreaterThanOrEqual(300);
    expect(title).toBeGreaterThanOrEqual(2 * numeric);
  });

  it('kolumny liczbowe pozostają wąskie, a statusy poniżej kolumny głównej', () => {
    const { container } = renderBank();

    // Bez `dataType` każda z nich siadała na 140 px — czyli tyle samo, ile
    // dostawała kolumna nazwy. To była cała skarga właściciela.
    expect(headerWidth(container, 'blockerCount')).toBeLessThan(140);
    // Status chips keep their measured 160px floor; they still remain well
    // below the 300px primary title column.
    expect(headerWidth(container, 'lifecycleStatus')).toBeLessThan(200);
    expect(headerWidth(container, 'varianceDays')).toBeLessThan(140);
    expect(headerWidth(container, 'health')).toBeLessThan(200);
  });

  it('uses a short unit-bearing variance heading instead of the clipped VARIAN… label', () => {
    const { getByText } = renderBank();
    expect(getByText('Δ days')).toBeInTheDocument();
  });

  it('liczby i daty są wyrównane do prawej (kanon §3.3)', () => {
    const { container } = renderBank();

    for (const id of [
      'progress',
      'baselineFinish',
      'forecastFinish',
      'varianceDays',
      'blockerCount',
      'updatedAt',
    ]) {
      const th = container.querySelector<HTMLTableCellElement>(`th[data-column-id="${id}"]`);
      expect(th, `kolumna ${id}`).toBeTruthy();
      expect(th!.className, `kolumna ${id}`).toContain('text-right');
    }
  });

  it('każda kolumna banku deklaruje szerokość ponad podłogą liczbową', () => {
    const { container } = renderBank();
    const headers = Array.from(
      container.querySelectorAll<HTMLTableCellElement>('th[data-column-id]')
    );

    // 15 kolumn w deklaracji; 3 wtórne (Delivery profile, Pending decisions, Constraint)
    // sa domyslnie schowane w pstryczku (decyzja CTO 13.09 po uwadze wlasciciela o kolumnach).
    expect(headers.length).toBe(12);
    for (const th of headers) {
      const width = Number.parseInt(th.style.width, 10);
      expect(width, th.dataset.columnId).toBeGreaterThanOrEqual(90);
    }
  });

  it('długa nazwa dostaje klamrę dwóch linii (wiersz nie puchnie)', () => {
    const { container } = renderBank();
    const cell = container.querySelector('[data-testid="execution-bank-table-item-r6"]');

    expect(cell).toBeTruthy();
    expect(cell!.querySelector('.line-clamp-2')).toBeTruthy();
  });
});

/** Zgodność wsteczna: 94 ekrany listowe stoją na heurystyce `id`. */
describe('Kanon: stare id dalej działa bez deklaracji', () => {
  beforeEach(() => window.localStorage.clear());

  it('kolumna "title" bez pola primary zachowuje podłogę 200 px', () => {
    const columns: TableColumn[] = [
      { id: 'title', label: 'Tytuł', width: '80px' },
      { id: 'name', label: 'Nazwa', width: '80px' },
    ];
    const { container } = render(
      <FilterableTable
        columns={columns}
        data={[{ id: 'r1' }]}
        activeFilters={[]}
        onFilterChange={() => {}}
        hideRowActions
      />
    );

    expect(headerWidth(container, 'title')).toBe(200);
    expect(headerWidth(container, 'name')).toBe(200);
  });
});
