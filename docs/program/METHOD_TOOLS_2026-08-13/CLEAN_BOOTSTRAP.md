# Clean-database bootstrap for `promoteToOutput` — evidence report

Agent A · `codex/tools-wt-bootstrap-20260813` · worktree
`/Users/piotrwisniewski/.codex/worktrees/wt-bootstrap` · disposable Postgres
container `cfy-wt-bootstrap` (port 56101) · 2026-08-13

Scope: TASK 1 (P0 clean-database bootstrap) and TASK 2 (C14 org scope for
`tool_initiative_links`). Nothing here touched demo/staging/prod — every
command below ran against a disposable, session-owned Docker container.

---

## Integration note (S6, 2026-08-13)

This report was ported verbatim from `codex/tools-wt-bootstrap-20260813`
@ `5d5646b3e3` into `codex/sprint-s6-integ` during regression integration.
Two facts below are now **stale relative to the integrated branch** and are
corrected here rather than silently rewritten into the historical narrative:

1. **§5 / §7 — migration 949 does not exist on this branch.** The task
   brief for S6 explicitly forbade reintroducing a standalone
   `949_tool_initiative_links_org_scope.sql`: its C14 organization-scope
   logic (nullable `organization_id`, backfill, org-first indexes,
   `trg_tool_initiative_links_set_org_id` trigger) was independently
   consolidated into `server/migrations/948_tool_promotion_tenant_idempotency.sql`
   by this branch's own controller-B/C integration work (see
   `MIGRATION_GRAPH.md`, "Not kept" section, and `GATE_I0_I1_I2_FINDINGS.md`
   §Gate I2 for the ordering hazard that consolidation avoids: 948 in phase
   0 creating the table ahead of its phase-1 canonical producer). Trigger
   name, function name, and exception message text were verified
   byte-identical between the original 949 and the folded-in 948 before
   porting `tests/integration/tools-links-org-scope.realdb.test.ts` — see
   that file's own header for the exact diff of what changed (imports and
   doc comments only, zero assertion changes).
2. **§1 / §8 — image and port.** This worktree's assigned disposable
   container is `cfy-s6-integ` on port `56505`, image `pgvector/pgvector:pg15`
   (not `pg16`/port `56101` as originally recorded here). `pg15` also
   bundles the `vector` extension the strict migration set requires — the
   substance of Finding #0 below is unaffected, only the exact tag.
3. **§2's "583 migrations" total no longer applies as a literal count** —
   this branch's migration set differs from the source worktree's (948
   already existed here for an unrelated reason before this port, 949 was
   never added). The **live, current-SHA migration count and exit code**
   are recorded fresh in
   `docs/program/METHOD_TOOLS_2026-08-13/EVIDENCE_LEDGER.md`, not restated
   here from memory.

Everything else below — the `permissions`/`role_permissions` 42P01
root-cause analysis, the `priority_order`/`source_refs_json` gap findings
(migrations 950/951, unchanged and still present on this branch, byte-
identical), the dependency inventory, and the HTTP before/after evidence —
is unchanged historical record from the original worktree and remains
accurate to what it documents.

---

## 1. Reproducing the environment

```bash
docker rm -f cfy-wt-bootstrap 2>/dev/null
docker run -d --name cfy-wt-bootstrap -e POSTGRES_PASSWORD=test \
  -e POSTGRES_USER=consultinity -e POSTGRES_DB=consultinity \
  -p 56101:5432 pgvector/pgvector:pg16
```

**Finding #0 (tooling/environment):** the task brief's suggested image
(`postgres:15-alpine`) does **not** ship the `vector` extension.
`server/migrations/20260719_baseline_gap.sql` line 14 does
`create extension if not exists vector;`, and several tables in that same
file declare `vector(1536)` columns. Running the strict migration set
against plain `postgres:15-alpine` fails partway through:

```
✗ 20260719_baseline_gap.sql: extension "vector" is not available
❌ Postgres migrate failed: extension "vector" is not available
```

Fix: use an image that bundles pgvector. This repo's own
`docker-compose.postgres.yml` already does this (`pgvector/pgvector:pg16`),
and three pre-existing `*.realdb.test.ts` files in this repo document the
same image in their own "how to run locally" headers (`m01-prun-base-runtime-migration-discovery`,
`m02-p08-ideas-hub-golden-flow`, `schema-migration-completeness`). Used
`pgvector/pgvector:pg16` throughout this report — verified working. (The
coordinator separately suggested `pgvector/pgvector:pg15`; either should
work for this purpose — S6's own assigned container uses `pg15`, see
integration note above.)

