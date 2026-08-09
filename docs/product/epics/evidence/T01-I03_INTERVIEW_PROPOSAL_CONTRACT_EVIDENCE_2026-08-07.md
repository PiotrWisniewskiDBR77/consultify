# T01-I03 — Interview proposal contract evidence (2026-08-07)

> Historical checkpoint: `IN_PROGRESS` below is this isolated fixture's status,
> not the current full-flow adapter status. Later native T01/A05/A06 evidence
> supersedes it for local gates. Durable in-app assignment notification is now
> locally RealDB-proven; same-SHA HTTP/browser and recipient UX remain residuals.

## Scope delivered

This increment adds the non-materializing Interview proposal boundary for a durable Transformation Case.

- Requires an active case at `initial_ideas` with approved, linked `my_ideas`.
- Requires one or more named stakeholders; every assignee is verified against `organization_members`.
- Generates evidence-seeking questions from approved Idea titles and stakeholder focus areas.
- Persists the proposal and payload digest in `transformation_stage_proposals`.
- Advances the case to `interviews`, increments optimistic version, and records `transformation_interviews.proposed` in the audit log.
- Creates **no** Interview assignment, session, question, answer, or insight before human review.
- Exposes tenant-scoped propose/read endpoints under `/api/v8/transformation-cases/:id/interviews`.

## Verification

Targeted contract test:

```text
npx vitest run server/src/services/v8/__tests__/transformationCaseService.test.ts --maxWorkers=1 --maxConcurrency=1
Test Files  1 passed (1)
Tests       6 passed (6)
```

Repository type-check:

```text
npm run type-check -- --pretty false
src/components/AIChat/KimiWorkspace/ExceleParametricTemplates.tsx(280,35):
error TS2304: Cannot find name 'useRef'.
```

The only reported TypeScript error is outside this increment. The repository-wide type-check is therefore not green and is not claimed as passed.

## Materialization increment (same day)

Human review now materializes each approved candidate through the existing
`InterviewAssignmentService`. The implementation:

- creates an approved, organization-scoped Interview template and its questions;
- uses a deterministic transformation `processRef` for resumable/idempotent assignment creation;
- creates the canonical `interview_assignments` row and mirrored My Work task;
- links each assignment to Case and proposal in `transformation_case_artifact_links`;
- marks the proposal `applied` and records `transformation_interviews.approved_and_applied`;
- rejects stale Case versions before replay can create duplicates.

Disposable PostgreSQL 16 proof (`consultify_t01_i03`, container removed after readback):

```text
pre-approval: templates=0, assignments=0, tasks=0
post-approval: templates=1, questions=2, assignments=1, tasks=1,
               lineage_links=1, apply_audits=1
case: status=active, lifecycle_stage=interviews, version=3
proposal: status=applied
stale replay: TRANSFORMATION_CASE_VERSION_CONFLICT
final duplicate check: assignments=1, tasks=1, links=1
```

Independent `psql` readback also confirmed that the assignment carries its
deterministic process reference, real My Work `task_id`, assignee, Case ID and
source proposal ID.

## Interview completion gate and DRD handoff

The Case can now leave `interviews` only when all linked canonical records pass
the runtime gate:

- every assignment is `approved` or legacy `completed` and has a session;
- every session is `completed`, has at least one question and reports all
  questions answered;
- every persisted `interview_questions.answer_text` is non-empty;
- every selected Insight belongs to the tenant, is `approved` or `published`,
  and the selected set covers every Case session.

The same disposable PostgreSQL proof exercised the gate. An Insight in plain
generation state `completed` failed closed with
`TRANSFORMATION_INTERVIEW_INSIGHTS_NOT_APPROVED`. After governance status was
changed to `approved`, authoritative readback showed:

```text
assignment_status=approved
session_status=completed
answered_questions=2 / total_questions=2
insight_status=approved
Case lifecycle_stage=drd, version=4
session lineage links=1
answer lineage links=2
insight lineage links=1
transformation_interviews.results_accepted audit events=1
```

Agent Hub now exposes the governed Interview workbench for a Case: stakeholder
and focus entry, proposal review, assignment materialization, visible artifact
count, and the final accepted-Insight gate that opens DRD.

Targeted tests after the UI and completion-gate increment:

```text
Test Files  2 passed (2)
Tests       7 passed (7)
```

The original minimal proof schema intentionally omitted the complete Notification
subsystem. `InterviewAssignmentService` attempted notification delivery and
degraded safely when `notification_preferences` / `notification_types` were
absent. Assignment and My Work creation are proven; notification delivery is
not claimed by that historical fixture.

## Durable in-app notification extension — native PostgreSQL

The canonical T01 fixture now applies `257_notification_system.sql` and proves
the `InterviewAssignmentService` -> `NotificationService` owner path. The full
native run completed through T01/U05 `final_outputs` Case version `24` and
emitted `T01_I03_DURABLE_NOTIFICATION_GREEN` with these asserted facts:

- exactly one durable unread `interview_assigned` notification is linked to the
  canonical Interview assignment;
- recipient, organization, assignment entity, action URL and organization
  membership match the authoritative Case materialization;
- replay returns the same notification and leaves `notifications=1`,
  `deliveryAttempts=1` and one dedupe slot;
- forced notification insert failure leaves the already-created canonical
  assignment and mirrored task intact: `assignment=1`, `task=1`,
  `notification=0`;
- external delivery is explicitly `externalDeliveryClaimed=false`; this proof
  establishes durable in-app delivery, not email delivery.

The run also exercises the PostgreSQL initializer compatibility fix: the
notification read index prefers canonical `is_read`, supports legacy `read`,
and is skipped with an explicit warning when neither column exists. Focused
regression is `3/3`; the full 8 GB TypeScript check passes.

## Historical residuals at this checkpoint

The later full T01 proof supersedes the completion-gate tenant-isolation and
durable in-app notification gaps listed below. It does not claim external email
delivery or supersede HTTP/browser and deployed acceptance gaps.

- Browser-level runtime screenshots for proposal, approval, respondent and final acceptance states.
- Tenant-isolation negative-path proof for the completion gate (superseded by
  the later full T01 cross-tenant proof).
- Notification delivery proof against the full Notification schema
  (superseded for durable in-app delivery; external email remains unclaimed).
- HTTP/controller-level proof of respondent submission and manager approval (the
  canonical resulting records and completion gate are proven on PostgreSQL).

Historical status: `IN_PROGRESS`; this was the checkpoint state, not current
I03 acceptance. Current local durable in-app notification evidence is GREEN;
I03 remains `PARTIAL` pending same-SHA HTTP/browser and recipient UX evidence.
