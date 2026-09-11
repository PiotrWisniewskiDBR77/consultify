/**
 * DEC-461 bezpiecznik: dictionary parity between the two supported
 * languages for the onboarding emails (welcome, verification, admin-IAM
 * invitation). A key present in `en` but missing from `pl` (or vice versa)
 * must fail here — `t()` falls back to the raw key string when a
 * dictionary is missing an entry, so a dropped key is caught by the
 * "translated value differs from the key" assertion below.
 *
 * Mutation check (do this by hand when touching the dictionary): delete any
 * one line from the `pl` object in `onboardingEmailCopy.ts` and re-run this
 * file — `translates every key into Polish` must go red.
 */
import { describe, expect, it } from 'vitest';

import { ONBOARDING_EMAIL_COPY_KEYS, t } from '../onboardingEmailCopy.js';

describe('onboarding email copy dictionary (DEC-461 EN default, PL translation)', () => {
  it('has at least the three first-contact email families covered', () => {
    const prefixes = new Set(ONBOARDING_EMAIL_COPY_KEYS.map((key) => key.split('.')[0]));
    expect(prefixes).toEqual(new Set(['welcome', 'verify', 'invite']));
  });

  it('translates every key into English (source language)', () => {
    for (const key of ONBOARDING_EMAIL_COPY_KEYS) {
      const value = t('en', key);
      expect(value, `missing EN copy for "${key}"`).not.toBe(key);
      expect(value.length, `empty EN copy for "${key}"`).toBeGreaterThan(0);
    }
  });

  it('translates every key into Polish — a key dropped from `pl` fails here', () => {
    for (const key of ONBOARDING_EMAIL_COPY_KEYS) {
      const value = t('pl', key);
      expect(value, `missing PL copy for "${key}"`).not.toBe(key);
      expect(value.length, `empty PL copy for "${key}"`).toBeGreaterThan(0);
    }
  });

  it('EN and PL differ for every key (nothing left un-translated verbatim)', () => {
    const identical = ONBOARDING_EMAIL_COPY_KEYS.filter((key) => t('en', key) === t('pl', key));
    // Emoji-only / punctuation-only values are allowed to coincide; everything
    // else must actually be translated.
    const meaningfullyIdentical = identical.filter((key) => /[a-zA-Z]{3,}/.test(t('en', key)));
    expect(meaningfullyIdentical).toEqual([]);
  });

  it('substitutes {params} and leaves unknown placeholders visible', () => {
    expect(t('en', 'welcome.greeting', { firstName: 'Tomek' })).toBe('Hi Tomek,');
    expect(t('pl', 'welcome.greeting', { firstName: 'Tomek' })).toBe('Cześć Tomek,');
    expect(t('en', 'welcome.greeting')).toBe('Hi {firstName},');
  });

  it('falls back to the key itself for an unknown key (loud, not throwing)', () => {
    expect(t('en', 'welcome.does.not.exist')).toBe('welcome.does.not.exist');
  });
});
