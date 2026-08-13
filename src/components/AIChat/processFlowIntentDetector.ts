/**
 * Detects if a chat message is a process flow / workflow intent.
 * Returns the best matching pf_* action if detected, or null.
 *
 * ── ROLLBACK-ONLY (chapter 13 audit, 2026-08-10) ─────────────────────────
 * See `mindmapIntentDetector.ts`'s header for the full kill-switch mechanics
 * (same gate: `shouldUseLegacyIdeaIntentFallback(teresaIdeaActionsEnabled)`,
 * same sole caller `UnifiedChatPanel.tsx`, same default-ON = inert-but-intact
 * today). Per-action registry coverage for THIS file (verified against
 * `ideaActionRegistry.ts` before writing this comment):
 *   • pf_add_step     → `idea.element.add` (RUNTIME_ADD_ELEMENT) — genuine
 *                       equivalent.
 *   • pf_add_decision → `idea.view.pf_add_decision` — genuine equivalent.
 *   • pf_analyze      → `idea.ai.process_analysis` (same
 *                       `runProcessCoach`/`handleAICoach` call already wired
 *                       to the toolbar's "AI Coach") — genuine equivalent.
 *   • pf_create       → NO registry equivalent. Real, tested handler
 *                       (`useProcessFlowQuickActions.ts` `createFromPrompt`,
 *                       a genuine `flow_generator` AI pipeline call, opens
 *                       the AI proposal panel) — grep-confirmed this
 *                       handler has NO caller anywhere except this bus
 *                       action, so "generate a whole process from a
 *                       description" is UNREACHABLE by any live path today.
 *   • pf_add_lane     → NO registry equivalent, AND grep-confirmed
 *                       `addLane()` (`IdeaProcessFlowTool.tsx`) has NO other
 *                       caller anywhere — not even a UI button. This
 *                       capability was ALREADY chat-only before the
 *                       registry migration; today it's simply unreachable.
 * Both gaps flagged as follow-ups (real capability with zero live surface),
 * not fixed here — would need new registry entries + Teresa parameters.
 * Do NOT delete this file or trim any pattern from it — see
 * `mindmapIntentDetector.ts`'s header for why a partial rollback is worse
 * than the current honest one.
 */

const PF_INTENT_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  // EN patterns
  {
    pattern:
      /\b(create|build|map|design|draw|model)\s+(a\s+)?(process|workflow|flow|pipeline|procedure)\b/i,
    action: 'pf_create',
  },
  {
    pattern: /\b(add|insert|create)\s+(a\s+)?(step|action|task|activity|stage)\b/i,
    action: 'pf_add_step',
  },
  {
    pattern: /\b(add|insert|create)\s+(a\s+)?(decision|gateway|branch|condition)\b/i,
    action: 'pf_add_decision',
  },
  {
    pattern: /\b(add|insert|create)\s+(a\s+)?(lane|swimlane|swim-lane|department)\b/i,
    action: 'pf_add_lane',
  },
  {
    pattern: /\b(bpmn|value\s*stream|vsm)\b/i,
    action: 'pf_create',
  },
  {
    pattern: /\b(optimize|analyze|bottleneck|improve)\s+(the\s+)?(process|workflow|flow)\b/i,
    action: 'pf_analyze',
  },
  // PL patterns
  {
    pattern:
      /\b(stwórz|utwórz|zacznij|zmapuj|zaprojektuj|narysuj)\s+(proces|przepływ|workflow|procedur)\b/i,
    action: 'pf_create',
  },
  {
    pattern: /\bdodaj\s+(krok|akcj[ęa]|zadanie|czynność|etap)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'pf_add_step',
  },
  {
    pattern: /\bdodaj\s+(decyzj[ęa]|bramk[ęa]|warunek|rozgałęzienie)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'pf_add_decision',
  },
  {
    pattern: /\bdodaj\s+(tor|ścieżk[ęa]|dział)(?![a-ząćęłńóśźż0-9_])/i,
    action: 'pf_add_lane',
  },
  {
    pattern: /\b(optymalizuj|analizuj|wąskie\s*gardło|usprawnij)\s+(proces|przepływ)\b/i,
    action: 'pf_analyze',
  },
];

export function detectProcessFlowIntent(message: string): string | null {
  for (const { pattern, action } of PF_INTENT_PATTERNS) {
    if (pattern.test(message)) return action;
  }
  return null;
}
