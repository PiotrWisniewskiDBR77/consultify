/**
 * B3 patch-mode — unit coverage for the anchor-validation/parse helper and the
 * editor-side locate/apply path (headless TipTap, no DOM render).
 *
 * Parse contract guarded here:
 *  - valid multi-op patches pass through verbatim;
 *  - fence-wrapped JSON (models love ```json) is unwrapped;
 *  - anchors that are missing or ambiguous in the document FAIL CLOSED so the
 *    caller falls back to the full replace stream instead of mis-patching.
 */

import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_ADDED_MARK,
  AI_REMOVED_MARK,
  acceptAiDiff,
  collectMarkedRanges,
} from '@/components/AIChat/CanvasEditor/canvasDiffOps';
import { getCanvasEditorExtensions } from '@/components/AIChat/CanvasEditor/canvasEditorExtensions';
import {
  MAX_ANCHOR_CHARS,
  applyPatchOperations,
  buildDocTextIndex,
  locateAnchorRange,
  parsePatchOperations,
  stripCodeFences,
} from '@/components/AIChat/CanvasEditor/canvasPatchOps';

const DOC_TEXT = [
  'Wprowadzenie do transformacji',
  'Pierwszy akapit o procesach produkcyjnych.',
  'Finanse i budżet',
  'Drugi akapit o kosztach operacyjnych.',
].join('\n\n');

describe('parsePatchOperations', () => {
  it('accepts a valid 2-op patch', () => {
    const raw = JSON.stringify({
      operations: [
        { anchor: 'Finanse i budżet', replacement: 'Finanse i ryzyka' },
        { anchor: 'kosztach operacyjnych', replacement: 'kosztach stałych' },
      ],
    });
    const result = parsePatchOperations(raw, DOC_TEXT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operations).toHaveLength(2);
      expect(result.operations[0].replacement).toBe('Finanse i ryzyka');
    }
  });

  it('unwraps fence-wrapped JSON (```json … ```)', () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        operations: [{ anchor: 'Finanse i budżet', replacement: 'Finanse 2026' }],
      }) +
      '\n```';
    const result = parsePatchOperations(raw, DOC_TEXT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.operations[0].anchor).toBe('Finanse i budżet');
  });

  it('rejects an anchor that does not occur in the document', () => {
    const raw = JSON.stringify({
      operations: [{ anchor: 'Sekcja widmo', replacement: 'X' }],
    });
    const result = parsePatchOperations(raw, DOC_TEXT);
    expect(result).toEqual({ ok: false, reason: 'anchor-not-found' });
  });

  it('rejects an ambiguous anchor (occurs twice)', () => {
    const raw = JSON.stringify({
      operations: [{ anchor: 'akapit o', replacement: 'X' }],
    });
    const result = parsePatchOperations(raw, DOC_TEXT);
    expect(result).toEqual({ ok: false, reason: 'anchor-ambiguous' });
  });

  it('rejects more than 4 operations', () => {
    const ops = ['Wprowadzenie', 'Pierwszy', 'Finanse', 'Drugi', 'budżet'].map((anchor) => ({
      anchor,
      replacement: 'x',
    }));
    const result = parsePatchOperations(JSON.stringify({ operations: ops }), DOC_TEXT);
    expect(result).toEqual({ ok: false, reason: 'too-many-operations' });
  });

  it('rejects anchors above the length cap', () => {
    const longAnchor = 'a'.repeat(MAX_ANCHOR_CHARS + 1);
    const result = parsePatchOperations(
      JSON.stringify({ operations: [{ anchor: longAnchor, replacement: 'x' }] }),
      DOC_TEXT + longAnchor
    );
    expect(result).toEqual({ ok: false, reason: 'anchor-too-long' });
  });

  it('rejects overlapping anchors', () => {
    const raw = JSON.stringify({
      operations: [
        { anchor: 'Finanse i budżet', replacement: 'A' },
        { anchor: 'i budżet', replacement: 'B' },
      ],
    });
    // 'i budżet' alone occurs once (inside 'Finanse i budżet') — overlap check
    // must still reject the pair.
    const result = parsePatchOperations(raw, DOC_TEXT);
    expect(result).toEqual({ ok: false, reason: 'anchors-overlap' });
  });

  it('fails closed on non-JSON replies', () => {
    expect(parsePatchOperations('Sure! I changed the section for you.', DOC_TEXT).ok).toBe(false);
    expect(parsePatchOperations('{operations: broken', DOC_TEXT).ok).toBe(false);
    expect(parsePatchOperations('', DOC_TEXT).ok).toBe(false);
  });
});

describe('stripCodeFences', () => {
  it('strips ``` and ```json wrappers, leaves bare text alone', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe('locate + apply against a headless editor', () => {
  let editor: Editor | null = null;

  function makeEditor(): Editor {
    editor = new Editor({
      extensions: getCanvasEditorExtensions(),
      content:
        '<h2>Wprowadzenie</h2><p>Pierwszy akapit o procesach.</p><h2>Finanse</h2><p>Drugi akapit o kosztach.</p>',
    });
    return editor;
  }

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it('projects textblocks joined by blank lines and maps anchors to PM ranges', () => {
    const ed = makeEditor();
    const index = buildDocTextIndex(ed);
    expect(index.text).toBe(
      'Wprowadzenie\n\nPierwszy akapit o procesach.\n\nFinanse\n\nDrugi akapit o kosztach.'
    );

    const range = locateAnchorRange(index, 'Finanse');
    expect(range).not.toBeNull();
    expect(ed.state.doc.textBetween(range!.from, range!.to)).toBe('Finanse');
  });

  it('returns null for missing and ambiguous anchors', () => {
    const ed = makeEditor();
    const index = buildDocTextIndex(ed);
    expect(locateAnchorRange(index, 'nie ma mnie w dokumencie')).toBeNull();
    expect(locateAnchorRange(index, 'akapit o')).toBeNull(); // occurs twice
  });

  it('applies a 2-op patch through the diff-mark machinery; accept lands both edits', () => {
    const ed = makeEditor();
    const applied = applyPatchOperations(ed, [
      { anchor: 'Finanse', replacement: 'Finanse i ryzyka' },
      { anchor: 'Drugi akapit o kosztach.', replacement: 'Drugi akapit o budżecie.' },
    ]);
    expect(applied).toBe(2);

    // One pending diff session: originals marked removed, insertions marked added.
    expect(collectMarkedRanges(ed, AI_REMOVED_MARK).length).toBeGreaterThan(0);
    expect(collectMarkedRanges(ed, AI_ADDED_MARK).length).toBeGreaterThan(0);

    acceptAiDiff(ed);
    const text = buildDocTextIndex(ed).text;
    expect(text).toContain('Finanse i ryzyka');
    expect(text).toContain('Drugi akapit o budżecie.');
    expect(text).not.toContain('Drugi akapit o kosztach.');
    expect(collectMarkedRanges(ed, AI_REMOVED_MARK)).toHaveLength(0);
    expect(collectMarkedRanges(ed, AI_ADDED_MARK)).toHaveLength(0);
  });

  it('is all-or-nothing: one bad anchor leaves the document untouched', () => {
    const ed = makeEditor();
    const before = buildDocTextIndex(ed).text;
    const applied = applyPatchOperations(ed, [
      { anchor: 'Finanse', replacement: 'X' },
      { anchor: 'anchor widmo', replacement: 'Y' },
    ]);
    expect(applied).toBe(0);
    expect(buildDocTextIndex(ed).text).toBe(before);
    expect(collectMarkedRanges(ed, AI_REMOVED_MARK)).toHaveLength(0);
  });
});
