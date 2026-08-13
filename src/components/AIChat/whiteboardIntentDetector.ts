/**
 * Detects if a chat message is a whiteboard/brainstorm/workshop intent.
 * Returns the best matching wb_* action if detected, or null.
 *
 * ── ROLLBACK-ONLY (chapter 13 audit, 2026-08-10) ─────────────────────────
 * See `mindmapIntentDetector.ts`'s header for the full kill-switch mechanics
 * (same gate, same sole caller `UnifiedChatPanel.tsx`, same default-ON =
 * inert-but-intact today). Per-action registry coverage for THIS file
 * (verified against `ideaActionRegistry.ts` before writing this comment):
 *   • wb_add_sticky → `idea.element.add` (RUNTIME_ADD_ELEMENT) — genuine
 *                     registry equivalent.
 *   • wb_add_cluster / wb_add_theme → NO registry equivalent, AND
 *                     grep-confirmed NEITHER has any OTHER live UI trigger
 *                     anywhere in `src/` — the two static catalogs that look
 *                     like they'd wire a button to these
 *                     (`whiteboardContracts.ts`'s `WHITEBOARD_ACTIONS`,
 *                     `canvasOsContract.ts`'s `CANVAS_OS_RAIL`/
 *                     `getCanvasOsActions`) have ZERO importers anywhere —
 *                     dead catalogs, not real UI. Worth noting: a PRIOR
 *                     audit (see `IdeaAISuggestionsPanel.tsx`'s "P1-5"
 *                     comment) already removed `wb_add_cluster`/
 *                     `wb_add_theme`/`wb_add_outcome` from an "AI
 *                     Generators" panel for promising AI analysis while
 *                     actually inserting an EMPTY labeled sticky — these two
 *                     patterns here ("organize/cluster my notes" →
 *                     wb_add_cluster, "identify themes" → wb_add_theme) risk
 *                     the same weak expectation (a bare insert, not
 *                     analysis), even though they're not labeled "AI"
 *                     anywhere in THIS file. Flagged for a product decision,
 *                     not silently cut here.
 * Do NOT delete this file or trim any pattern from it — see
 * `mindmapIntentDetector.ts`'s header for why a partial rollback is worse
 * than the current honest one.
 */

const WB_INTENT_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  // EN patterns
  {
    pattern: /\b(create|start|open|make)\s+(a\s+)?(brainstorm|whiteboard|workshop|board)\b/i,
    action: 'wb_add_sticky',
  },
  {
    pattern: /\b(organize|cluster|group)\s+(my\s+)?(notes|ideas|stickies|board)\b/i,
    action: 'wb_add_cluster',
  },
  { pattern: /\b(affinity|affinity\s*map)\b/i, action: 'wb_add_cluster' },
  { pattern: /\badd\s+(sticky|stickies|notes?)\b/i, action: 'wb_add_sticky' },
  { pattern: /\b(identify|extract)\s+(themes?|outcomes?|decisions?)\b/i, action: 'wb_add_theme' },
  // PL patterns
  {
    pattern:
      /\b(stwórz|utwórz|zacznij|otwórz)\s+(burz[eę]|tablicę|warsztat|board)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'wb_add_sticky',
  },
  {
    pattern: /\b(organizuj|grupuj|klasteryzuj)\s+(notatki|pomysły|board)\b/i,
    action: 'wb_add_cluster',
  },
  {
    pattern: /\bdodaj\s+(notatk[ięa]|karteczk[ięa])(?![a-ząćęłńóśźż0-9_])/i,
    action: 'wb_add_sticky',
  },
  { pattern: /\b(wyodrębnij|zidentyfikuj)\s+(temat|wynik|decyzj)\b/i, action: 'wb_add_theme' },
];

export function detectWhiteboardIntent(message: string): string | null {
  for (const { pattern, action } of WB_INTENT_PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return null;
}
