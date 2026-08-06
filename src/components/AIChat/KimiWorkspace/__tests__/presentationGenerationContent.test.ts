import { describe, expect, it } from 'vitest';

import {
  extractPresentationGenerationOutline,
  hasRenderablePresentationContent,
} from '../useKimiArtifactPipeline';

describe('Teresa presentation generation content contract', () => {
  it('does not treat truthy empty JSON as generated slide content', () => {
    expect(hasRenderablePresentationContent({ deck_json: '{}' })).toBe(false);
    expect(hasRenderablePresentationContent({ deck_json: '{"cards":[]}' })).toBe(false);
    expect(hasRenderablePresentationContent({ unified_json: { slides: [] } })).toBe(false);
  });

  it('recognizes both canonical cards and legacy slides', () => {
    expect(hasRenderablePresentationContent({ deck_json: '{"cards":[{"id":"c1"}]}' })).toBe(true);
    expect(hasRenderablePresentationContent({ unified_json: { slides: [{ id: 's1' }] } })).toBe(
      true
    );
  });

  it('extracts the nested outline envelope returned by GET /decks/:id', () => {
    const outline = Array.from({ length: 8 }, (_, index) => ({
      intent: index === 0 ? 'cover' : 'content',
      title: `Slide ${index + 1}`,
      enabled: true,
    }));

    expect(extractPresentationGenerationOutline({ outline_json: { outline } })).toEqual(outline);
    expect(
      extractPresentationGenerationOutline({ outline_json: JSON.stringify({ outline }) })
    ).toEqual(outline);
  });

  it('preserves legacy bare-array outlines', () => {
    const outline = [{ intent: 'cover', title: 'Cover', enabled: true }];
    expect(extractPresentationGenerationOutline({ outline_json: outline })).toEqual(outline);
  });
});
