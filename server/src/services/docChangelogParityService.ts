/**
 * Documentation Change Control — Doc-vs-Changelog Parity Service.
 *
 * Closes the Sprint 15 (L3) "future work" item: the existing
 * `docChangeControlValidatorService` only validates the changelog file itself.
 * It cannot tell whether the controlled doc has drifted relative to the most
 * recent changelog entry — i.e. whether a meaningful diff was made to the
 * doc without a paired changelog entry.
 *
 * This service answers exactly that question, in a pure-logic, never-throws,
 * filesystem-free way. The CI script (`server/scripts/check-doc-changelog-parity.ts`)
 * is responsible for fetching the doc snapshot and changelog content from disk
 * and (best-effort) git, and feeding them into `compareDocVsChangelog`.
 *
 * INVARIANTS (do NOT break in future edits):
 *
 *   - All exported functions are pure (no I/O, no Date.now mutations besides
 *     the today-stamp comparison). They NEVER throw — malformed input degrades
 *     to a deterministic FAIL or PASS_WITH_WARNINGS.
 *   - The result is JSON-serializable (no functions / Date / Symbol on the wire).
 *   - The parity check is read-only — we never mutate the inputs.
 *   - The verdict is deterministic given the same inputs (the only non-determinism
 *     is the today-stamp from the system clock used to compare changelog dates;
 *     callers can stub this by providing `changelogLastEntryDate` themselves).
 */

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface ParityCheckInput {
  /** Relative path of the controlled doc, e.g. `docs/product/PRESENTATION_RBAC_MATRIX.md`. */
  docPath: string;
  /** Relative path of the paired changelog file. */
  changelogPath: string;
  /** Current content of the controlled doc. */
  docContent: string;
  /**
   * Content of the doc as it was when the latest changelog entry was committed.
   * `null` indicates a first-run / git-unavailable scenario; the diff then
   * reports a meaningful change (because we have no baseline to compare against).
   */
  docContentAtChangelog: string | null;
  /** Current content of the paired changelog file. */
  changelogContent: string;
  /**
   * ISO `YYYY-MM-DD` date of the latest changelog entry header, or `null`
   * when the changelog has no parseable entry header.
   */
  changelogLastEntryDate: string | null;
}

export interface ParityIssue {
  field:
    | 'doc_changed_without_changelog'
    | 'doc_unchanged_with_changelog'
    | 'changelog_missing'
    | 'doc_missing'
    | 'changelog_invalid';
  severity: 'error' | 'warning';
  reason: string;
}

export interface ParityCheckResult {
  docPath: string;
  changelogPath: string;
  issues: ParityIssue[];
  verdict: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
}

export interface DiffSummary {
  /** True when the `before → after` diff contains at least one non-trivial line change. */
  meaningfulChange: boolean;
  /** Count of normalized lines present in `after` that were not in `before`. */
  addedLines: number;
  /** Count of normalized lines present in `before` that are no longer in `after`. */
  removedLines: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const MARKDOWN_LINK_TARGET_RE = /\]\(([^)]*)\)/g;
const ENTRY_HEADER_DATE_RE = /^##\s+(\d{4}-\d{2}-\d{2})\b/;

// ============================================================================
// EXPECTED CHANGELOG PATH HELPER
// ============================================================================

/**
 * Map a controlled doc path to its expected changelog path.
 *
 * `docs/product/MY_DOC.md` + `docs/governance` → `docs/governance/CHANGELOG_MY_DOC.md`.
 *
 * Pure path-string manipulation: no filesystem call, no `path` module dependency
 * (so this stays trivially portable to the browser if ever needed).
 */
export function expectedChangelogPath(docPath: string, changelogDir: string): string {
  const safeDoc = typeof docPath === 'string' ? docPath : '';
  const safeDir = typeof changelogDir === 'string' ? changelogDir : '';

  const lastSlash = Math.max(safeDoc.lastIndexOf('/'), safeDoc.lastIndexOf('\\'));
  const baseWithExt = lastSlash >= 0 ? safeDoc.slice(lastSlash + 1) : safeDoc;
  const base = baseWithExt.replace(/\.md$/i, '');
  const fileName = `CHANGELOG_${base}.md`;

  if (safeDir.length === 0) return fileName;
  const trimmedDir = safeDir.replace(/[\\/]+$/, '');
  return `${trimmedDir}/${fileName}`;
}

