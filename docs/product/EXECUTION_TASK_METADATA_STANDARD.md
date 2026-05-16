# Execution Task Metadata Standard

Status: `ACTIVE`
Owner: PMO / Delivery Owner

## Purpose

Standardize task quality so sprint commitments are executable and auditable.

## Mandatory Task Fields

Every task entering sprint must include:

- `id` (stable identifier),
- `title` (clear delivery intent),
- `owner` (single accountable person),
- `priority` (`P0/P1/P2/P3`),
- `dependencies` (task IDs or `none`),
- `acceptance_criteria` (testable outcome),
- `evidence_type` (`test`, `screenshot`, `report`, `metric`, `doc`),
- `risk_tag` (`security`, `data`, `ux`, `reliability`, `compliance`, `none`),
- `target_window` (sprint or explicit date range),
- `status` (`pending`, `in_progress`, `blocked`, `done`).

## Completion Rules

A task can move to `done` only when:

- acceptance criteria are met,
- required evidence is attached,
- no unresolved blocker remains on dependent tasks.

## Governance Notes

- If task affects UI behavior, add UI source-of-truth compliance evidence.
- If task affects permissions or data access, add negative authorization test evidence.
- If task affects exports or quality gates, attach blocked/success contract evidence.
- If task affects migration or schema, attach dry-run and rollback evidence.
