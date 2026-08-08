import { describe, expect, it } from 'vitest';

import { detectTransformationPlanIntent } from '../transformationIntentDetector';

describe('detectTransformationPlanIntent', () => {
  it.each([
    'Hej Teresa, przygotuj plan transformacji dla naszej organizacji',
    'Opracuj pełny plan transformacji operacyjnej',
    'Prepare a transformation plan for this company',
  ])('recognises an explicit plan command: %s', (message) => {
    expect(detectTransformationPlanIntent(message)).toBe(true);
  });

  it.each([
    'Porozmawiajmy o transformacji',
    'Jak działa planowanie?',
    'Podsumuj transformację cyfrową w Europie',
    '',
  ])('does not hijack ordinary chat: %s', (message) => {
    expect(detectTransformationPlanIntent(message)).toBe(false);
  });
});
