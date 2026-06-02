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

  it('returns null for ordinary chat that is not a write-into-doc request', () => {
    expect(detectCanvasWriteIntent('what do you think about this?')).toBeNull();
    expect(detectCanvasWriteIntent('jak oceniasz ten pomysł?')).toBeNull();
    expect(detectCanvasWriteIntent('')).toBeNull();
    expect(detectCanvasWriteIntent('summarize the meeting in chat please')).toBeNull();
  });
});
