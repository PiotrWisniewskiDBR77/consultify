# Freeze manifest — P-E2 source convergence v2 W203

Package: P-E2 source convergence v2.
Status: READY FOR CTO REVIEW.

Changed files in v2:

- `server/src/services/execution/executionWorkTaskSource.ts`
- `server/src/services/execution/executionWorkAnalysisService.ts`
- `server/src/services/execution/__tests__/executionWorkAnalysisService.tasksSource.test.ts`
- `server/src/domain/initiatives-execution/postgresInitiativeReader.ts`
- `server/src/domain/initiatives-execution/__tests__/postgresInitiativeReader.executionTasksSource.test.ts`
- `server/src/routes/executionReports.routes.ts`
- `server/src/services/report/reportLocale.ts`
- `docs/program/PE2_SOURCE_W203_V2_20260917/RECEIPT.md`
- `docs/program/PE2_SOURCE_W203_V2_20260917/FREEZE_MANIFEST.md`

Acceptance evidence:

- Work source convergence is proven at the service and `/execution-cases/:id/work` reader boundary.
- `tasks` rows join by execution case initiative id.
- Runtime-v1 rows deduplicate `tasks` rows by task id.
- Empty generated snapshots are blocked when source work data exists.
- User-facing EN/PL error text is available through the report locale catalog.
- No schema migration was added.
