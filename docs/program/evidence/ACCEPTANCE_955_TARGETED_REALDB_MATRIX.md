# Acceptance 955 targeted real-DB matrix evidence

- Candidate: `955dd98a23c346c55205e898ee540a1fdf95884d`
- Database: disposable `pgvector/pgvector:pg15`; all 718 migrations applied.
- Safety: local-only database, removed after the run. No demo or production writes.
- Execution: one test file per process to prevent module, environment, HTTP-server, and database-state leakage.

Companion command (with a newly created and migrated disposable database):

```sh
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://consultify:consultify@127.0.0.1:56955/consultify \
npx vitest run <one-realdb-file> --no-file-parallelism --retry=0
```

The 13 files added to `realdb.files` produced zero failures individually:

| File | Result |
| --- | --- |
| `tests/integration/apiFullFlow.test.js` | 4 passed |
| `tests/integration/auth.test.js` | 6 passed |
| `tests/integration/auth.test.ts` | 7 passed |
| `tests/integration/initiatives.test.js` | 5 passed |
| `tests/integration/megatrend.test.js` | 6 passed |
| `tests/integration/organization-management.workflow.test.js` | 4 passed |
| `tests/integration/projects.test.js` | 4 passed |
| `tests/integration/chat/streaming.test.ts` | 5 passed |
| `tests/integration/mywork/my-work.inbox-v4-tenant-negative-controls.test.ts` | 3 passed, 1 explicit conditional skip |
| `tests/integration/routes/ai.test.js` | 9 passed |
| `tests/integration/routes/auth.test.js` | 6 passed |
| `tests/integration/test-support/testSupportRoutes.test.ts` | 4 passed |
| `tests/integration/routes/pmo/projects.aiRole-and-regulatory.real.test.ts` | 2 passed |

`tests/integration/routes/demoRoutes.no-stubs.test.ts` (0/7 executed) and
`tests/integration/routes/notifications.escalations.authz.test.ts` (0/3 executed)
were skip-only even with a migrated PostgreSQL database. They are therefore
classified under `legacyPostgresPort` and are explicitly **NOT_RELEASE_EVIDENCE**
until their fixtures execute every assertion in a dedicated gate.

The two Settings/GDPR suites were subsequently ported from obsolete SQLite
fixtures to the same fail-closed PostgreSQL gate. Their focused rerun is green:
2 files, 9 tests passed, 0 failed, 0 skipped. They are also classified in
`realdb.files` and excluded from the standard sentinel gate.
