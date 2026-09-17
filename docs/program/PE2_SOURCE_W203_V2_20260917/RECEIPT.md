# P-E2 source convergence v2 — W203

Status: READY FOR CTO REVIEW.

Base after rebase: `9ad0a303c394e172a85e1a200f1de1462be41810` (`origin/integracja/20260911`, `linia-20260917-1900`).
Branch: `codex/a-pe2-v2-w203-20260917`.

## Scope

- `/execution-cases/:id/work` and `generateExecutionWorkAnalysis` now share the same execution work task-source mapper.
- Work-tab tasks are read from `tasks` by the execution case initiative id, then deduplicated against runtime-v1 `execution_task` rows by task id.
- Runtime-v1 remains the first source when the same task exists in both places.
- The weekly work-analysis snapshot refuses to persist an empty task/decision snapshot when source `tasks` or decisions exist.
- The empty-snapshot guard is user-facing through `/api/execution-reports/work-analysis/generate`: HTTP 409, code `EXECUTION_WORK_ANALYSIS_EMPTY_SNAPSHOT`, EN/PL message key `executionReports.workAnalysis.emptySnapshot`.

## Evidence

- Focused vitest after rebase: `server/src/services/execution/__tests__/executionWorkAnalysisService.tasksSource.test.ts` + `server/src/domain/initiatives-execution/__tests__/postgresInitiativeReader.executionTasksSource.test.ts` — 2 files / 4 tests PASS.
- Mutation RED 1: changing `case_scope.initiative_id = t.initiative_id` to `case_scope.initiative_id = t.project_id` makes `postgresInitiativeReader.executionTasksSource.test.ts` fail with only `task-runtime` returned instead of `task-runtime` + `task-work-tab`.
- Mutation RED 2: disabling `assertNonEmptyExecutionWorkSnapshot` makes `executionWorkAnalysisService.tasksSource.test.ts` fail because the expected `EXECUTION_WORK_ANALYSIS_EMPTY_SNAPSHOT` throw disappears.
- `git diff --check` PASS.
- Language gate after rebase: `BRAMKA JĘZYKOWA: OK (nic nie wzrosło)`, report `/tmp/pe2-v2-lang-after-rebase.txt`.
- Front TypeScript after rebase: 167 `error TS` total, 5 in `node_modules`, 0 changed-file hits.
- Server TypeScript after rebase: exit 0; 0 `error TS`, 0 in `node_modules`, 0 changed-file hits.

## CTO stage 2 items not run locally

- Staging dump measurement remains for CTO: `initiative_id` format on production-like data.
- Staging readback for the four Northwind execution cases remains for CTO: `/execution-cases/:id/work` should return `tasks != []` where Work tab has tasks.
- E4 report content measurement remains for CTO.

## Limits

- No staging/demo/Railway/deploy/protected-ref push.
- No migration.
- No staging writes.
