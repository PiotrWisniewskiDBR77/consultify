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
| Assessment | `PARTIAL / INTEGRATED_PENDING_VERIFICATION` | One Library-to-session path, one registry owner, fresh browser proof. |
| Tools | `PARTIAL / INTEGRATED_REALDB_GREEN` | Browser golden flow, publishable-pack/initiative-quality policy and explicit flag decision. Fresh strict DB and 100/100 realDB assertions are green at the current candidate. |
| Audits | `PARTIAL / INTEGRATED_REALDB_GREEN` | Browser golden flow and explicit flag decision. Fresh strict DB, 259/259 assertions and audit-event compatibility readback are green at the current candidate. |
| Case / Agent | `ALREADY_PRESENT / VERIFICATION_REQUIRED` | No replay. Verify the existing lifecycle, 19 migrations, route/flag truth, persistence/outbox/restart, cross-module adapters and browser journeys; retain VoiceOver as literal blocker until proven. |
| Artifact / Materials | `INTEGRATE_SELECTIVELY / HIGH_CONFLICT / EVIDENCE_MISSING` | Reconstruct the five-commit source by bounded DOC/PPT/XLSX/governance/shell groups, then prove persistence, export, reopen and accessibility on the new exact SHA. |
| Results | `BLOCKED_DATA_AND_MOUNT` | One mounted KPI/ROI/OKR workspace and deterministic demo fixtures. |
| Finance | `BLOCKED_ARCHITECTURE` | One canonical version spine, migration ledger and Results seam. |
| CEPD / Interview | `PARTIAL / SELECTIVE_RECOVERY_REQUIRED` | Allowlisted fixes on candidate plus exact-schema runtime verification. |
| UX tables/tools | `BLOCKED_RECOVERY` | Clean reconstruction from allowlist and independent acceptance rerun. |

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
