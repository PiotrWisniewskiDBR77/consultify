import { describe, expect, it } from 'vitest';

import { sanitizeDeckDisplayText } from '../deckTextSanitizer';

describe('sanitizeDeckDisplayText', () => {
  it('does not expose producer-facing source lines on the canvas', () => {
    expect(
      sanitizeDeckDisplayText(
        'Source: Teresa user request; approved budget EUR 1.4m\nBoard approval is required.'
      )
    ).toBe('Board approval is required.');
    expect(sanitizeDeckDisplayText('Źródło: kontekst inicjatywy')).toBe('');
  });
});
