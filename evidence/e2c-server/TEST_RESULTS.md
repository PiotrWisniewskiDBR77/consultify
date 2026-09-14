# E2c server locale — test results

- Exact base: `19b633c81e262b9f3c2f25b0555b2dfceab8b42e`
- Tested rebased candidate before the renewed freeze manifest: `ecad112f173d6b9ad524decbec786049d64876bb`
- PostgreSQL: `cx-a-e2c-pg`, `127.0.0.1:5331`, database `consultify_q2`
- RealPG controls: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`

## Frozen scope (7 items)

1. Shared EN/PL report catalog and locale resolver.
2. KPI snapshot locale plus stable localization keys/parameters while retaining legacy strings.
3. Execution report Markdown/PDF/DOCX output in the snapshot locale.
4. Status, level, and RAG rendering from stable codes through the shared catalog.
5. DRD HTML/deck report uses the explicit job/report locale rather than a Polish default.
6. DRD section generation uses the same frozen locale resolution.
7. Scheduled reports persist locale, pass it to builders, and use it for dashboard/email output.

## Focused tests

- `scheduledInitiativeWorkReport.test.ts`: 4/4 passed, retry 0.
- `scheduledReportService.locale.test.ts`: 2/2 passed, retry 0.
- `reportLocale.test.ts`: 2/2 passed, retry 0.
- `executionReports.export.test.ts`: 6/6 passed, retry 0.

## Real PostgreSQL

`executionReportE4.gateway.smtp.realdb.test.ts`: 5/5 passed, no skip, retry 0. The run used ApiGateway/JWT/PostgreSQL/PDF/SMTP and verifies the frozen EN KPI locale contract. The database was dropped and recreated before the valid run.

The first post-rebase attempt found tables left by the preceding run and was invalid. The database was dropped and recreated; only the subsequent clean 5/5 run is the acceptance evidence.

## TypeScript

- Exact base server TypeScript: exit 0.
- Candidate server TypeScript: exit 0.

No migration, staging data, `compileDrdPack`, or D3 code was changed. Independent review has not run; this package stops at the review gate.
