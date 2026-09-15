/** @vitest-environment node */

/**
 * Workbook template i18n — DEC-461/F7b (2026-09-14).
 *
 * DEFECT closed here: `GET /api/workbook/templates` (9 Excel templates,
 * Materials → Sheets) hardcoded Polish titles/descriptions/param
 * labels/groups directly in `templates/index.ts`, so an English-locale
 * caller still got 261 Polish characters back. EN is now the default value
 * in the registry; Polish comes from `templateLocale.ts`'s dictionary ONLY
 * when the resolved locale is `pl`.
 *
 * This suite proves it against the REAL registry (`listWorkbookTemplates`),
 * not a mock — for `en` there must be ZERO Polish-only diacritics anywhere
 * in the listing; for `pl` the well-known template titles must come back in
 * Polish.
 */

import { describe, expect, it } from 'vitest';

import { listWorkbookTemplates } from '../index.js';

// Characters that only ever appear in Polish text in this registry (ASCII
// Polish letters ą/ć/ę/ł/ń/ó/ś/ź/ż, upper+lower). "ó" is deliberately
// EXCLUDED because it is also valid, non-Polish-specific... but this
// registry's English copy never uses it, so keeping it in is safe and
// tightens the check.
const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

function countPolishChars(value: unknown): number {
  if (typeof value === 'string') {
    return (value.match(POLISH_DIACRITICS) || []).length;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum: number, v) => sum + countPolishChars(v), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce(
      (sum: number, v) => sum + countPolishChars(v),
      0
    );
  }
  return 0;
}

describe('workbook templates — EN first (DEC-461/F7b)', () => {
  it('listWorkbookTemplates() defaults to English with zero Polish characters', () => {
    const templates = listWorkbookTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(9);
    const polishCharCount = countPolishChars(templates);
    expect(polishCharCount).toBe(0);
  });

  it("listWorkbookTemplates('en') is explicit-English-equivalent to the default", () => {
    const templates = listWorkbookTemplates('en');
    expect(countPolishChars(templates)).toBe(0);
  });

  it("listWorkbookTemplates('pl') returns Polish titles for every template", () => {
    const templates = listWorkbookTemplates('pl');
    expect(templates.length).toBeGreaterThanOrEqual(9);
    // Every template's title+description+params carries at least one Polish
    // diacritic once translated — this is the mirror-image assertion of the
    // English test, proving the dictionary actually engages for `pl`.
    for (const entry of templates) {
      const chars = countPolishChars(entry);
      expect(chars, `template "${entry.id}" should be localized to Polish`).toBeGreaterThan(0);
    }
  });

  it("known template ids keep their canonical id across locales", () => {
    const en = listWorkbookTemplates('en').map((e) => e.id).sort();
    const pl = listWorkbookTemplates('pl').map((e) => e.id).sort();
    expect(en).toEqual(pl);
    expect(en).toEqual(
      [
        'threeScenarioPnL',
        'operatingBudget',
        'dcfValuation',
        'breakEven',
        'cashflow12m',
        'unitEconomics',
        'loanAmortization',
        'projectViability',
        'benefitsRealization',
      ].sort()
    );
  });

  it('an unknown locale falls back to English (never throws)', () => {
    const templates = listWorkbookTemplates('fr' as unknown as 'en');
    expect(countPolishChars(templates)).toBe(0);
  });
});
