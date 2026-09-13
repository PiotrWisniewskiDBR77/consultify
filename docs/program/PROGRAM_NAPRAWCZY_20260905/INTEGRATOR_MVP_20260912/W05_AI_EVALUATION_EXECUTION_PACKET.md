# W05 follow-up — AI evaluation authorization and read-only open

Status: READY AFTER CURRENT W05 EXACT-SHA CHECKPOINT. Owner: delivery_audit (C4). Independent reviewer: scope_audit. Integrator: root. Existing full-MVP/Interview mandate DEC-2026091201; no live/provider calls, no new module. Current W05 must first commit unchanged scope and hand exact SHA to reviewer. Start follow-up on a new codex branch from that SHA, preserving its reviewability and all existing evidence. This replaces the C4 implementation slot rather than creating a third concurrent product block.

## Problem and required result

Read W05_AI_EVALUATION_ACCESS_FINDING.md in full. Source review found org-only access before evaluation and assignment snapshot writes in both legacy and V8. Runtime exploit remains NOT_PROVEN. Opening a submitted card also starts evaluation and can mutate snapshot/timestamps; the revoke observation showed a separate in-flight evaluation, so equality around approve403 is not global quiescence.

Deliver one shared object-scoped authorization policy before questions/provider and revalidation before persistence after asynchronous evaluation. Derive allowed respondent/team/scoped-reviewer operations from existing Interview contracts and tests; document the concrete mapping. Preserve anonymous boundaries and legal ad-hoc sessions. Read permission alone must not silently imply arbitrary persisted AI mutation. Persisted org/project/assignment consistency, revocation, stale JWT role and assignment/status/version drift must be handled honestly. Do not hold a database transaction open across the model call. Preserve timeout/error/redaction semantics and prevent a late completion from overwriting a newer evaluation or timeout.

Opening/reloading the submitted record must adopt an existing review snapshot without silently recomputing and writing it. Keep the existing explicit evaluation action and submission flow effective; use existing surfaces, no second chat/panel or replacement workflow. A missing result must remain visibly missing/pending with the available action, not a fabricated score. Existing approved/lifecycle rules must be read and retained; do not invent a blanket new status policy simply to pass tests.

## Evidence and scope

Implement and retain the six evidence groups in the independent finding: both routes; real JWT/persisted permissions; denial before provider with provider count0 and no derived sentinel; deterministic revoke/project/assignment/status drift during evaluation; anonymous/empty/503/timeout; browser readonly open/reload plus explicit authorized evaluation and final SQL readback. Use controlled local evaluator dependency only for deterministic allowed-path behavior; never call it proof of real AI quality. No paid/live provider call or tenant data export.

Keep the exact same test names/denominator for a targeted authorization mutation RED→GREEN and preserve the real manager cycle. Report pre-existing findings separately. First current-W05 SHA review can continue concurrently against its immutable source while this follow-up progresses. If review requires fixes to that earlier patch, coordinate commits with root; do not rewrite reviewed history.

Deliver source/test diff, exact SHA, commands/exits, runtime identity and fixture lineage, all observed requests and before/after fields, browser evidence, remaining gaps. Root alone integrates after independent review. Full MVP and other queued C6/W17/IE work remain open.
