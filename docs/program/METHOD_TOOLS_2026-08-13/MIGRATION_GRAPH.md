# MIGRATION_GRAPH — `tool_initiative_links` / Tools promotion lineage

Stream: MIGRATION (worktree `wt-mig948`, branch `codex/tools-wt-mig948-20260813`, base `82ed4bd657`).
Scope: consolidate two independent workstreams (`codex/tools-wt-idem-20260813` @ `ef29137d1e`,
`codex/tools-wt-bootstrap-20260813` @ `5d5646b3e3`) touching `tool_initiative_links` into one
migration, `server/migrations/948_tool_promotion_tenant_idempotency.sql`, and prove ordering /
backfill correctness against a real Postgres 15 container.

All evidence below was produced against disposable Docker containers created for this task —
never against demo/staging/prod. Three containers were used:

| Container | Port | Purpose |
|---|---|---|
| `cfy-mig948` | 56201 | Assigned worktree DB. Full strict fresh bootstrap (0 rows anywhere before/during 948). |
| `cfy-mig948-data` | 56211 | Scratch DB, same 582 migrations, then hand-seeded `tool_sessions`/`tool_initiative_links` rows *before* running 948, to exercise real matched/orphaned/duplicate backfill logic ("upgrade with legacy data" scenario). |
| `cfy-mig948-empty` | 56212 | Scratch DB used only to prove the fail-fast precondition; destroyed after. |

## 1. Per-migration graph

