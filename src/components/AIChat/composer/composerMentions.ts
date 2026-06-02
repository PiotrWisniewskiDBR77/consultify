/**
 * composerMentions — pure, framework-free helpers for the composer command system.
 *
 * Kept side-effect free so the trigger detection and text-mutation logic can be
 * unit-tested in isolation and reused by both the slash-command and @-mention
 * palettes without pulling in React or store state.
 */

export type MentionType = 'document' | 'project' | 'conversation' | 'attachment';

export interface MentionCandidate {
  type: MentionType;
  /** Stable id (slug for KB docs, uuid for projects/conversations, name for attachments). */
  id: string;
  /** Primary display label. */
  label: string;
  /** Optional secondary line (e.g. category, last-updated). */
  sublabel?: string;
}

export interface TriggerMatch {
  /** Index in the full value where the trigger char (`/` or `@`) sits. */
  start: number;
  /** The query typed after the trigger char (may be empty). */
  query: string;
}

/**
 * Detect a slash-command trigger. A slash only triggers when it is the first
 * non-whitespace character of the current line and the token typed after it
 * contains no whitespace — this avoids hijacking URLs/paths typed mid-message.
 */
export function detectSlashTrigger(textBeforeCaret: string): TriggerMatch | null {
  const match = /(?:^|\n)([ \t]*)\/(\S*)$/.exec(textBeforeCaret);
  if (!match) return null;
  const query = match[2];
  // start = index of the '/' char
  const start = textBeforeCaret.length - query.length - 1;
  return { start, query };
}

/**
 * Detect an @-mention trigger. The `@` must be at the start of the input or
 * preceded by whitespace, and the query after it must contain no whitespace.
 */
export function detectMentionTrigger(textBeforeCaret: string): TriggerMatch | null {
  const match = /(?:^|\s)@(\S*)$/.exec(textBeforeCaret);
  if (!match) return null;
  const query = match[1];
  const start = textBeforeCaret.length - query.length - 1;
  return { start, query };
}

/**
 * Replace the slice [from, to) of `value` with `replacement`, returning the new
 * value and the caret position that should follow the inserted text.
 */
export function insertAtCaret(
  value: string,
  from: number,
  to: number,
  replacement: string
): { value: string; caret: number } {
  const safeFrom = Math.max(0, Math.min(from, value.length));
  const safeTo = Math.max(safeFrom, Math.min(to, value.length));
  const next = value.slice(0, safeFrom) + replacement + value.slice(safeTo);
  return { value: next, caret: safeFrom + replacement.length };
}

/** Build the inline token inserted into the textarea for a selected mention. */
export function buildMentionToken(candidate: MentionCandidate): string {
  const label = candidate.label.replace(/\s+/g, ' ').trim();
  return `@${label} `;
}

/** Case-insensitive substring filter used by both palettes. */
export function fuzzyIncludes(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.toLowerCase().includes(query.toLowerCase());
}
