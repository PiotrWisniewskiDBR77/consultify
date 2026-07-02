/**
 * Deck typography tokens (beat-Gamma, Fala 3).
 * Guards that the PPTX pipeline no longer ships the "Office template" Calibri
 * defaults and uses the curated premium library across all themes.
 */
import { describe, expect, it } from 'vitest';

import { getDesignTokens } from '../../../server/src/services/report/pptx/designTokens.js';

describe('Deck font tokens — premium (Fala 3)', () => {
  for (const theme of ['corporate', 'minimal', 'modern'] as const) {
    it(`${theme} theme uses a non-Calibri premium title + body font`, () => {
      const t = getDesignTokens(theme);
      expect(t.fonts.title.toLowerCase()).not.toContain('calibri');
      expect(t.fonts.body.toLowerCase()).not.toContain('calibri');
      expect(t.fonts.title.length).toBeGreaterThan(0);
      expect(t.fonts.body.length).toBeGreaterThan(0);
    });
  }
});
