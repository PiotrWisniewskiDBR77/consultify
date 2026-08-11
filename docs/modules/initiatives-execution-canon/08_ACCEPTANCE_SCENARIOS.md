---
doc_id: initiatives-execution-acceptance-scenarios
truth_type: acceptance_contract
status: canonical
owner: product-qa-engineering
version: 1.0
last_reviewed: 2026-08-09
---

# Acceptance scenarios

## 1. Evidence required for every scenario

- exact build/deployment SHA;
- environment, tenant, project and acting roles;
- starting database state;
- UI actions and visible states;
- request/response and persisted records;
- audit events;
- post-write read-back in every affected projection;
- retry/idempotency result;
- negative/permission/degraded variation;
- screenshots for desktop and supported responsive breakpoint.

## 2. Golden flows

### GF-01 Proposal registration

Given a source-backed Proposal in validation, an authorized Source Validator chooses Register. One Registered Initiative is created with immutable source lineage; retry does not duplicate it; the source receives read-back; unauthorized user cannot register.

### GF-02 Definition and readiness

Given a Registered Draft, the Initiative Owner completes definition and required analysis. Missing Finance/KPI/evidence is shown literally and prevents readiness where policy requires it. Teresa may draft recommendations but cannot approve. A versioned snapshot is created before requesting decision.

### GF-03 Portfolio decision

Given comparable Initiatives, the Portfolio Owner builds two scenarios. Differences, coverage, duplicate value, confidence and override rationale are visible. Authorized authority approves one scenario; selected records become Approved Backlog and excluded/deferred records retain reason and follow-up.

### GF-04 Plan-capacity loop

Given Approved Backlog, PMO sequences tentative windows. Unknown demand/supply remains unknown. Capacity conflict produces alternatives. Schedule requires approved window, roles, baseline and capacity commitment. Drag alone never changes committed status.

### GF-05 Execution handoff

Given Scheduled Initiative, Execution Manager receives a versioned Handoff Pack. Accept creates or links exactly one Execution Case and returns read-back; rejection records missing requirements; retry is idempotent.

### GF-06 Task and Decision flow

Given an active Execution Case, Task and Decision appear in Praca and personal My Work projections. Type-specific actions and authority apply. Completion/decision writes canonical truth, audit and parent read-back without creating local copies.

### GF-07 Resource balancing

Given assignments and remaining estimates in one time window, a conflict shows exact affected work and confidence. User simulates reassignment, sees date/cost/risk impact, obtains approval and writes through canonical resource API. Unknown availability prevents false utilization claims.

### GF-08 Intervention

Given a deduplicated critical signal, Sterowanie shows source, evidence, blast radius and options. A human approves bounded action. Write/read-back succeeds or fails honestly. Verify-by date is created and later records effective/partial/ineffective.

### GF-09 Report run

Given a Report Definition and scope, generation creates a persisted draft run with source versions, freshness, completeness and confidence. Reviewer drills to sources, freezes and approves. Export/share creates distribution evidence. Refresh creates a new run rather than mutating the published one.

### GF-10 Delivery to effectiveness closure

Given accepted delivery, status becomes Delivered and Results receives benefits handoff. Benefits Tracking begins only with KPI owner/contract. Effectiveness Review records confirmed/partial/not achieved, then closure decision and archive preserve lineage.

### GF-11 Card remediation to gate

Given a mandatory Initiative card with a blocker finding, the owner creates one linked remediation Task. It appears in the same card and assignee's My Work. Completion without required evidence does not clear the finding. Accepted evidence recomputes readiness and the exact gate becomes submittable; retry creates no duplicate Task.

### GF-12 Task blocked by Decision

Given a Task that cannot proceed without an authorized choice, the user links one Decision Case. The Task shows the exact blocker and the Decision shows blast radius. Decision evidence, chain, reminder and escalation are auditable. A conditional published outcome creates follow-up Tasks idempotently and causes re-evaluation rather than blind unblocking.

### GF-13 Material card change after approval

Given an approved Initiative, a scope, owner, KPI target, budget envelope, critical dependency or target-window change opens a versioned proposal. Before write the user sees old/new values, affected Tasks/Decisions/milestones/capacity/Finance/Results/handoff, tolerance and required approver. Authorized approval publishes atomically and every projection reads back the new version; rejection leaves prior truth intact.

### GF-14 My Work is a projection

Given the same Task, Decision and input request in Initiative and My Work, actions in either surface update the same IDs and versions. Snooze changes personal presentation only. A delayed projection shows synchronization pending and correlation ID, never a locally forged success or duplicate object.

## 3. Mandatory negative scenarios

| ID | Scenario | Expected result |
| --- | --- | --- |
| NEG-01 | unknown status migration | `MIGRATION_REVIEW_REQUIRED`, no guessed transition |
| NEG-02 | missing approver | gate blocked with assignment path, no self-approval |
| NEG-03 | cross-tenant access | no data leak and audited denial |
| NEG-04 | stale scenario after source change | publish blocked or explicit refresh/review required |
| NEG-05 | duplicate command/retry | one durable effect, same idempotent result |
| NEG-06 | partial multi-object write | honest partial/failure state and safe recovery |
| NEG-07 | missing baseline/estimate | no on-time/health/utilization claim |
| NEG-08 | AI proposal rejected | no canonical mutation; proposal history retained if policy requires |
| NEG-09 | export/distribution denied | no artifact leak; run remains valid internally |
| NEG-10 | read-back timeout | pending/failed visible with retry; no false success |
| NEG-11 | inaccessible linked source | restricted relation without content disclosure |
| NEG-12 | archive/stop/cancel | required decision, reason, impact and policy enforced |
| NEG-13 | mandatory card marked not applicable | authorized waiver and reason required; gate otherwise blocked |
| NEG-14 | Task completion without evidence | remains unaccepted and does not complete milestone/gate |
| NEG-15 | Decision deletion with linked blockers | soft cancellation retained in history; affected work requires replacement/waiver |
| NEG-16 | material write version conflict | no overwrite; current version and reconciliation diff returned |

## 4. UI state acceptance matrix

For each of nine functions verify:

- first-use empty with real setup action;
- filtered empty with reset;
- loading skeleton preserving layout;
- preview-only error without blanking registry;
- partial enrichment failure;
- stale source with as-of;
- unknown distinct from zero;
- conflicting sources and resolution path;
- permission-restricted action with correct explanation/hiding rule;
- saving, saved, save failed and conflict separate from lifecycle;
- keyboard row navigation, preview open/close and focus return;
- responsive preview drawer and Workbench context preservation;
- dark/light semantic parity and WCAG contrast.

## 5. Acceptance datasets

Maintain at least three non-production datasets:

- `Lite`: one project, few Initiatives, simple Sponsor governance, limited dependencies;
- `Standard`: multiple Initiatives, Finance/KPI links, capacity and schedule conflicts;
- `Complex`: multi-program dependencies, scarce shared skills, staged funding, board/quorum, rollout waves and partial benefits.

Fixtures must include valid, sparse, stale, conflicting and restricted records. Demo seeds are not acceptance proof unless they persist through the same production code paths.
