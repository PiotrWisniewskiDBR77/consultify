# F2-E E1 NON_MIGRATION_REMEDIATION V3 — post-hook independent rereview

**Verdict: scoped ACCEPT for the two post-hook changes.** The regenerated focus baseline is an exact per-file snapshot of the current scanner result and does not hide growth. Removing the literal `expectedDatabase: 'f2e_e1'` pin makes the test compliant with Z31 and does not materially weaken the controlled RealPG proof recorded here. Full E1 remains **HOLD / MIGRATION_REQUIRED** for restart-safe, multi-replica persistence; this rereview does not accept full E1.

## Reviewed delta

- `scripts/check-focus-canon.baseline.txt`: aggregate reduced from `61 files / 169 occurrences` to `59 / 160`; the only removed rows are `src/components/Finance/ExportToOutputDialog.tsx` (`3 -> 0` current matches) and `src/views/ContextBuilder/modules/CompanyProfileModule.tsx` (`6 -> absent/untracked in the current tree`).
- `server/src/routes/__tests__/organizationExportFiveFamilies.http.pg.test.ts`: the literal option `{ expectedDatabase: 'f2e_e1' }` was removed; `assertRealPostgresTestEnvironment()` remains.
- Review source HEAD: `e0279b4c1e3ccc71bcadd50e3dc739677ae70f99`.
- Reviewed file SHA-256 values after the hook: focus baseline `48e4759369d5936ab99cf42ffc73e40677e0e4a4b6b945ffea62ff98ebcf3a0e`; five-families test `2be555bceb0fe101f2d1d40dd0ff0898fac8fa615fcdac5359cc19f4d27b6bbd`.

## Independent results

- An independent implementation-equivalent scan using the current `VIOLATION_RE` produced `59 files / 160 occurrences`. Its entire per-file map equals the regenerated baseline: no missing row, no stale row and no count difference.
- `bash scripts/check-focus-canon.sh --ci`: **PASS**, exit `0`, `59 files / 160 occurrences`; no untracked focus violation.
- `bash scripts/check-z31.sh --ci`: **PASS**, exit `0`; `0` database-name pins. The reported `31` permanent skips in `5` files are unchanged, baseline-accounted debt and do not affect this delta verdict.
- Real PostgreSQL target: container `cx-f2e-pg`, published at `127.0.0.1:6456`, database `f2e_e1`. Server readback before the suite returned `current_database() = f2e_e1`, `current_user = postgres`, and PostgreSQL version identity.
- With `NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false`, the local `DATABASE_URL`, and the route prerequisite `ENABLE_V8_GLOBAL=true`, `npx vitest run server/src/routes/__tests__/organizationExportFiveFamilies.http.pg.test.ts --reporter=verbose` passed **1/1**. Runtime emitted `DB_IDENTITY ... 127.0.0.1:6456/f2e_e1`; the test then used real ApiGateway/JWT writes and found all five families in JSON and CSV archive output.
- A qualification run without `ENABLE_V8_GLOBAL=true` failed closed at the real V8 route with `404 V8_DISABLED`; it did not produce false green evidence. A qualification run with an incorrect local password likewise failed in `assertRealPostgresTestEnvironment`; it did not skip.
- `git diff --cached --check`: **PASS**.

## Protection assessment

The removed literal database-name assertion was redundant for the exact controlled invocation and conflicted with Z31's explicit rule against disposable-database name pins. The shared guard still requires `RUN_DB_TESTS=1`, requires `MOCK_DB=false`, parses `DATABASE_URL`, rejects the known production/demo hosts, opens a real PostgreSQL connection, and verifies `version()`, `current_database()` and `current_schema()` through live queries. The test separately requires `DB_TYPE=postgres`; both its direct `pg` pool and the application route layer consume the same local `DATABASE_URL`. Those checks prevent mock/skip success and remote known-environment use.

The residual boundary is operational: without `expectedDatabase`, a caller can point the suite at another allowed PostgreSQL database, including another local database. This rereview accepts the delta because the requested command supplied the isolated local target and runtime readback proved `f2e_e1`; the result must not be generalized into permission to run this write-heavy test against an arbitrary allowed host or database.

No source, freeze manifest, migration, commit, push, deployment, or channel file was changed by this reviewer. The only created artifact is this post-hook rereview report.