## 2. Running the strict migration set

```bash
NODE_ENV=test \
DATABASE_URL="postgres://consultinity:test@localhost:56101/consultinity" \
DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
```

`NODE_ENV=test` is required even for a local disposable container:
`databaseTargetResolver.ts` (`assertResolvedDatabaseUrlIsReachable`)
refuses any `localhost`/`127.0.0.1`/`0.0.0.0` `DATABASE_URL` unless
`NODE_ENV=test`, `CI=true`, or a Vitest/Jest worker env var is set. Without
it: `Selected DATABASE_URL points to local host localhost. This project
requires the external Postgres target outside tests.`

Did **not** use `--safe` — confirmed by reading `server/scripts/migrate.postgres.ts`
that `--safe` records a failed migration as `skipped` and still exits 0,
which is exactly the trap this task warned about. All runs below used the
strict form (no flag) and the real process exit code.

### Original (source worktree) result, fully fresh container

```
Applying migrations: 583
...
✅ Postgres migrations complete
```
**Exit code: 0. 583 migrations applied** on the *source* worktree
(`codex/tools-wt-bootstrap-20260813`), where 949/950/951 were all new
files added on top of 580 pre-existing ones. See the integration note
above for why this exact count does not carry over to this branch, and
`EVIDENCE_LEDGER.md` for this branch's own fresh count.

### Non-recursive confirmed

`server/scripts/migrate.postgres.ts` → `getAllMigrations()` uses
`fs.readdirSync(dir)` with no recursion and no subdirectory walk. Confirmed
by reading the code (no `withFileTypes`/recursive traversal anywhere in the
file) and by directory inspection:

```
server/migrations/
  ops/          — 10 files, none ever run by the strict runner
  never-ran/    — ~230 files (legacy SQLite-first migrations + two READMEs
                  explicitly named "never-ran"), none ever run
  rollback/     — down-migrations, none ever run (by design — these are
                  hand-invoked rollback scripts, not forward migrations)
```

Anything placed in these three subdirectories is permanently invisible to
`npm run db:migrate`, regardless of filename/numbering convention.

## 3. Dependency inventory for `promoteToOutput`

Derived by reading `server/src/controllers/ToolController.ts`
`promoteToOutput` (~L2052-2345) and everything it transitively calls:

