import { describe, expect, it } from 'vitest';
import {
  IN_CONTEXT_ITEM_TYPES,
  NAVIGATE_ITEM_TYPES,
  resolveOpenItemRoute,
} from '../../src/components/MyWork/openItemRouting';
import { UKRYTE_DEC406 } from '../../src/components/MyWork/mojaPracaWidocznosc';

/**
 * DP-2 "global IDE-tabs doc" contract — guards the SSOT used by the MyWorkHub
 * `mywork-open-item` handler and the calendar `onInitiativeClick` wiring,
 * without mounting the ~9k-line component.
 *
 * ★ DEC-406 (CTO, 2026-09-06) ODWRACA CZĘŚĆ TEGO KONTRAKTU DLA INICJATYWY.
 * Do 06.09 inicjatywa otwierała się IN-CONTEXT (M03 L-08 / M13 L-07) — i tym
 * samym trafiała na stary warsztat `Initiatives/InitiativeFullView.tsx`
 * (stepper ŹRÓDŁO — PRZEGLĄD — PLANOWANIE — REALIZACJA — KORZYŚCI, „Zatwierdź /
 * Anuluj"), a nie na zaakceptowaną przez właściciela kanoniczną kartę
 * `InitiativeDocumentView`. Słowo właściciela: „nie wiem, co to za ekran".
 * Od DEC-406 inicjatywa z Mojej Pracy ZAWSZE nawiguje do modułu Inicjatywy.
 * Asercje „in-context dla inicjatywy" zostały tu ZAKTUALIZOWANE, nie usunięte.
 */
describe('mywork-open-item routing (DP-2, po DEC-406)', () => {
  it('DEC-406: inicjatywa NAWIGUJE do własnego modułu, nie otwiera się in-context', () => {
    expect(resolveOpenItemRoute('initiative')).toBe('navigate');
  });

  it('DEC-406: stała ukrycia warsztatu inicjatywy jest włączona (jedno miejsce)', () => {
    expect(UKRYTE_DEC406.warsztatInicjatywy).toBe(true);
  });

  it('keeps task/decision/idea/notification/notebook in-context (unchanged)', () => {
    for (const type of ['task', 'decision', 'idea', 'notification', 'notebook']) {
      expect(resolveOpenItemRoute(type)).toBe('in-context');
    }
  });

  it('still navigates heavy artifact types away from My Work', () => {
    for (const type of [
      'report',
      'presentation',
      'budget',
      'valuation',
      'financial_model',
      'analysis',
      'assessment',
      'meeting',
      'tool',
    ]) {
      expect(resolveOpenItemRoute(type)).toBe('navigate');
    }
  });

  it('DEC-406: initiative nie jest już w zbiorze in-context', () => {
    expect(IN_CONTEXT_ITEM_TYPES as readonly string[]).not.toContain('initiative');
  });

  it('the two route sets do not overlap', () => {
    const navSet = new Set<string>(NAVIGATE_ITEM_TYPES);
    for (const type of IN_CONTEXT_ITEM_TYPES) {
      expect(navSet.has(type)).toBe(false);
    }
  });

  it('unknown types default to in-context (safe: stay in My Work)', () => {
    expect(resolveOpenItemRoute('totally-unknown-type')).toBe('in-context');
  });
});
