// @vitest-environment node
/**
 * Unit tests — materialFeedbackLoop (F10.4)
 *
 * FL-1: extractRecommendations (list items in reco sections + cued prose)
 * FL-2: toInitiativeStubs (title, back-ref, dedupe)
 * FL-3: end-to-end materialToInitiativeStubs
 */

import { describe, expect, it } from 'vitest';
import {
  extractRecommendations,
  toInitiativeStubs,
  materialToInitiativeStubs,
} from '../../../server/src/services/deliverables/materialFeedbackLoop.js';

const SECTIONS = [
  { intent: 'context', title: 'Kontekst', text: 'Firma rośnie. Rynek jest duży.' },
  {
    intent: 'recommendations',
    title: 'Rekomendacje',
    items: ['Powołać AI Ownera w Q3', 'Zautomatyzować raportowanie miesięczne'],
  },
  {
    intent: 'findings',
    title: 'Wyniki',
    text: 'Dane są rozproszone. Należy skonsolidować hurtownię danych w 60 dni.',
  },
];

describe('materialFeedbackLoop', () => {
  // ── FL-1 ──
  it('FL-1.1: pulls all items from a recommendations section', () => {
    const recos = extractRecommendations(SECTIONS);
    const texts = recos.map((r) => r.text);
    expect(texts).toContain('Powołać AI Ownera w Q3');
    expect(texts).toContain('Zautomatyzować raportowanie miesięczne');
  });

  it('FL-1.2: pulls cued sentences from non-reco prose (Należy…)', () => {
    const recos = extractRecommendations(SECTIONS);
    const texts = recos.map((r) => r.text);
    expect(texts.some((t) => t.startsWith('Należy skonsolidować'))).toBe(true);
    // non-cued prose ignored
    expect(texts.some((t) => t.includes('Firma rośnie'))).toBe(false);
  });

  it('FL-1.3: sourceSection carried through', () => {
    const recos = extractRecommendations(SECTIONS);
    const reco = recos.find((r) => r.text.includes('AI Ownera'));
    expect(reco?.sourceSection).toBe('Rekomendacje');
  });

  // ── FL-2 ──
  it('FL-2.1: stubs carry title, description, status=proposed, back-ref', () => {
    const recos = extractRecommendations(SECTIONS);
    const stubs = toInitiativeStubs(recos, 'mat-123');
    expect(stubs.length).toBeGreaterThanOrEqual(3);
    for (const s of stubs) {
      expect(s.status).toBe('proposed');
      expect(s.sourceMaterialId).toBe('mat-123');
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.title.length).toBeLessThanOrEqual(80);
    }
  });

  it('FL-2.2: title is the first clause, truncated ≤80 with ellipsis', () => {
    const long = 'Zbudować zintegrowaną platformę danych obejmującą wszystkie działy firmy oraz wdrożyć governance i polityki dostępu na poziomie enterprise dla pełnej zgodności';
    const stubs = toInitiativeStubs([{ text: long }], 'm1');
    expect(stubs[0].title.length).toBeLessThanOrEqual(80);
    expect(stubs[0].description).toBe(long); // full text preserved
  });

  it('FL-2.3: dedupes identical recommendations', () => {
    const stubs = toInitiativeStubs(
      [{ text: 'Powołać AI Ownera' }, { text: 'Powołać AI Ownera' }],
      'm1'
    );
    expect(stubs).toHaveLength(1);
  });

  // ── FL-3 ──
  it('FL-3.1: end-to-end material → initiative stubs', () => {
    const stubs = materialToInitiativeStubs(SECTIONS, 'deck-7');
    expect(stubs.length).toBeGreaterThanOrEqual(3);
    expect(stubs.every((s) => s.sourceMaterialId === 'deck-7')).toBe(true);
  });

  it('FL-3.2: empty material → no stubs (no throw)', () => {
    expect(materialToInitiativeStubs([], 'm1')).toEqual([]);
  });
});
