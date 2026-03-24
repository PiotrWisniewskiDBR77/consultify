# WP-W1-AI-03 — Execution Proposal and Approval Spine Analysis

> Status: Completed
> Packet: WP-W1-AI-03
> Wave: 1 — Platform and governance spine
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `AGENT_EXECUTION_V8_SSOT.md` — primary execution agent concept
> - `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` — HITL governance
> - `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` — §3 Phase A (runtime spine) and Phase B (adapters)
> - `CHAT_V8_RUNTIME_TRUTH_MAP.md` — runtime truth for chat surface
> - `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` — §6.2 Wave 1 and §6.5 Wave 4
> - `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` — canonical run/proposal spine
> - `work-packets/WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md` — ContextSnapshot baseline
> - `work-packets/DECISION_LOG_WAVE_1.md` — binding decisions

---

## 1. ExecutionAgentRun lifecycle

### 1.1 State machine

The canonical lifecycle merges the state vocabulary from `AGENT_EXECUTION_V8_SSOT.md` §8 and `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §3.1. The normalized state machine for Wave 1 is:

```
                          ┌──────────────────────────────────────────────────────┐
                          │                                                      │
  ┌──────────┐   ┌──────────┐   ┌──────────────────┐   ┌────────────────────┐  │
  │ drafting  │──>│ planning  │──>│ proposals_ready  │──>│ waiting_for_review │  │
  └──────────┘   └──────────┘   └──────────────────┘   └────────────────────┘  │
                                                              │                  │
                          ┌───────────────────────────────────┤                  │
                          │                                   │                  │
                          v                                   v                  │
                   ┌──────────────┐                    ┌───────────┐             │
                   │   rejected   │                    │ approved  │             │
                   └──────────────┘                    │ _for_apply│             │
                                                       └───────────┘             │
                                                              │                  │
                                                              v                  │
                                                       ┌───────────┐             │
                                                       │  applying  │             │
                                                       └───────────┘             │
                                                         │       │               │
                                                         v       v               │
                                                  ┌──────────┐ ┌────────┐       │
                                                  │ completed│ │ failed │       │
                                                  └──────────┘ └────────┘       │
                                                                                 │
                                       ┌───────────┐  ┌──────────┐              │
                                       │ cancelled  │  │ expired  │<─────────────┘
                                       └───────────┘  └──────────┘
```

### 1.2 State definitions

| State | Semantics | Who triggers |
|---|---|---|
| `drafting` | Run created from intake; goal captured, context being assembled | System (on chat intake) |
| `planning` | Agent is decomposing intent into steps and building an `ExecutionPlan` | Agent (automatic after drafting) |
| `proposals_ready` | Plan is complete; `ProposalSet` with one or more `ActionProposal`s is compiled | Agent (automatic after planning) |
| `waiting_for_review` | Proposals are presented to the user for review | System (automatic after proposals_ready) |
| `approved_for_apply` | User or policy has approved the proposal set (full or partial) | User (explicit approval) or Policy engine |
| `rejected` | User has rejected the proposal set; run cannot proceed on rejected proposals | User (explicit rejection) |
| `applying` | Approved proposals are being dispatched to module adapters | System (automatic after approval) |
| `completed` | All approved proposals have been successfully applied | System (on adapter success) |
| `failed` | One or more apply steps failed; partial results may exist | System (on adapter failure) |
| `cancelled` | User or system explicitly cancelled the run before completion | User or System |
| `expired` | Run remained in `waiting_for_review` beyond the expiration threshold without a decision | System (time-based) |

### 1.3 Transition rules

1. **Forward-only for the happy path.** `drafting → planning → proposals_ready → waiting_for_review → approved_for_apply → applying → completed`.
2. **Rejection is terminal for the rejected proposals** but the run may remain open if partial approval is in effect.
3. **Expiration applies only to `waiting_for_review`.** A run that has been approved cannot expire.
4. **Cancellation is available from any non-terminal state** (`drafting`, `planning`, `proposals_ready`, `waiting_for_review`, `approved_for_apply`, `applying`).
5. **Failure does not erase the proposal trail** (`AGENT_EXECUTION_V8_SSOT.md` §8). The run transitions to `failed` with full audit of what succeeded and what did not.
6. **Re-planning loop.** From `rejected`, the user may request a revised plan. This creates a new plan version within the same run, transitioning back to `planning`. The rejected proposal set is preserved for audit.

### 1.4 Partial approval semantics

The run supports partial approval at the `ProposalSet` level:

- Individual proposals within a set can be `approved`, `rejected`, or left `pending_review`.
- The run transitions to `approved_for_apply` when at least one proposal is approved and the user confirms intent to proceed.
- Rejected proposals within a partially-approved set remain in `rejected` state and are not dispatched.
- The run's final state reflects partial completion: `completed` if all approved proposals succeeded, `failed` if any approved proposal failed.

---

## 2. Proposal schema

### 2.1 Normalized `ActionProposal` structure

The proposal schema synthesizes `AGENT_EXECUTION_V8_SSOT.md` §9.4, `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §3.3, and the ContextSnapshot binding from `WP-W1-AI-01`.

