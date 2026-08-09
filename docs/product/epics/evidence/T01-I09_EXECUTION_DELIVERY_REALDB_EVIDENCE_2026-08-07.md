# T01-I09 — Execution to Delivery realDB evidence — 2026-08-07

## Governed contract

The Agent observes the canonical Initiative workspace instead of silently
changing its lifecycle. Execution start can be accepted only after the
Initiative reaches `EXECUTING`. Delivery can be accepted only after a durable
start receipt, canonical closure to `DONE`, and completion of every linked WBS
task and milestone. The final checkpoint is locked and recomputed in the same
transaction as the Case transition, preventing acceptance from a stale
snapshot.

## Isolated PostgreSQL proof

PostgreSQL 16 database `consultify_t01_i09`, test-only initializer skip, no
shared/demo writes. Runner exited 0 and the container was removed.

```text
attempt before EXECUTING:
  TRANSFORMATION_INITIATIVE_NOT_EXECUTING

accepted start:
  execution_start_receipts=1
  transformation_execution.started audit events=1

attempt before DONE:
  TRANSFORMATION_INITIATIVE_NOT_DONE

attempt with incomplete work:
  TRANSFORMATION_EXECUTION_WORK_INCOMPLETE

accepted completed execution:
  lifecycle_stage=delivery
  Case version=21
  Initiative status=DONE
  completed tasks=3/3
  completed milestones=3/3
  transformation_execution.results_accepted audit events=1
```

Independent `psql` confirmed Case `delivery` v21, Initiative `DONE`, three
completed tasks, three completed milestones and one durable start receipt.

The fixture seeds the resulting `EXECUTING` and `DONE` statuses to exercise the
real adapter gates. It does not claim a full HTTP/RBAC proof of every canonical
Initiative transition or closure approval; those remain final runtime evidence
requirements.

## Checks and UI

```text
ESLint scoped checks: passed (existing explicit-any warnings in UI test only)
git diff --check: passed
Test Files  3 passed (3)
Tests       20 passed (20)
```

Agent Hub displays canonical Initiative status, task and milestone completion,
blocked/delayed counts, KPI target status and the execution-start receipt. It
provides separate start and results approvals and disables delivery acceptance
until the visible checkpoint satisfies the contract; the server repeats all
checks authoritatively.

Status: execution checkpoint, governed start, transactional delivery gate,
realDB lineage and Agent Hub controls implemented. Visual runtime, tenant
isolation and full canonical transition-engine evidence remain pending final
acceptance.
