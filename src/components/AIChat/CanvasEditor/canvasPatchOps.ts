/**
 * B3 patch-mode — surgical chat-driven edits to the open Canvas document
 * (Claude Artifacts "update" mechanic).
 *
 * A chat instruction like "zmień tytuł sekcji 2 na Y" is answered by the
 * NON-streaming /api/ai/chat/quick endpoint with a strict JSON contract:
 *   {"operations":[{"anchor":"<exact unique substring>","replacement":"…"}]}
 * The anchors are validated and located against a PLAIN-TEXT projection of the
 * TipTap document (textblocks joined by '\n\n'), then applied through the SAME
 * aiRemoved/aiAdded diff machinery as selection edits (canvasDiffOps), so
 * Accept/Reject + Esc + provenance work unchanged.
 *
 * Everything here that does NOT need an Editor instance is pure so it can be
 * unit-tested without a DOM (see tests/unit/AIChat/canvasPatchOps.test.ts).
 */

import type { Editor } from '@tiptap/react';

import { applyAiDiff, type DocRange, snapRangeToBlockBoundaries } from './canvasDiffOps';

export const MAX_PATCH_OPS = 4;
export const MAX_ANCHOR_CHARS = 200;

export interface PatchOperation {
  anchor: string;
  replacement: string;
}

export type ParsePatchResult =
  | { ok: true; operations: PatchOperation[] }
  | { ok: false; reason: string };

/**
 * Strip markdown code fences from an LLM reply. Handles ```json … ``` and
 * bare ``` … ``` wrappers; leaves un-fenced text untouched.
 */
