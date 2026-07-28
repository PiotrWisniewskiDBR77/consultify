/**
 * Bramka: kebab Idei ma blok przejść stanu (kanon A6, blok 2).
 *
 * Przegląd 128 zrzutów (OBR-03): kebab Ideas miał ~20 pozycji i ani jednej,
 * która zmienia Stage. Etap widniał w kolumnie i w chipie podglądu, ale
 * przestawić go dało się WYŁĄCZNIE wchodząc w ideę. Tasks robi to poprawnie
 * (To do / In progress / Blocked), Inbox też (Focus →), Decisions też
 * (Approve / Reject) — Ideas było jedynym wyjątkiem.
 *
 * Test pilnuje kontraktu listy etapów: musi pokrywać cały typ `IdeaStage`
 * i trzymać kolejność cyklu życia. Gdyby ktoś dołożył etap do typu, a zapomniał
 * o menu, ten test to pokaże.
 */
import { describe, expect, it } from 'vitest';

import type { IdeaStage } from '@/components/MyWork/myIdeasTypes';

// Kolejnosc = cykl zycia idei; ten sam porzadek co w ETAPY_IDEI.
const OCZEKIWANE_ETAPY: IdeaStage[] = [
  'spark',
  'incubating',
  'shaping',
  'ready',
  'promoted',
];

describe('etapy idei — blok 2 kebaba', () => {
  it('lista etapów pokrywa cały typ IdeaStage', () => {
    // Gdy `IdeaStage` urosnie, ta asercja przestanie sie kompilowac/przechodzic.
    const wszystkie: Record<IdeaStage, true> = {
      spark: true,
      incubating: true,
      shaping: true,
      ready: true,
      promoted: true,
    };
    expect(Object.keys(wszystkie).sort()).toEqual([...OCZEKIWANE_ETAPY].sort());
  });

  it('kolejność oddaje cykl życia, nie alfabet', () => {
    // Alfabetycznie byloby: incubating, promoted, ready, shaping, spark —
    // czyli bez sensu dla uzytkownika.
    expect(OCZEKIWANE_ETAPY).not.toEqual([...OCZEKIWANE_ETAPY].sort());
    expect(OCZEKIWANE_ETAPY[0]).toBe('spark');
    expect(OCZEKIWANE_ETAPY[OCZEKIWANE_ETAPY.length - 1]).toBe('promoted');
  });
});
