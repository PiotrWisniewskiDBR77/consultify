/**
 * Dwa uczciwe stany pustki tabeli Pomysłów — pomiar na żywo 05.09
 * (`idea-table-tool-empty-filter`).
 *
 * Zmierzony defekt: tabela z SZEŚCIOMA wierszami po wpisaniu w filtr frazy
 * bez trafień („zzzzqqq") pokazywała „Tabela jest jeszcze pusta / Zacznij od
 * struktury…" z przyciskami budowania frameworka — czyli komunikat „brak
 * rekordów" w sytuacji „brak wyników filtra".
 *
 * Test spina PRAWDZIWY kod filtrujący (`useTableRows`) z kodem decydującym o
 * komunikacie (`resolveTableEmptyState`), a nie sprawdza jednego w oderwaniu
 * od drugiego — dokładnie ten szew był zepsuty.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { hasActiveTableFilter, resolveTableEmptyState } from '../tableEmptyState';
import type { FilterGroup, TableNode } from '../tableTypes';
import { useTableRows } from '../useTableRows';

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

const NO_FILTERS: FilterGroup = { logic: 'and', rules: [] };

const SIX_ROWS: TableNode[] = Array.from({ length: 6 }, (_, index) => ({
  id: `row-${index + 1}`,
  type: 'idea',
  data: { label: `Wiersz ${index + 1}` },
})) as unknown as TableNode[];

function renderRows(nodes: TableNode[], filterInput: string, filters: FilterGroup = NO_FILTERS) {
  return renderHook(() =>
    useTableRows({
      ideaId: 'idea-1',
      locked: false,
      t: (_key: string, fallback?: string) => fallback ?? _key,
      nodesUndo: {
        state: nodes,
        push: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        reset: vi.fn(),
      } as any,
      sort: null,
      filters,
      filterInput,
      groupBy: null,
    })
  );
}

describe('resolveTableEmptyState — rozdzielenie dwóch pustek', () => {
  it('nazywa filtr bez trafień "brak wyników filtra", nie "pustą tabelą"', () => {
    const { result } = renderRows(SIX_ROWS, 'zzzzqqq');
    // Realny filtr naprawdę nic nie zwraca…
    expect(result.current.processedRows).toHaveLength(0);
    // …a rekordy w tabeli nadal są.
    expect(result.current.nodes).toHaveLength(6);

    expect(
      resolveTableEmptyState({
        visibleRowCount: result.current.processedRows.length,
        totalRowCount: result.current.nodes.length,
        filterInput: 'zzzzqqq',
        filterRuleCount: 0,
      })
    ).toBe('no-filter-results');
  });

  it('nazywa naprawdę pustą tabelę "brak rekordów"', () => {
    const { result } = renderRows([], '');
    expect(result.current.processedRows).toHaveLength(0);
    expect(
      resolveTableEmptyState({
        visibleRowCount: 0,
        totalRowCount: result.current.nodes.length,
        filterInput: '',
        filterRuleCount: 0,
      })
    ).toBe('no-records');
  });

  it('pusta tabela z aktywnym filtrem to nadal "brak rekordów"', () => {
    // Nie ma czego odfiltrować — zachęta do zbudowania struktury jest właściwa.
    expect(
      resolveTableEmptyState({
        visibleRowCount: 0,
        totalRowCount: 0,
        filterInput: 'zzzzqqq',
        filterRuleCount: 1,
      })
    ).toBe('no-records');
  });

  it('wiersze widoczne = żaden stan pustki', () => {
    const { result } = renderRows(SIX_ROWS, 'Wiersz');
    expect(result.current.processedRows.length).toBeGreaterThan(0);
    expect(
      resolveTableEmptyState({
        visibleRowCount: result.current.processedRows.length,
        totalRowCount: result.current.nodes.length,
        filterInput: 'Wiersz',
        filterRuleCount: 0,
      })
    ).toBe('none');
  });

  it('reguła filtra per kolumna też liczy się jako aktywny filtr', () => {
    const filters: FilterGroup = {
      logic: 'and',
      rules: [{ id: 'r1', field: 'label', operator: 'equals', value: 'brak-takiego' } as any],
    };
    const { result } = renderRows(SIX_ROWS, '', filters);
    expect(result.current.processedRows).toHaveLength(0);
    expect(
      resolveTableEmptyState({
        visibleRowCount: 0,
        totalRowCount: result.current.nodes.length,
        filterInput: '',
        filterRuleCount: filters.rules.length,
      })
    ).toBe('no-filter-results');
  });

  it('sama obecność pola filtra to nie filtr — biała spacja się nie liczy', () => {
    expect(hasActiveTableFilter({ visibleRowCount: 0, totalRowCount: 6, filterInput: '   ' })).toBe(
      false
    );
    expect(hasActiveTableFilter({ visibleRowCount: 0, totalRowCount: 6, filterInput: 'a' })).toBe(
      true
    );
  });
});

describe('IdeaTableTool — podłączenie obu stanów do renderu', () => {
  it('renderuje osobną gałąź dla braku wyników filtra i przycisk czyszczenia', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../IdeaTableTool.tsx'),
      'utf8'
    );
    // Decyzja bierze się z jednego miejsca, a nie z powtórzonego warunku.
    expect(source).toContain('resolveTableEmptyState({');
    expect(source).toContain("tableEmptyState === 'no-filter-results'");
    expect(source).toContain("tableEmptyState === 'no-records'");
    expect(source).toContain("t('ideas.table.clearFilter'");
  });
});
