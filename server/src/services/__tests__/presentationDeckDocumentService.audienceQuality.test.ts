import { describe, expect, it } from 'vitest';

import {
  deckDocumentFromUnifiedJson,
  normalizeAudienceFacingSlide,
} from '../presentationDeckDocumentService';

const source = {
  artifact_id: 'initiative-42',
  artifact_type: 'initiative',
  artifact_name: 'Transformation North Star',
};

describe('presentation deck audience-quality contract', () => {
  it('moves producer-facing source copy off the cover and repairs a generic title', () => {
    const slide = normalizeAudienceFacingSlide(
      {
        intent: 'cover',
        key_message: 'Source: Teresa user request; approved budget EUR 1.4m',
        content: { type: 'cover', title: 'Cover', subtitle: 'Źródło: internal prompt' },
      } as any,
      'Board decision: Horizon modernization',
      [source]
    );

    expect((slide.content as any).title).toBe('Board decision: Horizon modernization');
    expect(slide.key_message).toBe('Board decision: Horizon modernization');
    expect((slide.content as any).subtitle).toBeUndefined();
    expect(String((slide as any).speaker_notes)).toContain('[Sources]');
    expect(String((slide as any).speaker_notes)).toContain('Transformation North Star');
  });

  it('materializes a demanding 8-slide deck through diverse professional viewer layouts', () => {
    const intents = [
      'cover',
      'executive_summary',
      'performance_overview',
      'initiative_portfolio',
      'prioritization_matrix',
      'roadmap',
      'risk_management',
      'next_steps',
    ];
    const slides = intents.map((intent, index) => ({
      intent,
      key_message: index === 0 ? 'Source: Teresa user request' : `Decision message ${index}`,
      content:
        index === 0
          ? { type: 'cover', title: 'Cover' }
          : { type: intent, title: `Slide ${index + 1}`, actions: [], risks: [], phases: [] },
      source_refs: [source],
    }));

    const deck = deckDocumentFromUnifiedJson({
      deckId: 'deck-professional-8',
      organizationId: 'org-1',
      title: 'Board decision: Horizon modernization',
      unifiedJson: {
        meta: { language: 'en', project: 'Horizon', client: 'Consultify' },
        slides,
      } as any,
      sourceRefs: [source],
      setup: { templateFamily: 'Board Decision Deck', audience: 'executive' },
    });

    expect(deck.cards).toHaveLength(8);
    expect(new Set(deck.cards.map((card) => card.layout_id)).size).toBeGreaterThanOrEqual(7);
    const visible = deck.cards
      .flatMap((card) => [card.title, card.key_message, ...card.blocks.map((b) => JSON.stringify(b.content))])
      .join('\n');
    expect(visible).not.toMatch(/(?:^|\n)\s*(?:Source|Sources|Źródło|Źródła)\s*:/i);
    expect(deck.cards[0].speaker_notes).toContain('[Sources]');
    expect(deck.traceability.sourceRefs).toHaveLength(1);
  });
});
