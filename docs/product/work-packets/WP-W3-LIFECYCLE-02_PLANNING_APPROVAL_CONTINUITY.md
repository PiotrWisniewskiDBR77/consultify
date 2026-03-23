# WP-W3-LIFECYCLE-02 — Planning and Approval Continuity Analysis

> Status: Completed
> Packet: WP-W3-LIFECYCLE-02
> Wave: 3 — First transformation lifecycle
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` — initiative lifecycle and change-management doctrine
> - `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` — decomposition of initiatives into tasks, decisions, milestones
> - `TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` — readiness and gap audit for tasks and decisions
> - `PORTFOLIO_PROGRAM_CONTROL_AND_PRIORITIZATION_RUNTIME_V8.md` — portfolio/program layer above initiatives
> - `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md` — planning doctrine for baselines, dependencies, capacity, critical path
> Supporting anchors read:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.4 — Wave 3 definition
> - `WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md` — approval model and execution spine
> - `DECISION_LOG_WAVE_1.md` — binding decisions (Decisions 13–15 on approval/re-planning)
> - `WP-W3-LIFECYCLE-01` — not yet written; skipped per instructions

---

## 1. Initiative → Task decomposition model

### 1.1 Canonical decomposition chain

The canonical decomposition from `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §2 is:

```
initiative → milestones → tasks → decisions → execution signals → reporting outputs
```

This is not a loose association. The runtime contract states:

> `tasks and decisions are not parallel truth to initiatives; they are initiative-native execution objects`

This means every `InitiativeTask` and `InitiativeDecision` must carry an explicit `initiative_id` linkage. There is no valid state where a task exists in the execution layer without a traceable initiative parent.

### 1.2 Object classes in the decomposition

From `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §3, the canonical work object classes are:

| Object class | Role in decomposition |
|---|---|
| `InitiativeTask` | Executable work unit, child of initiative |
| `InitiativeDecision` | First-class blocker or enabler, child of initiative |
| `InitiativeMilestone` | Planning checkpoint, groups tasks and gates |
| `InitiativeDependency` | Structural relationship between tasks, milestones, or initiatives |
| `InitiativeExecutionSignal` | Runtime signal from execution back to initiative state |

### 1.3 Decomposition depth

`TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §4 explicitly supports:

- parent/child hierarchy within tasks
- decomposition into subtasks or work packages
- move across initiative structure where policy allows

However, `TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` §3.1 identifies a gap: **subtask hierarchy depth and work breakdown structure parity are under-specified**. The canonical docs do not define a maximum depth, a canonical WBS level naming convention, or rules for when decomposition is "sufficient."

### 1.4 Decomposition integrity rules

For planning continuity, the following rules must hold during decomposition:

1. **Initiative linkage is mandatory.** Every task must carry `initiative_id`. Tasks without initiative linkage are orphans and violate the runtime contract.
2. **Milestone linkage is recommended for critical work.** `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §7 flags missing milestone links as a readiness warning.
3. **"Why" preservation.** Every task must carry a `reason` or `why_this_task_exists` field (§4). This preserves the planning intent from the initiative level.
4. **Expected outcome preservation.** Every task must carry an `expected_outcome` field (§4), linking back to the initiative's KPI and expected-outcome definition.

### 1.5 AI-proposed decomposition

Both manually authored and AI-proposed tasks are supported (§4). AI-proposed tasks require governed acceptance before they become execution truth (`TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §8):

> `AI for tasks and decisions must help both with content quality and execution quality`

The approval spine from `WP-W1-AI-03` applies: AI-proposed decomposition enters as `ActionProposal` with `proposal_type = create_artifact`, requiring either human or policy approval before becoming durable.

---

## 2. Initiative → Decision linkage

### 2.1 Decisions as first-class initiative objects

`TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §5 establishes decisions as first-class execution blockers or enablers, not metadata on tasks:

> `a blocked initiative often needs a decision, not just another task`

### 2.2 Decision lifecycle within initiative context

The canonical decision states are:

| State | Semantics |
|---|---|
| `decision_candidate` | Identified need, not yet formalized |
| `pending_decision` | Formalized, awaiting resolution |
| `approved_decision` | Resolved affirmatively |
| `rejected_decision` | Resolved negatively |
| `expired_or_escalated` | Unresolved past deadline or escalated to higher authority |

### 2.3 Decision → initiative binding requirements

Decisions must preserve:

- **Explicit decider ownership** — who is responsible for the decision
- **Decision options and recommendation** — structured options, not free-text
- **Consequences of non-decision** — what happens if the decision is not made
- **Blocked work count and affected objects** — quantified impact on tasks and milestones
- **Escalation state** — whether the decision has been escalated
- **Implementation follow-through** — how the decision result feeds into tasks, gates, or schedule changes

### 2.4 Decision chains and approval depth

`TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` §3.4 identifies a gap: **multi-step approvals, delegated approvals, and richer approval-chain semantics** need more explicit doctrine. The current canon supports single-decider and escalation, but committee-style review and conditional decisions are listed as "where needed" without full specification.

### 2.5 Relationship to the execution proposal approval spine

The initiative-level decision model and the AI execution proposal approval model (from `WP-W1-AI-03`) are distinct but must interoperate:

- **Initiative decisions** are business decisions made by stakeholders about scope, approach, resources, or trade-offs.
- **Execution proposals** are AI-generated action proposals requiring human or policy approval before mutation.

When an AI agent proposes a decision resolution (e.g., recommending option A over option B), this enters the execution proposal spine as `proposal_type = request_human_decision`. The initiative decision object is updated only after the proposal is approved and applied.

---

## 3. Approval state continuity

### 3.1 Initiative-level approval in the lifecycle

From `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §2, the initiative lifecycle includes an explicit `approval` gate:

```
source → draft → review → planning → approval → scheduling → execution → delivery closure → benefits tracking
```

The `approval` gate is the point where the initiative's scope, timeline, resources, and expected outcomes are formally accepted. This approval state must propagate to all downstream objects.

### 3.2 Propagation rules

When an initiative is approved:

1. **Planning baseline is locked.** The approved baseline (scope, timeline, milestones, dependencies) becomes the reference point for all change management (§6).
2. **Tasks inherit initiative approval context.** Tasks created after approval exist within an approved initiative. Tasks created before approval (during planning phase) must be re-validated against the approved baseline.
3. **Decisions inherit initiative governance context.** Decisions made within an approved initiative carry the initiative's governance chain (who approved, under what assumptions).
4. **Changes require governed change path.** Post-approval changes follow the change management doctrine (§5): `change detected → change proposal → impact review → approval where required → apply → audit`.

### 3.3 Change classes affecting approval continuity

From `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §5, the system distinguishes:

| Change class | Impact on approval continuity |
|---|---|
| `scope_change` | May invalidate task decomposition; requires re-approval if material |
| `timeline_change` | May invalidate milestone and dependency structure |
| `resource_change` | May invalidate task ownership and capacity assumptions |
| `budget_change` | May invalidate financial impact inputs and economic analysis linkage |
| `dependency_change` | May invalidate critical path and cross-initiative sequencing |
| `risk_response_change` | May require new decisions or task additions |
| `closure_readiness_change` | May affect what constitutes acceptable completion |

### 3.4 Approval state at the task level

The canonical docs do not define a separate task-level approval gate equivalent to the initiative-level approval. Tasks have a `status` lifecycle (creation → execution → completion) but not a formal approval state.

**Continuity implication:** Task-level approval is inherited from the initiative. A task within an approved initiative is implicitly authorized. If the initiative's approval is revoked or suspended (e.g., due to a material scope change), all tasks should reflect this — they should not continue executing against a revoked baseline.

### 3.5 Decision-level approval propagation

Decisions carry their own approval state (§2.2 above), but the initiative's approval context constrains them:

- Decisions within an approved initiative operate under the initiative's governance authority.
- If the initiative is not yet approved, decisions are provisional — they may be overridden during the approval gate.
- Post-approval decisions that materially change scope or timeline should trigger the change management path.

---

## 4. Planning integrity (baselines, milestones, dependencies)

### 4.1 Baseline doctrine

From `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md` §3, every schedulable initiative must preserve:

- planned start
- planned end
- milestone set
- dependency set
- planning assumptions
- last approved baseline

The critical rule:

> `schedule truth should distinguish current plan from current execution reality`

### 4.2 Baseline preservation through decomposition

When an initiative is decomposed into tasks, the planning baseline must flow through:

| Initiative baseline element | Task-level manifestation |
|---|---|
| Planned start / end | Task due or target timing (§4 of runtime contract) |
| Milestone set | Task-to-milestone linkage |
| Dependency set | `InitiativeDependency` objects linking tasks and milestones |
| Planning assumptions | Inherited context; should be accessible from task detail |
| Approved baseline | Tasks are validated against the approved baseline; deviations are change-managed |

### 4.3 Change management for baseline integrity

From `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §6, changes must preserve:

