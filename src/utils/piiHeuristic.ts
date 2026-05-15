/**
 * Chat V9 / TRUST T-PM2-lite — pure PII heuristic detector.
 *
 * What this flags
 * ---------------
 * This module is a heuristic, NOT a compliance scanner. It returns a
 * closed-enum list of category hints so the admin / user can decide
 * whether to amend their next message. The goal is "nudge", not
 * "block".
 *
 * Categories:
 *
 *   - `email`  a `local@host.tld` shape. The regex is deliberately
 *              loose — we would rather show a false positive on a
 *              GitHub handle like `@team/foo` (which does not
 *              match our regex) than miss a real address. One
 *              match is enough; we do not count occurrences.
 *   - `phone`  an optionally `+`-prefixed digit run with 9–15
 *              digits after stripping whitespace, dashes,
 *              parens and dots. Rejects ISO dates (`2026-04-18`:
 *              only 8 digits) and short SKU-like numbers.
 *   - `iban`   a 2-letter country code + 2 check digits + 11–30
 *              alphanumerics. Total stripped length must land in
 *              [15, 34] (standard IBAN range). Whitespace inside
 *              the candidate is tolerated because users paste
 *              with spaces.
 *
 * Ordering: the returned array is stable and follows the fixed
 * priority `email → phone → iban`. Duplicate categories are never
 * emitted. An empty array means "no hit".
 *
 * Design notes
 * ------------
 * - Pure, no DOM, no React imports. Unit-testable directly.
 * - Deliberately lean: no PESEL / NIP / credit card detection in
 *   v1. Those have materially higher false-positive rates and
 *   deserve their own tickets with closed-enum category tokens.
 * - No content is ever logged. Tests assert the CATEGORIES only.
 *
 * PII contract (for the telemetry event that consumes this):
 *   - Payload carries ONLY the closed-enum category tokens below.
 *   - Never the raw message, never substrings, never counts.
 */

export const PII_CATEGORIES = ['email', 'phone', 'iban'] as const;
export type PiiCategory = (typeof PII_CATEGORIES)[number];

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

// Phone candidates: optional leading +, then a mix of digits and
// separators, ending on a digit. Post-filter by digit count.
const PHONE_CANDIDATE_RE = /\+?\d(?:[\d\s\-().]{6,24})\d/g;

// IBAN candidates: country code + 2 check digits + 11+ alphanumerics
// (with optional spaces for the human-paste format). Post-filter by
// stripped length.
const IBAN_CANDIDATE_RE = /\b[A-Z]{2}\d{2}(?:[\sA-Z0-9]){11,34}\b/g;

function hasEmail(text: string): boolean {
  return EMAIL_RE.test(text);
}

function hasPhone(text: string): boolean {
  const candidates = text.match(PHONE_CANDIDATE_RE);
  if (!candidates) return false;
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) return true;
  }
  return false;
}

function hasIban(text: string): boolean {
  const candidates = text.match(IBAN_CANDIDATE_RE);
  if (!candidates) return false;
  for (const raw of candidates) {
    const stripped = raw.replace(/\s+/g, '');
    if (stripped.length >= 15 && stripped.length <= 34) return true;
  }
  return false;
}

/**
 * Return the stable, deduplicated, priority-ordered list of PII
 * categories detected in `text`. An empty string / non-string
 * input returns `[]`.
 */
export function detectPiiCategories(text: string | null | undefined): PiiCategory[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const found: PiiCategory[] = [];
  if (hasEmail(text)) found.push('email');
  if (hasPhone(text)) found.push('phone');
  if (hasIban(text)) found.push('iban');
  return found;
}
