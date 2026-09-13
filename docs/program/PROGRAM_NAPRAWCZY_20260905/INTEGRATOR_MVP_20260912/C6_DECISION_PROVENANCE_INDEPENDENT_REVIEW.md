# Decision provenance prerequisite — independent bounded ACCEPT

Exact source55fcd46a7615677cee776926403aa6a3a37d2ead, parent65fb1be3df9deaf6b8f6ad9156a14345486d3618. Two file hashes verified against manifest before and after; worktree clean. No source modifications by reviewer.

Independent17/17 route regression and3/3 actual Gateway/JWT/PG PASS, zero failures/skips. Evidence C6_DECISION_INDEPENDENT_ROUTES.json/log, C6_DECISION_INDEPENDENT_GATEWAY.json/log and C6_DECISION_INDEPENDENT_RESULT.json. Fresh fixture UUIDs on authorized local6457/cx6_export_contract; actual Gateway4216; no concurrent DB use.

Primary behavior executes real finding POST201, confirmed-readback PATCH200 and Decision handoff200. Scoped fault trigger rejects later source UPDATE: fixed INSERT nevertheless persists exact organization/sourceType interview_insight/sourceId findingId with copied finding and evidence body. Handoff receipt identifies Decision; source finding row unchanged. Additional scoped INSERT rejection produces500/P10_HANDOFF_CREATE_FAILED with no extra Decision/fallback orphan. Foreign insight/project404 and unconfirmed readback422 produce no Decision.

Author baseline2PASS/1FAIL and fixed3PASS have exact same three fullNames as independent result, compared programmatically. Normal commit hook log inspected through55fcd; author tsc exit0 remains author evidence.

Source review: route now passes existing sourceType/sourceId fields to canonical decisionService.createDecision; its existing INSERT includes both columns and content in one statement. Only redundant best-effort source-tag UPDATE/catch removed. No altered tenant gates, client readback, task/initiative paths, global service, flags, or source-aware export permission. No new blocker in this prerequisite.

Fixture audit: transient triggers/functions scoped to fresh organization; test compares complete original decision trigger definitions after finally cleanup. Independent post-run catalog confirms current_database cx6_export_contract,0 cx6_provenance triggers and0 fault functions. API4216 closed and pools terminal. Resources returned to root for built acceptance coordination, not automatically reassigned elsewhere.

Limits: atomic content+source INSERT only; no claim of one transaction spanning history/notification/handoff registration. Parent Insight/operator-note are explicit fixtures; no actual LLM generation/client confirmation workflow/Notebook proof. No backfill or permission for historical NULLsource; full Decisions content export and E4 remain open. Combined RC2 must be reconciled and checked separately without importing held base or overwriting accepted root fixes.