- previous baseline
- proposed new baseline
- impact summary
- approver or policy path
- applied result

This means task-level changes that affect the initiative baseline (e.g., a task delay that shifts a milestone) must propagate upward and trigger the change management path if material.

### 4.4 Capacity and workload continuity

From `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md` §4, planning must consider:

- named owners
- team allocation
- overlapping initiatives
- workload density over time
- feasibility of milestone sequencing

`TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` §3.5 identifies a gap: **task-level effort, time, and cost rollups still need clearer product-level hardening.** This means the continuity path from initiative capacity planning to task-level workload is not yet fully closed.

### 4.5 Critical path continuity

From `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md` §5, the system must identify:

- critical dependencies
- milestone chains
- likely blockers to start or finish
- schedule drift that threatens delivery

For planning continuity, the critical path must be computable from the task graph, not only from the initiative-level milestone structure. This requires that `InitiativeDependency` objects accurately reflect the task-level dependency reality.

### 4.6 Replan and what-if support

From `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md` §6:

- proposed reschedule
- impact preview
- dependency-aware alternatives
- workload-safe alternatives
- governance check where baseline changes are material

Replanning at the task level must feed back into the initiative baseline. A task-level replan that does not update the initiative baseline creates a truth divergence.

---

## 5. Gate and lifecycle continuity

### 5.1 Initiative gates

The initiative lifecycle from `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §2 defines the following gate sequence:

```
source → draft → review → planning → approval → scheduling → execution → delivery closure → benefits tracking
```

Each transition is a gate. The key continuity question is: **how does task completion feed back into initiative gate progression?**

### 5.2 Task completion → initiative progress

The canonical model defines `InitiativeExecutionSignal` as the mechanism for feeding execution reality back to the initiative level. However, the exact semantics of how task completions aggregate into initiative progress are not fully specified.

**Derived rules from the canon:**

1. **Milestone completion** should be the primary gate-progression signal. When all tasks linked to a milestone are complete, the milestone is complete, and the initiative can progress toward the next gate.
2. **Decision resolution** is a prerequisite for gate progression where decisions block milestone completion.
3. **Closure requires more than task completion.** `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §7 explicitly states: "An initiative should not be treated as complete only because tasks are mostly done." Closure requires delivery completion evidence, open risk review, unresolved decision review, KPI handoff, and owner sign-off.

### 5.3 Lifecycle continuity rules

| Gate transition | Required continuity evidence |
|---|---|
| `planning → approval` | Complete decomposition (tasks, milestones, dependencies), baseline defined, capacity assessed |
| `approval → scheduling` | Approved baseline locked, tasks have owners and timing |
| `scheduling → execution` | Schedule committed, dependencies validated, capacity confirmed |
| `execution → delivery closure` | All critical tasks complete, all blocking decisions resolved, delivery evidence collected |
| `delivery closure → benefits tracking` | KPI handoff, ROI handoff where applicable, owner sign-off |

### 5.4 Readiness warnings as gate guards

From `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` §7, the system should surface readiness warnings when decomposition is weak:

- no owner
- no due timing
- no decision owner
- no milestone link for critical work
- no acceptance condition for completion-sensitive work
- no blocker link where blocked-by-decision is the real reason
- no effort signal where workload balancing depends on the task

These warnings should function as soft gate guards: they do not hard-block gate transitions but make the initiative's readiness state honest and visible.

---

## 6. Portfolio/program governance impact

### 6.1 Portfolio layer above initiatives

From `PORTFOLIO_PROGRAM_CONTROL_AND_PRIORITIZATION_RUNTIME_V8.md` §2:

