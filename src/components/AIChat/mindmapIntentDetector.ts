/**
 * Detects if a chat message is a mind map / idea map intent.
 * Returns the best matching mm_* action if detected, or null.
 *
 * ── ROLLBACK-ONLY (chapter 13 audit, 2026-08-10) ─────────────────────────
 * This is the pre-registry regex command path chapter 13 forbids as a
 * SECOND live surface ("Jedna funkcja ma jeden commandId i handler") — kept
 * intentionally as a documented ROLLBACK, not a parallel executor. Its sole
 * caller is `UnifiedChatPanel.tsx`, gated by
 * `shouldUseLegacyIdeaIntentFallback(teresaIdeaActionsEnabled)`
 * (`src/actions/teresaActionManifest.ts`) — `teresaIdeaActionsEnabled`
 * defaults to `true` (`VITE_ENABLE_TERESA_IDEA_ACTIONS !== 'false'`), so
 * TODAY this file's output is computed but never acted on: the governed
 * Action Registry (`ideaActionRegistry.ts` → `teresaActionManifest.ts` →
 * LLM tool-calling → `executeTeresaTool`) is the one active execution path.
 * Only an explicit `VITE_ENABLE_TERESA_IDEA_ACTIONS=false` reactivates this
 * file — confirmed by grep: `UnifiedChatPanel.tsx` is this file's ONLY
 * importer anywhere in `src/`.
 *
 * Per-action registry coverage (verified against `ideaActionRegistry.ts`
 * before writing this comment, not assumed):
 *   • mm_add_child     → `idea.element.add` (RUNTIME_ADD_ELEMENT, same
 *                        `addChildNode` call) — genuine registry equivalent.
 *   • mm_add_sibling   → `idea.node.mm_add_sibling` — genuine equivalent.
 *   • mm_expand_branch → `idea.node.mm_ai_expand_node` (same
 *                        `handleAIExpand` call the toolbar/menu already use)
 *                        — genuine equivalent, just needs an explicit
 *                        `nodeId` instead of "whatever's selected".
 *   • mm_create        → NO registry equivalent. Real, tested handler
 *                        (`useMindMapQuickActions.ts` `#DEAD-ACTIONS` block,
 *                        seeds `idea.body` + renames root + AI-expands) —
 *                        approximable by composing `idea.node.mm_edit` +
 *                        `idea.node.mm_ai_expand_node`, but NOT the same
 *                        single call, and the `idea.body` seed step has no
 *                        registry path at all.
 *   • mm_apply_framework → NO registry equivalent. Real handler (applies a
 *                        SWOT/PEST template matched from the prompt text) —
 *                        `idea.templates.open` only OPENS the template
 *                        gallery for a human to pick from, it does not
 *                        auto-apply by keyword. This means "apply SWOT" from
 *                        chat is UNREACHABLE by any live path today (no UI
 *                        button calls this logic either) whenever the
 *                        default-ON flag keeps this file's output unused —
 *                        flagged as a follow-up, not fixed here (would need
 *                        a new registry entry + Teresa parameters).
 * Do NOT delete this file or trim any pattern from it: doing either would
 * make "turn the flag off" a PARTIAL, silently-degraded rollback instead of
 * the real one it is today — see chapter-13 review report for the full
 * per-detector table (mm/pf/wb vs `tableIntentDetector.ts`, which is a
 * DIFFERENT concern entirely, see that file's own header).
 */

const MM_INTENT_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  // EN patterns
  {
    pattern:
      /\b(create|start|build|make|open)\s+(a\s+)?(mind\s*map|idea\s*map|recommendation\s*map|concept\s*map)\b/i,
    action: 'mm_create',
  },
  {
    pattern:
      /\b(expand|explore|branch|decompose|break\s*down)\s+(the\s+)?(idea|node|branch|topic|concept)\b/i,
    action: 'mm_expand_branch',
  },
  {
    pattern: /\b(add|create|insert)\s+(a\s+)?(child|branch|sub-?topic|sub-?node)\b/i,
    action: 'mm_add_child',
  },
  {
    pattern: /\b(add|create|insert)\s+(a\s+)?(sibling|parallel|alternative|neighbor)\b/i,
    action: 'mm_add_sibling',
  },
  {
    pattern: /\b(swot|strengths?\s+and\s+weaknesses|pest|pestle)\b/i,
    action: 'mm_apply_framework',
  },
  {
    pattern: /\b(map|visualize|diagram)\s+(the\s+)?(structure|hierarchy|breakdown|dependencies)\b/i,
    action: 'mm_create',
  },
  // PL patterns
  {
    pattern:
      /\b(stwórz|utwórz|zacznij|zbuduj|otwórz)\s+(mapę\s+(myśli|rekomendacji|pomysłów|koncepcji|idei))\b/i,
    action: 'mm_create',
  },
  {
    pattern:
      /\b(rozwiń|eksploruj|rozgałęź|rozłóż)\s+(pomysł|węzeł|gałąź|temat|koncep)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_expand_branch',
  },
  {
    pattern: /\bdodaj\s+(gałąź|dziecko|pod-?temat|pod-?węzeł)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_add_child',
  },
  {
    pattern: /\bdodaj\s+(sąsiad|rodzeństwo|alternatyw|równoległ)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_add_sibling',
  },
  {
    pattern: /\b(zmapuj|zwizualizuj)\s+(strukturę|hierarchię|zależności)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'mm_create',
  },
];

export function detectMindmapIntent(message: string): string | null {
  for (const { pattern, action } of MM_INTENT_PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return null;
}
