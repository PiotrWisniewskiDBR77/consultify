/**
 * nodeCap — Process Flow node-count guardrail (G4-PF-GUARDRAIL).
 *
 * Process Flow had NO node cap of any kind (unlike Mind Map's soft 500-node
 * banner — `mindmap/LargeMapOptimizer.tsx` THRESHOLDS.AUTO_SIMPLIFY,
 * `IdeaRecommendationMap.tsx` "mapReached500NodeLimitAdding" — and
 * Whiteboard's hard block on `addElement` at `nodes.length >= 500`,
 * `IdeaWhiteboardTool.tsx:2549`) while its mount cost is measurably the
 * WORST of the four canvas tools: super-linear growth reaching a multi-ten-
 * second mean mount time at N=1,000
 * (docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md
 * §4.3, and this stream's own rerun — see tests/performance/
 * ideaProcessFlowTool.mount.bench.test.tsx).
 *
 * Convention followed: Whiteboard's warn-then-block shape (soft warning
 * toast, then a hard toast.error + refusal at the ceiling) — not a new third
 * mechanism. Generalized here to a resulting-count check
 * (`currentCount + addCount`) so a BULK add (AI-proposal acceptance, paste,
 * cross-tool conversion/import) can't jump straight past the ceiling in one
 * step the way a naive "current count >= threshold" check would allow.
 */

/** Soft warning banner — same numeric threshold Whiteboard uses for its own warning. */
export const PROCESS_FLOW_NODE_WARN_THRESHOLD = 200;

/**
 * Hard ceiling. Chosen to match Whiteboard's own hard block (500) — see the
 * G4-PF-GUARDRAIL benchmark rerun for the measured justification: after the
 * EdgeRehydrateFix O(n²)→O(n) fix (this stream), Process Flow's mount cost at
 * N=500 is back in the same order of magnitude as Whiteboard's at N=500, so
 * reusing the sibling's own ceiling is measured, not just copied for
 * consistency's sake.
 */
export const PROCESS_FLOW_NODE_LIMIT = 500;

export interface ProcessFlowNodeCapCheck {
  /** Total node count if this add were to proceed. */
  nextCount: number;
  /** Whether the add should proceed at all (resulting count within the hard ceiling). */
  allowed: boolean;
  /** Whether the resulting count crosses the soft-warning threshold (still allowed). */
  shouldWarn: boolean;
}

/**
 * Pure decision function — no React, no i18n, no toast. Callers combine this
 * with a localized toast at each of Process Flow's node-adding entry points
 * (manual add, paste/duplicate, AI generate/expand accept, insert-between/
 * split-path, ghost-accept, cross-tool conversion/import).
 */
export function checkProcessFlowNodeCap(
  currentCount: number,
  addCount: number,
  limit: number = PROCESS_FLOW_NODE_LIMIT,
  warnThreshold: number = PROCESS_FLOW_NODE_WARN_THRESHOLD
): ProcessFlowNodeCapCheck {
  const nextCount = currentCount + Math.max(0, addCount);
  return {
    nextCount,
    allowed: nextCount <= limit,
    shouldWarn: nextCount >= warnThreshold,
  };
}