> `portfolio control does not replace initiative truth; it governs how many initiatives can coexist and in what shape`

This means portfolio decisions constrain but do not override initiative planning.

### 6.2 Portfolio governance objects affecting task planning

| Portfolio object | Impact on initiative → task planning |
|---|---|
| `PortfolioPriorityDecision` | May reprioritize an initiative, affecting task urgency and sequencing |
| `CapacityArbitrationRecord` | May reallocate resources, affecting task ownership and timeline |
| `CrossInitiativeDependencyRef` | May introduce external dependencies that constrain task scheduling |
| `PortfolioBenefitsReview` | May trigger scope changes if benefits are not materializing |

### 6.3 Prioritization impact on planning continuity

From §4.1, prioritization considers:

- strategic alignment
- benefit potential
- urgency
- dependency ordering
- readiness
- capacity realism

A portfolio reprioritization decision can cascade into initiative-level changes:

1. **Initiative paused or delayed** → all tasks should reflect the pause; execution should not continue against a paused initiative.
2. **Initiative accelerated** → task timelines may compress; capacity and dependency validation must re-run.
3. **Initiative rejected** → tasks should be cancelled or archived; no orphan execution.

### 6.4 Cross-initiative dependency governance

From §4.3, the system must support:

- dependency mapping across initiatives
- dependency risk visibility
- blocked-by-other-initiative logic
- sequencing and release-window implications

For planning continuity, cross-initiative dependencies must be visible at the task level. If Initiative A's Task 3 depends on Initiative B's Milestone 2, this dependency must be modeled as an `InitiativeDependency` with cross-initiative scope, and it must be visible in critical path computation.

### 6.5 Governance audit trail

From §5, portfolio governance must preserve:

- who prioritized
- why
- which trade-offs were accepted
- which initiatives were delayed, paused, or rejected
- what assumptions were used
- what capacity or financial reality constrained the choice

This audit trail must be accessible from the initiative and task levels so that planning decisions can be traced back to portfolio governance.

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream packet/capability | What this packet provides | Consequence if missing |
|---|---|---|
| **WP-W3-LIFECYCLE-03 — Execution visibility** | The decomposition model and approval continuity rules define what "execution-ready" means. Task objects entering execution must carry initiative linkage, baseline context, and approval state. | Execution layer receives tasks without governance context; execution visibility is disconnected from planning intent |
| **WP-W3-LIFECYCLE-04 — Handoff integrity** | The gate and lifecycle continuity model defines what must be true before handoff to operator and reporting layers. Closure evidence requirements flow from this packet. | Handoff occurs without verifiable planning-to-execution continuity |
| **Delivery reporting and execution risk** | The baseline preservation and change management model provides the reference point for variance reporting. Without it, reporting cannot distinguish planned vs. actual. | Reporting shows execution state without planning context; variance analysis is impossible |
| **AI execution support** | The AI-proposed decomposition rules and the interop with the execution proposal spine define how AI participates in planning. | AI creates tasks outside the governed decomposition model |
| **Results and KPI tracking** | The expected-outcome preservation through decomposition ensures that task completion can be linked back to initiative KPIs. | Task completion is tracked but cannot be connected to business outcomes |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W3-LIFECYCLE-01 — Source truth preservation** | How initiative source context is captured and preserved before decomposition begins | Not yet written |
| **WP-W1-AI-03 — Execution proposal approval spine** | The approval model for AI-proposed mutations, including task creation | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 13–15 | Review expiration (72h), re-planning within same run, mixed-mode batch approval | Ratified |
| **Canonical initiative and task docs** | Domain model definitions, lifecycle, change management | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Subtask hierarchy depth is undefined

`TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` §3.1 flags that subtask hierarchy depth and WBS parity are under-specified. The runtime contract allows parent/child hierarchy and subtask decomposition but does not define:

- Maximum nesting depth
- Canonical WBS level naming (e.g., phase → deliverable → work package → task → subtask)
- Rules for when decomposition is "sufficient" for gate readiness

**Recommendation:** Define a canonical WBS depth model (suggest 3–4 levels max for v8) and a readiness heuristic for decomposition sufficiency.

### 8.2 Task-level approval gate is absent

