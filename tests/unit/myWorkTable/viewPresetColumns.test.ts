/**
 * @vitest-environment jsdom
 *
 * Regression guard — „ciche atrapy" zakładek widoku (2026-07-27).
 *
 * Preset widoku deklaruje kolumnę, po której sortuje (`sort[].key`) albo
 * grupuje (`groupBy`). Jeśli tej kolumny nie ma w schemacie i NIKT nie
 * przechwyci tego stanu, zakładka wygląda na działającą i nie robi nic:
 * sort porównuje undefined z undefined, grupowanie robi jedną bezsensowną
 * grupę. Zero sygnału dla użytkownika — gorzej niż błąd.
 *
 * Tak było z „Scoring" (`score`) i „Log decyzji" (`decision`) — obie kolumny
 * spoza `DEFAULT_COLUMNS`. Ten test pilnuje, żeby KAŻDY preset był albo
 * pokryty kolumną domyślną, albo miał świadomie zarejestrowany pusty stan
 * z akcją. Trzeci taki preset nie przejdzie po cichu.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_COLUMNS } from '@/components/MyWork/table/useTableSchema';
import { useTableViews } from '@/components/MyWork/table/useTableViews';
import {
  DECISION_COLUMN_KEY,
  resolveDecisionViewSetup,
  resolveScoringViewSetup,
  SCORE_COLUMN_KEY,
} from '@/components/MyWork/table/ViewSetupEmptyState';

/** Presety, których brakującą kolumnę obsługuje `ViewSetupEmptyState`. */
const PRESETS_WITH_EMPTY_STATE = new Set(['scoring', 'decision_log', 'timeline_view']);

/**
 * Presety czytamy z ŻYWEGO hooka, nie z kopii listy — kopia zestarzałaby się
 * przy pierwszym nowym presecie i test przestałby cokolwiek chronić.
 */
function readPresets(): { id: string; sortKey?: string; groupBy?: string }[] {
  const { result } = renderHook(() =>
    useTableViews({ t: (_k: string, fallback?: string) => fallback ?? _k, ideaId: 'test-idea' })
  );
  return result.current.savedViews.map((v) => ({
    id: v.id,
    sortKey: v.sort?.[0]?.key,
    groupBy: v.groupBy,
  }));
}

describe('presety widoków Tabeli Idei — żadna zakładka nie jest cichą atrapą', () => {
  const defaultKeys = new Set(DEFAULT_COLUMNS.map((c) => c.key));

  it.each(readPresets())(
    'preset $id ma swoją kolumnę w schemacie ALBO pusty stan z akcją',
    ({ id, sortKey, groupBy }) => {
      const required = sortKey ?? groupBy;
      if (!required) return; // preset bez wymagań (Domyślny, Timeline-layout)

      const covered = defaultKeys.has(required) || PRESETS_WITH_EMPTY_STATE.has(id);
      expect(covered).toBe(true);
    }
  );

  it('Triażowanie działa bez pustego stanu — grupuje po istniejącym `status`', () => {
    expect(defaultKeys.has('status')).toBe(true);
  });

  it('Scoring i Log decyzji NADAL nie mają swoich kolumn domyślnie (stąd pusty stan)', () => {
    // Gdyby ktoś dodał je do DEFAULT_COLUMNS, pusty stan stanie się martwym
    // kodem — wtedy ten test przypomni, żeby go zdjąć zamiast zostawić dubel.
    expect(defaultKeys.has(SCORE_COLUMN_KEY)).toBe(false);
    expect(defaultKeys.has(DECISION_COLUMN_KEY)).toBe(false);
  });

  describe('resolver rozpoznaje powód, dla którego widok nie ma czego pokazać', () => {
    const rows = [{ data: { label: 'a' } }, { data: { label: 'b' } }];

    it('brak kolumny → no-column (to był realny stan przed naprawą)', () => {
      expect(resolveScoringViewSetup({ columns: DEFAULT_COLUMNS, rows })).toEqual({
        reason: 'no-column',
      });
      expect(resolveDecisionViewSetup({ columns: DEFAULT_COLUMNS, rows })).toEqual({
        reason: 'no-column',
      });
    });

    it('kolumna ukryta → hidden-column z nazwą do odsłonięcia', () => {
      const columns = [
        ...DEFAULT_COLUMNS,
        { key: SCORE_COLUMN_KEY, header: 'Ocena', type: 'number', visible: false, width: 110 },
      ];
      expect(resolveScoringViewSetup({ columns, rows })).toEqual({
        reason: 'hidden-column',
        columnName: 'Ocena',
        columnKey: SCORE_COLUMN_KEY,
      });
    });

    it('kolumna widoczna, ale pusta → no-values', () => {
      const columns = [
        ...DEFAULT_COLUMNS,
        { key: SCORE_COLUMN_KEY, header: 'Ocena', type: 'number', visible: true, width: 110 },
      ];
      expect(resolveScoringViewSetup({ columns, rows })?.reason).toBe('no-values');
    });

    it('brak wierszy → no-rows (a nie mylące „kolumna pusta")', () => {
      const columns = [
        ...DEFAULT_COLUMNS,
        { key: SCORE_COLUMN_KEY, header: 'Ocena', type: 'number', visible: true, width: 110 },
      ];
      expect(resolveScoringViewSetup({ columns, rows: [] })).toEqual({ reason: 'no-rows' });
    });

    it('kolumna z wartościami → null, czyli widok renderuje się normalnie', () => {
      const columns = [
        ...DEFAULT_COLUMNS,
        { key: SCORE_COLUMN_KEY, header: 'Ocena', type: 'number', visible: true, width: 110 },
      ];
      const scored = [{ data: { [SCORE_COLUMN_KEY]: 95 } }, { data: {} }];
      expect(resolveScoringViewSetup({ columns, rows: scored })).toBeNull();
    });

    it('ocena 0 to WARTOŚĆ, nie brak — inaczej wyzerowany ranking znika z ekranu', () => {
      const columns = [
        ...DEFAULT_COLUMNS,
        { key: SCORE_COLUMN_KEY, header: 'Ocena', type: 'number', visible: true, width: 110 },
      ];
      expect(resolveScoringViewSetup({ columns, rows: [{ data: { score: 0 } }] })).toBeNull();
    });
  });
});
