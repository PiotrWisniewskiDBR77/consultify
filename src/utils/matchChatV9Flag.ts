/**
 * Chat V9 / ADMIN AG1 v1.5 — pure filter predicate for the flag
 * control panel.
 *
 * What we match against
 * ---------------------
 * For each flag the filter checks — case-insensitively, after trim —
 * these fields:
 *
 *   - `title`     (human-readable name on the row)
 *   - `ticket`    (e.g. `VM3.1`, `T-TR1.2`, `NAV-M1`)
 *   - `block`     (e.g. `voice`, `trust`, `admin`, `navigation`)
 *   - `id`        (kebab-case identifier, e.g. `trust-badge`)
 *   - `keys.localStorage` (e.g. `ff.trust_badge`)
 *
 * The query is split on whitespace so `"trust copy"` matches every
 * flag whose combined haystack contains both tokens (in any order).
 * An empty / whitespace-only query matches every flag.
 *
 * Design notes
 * ------------
 * - Pure and dependency-free so unit tests can assert behaviour
 *   without a DOM.
 * - Does NOT touch `flag.description` on purpose: descriptions are
 *   long and would cause noisy matches (the string "flag" would
 *   match almost everything). The searchable surface is the short
 *   metadata users think in when hunting for a specific ticket.
 */

import type { ChatV9FlagDescriptor } from './chatV9FeatureFlags';

function normalise(s: string | null | undefined): string {
  if (typeof s !== 'string') return '';
  return s.toLowerCase();
}

/**
 * Return the concatenated searchable haystack for a flag. Exported
 * so tests can assert exactly which fields are included without
 * round-tripping through `matchChatV9Flag`.
 */
export function buildChatV9FlagHaystack(flag: ChatV9FlagDescriptor): string {
  return [flag.title, flag.ticket, flag.block, flag.id, flag.keys.localStorage]
    .map(normalise)
    .join(' | ');
}

/**
 * Return true when `flag` matches the (possibly multi-token) query.
 * Empty / whitespace-only queries match everything.
 */
export function matchChatV9Flag(flag: ChatV9FlagDescriptor, query: string): boolean {
  const normalised = normalise(query).trim();
  if (normalised.length === 0) return true;
  const tokens = normalised.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = buildChatV9FlagHaystack(flag);
  return tokens.every((token) => haystack.includes(token));
}