The initiative lifecycle has an explicit `approval` gate, but tasks do not have a separate approval state. Tasks inherit authorization from the initiative. This works for most cases but creates ambiguity for:

- Tasks added after initiative approval (are they automatically authorized?)
- Tasks that materially change scope (should they trigger initiative-level re-approval?)

**Recommendation:** Define a policy rule: tasks added post-approval that exceed a materiality threshold (e.g., affect budget, timeline, or scope beyond a defined tolerance) must trigger the initiative change management path. Tasks within tolerance are implicitly authorized.

### 8.3 Task-level effort rollup is under-specified

`TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` §3.5 identifies that task-level effort, time, and cost rollups need clearer hardening. Without this, the continuity path from initiative capacity planning to task-level workload is incomplete.

**Recommendation:** Define a canonical effort model at the task level (estimated hours, actual hours, cost rate where applicable) and a rollup contract to initiative milestones and baselines.

### 8.4 Cross-initiative dependency modeling at task level

`PORTFOLIO_PROGRAM_CONTROL_AND_PRIORITIZATION_RUNTIME_V8.md` §4.3 defines cross-initiative dependency governance, but the `InitiativeDependency` object in the runtime contract does not explicitly specify cross-initiative scope. It is implied but not formalized.

**Recommendation:** Extend the `InitiativeDependency` schema to explicitly support `source_initiative_id` and `target_initiative_id` fields for cross-initiative dependencies, and ensure these are visible in critical path computation.

### 8.5 Decision chain depth for multi-step approvals

`TASK_AND_DECISION_COMPLETENESS_AUDIT_V8.md` §3.4 flags that multi-step approvals, delegated approvals, and committee-style review need more explicit doctrine. The current canon supports single-decider and escalation but not formal approval chains.

**Recommendation:** Define a decision-chain model that supports sequential approval (A then B), parallel approval (A and B), and delegated approval (A delegates to C) as first-class patterns. This is needed for enterprise-grade initiative governance.

### 8.6 No conflicts detected between canonical docs

The following pairs were checked for consistency:

- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` lifecycle ↔ `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` decomposition chain: Consistent. The runtime contract's decomposition chain is a refinement of the initiative lifecycle's execution phase.
- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` change classes ↔ `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md` replan doctrine: Consistent. Both require baseline preservation and governed change paths.
- `PORTFOLIO_PROGRAM_CONTROL_AND_PRIORITIZATION_RUNTIME_V8.md` governance ↔ `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` lifecycle: Consistent. Portfolio control governs coexistence; initiative lifecycle governs individual initiative truth.
- `WP-W1-AI-03` approval spine ↔ `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md` decision model: Consistent but distinct. The execution proposal spine governs AI-proposed mutations; the decision model governs business decisions. Both can coexist without conflict.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Initiative → Task decomposition model with canonical chain, object classes, depth analysis, and integrity rules
  - Initiative → Decision linkage with decision lifecycle, binding requirements, and relationship to execution proposal spine
  - Approval state continuity from initiative-level approval through task inheritance and change management
  - Planning integrity analysis covering baselines, milestones, dependencies, capacity, critical path, and replan support
  - Gate and lifecycle continuity with gate-progression signals, closure requirements, and readiness warnings
  - Portfolio/program governance impact on task planning including prioritization cascades and cross-initiative dependencies
  - Downstream dependency map covering execution visibility, handoff integrity, reporting, AI support, and results tracking
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Subtask hierarchy depth is undefined (§8.1) — needs product decision before WBS-dependent features
  - Task-level effort rollup is under-specified (§8.3) — blocks capacity-to-task continuity
  - Cross-initiative dependency schema needs explicit formalization (§8.4)
- **Questions requiring escalation:**
  1. What is the canonical WBS depth model for v8? Should the system enforce a maximum nesting depth for task decomposition? (§8.1)
  2. Should tasks added post-initiative-approval that exceed a materiality threshold trigger the initiative change management path? What defines "material"? (§8.2)
  3. Should the `InitiativeDependency` object be formally extended to support cross-initiative scope with explicit source/target initiative fields? (§8.4)
  4. Is a formal decision-chain model (sequential, parallel, delegated approval) in scope for v8, or deferred? (§8.5)
