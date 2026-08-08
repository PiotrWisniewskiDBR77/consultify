# T01-I08 — Mobilization Blueprint realDB evidence — 2026-08-07

## Governed contract

The Agent prepares a dated execution blueprint with named owner, WBS,
acceptance criteria, hard dependencies, gated milestones and resource
allocation. Proposal creation writes no execution records. Human approval uses
the existing `InitiativeGovernanceService.createBlueprint/applyBlueprint`
writers. A separate gate verifies durable artifacts and refuses to open
execution until the canonical Initiative lifecycle reaches `SCHEDULED`.

## Isolated PostgreSQL proof

PostgreSQL 16 database `consultify_t01_i08`, test-only initializer skip, no
shared/demo writes. Runner exited 0 and the container was removed.

```text
before approval:
  blueprints=0, tasks=0, milestones=0, resources=0

after blueprint approval/application:
  applied blueprints=1
  tasks=3
  hard dependencies=2
  gated milestones=3
  resources=1
  initiative_history ai_blueprint_applied=1

attempt while Initiative remained APPROVED:
  TRANSFORMATION_INITIATIVE_NOT_SCHEDULED

after canonical lifecycle result SCHEDULED:
  lifecycle_stage=execution
  Case version=19
  mobilization results-accepted audit events=1
```

Independent `psql` confirmed Case `execution` v19, Initiative `SCHEDULED`,
Blueprint `applied`, and exact artifact counts 3/2/3/1.

The fixture seeds the resulting `SCHEDULED` status after proving Blueprint
materialization. It does not claim a full HTTP/RBAC run of all canonical
Initiative transitions; that remains a final runtime requirement.

## Checks and UI

```text
ESLint scoped checks: passed
git diff --check: passed
Test Files  2 passed (2)
Tests       12 passed (12)
```

Agent Hub exposes owner and dates, Blueprint contents and counts, explicit
materialization approval, and final SCHEDULED verification.

Status: mobilization adapter, canonical Blueprint application, realDB lineage,
governance and Agent Hub implemented. Visual runtime, tenant isolation and
canonical transition-engine evidence remain pending final acceptance.
