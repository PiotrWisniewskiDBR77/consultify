/**
 * Group B (naprawa typów, 2026-08-10) — `ICON_BY_NAME` w
 * `src/components/MyWork/ideaCanvasMelsChips.ts` przestało być fałszywie
 * "pełnym" `Record<IconName, LucideIcon>` (miało tylko 13 z ~70 kluczy —
 * TS2740) i jest teraz jawnie `Partial<Record<IconName, LucideIcon>>` z
 * typowanym fallbackiem (`resolveMenu3Icon` → `MENU3_FALLBACK_ICON`).
 *
 * Dwa dowody, których wymaga naprawa:
 *   1. `resolveMenu3Icon` NIGDY nie zwraca `undefined`/`null` — brakująca
 *      ikona zawsze renderuje `MENU3_FALLBACK_ICON`, z widocznym ostrzeżeniem
 *      w konsoli (nie ciche nic).
 *   2. Dla REALNEGO rejestru akcji (`getActionsForSurface('menu3', …)`, po
 *      jednym przebiegu na narzędzie) `buildIdeaMenu3Actions` nigdy nie
 *      trafia na fallback dziś — każda z pięciu akcji `surfaces:['menu3']`
 *      ma wpis w `MENU3_PRESENTATION` — więc `console.warn` NIE woła się na
 *      żywym rejestrze. Ten test łapie regresję, gdyby ktoś dodał nową akcję
 *      `surfaces:['menu3']` bez dopisania jej do `MENU3_PRESENTATION` LUB
 *      `ICON_BY_NAME` — w takim wypadku pasek nadal pokaże ikonę (fallback),
 *      ale test niżej to wychwyci i każe świadomie dopisać wpis.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  buildIdeaMenu3Actions,
  resolveMenu3Icon,
} from '@/components/MyWork/ideaCanvasMelsChips';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

describe('resolveMenu3Icon — fallback jawny, nigdy cichy', () => {
  it('zwraca realną ikonę dla wartości obecnej w ICON_BY_NAME, bez ostrzeżenia', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const icon = resolveMenu3Icon('idea.element.add', 'Plus');
    // LucideIcon = ForwardRefExoticComponent — obiekt z $$typeof (Symbol.for('react.forward_ref')),
    // nie zwykła funkcja; `toBeTruthy` + kształt renderowalnego komponentu.
    expect(icon).toBeTruthy();
    expect(typeof icon).toBe('object');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('dla IconName SPOZA ICON_BY_NAME zwraca ikonę zapasową (nigdy undefined) i loguje ostrzeżenie', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 'Layers' jest w unii IconName (rejestr), ale NIE w ICON_BY_NAME (mapa Menu 3) —
    // dokładnie przypadek, który wcześniej łamał kompletność Record<IconName, …>.
    const icon = resolveMenu3Icon('idea.hipotetyczna.akcja', 'Layers');
    expect(icon).toBeDefined();
    expect(icon).toBeTruthy();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Layers');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('idea.hipotetyczna.akcja');
    warnSpy.mockRestore();
  });

  it('sprawdza WSZYSTKIE ~70 wartości IconName — każda albo trafia w ICON_BY_NAME, albo dostaje fallback bez rzucania wyjątku', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Zamknięta lista wartości IconName spoza ICON_BY_NAME (menu kontekstowe/
    // toolbar/panel/rail — poza domeną Menu 3) — reprezentatywna próbka z
    // różnych fal (N5/N6/N7/N10 + Group B), nie cała unia (utrzymanie 1:1 z
    // rejestrem przy każdej zmianie byłoby kruche); cel testu to udowodnić, że
    // ŻADNA z nich nie rzuca i nie zwraca falsy.
    const spozaMapy: Array<Parameters<typeof resolveMenu3Icon>[1]> = [
      'Trash2',
      'ClipboardPaste',
      'FileText',
      'Globe',
      'UserPlus',
      'Share2',
      'Trophy',
      'Presentation',
      'Mic',
      'Flame',
      'Boxes',
      'Save',
    ];
    for (const iconName of spozaMapy) {
      const icon = resolveMenu3Icon('test-action', iconName);
      expect(icon, `icon dla '${iconName}' nie może być falsy`).toBeTruthy();
    }
    warnSpy.mockRestore();
  });
});

describe('buildIdeaMenu3Actions — realny rejestr nigdy nie trafia w fallback dziś', () => {
  it.each(['mindmap', 'whiteboard', 'process_flow', 'table'] as const)(
    'każda pozycja Menu 3 narzędzia %s ma zdefiniowaną ikonę, zero console.warn',
    (tool) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { left, right } = buildIdeaMenu3Actions({
        tool,
        hasContent: true,
        isPolish: true,
        ideaId: 'idea-1',
        selection: EMPTY_SELECTION,
      });

      for (const action of [...left, ...right]) {
        expect(action.icon, `akcja '${action.id}' musi mieć ikonę`).toBeTruthy();
      }
      // Dowód na dziś: rejestr nie ma jeszcze żadnej akcji surfaces:['menu3']
      // bez wpisu w MENU3_PRESENTATION, więc fallback (i jego console.warn)
      // nie jest wołany na żywym rejestrze.
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    }
  );
});
