# Execution Run And Proposal Spine v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jedna kanoniczna prawde dla `ExecutionAgentRun`, `ActionProposal`, approval graph i apply spine, tak aby `Chat`, `Teresa`, `Execution Agent` i modulowe adaptery korzystaly z jednego modelu wykonania.

---

## 1. Why this document exists

Dokumentacja execution i chat wielokrotnie pokazuje ten sam problem:

- mamy proposal semantics,
- mamy approvals,
- mamy execution direction,
- ale nadal nie ma jednej wspolnej spine, ktora laczy te elementy w jeden system.

Bez tego:

- kazdy modul interpretuje proposal troche inaczej,
- support nie ma jednej prawdy,
- chat i execution moga sie rozchodzic,
- aplikacja wyglada mocno, ale pozostaje fragmentaryczna.

---

## 2. Inherited truth

This document inherits:

- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_EXECUTION_V8_GAP_MATRIX.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`
- `CHAT_APPLICATION_AGENT_RUNTIME_V8.md`
- `AI_PROPOSAL_ONLY_APPLICATION_MODE_V8.md`
- `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`

Rule:

`all durable AI work must converge on one run and proposal spine`

---

## 3. Canonical objects

## 3.1 `ExecutionAgentRun`

Represents one governed unit of AI work.

Fields:

- `execution_run_id`
- `initiated_from_surface`
- `initiated_by_ref`
- `assistant_or_agent_ref`
- `goal_summary`
- `run_class`
- `status`
- `effective_scope_snapshot_ref`
- `active_plan_ref?`
- `proposal_set_ref?`
- `audit_ref`

Statuses:

- `drafting`
- `planning`
- `proposals_ready`
- `waiting_for_review`
- `approved_for_apply`
- `applying`
- `completed`
- `failed`
- `cancelled`
- `expired`

## 3.2 `ExecutionPlan`

Fields:

- `plan_id`
- `execution_run_id`
- `step_graph_ref`
- `summary`
- `risk_summary`
- `assumptions`
- `status`

## 3.3 `ActionProposal`

Fields:

- `proposal_id`
- `execution_run_id`
- `proposal_type`
- `target_ref`
- `summary`
- `reason`
- `risk_summary`
- `preview_payload`
- `approval_class`
- `approval_required`
- `status`

## 3.4 `ProposalSet`

Fields:

- `proposal_set_id`
- `execution_run_id`
- `proposal_refs[]`
- `review_mode`
- `set_status`

Review modes:

- `single`
- `batched`
- `mixed`

## 3.5 `ApprovalGraph`

Fields:

- `approval_graph_id`
- `execution_run_id`
- `checkpoint_refs[]`
- `decision_state`
- `last_decision_at?`

## 3.6 `ApplyResult`

Fields:

- `apply_result_id`
- `execution_run_id`
- `proposal_id`
- `adapter_ref`
- `result_status`
- `changed_objects[]`
- `failure_summary?`
- `completed_at?`

---

## 4. Canonical lifecycle

The minimum lifecycle is:

`intake -> run created -> plan prepared -> proposal set prepared -> review -> approve or reject -> apply path -> audit and outcome`

Important rules:

- a proposal may not exist durably outside a run
- an apply action must trace back to a proposal
- an approval must trace back to a review checkpoint
- a saved result must trace back to the originating run

---

## 5. Proposal semantics

Every proposal in the spine must answer:

- what will be changed
- on what object
- why this is proposed
- what assumptions and risks exist
- what happens after approval
- what adapter or apply path will be used

This must be true whether the proposal came from:

- chat,
- Teresa,
- execution agent,
- future bounded subagent work.

---

## 6. Approval semantics

Approval states must remain explicit:

- `pending_review`
- `approved`
- `rejected`
- `expired`
- `escalated`
- `policy_allowed`

Important:

- `approved` does not automatically mean `applied`
- `policy_allowed` must remain distinct from human approval
- `rejected` must be durable, not local UI disappearance

---

## 7. Apply semantics

Apply must always be modeled as:

`approved proposal -> adapter call -> owning service -> apply result`

No canonical path should be:

`assistant text -> direct module mutation -> maybe later audit`

Rule:

`apply belongs to the spine, not to hidden side effects`

---

## 8. Relationship to proposal-only mode

`proposal-only` mode still uses this spine.

The difference is:

- the run may stop at `waiting_for_review`
- or stop at `approved_for_apply`
- and hand off to a later governed execution path

This means proposal-only is not a separate truth.
It is a bounded use of the same spine.

---

## 9. Relationship to Teresa and chat

If Teresa creates a proposal:

- it should attach to one `ExecutionAgentRun` or proposal-only run object
- the proposal should still use the same canonical schema
- approval and review must remain reconstructable later

This gives:

- continuity from chat to execution,
- one audit path,
- one proposal language across surfaces.

---

## 10. Relationship to module adapters

Every adapter should accept:

- `execution_run_id`
- `proposal_id`
- `target_ref`
- `approved_payload`
- `effective_scope_snapshot_ref`

Every adapter should return:

- `apply_result_id`
- `changed_objects`
- `result_status`
- `warnings[]`
- `failure_summary?`

Without this contract, adapters remain bespoke and fragment the system.

---

## 11. Audit and support doctrine

The spine must let operators reconstruct:

- what goal started the run
- what plan was generated
- what proposals existed
- which checkpoint approved or rejected them
- what was actually applied
- where and why it failed if it failed

This is the minimum support-grade explainability bar.

---

## 12. Risks and anti-patterns

- one module has its own proposal truth
- approval means something different in chat and execution
- apply happens without a stable run reference
- proposal-only mode forks into a second incompatible architecture
- support sees results but not the originating proposal chain

---

## 13. Acceptance criteria

- one canonical run object exists for durable AI work
- one proposal schema exists across surfaces
- one approval graph vocabulary exists
- apply always traces back to approved proposals
- proposal-only mode and full execution share the same spine rather than diverging
