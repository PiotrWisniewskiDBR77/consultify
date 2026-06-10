/**
 * Regression coverage for the Canvas inline-AI diff mechanics.
 *
 * These guard the two correctness bugs found during the Canvas P0 review:
 *  - accept/reject traversed ALL nodes (not just text leaves) and deleted by
 *    block nodeSize, corrupting any formatted / multi-node AI replacement;
 *  - the inserted span was computed as `to + replacement.length`, which is not
 *    a valid ProseMirror position once the replacement parses into >1 node.
 *
 * Runs against a headless TipTap editor (no DOM render) so the doc-mutation
 * logic is exercised directly.
 */

import { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AI_ADDED_MARK,
  AI_REMOVED_MARK,
  acceptAiDiff,
  applyAiDiff,
  collectMarkedRanges,
  rejectAiDiff,
} from '@/components/AIChat/CanvasEditor/canvasDiffOps';
import { getCanvasEditorExtensions } from '@/components/AIChat/CanvasEditor/canvasEditorExtensions';

// A multi-node replacement: a bold run + plain text + an italic run. The old
// logic mis-handled exactly this shape.
const MULTI_NODE_REPLACEMENT = '<strong>swift</strong> and <em>agile</em>';

function makeEditor(): Editor {
  return new Editor({
    extensions: getCanvasEditorExtensions(),
    content: '<p>The quick brown fox</p>',
  });
}

/** Resolve the ProseMirror range of `phrase` within a single-paragraph doc. */
function rangeOf(editor: Editor, phrase: string): { from: number; to: number } {
  const text = editor.state.doc.textContent;
  const idx = text.indexOf(phrase);
  if (idx < 0) throw new Error(`phrase not found: ${phrase}`);
  // +1 accounts for the opening position of the single leading paragraph.
  const from = idx + 1;
  return { from, to: from + phrase.length };
}

let editor: Editor;

beforeEach(() => {
  editor = makeEditor();
});

afterEach(() => {
  editor.destroy();
});

describe('applyAiDiff', () => {
  it('marks the original as removed and the inserted multi-node content as added', () => {
    const span = applyAiDiff(editor, rangeOf(editor, 'quick brown'), MULTI_NODE_REPLACEMENT);

    // Span is measured via doc-size delta, not string length.
    expect(span).toBeGreaterThan(0);

    const removed = collectMarkedRanges(editor, AI_REMOVED_MARK);
    const added = collectMarkedRanges(editor, AI_ADDED_MARK);
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);

    // Both the original and the inserted text coexist while pending.
    const text = editor.state.doc.textContent;
    expect(text).toContain('quick brown');
    expect(text).toContain('swift');
    expect(text).toContain('agile');
  });
});

describe('acceptAiDiff', () => {
  it('keeps the inserted content, drops the original, and clears all diff marks', () => {
    applyAiDiff(editor, rangeOf(editor, 'quick brown'), MULTI_NODE_REPLACEMENT);
    acceptAiDiff(editor);

    expect(editor.state.doc.textContent).toBe('The swift and agile fox');
    // Formatting from the multi-node replacement survives.
    expect(editor.getHTML()).toContain('<strong>swift</strong>');
    expect(editor.getHTML()).toContain('<em>agile</em>');

    // No orphaned diff marks remain.
    expect(collectMarkedRanges(editor, AI_REMOVED_MARK)).toHaveLength(0);
    expect(collectMarkedRanges(editor, AI_ADDED_MARK)).toHaveLength(0);
  });
});

describe('rejectAiDiff', () => {
  it('restores the original text exactly and clears all diff marks', () => {
    applyAiDiff(editor, rangeOf(editor, 'quick brown'), MULTI_NODE_REPLACEMENT);
    rejectAiDiff(editor);

    expect(editor.state.doc.textContent).toBe('The quick brown fox');
    expect(editor.getHTML()).not.toContain('swift');
    expect(editor.getHTML()).not.toContain('agile');

    expect(collectMarkedRanges(editor, AI_REMOVED_MARK)).toHaveLength(0);
    expect(collectMarkedRanges(editor, AI_ADDED_MARK)).toHaveLength(0);
  });
});

describe('collectMarkedRanges', () => {
  it('returns only text-node ranges and merges adjacent runs', () => {
    applyAiDiff(editor, rangeOf(editor, 'quick brown'), MULTI_NODE_REPLACEMENT);
    const added = collectMarkedRanges(editor, AI_ADDED_MARK);

    // Ranges are sorted and non-overlapping after the merge pass.
    for (let i = 1; i < added.length; i++) {
      expect(added[i].from).toBeGreaterThan(added[i - 1].to);
    }
  });
});