| Field | Type | Required | Description |
|---|---|---|---|
| `proposal_id` | uuid | yes | Unique identifier |
| `execution_run_id` | uuid | yes | Parent run reference |
| `context_snapshot_ref` | uuid | yes | Reference to the `ContextSnapshot` active at proposal creation time (WP-W1-AI-01 binding) |
| `proposal_type` | enum | yes | Action family from the taxonomy (§2.3) |
| `target_ref` | `ArtifactRef` | yes | Target artifact being created or mutated |
| `summary` | string | yes | Human-readable description of what will change |
| `reason` | string | yes | Why this change is proposed |
| `mutation_description` | `MutationDescriptor` | yes | Structured description of the intended change (§2.4) |
| `risk_class` | enum | yes | `safe_additive` · `safe_update` · `sensitive_update` · `destructive` · `governance_transition` |
| `approval_class` | enum | yes | `requires_human_approval` · `policy_approvable` · `auto_executable` |
| `preview_payload` | `ActionPreview` | no | User-facing preview of the change (diff, before/after, impact) |
| `depends_on` | `proposal_id[]` | no | Ordering dependencies within the proposal set |
| `status` | enum | yes | `draft` · `pending_review` · `approved` · `rejected` · `expired` · `policy_allowed` |
| `created_at` | timestamp | yes | When the proposal was created |
| `resolved_at` | timestamp | no | When the proposal was approved, rejected, or expired |
| `resolved_by` | ref | no | Who or what resolved the proposal (user ref or policy ref) |

### 2.2 ContextSnapshot binding

Every `ActionProposal` must carry a `context_snapshot_ref` that points to the `ContextSnapshot` captured at proposal creation time (per WP-W1-AI-01 §1.2). This binding ensures:

1. **Traceability.** The proposal can be audited against the exact context (workspace, project, role, scope) that produced it.
2. **Drift detection.** At apply time, the execution layer compares the proposal's snapshot against the current resolved state (Decision 1 compliance — see §5).
3. **Support reconstruction.** Operators can inspect the full identity chain for any proposal.

### 2.3 Proposal type taxonomy

Derived from `AGENT_EXECUTION_V8_SSOT.md` §10.1 action families:

| Proposal type | Description | Typical risk class |
|---|---|---|
| `create_artifact` | Create a new domain object | `safe_additive` |
| `update_artifact` | Modify fields of an existing artifact | `safe_update` or `sensitive_update` |
| `transform_artifact` | Structural transformation (reorder, restructure, convert) | `sensitive_update` |
| `link_artifacts` | Create or modify relationships between artifacts | `safe_update` |
| `workflow_transition` | Move an artifact through a governance workflow state | `governance_transition` |
| `generate_structured_output` | Produce a structured deliverable (report section, slide, table schema) | `safe_additive` |
| `review_or_quality_pass` | Run a quality, completeness, or compliance check | `safe_additive` |
| `request_human_decision` | Escalate a decision point to the user | N/A (meta-action) |

### 2.4 `MutationDescriptor`

Structured description of the intended change, enabling both preview rendering and audit:

| Field | Type | Required | Description |
|---|---|---|---|
| `operation` | enum (`create` · `update` · `delete` · `transition` · `link`) | yes | Canonical mutation verb |
| `target_fields` | string[] | no | Which fields will be affected (for updates) |
| `payload_summary` | object | no | Key-value summary of the intended new values |
| `reversibility` | enum (`reversible` · `partially_reversible` · `irreversible`) | yes | Whether the mutation can be undone |
| `estimated_impact` | string | no | Human-readable impact description |

### 2.5 `ActionPreview`

User-facing preview object, derived from `AGENT_EXECUTION_V8_SSOT.md` §9.5:

