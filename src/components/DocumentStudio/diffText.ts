/**
 * B3 — Document Studio visual diff: pure token-level text diffing.
 *
 * The backend schema-diff service (`documentSchemaDiffService`) already emits a
 * BLOCK-level structural diff (`DocumentSchemaDiffResponse`): which sections /
 * blocks were added / removed / modified, plus the before/after *text* of each
 * block. What it does NOT provide is the INTRA-text token diff — i.e. which
 * words inside a modified text block changed. That is what this module supplies,
 * with zero runtime dependencies (no `diff` npm package is installed).
 *
 * Algorithm: classic LCS (longest common subsequence) over word tokens,
 * O(n*m) time / space, which is fine for the short paragraphs a single document
 * block holds. Whitespace runs are preserved as their own tokens so rendering
 * can reconstruct the original spacing.
 */

export type DiffTextSegmentKind = 'equal' | 'added' | 'removed';

export interface DiffTextSegment {
  kind: DiffTextSegmentKind;
  value: string;
}

/**
 * Split into word / whitespace / punctuation tokens, keeping every character so
 * `tokens.join('')` reproduces the input exactly.
 */
export function tokenizeForDiff(input: string): string[] {
  if (!input) return [];
  // Match runs of: whitespace | word-characters (unicode-aware) | any single
  // remaining char (punctuation etc.). The `u` flag keeps accents intact so PL
  // text ("wdrożenie") diffs word-by-word rather than letter-by-letter.
  const matches = input.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu);
  return matches ? Array.from(matches) : [];
}

/**
 * Compute an inline token-level diff between `before` and `after`.
 *
 * Returns an ordered list of segments. Adjacent segments of the same kind are
 * merged so the renderer emits the minimum number of spans. An unchanged input
 * (before === after) yields a single `equal` segment (or an empty array for
 * empty input).
 */
export function diffTextSegments(before: string, after: string): DiffTextSegment[] {
  const beforeText = before ?? '';
  const afterText = after ?? '';

  if (beforeText === afterText) {
    return beforeText ? [{ kind: 'equal', value: beforeText }] : [];
  }

  const a = tokenizeForDiff(beforeText);
  const b = tokenizeForDiff(afterText);

  // LCS length table.
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const raw: DiffTextSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ kind: 'equal', value: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ kind: 'removed', value: a[i] });
      i += 1;
    } else {
      raw.push({ kind: 'added', value: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    raw.push({ kind: 'removed', value: a[i] });
    i += 1;
  }
  while (j < m) {
    raw.push({ kind: 'added', value: b[j] });
    j += 1;
  }

  // Merge adjacent same-kind segments.
  const merged: DiffTextSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.kind === seg.kind) {
      last.value += seg.value;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

export interface DiffTextStats {
  hasChanges: boolean;
  addedSegmentCount: number;
  removedSegmentCount: number;
}

export function summarizeDiffSegments(segments: DiffTextSegment[]): DiffTextStats {
  let added = 0;
  let removed = 0;
  for (const seg of segments) {
    if (seg.kind === 'added') added += 1;
    else if (seg.kind === 'removed') removed += 1;
  }
  return {
    hasChanges: added > 0 || removed > 0,
    addedSegmentCount: added,
    removedSegmentCount: removed,
  };
}
