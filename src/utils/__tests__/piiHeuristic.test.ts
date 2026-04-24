/**
 * Chat V9 / TRUST T-PM2-lite — unit tests for the pure PII detector.
 *
 * These pin the observable contract:
 *
 *   - Output is a closed-enum array of categories in the fixed
 *     priority order `email → phone → iban`, never duplicated.
 *   - Empty / non-string input returns `[]`.
 *   - Common false positives (ISO dates, ticket ids) do not hit
 *     the phone detector.
 *   - IBAN is matched with and without the standard 4-char space
 *     grouping users paste in.
 *
 * The detector is deliberately lean; see `piiHeuristic.ts` for the
 * out-of-scope list (PESEL / NIP / credit card).
 */

import { describe, expect, it } from 'vitest';

import { detectPiiCategories, PII_CATEGORIES } from '../piiHeuristic';

describe('PII_CATEGORIES (closed enum contract)', () => {
  it('is the exact list the telemetry payload can include', () => {
    expect([...PII_CATEGORIES]).toEqual(['email', 'phone', 'iban']);
  });
});

describe('detectPiiCategories', () => {
  it('returns [] for empty string', () => {
    expect(detectPiiCategories('')).toEqual([]);
  });

  it('returns [] for non-string input', () => {
    expect(detectPiiCategories(null)).toEqual([]);
    expect(detectPiiCategories(undefined)).toEqual([]);
    expect(detectPiiCategories(42 as unknown as string)).toEqual([]);
  });

  it('returns [] for plain text that looks nothing like PII', () => {
    expect(detectPiiCategories('hello teresa, please summarise this doc')).toEqual([]);
  });

  // ------------------------ EMAIL ------------------------
  it('detects a plain email', () => {
    expect(detectPiiCategories('reach me at piotr@example.com later')).toEqual(['email']);
  });

  it('detects an email with plus-addressing', () => {
    expect(detectPiiCategories('send to ops+urgent@example.co.uk')).toEqual(['email']);
  });

  it('does not treat a Twitter-style handle as an email', () => {
    expect(detectPiiCategories('ping @team in slack')).toEqual([]);
  });

  // ------------------------ PHONE ------------------------
  it('detects a +48 Polish phone with spaces', () => {
    expect(detectPiiCategories('call +48 501 234 567 tomorrow')).toEqual(['phone']);
  });

  it('detects a grouped phone without country code', () => {
    expect(detectPiiCategories('reach me on 501-234-567')).toEqual(['phone']);
  });

  it('detects a parenthesised US-style phone', () => {
    expect(detectPiiCategories('office: (415) 555-0132 ext 7')).toEqual(['phone']);
  });

  it('does NOT flag an ISO date as a phone', () => {
    expect(detectPiiCategories('shipped on 2026-04-18')).toEqual([]);
  });

  it('does NOT flag a short SKU / ticket id as a phone', () => {
    expect(detectPiiCategories('see ticket #12345 please')).toEqual([]);
  });

  // ------------------------ IBAN -------------------------
  it('detects a space-grouped PL IBAN as users paste it', () => {
    expect(detectPiiCategories('account: PL27 1140 2004 0000 3002 0135 5387')).toEqual(['iban']);
  });

  it('detects a contiguous DE IBAN', () => {
    expect(detectPiiCategories('DE89370400440532013000 is the account')).toEqual(['iban']);
  });

  it('does NOT flag a short code that starts like an IBAN but is below the length floor', () => {
    // The candidate `PL01 1234 5678` is only 12 stripped chars — well
    // below the 15-char IBAN minimum — so the iban detector must
    // ignore it, regardless of what the phone detector does with the
    // digit run.
    expect(detectPiiCategories('see PL01 1234 5678')).not.toContain('iban');
  });

  // ------------------------ ORDERING ---------------------
  it('returns categories in the fixed priority order (email, phone, iban)', () => {
    const msg =
      'account PL27 1140 2004 0000 3002 0135 5387, phone +48 501 234 567, mail me at a@b.co';
    expect(detectPiiCategories(msg)).toEqual(['email', 'phone', 'iban']);
  });

  it('never emits a category twice even when multiple matches of the same class exist', () => {
    const msg = 'mail a@b.co and c@d.co; call +48 501 234 567 or +48 600 111 222';
    const out = detectPiiCategories(msg);
    expect(out.filter((c) => c === 'email')).toHaveLength(1);
    expect(out.filter((c) => c === 'phone')).toHaveLength(1);
  });
});