| Field | Type | Description |
|---|---|---|
| `diff` | object | Structured diff (field-level or content-level) |
| `before_state` | object | Snapshot of current state for affected fields |
| `after_state` | object | Projected state after mutation |
| `created_objects` | ref[] | New objects that would be created |
| `updated_fields` | string[] | Fields that would change |
| `destructive_impact` | string | Description of irreversible consequences, if any |
| `followup_effects` | string[] | Side effects or downstream consequences |

---

## 3. Approval model

### 3.1 Approval states

The approval model synthesizes `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` §4–4.1, `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §6, and `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.5.

| State | Semantics | Durability |
|---|---|---|
| `pending_review` | Proposal is awaiting a human or policy decision | Durable; visible in UI and audit |
| `human-approved` | A human user explicitly approved the proposal | Durable; records `resolved_by` (user ref) and `resolved_at` |
| `policy-approved` | An automated policy rule approved the proposal without requiring human review | Durable; records `resolved_by` (policy ref) and the policy rule that applied |
| `rejected` | A human user explicitly rejected the proposal | Durable; records reason, `resolved_by`, `resolved_at`. Does not disappear from the audit trail (`AGENT_EXECUTION_V8_SSOT.md` §11.4) |
| `expired` | The proposal remained in `pending_review` beyond the configured expiration threshold without any decision | Durable; system-generated. Treated as a non-approval — the proposal cannot be applied |

### 3.2 State transitions

```
pending_review ──> human-approved ──> (apply path)
pending_review ──> policy-approved ──> (apply path)
pending_review ──> rejected ──> (terminal for this proposal; run may continue with other proposals)
pending_review ──> expired ──> (terminal; equivalent to non-approval)
```

### 3.3 Approval class determination

The `approval_class` on each proposal determines which approval path is required:

| Approval class | When assigned | Approval path |
|---|---|---|
| `requires_human_approval` | `risk_class` is `sensitive_update`, `destructive`, or `governance_transition`; or the proposal touches multiple artifacts; or org policy mandates human review for this action type | Must go through `pending_review → human-approved` |
| `policy_approvable` | `risk_class` is `safe_additive` or `safe_update` AND org policy explicitly allows auto-approval for this action type and consumer class | May be resolved as `policy-approved` without human interaction |
| `auto_executable` | Limited to non-durable, non-mutating helper actions (opening a surface, preparing a preview, generating a non-durable draft) per `AGENT_EXECUTION_V8_SSOT.md` §11.2 | Bypasses the approval gate entirely; still audited |

### 3.4 Batch approval

Per `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` §4.1, batch approval is allowed for coherent sets of low-risk proposals:

- A `ProposalSet` with `review_mode = batched` presents all proposals as one approval unit.
- Batch approval is only available when **all** proposals in the set have `approval_class = policy_approvable` or `requires_human_approval` with `risk_class` ≤ `safe_update`.
- If any proposal in the set has `risk_class` ≥ `sensitive_update`, the set falls back to `review_mode = mixed` (individual review for high-risk, batch for low-risk).

### 3.5 Escalation

Escalation is triggered when:

- A proposal has `risk_class = destructive` or `governance_transition` and the initiating user does not hold the required role.
- A proposal crosses project boundaries (multi-scope mutation).
- Org policy defines an escalation rule for the action type.

Escalated proposals transition to `pending_review` with an `escalation_reason` attached. The escalation target is determined by the project role model (`AGENT_EXECUTION_V8_SSOT.md` §14.1).

### 3.6 Distinction: human-approved vs policy-approved

This distinction is a hard requirement from `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.5 and `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` §4.1:

- **Support must be able to distinguish** whether a mutation was approved by a human or by policy.
- **Audit records must carry** the `resolved_by` field with either a user reference or a policy reference.
- **The UI must never conflate** these two states — a policy-approved action should be visually distinct from a human-approved action.

---

## 4. Proposal-to-execution flow

### 4.1 Flow overview

```
approved proposal
    │
    ├── pre-apply revalidation (§5 drift check)
    │       │
    │       ├── context still valid ──> proceed
    │       └── drift detected ──> pause, surface to user (Decision 1)
    │
    ├── adapter dispatch
    │       │
    │       ├── resolve adapter from proposal_type + target_ref.artifact_module
    │       └── call adapter with: execution_run_id, proposal_id, target_ref,
    │           approved_payload, effective_scope_snapshot_ref
    │
    ├── adapter execution
    │       │
    │       ├── adapter calls owning service
    │       └── owning service performs the mutation
    │
    └── result collection
            │
            ├── adapter returns: apply_result_id, changed_objects, result_status,
            │   warnings[], failure_summary?
            │
            ├── on success ──> proposal status = applied, run continues
            ├── on failure ──> proposal status = apply_failed, run evaluates
            │   whether to continue (partial) or halt
            └── result persisted as ApplyResult linked to proposal and run
