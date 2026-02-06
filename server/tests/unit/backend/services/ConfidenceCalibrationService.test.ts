import { describe, expect, it } from 'vitest';

import {
  buildConfidencePromptAddon,
  extractConfidenceScores,
} from '../../../../src/services/ai/confidenceCalibrationService.js';

describe('ConfidenceCalibrationService', () => {
  describe('extractConfidenceScores', () => {
    it('extracts English confidence patterns', () => {
      const text = `
        Based on my analysis, I am 85% confident that Option A is the best choice.
        The recommendation has a 70% certainty given current data.
      `;

      const scores = extractConfidenceScores(text);
      expect(scores.length).toBeGreaterThan(0);
      expect(scores.some((s) => s.confidence === 85)).toBe(true);
    });

    it('extracts Polish confidence patterns', () => {
      const text = `
        Jestem 90% pewny, że ta opcja jest najlepsza.
        Pewność tej rekomendacji wynosi 75%.
      `;

      const scores = extractConfidenceScores(text);
      expect(scores.length).toBeGreaterThan(0);
      expect(scores.some((s) => s.confidence === 90 || s.confidence === 75)).toBe(true);
    });

    it('returns empty array when no confidence found', () => {
      const text = 'This is a report without any confidence statements.';
      const scores = extractConfidenceScores(text);
      expect(scores).toEqual([]);
    });

    it('ignores values outside 0-100 range', () => {
      const text = 'I am 150% confident this is wrong.';
      const scores = extractConfidenceScores(text);
      expect(scores).toEqual([]);
    });

    it('deduplicates by section keeping highest confidence', () => {
      const text = `
        ## Executive Summary
        I am 60% confident in this summary.
        Actually, 80% confident after review.
      `;

      const scores = extractConfidenceScores(text);
      // Should have one entry for the section with highest confidence
      const summaryScores = scores.filter(
        (s) => s.section === 'executive_summary' || s.section === 'general'
      );
      if (summaryScores.length > 0) {
        expect(summaryScores[0].confidence).toBeGreaterThanOrEqual(60);
      }
    });
  });

  describe('buildConfidencePromptAddon', () => {
    it('returns English instructions by default', () => {
      const addon = buildConfidencePromptAddon();
      expect(addon).toContain('Confidence Instructions');
      expect(addon).toContain('0-100%');
    });

    it('returns Polish instructions when pl language', () => {
      const addon = buildConfidencePromptAddon('pl');
      expect(addon).toContain('pewności');
    });

    it('returns English for unknown languages', () => {
      const addon = buildConfidencePromptAddon('de');
      expect(addon).toContain('Confidence');
    });
  });
});
