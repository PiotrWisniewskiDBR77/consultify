# Operator Support And Failure Recovery v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac support-grade doctrine dla rekonstrukcji, diagnozy i odzyskiwania bledow w `Chat`, `Teresa`, async runs i proposal/apply flows.

---

## 1. Why this document exists

Silny system AI bez operator-grade recovery szybko staje sie kosztowny w utrzymaniu.

To dotyczy szczegolnie:

- Teresa voice flows,
- background work,
- approvals,
- proposals,
- apply errors,
- policy and permission failures.

Potrzebny jest jeden dokument opisujacy jak operator i support:

- widza stan,
- rozumieja failure,
- odzyskuja flow,
- nie lamia governance.

---

## 2. Inherited truth

This document inherits:

- `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`
- `AGENT_INTERRUPT_AND_RESUME_RUNTIME_V8.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

Rule:

`support must reconstruct what happened without inventing state or bypassing policy`

---

## 3. Failure classes

Canonical failure classes:

- `provider_or_network_failure`
- `tool_or_adapter_failure`
- `permission_or_policy_failure`
- `stale_context_failure`
- `voice_capture_or_tts_failure`
- `approval_state_failure`
- `non_idempotent_apply_failure`

Each failure should preserve:

- `failure_id`
- `failure_class`
- `execution_run_ref?`
- `proposal_ref?`
- `assistant_or_worker_ref?`
- `surface_ref`
- `failure_summary`
- `recovery_path`

---

## 4. Operator support surfaces

Support should have access to:

- run timeline
- proposal and approval history
- resume eligibility
- failure summaries
- routing and degraded-mode explanation
- policy block explanation

This is not the same thing as unrestricted access to private content.

---

## 5. Recovery paths

Canonical recovery actions:

- `resume`
- `retry_read_only`
- `retry_with_revalidation`
- `rebuild_proposal`
- `handoff_to_user_review`
- `handoff_to_admin_or_support`
- `close_as_non_recoverable`

Each recovery path must state:

- who can trigger it
- whether approval is needed
- whether context must be revalidated
- whether prior state remains auditable

---

## 6. Teresa and voice recovery

Support and runtime should distinguish:

- speech interrupted but proposal intact
- transcript partial and untrusted
- voice failed but text fallback available
- session resumable vs not resumable

Teresa support doctrine must avoid pretending that an interrupted voice action was fully understood if confirmation never happened.

---

## 7. Apply and proposal recovery

If apply fails:

- the originating run must remain visible
- the proposal must remain reconstructable
- result must clearly show `not applied`, `partially applied` or `applied with warnings`

If proposal generation fails:

- support should know whether failure came before or after durable state creation

---

## 8. Policy and permission recovery

When policy or permission blocks the flow:

- the operator should see what class of policy blocked it
- the system should not encourage hidden override
- the recovery path should be policy-correct

Examples:

- request new approval
- reduce scope
- rerun under valid permission
- stop and explain block

---

## 9. Audit doctrine

Operator support should be able to answer:

- what the user asked for
- what run and proposal were created
- what model or runtime path was used
- why the action did not complete
- what safe next step exists

If support cannot answer these, the runtime is not leader-grade.

---

## 10. Risks and anti-patterns

- support sees local UI hints instead of durable state
- retry path is offered for unsafe non-idempotent failure
- operator tools bypass policy because diagnostics are incomplete
- voice failures are summarized without confidence boundaries
- proposal history disappears after failed apply

---

## 11. Acceptance criteria

- one operator recovery doctrine exists across chat, Teresa and async work
- failure classes and recovery paths are durable and explainable
- support can reconstruct execution without bypassing privacy or governance
- voice and proposal/apply failures have explicit recovery semantics
