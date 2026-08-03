# STRICT SCHEMA — CONTROLLED HANDOFF (round 2, Railway DEV verification)

## Branch / commits

- Branch: `codex/strict-fresh-schema-ordering-repair`
- Base going into this round: `85902753ee423610d4fe042b21f5cf58885151be` (prior round's final commit, verified only against local Docker)
- **Final HEAD this round: `0128717ad48fb33b8d919ac7eac4d0bb6d58e17c`**
- Original pre-repair base (used for the negative control): `1421ae29dc782e887c890c2a9dfcf850f88b8d42`

Commits made this round:

```
0128717ad4 fix(migrate): trim unverified schema from prior round's fresh-DB gap files
```

(One commit. No new fresh-schema ordering/producer gap was found this round, so there is no second "new fix" commit — see Gates 1–8 below.)

Full commit range this round covers only the tightening pass:

```
git diff --stat 85902753ee423610d4fe042b21f5cf58885151be..0128717ad4
 server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql |   90 -
 server/migrations/20260719_baseline_gap.sql                        | 3030 -----
 2 files changed, 3120 deletions(-)
```

## Tightening pass — what was removed/trimmed and why

**`server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql`** (43 → 37 tables): removed 6 tables with **zero real application consumers**, verified by grepping `src/` and `server/src/` for SQL-context references (`FROM|INTO|UPDATE|JOIN|TABLE|EXISTS(` + name), excluding the table's own `CREATE TABLE` in `PostgresDatabase.ts`/`DatabaseInitializer.ts` and excluding matches inside the migrations themselves:

| Table | Finding |
|---|---|
| `ai_ideas` | Frontend `api.ts: getAIIdeas()` calls `GET /ai/ideas` — **no such backend route exists anywhere** (`grep -rn "ai/ideas" server/src` = 0 hits). Dead client call. |
| `ai_observations` | No consumer anywhere; only self-referential to the same dead AI-ideas feature. |
| `mfa_attempts` | Zero references outside its own `CREATE TABLE` in `PostgresDatabase.ts`. |
| `scheduled_emails` | Same — zero references outside its own `CREATE TABLE`. |
| `security_settings` | **False cognate**: the only "hit" was a factor-name string literal `'security_settings'` in `transactionReadinessService.ts:244`; the actual query on that line reads `FROM organization_security_settings` (a different, real table with its own — separately missing, **out-of-scope** — gap; see "Incidental findings" below). |
| `user_consents` | Same false-cognate pattern: `server/src/routes/gdpr.routes.ts` genuinely implements consent management, but reads/writes `user_gdpr_consents`, never `user_consents`. |

Each removed table's `CREATE TABLE` also still exists verbatim in `PostgresDatabase.ts`'s `initDb()` (the real app-boot self-heal path — see Gate 4), so removing them from the migration-only producer file is a pure trim, not a functional regression: **empirically confirmed** — `strictschema_verify_fresh1_a1` after a full strict run (which incidentally triggers `initDb()` mid-run via the `.ts` JS-migrations, see Gate 1 notes) still has all 6 tables, created by `initDb()`, not by this file. Table count is unchanged (1287) with or without these 6 in the migration-only file.

The remaining 37 tables in this file were each grep-confirmed to have a real consumer (route/service query) or a real consuming migration; kept as-is.

**`server/migrations/20260719_baseline_gap.sql`**: this round's added guard block (2864 `ADD COLUMN IF NOT EXISTS` lines from the prior round, on top of an already-existing 33,473-line auto-generated migra-diff file that pre-dates this repair entirely) was **exhaustively classified**, not sampled, using a script (`verify-guards.js`, kept in the session scratchpad, not committed) that:

1. Replicates `migrate.postgres.ts`'s exact phase/sort logic (same `PROMOTED_LEGACY_PRODUCERS`, `EARLY_VERSION_OVERRIDES`, `isSqliteOnlyMigration`, phase 0/1/2/3 ordering) to get the identical execution order the real runner uses.
2. Walks every included migration in that order, parsing `CREATE TABLE IF NOT EXISTS` (building a table's real column set from its **first-in-order** producer only, matching Postgres's real no-op-on-duplicate semantics) and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements, maintaining a `table -> known columns` map exactly as Postgres would see it, statement by statement.
3. For each of the 2864 new guard lines: **REDUNDANT** if the column was already known before the guard ran (i.e., the table's real first-in-order producer already declares it — the guard is a no-op given how the file's own generator over-applied guards uniformly to every duplicate `CREATE TABLE` block in the file, not per-actually-missing-column); **GENUINE** if the column was not yet known (the guard closes a real gap).

Result: **2636 REDUNDANT, 228 GENUINE**. Spot-verified by hand against the real migration files before trusting the script output — e.g. `adkar_assessments` (fully redundant: `000_z_core_baseline.sql` already declares all 15 columns the guard re-adds) vs. `account_deletion_requests` (partially genuine: `900_prod_missing_tables_hotfix.sql`'s 8-column version is missing `scheduled_for`/`completed_at`, which the guard correctly adds). Removed the 2636 redundant lines (and the 197 comment blocks that became fully empty as a result — 44 blocks were partially trimmed, kept with their comment); kept the 228 genuine ones under their original justification comments. File went from 36,819 → 33,789 lines (−3030, exactly `2636 alter-lines + 197 comments + 197 trailing-blank-lines` for the fully-dropped blocks).

**`000_z_core_baseline.sql`'s own self-healing guards were left unchanged** — these are a *different* pattern than `20260719_baseline_gap.sql`'s (duplicate-producer-within-the-migration-set) and were separately verified genuine: they defend against `server/src/database/PostgresDatabase.ts`'s `initDb()`, which `getPool()` calls automatically on first pool creation (confirmed by reading `PostgresDatabase.ts:482`, unconditionally unless `DB_MANAGED_SCHEMA=false/0/off` or test-mode skip) — a real, always-on, non-migration producer with a genuinely smaller/different column set for `organizations`/`users`/`sessions`/`settings` than the migration baseline. This is exactly gate 4's thin-bootstrap scenario, and it is real (see Gate 4 below).

**Single-purpose fix files re-verified, no changes**: `556_partner_certification_exams.sql`, `559_tools_known_tools_library.sql`, `562_tools_toolsets_speed.sql`, `20260331_p28_workbench_p29_partner_program_ledger.sql`, `20260331_p35b_canonical_model_completion.sql`, `20260624_initiative_column_dedup.sql`, `797_user_sessions_missing_columns.sql`, `933_initiative_section_types_closure.sql`, `654_canonical_inbox_items_producer_fresh_db_gap.sql`, `669_tool_facilitation_producer_fresh_db_gap.sql`. Each justification comment's cited type-mismatch or consumer was re-checked against the current branch state (e.g. confirmed `partner_organizations.id` is genuinely `UUID` in `215_partner_portal.sql`, confirmed `529_initiative_section_types.sql` genuinely declares `is_system`/`is_active` as `INTEGER`, confirmed `canonical_inbox_items`/`tool_facilitation_*` consumers cited in the 654/669 files are real live call sites with non-trivial reference counts). No drift found; nothing changed.

## Gate results (Railway DEV, isolated temp databases)

All commands run with `MOCK_DB=false`, no `--safe`, from inside the repair worktree unless noted. `RAILWAY_MAINT_URL` = `postgresql://postgres:<redacted>@thomas.proxy.rlwy.net:20221/railway` (used only to issue `CREATE DATABASE`/`DROP DATABASE`/catalog queries — never to run migrations). Six isolated temp databases were created, all on `thomas.proxy.rlwy.net:20221` (Railway `consultify` project, `dev` environment, `Postgres` service — confirmed via `railway status` before starting):

`strictschema_verify_fresh1_a1`, `strictschema_verify_fresh2_a1`, `strictschema_verify_thinboot_a1`, `strictschema_verify_int939940_a1`, `strictschema_verify_negctrl_a1`, `strictschema_verify_restored_a1`.

### Gate 1 — Fresh strict run

```
railway variables --kv   # confirmed DATABASE_PUBLIC_URL host/port; never migrated against the "railway" db itself
psql-equivalent (node/pg): CREATE DATABASE strictschema_verify_fresh1_a1;
DATABASE_URL=postgresql://postgres:<redacted>@thomas.proxy.rlwy.net:20221/strictschema_verify_fresh1_a1 \
  MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts
```
Result: **PASS**. `Applying migrations: 497` → `✅ Postgres migrations complete`. `schema_migrations`: 497 success / 0 failed / 0 skipped. `information_schema.tables` (public): **1287**.

Note: one of the 497 migrations is a `.ts` file (`20260620_*.ts`), applied via `applyJs()`, which imports the app's `Database.js` → triggers `getPool()` → triggers `initDb()` mid-run (confirmed via `[Postgres] Verifying/Creating Indexes...` / `Schema Check Complete` log lines appearing partway through the run). So gate 1 is not a "pure migration-only" run in practice — it already incidentally exercises the app-boot bootstrap once, after all phase-0 (numbered) migrations have run. This is why the 6 tables trimmed from `000_zz_...` in the tightening pass still show up in the final schema (created by `initDb()`, not by the trimmed file) — verified directly: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('ai_ideas','ai_observations','mfa_attempts','scheduled_emails','security_settings','user_consents')` returned all 6.

### Gate 2 — Immediate strict replay, same DB

```
DATABASE_URL=...strictschema_verify_fresh1_a1 MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts
```
Result: **PASS**. `Applying migrations: 0` → `✅ Postgres migrations complete`. Clean no-op.

### Gate 3 — Second, fully independent fresh DB

```
CREATE DATABASE strictschema_verify_fresh2_a1;
DATABASE_URL=...strictschema_verify_fresh2_a1 MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts
```
Result: **PASS**, identical to gate 1: 497 success / 0 failed / 0 skipped, 1287 tables. Deterministic.

### Gate 4 — Thin app-bootstrap simulation

Real bootstrap path identified and used (not invented): `server/src/database/Database.ts`'s `getDatabaseAsync()` → `PostgresDatabase.ts`'s `getPool()`, which auto-fires `initDb()` on first pool creation (`PostgresDatabase.ts:482`), unless explicitly disabled. A scratch script (not committed) called `getDatabaseAsync()` then issued one real query (`db.all('SELECT 1')`) to force `executeWithLogging()`'s `if (initDbPromise) await initDbPromise;` to actually block until `initDb()` finished (a bare `getDatabaseAsync()` call without a following query returns before schema init completes — confirmed empirically: first attempt without the follow-up query left 0 tables).

```
CREATE DATABASE strictschema_verify_thinboot_a1;
DATABASE_URL=...strictschema_verify_thinboot_a1 npx tsx server/scripts/_scratch_thin_bootstrap.ts   # initDb() only
  -> 72 tables, organizations missing industry/active_llm_provider_id/billing_currency/billing_country/vat_number/tax_exempt
DATABASE_URL=...strictschema_verify_thinboot_a1 MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts
```
Result: **PASS**. `Applying migrations: 497` → `✅ Postgres migrations complete`. 497 success / 0 failed / 0 skipped, **1287 tables** (same as pure-fresh). The 6 `organizations` columns missing after the thin-bootstrap-only step were all present after the migration run, confirming `000_z_core_baseline.sql`'s self-healing `ADD COLUMN IF NOT EXISTS` guards (kept, unchanged, from the prior round) do their job against this real producer-collision scenario.

### Gate 5 — Schema assertions for MW / FIN / MAT / RES / INI

Built from real DB-access code, not guessed: extracted every `FROM|INTO|UPDATE|JOIN <table>` reference from all non-test `.ts` files under `server/src` matching each package (`*initiative*` → INI, 66 files; `*finance*` → FIN, 48 files; `*deliverables*`/`*material*` → MAT, 56 files; `*results*` → RES, 39 files; `*myWork*`/`*inbox*` → MW, 10 files), de-duplicated to 185 distinct candidate names, then checked each against `strictschema_verify_fresh1_a1`'s post-migration `information_schema.tables`.

182/185 resolved cleanly (the rest of the 185 minus the 3 below were either real tables that exist, or obvious English-prose false positives from comments like "and"/"below"/"this"/`information_schema`/`pg_database`, discarded as noise). **3 flagged as pre-existing, out-of-scope gaps** (not this round's regression, not fresh-schema-ordering related — see "Incidental findings" below): `risks`, `kpi_scorecards`, `kpi_scorecard_items`.

Column-level spot check on tables touched/added by this repair's producer-gap files, all present with full expected column sets on `strictschema_verify_fresh1_a1`: `financial_statement_packs` (21 cols), `initiative_candidates` (13), `canonical_inbox_items` (23), `tool_facilitation_sessions/outcomes/roles/votes` (11/9/6/9), `kb_categories`/`kb_articles` (8/29), `my_ideas` (30), `permission_requests` (19), `partner_certification_attempts`/`partner_certificates`/`partner_program_ledger` (14/16/15, with `certification_id`/`partner_org_id` confirmed `uuid` type per the 556/20260331_p28 fixes).

### Gate 6 — 939/940 integration test (disposable worktree, external evidence only)

Per explicit correction from the task owner: this is **separate supporting evidence**, not something this branch takes ownership of. Nothing from the disposable worktree was committed to `codex/strict-fresh-schema-ordering-repair`; the two source migration files' **content** was never modified, anywhere, only copied verbatim (one filename-renamed).

Disposable worktree setup:
```
git worktree add --detach <scratch>/wt-939-940-disposable HEAD   # HEAD = 0128717ad4, this branch's own final commit
git show codex/fin-007-post-investment-actuals:server/migrations/939_fin007_post_investment_actuals.sql \
  > <disposable>/server/migrations/939_fin007_post_investment_actuals.sql   # byte-identical, diff-confirmed
git show codex/mw-010-vault-versioning:server/migrations/939_mw010_vault_document_versions.sql \
  > <disposable>/server/migrations/940_mw010_vault_document_versions.sql   # byte-identical content, filename renamed only, diff-confirmed
```
No `git add`/`git commit` ever run in the disposable worktree (it stayed detached with two untracked files). `node_modules` symlinked from the repair worktree (zero `package.json`/lockfile diff between commits, confirmed before doing so).

```
CREATE DATABASE strictschema_verify_int939940_a1;
DATABASE_URL=...strictschema_verify_int939940_a1 MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts   # run from the disposable worktree
```
Result: **PASS**. `Applying migrations: 499` (497 + the 2 new ones) → `✅ Postgres migrations complete`. 499 success / 0 failed / 0 skipped, **1289 tables** (1287 + 2: `finance_post_investment_reviews`, `knowledge_doc_versions`, both fully populated with their expected columns — 22 and 15 respectively). Execution order log confirms `939_fin007_post_investment_actuals.sql` then immediately `940_mw010_vault_document_versions.sql`, both slotted correctly into phase-0 numeric order right after `938_exe009_benefits_source_kpi_lineage.sql` and before any phase-1 dated migration — the ordering contract handles two new sequential phase-0 producers correctly. `939`'s FK to `financial_models` resolves cleanly (`financial_models` is created earlier, by `571_financial_modeling_t054.sql`, phase 0, version 571 < 939).

Disposable worktree removed afterward (`git worktree remove --force`), confirmed gone from `git worktree list`.

**⚠️ Numbering collision finding (external, for the fin-007/mw-010 branch owners, not this branch's problem to fix):** `codex/fin-007-post-investment-actuals` (HEAD `3d6b91023d7b9d78d2bb9130912af05c54293edf`) and `codex/mw-010-vault-versioning` (HEAD `87433a8b577ee1d9a7dd3d9dbcdbb882d65e0b1e`) **both independently add a migration file numbered `939`** (`939_fin007_post_investment_actuals.sql` and `939_mw010_vault_document_versions.sql` respectively). If both branches merge into a shared base as-is, `getAllMigrations()`'s `readdirSync` will see two files both parsing to `version = '939'` with different filenames — no collision at the filesystem level (different filenames), but both sort into the identical numeric phase-0 position, and their relative order becomes **filename-string tie-break** (`939_fin007_...` sorts before `939_mw010_...` alphabetically — happens to work by luck of the alphabet in this specific pair, not by design). **One of the two must renumber to 940 (or later)** before merging into a shared base — this is a decision for the fin-007 and mw-010 branch owners, not something this repair branch touched, adopted, or resolved. This finding is out of scope for `codex/strict-fresh-schema-ordering-repair`'s own correctness.

### Gate 7 — Negative control (original base, `1421ae29dc782e887c890c2a9dfcf850f88b8d42`)

```
git worktree add --detach <scratch>/wt-negctrl-base 1421ae29dc782e887c890c2a9dfcf850f88b8d42
CREATE DATABASE strictschema_verify_negctrl_a1;
DATABASE_URL=...strictschema_verify_negctrl_a1 MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts   # run from that worktree, its own (pre-repair) migrate.postgres.ts
```
Result: **FAILS as expected** — reproduces the original bug. `Applying migrations: 210` (raw filename sort, before the phase-ordering fix existed) → `✗ 20260719_baseline_gap.sql: relation "public.initiative_budget_items" does not exist` → `❌ Postgres migrate failed`. `schema_migrations`: 209 success / **1 failed**. Only **416** tables created before the hard stop (vs 1287 on the fixed branch). This is the exact consumer-before-producer failure mode `STRICT_SCHEMA_REPAIR_REPORT.md` documents as the original defect.

Worktree removed afterward.

### Gate 8 — Restored fix, fresh DB

```
CREATE DATABASE strictschema_verify_restored_a1;
DATABASE_URL=...strictschema_verify_restored_a1 MOCK_DB=false npx tsx server/scripts/migrate.postgres.ts   # back in the repair worktree, HEAD = 0128717ad4
```
Result: **PASS**, identical to gates 1/3: 497 success / 0 failed / 0 skipped, 1287 tables. Confirms the fix (not some incidental Railway-DEV-vs-local-Docker environment difference) is what makes the difference between gate 7's failure and gate 1/3/8's success.

### Gate 9 — `npm run build:backend`

```
npm run build:backend   # -> cd server && npm run build -> tsc --noCheck
```
Result: **PASS**, exit 0, no output (transpile-only, no type errors surfaced by `--noCheck`'s emit path).

### Gate 10 — Scoped type-check/lint on touched files

`server/scripts/migrate.postgres.ts` was **not modified this round** (confirmed: `git diff 85902753ee..HEAD -- server/scripts/migrate.postgres.ts` is empty) — checked anyway per the brief:
```
npx tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --resolveJsonModule server/scripts/migrate.postgres.ts
```
Result: **PASS**, zero output (no type errors).

```
npx eslint --no-ignore server/scripts/migrate.postgres.ts
```
Result: 3 errors / 3 warnings (import-sort, prettier formatting, `no-explicit-any`) — **but** the project's real `npm run lint` command excludes `server/scripts/` by design (`npx eslint server/scripts/migrate.postgres.ts` without `--no-ignore` reports "File ignored because of a matching ignore pattern", 0 problems). Since this file is untouched this round, these are pre-existing, out-of-scope findings, not a regression — **NOT MET only in the sense that the file wasn't cleaned up; MET under the project's actual lint gate** (which ignores this path by design).

The two migration files touched this round (`000_zz_core_baseline_producers_fresh_db_gap.sql`, `20260719_baseline_gap.sql`) are `.sql`, not lintable by ESLint/tsc; their real syntax/semantic validation is gates 1/3/4/6/8 — all of which executed them successfully against real Postgres with zero failures, which is the strongest possible check for raw SQL.

### Gate 11 — `git diff --check`

```
git diff --check                                                        # this round's uncommitted state (clean, exit 0)
git diff 1421ae29dc782e887c890c2a9dfcf850f88b8d42..HEAD --check          # full cumulative repair diff
```
Result: **PASS**, both exit 0, no whitespace errors.

### Gate 12 — No silent skip

Confirmed by inspection of every gate's command line: `--safe` was never passed in any run this round (grepped all 6 full run logs for `skipped` — zero matches in every one; gate 7's single failure is a hard `failed` status with non-zero exit, not a swallowed skip). `migrate.postgres.ts`'s `--safe` branch (`recordResult(..., 'skipped', ...); continue;`) exists in the code but was not exercised in any gate this round.

## Cleanup confirmation

Databases created this round (all on `thomas.proxy.rlwy.net:20221`, Railway `consultify`/`dev`/`Postgres`): `strictschema_verify_fresh1_a1`, `strictschema_verify_fresh2_a1`, `strictschema_verify_thinboot_a1`, `strictschema_verify_int939940_a1`, `strictschema_verify_negctrl_a1`, `strictschema_verify_restored_a1`.

All six `DROP DATABASE`'d after their gate completed. Final verification:
```
SELECT datname FROM pg_database WHERE datname LIKE 'strictschema_verify_%';
-- []   (zero rows)
```
No orphans. The shared live `railway` database was only ever used as the maintenance connection to issue `CREATE DATABASE`/`DROP DATABASE`/catalog `SELECT`s for the temp databases above — never migrated, never `ALTER`/`DROP`/`TRUNCATE`d, never had a migration runner pointed at it.

## Scope / safety confirmation

- No `git push`, `git merge`, `git rebase`, or deploy of any kind, on any branch, at any point this round.
- `docs/program/WEEKEND_COMPLETION_2026-08-01/` and any `CODE_GO_FROZEN` marker: **untouched** — confirmed via `git diff 85902753ee..HEAD --stat` showing only the two migration files.
- `codex/fin-007-post-investment-actuals` and `codex/mw-010-vault-versioning`: **untouched** — read only via `git show <branch>:<path>` into a disposable, never-committed worktree; never checked out for editing, never had any ref moved.
- Two disposable worktrees created this round (`wt-939-940-disposable`, `wt-negctrl-base`), both `git worktree remove --force`d after use; neither ever had a commit made in it.
- Never linked to `demo`/`staging`/`production` Railway environments; `railway status` confirmed `dev`/`Postgres` throughout.

## Final `git status --short` in the repair worktree

```
(clean — no output)
```

## Incidental findings (out of scope, not fixed, flagged as policy questions)

These surfaced during gate 5's real-consumer grep and are **pre-existing on every database, including live demo/staging** (not a fresh-vs-bootstrapped ordering discrepancy, and not introduced by this repair or the prior round) — no `CREATE TABLE` for any of them exists **anywhere in the repo**, so "copy the real definition verbatim" (this repair's established pattern) is not possible without inventing a schema, which the brief explicitly prohibits:

1. **`risks`** — queried by `server/src/services/initiative/InitiativeRiskService.ts` (whose own comments say "Placeholder for future risk calculations" / "Assuming there is a risks table" — self-documented as unfinished), `server/src/services/contextPackBuilder.ts`, `server/src/services/ai/contextPackService.ts`. All three call sites use either a `try/catch` that swallows the error or `DbPromise`'s `{ fallback: true }` default, so this does not crash the app or fail any gate — it just silently returns empty results. Distinct from `risk_register` (real, has a producer, fixed separately by `20260719_red_risk_register.sql`, pre-dating this repair).
2. **`kpi_scorecards`** / **`kpi_scorecard_items`** — queried by `server/src/routes/v8/results.routes.ts` (`GET /scorecards`, `GET /scorecards/:scorecardId/kpis`, a real MVP feature per the route's own Polish-language comment referencing a specific Piotr note about departmental KPI cards). Same graceful-fallback pattern (`{ fallback: true }`), so the endpoint returns an empty list rather than erroring — but the feature is effectively non-functional on every environment today.
3. **`security_settings`** (the real one) — `transactionReadinessService.ts:244` queries `organization_security_settings`, which also has no producer anywhere in `server/migrations/`. Not the same table as the now-removed `security_settings` from `000_zz_core_baseline_producers_fresh_db_gap.sql` (that was a same-ish-name-different-table false cognate, correctly removed this round since it had zero real consumers under its own name).

None of these block any of the 12 required gates. They are flagged here because gate 5's methodology (grep real consumers, don't guess) surfaced them as a side effect, and the brief's "no fabricated tables" rule means this repair cannot close them without a designed schema from the feature's actual owner.

## Gate summary

| Gate | Result |
|---|---|
| 1. Fresh strict run | **PASS** — 497/497 success, 1287 tables |
| 2. Immediate replay | **PASS** — 0 new migrations |
| 3. Second independent fresh DB | **PASS** — identical to gate 1 |
| 4. Thin app-bootstrap simulation | **PASS** — real path used (`getPool()`→`initDb()`), 1287 tables, gap columns healed |
| 5. Schema assertions (MW/FIN/MAT/RES/INI) | **PASS** — 182/185 real consumer tables confirmed; 3 pre-existing out-of-scope gaps flagged, non-blocking |
| 6. 939/940 disposable integration test | **PASS** — 499/499 success, 1289 tables; numbering collision flagged externally |
| 7. Negative control (pre-repair base) | **PASS (control reproduces failure)** — 209 success / 1 failed, 416 tables, exact original error |
| 8. Restored fix | **PASS** — 497/497 success, 1287 tables |
| 9. `npm run build:backend` | **PASS** |
| 10. Scoped type-check/lint | **PASS** (tsc clean; eslint clean under real project ignore rules; file untouched this round) |
| 11. `git diff --check` | **PASS** |
| 12. No silent skip | **PASS** — `--safe` never used, zero `skipped` status anywhere |

All 12 required gates are genuinely green against real Railway DEV Postgres, isolated temp databases, no shortcuts, no `--safe`, no reused local Docker state from the prior round.

STRICT_SCHEMA_READY_FOR_FINAL_CODEX_REVIEW
