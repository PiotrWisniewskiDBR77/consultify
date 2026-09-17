# P-E2 source convergence — W198

Status: READY FOR CTO REVIEW.

Base: `1b662df8cd2cac255f008d40a6dd13d3718d879d` (`origin/integracja/20260911`).
Branch: `codex/pe2-source-w198-20260917`.

## Scope

- `generateExecutionWorkAnalysis` now reads Work-visible tasks from `tasks` for initiatives that have a runtime-v1 execution case.
- Runtime-v1 execution rows remain the first source for decisions, milestones, and runtime tasks.
- Task rows from `tasks` are deduplicated by task id when a runtime `execution_task` with the same id already exists.
- The weekly report payload now carries Work-aligned task counters: total, overdue, blocked.
- Report section rows include `source` so CTO can see whether a row came from `runtime-v1` or `tasks`.

## Evidence

- `npm ls @types/node --depth=0` => `@types/node@22.19.3`.
- Focused vitest: `server/src/services/execution/__tests__/executionWorkAnalysisService.tasksSource.test.ts` — 2 tests PASS.
- `git diff --check` PASS.
- TSC server: exit 0; TypeScript errors `0`, node_modules errors `0`, changed-file hits `0`.
- TSC front: timed out at 120 s with `SIGTERM`; log until timeout: TypeScript errors `0`, node_modules errors `0`, changed-file hits `0`.

## Limits

- No screenshots per current channel rule.
- No staging/demo/Railway/deploy/protected-ref push.
- No migrations.
