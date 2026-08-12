# E7 — Can a second migration path break Case Workspace at boot?

Date: 2026-08-12
Worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`
HEAD at time of investigation: `a565ce454c`
Scratch DB used: `cw_e7_probe` on `case-workspace-test-pg` (port 55432) — created, used, dropped. `case_workspace_test` was never touched.

## Method

Static reading of every migration-applying script, plus a **real, from-scratch boot** of `server/src/index.ts` against a genuinely empty Postgres database (`cw_e7_probe`), through the actual Docker entrypoint's code path (`initializeDatabase()` → `establishDatabaseReadiness()` → `runMigrations()`), not a synthetic harness. The DB was dropped and recreated between attempts once contaminated by earlier messy runs, with connections terminated first and the `DROP DATABASE` result checked, not silenced.

Boot command used (repo root, port 3023):
```
DB_TYPE=postgres NODE_ENV=test E2E_MODE=true RUN_DB_TESTS=1 MOCK_DB=false PORT=3023 \
JWT_SECRET=<32+ chars> \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/cw_e7_probe" \
./server/node_modules/.bin/tsx server/src/index.ts
```
(`NODE_ENV=test` + `E2E_MODE=true` + `RUN_DB_TESTS=1` is required to route around a `MOCK_DB` gate and a local-host `DATABASE_URL` guard in `server/src/config/databaseTargetResolver.ts`, while still exercising the real, non-mocked `initializeDatabase()` / `runMigrations()` code path — confirmed by reading `server/src/index.ts` lines 253–377.)

The from-scratch boot completed in well under two minutes on this local Postgres (the "10–20 minutes" warning is for the full ~470-file replay against a slower target; here it was fast). Result: `✅ Database ready — serving traffic`, with `case_core`, `case_workspace_artifact_links`, `case_plan_versions`, `case_workspace_run_bindings`, `canonical_inbox_items`, etc. all present afterward (verified with `\dt` against the live probe DB, not from code).

---

## 1. Every migration mechanism, trigger, and readiness relationship

There are **five** distinct scripts/services in this repo that apply SQL files from `server/migrations/`, not four — the program's prior "about four" estimate undercounts by one (`server/scripts/run-migrations-staging.cjs`, found here, was not previously catalogued). A sixth (`v8-migrate.ts`) and a seventh (`MigrationService.ts`) are false positives — the first targets an unrelated schema and file-naming scheme, the second isn't a SQL migrator at all despite the name.

| # | Mechanism | Tag/name | Trigger | Tracking table | Gates readiness? |
|---|---|---|---|---|---|
| 1 | `server/src/services/tablePlatform/migrationRunner.ts` (`runMigrations`) | `[TP Migrations]` (space) | Every real boot, via `establishDatabaseReadiness()` in `server/src/index.ts:325-357`, called **after** #2 | `tp_migration_history` | **Yes.** Production `process.exit(1)` on failure; dev/test stays up with `/api/ready` at 503 (`databaseReadiness.ts`). |
| 2 | `server/src/database/DatabaseInitializer.ts` (`runTablePlatformMigrations`, called from `initializeDatabase()`) | `[TP-Migrations]` (hyphen) | Every real boot, `server/src/index.ts:275-281`, runs **before** #1 | `tp_migration_history` (**same table** as #1) | **No.** Wrapped in its own try/catch (`DatabaseInitializer.ts:3438`) that logs `"...failed (non-fatal)"` and lets `initializeDatabase()` still return `{success:true}`. |
| 3 | `server/scripts/migrate.postgres.ts` | manual CLI | Never automatically — not in `Dockerfile.api`, not in `railway.json`, not a `server/package.json` script hook. Manual/CI-only. | `schema_migrations` (**different table**) | No — standalone script, not part of the app process. |
| 4 | `server/scripts/migrate.ts` | manual CLI, SQLite-first (rewrites Postgres SQL → SQLite dialect) | Never automatic; intended for local SQLite dev per `migrate.postgres.ts`'s own header comment | `schema_migrations` (same table name as #3, but normally a different physical DB — SQLite, not the Postgres target) | No. |
| 5 | `server/scripts/run-migrations-staging.cjs` | manual ops script | Never automatic — human-run (`cd server && node scripts/run-migrations-staging.cjs`), documented in `Harvard/_HANDOFF_USPOJNIENIE_2026-06-25.md`, targets the "trolley" **staging** DB specifically | `tp_migration_history` (**same table** as #1/#2) | No — standalone script. |

Ruled out as not applicable:
- `server/scripts/v8-migrate.ts` — pattern `/^2026\d{4}_v8(?:1)?_.*\.sql$/` requires a literal `_v8_`/`_v81_` in the filename; `20260809_case_workspace_*.sql` never matches. Applies to the separate `v8` Postgres schema. Manual-only (`npm run v8:deploy`). Not a Case Workspace risk.
- `server/src/services/tablePlatform/MigrationService.ts` — despite the name, converts legacy workspace-graph JSON into table-platform records; it does not read or apply `.sql` files. Not a migration runner.
- `server/scripts/preflight-pending-migrations.ts` — read-only report (`STRICTLY READ-ONLY: SELECTs only`), shares `migrationIdentity.ts`'s discovery predicate with #1, deliberately kept in parity by a pinning test. Not an applier.

**Only #1 and #2 run automatically, in every real boot, in that order** (`server/src/index.ts`: #2 at line 275-281 inside `initializeDatabase()`, #1 at line 325-357 inside `establishDatabaseReadiness()`). #3/#4/#5 are all human- or CI-invoked and play no role in what actually happens when Railway/Docker starts the container.

---

## 2. Overlap and disagreement between mechanisms

**#1 and #2 share the exact same tracking table name, `tp_migration_history`, but declare it with different DDL:**

- #2 (hyphen, runs first): `CREATE TABLE IF NOT EXISTS tp_migration_history (id, filename, executed_at, checksum, duration_ms)`
- #1 (space, runs second): `CREATE TABLE IF NOT EXISTS tp_migration_history (id, filename, applied_at, checksum)` — **no `duration_ms`, `applied_at` instead of `executed_at`.**

Because #2 always runs first in a real boot, the physical table on every environment that has ever booted through this code (dev, demo, staging, prod, and this session's probe DB, verified with `\d tp_migration_history`) has `executed_at`/`duration_ms`, and `applied_at` **never exists anywhere**. Neither runner's application code (`SELECT filename, checksum ...` / `INSERT ... (filename, checksum)`) references `applied_at` explicitly, so this is currently a harmless dead branch — but it is a real, verified schema-drift landmine: any future code that queries `tp_migration_history.applied_at` (a report script, an admin panel) will break with `column "applied_at" does not exist` on every real database, not just this probe.

**#1 and #2 largely agree on file discovery, with one asymmetry that matters:** #2's discovery pattern is `/^(7\d{2}|\d{8})_.*\.sql$/`, hardcoded independently inside `DatabaseInitializer.ts:3198` — **not imported from** `server/src/services/tablePlatform/migrationIdentity.ts`, which is documented there as "the single source of truth" that #1 and the preflight script both import from. #1 additionally includes `RUNTIME_MIGRATION_ALLOWLIST` (13 named files: `654_canonical_inbox_items_producer_fresh_db_gap.sql`, `669_...`, `672_...`, `941_...`, `20260802c_mat010_operation_claims_table.sql`, three `942_*` files, `943_/944_/945_*`, `940_mw010_vault_document_versions.sql`) that #2 never sees, because #2 doesn't import the allowlist at all. This asymmetry is what produces the concrete failure documented below (§4).

**Because they share `tp_migration_history` (a `UNIQUE(filename)` table)**, a file that #2 successfully applies and records is correctly skipped by #1 on its later pass — no double-apply, no collision. Conversely, a file #2 fails on is rolled back within its own transaction and never recorded, so #1 discovers and retries it cleanly. This shared-state design is what makes the interaction *survivable* in practice (§6) — but it depends on #1 always running after #2 in the same process, which is exactly what `server/src/index.ts` does today. There is no independent verification that this ordering is structurally protected against being changed by an unrelated future edit to `index.ts`.

**#3 (`schema_migrations`) never sees anything #1/#2 do, and vice versa.** If a human ever runs `migrate.postgres.ts` against demo/staging/prod outside the normal boot (the script exists specifically because Docker's boot path is Postgres-only-via-app-code), its `schema_migrations` bookkeeping and #1/#2's `tp_migration_history` bookkeeping have zero knowledge of each other. Concretely: if `migrate.postgres.ts` applies `20260809_case_workspace_case_core.sql` first, the DDL succeeds; then on the next app boot, #2 does not know that and tries to run the same file again — its non-`IF NOT EXISTS` statements would throw, which #2's `isAlreadyExists` heuristic (`already exists`, `duplicate key`, `duplicate_column`, `duplicate_object`) may or may not catch depending on the exact Postgres error text for that specific statement; anything it doesn't recognize is a hard, if non-fatal-to-boot, failure logged as `[TP-Migrations] ✗ ... failed`. This is a real but **not currently triggered** risk, since #3 is never run automatically — it would only manifest if an operator manually ran `migrate.postgres.ts` against a live environment between deploys, a workflow this repo's own `consultify-promocja-demo` doctrine (`demo=święte`) already discourages.

---

## 3. Does the SAME lexical-ordering defect class exist in the other mechanisms? (highest-value question)

**Yes — in two of the five, unfixed, and currently masked in one of them by an unrelated bug.**

The fixed runner (#1, `migrationRunner.ts`) sorts by `[prefix length, then prefix localeCompare]`, and for files sharing the *identical* prefix (all eleven `20260809_case_workspace_*.sql` files) falls back to an explicit `SAME_PREFIX_ORDER` dependency map — this is the fix that closed the original "fresh install could not boot" defect. That fix mirrors an earlier, more general fix already shipped in `server/scripts/migrate.postgres.ts` (#3) as `DATED_SAME_DAY_ORDER` — confirmed present, same eleven entries, same dependency ordering, `migrate.postgres.ts:284-295`.

**#2 (`DatabaseInitializer.ts`'s hyphen runner) never received either fix.** Its sort is:
```js
.sort((a, b) => {
  const prefixA = a.split('_')[0];
  const prefixB = b.split('_')[0];
  if (prefixA.length !== prefixB.length) return prefixA.length - prefixB.length;
  return prefixA.localeCompare(prefixB);
});
```
For two files with the *identical* prefix (all eleven `20260809_case_workspace_*` share `"20260809"`), `localeCompare` returns `0` and there is **no further tiebreak at all** — not even the raw-filename fallback #1 had *before* its fix. Order among same-prefix files falls through to whatever `fs.readdirSync()` happens to return, entirely unspecified by the comparator. Verified empirically: `readdirSync('server/migrations')` on this filesystem returns `artifact_links` before `case_core` — i.e., the exact ordering that broke #1 originally would reproduce identically in #2 if #2 ever reached that file group.

**#2 does not reach it in practice, but not because of any fix — it dies earlier from an unrelated defect.** #2's discovery pattern is a raw copy of `MIGRATION_PATTERN` with **no allowlist**, so `654_canonical_inbox_items_producer_fresh_db_gap.sql` (the sole producer of `canonical_inbox_items`, and *only* discoverable via #1's `RUNTIME_MIGRATION_ALLOWLIST`) is invisible to #2. #2 therefore always fails on `736_inbox_performance_indexes.sql` on a genuinely fresh database — confirmed by direct boot (§4) — and its loop is fail-fast (`throw` on first error, no continue), so it stops at `736_...` **before ever reaching any 8-digit-prefixed file at all**, since 3-digit prefixes sort before 8-digit ones. The dormant ordering bug in #2 is real, reproducible in isolation (confirmed via `readdirSync`), and currently unreachable only as a side effect of a second, independent bug (§4) that happens to sit earlier in the same sort order.

**#4 (`migrate.ts`) also has no fix** — plain `.sort()` (`server/scripts/migrate.ts:50-52`, comment: `"Alphabetical order ensures version order"`) with zero dependency awareness. It targets SQLite by default, not the Postgres database Case Workspace runs on, so it does not currently threaten a real Postgres boot — but the discovery/ordering *logic* carries the identical unfixed defect class.

**#5 (`run-migrations-staging.cjs`) also has no fix, and unlike #2 it is not masked.** Its pattern is `/^(\d{8})_.*\.sql$/` — **only** 8-digit dated files, no 7xx/9xx numbered files at all, so it never encounters `736_inbox_performance_indexes.sql` and is never protected by that accident. Its sort is a plain `.filter(...).sort()` on the full filename — the *exact* original bug: `20260809_case_workspace_artifact_links.sql` sorts before `20260809_case_workspace_case_core.sql` by straight ASCII order, with **zero** tiebreak logic of any kind. Unlike #2, a failure here is loud, not swallowed: `console.log('❌ FAILED'); process.exit(1)`. So this script does not corrupt state, but **it would hard-fail** (exit 1, blocking whatever manual pipeline invoked it) if ever run against a staging database that does not already have `case_core` from a prior app boot. It is not wired into any automated CI/deploy step today — it's a documented, human-invoked tool (`Harvard/_HANDOFF_USPOJNIENIE_2026-06-25.md`) — but it is the one sibling where the fix genuinely never propagated *and* nothing else currently protects it.

**Verdict for §3: the fix is not structurally shared.** It was applied twice independently (once in #3, mirrored once in #1, per that file's own code comments — "Keep the two maps in sync if a new same-day case_workspace file is added; they are intentionally not shared code"), and never applied to #2, #4, or #5. #2's exposure is masked today by an accident of sort order interacting with an unrelated missing-allowlist-entry bug, not by design. #5's exposure is not masked by anything.

---

## 4. Is the `canonical_inbox_items` / `736_inbox_performance_indexes.sql` failure genuinely harmless to Case Workspace?

**Yes, confirmed by a real boot, not by inspection.** From the from-scratch probe boot log:

```
[TP-Migrations] ✓ 735_tasks_status_index.sql (3ms)
[Postgres] Query Error [QUERY]: ...
[Postgres] Failed SQL: -- Performance indexes for canonical inbox and source tables...
[TP-Migrations] ✗ 736_inbox_performance_indexes.sql failed: relation "canonical_inbox_items" does not exist
[DatabaseInitializer] Table Platform migrations failed (non-fatal): Table Platform migration 736_inbox_performance_indexes.sql failed: relation "canonical_inbox_items" does not exist
```
— and #2's loop stops there (no further `[TP-Migrations]` lines follow; the `throw` propagates out and is caught non-fatally, per `DatabaseInitializer.ts:3438-3443`).

The boot then continues into #1 (`[TP Migrations]`, space), which — because its discovery includes the `654_canonical_inbox_items_producer_fresh_db_gap.sql` allowlist entry and sorts it (`"654"` < `"736"` lexically, both 3-digit) before `736_...` — creates `canonical_inbox_items` itself, then successfully applies `736_inbox_performance_indexes.sql` on top of it, then goes on to apply **all eleven** `20260809_case_workspace_*` files in the correct dependency order via `SAME_PREFIX_ORDER`. Final result: `[TP Migrations] Complete: 432 applied, 39 already up to date (471 total)`, followed by `✅ Database ready — serving traffic`. Verified directly against the live probe database afterward:
```
public | canonical_inbox_items         | table | case_workspace
public | case_core                     | table | case_workspace
public | case_workspace_artifact_links | table | case_workspace
public | case_plan_versions            | table | case_workspace
public | case_workspace_run_bindings   | table | case_workspace
```
Both `canonical_inbox_items` and every Case Workspace table exist after boot. The `736` failure is entirely absorbed: it costs one non-fatal error-level log line and nothing else, because #2's design (per-file transaction, rollback-then-throw, never records a failed file) leaves no partial state, and #1 independently rediscovers and correctly applies everything #2 didn't finish.

**Corroborating, orthogonal finding (not blocking Case Workspace, but the same failure class):** the probe boot also logged, seconds after reaching readiness:
```
[ClosureDeliveryReceipt] reconciliation cron tick failed: relation "closure_delivery_receipts" does not exist
```
`935_exe009_closure_delivery_receipt.sql` (the sole producer of that table) matches **neither** branch of `MIGRATION_PATTERN` (`935` is 3 digits but doesn't start with `7`; it's not 8 digits) **and** is not in `RUNTIME_MIGRATION_ALLOWLIST` — so neither #1 nor #2 ever discovers it on a real boot. This is an EXE-009 (Execution module) table, unrelated to Case Workspace, so out of this packet's scope to fix — but it is live, current evidence of the exact same discovery-gap pattern the program has already hit twice (932_* files, per `migrationIdentity.ts`'s own comments), surfacing as a real cron error on the very boot this packet ran. Flagging for whoever owns EXE-009/closure delivery receipts, not acting on it here (out of allowlist).

---

## 5. Any mechanism that can report success on a failed migration?

**Yes — `server/scripts/migrate.postgres.ts --safe`, confirmed by reading the code, and it is exactly the historical trap this program has already been burned by once.**

```js
} catch (e: any) {
  ...
  if (safe) {
    await recordResult(pool, m, 'skipped', Date.now() - started, `skipped:${m.checksum}`);
    continue;
  }
  await recordResult(pool, m, 'failed', Date.now() - started);
  throw e;
}
```
With `--safe`, a migration that throws is recorded with `status: 'skipped'` (not `'failed'`) and the loop **continues** to the next file rather than stopping. After the loop finishes, the script logs `✅ Postgres migrations complete` and returns normally — `main().catch()` only calls `process.exit(1)` on an uncaught throw, which `--safe` prevents. **Exit code 0, "complete" banner, on a database with a migration that never actually applied**, recorded under a status name (`skipped`) that reads as "intentionally not needed" rather than "failed." Any CI gate or human checking only the exit code or the "complete" banner would see green.

This script is not invoked automatically (§1), so it cannot silently break a real Case Workspace boot today. But it is present, unmodified, and would reproduce the exact `db:migrate --safe` failure-reported-as-skipped trap noted in this program's prior memory (`audyt-bazy-danych-2026-08-06.md`) if anyone ever ran it with `--safe` against demo/staging/prod.

Mechanisms #1 and #2 do **not** have this trap — both were explicitly designed against it. #1's code comment is direct: *"Do not record history, do not call this 'skipped', do not report success. A later run must rediscover and retry this file."* #2 similarly only treats specific, narrow `already exists`-class errors as "skipped," and genuinely rethrows anything else. #5 (`run-migrations-staging.cjs`) also fails loud (`process.exit(1)`), no `--safe`-equivalent flag exists there.

---

## 6. Verdict

**No — a second migration path cannot break Case Workspace in a real boot today, but the safety is accidental in one specific place, not structural.**

Reasoning, in order of how the actual boot sequence runs:

1. `server/src/index.ts` runs #2 (`DatabaseInitializer.ts`'s hyphen runner) unconditionally before #1 (`migrationRunner.ts`'s space runner). This ordering is not itself protected by any test or invariant found in this investigation — it is simply what `index.ts` currently does.
2. #2 carries the identical unfixed lexical-ordering defect that #1 had before this program's earlier fix — confirmed by direct code inspection and by reproducing the exact same-prefix `readdirSync` order (`artifact_links` before `case_core`) that broke #1 originally.
3. On every real fresh boot, #2 never reaches that defect, because it always dies earlier and non-fatally at `736_inbox_performance_indexes.sql` (missing `canonical_inbox_items`, itself caused by a *different*, independent gap — #2's hardcoded pattern never importing the shared allowlist). This was confirmed empirically, not assumed, on a genuinely fresh probe database.
4. Whatever #2 does or doesn't finish, #1 runs afterward, is the one mechanism that actually gates `/api/ready`, has the correct dependency-aware ordering, and — per this session's real boot — successfully creates every Case Workspace table and reaches `✅ Database ready — serving traffic`.
5. Even in the hypothetical where #2 *did* reach the case_workspace file group and hit the ordering bug for real, that failure is still caught by `DatabaseInitializer.ts`'s non-fatal wrapper and would not itself crash the boot or block readiness — #1 would still run afterward and self-heal, by the same shared-`tp_migration_history` mechanism verified in §2.

So the actual protection Case Workspace has today is **layered, not single-point**: (a) #1's real fix, (b) #2's non-fatal failure handling as a backstop even where it isn't fixed, and (c) #2 being masked from ever exercising its unfixed bug by an unrelated accident. Only (a) is a deliberate, tested safeguard. (b) is a genuine design decision (per its code comment: *"Non-fatal: legacy app still works without table platform"*) and is real protection, not luck. (c) is the one genuinely fragile link: it depends on `736_inbox_performance_indexes.sql` continuing to fail on a fresh DB for #2 specifically, which depends on `654_canonical_inbox_items_producer_fresh_db_gap.sql` continuing to be excluded from #2's hardcoded pattern — neither of which is enforced by any test. If a future, unrelated change to `DatabaseInitializer.ts`'s pattern or to migration file numbering caused #2 to get past `736`, #2 would still not break the boot (thanks to (b)), but it *would* start throwing the ordering error on the case_workspace group specifically, adding noisy non-fatal errors to every fresh boot's logs.

**#5 (`run-migrations-staging.cjs`) is the one mechanism in this repo that genuinely could break something today if run** — not Case Workspace's automated boot (it never runs automatically), but a manual staging migration pass, if ever exercised against a staging database that does not already carry `case_core` from a prior app boot. It has the unfixed original bug with zero mitigation and fails loud (exit 1), which would block whoever ran it until they manually diagnosed and reordered — a real, if narrow and human-triggered, risk that was not on this program's radar before this packet.

---

## 7. What I could not determine

- Whether `run-migrations-staging.cjs` has ever actually been run against the real staging ("trolley") database, and if so, whether staging's `tp_migration_history` already contains the case_workspace files (which would mean the script's bug is currently dormant there too, same as #2's dormancy here) — would require read access to staging's `tp_migration_history` table, which this packet's scratch-DB-only method did not touch (per the hard rule against `case_workspace_test` and demo/staging mutation).
- Whether `DISABLE_TP_MIGRATIONS=true` has ever been set on a real deployment. Confirmed by code (`databaseReadiness.ts:75-87`) that this correctly refuses readiness rather than silently proceeding — a fail-closed design, not a defect — but did not verify this against a live environment's actual env-var history.
- The exact Postgres error text for every one of the ~460 migration files' "already applied" retry path in #2's `isAlreadyExists` heuristic (`already exists`, `duplicate key`, `duplicate_column`, `duplicate_object`) — confirmed the heuristic exists and is narrow, but did not exhaustively test every migration file's specific re-run error message against it. The §2 disagreement scenario (a human running `migrate.postgres.ts` against a live environment between boots) was reasoned from code, not reproduced live, per the hard rule against demo/staging mutation.
- Full production timing: this probe's ~470-file replay finished in under two minutes because it targeted a fast local Postgres container. The packet's own trap warning (10–20 minutes on a real target) was not something this session needed to wait out, but it means this timing evidence should not be read as a claim about demo/prod/staging boot duration.