```

### 4.2 Adapter dispatch contract

Per `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §10, every adapter accepts:

| Input | Type | Description |
|---|---|---|
| `execution_run_id` | uuid | The parent run |
| `proposal_id` | uuid | The approved proposal being applied |
| `target_ref` | `ArtifactRef` | The target artifact |
| `approved_payload` | object | The mutation payload as approved |
| `effective_scope_snapshot_ref` | uuid | The ContextSnapshot governing this execution |

Every adapter returns:

| Output | Type | Description |
|---|---|---|
| `apply_result_id` | uuid | Unique result identifier |
| `changed_objects` | ref[] | Objects actually modified |
| `result_status` | enum (`success` · `partial_success` · `failed`) | Outcome |
| `warnings` | string[] | Non-fatal issues encountered |
| `failure_summary` | string | Explanation of failure, if any |

### 4.3 Partial execution

When a `ProposalSet` contains multiple approved proposals:

1. Proposals are dispatched in dependency order (respecting `depends_on` references).
2. If a proposal fails, the orchestrator evaluates whether downstream proposals can still proceed.
3. Independent proposals (no dependency on the failed one) may continue.
4. Dependent proposals are marked `blocked_by_failure` and not dispatched.
5. The run transitions to `failed` only if the overall outcome is below the success threshold; otherwise it transitions to `completed` with partial results recorded.

### 4.4 Proposal-only mode

Per `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §8, proposal-only mode uses the same spine:

- The run stops at `waiting_for_review` or `approved_for_apply`.
- No adapter dispatch occurs.
- The approved proposals are handed off to a later governed execution path.
- The run record and proposal trail are preserved for audit.

---

## 5. Drift handling during proposal/approval

### 5.1 Decision 1 compliance

Per `DECISION_LOG_WAVE_1.md` Decision 1:

> Active run preserves `originating project context` as the canonical execution context. Chat surface may show the user's current navigation but must label it as drift. User must choose `continue in original context` or `start/rebind new run`.

This produces the following rules for the proposal/approval spine:

### 5.2 Originating context preservation

1. When an `ExecutionAgentRun` is created, the system captures a `ContextSnapshot` (per WP-W1-AI-01). This snapshot is the **originating context** for the run.
2. All proposals within the run carry `context_snapshot_ref` pointing to this originating snapshot (or a version-incremented descendant if the user explicitly rebinds).
3. The run's `effective_scope_snapshot_ref` is set at creation and does not change unless the user explicitly chooses `rebind`.

### 5.3 Drift detection during review

While a run is in `waiting_for_review`:

1. The chat surface may reflect the user's current navigation (different project, different artifact).
2. The run's proposals remain bound to the originating context.
3. The UI must label the drift: "Run started in project X; you are currently viewing project Y."
4. The user has two options:
   - **Continue in original context:** Approve/reject proposals as-is. The run proceeds in its originating scope.
   - **Start/rebind new run:** Cancel the current run and create a new one in the current context, or explicitly rebind the run to the new context (which creates a new snapshot version and re-validates all proposals).

### 5.4 Revalidation at apply time

Per WP-W1-AI-01 §3.3 and §3.4, before executing any approved mutation:

1. **Context revalidation.** Compare the run's `effective_scope_snapshot_ref` against the current resolved state. Check `workspace_id`, `project_id`, and `resolved_role_ref`.
2. **Artifact ref liveness check.** Confirm the target artifact still exists and is accessible under the current role.
3. **Role revalidation.** Confirm the initiating user still holds the permissions required for the mutation.

If any revalidation fails:

- The run pauses in `applying` state.
- The system surfaces the specific drift or permission change to the user.
- The user must re-confirm or cancel.
- No silent fallback or automatic rebind.

### 5.5 Snapshot versioning during drift

Per WP-W1-AI-01 §1.2, `snapshot_version` increments whenever any identity-chain field changes. During the proposal/approval lifecycle:

- The originating snapshot version is preserved on all proposals.
- If the user explicitly rebinds, a new snapshot version is created and all pending proposals are re-validated against it.
- The audit trail records both the original and rebind snapshot versions.

---

## 6. Audit trail requirements

### 6.1 Audit principle

From `AGENT_EXECUTION_V8_SSOT.md` §13.6 and `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §11: operators must be able to reconstruct the full chain from goal to outcome for any run.

