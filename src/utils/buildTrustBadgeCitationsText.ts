/**
 * Chat V9 / TRUST T-TR1.3 — pure formatter for the "Copy citations"
 * clipboard payload.
 *
 * What we emit
 * ------------
 * A small Markdown block users can paste into Notion, a GitHub
 * issue, or a Slack message:
 *
 *   ```
 *   Sources for this reply (answered by Claude 3.5 Sonnet):
 *   1. [Retention deck Q3](https://example.com/deck) — ref:doc-12
 *   2. Offsite notes 2025
 *   ```
 *
 * Design notes
 * ------------
 * - Deterministic and dependency-free. Given the same inputs, the
 *   same string comes out; easy to assert in tests.
 * - Rendering rules:
 *     * Title is always present (Trust Badge's own normaliser drops
 *       entries without a title, so we can trust it here).
 *     * Link rendered as `[title](link)` when `link` is a non-empty
 *       string; otherwise plain title.
 *     * Reference suffix (` — ref:<reference>`) appended only when
 *       `reference` is a non-empty string, so legacy citations
 *       without references still render cleanly.
 * - The optional `modelLabel` is the already-humanised label the
 *   badge shows — we do NOT re-humanise here to keep this helper
 *   orthogonal to T-TR1.2's dictionary.
 * - Accepts an empty list: caller may decide to suppress copy
 *   entirely in that case, but the helper returns a graceful
 *   "No cited sources" stub instead of an empty string so nothing
 *   ever lands silently on the clipboard.
 */

import type { ChatCitation } from '@/types';

export interface BuildCitationsTextOptions {
  /**
   * Optional humanised model label (e.g. `"GPT-4o"`). When present,
   * rendered in the header line as "(answered by <label>)". Empty /
   * whitespace / non-string values are ignored.
   */
  modelLabel?: string | null;
}

function escapePipes(s: string): string {
  // Users pasting into a Markdown table benefit from pipe escaping.
  // We keep it simple: the formatter targets readable lists, but a
  // pipe inside a title must still survive a round-trip into a
  // Notion table.
  return s.replace(/\|/g, '\\|');
}

function sanitiseModelLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildTrustBadgeCitationsText(
  citations: readonly ChatCitation[] | null | undefined,
  options: BuildCitationsTextOptions = {}
): string {
  const modelLabel = sanitiseModelLabel(options.modelLabel);
  const headerBase = 'Sources for this reply';
  const header = modelLabel ? `${headerBase} (answered by ${modelLabel}):` : `${headerBase}:`;

  if (!Array.isArray(citations) || citations.length === 0) {
    return `${header}\n\nNo cited sources.`;
  }

  // Renumber by output position (not input index) so a skipped
  // invalid entry never leaves a numbering gap on the clipboard.
  // Users expect `1., 2., 3.`; seeing `2., 4.` would look like a
  // formatting bug.
  const lines: string[] = [];
  for (const c of citations) {
    const title = typeof c?.title === 'string' ? c.title.trim() : '';
    if (!title) continue;
    const safeTitle = escapePipes(title);
    const link = typeof c?.link === 'string' ? c.link.trim() : '';
    const reference = typeof c?.reference === 'string' ? c.reference.trim() : '';

    const titleCell = link ? `[${safeTitle}](${link})` : safeTitle;
    const refSuffix = reference ? ` — ref:${reference}` : '';
    lines.push(`${lines.length + 1}. ${titleCell}${refSuffix}`);
  }

  if (lines.length === 0) {
    // All entries were shape-valid from the normaliser's POV but had
    // empty titles after trim. Degrade gracefully rather than emit a
    // lonely header.
    return `${header}\n\nNo cited sources.`;
  }

  return [header, '', ...lines].join('\n');
}