| Table | Why | Notes |
|---|---|---|
| `tool_sessions` | session lookup, all output types | created only by `20260719_baseline_gap.sql` (a **phase-1 dated** file) — the "real" producer `291_tools_initiatives.sql` is excluded as legacy (<500) |
| `tool_initiative_links` | traceability row, all output types | same producer as above |
| `initiatives` | outputType='initiative' raw-insert path | FK to `organizations(id)` |
| `permissions`, `role_permissions` | `ensureToolsSchema()` `INSERT`s into these without ever `CREATE TABLE`-ing them | **origin of the reported 42P01** — on a bare DB (only `ensureToolsSchema()`'s ad-hoc `CREATE TABLE IF NOT EXISTS` ever ran, no real migration), these two tables never exist; the `INSERT` throws 42P01, silently swallowed by `ensureToolsSchema()`'s blanket outer `try/catch`, then something downstream that actually needs `permissions`/`role_permissions` (or the tables `promoteToOutput` itself touches) fails |
| `audit_log` | `logAudit()`, called on every successful promotion | wrapped in its own try/catch (fail-soft) but should exist for real audit trail |
| `report_builder_reports`, `report_builder_sections` | outputType='report' | see Finding #2 below |
| `v8_artifact_runs` | outputType='presentation' | wrapped in try/catch (fail-soft — "Table may not exist") |
| `my_ideas` | outputType='idea' | wrapped in try/catch (fail-soft) |
| `organizations`, `users` | FK targets for the fixtures above | only `id` is `NOT NULL` on both in this schema |

## 4. Two NEW schema gaps found (not the originally reported one) — fixed

Running the real `POST /api/tools/:toolId/promote` HTTP request (real
router, real controller, mocked auth middleware injecting `req.user`,
against the **fully, strictly migrated** database) surfaced two further P0
gaps, both of the same root-cause class as the reported bug (a migration
exists in the repo but never actually runs against a strict Postgres
install):

### Finding #1 — `initiatives.priority_order` missing

```
error: column "priority_order" of relation "initiatives" does not exist
```

`247_initiative_enhancements.sql` was supposed to add this column, but it
is a pre-baseline (<500), SQLite-first file (unguarded `ALTER TABLE ADD
COLUMN`, `INSERT OR IGNORE` — invalid Postgres syntax) correctly excluded
by `isSqliteOnlyMigration()`. `000_z_core_baseline.sql` never re-created the
column. The raw-insert path in `ToolController.promoteToOutput`
(`INITIATIVE_FUNNEL_ENABLED != 'true'`, the default/live posture) still
writes to it on every promotion.

**Fix:** `server/migrations/950_initiatives_priority_order_gap.sql` — one
guarded `ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS priority_order
INTEGER DEFAULT 0` + matching index. Numbered ≥500 so it runs normally in
phase 0 (no ordering issue — it only depends on the baseline `initiatives`
table). **Present on this branch, byte-identical to the source.**

### Finding #2 — `report_builder_reports.source_refs_json` missing

```
column "source_refs_json" of relation "report_builder_reports" does not exist
```

`ReportBuilderService.createReport()` writes this column on every report
creation (both the standard and V3 INSERT variants). `20260719_baseline_gap.sql`
only contains a defensive `DO $$ ALTER COLUMN source_refs_json DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;` — it assumes the column already
exists (drift from whatever database that file was diffed from) and
silently no-ops if it doesn't. Contrast with the sibling
`report_builder_sections.source_refs_json`, which **is** self-healed at
runtime by `ToolController.promoteToOutput` itself right before the
`createReport` call — the equivalent statement for `report_builder_reports`
was never added alongside it.

**Fix:** `server/migrations/951_report_builder_reports_source_refs_json_gap.sql`
— one guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS source_refs_json
TEXT DEFAULT '{}'::text` (same type/default as the sibling
`presentation_decks.source_refs_json`). **Present on this branch, byte-
identical to the source.**

### Known, non-blocking, NOT fixed here

`ReportBuilderService.resolveReportSourceRefs()` also queries
`initiatives.source_report_id`, which does not exist on the strict schema
either. This is already fail-soft (try/catch around the lookup, logs a
`warn` and continues) — confirmed it does **not** block promotion. Left
alone; flagging here so it isn't mistaken for "fixed."

## 5. C14 org-scope logic — now delivered by 948, not a standalone 949

The task brief for the source worktree specified
`server/migrations/947_tool_initiative_links_org_scope.sql`; a coordinator
renumbered it to 949 after a numbering collision, and an ordering bug (a
numbered filename sorting into phase 0, ahead of its phase-1 dependency
`tool_initiative_links`) required adding it to `LATE_PHASE_MANIFEST`. Full
original narrative preserved for context:

> **Empirically found bug in the migration itself:**
> `949_tool_initiative_links_org_scope.sql` is a numbered filename, so the
> sort logic in `migrate.postgres.ts` places it in **phase 0** (numbered)
> — but `tool_initiative_links` is only ever created by
> `20260719_baseline_gap.sql`, a **phase 1** (dated) file, which always
> runs *after* all of phase 0. Running 949 unmodified against a truly
> fresh container failed:
> ```
> ✗ 949_tool_initiative_links_org_scope.sql: relation "tool_initiative_links" does not exist
> ```
> **Fix (in the source worktree):** added
> `'949_tool_initiative_links_org_scope.sql'` to `LATE_PHASE_MANIFEST` in
> `server/scripts/migrate.postgres.ts`.

**On this branch, that entire class of problem does not apply**: there is
no standalone 949 file. The org-scope logic (nullable `organization_id`,
deterministic backfill from `tool_sessions`, org-first indexes, the
`trg_tool_initiative_links_set_org_id` trigger) is folded directly into
`948_tool_promotion_tenant_idempotency.sql`, which is *already* forced
into phase 2 via `LATE_PHASE_MANIFEST` (now living in the pure
`server/scripts/migrationOrdering.ts` module, not `migrate.postgres.ts`
itself) for its own, independent reason — it consumes
`tool_initiative_links`, the same phase-1 dependency. See
`GATE_I0_I1_I2_FINDINGS.md` and `MIGRATION_GRAPH.md` for the full
consolidation trace.

## 6. `promoteToOutput` HTTP evidence (before/after, source worktree)

Real Express router (`server/src/routes/tools.routes.js`), real
`ToolController`, mocked auth middleware injecting `req.user` (pattern
matches the repo's existing `m02b-decision-migration-932.realdb.test.ts`),
real `queryHelpers`/Postgres connection — no DB mocking. Test file:
`tests/integration/tools-clean-bootstrap.realdb.test.ts` (ported to this
branch; see its header for the two adaptations made).

| Scenario | Status | Body / error |
|---|---|---|
| Before Findings #1/#2 fixes, `outputType='initiative'` | 500 | `column "priority_order" of relation "initiatives" does not exist` (SQLSTATE 42703) |
| Before Finding #2 fix, `outputType='report'` | 500 | `column "source_refs_json" of relation "report_builder_reports" does not exist` (SQLSTATE 42703) |
| **After all fixes**, `outputType='initiative'` | **200** | `{ id, outputType: 'initiative', title, sourceSessionId, ... }`; `tool_initiative_links` row written (`batch_id='promote-initiative'`); `initiatives` row exists, correctly org-scoped |
| **After all fixes**, repeat same promotion (fresh router import — "restart the API layer") | **200** | `deduplicated: true` |
| **After all fixes**, reopen session (`UPDATE ... SET status='APPROVED'`), fresh router import, `outputType='report'` | **200** | independent `tool_initiative_links` row, `batch_id='promote-report'` |

No SQLSTATE 42P01 (`relation does not exist`) or 42703 (`column does not
exist`) in any post-fix response body, asserted explicitly in the test
(`expect(JSON.stringify(res.body)).not.toMatch(/42P01/)` and a general
`relation .* does not exist` pattern check).

The originally-reported 42P01-on-`permissions` scenario specifically
(zero migrations run at all, only `ensureToolsSchema()`'s ad-hoc
`CREATE TABLE IF NOT EXISTS` for the 4 `tool_*` tables) was root-caused by
code reading (§3 table, `ensureToolsSchema()`'s swallowed `INSERT INTO
permissions` failure) rather than re-triggered via a literal zero-migration
HTTP call in this session — time-boxed in favor of chasing the two *new*
gaps the fully-migrated database actually surfaced, which were blocking the
positive case entirely. The dependency-inventory test
(`tests/integration/tools-clean-bootstrap.realdb.test.ts`, "the migrated
schema has every table promoteToOutput depends on") is the regression gate
for the reported bug: it fails loudly if `permissions`/`role_permissions`/
`audit_log`/etc. are ever missing again. **This branch's own re-run of that
test, at the current SHA, is recorded in `EVIDENCE_LEDGER.md`.**

## 7. C14 — `tool_initiative_links` organization scope

Delivered on this branch by
`server/migrations/948_tool_promotion_tenant_idempotency.sql` (see §5).
Purely additive — `ADD COLUMN IF NOT EXISTS`, deterministic `UPDATE`
backfill, `CREATE INDEX IF NOT EXISTS` (organization_id-first), and a new
`CREATE OR REPLACE FUNCTION` + guarded `CREATE TRIGGER` (no `DROP`, no
`DELETE`, no `ALTER` of any pre-existing column).

### Backfill report (measured against synthetic fixtures on the disposable container, source worktree)

The migration ran against an **empty** `tool_initiative_links` table on
the source workstream's fresh container (0 pre-existing rows — it's a
brand-new database), so the migration's own `UPDATE` backfilled 0 rows in
the actual run. To produce a meaningful report, the exact backfill
statement was re-run against synthetic "pre-migration-shaped" fixtures
(trigger temporarily disabled to simulate rows as they would have looked
before this logic ever ran):

| Category | Count | Definition |
|---|---|---|
| **matched** | 3 | `tool_session_id` resolved to an existing `tool_sessions` row; `organization_id` copied from it. `UPDATE 3` reported by Postgres. |
| **orphaned** | 2 | `tool_session_id` did **not** resolve to any `tool_sessions` row (no FK enforces this relationship — confirmed via `pg_constraint`). Left `NULL`. Never guessed. |
| **ambiguous** | 0 (structurally impossible) | The join key is `tool_sessions.id`, a `PRIMARY KEY` — at most one candidate row can ever match. There is no multi-candidate case to disambiguate, unlike a backfill keyed on a non-unique business identifier. |
| **unchanged** | 1 | Row already had `organization_id` set (idempotent-rerun case) — preserved as-is. |

Fixture setup/teardown SQL and full transcript available on request; not
reproduced here to keep this report scoped. Synthetic fixture rows were
deleted after measurement — verified 0 leftover rows.

**Why `organization_id` stays nullable:** this migration was only run and
proven against a disposable container, seeded with synthetic data —
**never** against demo/staging/prod. Orphaned rows are a real,
structurally possible outcome (no FK from
`tool_initiative_links.tool_session_id` to `tool_sessions.id`), and there
is no way to prove zero orphans exist on demo/prod without querying them,
which is explicitly out of scope for this workstream (no migrations/queries
against demo/staging/prod, per the absolute rules). **Do not add `NOT
NULL`** until someone has actually run the backfill against demo/prod and
confirmed via `COUNT(*) WHERE organization_id IS NULL` that it is zero, or
has decided what to do with any orphans found.

### Trigger enforcement

`trg_tool_initiative_links_set_org_id` (`BEFORE INSERT OR UPDATE`):
- derives `organization_id` from the parent `tool_sessions` row when the
  parent exists and the caller didn't specify a conflicting value
  (`NEW.organization_id := v_org_id`)
- **rejects** (`RAISE EXCEPTION`) any write whose explicit
  `organization_id` disagrees with the parent session's real
  `organization_id`
- leaves `organization_id` exactly as the caller provided (including
  `NULL`) when the parent session doesn't exist (orphan case) — never
  guesses

### Test evidence

`tests/integration/tools-links-org-scope.realdb.test.ts` (ported to this
branch, adapted per its own header) — 7/7 passing against the source
worktree's container; **this branch's own re-run, at the current SHA, is
recorded in `EVIDENCE_LEDGER.md`**:

1. backfill/trigger populated `organization_id` correctly for both fixture rows
2. **direct read without a join** to `tool_sessions` is org-scoped (the
   entire point of this migration — structurally impossible before it)
3. **cross-org read is blocked**: org A cannot read org B's row by id when
   scoped by `organization_id`
4. **identical business identifiers do not collide**: `batch_id` is *not*
   globally unique — every org's `'initiative'` promotions share the
   literal string `'promote-initiative'` (`promoteBatchId` in
   `ToolController.promoteToOutput` is not org-namespaced) — proved both
   orgs really do share it, then proved org-scoped reads still separate
   them correctly
5. **cross-org write is blocked** (3 sub-cases): rejects an `INSERT` with a
   mismatched explicit `organization_id`; rejects an `UPDATE` trying to
   re-point `organization_id`; auto-derives the correct value for a write
   that omits it entirely

## 8. Test commands (exact, reproducible, this branch)

```bash
# 1. This worktree's disposable container
docker run -d --name cfy-s6-integ -e POSTGRES_PASSWORD=test \
  -e POSTGRES_USER=consultinity -e POSTGRES_DB=consultinity \
  -p 56505:5432 pgvector/pgvector:pg15

# 2. Strict migration (NODE_ENV=test required for localhost DATABASE_URL)
NODE_ENV=test DATABASE_URL="postgres://consultinity:test@localhost:56505/consultinity" \
  DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts

# 3. Both realdb suites
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="postgres://consultinity:test@localhost:56505/consultinity" \
  npx vitest run \
  tests/integration/tools-clean-bootstrap.realdb.test.ts \
  tests/integration/tools-links-org-scope.realdb.test.ts
```

Actual exit codes/output for this branch, at its current SHA, are in
`EVIDENCE_LEDGER.md` — not restated here to avoid the exact stale-evidence
trap this integration note itself calls out.

## 9. Gaps / things NOT proven (explicit, not papered over)

- **The literal, originally-reported 42P01-on-`permissions` HTTP response**
  was not re-triggered end-to-end via a live HTTP call in the source
  session (root-caused by code reading instead — see §3/§6). The
  dependency inventory test is the regression gate going forward.
- **Backfill counts are synthetic**, not measured against demo/prod data
  (correctly out of scope — never touch demo/prod). `organization_id`
  is deliberately left nullable because of this.
- **`resolveReportSourceRefs`'s missing `initiatives.source_report_id`
  column** (§4, "Known, non-blocking") was identified but not fixed — it
  degrades gracefully today, so it was left out of scope rather than
  papered over with an unrequested extra migration.
- **This integration (S6, 2026-08-13) did not re-derive the backfill
  synthetic-fixture measurement in §7** — that measurement is carried
  forward as historical record from the source worktree, not reproduced.
  What S6 *did* re-run at the current SHA is recorded in
  `EVIDENCE_LEDGER.md`.