### 6.2 Per-proposal audit record

Every proposal must persist the following for audit:

| Field | Description |
|---|---|
| `proposal_id` | Unique proposal identifier |
| `execution_run_id` | Parent run |
| `context_snapshot_ref` | The ContextSnapshot active at proposal creation |
| `proposal_type` | What kind of action was proposed |
| `target_ref` | What artifact was targeted |
| `summary` | What was proposed |
| `risk_class` | Risk classification at proposal time |
| `approval_class` | What approval path was required |
| `status` | Final status (`approved`, `rejected`, `expired`, `policy_allowed`) |
| `resolved_by` | User ref (for `human-approved`) or policy ref (for `policy-approved`) |
| `resolved_at` | When the decision was made |
| `rejection_reason` | If rejected, why (user-provided or system-generated) |

### 6.3 Per-apply audit record

Every apply action must persist:

| Field | Description |
|---|---|
| `apply_result_id` | Unique result identifier |
| `proposal_id` | Which proposal was applied |
| `execution_run_id` | Parent run |
| `adapter_ref` | Which adapter performed the mutation |
| `context_snapshot_ref` | The snapshot active at apply time (may differ from proposal time if revalidation occurred) |
| `result_status` | `success`, `partial_success`, or `failed` |
| `changed_objects` | What was actually modified |
| `failure_summary` | If failed, what went wrong |
| `completed_at` | When the apply completed |

### 6.4 Per-run audit summary

Every completed or failed run must persist:

| Field | Description |
|---|---|
| `execution_run_id` | Run identifier |
| `goal_summary` | What the user asked for |
| `originating_snapshot_ref` | The initial ContextSnapshot |
| `final_snapshot_ref` | The snapshot at completion (may differ if rebind occurred) |
| `total_proposals` | Count of proposals generated |
| `approved_count` | How many were approved |
| `rejected_count` | How many were rejected |
| `applied_count` | How many were successfully applied |
| `failed_count` | How many apply attempts failed |
| `drift_events` | Any drift or revalidation events during the run |
| `run_duration` | Wall-clock time from creation to completion |
| `final_status` | Terminal state of the run |

### 6.5 Retention policy

Per `DECISION_LOG_WAVE_1.md` Decision 3:

- **Baseline retention:** 30 days for all proposal and run records.
- **Long-term retention:** If a proposal resulted in an approved mutation, the audit lineage (proposal → approval → apply result) is preserved through the audit/event lineage system for long-term durability.
- **Snapshot retention:** ContextSnapshots follow the same 30-day baseline, with approved-mutation snapshots preserved through audit lineage.

### 6.6 Audit access model

Per WP-W1-AI-01 §4.4:

