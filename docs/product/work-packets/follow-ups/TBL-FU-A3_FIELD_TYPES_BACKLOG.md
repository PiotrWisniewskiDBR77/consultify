# TBL-FU-A3 — Field-types backlog (status / date_range / team / rating / progress)

**Priority:** P3
**Owner:** Backend lead + Frontend lead
**Source:** Master roadmap A-S8 sprint placeholder.
**Filed at:** A-S7 closeout, 2026-05-08

## Goal

Land the remaining backlog of field types tracked by the master roadmap as the (originally-planned) A-S8 sprint. These types are non-blocking for Block C kickoff because the 5 Block-A specialized types already cover 100 % of consulting templates' first-class needs.

## Acceptance Criteria

- 5 backlog field types added to `FieldType` union with options validators + per-value runtime validators:
  - `status` — workflow status with configurable transitions (extends current single-select with state machine).
  - `date_range` — start + end date with optional duration display.
  - `team` — multi-person field with role tagging.
  - `rating` — already exists in the union; refactor to use the canonical `RatingDisplay` everywhere (consolidation pass).
  - `progress` — 0..100 percentage with numeric + bar display.
- `PlatformCellRenderer` registers each new renderer; AddField dialog (TBL-FU-A1) lists them.
- Unit tests on validators + cell renderers (≥ 8 each).
- 0 raw hex literals.
- 0 cross-tenant ACL regressions.

## Dependencies

- Should land after `TBL-FU-A1` so Add-Field UX is the single dialog hosting all field types.
- Can run in parallel with Block C / Block D sprints because it touches an additive surface only.

## Estimate

~2 days (5 types × ~0.4 day each).