export function stripCodeFences(raw: string): string {
  const text = String(raw || '').trim();
  const fenced = text.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```\s*$/);
  return fenced ? fenced[1].trim() : text;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    if (count > 1) break; // we only care about 0 / 1 / "more than 1"
    at = haystack.indexOf(needle, at + 1);
  }
  return count;
}

/**
 * Defensive parser for the patch contract. Pure: validates the raw LLM reply
 * against the document's plain-text projection. Fails closed — any structural
 * or anchor problem returns { ok: false } so the caller can fall back to the
 * full replace stream.
 */
export function parsePatchOperations(raw: string, docText: string): ParsePatchResult {
  const cleaned = stripCodeFences(raw);
  // Models sometimes wrap JSON in prose despite instructions — extract the
  // outermost object before parsing.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, reason: 'no-json-object' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  const operationsRaw = (parsed as { operations?: unknown })?.operations;
  if (!Array.isArray(operationsRaw) || operationsRaw.length === 0) {
    return { ok: false, reason: 'no-operations' };
  }
  if (operationsRaw.length > MAX_PATCH_OPS) {
    return { ok: false, reason: 'too-many-operations' };
  }

  const operations: PatchOperation[] = [];
  const spans: Array<{ from: number; to: number }> = [];
  for (const entry of operationsRaw) {
    const anchor =
      typeof (entry as PatchOperation)?.anchor === 'string' ? (entry as PatchOperation).anchor : '';
    const replacement = (entry as PatchOperation)?.replacement;
    if (!anchor.trim()) return { ok: false, reason: 'empty-anchor' };
    if (anchor.length > MAX_ANCHOR_CHARS) return { ok: false, reason: 'anchor-too-long' };
    if (typeof replacement !== 'string') return { ok: false, reason: 'invalid-replacement' };

    const occurrences = countOccurrences(docText, anchor);
    if (occurrences === 0) return { ok: false, reason: 'anchor-not-found' };
    if (occurrences > 1) return { ok: false, reason: 'anchor-ambiguous' };

    const at = docText.indexOf(anchor);
    spans.push({ from: at, to: at + anchor.length });
    operations.push({ anchor, replacement });
  }

  // Reject overlapping anchors — applying one would corrupt the other.
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from < sorted[i - 1].to) return { ok: false, reason: 'anchors-overlap' };
  }

  return { ok: true, operations };
}

// ── Plain-text projection of the TipTap doc + offset → position map ────────

export interface DocTextSegment {
  /** Inclusive start offset of this text node within the projection. */
  start: number;
  /** Exclusive end offset within the projection. */
  end: number;
  /** ProseMirror position of the text node's first character. */
  pmFrom: number;
}

export interface DocTextIndex {
  text: string;
  segments: DocTextSegment[];
}

/**
 * Build the plain-text projection used BOTH as the AI context document and as
 * the anchor-location index — same function so offsets always agree.
 * Textblocks are separated by '\n\n' (no PM mapping for separators).
 */
export function buildDocTextIndex(editor: Editor): DocTextIndex {
  const parts: string[] = [];
  const segments: DocTextSegment[] = [];
  let len = 0;
  let firstBlock = true;

  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (!firstBlock) {
        parts.push('\n\n');
        len += 2;
      }
      firstBlock = false;
      return true;
    }
    if (node.isText && node.text) {
      parts.push(node.text);
      segments.push({ start: len, end: len + node.text.length, pmFrom: pos });
      len += node.text.length;
    }
    return true;
  });

  return { text: parts.join(''), segments };
}

/**
 * Map a validated anchor to its ProseMirror range. Returns null when the
 * anchor is missing or ambiguous in the live document (it is re-validated
 * here because the user may have typed between the AI request and apply).
 * Endpoints landing inside a '\n\n' separator are snapped inward to the
 * nearest text segment.
 */
export function locateAnchorRange(index: DocTextIndex, anchor: string): DocRange | null {
  if (!anchor) return null;
  const at = index.text.indexOf(anchor);
  if (at === -1) return null;
  if (index.text.indexOf(anchor, at + 1) !== -1) return null;
  const end = at + anchor.length;

  let from: number | null = null;
  let to: number | null = null;
  for (const seg of index.segments) {
    if (from === null && at < seg.end) {
      from = seg.pmFrom + Math.max(0, at - seg.start);
    }
    if (seg.start < end) {
      to = seg.pmFrom + Math.min(seg.end, end) - seg.start;
    }
  }
  if (from === null || to === null || to <= from) return null;
  return { from, to };
}

/**
 * Apply validated patch operations through the diff-mark machinery.
 * All-or-nothing: every anchor must locate cleanly (and not overlap after
 * block snapping) BEFORE the first mutation, otherwise returns 0 and leaves
 * the document untouched so the caller can fall back.
 *
 * Cross-block anchors are snapped outward to whole blocks via
 * snapRangeToBlockBoundaries (which returns single-block ranges unchanged, so
 * in-block anchors apply exact). Ops are applied in REVERSE document order so
 * earlier positions stay valid — applyAiDiff only grows the doc after `to`.
 */
export function applyPatchOperations(editor: Editor, operations: PatchOperation[]): number {
  if (operations.length === 0 || operations.length > MAX_PATCH_OPS) return 0;

  const index = buildDocTextIndex(editor);
  const located: Array<{ range: DocRange; replacement: string }> = [];
  for (const op of operations) {
    const raw = locateAnchorRange(index, op.anchor);
    if (!raw) return 0;
    located.push({ range: snapRangeToBlockBoundaries(editor, raw), replacement: op.replacement });
  }

  located.sort((a, b) => a.range.from - b.range.from);
  for (let i = 1; i < located.length; i++) {
    if (located[i].range.from < located[i - 1].range.to) return 0;
  }

  for (let i = located.length - 1; i >= 0; i--) {
    applyAiDiff(editor, located[i].range, located[i].replacement);
  }
  return located.length;
}

/**
 * The strict response contract sent to /api/ai/chat/quick. `docText` should
 * already be capped by the caller (ChatQuickRequestSchema caps message at
 * 8000 chars server-side).
 */
export function buildPatchPrompt(instruction: string, docText: string): string {
  return [
    "You are applying a SURGICAL edit to the user's open Canvas document.",
    'Current document (plain text):',
    '"""',
    docText,
    '"""',
    `User instruction: ${instruction}`,
    '',
    'Respond with ONLY a JSON object — no prose, no markdown code fences:',
    '{"operations":[{"anchor":"<exact substring copied verbatim from the document>","replacement":"<new text>"}]}',
    'Rules:',
    `- 1 to ${MAX_PATCH_OPS} operations; change ONLY what the instruction targets.`,
    `- Each anchor MUST be copied character-for-character from the document, be at most ${MAX_ANCHOR_CHARS} characters, and occur exactly once in it.`,
    '- Keep anchors as short as possible while remaining unique (a phrase or one full line).',
    '- "replacement" fully replaces the anchor text. Plain text only — no markdown syntax.',
    '- Write replacements in the same language as the document.',
  ].join('\n');
}
