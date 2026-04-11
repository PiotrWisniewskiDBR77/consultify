# P03 Wdrożenia — Verified Closeout

**Date:** 2026-03-31 (P03-A/B/C) + 2026-04-11 (P03-D/E/F)  
**Status:** `verified(evidence)` — 18/18 acceptance checklist  
**Branch:** `ws/c-artifact-evidence` + current session

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

### P03-D — Manager 6-lane cockpit + AI layer (2026-04-11)
- 6 governed lanes: action-queue, decisions, blockers, workload, risk, people-change (§2.4.9)
- Lane problem taxonomy from canonical DB tables: overdue/blocked tasks, pending decisions, RAID items, overloaded owners, bus-factor, unassigned items
- Heuristic analysis engine: Observations → Insights → Effects → Suggestions per lane
- Lane decision lifecycle: suggest → decide → execute → verify (persisted to `lane_decisions`, `lane_execution_plans`)
- Extended action vocabulary: task/initiative/decision/RAID/person actions (§2.4.9 table)
- Manager AI layer: getAiRecommendation, getAiTriage, getAiManageAll (§2.4.10)
- AI doctrine: bounded, no truth invention, structured output, budget model
- 10 API endpoints under `/api/v8/execution-control/manager/lanes/:laneId/...`

### P03-E — Forecast column migration + baseline preservation fix (2026-04-11)
- Migration `20260411_v8_p03e_forecast_columns.sql`: adds `forecast_start_date`, `forecast_end_date` to initiatives
- Smooth and replan endpoints now write to forecast columns (baseline `planned_*` preserved)
- Baseline-variance API reads forecast from `forecast_*` columns with fallback chain
- Control tower uses `forecast_end_date` for late queue detection

### P03-F — Degraded posture completion + dependency endpoint + test coverage (2026-04-11)
- `write_denied` posture: permission check (VIEWER/READONLY → 403) before all 5 intervention endpoints
- `partial_refresh_failure` posture: try/catch in refreshControlTower returns stale fallback with `lastRefreshAt` and `retryHint`
- `POST /interventions/dependency`: bounded link/unlink for task↔task and initiative↔initiative dependencies with mandatory readback
- Overload window granularity: `overloadWindow` query parameter (day/week/month) on control tower queues endpoint
- Extended signal/budget/capacity APIs documented in contract §2.4.11

## Tests (~60 total)

| File | Count | What |
|------|-------|------|
| `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts` | 2 | Queue classification + filter |
| `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | 15 | All execution-control routes including tower queues + item detail |
| `server/src/routes/v8/__tests__/p03-interventions.test.ts` | 9 | 4 interventions write→readback + baseline-variance + health + 404 |
| `server/src/services/v8/__tests__/managerProblemsService.test.ts` | 6 | One test per lane: action-queue, decisions, blockers, workload, risk, people-change |
| `server/src/services/v8/__tests__/managerActionExecutionService.test.ts` | 9 | Task/initiative/decision/RAID/person actions + error + suggestion |
| `server/src/services/v8/__tests__/laneHeuristics.test.ts` | 6 | One test per heuristic function (pure, no DB) |
| `server/src/services/v8/__tests__/managerAiService.test.ts` | 3 | AI recommend/triage/manage-all with mocked LLM |
| `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` | 10 | All 10 manager cockpit API endpoints |

| File | Count | What |
|------|-------|------|
| `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts` | 2 | Queue classification + filter |
| `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | 15 | All execution-control routes including tower queues + item detail |
| `server/src/routes/v8/__tests__/p03-interventions.test.ts` | 9 | 4 interventions write→readback + baseline-variance + health + 404 |

## §8.4 Full acceptance checklist (18/18)

**P03-A/B/C — Control tower canon (original 12)**

1. [x] Canon queue set = late, at-risk, blocked, overloaded, stale (§2.4.1)
2. [x] Each queue bounded definition, not generic dashboard (§2.4.1)
3. [x] Drill-down: explicit "why" + bounded "what next" (§2.4.2)
4. [x] Interventions frozen to: reassign/smooth/replan/escalate (§2.4.3)
5. [x] One execution truth: declared writes + mandatory refresh (§2.4.4)
6. [x] Baseline/forecast/variance vocabulary explicit; baseline preserved via separate forecast columns (§2.4.5, P03-E)
7. [x] Missing baseline posture explicit (§2.4.5)
8. [x] Missing estimate posture explicit (§2.4.5)
9. [x] Dependency edge vocabulary: blocking + waiting_on (§2.4.6)
10. [x] "Affects next" 1-hop blast radius (§2.4.6)
11. [x] Anti-duplicate gate: no parallel truth (§2.4.7)
12. [x] Degraded/error posture explicit: write_denied, partial_refresh_failure, stale_data, missing_baseline, missing_estimate (§2.4.8, P03-F)

**P03-D/E/F — Manager cockpit + extended APIs (6 new)**

13. [x] Manager 6-lane cockpit frozen: action-queue/decisions/blockers/workload/risk/people-change (§2.4.9)
14. [x] Manager lane lifecycle (detect→analyze→decide→execute→verify) persists to governed tables, canonical writes only (§2.4.9)
15. [x] Manager AI layer bounded: summarize only, no truth invention, structured output (§2.4.10)
16. [x] Extended action vocabulary bounded per object type; audit trail on every action (§2.4.9)
17. [x] Extended signal/budget/capacity APIs use canonical tables only (§2.4.11)
18. [x] Dependency link/unlink write exists with mandatory readback (§2.4.4, P03-F)

## Known limits

- **UI consumer** not in P03 scope — API-first delivery; frontend integration is downstream work
- **Smooth/replan now write to `forecast_*` columns** (P03-E fix); baseline `planned_*` is preserved
- **Baseline preservation** relies on `task_baseline_snapshots` for tasks; initiative-level baseline is the original `planned_*` dates
- **Dependency edge vocabulary** uses existing `initiative_dependencies`/`task_dependencies` tables; `blocking`/`waiting_on` semantics are inferred from direction
- **Cross-type dependencies** (INITIATIVE↔TASK) not supported in dependency intervention endpoint
- **Manager AI layer** depends on LLM availability; degrades to heuristics-only when unavailable
- **Manager cockpit demo data** fallback activates when heuristic analysis is empty (no real data); remove in production
