/**
 * Chat V9 / AG1 v1.7 — pure helper that distils a flag's
 * `specDocs` array into a compact, panel-friendly summary.
 *
 * Why a dedicated helper?
 *
 * Rendering every path in every row would double the panel
 * height on dense days. Showing *just* the first path is enough
 * for the common case (one flag → one canonical plan entry), and
 * the helper surfaces the full list as a newline-joined tooltip
 * so deep-linked flags (multiple plans / telemetry contracts) are
 * still discoverable on hover.
 *
 * The helper is defensive on input: if `specDocs` is missing,
 * empty, or contains non-string / blank entries, it returns a
 * safe "no docs" summary rather than throwing. The panel uses
 * that summary to render a dimmed "— no spec docs" placeholder
 * so the layout stays stable (and so missing docs are *visible*,
 * not silently hidden — this is the whole reason the flag
 * registry test enforces every entry resolves to a file on disk).
 */

import type { ChatV9FlagDescriptor } from './chatV9FeatureFlags';

export interface ChatV9FlagDocSummary {
  /** First non-empty spec doc path, or `null` when none exist. */
  primary: string | null;
  /**
   * Count of additional spec doc paths beyond the primary one.
   * `0` when the flag has exactly one (or zero) entries.
   */
  extraCount: number;
  /**
   * Newline-joined list of every non-empty spec doc path, suitable
   * for use as a `title=` tooltip. Empty string when there are no
   * entries so the DOM still lets us assign the attribute without
   * surfacing a dangling "see docs" tooltip over nothing.
   */
  tooltip: string;
  /**
   * Total count of non-empty spec doc paths. Zero when the flag
   * has no docs (the admin panel uses this to render the
   * placeholder row).
   */
  totalCount: number;
}

function cleanPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

export function buildChatV9FlagDocSummary(
  flag: Pick<ChatV9FlagDescriptor, 'specDocs'> | null | undefined
): ChatV9FlagDocSummary {
  const empty: ChatV9FlagDocSummary = {
    primary: null,
    extraCount: 0,
    tooltip: '',
    totalCount: 0,
  };
  if (!flag || !Array.isArray(flag.specDocs)) return empty;

  const paths: string[] = [];
  for (const raw of flag.specDocs) {
    const cleaned = cleanPath(raw);
    if (cleaned !== null) paths.push(cleaned);
  }
  if (paths.length === 0) return empty;

  const [primary, ...rest] = paths;
  return {
    primary,
    extraCount: rest.length,
    tooltip: paths.join('\n'),
    totalCount: paths.length,
  };
}