// ============================================================================
// DIFF SUMMARIZATION
// ============================================================================

function safeString(input: unknown): string {
  return typeof input === 'string' ? input : '';
}

/**
 * Normalize a doc snapshot for diff comparison:
 *
 *   - Strip HTML comments (`<!-- ... -->`) wholesale, so comment-only edits
 *     do not register as meaningful.
 *   - Replace markdown link targets `](url)` with a stable placeholder, so
 *     URL-only updates (e.g. moving a wiki link) do not register as meaningful
 *     prose changes — only the visible link text matters for parity.
 *   - Trim each line and drop empty / whitespace-only lines.
 */
function normalizeForDiff(content: string): string[] {
  const stripped = content.replace(HTML_COMMENT_RE, '').replace(MARKDOWN_LINK_TARGET_RE, '](LINK)');

  return stripped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function multisetCounts(lines: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line, (map.get(line) ?? 0) + 1);
  }
  return map;
}

/**
 * Summarize the diff between a previous and current doc snapshot.
 *
 *   - When `before === null` (or undefined), this is the first observed
 *     revision; we report `meaningfulChange = true` so the caller flags
 *     the change. Counts are zero in that branch (no "before" to subtract).
 *   - When both inputs collapse to the same multiset of normalized lines,
 *     `meaningfulChange = false`.
 *   - Otherwise, `meaningfulChange = true` and `addedLines` / `removedLines`
 *     reflect line-level multiset deltas. This intentionally is NOT a true
 *     LCS-based diff — line position is irrelevant for parity, only presence.
 */
export function summarizeDocDiff(before: string | null, after: string): DiffSummary {
  try {
    const safeAfter = safeString(after);

    if (before === null || before === undefined) {
      return {
        meaningfulChange: true,
        addedLines: 0,
        removedLines: 0,
      };
    }

    const safeBefore = safeString(before);

    const beforeLines = normalizeForDiff(safeBefore);
    const afterLines = normalizeForDiff(safeAfter);

    const beforeCounts = multisetCounts(beforeLines);
    const afterCounts = multisetCounts(afterLines);

    let added = 0;
    let removed = 0;
    const seen = new Set<string>();
    for (const key of beforeCounts.keys()) seen.add(key);
    for (const key of afterCounts.keys()) seen.add(key);

    for (const key of seen) {
      const b = beforeCounts.get(key) ?? 0;
      const a = afterCounts.get(key) ?? 0;
      if (a > b) added += a - b;
      else if (b > a) removed += b - a;
    }

    return {
      meaningfulChange: added + removed > 0,
      addedLines: added,
      removedLines: removed,
    };
  } catch {
    return {
      meaningfulChange: false,
      addedLines: 0,
      removedLines: 0,
    };
  }
}

// ============================================================================
// CHANGELOG ENTRY DATE EXTRACTION (helper for callers; pure)
// ============================================================================

/**
 * Best-effort extraction of the latest changelog entry date from raw markdown.
 *
 * The CLI uses this so it does not have to re-implement the parser.
 * The latest entry is `## YYYY-MM-DD — author` at the top of the file
 * (newest-on-top convention enforced by `docChangeControlValidatorService`).
 *
 * Returns `null` if no parseable entry header is found.
 */
