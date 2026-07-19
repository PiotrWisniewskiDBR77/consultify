/**
 * ODBIÓR O8.3 — Słownik pojęć konsultingowych (glossary)
 *
 * REJESTR / _PROJEKT_C_OXFORD.md claim: "zbudowane wąsko (tylko DRD)" / ⬜.
 * This test proves the REAL runtime state: a real bilingual data module with
 * >=20 curated terms across the intended categories, every entry non-empty in
 * both languages, unique ids, and content quality (no placeholder text).
 */
import { describe, expect, it } from 'vitest';

import { CONSULTING_GLOSSARY, GLOSSARY_CATEGORIES } from '../consultingGlossary';

describe('O8.3 — consulting glossary: real, non-placeholder bilingual content', () => {
  it('has a substantial number of curated terms (not a stub)', () => {
    expect(CONSULTING_GLOSSARY.length).toBeGreaterThanOrEqual(20);
  });

  it('every term has a unique id and non-trivial PL+EN definitions', () => {
    const ids = new Set<string>();
    for (const term of CONSULTING_GLOSSARY) {
      expect(ids.has(term.id)).toBe(false);
      ids.add(term.id);

      expect(term.term.trim().length).toBeGreaterThan(0);
      expect(GLOSSARY_CATEGORIES).toContain(term.category);
      expect(term.definition.en.trim().length).toBeGreaterThan(30);
      expect(term.definition.pl.trim().length).toBeGreaterThan(30);
      // EN and PL definitions must actually differ (real translation, not copy-paste)
      expect(term.definition.en).not.toBe(term.definition.pl);
    }
  });

  it('covers at least strategy, operations, finance and prioritization categories', () => {
    const usedCategories = new Set(CONSULTING_GLOSSARY.map((t) => t.category));
    expect(usedCategories.has('strategy')).toBe(true);
    expect(usedCategories.has('operations')).toBe(true);
    expect(usedCategories.has('finance')).toBe(true);
    expect(usedCategories.has('prioritization')).toBe(true);
  });

  it('includes well-known consulting acronyms used elsewhere in the app (SWOT, WACC, MECE)', () => {
    const terms = CONSULTING_GLOSSARY.map((t) => t.term.toUpperCase());
    expect(terms.some((t) => t.includes('SWOT'))).toBe(true);
    expect(terms.some((t) => t.includes('WACC'))).toBe(true);
    expect(terms.some((t) => t.includes('MECE'))).toBe(true);
  });
});
