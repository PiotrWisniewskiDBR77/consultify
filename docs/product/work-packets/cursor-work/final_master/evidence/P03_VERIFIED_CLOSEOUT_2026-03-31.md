# P03 Wdrożenia — Verified Closeout

**Date:** 2026-03-31  
**Status:** `verified(evidence)`  
**Branch:** `ws/c-artifact-evidence`

## Scope delivered

### P03-A — Control tower canon + write-truth boundaries
- 5 canonical queues: `late`, `at_risk`, `blocked`, `overloaded`, `stale` (§2.4.1)
- Drill-down contract: `why` (dependency/workload/baseline_forecast/estimate/stale/status) + `whatNext` (reassign/smooth/replan/escalate) with `readbackHint` (§2.4.2)
- Interventions list frozen to 4 bounded actions (§2.4.3)
- One execution truth rules explicit (§2.4.4)
- Baseline/forecast/variance vocabulary + missing-baseline posture (§2.4.5)
- Dependency semantics: blocking/waiting + 1-hop affectsNext (§2.4.6)
- Anti-duplicate gate: reads from canonical tables only (§2.4.7)
- Degraded posture: missing_baseline, missing_estimate, stale_data signals (§2.4.8)

### P03-B — Detect→drill-down→intervene→verify closure
- `v8ExecutionControlTowerService.ts` — 5-queue read model with full drill-down
- `GET /api/v8/execution-control/control-tower/queues` — filterable by queue + projectId
- `GET /api/v8/execution-control/control-tower/items/:entityType/:entityId` — merged drill-down
- `POST /api/v8/execution-control/interventions/reassign` — task/initiative owner change + readback
- `POST /api/v8/execution-control/interventions/smooth` — forecast dates/allocation shift + readback
- `POST /api/v8/execution-control/interventions/replan` — forecast update (baseline preserved) + readback
- `POST /api/v8/execution-control/interventions/escalate` — RAID item creation + readback
- `GET /api/v8/execution-control/baseline-variance/:initiativeId` — baseline vs forecast + variance + missing-baseline posture
- `GET /api/v8/execution-control/control-tower/health` — degraded posture signals

### P03-C — Verification + rollout
- All intervention endpoints return mandatory readback (refreshed queues + drill-down)
- Integration tests cover write→refresh→agree for all 4 interventions
- Degraded health endpoint reports missing_baseline, missing_estimate, stale_data
- Baseline-variance returns explicit posture + degradedNote

## Tests (26 total)

| File | Count | What |
|------|-------|------|
| `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts` | 2 | Queue classification + filter |
| `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | 15 | All execution-control routes including tower queues + item detail |
| `server/src/routes/v8/__tests__/p03-interventions.test.ts` | 9 | 4 interventions write→readback + baseline-variance + health + 404 |

## §8.4 Acceptance checklist

1. [x] Canon queue set = late, at-risk, blocked, overloaded, stale (§2.4.1)
2. [x] Each queue bounded definition, not generic dashboard (§2.4.1)
3. [x] Drill-down: explicit "why" + bounded "what next" (§2.4.2)
4. [x] Interventions frozen to: reassign/smooth/replan/escalate (§2.4.3)
5. [x] One execution truth: declared writes + mandatory refresh (§2.4.4)
6. [x] Baseline/forecast/variance vocabulary explicit (§2.4.5)
7. [x] Missing baseline posture explicit (§2.4.5)
8. [x] Missing estimate posture explicit (§2.4.5)
9. [x] Dependency edge vocabulary: blocking + waiting_on (§2.4.6)
10. [x] "Affects next" 1-hop blast radius (§2.4.6)
11. [x] Anti-duplicate gate: no parallel truth (§2.4.7)
12. [x] Degraded/error posture explicit (§2.4.8)

## Known limits

- **UI consumer** not in P03 scope — API-first delivery; frontend integration is downstream work
- **Smooth** uses `planned_start_date`/`planned_end_date` as forecast proxy (no separate `forecast_*` columns yet)
- **Baseline preservation** relies on `task_baseline_snapshots` for tasks; initiative-level baseline is the original `planned_*` dates
- **Dependency edge vocabulary** uses existing `initiative_dependencies`/`task_dependencies` tables; `blocking`/`waiting_on` semantics are inferred from direction