export function extractLatestChangelogDate(changelogContent: string): string | null {
  try {
    const safe = safeString(changelogContent);
    if (safe.length === 0) return null;
    const lines = safe.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(ENTRY_HEADER_DATE_RE);
      if (match && typeof match[1] === 'string') {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// PARITY COMPARISON
// ============================================================================

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildResult(
  docPath: string,
  changelogPath: string,
  issues: ParityIssue[]
): ParityCheckResult {
  let hasError = false;
  let hasAny = false;
  for (const issue of issues) {
    hasAny = true;
    if (issue.severity === 'error') {
      hasError = true;
    }
  }
  let verdict: ParityCheckResult['verdict'];
  if (hasError) verdict = 'FAIL';
  else if (hasAny) verdict = 'PASS_WITH_WARNINGS';
  else verdict = 'PASS';
  return { docPath, changelogPath, issues, verdict };
}

/**
 * Compare a controlled doc against its paired changelog and report parity.
 *
 * Decision tree:
 *
 *   1. `changelogContent` empty / whitespace-only      → `changelog_missing` ERROR
 *   2. `docContent` empty                              → `doc_missing`       ERROR
 *   3. `changelogLastEntryDate` non-null but malformed → `changelog_invalid` WARNING
 *   4. Diff doc snapshot vs current doc:
 *        meaningfulChange === true  AND  changelog entry not for today (or later)
 *                                                         → `doc_changed_without_changelog` ERROR
 *        meaningfulChange === false AND  changelog entry IS for today (or later)
 *                                                         → `doc_unchanged_with_changelog` WARNING
 *   5. Otherwise PASS.
 *
 * Today is computed in UTC `YYYY-MM-DD` so the gate is consistent across
 * developer timezones (a PR opened at 23:30 PT and a CI run at 00:30 PT next
 * day will see the same "today" if both fall in the same UTC day; that's
 * acceptable — the changelog entry date is also stamped in the author's local
 * day, so this is at most one day off, never more).
 */
export function compareDocVsChangelog(input: ParityCheckInput): ParityCheckResult {
  const docPath = safeString(input?.docPath);
  const changelogPath = safeString(input?.changelogPath);
  const issues: ParityIssue[] = [];

  try {
    const docContent = safeString(input?.docContent);
    const changelogContent = safeString(input?.changelogContent);
    const changelogLastEntryDate =
      typeof input?.changelogLastEntryDate === 'string' ? input.changelogLastEntryDate : null;
    const docContentAtChangelog =
      input?.docContentAtChangelog === null || input?.docContentAtChangelog === undefined
        ? null
        : safeString(input.docContentAtChangelog);

    if (changelogContent.trim().length === 0) {
      issues.push({
        field: 'changelog_missing',
        severity: 'error',
        reason:
          'Changelog file is empty or missing. Every controlled doc must have a paired CHANGELOG_*.md.',
      });
      return buildResult(docPath, changelogPath, issues);
    }

    if (docContent.length === 0) {
      issues.push({
        field: 'doc_missing',
        severity: 'error',
        reason:
          'Controlled doc content is empty or unreadable. Cannot compute parity against changelog.',
      });
      return buildResult(docPath, changelogPath, issues);
    }

    if (changelogLastEntryDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(changelogLastEntryDate)) {
      issues.push({
        field: 'changelog_invalid',
        severity: 'warning',
        reason: `Changelog latest-entry date is not a valid YYYY-MM-DD: "${changelogLastEntryDate}".`,
      });
    }

    const diff = summarizeDocDiff(docContentAtChangelog, docContent);

    const today = todayIsoUtc();
    const validDate =
      changelogLastEntryDate !== null && /^\d{4}-\d{2}-\d{2}$/.test(changelogLastEntryDate);
    const entryIsTodayOrLater = validDate && (changelogLastEntryDate as string) >= today;

    if (diff.meaningfulChange) {
      if (!entryIsTodayOrLater) {
        const reason =
          changelogLastEntryDate === null
            ? 'Doc has meaningful changes vs the snapshot at the last changelog commit, but no parseable changelog entry was found. Add a fresh entry per Documentation Change Control § 3.'
            : `Doc has meaningful changes vs the snapshot at the last changelog commit, but the latest changelog entry is dated ${changelogLastEntryDate} (before today ${today}). Add a fresh entry per Documentation Change Control § 3.`;
        issues.push({
          field: 'doc_changed_without_changelog',
          severity: 'error',
          reason,
        });
      }
    } else {
      if (entryIsTodayOrLater) {
        issues.push({
          field: 'doc_unchanged_with_changelog',
          severity: 'warning',
          reason: `Changelog entry dated ${changelogLastEntryDate} was added but the doc shows no meaningful diff. This may be a content-policy update, but verify the rationale matches the diff (or lack thereof).`,
        });
      }
    }

    return buildResult(docPath, changelogPath, issues);
  } catch {
    return buildResult(docPath, changelogPath, issues);
  }
}
