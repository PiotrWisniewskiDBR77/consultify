# Consultify post-cleanup completion plan

## Purpose

This document replaces dated five-hour cleanup plans and the June master
closure plan as the current completion plan. It becomes executable only through
the exact candidate SHA recorded in `CLEANUP_CURRENT_STATE_20260816.md`.

## Gate hierarchy

### 1. `CLEANUP_COMPLETE`

Requires one clean candidate, a complete recovery/quarantine ledger, no unknown
valuable branch packages, and a recoverable disposition for retired worktrees.

### 2. `INTEGRATION_READY`

Requires clean Git state, exact SHA, `diff --check` policy satisfied, build and
type checks, module-scoped tests, migration discovery and fresh-database proof
for every integrated data package.

### 3. `DEMO_READY`

Requires deployment identity matching the accepted integration SHA, real demo
database migrations, tenant-scoped write/readback, browser golden flows and
runtime evidence owned by the repository.

### 4. `PRODUCTION_READY`

Requires a separately frozen release SHA, independent verification, rollback
and migration rehearsal, security/observability gates, and explicit owner
authorization. `DEMO_READY` never implies this gate.

## Module completion board

| Module | Current status | Completion gate |
| --- | --- | --- |
| Assessment | `PARTIAL / ROUTE_MOUNT_GREEN` | Five-surface Chromium mount is green on fresh PostgreSQL. Complete Library-to-session, unify registry ownership and prove create/edit/freeze/readback. |
| Tools | `PARTIAL / INTEGRATED_REALDB_GREEN` | Browser golden flow, publishable-pack/initiative-quality policy and explicit flag decision. Fresh strict DB and 100/100 realDB assertions are green at the current candidate. |
| Audits | `PARTIAL / REALDB_AND_ROUTE_MOUNT_GREEN` | Fresh strict DB, 259/259 assertions, event compatibility readback and five-surface Chromium mount are green. Complete the audit golden flow and make the explicit rollout decision; default remains OFF. |
| Case / Agent | `ALREADY_PRESENT / VERIFICATION_REQUIRED` | No replay. Verify the existing lifecycle, 19 migrations, route/flag truth, persistence/outbox/restart, cross-module adapters and browser journeys; retain VoiceOver as literal blocker until proven. |
| Artifact / Materials | `ALREADY_PRESENT / VERIFICATION_REQUIRED` | No replay. Focused DOC/PPT/XLSX/governance/shell assertions are green; prove realDB persistence, export, cold reopen, browser accessibility and remaining human/provider/stability gates on the exact SHA. |
| Results | `ALREADY_PRESENT / BLOCKED_DATA_AND_MOUNT` | No replay. Decide access and rollout, mount the KPI/ROI/OKR workspace deliberately, provide deterministic three-role fixtures, prove lifecycle/readback and bind fresh evidence to the exact SHA. |
| Finance | `ALREADY_PRESENT / EVOLVED / RUNTIME_NOT_VERIFIED` | No replay. Prove one governed runtime owner, explicit OFF/ON workspace behavior, canonical artifact/business/working-revision identity, fresh migration lifecycle and the Results seam. |
| CEPD / Interview | `PARTIAL / SELECTIVE_RECOVERY_APPLIED` | Two exact missing hunks are recovered. Prove integer evidence persistence on fresh PostgreSQL, bounded AI timeout, access matrix, nullable evaluation and notification fallback. |
| UX tables/tools | `ALREADY_PRESENT / EVOLVED` | No replay. Rerun independent Assessment surface acceptance; retain the local scope-cleanup commit only as superseded evidence. |

## Execution rule

Every module advances through:

`route -> mount -> API/service -> persistence -> readback -> test -> browser`

Missing evidence preserves `PARTIAL`, `BLOCKED`, `EVIDENCE_MISSING`, or
`NOT_VERIFIED`. Historical green runs do not transfer across SHAs.

## Historical plans

The following classes are historical evidence and not active instructions:

- `FINAL_ACCEPTANCE_SPRINT_20260815.md`
- `NEXT_5H_EXECUTION_PLAN_20260815.md`
- `CLEANUP_5H_FAST_PATH_20260815.md`
- `FIVE_HOUR_*_20260815.md`
- `CLEANUP_FASTPOINT_20260815.md`
- dated status snapshots and objective-progress snapshots
- `docs/plans/CONSULTIFY_MASTER_CLOSURE_PLAN.md` from 2026-06-03

They may be retired only after links and unique evidence are preserved.
