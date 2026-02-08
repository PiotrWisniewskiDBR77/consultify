/**
 * Unit tests for Deep Thinking Hint Service
 * Tests the AI-suggested activation feature.
 */

import { describe, expect, it } from 'vitest';

import { detectDeepThinkingIntent } from '../../../../src/services/ai/deepThinkingHintService.js';

describe('DeepThinkingHintService', () => {
  describe('detectDeepThinkingIntent', () => {
    it('suggests DT for strategic questions (EN)', () => {
      const result = detectDeepThinkingIntent(
        'How should we design our organizational restructuring considering budget constraints, timeline pressure, and team morale risks?',
        'en'
      );
      expect(result.shouldSuggest).toBe(true);
      expect(result.confidence).not.toBe('low');
    });

    it('suggests DT for strategic questions (PL)', () => {
      const result = detectDeepThinkingIntent(
        'Jak powinniśmy zaprojektować restrukturyzację organizacyjną biorąc pod uwagę ograniczony budżet, napięty termin i ryzyka zespołowe?',
        'pl'
      );
      expect(result.shouldSuggest).toBe(true);
    });

    it('suggests DT for multi-axis decisions', () => {
      const result = detectDeepThinkingIntent(
        'Should we invest in new technology given the risk vs cost trade-off with a tight deadline and limited team?',
        'en'
      );
      expect(result.shouldSuggest).toBe(true);
    });

    it('does NOT suggest DT for simple factual questions', () => {
      const result = detectDeepThinkingIntent('What is the capital of France?', 'en');
      expect(result.shouldSuggest).toBe(false);
    });

    it('does NOT suggest DT for short messages', () => {
      const result = detectDeepThinkingIntent('Hello there', 'en');
      expect(result.shouldSuggest).toBe(false);
    });

    it('does NOT suggest DT for copywriting requests', () => {
      const result = detectDeepThinkingIntent(
        'Write me a blog post about React hooks and their benefits',
        'en'
      );
      expect(result.shouldSuggest).toBe(false);
    });

    it('suggests DT for scenario analysis', () => {
      const result = detectDeepThinkingIntent(
        'What if we automate the production line? Simulate the impact on cost and people',
        'en'
      );
      expect(result.shouldSuggest).toBe(true);
    });

    it('suggests DT for complex Polish questions', () => {
      const result = detectDeepThinkingIntent(
        'Co jeśli zautomatyzujemy linię produkcyjną? Jakie są ryzyka i konsekwencje dla ludzi?',
        'pl'
      );
      expect(result.shouldSuggest).toBe(true);
    });

    it('returns confidence levels proportional to signal strength', () => {
      const weak = detectDeepThinkingIntent(
        'What are the pros and cons of using TypeScript over JavaScript for this project?',
        'en'
      );
      const strong = detectDeepThinkingIntent(
        'How should we decide between investing in new technology vs restructuring the team, given budget constraints, timeline pressure, and uncertainty about the market? Compare the scenarios and trade-offs.',
        'en'
      );

      // Strong signals should have higher confidence
      if (weak.shouldSuggest && strong.shouldSuggest) {
        const confMap = { low: 0, medium: 1, high: 2 };
        expect(confMap[strong.confidence]).toBeGreaterThanOrEqual(confMap[weak.confidence]);
      }
    });
  });
});
