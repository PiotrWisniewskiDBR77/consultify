/**
 * Approval Pattern Service — intentionally NOT implemented (HP-9 audit, 2026-07-14)
 *
 * Harvey-Parity plan (Harvard/wdrozenie-100/_PLAN_HARVEY_PARITY_2026-07-11.md,
 * HP-9) asked to either replace this stub with a real service or document that
 * its logic lives in HP-7 (artifact draft→review→approved workflow, see
 * server/src/services/artifactApprovalService.ts). AUDIT FINDING: it does
 * NOT — this is a genuinely different, unrelated feature:
 *
 *   - HP-7 / artifactApprovalService.ts = a state machine (draft/review/
 *     approved/rejected) for a single artifact, driven by a human reviewer.
 *   - ApprovalPatternService (this file) = a HITL "learn from past decisions"
 *     auto-decide engine for AI ACTION proposals — it would watch a user's
 *     approve/reject history per actionType and auto-approve/auto-reject
 *     future low-risk proposals once enough matching decisions accumulate
 *     (canAutoDecide/recordDecision/findMatchingPattern/calculateConfidence/
 *     getPatternStats/getUserPatterns/setAutoApply/deletePattern — see the
 *     call sites below). Nothing in HP-6/HP-7 builds or replaces this.
 *
 * Why it is safe to leave unimplemented:
 *   - server/src/services/aiActionExecutor.ts dynamically imports this module
 *     and treats `{ __unavailable__: true }` as "feature off": every call
 *     site (canAutoDecide, recordDecision, findMatchingPattern,
 *     getPatternStats, getUserPatterns, setPatternAutoApply, deletePattern)
 *     null-checks `ApprovalPatternService` first and falls back to a
 *     no-op/empty/zeroed result. Confirmed by reading aiActionExecutor.ts —
 *     no code path throws or breaks when this stub is present.
 *   - server/src/routes/ai.routes.ts's `/patterns*` endpoints that would
 *     actually surface this to the client are COMMENTED OUT (GET
 *     /patterns/stats, PATCH /patterns/:id/auto-apply, DELETE /patterns/:id —
 *     see "APPROVAL PATTERNS" section). Only GET /patterns is live, and it
 *     already short-circuits to `{ success: true, patterns: [] }` without
 *     touching this service. So today NOTHING reachable from the outside
 *     depends on this stub doing real work.
 *
 * tests/unit/backend/services/approvalPatternService.test.ts exercises a
 * hand-rolled `approval_patterns`/`approval_requests` schema that does not
 * exist anywhere in server/migrations/ and never imports this module — it is
 * decorative (tests generic SQL, not this service) and does not contradict
 * the "unimplemented" status above.
 *
 * If a real learned-pattern auto-decide engine is wanted later, it is a
 * distinct Fable-sized architecture task (own schema: pattern definitions +
 * decision history, own confidence/auto-apply UX) — not a mechanical
 * follow-on of HP-7. Track it separately from the Workflow Engine (Blok B).
 */
const approvalPatternService = { __unavailable__: true } as const;

export default approvalPatternService;
