# Initiatives Plan What-If — expert synthesis

Date: 2026-08-23
Source: owner decision `INI-OWN-009`
Reviewers: two independent skeptical consultants — Transformation Office / portfolio strategy and implementation / operations planning
State: `PRODUCT_CONTRACT_PROPOSED / OWNER_DIRECTION_CAPTURED / NOT_IMPLEMENTED`

## Verdict

The requested surface is a versioned `What-If` scenario planner, not a static report and not one mutable schedule. A language model must not be the sole scheduling engine. The safe split is:

- deterministic constraint solver: produces or validates ordering against explicit hard rules;
- AI analysis: identifies missing inputs, proposes soft priorities and alternatives, explains trade-offs and risks;
- human decision: includes/excludes initiatives, overrides positions, resolves conflicts and approves a scenario.

Without an explicit objective function, dependency model and input-quality gate, `Arrange logically` would be unauditable.

## Plan register

The `Plan` tab opens a table of saved scenarios. Each row records:

- name and version;
- parent/baseline scenario;
- owner and author;
- `as-of` date and planning horizon;
- organizational scope and time granularity;
- selected objective function;
- included/excluded initiative count and selected status rules;
- state: `DRAFT`, `ANALYZED`, `INCOMPLETE`, `CONFLICTED`, `REVIEWED`, `APPROVED`, `ARCHIVED`;
- unresolved conflict count, input confidence and capacity-validation state;
- solver/model version and generated/updated/published timestamps.

Actions: `New plan`, `Open`, `Duplicate as variant`, `Compare`, `Approve`, `Archive`. An approved scenario is immutable; a change creates a new version or fork.

## New Plan creator

### 1. Context

- scenario name and purpose;
- `as-of` date;
- start/end horizon;
- weekly granularity by default;
- organizational/program scope;
- working calendar, holidays and closed periods;
- objective function: fastest first value, deadline adherence, maximum value, minimum risk/delay, balanced strategic coverage or explicit custom weights.

### 2. Status policy and initiative selection

Each lifecycle status has a three-state rule:

- include by default;
- show but exclude by default;
- hide from this scenario.

Every initiative then has an explicit `Included in plan` checkbox. The user may override the status default and must be able to record a reason. Excluded initiatives remain visible in a separate section so a scenario cannot look attractive by silently removing difficult work.

For every initiative show: status, owner, priority, expected outcome/value, duration or effort estimate, earliest start, deadline, task count, dependency/data completeness, confidence and inclusion rationale.

### 3. Rules and constraints

Hard constraints:

- initiative-to-initiative and task-to-task dependencies;
- `finish-to-start`, `start-to-start`, `finish-to-finish`, lag/lead;
- mandatory versus preferred dependency;
- earliest start, fixed milestone and hard deadline;
- work already started;
- manually frozen start/end/position;
- external dependency and conditional blocker;
- user-defined maximum parallelism where available.

Soft preferences:

- priority and strategic weight;
- cost of delay;
- quick wins/time to first value;
- preferred ordering;
- grouping related work;
- risk exposure and WIP reduction.

Task dependencies are aggregated to initiative level, but the UI must expose which task relation forced the initiative position.

### 4. Data readiness

Before arranging, `Check data` classifies every initiative. Minimum planning inputs are status, owner, duration/effort or an explicit estimate, dependencies or an explicit `none known`, and relevant date bounds.

Missing data never becomes a hidden AI invention. The system may:

- exclude the item as unplannable;
- use an explicitly visible hypothesis accepted by the user;
- produce `INCOMPLETE` with unresolved assumptions.

Fatal blockers include dependency cycles, missing predecessors, dependency on an excluded initiative, impossible deadlines, contradictory manual locks and items outside the horizon.

### 5. Timeline workspace

Weekly timeline contents:

- initiatives as parent lanes;
- expandable tasks;
- lifecycle status coloration plus non-color labels;
- dependencies, milestones and deadlines;
- hard/soft conflicts and missing-data markers;
- frozen positions;
- separate excluded/unplannable area.

Manual controls:

- include/exclude;
- drag and resize;
- freeze start, end or complete position;
- edit dependency type and hardness;
- accept/reject individual recommendation;
- undo/redo;
- save a variant;
- compare `before/after` and re-run without moving frozen items.

### 6. Arrange and AI analysis

Two distinct actions are required:

- `Arrange automatically`: deterministic solver applying declared constraints and objective;
- `Analyze AI`: critique, alternatives, missing data, risks, trade-offs and explainable recommendations.