- **Support operators** can view the full audit chain for any run within their tenant.
- **Superadmin** can view across tenants.
- **End users** can see their own run history with simplified audit (goal, proposals, outcomes) but not internal resolution details.

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream packet/capability | What this packet provides | Consequence if this packet is missing |
|---|---|---|
| **WP-W1-AI-04 — Tool catalog and risk classification** | The `risk_class` and `approval_class` enums defined here are the shared vocabulary for tool governance. Tool risk classification must map onto the same risk taxonomy. | Tool governance builds a parallel risk model disconnected from the proposal spine |
| **Phase B — Module adapters** (`AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase B) | The adapter dispatch contract (§4.2) is the shared interface every module adapter must implement. | Adapters remain bespoke with incompatible input/output contracts |
| **Phase C — HITL operationally** (`AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase C) | The approval model (§3) defines the shared approval states and batch/escalation rules that HITL must implement. | HITL builds approval semantics that diverge from the execution spine |
| **Background and scheduled runtime** (Closure Wave 3) | Background runs use the same `ExecutionAgentRun` lifecycle and proposal spine. The drift model (§5) defines revalidation at checkpoints. | Background runs invent a separate execution model |
| **Output trust and provenance** (Closure Wave 6) | The audit trail (§6) provides the provenance chain from proposal to applied mutation. Trust traces bind to the same `context_snapshot_ref`. | Trust traces are disconnected from execution context |
| **Proposal-only mode** (`EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §8) | Proposal-only mode is a bounded use of this spine (§4.4), not a separate architecture. | Proposal-only forks into an incompatible system |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | `ContextSnapshot` object model, identity chain, drift model, support trace requirements | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 1, 3, 4 | Drift handling rules, retention baseline, single snapshot family | Ratified |
| **AGENT_EXECUTION_V8_SSOT.md** | Domain model definitions, lifecycle, action taxonomy, approval doctrine | Canonical |
| **EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md** | Spine objects, approval semantics, apply semantics, adapter contract | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Expiration threshold undefined

Both `AGENT_EXECUTION_V8_SSOT.md` and `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` define `expired` as a valid state, but no canonical doc specifies the expiration threshold (how long a run can remain in `waiting_for_review` before expiring).

**Recommendation:** Define a configurable default (e.g., 7 days) at the org level, with the ability to override per run class. This is a product decision, not an engineering default.

### 8.2 Re-planning loop semantics

`AGENT_EXECUTION_V8_SSOT.md` §7.5 allows the user to "request regeneration of proposal" and §8 allows partial approval. However, the exact mechanics of re-planning within a run are not specified:

- Does re-planning create a new `ExecutionPlan` version within the same run, or a new run?
- Are rejected proposals from the first plan preserved alongside the new plan?

**Analysis:** The spine doc (`EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §4) says "a proposal may not exist durably outside a run," which implies re-planning should create a new plan version within the same run. This analysis adopts that interpretation: re-planning creates a new plan version, the rejected proposal set is preserved for audit, and the run transitions back to `planning`.

**Recommendation:** Ratify this interpretation as a binding decision.

### 8.3 Partial approval granularity

`AGENT_EXECUTION_V8_SSOT.md` §11.3 says "user must be able to approve one proposal, reject another, keep run open." `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §3.4 defines `ProposalSet` with `review_mode` including `single`, `batched`, and `mixed`.

The interaction between partial approval and the `ProposalSet` review mode needs clarification:

- In `batched` mode, can the user still reject individual proposals, or is it all-or-nothing?
- In `mixed` mode, what determines which proposals are batched vs. individually reviewed?

**Recommendation:** `batched` mode is all-or-nothing for the batch. If the user wants individual control, the set should use `mixed` or `single` mode. The determination of batch vs. individual should be driven by `risk_class`: proposals with `risk_class` ≤ `safe_update` can be batched; higher risk requires individual review.

### 8.4 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `AGENT_EXECUTION_V8_SSOT.md` §8 lifecycle ↔ `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §3.1 statuses: The spine doc's statuses are a refinement of the SSOT lifecycle. No contradiction.
- `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` §4 approval chain ↔ `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` §6 approval states: Both define the same `human-approved` / `policy-approved` / `rejected` / `expired` distinction.
- `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase A ↔ `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2 Wave 1: Both identify the run + proposal + approval spine as the first Wave 1 deliverable.
- Decision 4 (one `ContextSnapshot` family) ↔ WP-W1-AI-01 §1.2: Consistent; this packet uses the single snapshot family.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Normalized `ExecutionAgentRun` lifecycle with state machine, transitions, and partial approval semantics
  - Proposal schema with ContextSnapshot binding, artifact refs, mutation descriptor, and preview structure
  - Approval model with `human-approved`, `policy-approved`, `rejected`, `expired` states, batch approval rules, and escalation triggers
  - Proposal-to-execution flow with adapter dispatch contract, partial execution handling, and proposal-only mode
  - Drift handling during proposal/approval with Decision 1 compliance (originating context preserved, revalidation at apply time)
  - Audit trail requirements with per-proposal, per-apply, and per-run records, retention policy (Decision 3: 30-day baseline), and access model
  - Downstream dependency map covering tool governance, module adapters, HITL, background runtime, and output trust
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Expiration threshold for `waiting_for_review` is undefined (§8.1) — needs a product decision before implementation
  - Re-planning loop semantics (§8.2) need ratification as a binding decision
  - Partial approval granularity in batched mode (§8.3) needs product confirmation
- **Questions requiring escalation:**
  1. What is the default expiration threshold for runs in `waiting_for_review`? Should it be configurable per org or per run class? (§8.1)
  2. Should re-planning within a rejected run create a new plan version in the same run, or spawn a new run? (§8.2)
  3. In `batched` review mode, is approval all-or-nothing for the batch, or can individual proposals still be rejected? (§8.3)
