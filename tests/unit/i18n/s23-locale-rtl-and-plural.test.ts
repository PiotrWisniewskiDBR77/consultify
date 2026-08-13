/**
 * s23-locale-rtl-and-plural.test.ts
 *
 * S23-LOCALE (RISK-38, 2026-08-12) — direct regression coverage for the two
 * runtime mechanisms this stream fixed:
 *
 *  1. RTL application: LANGUAGE_DIRECTION.ar = 'rtl' is claimed to set
 *     `document.documentElement.dir` — this asserts it actually does, via the
 *     real `changeLanguage` from src/i18n.ts (not a re-implementation), and
 *     that it flips back to 'ltr' for 'en' and for the new canonical 'ja'.
 *  2. Plural-category fix: `new Intl.PluralRules('jp')` (the pre-migration
 *     code) silently resolved to en-US-shaped categories (['one','other'])
 *     because 'jp' is not a valid BCP47 subtag. The real Japanese subtag
 *     'ja' resolves to ['other'] only. This pins that distinction directly so
 *     a future revert of the SUPPORTED_LANGUAGES code can't reintroduce the
 *     bug silently.
 */
import { describe, expect, it } from 'vitest';

import { changeLanguage, getCurrentDirection, SUPPORTED_LANGUAGES } from '@/i18n';

describe('S23-LOCALE — RTL application', () => {
  it('applies dir="rtl" to <html> for Arabic and back to "ltr" for English', async () => {
    expect(await changeLanguage('ar')).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(getCurrentDirection()).toBe('rtl');

    expect(await changeLanguage('en')).toBe(true);
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('applies dir="ltr" for the canonical Japanese code "ja"', async () => {
    expect(await changeLanguage('ja')).toBe(true);
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('ja');
  });

  it('accepts the legacy "jp" alias and resolves it to "ja"', async () => {
    expect(await changeLanguage('jp')).toBe(true);
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

describe('S23-LOCALE — plural-category fix (RISK-38)', () => {
  it('SUPPORTED_LANGUAGES uses the real BCP47 Japanese subtag "ja", not "jp"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('ja');
    expect(SUPPORTED_LANGUAGES).not.toContain('jp');
  });

  it('Intl.PluralRules("jp") (the old, invalid code) silently resolves to en-US categories — this is the bug, proven for context', () => {
    const jpRules = new Intl.PluralRules('jp').resolvedOptions();
    expect(jpRules.locale).toBe('en-US');
    expect(jpRules.pluralCategories.sort()).toEqual(['one', 'other']);
  });

  it('Intl.PluralRules("ja") (the app-used code, post-migration) resolves real Japanese categories', () => {
    const jaRules = new Intl.PluralRules('ja').resolvedOptions();
    expect(jaRules.locale).toBe('ja');
    expect(jaRules.pluralCategories).toEqual(['other']);
  });
});
