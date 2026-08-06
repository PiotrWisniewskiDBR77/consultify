import { describe, expect, it } from 'vitest';

import {
  buildDeterministicTeresaSlides,
  extractPresentationGenerationOutline,
  extractRequestedPresentationTitle,
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

  it('materializes every accepted outline item without inventing facts', () => {
    const request = 'Use only: progress 72%; budget EUR 1.4m.';
    const slides = buildDeterministicTeresaSlides(
      [
        { intent: 'cover', title: 'Atlas update', keyMessage: 'Board update' },
        { intent: 'content', title: 'Budget' },
      ],
      request
    );

    expect(slides).toHaveLength(2);
    expect(slides[0]).toMatchObject({
      type: 'cover',
      content: { title: 'Atlas update', body: 'Board update' },
    });
    expect(slides[1]).toMatchObject({
      content: { title: 'Budget', body: `Source request: ${request}` },
    });
  });

  it('uses the explicit Title field instead of the truncated chat goal', () => {
    expect(
      extractRequestedPresentationTitle(
        'Create a deck. Title: Atlas Transformation Executive Update — E2E-20260806. Produce exactly 8 slides.'
      )
    ).toBe('Atlas Transformation Executive Update — E2E-20260806');
  });
});
