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
      .setMark(AI_ADDED_MARK)
      .run();
  }

  return insertedSpan;
}

/**
 * Accept the pending diff: delete the original (aiRemoved) text and keep the
 * inserted (aiAdded) text with its marker stripped.
 */
export function acceptAiDiff(editor: Editor): void {
  deleteRangesInReverse(editor, collectMarkedRanges(editor, AI_REMOVED_MARK));
  editor.chain().selectAll().unsetMark(AI_ADDED_MARK).run();
}

/**
 * Reject the pending diff: delete the inserted (aiAdded) text and restore the
 * original by stripping its aiRemoved marker.
 */
export function rejectAiDiff(editor: Editor): void {
  deleteRangesInReverse(editor, collectMarkedRanges(editor, AI_ADDED_MARK));
  editor.chain().selectAll().unsetMark(AI_REMOVED_MARK).run();
}
