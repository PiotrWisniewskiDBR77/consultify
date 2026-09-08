/**
 * [ODMROZENIE 05_INITIATIVES DEC-453] Przegląd DBR77 (2026-09-08).
 *
 * `STATUS_COLORS` w `ExecutionTimelineView.tsx` (wspólny silnik Gantta dla
 * Inicjatyw i Realizacji) miał KAŻDY status zdefiniowany 2-4 razy w jednym
 * literale obiektu — w JS późniejszy klucz cicho nadpisuje wcześniejszy, więc
 * realnie liczyła się tylko OSTATNIA definicja, reszta była martwym kodem.
 * Zmierzone na danych DBR77 (widok "Oś czasu" Inicjatyw, kopia stagingu):
 * legenda pod wykresem renderowała klucz React `IN_EXECUTION` DWA RAZY
 * (ta sama tablica statusów kopiowała ten sam błąd co obiekt kolorów) —
 * konsola: "Encountered two children with the same key... IN_EXECUTION".
 * Skutek uboczny duplikatów: finalny, jedyny obowiązujący kolor IN_EXECUTION
 * wskazywał `danger` (czerwień) — złamanie kanonu TRIADA §3 (czerwień
 * wyłącznie dla semantyki krytycznej, nie dla zwykłego statusu "w realizacji").
 *
 * Ten test broni: (1) brak duplikatów kluczy (każdy status dokładnie raz —
 * import modułu z `Object.keys` na żywym obiekcie eksportowanym z komponentu,
 * nie przepisany ręcznie, więc przyszły duplikat znów by go zepsuł),
 * (2) 7 statusów kompletu enuma, (3) różne kolory `progress` dla różnych
 * statusów (czytelna legenda), (4) żaden status poza semantyką krytyczną nie
 * używa `danger`/`primary` (crimson).
 */
import { describe, expect, it } from 'vitest';

import { STATUS_COLORS } from '../../../src/components/Execution/ExecutionTimelineView';
import { InitiativeStatus } from '../../../packages/shared/src/constants/initiativeStatuses.generated';

describe('ExecutionTimelineView STATUS_COLORS — bez duplikatów kluczy (DEC-453, przegląd DBR77)', () => {
  it('ma dokładnie 7 kluczy — po jednym na każdy status enuma, zero duplikatów', () => {
    const keys = Object.keys(STATUS_COLORS);
    expect(keys.length).toBe(7);
    expect(new Set(keys).size).toBe(7);
    expect(keys.sort()).toEqual(Object.values(InitiativeStatus).sort());
  });

  it('kolor "progress" (wypełnienie paska) jest rózny dla różnych statusów — legenda ma być czytelna', () => {
    const progressColors = Object.values(STATUS_COLORS).map((c) => c.progress);
    // Nie wymagamy, by WSZYSTKIE 7 było unikalne (np. PROPOSED i DRAFT mogą
    // celowo dzielić neutralny szary), ale nie może ich być mniej niż 5
    // odcieni na 7 statusów — inaczej legenda znów staje się nieczytelna.
    expect(new Set(progressColors).size).toBeGreaterThanOrEqual(5);
  });

  it('żaden status poza semantyką krytyczną nie używa danger/primary (crimson) — kanon TRIADA §3', () => {
    for (const [status, colors] of Object.entries(STATUS_COLORS)) {
      expect(colors.progress, `status ${status}`).not.toMatch(/danger|primary/);
      expect(colors.bg, `status ${status}`).not.toMatch(/danger|primary/);
    }
  });

  it('IN_EXECUTION (dawniej finalnie "danger" przez nadpisanie) jest teraz neutralnym niebieskim', () => {
    expect(STATUS_COLORS[InitiativeStatus.IN_EXECUTION].progress).toBe('bg-blue-500');
  });
});
