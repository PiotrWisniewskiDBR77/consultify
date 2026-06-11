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
