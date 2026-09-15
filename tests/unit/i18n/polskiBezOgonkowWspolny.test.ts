import { describe, expect, it } from 'vitest';

import { czyPolskiBezOgonkow } from './polskiBezOgonkowWspolny';

const FALSE_POSITIVES_W77 = [
  ['undo', 'Undo (Ctrl+Z)'],
  ['redo', 'Redo (Ctrl+Shift+Z)'],
  ['italic', 'Italic (Ctrl+I)'],
  ['right-size-a', 'W sam raz'],
  ['right-size-b', 'W sam raz'],
  ['with-ai-a', 'Z AI'],
  ['with-ai-b', 'Z AI'],
  ['kickoff-1', 'I want to begin with the current priorities'],
  ['kickoff-2', 'I want to review the evidence before deciding'],
  ['kickoff-3', 'I want to identify the next concrete action'],
  ['kickoff-4', 'I want to compare the available options'],
  ['kickoff-5', 'I want to understand what blocks progress'],
] as const;

describe('W77 / wspólny detektor polskiego bez ogonków', () => {
  it.each(FALSE_POSITIVES_W77)('%s nie jest dowodem polskiego: %s', (_id, value) => {
    expect(czyPolskiBezOgonkow(value)).toBe(false);
  });

  it('nadal wykrywa rzeczywisty polski tekst bez ogonków', () => {
    expect(czyPolskiBezOgonkow('Zapisz zmiany')).toBe(true);
  });
});