Every proposal states why the item moved, facts used, hard/soft constraints, assumptions, conflicts created/resolved, confidence derived from input completeness and items that could not be scheduled. AI cannot mutate source initiatives or publish a plan.

### 7. Plan versus Capacity boundary

MVP Plan is `Sequence-only`: logical ordering by dependencies, dates and priorities. It must display `CAPACITY_NOT_VALIDATED` and cannot claim feasibility.

`Capacity-aware` requires a versioned capacity snapshot per week and team/role/skill, including BAU, leave, committed work and risk buffer. Capacity analysis may propose a new plan variant; it never silently rewrites an approved plan.

### 8. Snapshot, report and publication

Each saved result is an immutable, reproducible snapshot containing:

- selected initiatives/tasks and exclusions;
- statuses, estimates, dates and dependencies at `as-of`;
- status policy, objective and constraints;
- input and capacity snapshot references;
- solver/model/prompt versions;
- manual overrides and their rationale;
- timeline result, unresolved conflicts and AI recommendations;
- author/reviewer/approver and audit trail.

Changes in live initiatives create `drift since analysis`; they do not rewrite history. Publication does not update initiative dates/statuses automatically. A separate authorized synchronization action must show the complete diff before applying changes.

## Scenario comparison

Compare 2–4 variants on:

- included/excluded scope;
- start/end movements;
- deadline adherence;
- unresolved hard/soft conflicts;
- critical-path length;
- time to first value;
- value delivered inside horizon and cost of delay;
- maximum parallel work/WIP;
- missing-data exposure and manual override count;
- capacity validation and overload where available.

The product must show trade-offs against the chosen objective, not declare one universally best scenario.

## Gates

1. `DATA_READINESS` — inputs and assumptions are visible.
2. `DEPENDENCY_INTEGRITY` — no unresolved fatal graph conflict.
3. `SCOPE_CONFIRMATION` — included/excluded count and overrides confirmed.
4. `FEASIBILITY_LABEL` — sequence-only cannot be called feasible.
5. `HUMAN_REVIEW` — analyzed scenario is not approved automatically.
6. `PUBLICATION` — immutable snapshot; operational synchronization is separate.

## Acceptance minimum

1. Status rules set defaults; every initiative can be explicitly overridden.
2. Excluded initiatives and reasons remain visible.
3. Identical snapshot and parameters produce the same solver result.
4. Saved history does not change after live initiative/status changes.
5. Re-analysis respects manual locks.
6. Dependency cycles block publish-as-feasible.
7. Excluding a predecessor creates an explicit successor conflict.
8. Missing duration/data creates `INCOMPLETE` or a visible accepted hypothesis.
9. Impossible deadline produces `CONFLICTED`, not a plausible-looking plan.
10. Sequence-only always displays `CAPACITY_NOT_VALIDATED`.
11. Capacity-aware never exceeds available skill/team supply per week.
12. Every generated date has an inspectable rationale.
13. Scenario comparison shows scope, timing, conflicts, value and overload differences.
14. Approved scenario is immutable; editing creates version/fork.
15. Publication never changes operational dates/statuses without a separate authorized diff/apply command.

## Expert disposition

- Strategy/Transformation Office skeptic: `CONDITIONALLY_SOUND / OBJECTIVE_AND_DECISION_GATES_REQUIRED`.
- Operations/planning skeptic: `CONDITIONALLY_SOUND / SOLVER_AND_FEASIBILITY_BOUNDARY_REQUIRED`.
- Combined: `READY_FOR_PRODUCT_DESIGN / NOT_READY_TO_CLAIM IMPLEMENTED`.

## Owner simplification after expert review — `INI-OWN-010`

The expert contract defines the required planning integrity, but it must not
surface as a dense control panel. The owner-approved interaction model is:

1. a register of saved analyses/plans and one Menu 2 action: `New analysis`;
2. a new unsaved workspace opened as a tab and preloaded with the current
   initiative snapshot;
3. a weekly interactive Gantt as the primary working surface;
4. compact Menu 3 controls, with `Analyze` and `Save` on the right;
5. horizontal drag, duration adjustment, dependencies, conflicts, zoom and undo;
6. first save creates a durable shared record with author, permissions and
   version history; later edits create named versions;
7. solver/AI changes are previewed as a diff and never silently overwrite
   manual moves;
8. implementation metadata and raw JSON stay outside the primary experience.

This simplification supersedes any reading of the earlier expert synthesis that
would expose every parameter, gate or diagnostic as a permanent top-level
button. The constraints remain enforced by the product, while the human-facing
workflow stays minimal.
