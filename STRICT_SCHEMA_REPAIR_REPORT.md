# Strict Fresh-Schema Migration Repair — Report

**Branch:** `codex/strict-fresh-schema-ordering-repair`
**Base:** `integrate/mvp-wave1-abc`
**Starting HEAD:** `1421ae29dc782e887c890c2a9dfcf850f88b8d42`
**Final HEAD:** `e02a891600dfd3c7e158161a89d780b385b7c048`

## Root cause

`server/scripts/migrate.postgres.ts` sorted migration files by raw filename
string (`fs.readdirSync(dir).sort()`). Two naming schemes coexist in
`server/migrations/`:

- **NUMBERED** (`000_...`, `500_...`–`938_...`) — the older, canonical
  Postgres-native producers (baseline + incremental schema, zero-padded
  3-digit prefixes).
- **DATED** (`20260101_...`, `2026-06-08_...`) — newer incremental
  migrations added chronologically after the numbered series was mostly
  frozen, many of which `ALTER`/backfill tables the numbered migrations
  create.

Plain ASCII string comparison puts `"2026..."` (starts with `'2'`) **before**
`"300_"`–`"938_"` (start with digits `'3'`–`'9'`), because `'2' < '3'`. So on
a genuinely fresh DB the old sort ran **all ~269 dated migrations before all
~221 numbered 500–938 migrations** — even though dated files like
`20260719_baseline_gap.sql` reference tables (`initiative_budget_items`,
`report_builder_templates`, `interview_library_templates`,
`admin_audit_logs`, `assessment_initiative_batches`, `canonical_inbox_items`,
...) that only the numbered 500–938 migrations create. Consumers ran before
producers — purely an ASCII-comparison artifact, not a real dependency
decision by anyone.

