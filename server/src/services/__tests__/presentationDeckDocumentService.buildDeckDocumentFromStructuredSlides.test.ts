import { describe, expect, it } from 'vitest';

import {
  buildDeckDocumentFromStructuredSlides,
  normalizeDeckDocument,
} from '../presentationDeckDocumentService';

/**
 * MAT-007/009 — root-cause regression test.
 *
 * Incident: `POST /decks` and `POST /decks/from-template`
 * (server/src/routes/presentations.routes.ts) wrote an accurate
 * `slide_count` onto `presentation_decks` but persisted the actual slide
 * content only into the never-read `presentation_cards` table, leaving
 * `deck_json`/`unified_json` NULL. `GET /decks/:id` -> normalizeDeckDocument
 * then returned null content, and the DeckBuilder rendered an empty deck
 * ("Card 1 of 0") even though the list correctly reported the deck as
 * "Ready" with N slides. See
 * docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MAT-006B_PRESENTATION_LIFECYCLE_E2E.md.
 *
 * These tests pin the contract of buildDeckDocumentFromStructuredSlides()
 * (the fix) and of the row shape the two routes now persist: deck_json
 * must round-trip through normalizeDeckDocument with cards.length exactly
 * matching the slide count that was requested.
 */
describe('presentationDeckDocumentService.buildDeckDocumentFromStructuredSlides', () => {
  it('produces exactly one canonical card per input slide (11-slide MAT-006B repro shape)', () => {
    const slides = [
      { type: 'title', content: { title: 'Line 3 Digital Twin — Steering Committee Deck', subtitle: 'Proof' } },
      ...Array.from({ length: 9 }, (_, i) => ({
        type: 'content',
        content: { title: `Section ${i + 1}`, body: `Body ${i + 1}`, items: ['a', 'b'] },
      })),
      { type: 'next_steps', content: { title: 'Next steps', body: 'Wrap up' } },
    ];

    const deckDocument = buildDeckDocumentFromStructuredSlides({
      deckId: 'deck_mat007',
      organizationId: 'org_mat007',
      title: 'Line 3 Digital Twin — Steering Committee Deck',
      slides,
      status: 'draft',
    });

    expect(deckDocument.schemaVersion).toBe(1);
    expect(deckDocument.cards).toHaveLength(11);
    expect(deckDocument.cards[0].title).toBe('Line 3 Digital Twin — Steering Committee Deck');
    expect(deckDocument.cards[0].blocks.length).toBeGreaterThan(0);
    expect(deckDocument.cards[1].title).toBe('Section 1');
  });

  it('round-trips through normalizeDeckDocument (the exact function GET /decks/:id calls) without losing cards', () => {
    const slides = [
      { type: 'title', content: { title: 'Deck', subtitle: 'Sub' } },
      { type: 'content', content: { title: 'Slide 2', body: 'Body 2' } },
    ];
    const deckDocument = buildDeckDocumentFromStructuredSlides({
      deckId: 'deck_mat007_2',
      organizationId: 'org_mat007',
      title: 'Deck',
      slides,
      status: 'draft',
    });

    // Simulate the presentation_decks row exactly as POST /decks now inserts it:
    // deck_json is the JSON.stringify()'d canonical document, slide_count matches.
    const row = {
      id: 'deck_mat007_2',
      organization_id: 'org_mat007',
      title: 'Deck',
      status: 'draft',
      slide_count: slides.length,
      deck_json: JSON.stringify(deckDocument),
      unified_json: null,
      outline_json: null,
      source_artifacts: null,
      source_refs_json: null,
      export_path: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    };

    const normalized = normalizeDeckDocument(row);
    expect(normalized).not.toBeNull();
    expect(normalized!.cards).toHaveLength(row.slide_count);
    expect(normalized!.cards.length).toBe(2);
    // This is exactly what DeckBuilder.tsx checks before showing the "no
    // content yet" empty-shell fallback (Array.isArray(deckJson.cards)):
    expect(Array.isArray(normalized!.cards)).toBe(true);
  });

  it('handles the from-template nested content.blocks shape (mapOutlineBlueprintToDeckSlides output) without duplicating the heading', () => {
    const slides = [
      {
        type: 'executive_summary',
        content: {
          title: 'Executive Summary',
          intent: 'executive_summary',
          blocks: [
            { type: 'heading', content: 'Executive Summary' },
            { type: 'text', content: 'Key message from template' },
          ],
        },
      },
    ];
    const deckDocument = buildDeckDocumentFromStructuredSlides({
      deckId: 'deck_mat007_3',
      organizationId: 'org_mat007',
      title: 'From template',
      slides,
      status: 'draft',
    });

    expect(deckDocument.cards).toHaveLength(1);
    const card = deckDocument.cards[0];
    expect(card.blocks).toHaveLength(2);
    expect(card.blocks[0].type).toBe('heading');
    expect(card.blocks[0].content.text).toBe('Executive Summary');
    expect(card.blocks[1].type).toBe('paragraph');
    expect(card.blocks[1].content.text).toBe('Key message from template');
  });

  it('never produces an empty cards array for a non-empty slide input (the MAT-006B symptom)', () => {
    const slides = [{ type: 'content', content: {} }];
    const deckDocument = buildDeckDocumentFromStructuredSlides({
      deckId: 'deck_mat007_4',
      organizationId: 'org_mat007',
      title: 'Edge case: empty content object',
      slides,
      status: 'draft',
    });
    expect(deckDocument.cards).toHaveLength(1);
    // Even with no title/body/items, the card still carries at least a
    // heading block (falls back to "Slide 1") — it never resolves to zero
    // blocks/zero cards for a slide that was actually requested.
    expect(deckDocument.cards[0].blocks.length).toBeGreaterThan(0);
  });
});
