# Agent Interrupt And Resume Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jak `Chat`, `Teresa`, `proposal-only` flows i async agent work sa przerywane, wznawiane i bezpiecznie odzyskiwane bez utraty trust i governance.

---

## 1. Why this document exists

Dobry system agentowy nie zyje tylko w idealnym happy path.

Musi umiec obsluzyc:

- przerwane nagranie,
- przerwana rozmowe glosowa,
- przejscie usera do innego modulu,
- timeouty i failure,
- przerwane tlo lub async job,
- review, ktore wraca po czasie.

Bez tego system jest kruchy.

---

## 2. Inherited truth

This document inherits:

- `CHAT_APPLICATION_AGENT_RUNTIME_V8.md`
- `TERESA_VOICE_CHAT_RAIL_V8.md`
- `VOICE_TRUST_AND_APPROVALS_V8.md`
- `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `AI_PROPOSAL_ONLY_APPLICATION_MODE_V8.md`
- `AGENT_EXECUTION_V8_SSOT.md`

Rule:

`interrupt and resume must preserve state truth, not simulate continuity with guesswork`

---

## 3. Interrupt classes

Canonical interrupt classes:

- `user_navigation_interrupt`
- `voice_capture_interrupt`
- `speech_output_interrupt`
- `network_or_provider_interrupt`
- `approval_wait_interrupt`
- `background_runtime_interrupt`
- `permission_or_policy_interrupt`

Each interrupt should preserve:

- `interrupt_id`
- `interrupt_class`
- `source_session_or_run_ref`
- `active_state_before_interrupt`
- `resume_possible`
- `resume_pack_ref?`
- `failure_summary?`

---

## 4. Resume object

Canonical resume object:

`RunResumePack`

Minimum fields:

- `resume_pack_id`
- `source_ref`
- `source_type`
- `assistant_or_worker_ref`
- `mode`
- `state_snapshot_ref`
- `context_snapshot_ref`
- `pending_proposal_ref?`
- `resume_window_expires_at?`
- `resume_requirements`

---

## 5. Resume rules by surface

### 5.1 Teresa voice session

May resume:

- last mode
- last active module context
- last unresolved proposal
- last unfinished interpreted instruction

Must not fake:

- spoken content that was never confirmed
- approval that did not happen
- context that has since changed materially

### 5.2 Proposal-only work

May resume:

- pending review
- draft proposal preview
- waiting-for-approval state

Must revalidate:

- permissions
- tenant policy
- active artifact state

### 5.3 Background work

May resume:

- checkpointed job
- waiting-for-approval branch
- retryable read-only or idempotent work

Must not auto-resume:

- non-idempotent mutation without explicit guard

---

## 6. State machine doctrine

Interrupt-aware states should include:

- `active`
- `interrupted_resumable`
- `interrupted_non_resumable`
- `waiting_for_review`
- `resume_ready`
- `resume_expired`
- `failed_recovery_available`

Rule:

`resume_ready` is not the same thing as `still active`

---

## 7. Teresa-specific behavior

If Teresa rail is interrupted:

- the user should know whether the session can continue
- a resumable session should preserve visible context summary
- pending proposal state should remain visible
- the system may degrade to text mode when voice cannot safely resume

Examples:

- voice permission lost -> resume as text review
- user navigated away -> resume Teresa rail in same governed context if still valid
- speech synthesis interrupted -> proposal remains, speaking can restart independently

---

## 8. Approval interactions

Interrupts must not change approval meaning.

That means:

- pending review remains pending review
- expired review remains expired
- interrupted voice flow does not become approval by implication
- resumed flow must still show what is awaiting decision

---

## 9. Context revalidation

Before resume, the system should re-check:

- active module or artifact still exists
- permissions still allow the action
- tenant or policy scope did not change
- source freshness did not invalidate the proposal

If revalidation fails:

- do not fake seamless continuation
- show a governed failure or restart path

---

## 10. User-facing recovery paths

The user should see one of:

- `Resume where you left off`
- `Review pending proposal`
- `Retry in text mode`
- `Recreate proposal with updated context`
- `Cannot resume, context changed`

These should be product-native controls, not support-only behavior.

---

## 11. Risks and anti-patterns

- resumed session assumes old context without revalidation
- interrupted voice session loses proposal state silently
- background mutation replays automatically after unsafe failure
- approval semantics change after resume
- resume UX pretends continuity where the state was actually lost

---

## 12. Acceptance criteria

- one interrupt vocabulary exists across chat, Teresa and async agent work
- resumable vs non-resumable states are explicit
- resume uses state snapshots, not guesswork
- approval and proposal meaning survive interruption
- Teresa rail can degrade safely without losing trust
