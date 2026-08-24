# Initiatives Capacity Analysis — expert synthesis

Date: 2026-08-23
Source: owner decision `INI-OWN-011`
Reviewers: skeptical workforce/capacity-planning consultant and skeptical
program/portfolio-planning consultant
State: `READY_FOR_PRODUCT_DESIGN / NOT_IMPLEMENTED`

## Verdict

Capacity Analysis is a versioned scenario estimate derived from one exact saved
Plan version. It is not time tracking and must not claim minute-level accuracy.
One Plan can have multiple analyses with different availability, effort,
staffing, buffer and confidence assumptions. A saved analysis is an immutable
snapshot; later Plan changes do not rewrite it.

The useful output is not one supposedly precise utilization number. It is the
range of likely saturation, bottlenecks, missing inputs, confidence and the
consequences of alternative decisions.

## Register

The Capacity tab starts with a register containing:

- analysis name and version;
- exact source Plan and Plan version;
- author and owner;
- as-of date, horizon and weekly granularity;
- covered teams, roles, people and initiatives;
- assumptions/scenario label;
- status: `DRAFT`, `ANALYZED`, `IN_REVIEW`, `APPROVED`, `ARCHIVED`;
- overall confidence/data-quality state;
- overload count, unassigned work and unresolved conflicts;
- last update.

Actions: `New analysis`, Open, Duplicate as variant, Compare, Rename, Archive.
Editing an approved analysis creates a new version.

## New analysis workflow

1. Select one Plan and its exact version.
2. Name the analysis and define as-of date and weekly horizon.
3. Select people, teams, roles and initiatives.
4. Confirm availability, existing operational load, absences and buffer.
5. Confirm effort estimates and their source/confidence.
6. Validate missing inputs and conflicts.
7. Run `Analyze`.
8. Inspect team, role, person and initiative results.
9. Optionally run `Propose changes`.
10. Accept/reject proposals individually into a working variant.
11. Save/version the analysis; publish an immutable report separately.

## Inputs and estimation truth

Required input model:

- weekly availability by person, role or anonymous role slot;
- non-initiative commitments and operational buffer;
- initiative/task assignment to people or roles;
- effort as a range (`min / likely / max`) or an accepted `S/M/L/XL`
  conversion;
- work distribution: even, front-loaded, back-loaded or manual;
- skills required/available;
- dependencies, deadlines, hard/flexible assignments and dates;
- source, freshness and confidence for every material input.

Missing data remains `UNKNOWN`, never zero. Suggested defaults or AI estimates
must be explicit and accepted by a human.

## Calculation and confidence

Weekly saturation:

`planned effort / available capacity × 100%`

Show it as a range where estimates are uncertain. Calculate separately for:

- person, when assignments are credible;
- role/skill, when demand is known without a named person;
- team, without hiding individual overload.

Team aggregation must show at least maximum load, overloaded-person count and a
distribution/percentile in addition to an average.

Confidence: `HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`. It is calculated for the
whole analysis and traceable down to week, person/role and initiative. Threshold
colors are configurable organizational assumptions, not universal truth.

## Primary workspace

The main surface is a weekly heatmap/Gantt:

- rows: people, roles or teams;
- columns: weeks;
- cells: saturation range and threshold color;
- drill-down to contributing initiatives and tasks;
- filters for person, team, role, initiative, status and confidence;
- modes: nominal, buffered, optimistic/pessimistic;
- visible overload, free capacity, unassigned effort, missing estimates and
  skill conflicts;
- manual what-if movement with immediate recalculation, undo and diff.

Supporting views: `Team`, `People/Roles`, `Initiatives`, `Report`.

## Three-action safety boundary

- `Analyze`: read-only calculation of load, ranges, bottlenecks, confidence and
  risk. It never changes the Plan.
- `Propose changes`: generates auditable suggestions with reason, impact on
  timing/dependencies/saturation, new risks and confidence.
- `Apply selected`: explicit human decision that creates a new Plan variant or
  version. It never silently overwrites the source Plan.

Possible suggestions: shift or extend work, change sequence, reassign/delegate,
split work, reduce concurrency/scope or add capacity. Skill, availability and
hard-constraint validation is deterministic; AI may recommend and explain.

## Comparison

Compare 2–4 analyses on:

- assumptions and source Plan version;
- load and availability ranges;
- overloaded person-weeks and bottleneck roles;
- unassigned demand and data gaps;
- deadline/dependency movement;
- concentration/single-person risk;
- consequences for Plan objectives.

Warn before comparing analyses with different Plan versions, horizons or
calendars.

## Immutable report

The report contains context, source versions, data quality, assumptions,
saturation summary, weekly heatmaps, people/role details, bottlenecks,
threatened initiatives, free capacity, scenarios, recommendations, human
decisions and limitations. PDF export carries author, timestamp, Plan version,
analysis version and confidence.

## Gates

1. `SOURCE_SNAPSHOT` — exact Plan version exists.
2. `INPUT_COVERAGE` — effort, assignment and availability coverage shown.
3. `ASSUMPTION_CONFIRMATION` — defaults and model estimates accepted explicitly.
4. `CONSTRAINT_VALIDATION` — hard conflicts remain visible.
5. `CONFIDENCE_LABEL` — unreliable result is `INSUFFICIENT`, not plausible.
6. `HUMAN_REVIEW` — every recommendation has a disposition.
7. `PUBLICATION` — immutable report; Plan mutation is a separate authorized act.

## Acceptance minimum

1. Several analyses can derive from one exact Plan version.
2. Saved results survive later source-Plan changes unchanged.
3. Missing effort/availability is `UNKNOWN`, never zero.
4. Results use ranges instead of false precision.
5. Saturation is traceable to initiatives/tasks.
6. Team, role and person views are available where data permits.
7. Team average cannot hide an overloaded individual.
8. Input coverage and confidence are visible before recommendations.
9. `Analyze` produces no Plan write.
10. `Propose changes` shows an impact diff before acceptance.
11. Each proposal can be accepted, rejected or modified separately.
12. Applying selected proposals creates a Plan variant/version.
13. Skill-invalid delegation produces a visible conflict.
14. Manual movement recalculates load and conflicts immediately.
15. Approved analysis is immutable and comparable.
16. Report preserves assumptions, sources, versions, author and limitations.
17. Permission rules separate viewing, editing, approving and publishing.
18. `INSUFFICIENT` blocks or conspicuously qualifies publication.

## Expert disposition

- Workforce/capacity skeptic: `CONDITIONALLY_SOUND / RANGE_AND_CONFIDENCE_REQUIRED`.
- Program/portfolio skeptic: `CONDITIONALLY_SOUND / SNAPSHOT_AND_THREE_ACTION_BOUNDARY_REQUIRED`.
- Combined: `READY_FOR_PRODUCT_DESIGN / NOT_READY_TO_CLAIM IMPLEMENTED`.
