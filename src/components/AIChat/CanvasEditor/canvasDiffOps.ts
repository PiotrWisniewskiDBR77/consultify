/**
 * Pure TipTap/ProseMirror operations for the Canvas inline-AI diff flow.
 *
 * Extracted from CanvasRichEditor so the (previously buggy) accept/reject
 * mechanics can be unit-tested against a headless editor without rendering.
 *
 * Correctness notes:
 * - Marks live on inline TEXT leaf nodes, NOT on block nodes, so range
 *   collection MUST filter on `node.isText`.
 * - A replacement string can parse into multiple nodes, so its inserted span
 *   is measured via the document-size delta, never `to + string.length`.
 * - Deletions run in reverse document order so earlier positions stay valid.
 */

import type { Editor } from '@tiptap/react';

export const AI_REMOVED_MARK = 'aiRemoved';
export const AI_ADDED_MARK = 'aiAdded';

export interface DocRange {
  from: number;
  to: number;
}

/**
 * Collect contiguous position ranges of inline text nodes carrying `markName`,
 * merging adjacent/overlapping runs so deletion offsets stay coherent.
 */
/**
 * W2-T1/T2 — true iff the editor currently carries any AI diff marks
 * (aiAdded or aiRemoved). Used to gate stream-start, floating-menu start,
 * and the debounced autosave: each of those operations would corrupt or
 * collide with an unresolved suggestion if it ran while a diff was pending.
 *
 * Cheap — short-circuits on the first match via a stopping descendant walk.
 */
export function hasPendingAiDiff(editor: Editor): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (found) return false;
    if (
      node.isText &&
      node.marks.some((m) => m.type.name === AI_ADDED_MARK || m.type.name === AI_REMOVED_MARK)
    ) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * E1 block-boundary guard — when a selection crosses block nodes (e.g. starts
 * mid-paragraph and ends mid-heading), splicing a flat replacement string at
 * `to` injects it mid-word INSIDE the second block (live-observed: Condense
 * across an H1 boundary spliced prose into the heading). Snap such selections
 * outward to whole blocks: `from` → start of its textblock, `to` → end of its
 * textblock. Selections contained in a single textblock are returned AS-IS
 * (object identity preserved) so the single-block path stays byte-identical.
 *
 * Endpoints that resolve between blocks (not inside a textblock — e.g. a
 * NodeSelection edge) are left untouched; only textblock endpoints are
 * expanded.
 */
export function snapRangeToBlockBoundaries(editor: Editor, range: DocRange): DocRange {
  const { doc } = editor.state;
  const clamp = (pos: number) => Math.max(0, Math.min(pos, doc.content.size));
  const $from = doc.resolve(clamp(range.from));
  const $to = doc.resolve(clamp(range.to));

  if ($from.sameParent($to) && $from.parent.isTextblock) {
    return range;
  }

  return {
    from: $from.parent.isTextblock ? $from.start() : range.from,
    to: $to.parent.isTextblock ? $to.end() : range.to,
  };
}

export function collectMarkedRanges(editor: Editor, markName: string): DocRange[] {
  const ranges: DocRange[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.marks.some((m) => m.type.name === markName)) {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
    return true;
  });

  ranges.sort((a, b) => a.from - b.from);
  const merged: DocRange[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function deleteRangesInReverse(editor: Editor, ranges: DocRange[]): void {
  let chain = editor.chain().focus();
  for (let i = ranges.length - 1; i >= 0; i--) {
    chain = chain.deleteRange(ranges[i]);
  }
  chain.run();
}

/**
 * Apply an inline AI diff over `range`: mark the original text as removed and
 * insert `replacement` right after it, marked as added. Returns the real
 * inserted span (in document positions), or 0 if nothing was inserted.
 */
export function applyAiDiff(editor: Editor, range: DocRange, replacement: string): number {
  const { from, to } = range;

  editor.chain().focus().setTextSelection({ from, to }).setMark(AI_REMOVED_MARK).run();

  const sizeBefore = editor.state.doc.content.size;
  editor
    .chain()
    .insertContentAt(to, replacement, { parseOptions: { preserveWhitespace: 'full' } })
    .run();
  const insertedSpan = editor.state.doc.content.size - sizeBefore;

  if (insertedSpan > 0) {
    editor
      .chain()
      .setTextSelection({ from: to, to: to + insertedSpan })
      // B3 — a FLAT plain-text replacement inserted at the end boundary of the
      // aiRemoved-marked original INHERITS the (inclusive) aiRemoved mark, so
      // accept would delete the replacement together with the original.
      // (Multi-node HTML replacements carry their own marks and dodge this.)
      // Strip aiRemoved from the inserted span before marking it added.
      .unsetMark(AI_REMOVED_MARK)
      .setMark(AI_ADDED_MARK)
      .run();
  }

  return insertedSpan;
}

// C1.5: strip a mark over ONLY the ranges that actually carry it, restoring the
// selection afterwards. The previous selectAll().unsetMark() ran a full-document
// scan for every accept/reject — quadratic for inline edits and disruptive
// because it stomped on the user's cursor.
function unsetMarkOverRanges(editor: Editor, markName: string, ranges: DocRange[]): void {
  if (ranges.length === 0) return;
  const { from: savedFrom, to: savedTo } = editor.state.selection;
  let chain = editor.chain();
  // Order matters less here than for deletes because unsetMark doesn't shift
  // document positions; iterate forward for readability.
  for (const r of ranges) {
    chain = chain.setTextSelection({ from: r.from, to: r.to }).unsetMark(markName);
  }
  // Restore the original selection so the cursor doesn't jump after accept/reject.
  chain.setTextSelection({ from: savedFrom, to: savedTo }).run();
}

/**
 * Accept the pending diff: delete the original (aiRemoved) text and keep the
 * inserted (aiAdded) text with its marker stripped.
 */
export function acceptAiDiff(editor: Editor): void {
  const removedRanges = collectMarkedRanges(editor, AI_REMOVED_MARK);
  deleteRangesInReverse(editor, removedRanges);
  // Re-collect AI_ADDED_MARK ranges AFTER the deletes — the previous positions
  // are invalidated by the doc-size delta.
  unsetMarkOverRanges(editor, AI_ADDED_MARK, collectMarkedRanges(editor, AI_ADDED_MARK));
}

/**
 * Reject the pending diff: delete the inserted (aiAdded) text and restore the
 * original by stripping its aiRemoved marker.
 */
export function rejectAiDiff(editor: Editor): void {
  const addedRanges = collectMarkedRanges(editor, AI_ADDED_MARK);
  deleteRangesInReverse(editor, addedRanges);
  unsetMarkOverRanges(editor, AI_REMOVED_MARK, collectMarkedRanges(editor, AI_REMOVED_MARK));
}
