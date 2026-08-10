/**
 * Targeted tests for `deckDocumentFromUnifiedJson` (Sprint S16).
 *
 * Scope: validate that `UnifiedSlide.auditFlags` (introduced by S15)
 * is correctly propagated to `DeckDocumentCard.audit_flags` so the
 * PDF renderer (S16) can read flags off the persisted deck without
 * re-running the layout audit. Closes the data path needed for
 * R-S15-1 (PDF parity).
 */

import { describe, expect, it } from 'vitest';

import { deckDocumentFromUnifiedJson } from '../presentationDeckDocumentService.js';
import type { UnifiedReportJSON, UnifiedSlide } from '../report/pptx/types.js';

function makeUnifiedJson(slides: UnifiedSlide[]): UnifiedReportJSON {
  return {
    meta: {
      project: 'Test deck',
      client: 'Test client',
      template: 'corporate',
      language: 'en',
      confidentiality: 'internal',
    } as any,
    slides,
  } as UnifiedReportJSON;
}

const baseSlide = (overrides: Partial<UnifiedSlide>): UnifiedSlide => ({
  intent: 'cover',
  key_message: 'Headline',
  content: { title: 'Title' } as any,
  ...overrides,
});

describe('deckDocumentFromUnifiedJson — audit flag propagation (S16)', () => {
  it('omits audit_flags on cards whose UnifiedSlide carries no flags', () => {
    const doc = deckDocumentFromUnifiedJson({
      deckId: 'deck-1',
      organizationId: 'org-1',
      title: 'Test',
      unifiedJson: makeUnifiedJson([baseSlide({})]),
    });
    expect(doc.cards[0].audit_flags).toBeUndefined();
  });

  it('copies recognized audit flags from the slide onto the card', () => {
    const doc = deckDocumentFromUnifiedJson({
      deckId: 'deck-1',
      organizationId: 'org-1',
      title: 'Test',
      unifiedJson: makeUnifiedJson([
        baseSlide({
          auditFlags: ['layout_overflow_title', 'missing_source_for_evidence_intent'],
        }),
      ]),
    });
    expect(doc.cards[0].audit_flags).toEqual([
      'layout_overflow_title',
      'missing_source_for_evidence_intent',
    ]);
  });

  it('drops non-string entries defensively but keeps recognized strings', () => {
    const doc = deckDocumentFromUnifiedJson({
      deckId: 'deck-1',
      organizationId: 'org-1',
      title: 'Test',
      unifiedJson: makeUnifiedJson([
        baseSlide({
          auditFlags: [
            'layout_overflow_blocks',
            null as unknown as string,
            42 as unknown as string,
            '',
            'missing_source_for_evidence_intent',
          ],
        }),
      ]),
    });
    expect(doc.cards[0].audit_flags).toEqual([
      'layout_overflow_blocks',
      'missing_source_for_evidence_intent',
    ]);
  });

  it('omits audit_flags when slide.auditFlags is set to an empty array', () => {
    const doc = deckDocumentFromUnifiedJson({
      deckId: 'deck-1',
      organizationId: 'org-1',
      title: 'Test',
      unifiedJson: makeUnifiedJson([baseSlide({ auditFlags: [] })]),
    });
    expect(doc.cards[0].audit_flags).toBeUndefined();
  });

  it('handles a mix of slides — only slides with flags receive the field', () => {
    const doc = deckDocumentFromUnifiedJson({
      deckId: 'deck-1',
      organizationId: 'org-1',
      title: 'Test',
      unifiedJson: makeUnifiedJson([
        baseSlide({}),
        baseSlide({ auditFlags: ['layout_overflow_title'] }),
        baseSlide({}),
      ]),
    });
    expect(doc.cards[0].audit_flags).toBeUndefined();
    expect(doc.cards[1].audit_flags).toEqual(['layout_overflow_title']);
    expect(doc.cards[2].audit_flags).toBeUndefined();
  });
});