For each migration: objects **read** (must pre-exist) → objects **created** → objects **altered**
→ **required predecessor** → **phase** under `server/scripts/migrate.postgres.ts`'s
`phaseAndKeyFor()` → **actual order position** observed in a full strict run (`cfy-mig948`, fresh
bootstrap, 583 migrations total, log captured in this session's scratch directory).

### `291_tools_initiatives.sql` (historical producer — NOT promoted, per binding coordinator decision)

- **Reads:** `permissions`, `role_permissions` (for its `INSERT OR IGNORE` seed rows).
- **Creates:** `tool_sessions`, `tool_decisions`, `tool_initiative_batches`, `tool_initiative_links`
  (with `FOREIGN KEY (batch_id) REFERENCES tool_initiative_batches(id)` — a shape the canonical
  producer below does **not** have).
- **Altered:** none.
- **Required predecessor:** none beyond baseline permission tables.
- **Phase:** would be phase 0 (numbered, version 291) if it ran.
- **Actual order position:** **never executes** on the strict/managed run. Confirmed empirically:
  `grep -n "291_tools_initiatives" run2.log` → no match (verified against the full 583-line
  executed log). `isSqliteOnlyMigration()` excludes every numbered file < 500 from the strict run
  unless it is on the `PROMOTED_LEGACY_PRODUCERS` allow-list; 291 is not on that list (and this
  workstream was instructed not to add it — "Do NOT promote 291").

### `20260719_baseline_gap.sql` (canonical producer of `tool_initiative_links`)

- **Reads:** effectively the whole prior schema (it is a large reconciliation dump); for this
  table specifically, nothing — the `CREATE TABLE IF NOT EXISTS` at line 9533 is self-contained.
- **Creates (relevant subset):** `tool_initiative_links` (`id`, `tool_session_id`, `batch_id`,
  `initiative_id`, `created_at` — line 9533), `tool_sessions` (line 9590, no-ops if 942 already
  created it — see below).
- **Altered (relevant subset):** `report_builder_reports` — several `ALTER COLUMN ... DROP
  DEFAULT` statements wrapped in `DO $$ ... EXCEPTION WHEN OTHERS THEN NULL; END $$;`, including
  one for `source_refs_json` (line 13489) that **silently no-ops if the column does not exist
  yet** — this is the exact gap `951` closes (see below); if `951` has already run by this point,
  this statement instead *drops the DEFAULT* `951` set. Observed and confirmed on the fresh run
  (see §3).
- **Required predecessor:** none for `tool_initiative_links` itself.
- **Phase:** 1 (dated, `20260719...`).
- **Actual order position:** **471 / 583**.

### `946_tool_outputs_reports_lineage.sql`

- **Reads:** nothing — every `CREATE TABLE IF NOT EXISTS` in this file
  (`tool_outputs`, `tool_output_approvals`, `tool_reports`, `tool_report_sources`,
  `tool_output_initiative_proposals`, `tool_session_events`) is fully self-contained: every
  foreign-key-shaped column (`tool_session_id`, `tool_output_id`, `tool_report_id`, ...) is a
  plain `TEXT` column with **no actual `FOREIGN KEY` constraint** to anything.
- **Creates:** the six tables above, plus their indexes (`idx_tool_outputs_*`,
  `idx_tool_output_approvals_*`, `idx_tool_reports_*`, `idx_tool_report_sources_*`,
  `idx_tool_output_initiative_*`, `idx_tool_session_events_*`,
  `uq_tool_session_events_idempotency` — a **partial** unique index,
  `WHERE idempotency_key IS NOT NULL`, deliberately different from 948's full unique index; see
  948's own header for why that shape is wrong for `tool_initiative_links` but right here).
- **Altered:** none.
- **Required predecessor:** none. Confirmed self-sufficient by inspection (no FK, no reference to
  any table this migration doesn't itself create) and empirically (ran successfully at position
  254/583, well before `tool_initiative_links` even exists at 471).
- **Phase:** 0 (numbered, version 946).
- **Actual order position:** **254 / 583**.
- **On `946 → 947` ordering:** **no `947` migration exists in any of the three branches this
  workstream was given** (`codex/tools-wt-mig948-20260813`, `codex/tools-wt-idem-20260813`,
  `codex/tools-wt-bootstrap-20260813`) — `git ls-tree -r <branch> -- server/migrations/947*` is
  empty on all three. `948`'s original (idem-branch) header comments *mention* a hypothetical
  `947_tool_outputs_idempotency_guard.sql` as the reason a coordinator renumbered a different file
  from 947 to 949, but that 947 file itself was never delivered to this stream. There is therefore
  nothing to order relative to 946 here, and nothing was moved to late phase. This is a gap to flag
  to the coordinator, not something this migration fabricates a fix for.

### `948_tool_promotion_tenant_idempotency.sql` (this workstream's deliverable — FINAL, consolidated)

- **Reads:** `tool_initiative_links` (existing columns `id`, `tool_session_id`, `batch_id`,
  `created_at` — checked explicitly by the precondition in §0 of the file), `tool_sessions`
  (`id`, `organization_id`).
- **Creates:** `tool_initiative_links_backfill_reports` (+ index), function
  `tool_initiative_links_set_organization_id()`, trigger
  `trg_tool_initiative_links_set_org_id`, unique index `uq_tool_initiative_links_promotion`,
  indexes `idx_tool_initiative_links_org`, `idx_tool_initiative_links_org_session`,
  `idx_tool_initiative_links_org_batch`. Also creates extension `pgcrypto` (`IF NOT EXISTS`,
  defensive — see file header).
- **Altered:** `tool_initiative_links` — `ADD COLUMN IF NOT EXISTS` for `organization_id`,
  `output_type`, `idempotency_key`, `payload_hash`, `source_revision` (all nullable-first, then
  backfilled, then `output_type`/`idempotency_key`/`source_revision` tightened to `NOT NULL`
  unconditionally; `organization_id` tightened to `NOT NULL` **only if the backfill found zero
  orphaned rows** — see §2). No pre-existing column (`id`/`tool_session_id`/`batch_id`/
  `initiative_id`/`created_at`) is ever touched.
- **Required predecessor:** `20260719_baseline_gap.sql` (creates `tool_initiative_links`) **and**
  `942_ideas_collaboration_tool_sessions.sql` or `20260719_baseline_gap.sql` (creates
  `tool_sessions` — whichever runs first; both are `IF NOT EXISTS` and produce the same shape;
  `942` ran first in every observed run, at position 249/583).
- **Phase:** **2 (LATE)** — added to `LATE_PHASE_MANIFEST` in `server/scripts/migrate.postgres.ts`
  with an inline comment explaining why: its numeric filename prefix ("948") would otherwise sort
  it into phase 0 (before phase 1's `20260719_baseline_gap.sql`, its own canonical producer).
- **Actual order position:** **581 / 583** (fresh run) — confirmed strictly after
  `20260719_baseline_gap.sql` (471) and after `946`/`950`/`951` (254-256).

### `950_initiatives_priority_order_gap.sql`

- **Reads:** `initiatives` (must pre-exist — created by `000_z_core_baseline.sql`, position
  2/583).
- **Creates:** nothing.
- **Altered:** `initiatives` — `ADD COLUMN IF NOT EXISTS priority_order INTEGER DEFAULT 0` +
  `idx_initiatives_priority_order`.
- **Required predecessor:** `000_z_core_baseline.sql`.
- **Phase:** 0 (numbered, version 950).
- **Actual order position:** **255 / 583**.
- **Still needed? YES — verified, not redundant.** `grep -rln priority_order
  server/migrations/*.sql` on this worktree returns only `247_initiative_enhancements.sql` (a
  <500 file, excluded from the strict run, not on `PROMOTED_LEGACY_PRODUCERS`) and `950` itself.
  Confirmed on the live fresh-bootstrap DB:
  `information_schema.columns` shows `initiatives.priority_order` exists (`integer`, default `0`,
  nullable) — and it exists *only because 950 added it*; without 950 it would not exist on a
  strict fresh install, reproducing the SQLSTATE 42703 documented in 950's own header.

### `951_report_builder_reports_source_refs_json_gap.sql`

- **Reads:** `report_builder_reports` (must pre-exist — created by `503_report_builder.sql`,
  position 15/583).
- **Creates:** nothing.
- **Altered:** `report_builder_reports` — `ADD COLUMN IF NOT EXISTS source_refs_json TEXT DEFAULT
  '{}'::text`.
- **Required predecessor:** `503_report_builder.sql`.
- **Phase:** 0 (numbered, version 951).
- **Actual order position:** **256 / 583**.
- **Still needed? YES — verified, not redundant.** Neither `503_report_builder.sql` nor its
  sibling `512_report_builder_repair_sqlite.sql` ever defines `source_refs_json` on
  `report_builder_reports` (`grep -n source_refs_json` on both: no match). The only other mention
  is `20260719_baseline_gap.sql`'s guarded `DROP DEFAULT` (see above), which assumes the column
  already exists and silently no-ops otherwise. Confirmed on the live fresh-bootstrap DB:
  `report_builder_reports.source_refs_json` exists (`text`, nullable). **Observed side effect
  (pre-existing, not introduced by this workstream):** because `951` (phase 0, position 256) runs
  *before* `20260719_baseline_gap.sql` (phase 1, position 471), and the latter's `DROP DEFAULT`
  statement no longer hits its `EXCEPTION WHEN OTHERS` branch once the column exists, the
  column's `DEFAULT '{}'::text` that `951` set is subsequently dropped by `baseline_gap`'s own
  statement — the final fresh-bootstrap shape has the column present but with **no default**.
  This does not affect anything `948` depends on (948 never reads or writes this column) and is
  flagged here only for completeness/awareness, not fixed by this migration (fixing
  `baseline_gap.sql`'s behavior is out of this workstream's scope).

## 2. Backfill report — actual numbers from a real run

Numbers below are from `cfy-mig948-data` (port 56211), where `tool_sessions`/
`tool_initiative_links` were seeded **before** `948` ran, to exercise every accounting bucket
(the `cfy-mig948` fresh-bootstrap run has 0 rows in this table, so its report is a trivial
all-zero pass — useful only for proving "no orphans → tightened to NOT NULL" on an empty table).

Seed data (7 rows before 948 ran):

| id | tool_session_id | batch_id | note |
|---|---|---|---|
| `link_b1` | `sess_org1_a` (org `org_1`) | `promote-initiative` | Path B, canonical (earliest `created_at`) |
| `link_b1_dupe` | `sess_org1_a` | `promote-initiative` | Path B, **live race duplicate** of `link_b1` (created 5s later) — reproduces FAZA 0's C16 finding |
| `link_b2` | `sess_org2_a` (org `org_2`) | `promote-report` | Path B, clean |
| `link_bulk_1..3` | `sess_org1_a` | `batch_gen_20260801` (same batch_id for all 3) | Path A — one bulk-generation batch, 3 initiatives |
| `link_orphan_1` | `sess_deleted_or_never_existed` | `promote-presentation` | no matching `tool_sessions` row — orphan |

First run of `948` against this seed (`tool_initiative_links_backfill_reports`, row 1):

| field | value |
|---|---|
| total_rows | 7 |
| org_matched_count | 6 |
| org_orphaned_count | 1 |
| org_ambiguous_count | 0 (structurally impossible — PK-keyed join, see migration §3b) |
| org_unchanged_count | 0 (first run) |
| duplicate_groups | 1 (`link_b1` / `link_b1_dupe`) |
| duplicate_rows_suffixed | 1 (`link_b1_dupe` → `idempotency_key = 'promote-initiative:dup-link_b1_dupe'`) |
| organization_id_not_null | **false** — left nullable, 1 orphan present |

Resulting rows (verified by direct `SELECT`):

```
id             organization_id  output_type    idempotency_key
link_orphan_1  (null)           presentation   promote-presentation
link_b1        org_1            initiative     promote-initiative
link_b1_dupe   org_1            initiative     promote-initiative:dup-link_b1_dupe
link_bulk_1    org_1            initiative     bulk:batch_gen_20260801:link_bulk_1
link_bulk_2    org_1            initiative     bulk:batch_gen_20260801:link_bulk_2
link_bulk_3    org_1            initiative     bulk:batch_gen_20260801:link_bulk_3
link_b2        org_2            report         promote-report
```

`link_b1` (earliest `created_at`) kept the plain key and is canonical; `link_b1_dupe` was
suffixed and NOT deleted; all 3 bulk rows share the historical `batch_id` untouched but got
distinct `idempotency_key`s (no collision); the orphan kept `organization_id = NULL`.

**Replay proof (idempotent re-run):** deleted the `schema_migrations` row for `948` and re-ran it
via `--only`. Exit 0, no errors. Second report row:

| field | value |
|---|---|
| total_rows | 8 (one more row, `link_new1`, inserted between runs to test the trigger — see §3) |
| org_matched_count | 0 |
| org_orphaned_count | 1 (same orphan, still unresolved — correctly NOT guessed) |
| org_unchanged_count | 7 (everything resolved on the first run stayed resolved) |
| duplicate_groups | 0 |
| duplicate_rows_suffixed | 0 (no double-suffixing — `link_b1_dupe`'s key was already unique going into the second pass) |
| organization_id_not_null | false (unchanged — orphan still present) |

## 3. Trigger / DB-level protection proof (live queries, `cfy-mig948-data`)

- **Auto-derive on INSERT (no `organization_id` supplied):**
  `INSERT INTO tool_initiative_links (id, tool_session_id, ..., output_type, idempotency_key, source_revision, created_at) VALUES ('link_new1', 'sess_org1_a', 'promote-kpi', ..., 'kpi', 'promote-kpi', 1, now());`
  → row lands with `organization_id = 'org_1'`, derived by `trg_tool_initiative_links_set_org_id`
  from `tool_sessions.organization_id` for `sess_org1_a`. No client-supplied value used.
- **Mismatch rejection (hard requirement 4 — "never take organization from client payload"):**
  same insert but with `organization_id = 'org_2'` (wrong tenant for `sess_org1_a`, whose real org
  is `org_1`) →
  `ERROR: tool_initiative_links.organization_id (org_2) does not match tool_sessions.organization_id (org_1) for tool_session_id sess_org1_a`.
  Row never committed (`SELECT ... WHERE id='link_bad1'` → 0 rows).
- **DB-level unique protection / race convergence (hard requirement 5):** a second
  `promote-kpi` insert for the same `sess_org1_a` (same `organization_id`, `tool_session_id`,
  `source_revision`, `output_type`, `idempotency_key` as `link_new1`) →
  `ERROR: duplicate key value violates unique constraint "uq_tool_initiative_links_promotion" DETAIL: Key (organization_id, tool_session_id, source_revision, output_type, idempotency_key)=(org_1, sess_org1_a, 1, kpi, promote-kpi) already exists.`
  This is the concrete DB-level fix for FAZA 0's C15/C16 (SELECT-then-INSERT race in
  `ToolController.promoteToOutput` had no unique constraint backing it).

## 4. Fail-fast precondition proof (hard requirement 1)

Two scenarios, both against a throwaway empty container (`cfy-mig948-empty`, destroyed after):

1. **No tables at all** — `npx tsx server/scripts/migrate.postgres.ts --only 948_tool_promotion_tenant_idempotency.sql`
   → exit **1**,
   `canonical producer missing or ordered after consumer: table "tool_initiative_links" does not exist (expected producer: server/migrations/20260719_baseline_gap.sql:9533)`.
   `\dt` immediately after shows only `schema_migrations` — **the migration did not create the
   table itself**, and the whole file's transaction rolled back cleanly (nothing partially
   applied, not even the report table).
2. **`tool_initiative_links` present, `tool_sessions` absent** (manually created the bare
   canonical shape, no `tool_sessions`) → exit **1**,
   `canonical producer missing or ordered after consumer: table "tool_sessions" does not exist (expected producer: server/migrations/942_ideas_collaboration_tool_sessions.sql or server/migrations/20260719_baseline_gap.sql)`.

## 5. Fresh-vs-upgrade schema fingerprint comparison

`\d tool_initiative_links` on `cfy-mig948` (fresh bootstrap, 0 rows ever) vs `cfy-mig948-data`
(seeded with legacy-shaped rows, including one orphan, before 948 ran):

| | Fresh (0 rows, 0 orphans) | Upgrade-with-data (1 orphan) |
|---|---|---|
| `id`, `tool_session_id`, `batch_id`, `initiative_id`, `created_at` | identical, untouched (type/nullability/default all unchanged from the canonical producer) | identical |
| `organization_id` | `text`, **NOT NULL** | `text`, **nullable** |
| `output_type` | `text`, NOT NULL | `text`, NOT NULL |
| `idempotency_key` | `text`, NOT NULL | `text`, NOT NULL |
| `payload_hash` | `text`, nullable (no default — intentionally never backfilled) | `text`, nullable |
| `source_revision` | `integer`, NOT NULL | `integer`, NOT NULL |
| PK | `tool_initiative_links_pkey` on `id` | same |
| Unique | `uq_tool_initiative_links_promotion` on `(organization_id, tool_session_id, source_revision, output_type, idempotency_key)` | same |
| Indexes | `idx_tool_initiative_links_org`, `_org_session`, `_org_batch`, plus pre-existing `idx_tool_links_batch`/`idx_tool_links_session` | same |
| Trigger | `trg_tool_initiative_links_set_org_id` (BEFORE INSERT OR UPDATE) | same |
| Tenant scope | org-scoped, fully enforced (no NULL org possible) | org-scoped, enforced for every row with a known tenant; the one orphaned row is explicitly excluded from tenant-scoped uniqueness (documented in the migration, not a defect) |

**The single, expected, correct difference is `organization_id`'s nullability.** This is the
concrete proof that hard requirement 4 ("do NOT set NOT NULL if orphaned > 0") is real
behavior, not just a comment: a database with zero orphans converges to a fully tenant-locked
schema, and a database with real orphaned legacy data is left in the documented, honest
intermediate state instead of being forced or guessed shut.

## 6. Commands run and exit codes (this session)

```
# Fresh strict run, cfy-mig948 (assigned worktree DB, port 56201)
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgres://consultinity:test@localhost:56201/consultinity \
  npx tsx server/scripts/migrate.postgres.ts
→ exit 0, 583 migrations applied, "✅ Postgres migrations complete"

# Re-run (idempotency at the runner level)
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgres://consultinity:test@localhost:56201/consultinity \
  npx tsx server/scripts/migrate.postgres.ts --dry-run
→ exit 0, "Pending migrations: 0"

# Seeded-data run, cfy-mig948-data (scratch, port 56211) — 948 held out, then applied alone
npx tsx server/scripts/migrate.postgres.ts            # 582 migrations, 948 absent from dir
# (seed tool_sessions / tool_initiative_links rows)
npx tsx server/scripts/migrate.postgres.ts            # "Applying migrations: 1" → 948 only, exit 0

# Idempotent replay of 948 itself (deleted its schema_migrations row, re-ran --only)
npx tsx server/scripts/migrate.postgres.ts --only 948_tool_promotion_tenant_idempotency.sql
→ exit 0, no errors, report row 2 shows 0 new duplicates / 0 new matches, 7 unchanged, 1 still orphaned

# Fail-fast precondition, cfy-mig948-empty (scratch, port 56212, destroyed after)
npx tsx server/scripts/migrate.postgres.ts --only 948_tool_promotion_tenant_idempotency.sql
→ exit 1, "canonical producer missing or ordered after consumer: table \"tool_initiative_links\" does not exist ..."
(after manually creating the bare tool_initiative_links table only)
→ exit 1, "canonical producer missing or ordered after consumer: table \"tool_sessions\" does not exist ..."
```

## 7. What was dropped as redundant, and what could NOT be proven

- **Dropped:** nothing. Both `950` and `951` were verified as still needed (§1) — neither column
  they add exists anywhere else on a strict fresh install.
- **Not kept:** a separate `949_tool_initiative_links_org_scope.sql` file — its logic (organization
  backfill, tenant-first indexes, mismatch-detecting trigger) is fully folded into `948`, per the
  task's explicit instruction not to keep a separate 949 file. `server/migrations/` in this
  worktree has no file numbered 949.
- **Could NOT be proven (out of this workstream's reach):**
  - Whether `demo`/`staging`/`prod` actually have zero orphaned `tool_initiative_links` rows
    today. This migration is deliberately built to be safe either way (§2, §5), but the
    "tighten `organization_id` to NOT NULL" outcome on those real databases can only be known by
    actually running it there — out of scope and explicitly forbidden for this stream
    (`NEVER touch demo/staging/PROD`).
  - The `946 → 947` ordering question from the task brief: no `947` migration exists in any of the
    three branches available to this stream (§1, `946` section) — there is nothing to order.
