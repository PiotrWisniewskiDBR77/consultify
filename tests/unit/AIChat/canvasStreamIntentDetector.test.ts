import { describe, expect, it } from 'vitest';

import { detectCanvasWriteIntent } from '@/components/AIChat/canvasStreamIntentDetector';

describe('detectCanvasWriteIntent', () => {
  it('detects English append/write-into-document intents', () => {
    expect(detectCanvasWriteIntent('write this in the document')).toBe('append');
    expect(detectCanvasWriteIntent('draft a section about pricing')).toBe('append');
    expect(detectCanvasWriteIntent('continue the document for me')).toBe('append');
  });

  it('detects Polish append intents', () => {
    expect(detectCanvasWriteIntent('napisz w dokumencie wstęp')).toBe('append');
    expect(detectCanvasWriteIntent('dopisz do dokumentu podsumowanie')).toBe('append');
    expect(detectCanvasWriteIntent('przygotuj raport o ryzykach')).toBe('append');
  });

  it('detects replace-selection intents (EN + PL)', () => {
    expect(detectCanvasWriteIntent('rewrite this selection')).toBe('replace');
    expect(detectCanvasWriteIntent('przepisz ten fragment')).toBe('replace');
  });

  // B3 — patch-mode: edit verb + target noun + locator (ordinal / number /
  // quoted or proper name) → surgical patch instead of a full rewrite.
  it('detects targeted patch instructions (PL)', () => {
    expect(detectCanvasWriteIntent('zmień tytuł sekcji 2 na Strategia')).toBe('patch');
    expect(detectCanvasWriteIntent('popraw drugi akapit sekcji Finanse')).toBe('patch');
    expect(detectCanvasWriteIntent('przepisz nagłówek „Wprowadzenie”')).toBe('patch');
  });

  it('detects targeted patch instructions (EN)', () => {
    expect(detectCanvasWriteIntent('change the title of section 2 to Strategy')).toBe('patch');
    expect(detectCanvasWriteIntent('rewrite the second paragraph')).toBe('patch');
    expect(detectCanvasWriteIntent('fix the heading "Overview"')).toBe('patch');
  });

  it('stays conservative: target without a locator falls back to existing modes', () => {
    // No ordinal/number/name → existing replace handling, not patch.
    expect(detectCanvasWriteIntent('rewrite this selection')).toBe('replace');
    expect(detectCanvasWriteIntent('przepisz ten fragment')).toBe('replace');
    expect(detectCanvasWriteIntent('zmień sekcję')).toBe('replace');
  });

  it('returns null for ordinary chat that is not a write-into-doc request', () => {
    expect(detectCanvasWriteIntent('what do you think about this?')).toBeNull();
    expect(detectCanvasWriteIntent('jak oceniasz ten pomysł?')).toBeNull();
    expect(detectCanvasWriteIntent('')).toBeNull();
    expect(detectCanvasWriteIntent('summarize the meeting in chat please')).toBeNull();
  });
});

// ── 1.1-A (06.09) — defekt właściciela: „Zrob mi plan w okni obok" ──────
// PRZED naprawą detektor zwracał `null`, wiadomość szła na backend, regex
// Teresy trafiał w słowo „plan" i tworzył propozycję `Initiatives · create`
// (zmierzone: evidence/1-1-a/pomiar-przed.json). Te asercje są bramką na tej
// ścieżce — patrz też `tests/unit/AIChat/documentIntentRouting.test.ts`,
// gdzie ten sam tekst jest sprawdzany PRZECIW klasyfikatorowi inicjatyw.
describe('detectCanvasWriteIntent — prośba o treść do dokumentu obok (1.1-A)', () => {
  it('łapie prośbę właściciela słowo w słowo (z literówką „w okni obok")', () => {
    expect(detectCanvasWriteIntent('Zrob mi plan w okni obok')).toBe('append');
  });

  it('łapie warianty wskazania miejsca', () => {
    expect(detectCanvasWriteIntent('Zrób mi plan w oknie obok')).toBe('append');
    expect(detectCanvasWriteIntent('zrób plan w dokumencie obok')).toBe('append');
    expect(detectCanvasWriteIntent('napisz to tutaj')).toBe('append');
    expect(detectCanvasWriteIntent('przygotuj agendę obok')).toBe('append');
  });

  it('łapie prośbę o wytwór, gdy dokument obok jest otwarty', () => {
    // Detektor jest wołany WYŁĄCZNIE przy otwartym dokumencie
    // (`activeCanvasDocument &&` w UnifiedChatPanel), więc „zrób mi plan"
    // znaczy tam „w tym dokumencie".
    expect(detectCanvasWriteIntent('zrób mi plan wdrożenia')).toBe('append');
    expect(detectCanvasWriteIntent('opracuj harmonogram')).toBe('append');
  });

  it('nadal NIE łapie zwykłej rozmowy (bez czasownika wytwórczego)', () => {
    expect(detectCanvasWriteIntent('jaki mamy plan na jutro?')).toBeNull();
    expect(detectCanvasWriteIntent('co sądzisz o tym planie?')).toBeNull();
    expect(detectCanvasWriteIntent('summarize the meeting in chat please')).toBeNull();
  });

  it('nie wyprzedza trybów patch/replace (kolejność reguł)', () => {
    // Obie frazy mają czasownik wytwórczy w pobliżu, ale węższe reguły muszą
    // wygrać — inaczej B3 (patch anchorowany) przestałby działać.
    expect(detectCanvasWriteIntent('zmień tytuł sekcji 2 na Strategia')).toBe('patch');
    expect(detectCanvasWriteIntent('przepisz ten fragment')).toBe('replace');
  });
});
