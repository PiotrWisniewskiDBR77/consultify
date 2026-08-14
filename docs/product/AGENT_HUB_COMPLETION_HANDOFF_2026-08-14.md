# Agent Hub — completion handoff

> Date: 2026-08-14
> Runtime baseline: `f3237e94230481d2bf4ad0a9c0dc10b1391191c9`
> Demo organization: `a3e05d4a-5397-419d-b486-8e44366c0063`
> Status: `IMPLEMENTATION REQUIRED`
> Product decision: preserve the Transformation Case backend; replace the mixed technical surface with one business workspace shared by Teresa and the user.

## 1. Executive diagnosis

Agent Hub is not an empty prototype. It already has a substantial durable backend, but the current UI mixes an executive Case card, a 15-stage plan editor, governance, runtime diagnostics, recovery and stage-specific forms in one component.

The deployed Case `44708bc6-0d5a-4032-8aa1-b15157eac095` proves the present mismatch:

- status: `plan_approved`;
- autonomy: `A1_prepare`;
- active plan: version 2;
- stage capability truth stored in the plan: one `PARTIAL`, fourteen `NOT_CONNECTED`, zero `REAL`;
- audit events: 5;
- stage proposals: 0;
- artifact links: 0;
- team blueprints: 0;
- final-output runs: 0.

The screen therefore truthfully disables `Run`, but it also exposes `Prepare Ideas list` even though the corresponding bootstrap capability says `NOT_CONNECTED`. The runtime contains a real Ideas proposal/materialization path. This is a stale capability-registry/data reconciliation defect, not proof that the adapter is absent.

## 2. Existing implementation to preserve

- `Transformation Case`, canonical Run and durable PostgreSQL state;
- versioned plans and plan approval/revision;
- proposal/review/accept-result lifecycle;
- governance, reviewer authority, audit, idempotency, resume and recovery;
- Project Team blueprint;
- stage services and API paths for Ideas, Interview, DRD, opportunity synthesis, Initiative candidates, Finance/KPI, portfolio decision, mobilization, Execution, delivery, benefits, sustainability and final outputs;
- native Word and PowerPoint output path;
- existing standard Consultify table, preview, card, chip and artifact-shell primitives.

Do not rebuild these foundations or introduce a competing Agent entity.

## 3. Current structural defects

1. `TransformationCasesPanel.tsx` is about 4,000 lines and owns too many product surfaces.
2. Bootstrap stage capability values remain stale even though downstream implementations now exist.
3. The durable contract exposes only `autonomyLevel = A1_prepare`; collaboration modes are not persisted.
4. Teresa conversation and manual editing appear as separate experiences instead of two views of one versioned plan.
5. The main Case view exposes engineering readiness (`REAL`, `PARTIAL`, `NOT_CONNECTED`) as a business status.
6. `Plan approved` together with `0/15 ready` is semantically contradictory for a normal user.
7. PL/EN language resolution is inconsistent with the shell language.
8. Operations, diagnostics, template governance and recovery compete with daily user work.

## 4. UI/UX canon available for consolidation

Existing detailed drafts:

- `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/RUN_AGENT_INFORMATION_ARCHITECTURE_AND_UX_STANDARD.md`
- `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/RUN_AGENT_TERESA_COPILOT_AND_PROCESS_DESIGN_STANDARD.md`
- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
- `docs/product/AGENT_EXECUTION_V8_EPIC_DOD_DELIVERY_MATRIX_2026-08-07.md`

Existing clickable prototypes:

- `/Users/piotrwisniewski/.codex/visualizations/2026/08/13/019ffa9f-7909-7133-8b22-d7f7c22b8bfa/consultify-agent-prototype.html`
- `/Users/piotrwisniewski/.codex/visualizations/2026/08/13/019ffa9f-7909-7133-8b22-d7f7c22b8bfa/consultify-agent-studio.html`

The UI plan is complete enough to implement, but the older agreement files remain `DRAFT_FOR_OWNER_REVIEW`. The first implementation commit must consolidate them into one canonical UI contract without silently inventing another model.

## 5. Binding product model

One primary object: `Transformation Case` (user-facing: `Zlecenie`).

One full workspace with three primary areas:

1. `Plan`
2. `Realizacja`
3. `Rezultaty`

Teresa conversation and manual builder are two synchronized views of the same versioned Plan. AI mutations are proposal-first and always expose a semantic diff.

Supported collaboration modes to persist:

- `teresa_led`
- `human_led`
- `teresa_draft_human_edit`
- `human_draft_teresa_review`

All four modes converge on: review plan → approve → execute → evaluate results.

## 6. Required surfaces

### Cases index

Business table/preview only: outcome, status, attention state, owner, next action, due date and last activity. One CTA: `Otwórz zlecenie`.

### Case workspace

Full page, not a side preview. Header: outcome, owner, stage, health and contextual CTA. Primary navigation: Plan, Realizacja, Rezultaty. Decisions, Team and History are contextual secondary views.

### Teresa planning workshop

Conversation and live plan side by side. Teresa asks only questions that materially affect outcome, safety or scope. Assumptions remain explicit.

### Manual plan editor

Simple business cards by default, list alternative for accessibility and an Expert inspector on demand. Technical adapter/runtime fields never dominate the default view.

### Plan review

Semantic proposal diff with rationale, impact, evidence and per-change accept/reject/edit. Scope, cost, recipient and permission expansion always require explicit individual approval.

### Run cockpit

Business outcome, current work, next decision, attention queue, timeline and artifacts. Logs and reconciliation belong to operator diagnostics.

### Results

Outcome summary, KPI/benefits, decisions, artifacts, evidence and learning. Native objects open in their owning modules.

## 7. Implementation sequence

1. Freeze one UI contract from the existing drafts and prototypes.
2. Introduce truthful runtime capability registry/readback; migrate/reconcile existing plans only from verified adapter evidence.
3. Persist collaboration mode, plan authorship and Teresa suggestions/diffs.
4. Split the monolithic panel into Cases index, Case workspace, Plan workspace, Teresa panel, Plan review, Run cockpit, Results and History.
5. Move diagnostics, recovery and governance behind role-aware advanced/operator surfaces.
6. Normalize PL/EN resolution and all user-facing status vocabulary.
7. Execute one full realDB and deployed browser golden flow through native DOCX/PPTX outputs.

## 8. Non-negotiable acceptance

- No UUID, raw enum, JSON or adapter key in the normal user view.
- A user understands the outcome, current state, required attention and next action within five seconds.
- Every displayed capability comes from current runtime truth, never a stale bootstrap array.
- Teresa and manual editing persist against the same Plan object and survive reload.
- Teresa never overwrites a human edit without an accepted diff.
- No business mutation occurs before the required approval.
- Retry is idempotent and resumes the same invocation.
- The golden flow creates owning-module records and canonical readback for every stage.
- Final Word and PowerPoint are editable, share the approved facts digest and reopen from their native modules.
- Exact deployed SHA, realDB, authenticated browser, desktop/mobile and accessibility evidence are required before `DONE`.

## 9. Safety boundary

Do not manually convert `NOT_CONNECTED` to `REAL`. A capability may be promoted only after route, service, owning-module write, readback, governance, idempotent replay and failure/recovery evidence are verified. Preserve literal `PARTIAL`, `BLOCKED` and `EVIDENCE_MISSING` wherever proof is incomplete.