`--safe` masked this in practice by catching the error, marking the
migration `skipped`, and continuing — so it "passed" without ever actually
building the schema those files describe. Real app boot masked it further
via two *independent* bootstrap paths the strict migration script doesn't
touch: `PostgresDatabase.ts`'s `initDb()` (an inline `CREATE TABLE IF NOT
EXISTS` function for ~73 core tables, run lazily the first time the
connection pool is created) and `DatabaseInitializer.ts`'s
`runTablePlatformMigrations()` (a *second*, separate migration runner that
only picks up files matching `/^(7\d{2}|\d{8})_.*\.sql$/` — i.e. only 700–799
numbered or 8-digit-dated files — with its own length-then-lexicographic
sort). Neither of these is exercised by a bare `migrate.postgres.ts` run, so
CI / isolated test containers / fresh dev DBs hit the raw ordering bug with
nothing to paper over it.

A handful of failures were not ordering bugs at all but latent, always-broken
migrations (FK columns declared `TEXT` against a `UUID` primary key that
could never have been created on Postgres regardless of order; a boolean
literal inserted into an `INTEGER` column; a `COALESCE` across a column whose
type changed in a later migration) that simply hadn't been reached yet under
any prior run.

## The ordering contract implemented

Not a full manual topological sort of ~700+ files, and not reliance on
either pure numeric-only or pure date-only sort. A coarse, explicit, documented
phase classification in `server/scripts/migrate.postgres.ts`
(`phaseAndKeyFor` / `compareMigrationOrder` / `sortMigrationsDeterministically`):

- **Phase 0 — NUMBERED**: any `NNN_...` file (including `000_` baseline),
  sorted by **numeric** version, filename as tie-break for duplicate
  numbers.
- **Phase 1 — DATED**: `YYYYMMDD_...` / `YYYY-MM-DD_...` files, sorted by
  calendar date, filename as tie-break for same-day files.
- **Phase 2 — LATE**: an explicit, documented `LATE_PHASE_MANIFEST` for
  files that must run after both phases (currently empty — none were
  needed once the phase-0/1 split and the overrides below were in place).
- **Phase 3 — OTHER**: anything matching neither pattern (e.g.
  `init-pgvector.sql`), sorted by filename, runs last.

Two small, explicit override tables handle the residual cases where a file's
*own* phase position still isn't correct relative to what it needs:

- `PROMOTED_LEGACY_PRODUCERS` — 3 files with version `< 500` (normally
  blanket-excluded as "legacy/SQLite-first") that are the **sole** producer
  of a table something later needs, are already fully Postgres-native, and
  don't conflict with baseline: `073_conversations.sql`,
  `215_partner_portal.sql`, `256_integrations_system.sql`.
- `EARLY_VERSION_OVERRIDES` — 7 files (numbered or dated) whose sort
  position is overridden to a synthetic version so they run earlier than
  their natural phase/number/date position, because a lower-numbered or
  earlier-phase file needs their output. Each entry has a one-line reason in
  the source.

`--from` was changed to resume by position in the *sorted* order instead of
raw filename string comparison (which no longer matches execution order once
phases exist).

## Changed files

- `server/scripts/migrate.postgres.ts` — the ordering contract itself
  (phase classification, override tables, `--from` fix). No change to
  `applySql`/`applyJs`/checksum/tracking-table behavior.
- `server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql` (new)
  — 43 tables that `PostgresDatabase.ts`'s `initDb()` bootstraps inline on
  every real app boot but that **no** migration in `server/migrations/`
  ever created (`ai_feedback`, `approval_assignments`, `decisions`,
  `login_history`, `user_sessions`, `invitations`, `invoices`, etc.) — copied
  verbatim from `initDb()`'s own `CREATE TABLE IF NOT EXISTS` blocks. Sorts
  immediately after `000_z_core_baseline.sql`.
- `server/migrations/000_z_core_baseline.sql` — added `ALTER TABLE ... ADD
  COLUMN IF NOT EXISTS` guards for the 23 tables baseline shares with
  `initDb()` (e.g. `llm_providers.tier`/`.context_window`), because if
  `initDb()`'s smaller version of the table wins the race (real app boot, or
  our thin-bootstrap-then-migrate test), baseline's own `CREATE TABLE IF NOT
  EXISTS` becomes a no-op and never adds the extra columns. Auto-generated
  from baseline's own column definitions — additive only.
- `server/migrations/654_canonical_inbox_items_producer_fresh_db_gap.sql`
  (new) — sole producer of `canonical_inbox_items` (My Work / inbox), whose
  only prior definition lived in `server/migrations/never-ran/654_v4_canonical_inbox.sql`
  (deliberately excluded from every runner per that directory's own README).
  Content copied verbatim from that file.
- `server/migrations/669_tool_facilitation_producer_fresh_db_gap.sql` (new)
  — sole producer of `tool_facilitation_sessions`/`_outcomes`/`_roles`/`_votes`,
  previously defined only in `server/migrations-v2/001_baseline_20260413.sql`
  (a separate pg_dump-style snapshot directory the strict runner never reads)
  and the excluded `never-ran/660_v4_realtime_platform.sql`. Content copied
  verbatim (PK inlined instead of pg_dump's separate `ADD CONSTRAINT`).
- `server/migrations/20260719_baseline_gap.sql` — this ~33K-line
  reconciliation dump creates 685 tables via `CREATE TABLE IF NOT EXISTS`;
  241 of those tables already exist by this point in the run (created
  earlier by baseline/producers), making their `CREATE TABLE` a no-op and
  silently dropping ~2,864 columns the file's own later `CREATE INDEX`
  statements need. Auto-generated `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS` guards (quote-aware parser, handles string literals containing
  commas like `'["A","B"]'::text` defaults) for every such table/column,
  inserted right after each table's own block.
- `server/migrations/556_partner_certification_exams.sql` — `certification_id`/
  `partner_org_id` on the two new tables were declared `TEXT` against a
  `UUID` primary key (`partner_organizations`/`partner_certifications.id`);
  Postgres refuses to create such an FK, so this file could never have
  succeeded regardless of order. Retyped to `UUID` (same semantics).
- `server/migrations/20260331_p28_workbench_p29_partner_program_ledger.sql`
  — same `TEXT`-vs-`UUID` FK mismatch on `partner_program_ledger.partner_org_id`.
  Retyped to `UUID`.
- `server/migrations/20260331_p35b_canonical_model_completion.sql` — its own
  `CREATE TABLE IF NOT EXISTS conversations` is a no-op (table already
  exists from `073_conversations.sql`, which lacks `deleted_at`), so a later
  index in the same file (`idx_conversations_private_list`) 42703'd. Added
  an explicit `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  deleted_at` guard.
- `server/migrations/20260624_initiative_column_dedup.sql` — `expected_roi`
  became `TEXT` in a later-running (now earlier, post-reorder) migration
  (`903_expected_roi_to_text.sql`) while `estimated_roi` stayed numeric; the
  bare `COALESCE` across them can't match `text` and `real`. Cast the
  real→text direction explicitly; scoped the text→real mirror direction to
  numeric-looking values only (regex-guarded) so non-numeric `expected_roi`
  values are left alone rather than erroring.
- `server/migrations/797_user_sessions_missing_columns.sql` — its `UPDATE`
  read `last_activity_at`, which its own header assumed already existed
  (true on demo/staging where `baseline_gap.sql` had already run) but isn't
  guaranteed on a genuinely fresh strict-only run. Added an `ADD COLUMN IF
  NOT EXISTS` guard.
- `server/migrations/933_initiative_section_types_closure.sql` — inserted
  `TRUE, TRUE` into `is_system`/`is_active`, which are `INTEGER` (0/1) on the
  live table, not boolean; Postgres has no implicit cast. Changed to `1, 1`
  (same value, correct literal type).
- `server/migrations/559_tools_known_tools_library.sql`,
  `562_tools_toolsets_speed.sql` — both seed `kb_categories`/`kb_articles`
  rows, but those tables are only created by
  `739_knowledge_base_public_articles.sql`, a *higher*-numbered file (numeric
  sort within phase 0 alone can't fix a lower-numbered file needing a
  higher-numbered one). Wrapped the seed INSERTs in a runtime
  `information_schema` existence check (defense in depth) **and** (in the
  runner) overrode `739_knowledge_base_public_articles.sql`'s sort position
  to run right after `558`, before `559`.

## Test results (ETAP 4)

All runs used `pgvector/pgvector:pg16`, `NODE_ENV=test MOCK_DB=false
DB_TYPE=postgres`, never a mock DB, never a remote/demo/prod host.

1. **Fresh strict migration, container 1** (`strictschema-repro1-pg`,
   port 55921) → **PASS**. `Applying migrations: 497` → `✅ Postgres
   migrations complete`. `497` rows in `schema_migrations`, all
   `status='success'`. `1287` tables in `information_schema.tables`
   (`public` schema).
2. **Immediate strict replay, same container** → **PASS**, clean no-op:
   `Applying migrations: 0` → `✅ Postgres migrations complete`. Row count
   in `schema_migrations` unchanged at `497`.
3. **Second, independent fresh container** (`strictschema-repro2-pg`, port
   55922) → **PASS**. `497` applied, `1287` tables — identical to container
   1. Rules out "first container got lucky." Replay on this container also
   clean (`Applying migrations: 0`).
4. **Thin app-bootstrap, then strict migration** (`strictschema-bootstrap-pg`,
   port 55923): this real code path exists —
   `PostgresDatabase.ts`'s `getPool()` calls `initDb()` (inline `CREATE
   TABLE IF NOT EXISTS` for ~73 tables) the first time anything creates the
   connection pool, unless `DB_MANAGED_SCHEMA=false`. Simulated it with a
   throwaway script that imports only the DB module (same minimal-import
   contract as the runner's own `applyJs()`) and issues one query, then ran
   the strict migration on top. First attempt (before the
   `000_z_core_baseline.sql` self-heal fix) reproduced a real, distinct
   failure: `20260402_llm_providers_vector_dbr77.sql: column "tier" does not
   exist` (baseline's `CREATE TABLE IF NOT EXISTS llm_providers` became a
   no-op against `initDb()`'s smaller version). After the fix: **PASS**,
   `497` applied, `1287` tables — identical to the pure-fresh scenario.
   Replay after bootstrap also clean.
5. **Schema assertions** (grepped each package's real DB-access code, not
   guessed) — all present with full column sets on the live, migrated
   catalog:
   - MW-07 (My Work / inbox): `canonical_inbox_items` — 23 columns
     including `sla_deadline`, `sla_status`, `delegated_to`,
     `source_status`, `initiative_id` (the last two added by
     `932_canonical_inbox_items_source_status_initiative.sql`), matching
     `server/src/services/inboxService.ts`'s usage.
   - FIN-05 (Finance): `financial_statement_packs` (21 cols),
     `financial_statements`, `financial_statement_lines`,
     `financial_statement_values` etc. — matching
     `server/src/routes/finance-statements.routes.ts`.
   - MAT (Materials, presentation/document templates):
     `document_studio_templates` (35), `presentation_templates` (35),
     `report_builder_templates` (20), `v8_artifact_origin_links` (7) —
     matching `server/src/services/materials/*.ts`.
   - RES-02 (Results / KPI): `results_kpi_report_snapshots` (11),
     `kpi_definitions` (28), `kpi_financial_mappings` (14) — matching
     `server/src/routes/results-kpi-reports.routes.ts`.
   - INI-04 (Initiative candidates): `initiative_candidates` (13 cols) —
     matching `server/src/services/initiative/initiativeCandidateService.ts`
     and 3 other real callers (`swotCandidateHandoffService.ts`,
     `drdCandidateHandoff.ts`, `interviewCandidateHandoff.ts`).
   - MW-10 (My Work / decisions): `decisions` (44 cols) — matching
     `server/src/routes/my-work/decisions.routes.ts`.
6. **No required migration silently skipped**: `SELECT status, count(*)
   FROM schema_migrations GROUP BY status` on all four containers returns a
   single row, `success | 497` — zero `skipped`, zero `failed` left
   outstanding (a failed attempt gets overwritten on the next successful
   retry via `ON CONFLICT ... DO UPDATE`).
7. **Deterministic counts**: `497` applied migrations and `497` rows in
   `schema_migrations` on every one of the four containers (fresh #1, fresh
   #2, bootstrap-then-migrate, negative-control-then-fixed); `1287` tables
   on every container where compared.
8. **Negative control**: `git checkout <starting HEAD> -- <all touched
   files>` (both the runner and every migration file), ran strict migration
   on a fresh 5th container (`strictschema-negctrl-pg`, port 55924) →
   **FAILED**, reproducing the *exact* original ETAP 1 error verbatim:
   `20260719_baseline_gap.sql: relation "public.initiative_budget_items"
   does not exist`. Then `git checkout HEAD -- server/migrations
   server/scripts/migrate.postgres.ts` to restore the fix, reset the same
   container to fresh, ran again → **PASS**, `497` applied. Confirms the
   fix is load-bearing, not coincidental.
9. `npm run build:backend` (`cd server && tsc --noCheck`) → **PASS**, exit
   0.
10. Scoped check on the touched runner file: `npx esbuild
    server/scripts/migrate.postgres.ts --bundle --platform=node
    --format=esm --packages=external` → bundled clean, 0 errors (bare
    `tsc --noEmit` on a single file without the project's tsconfig produces
    unrelated `esModuleInterop`/module-target noise on files we didn't
    touch, so esbuild — the project's own stated convention for scoped
    checks — was used instead; `npm run build:backend`, which does run the
    full project through the real tsconfig, already covers type-check
    coverage for every file in this change set).
11. `git diff --check` → clean, no whitespace errors (verified before both
    commits and again at the end).

## Applied / skipped migration counts

- **497** migrations in the strict, non-`--safe` run (every one recorded
  `status='success'`).
- **0** skipped (skip-and-continue is a `--safe`-only behavior; the strict
  path used throughout this repair never uses `--safe`).
- Identical `497`/`497` across all containers tested (fresh ×2, bootstrapped,
  negative-control-restored).

## Remaining legacy blockers (LEGACY_OPTIONAL)

None. The strict run reaches a full, clean `✅ Postgres migrations complete`
without needing to newly exclude any additional file as dead/legacy. The
pre-existing `isSqliteOnlyMigration()` filter (unchanged, still documented
in the runner) continues to exclude ~460 SQLite-era/legacy files exactly as
before; the only change to that filter's *effective* membership is the 3
explicit `PROMOTED_LEGACY_PRODUCERS` entries pulled back in (see above), each
individually justified. No fake tables or columns were invented anywhere —
every new/changed line of SQL is either copied verbatim from an existing,
already-real source (`initDb()`, `never-ran/654_v4_canonical_inbox.sql`,
`migrations-v2/001_baseline_20260413.sql`) or a minimal, additive, idempotent
guard/type-fix on an existing migration.

## Final state

```
$ git status --short
(clean)

$ git log --oneline -3
e02a891600 fix(migrate): make 000_z_core_baseline.sql self-healing vs app-boot bootstrap
c5c69e5550 fix(migrate): deterministic phase ordering for strict fresh-DB migration
1421ae29dc fix(mw-007): preserve toast dependency after integration
```

## Docker container cleanup

All four containers created for this work
(`strictschema-repro1-pg`, `strictschema-repro2-pg`,
`strictschema-bootstrap-pg`, `strictschema-negctrl-pg`) have been
`docker stop`'d and `docker rm`'d. Confirmed via `docker ps -a --filter
name=strictschema` returning zero rows. No other session's container
(`fz120-*`, `mw08*-*`, `consultify-*`, etc.) was touched, started, or
stopped.

No commits were pushed. No `git merge`/`rebase`/deploy was run. No demo/
staging/prod database was touched at any point — every run targeted a local
`localhost:5592x` throwaway container.

STRICT_SCHEMA_READY_FOR_CODEX_REVIEW
