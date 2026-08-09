# WP-C01 — Migration Report (Gate C)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`, Gate C / WP-C01 "Additive migrations"
**Work package:** WP-C01 — turns the 7 accepted Gate B ADRs into real, additive SQL migrations and tests them (fresh + upgrade replay) on an isolated Postgres.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** the 7 ADRs in `docs/validation/finance-v3/generated/gate-b/` (WP-B01…WP-B07) reconciled against `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` (authoritative merged shape — used in place of any single ADR's raw DDL where the reconciliation corrects it).

---

## 1. Database isolation

Per the hard rule in the brief (real prior incident: a local runtime once had access to the
production database — `docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md`),
this work package never touched the shared Homebrew Postgres instance
(`/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15`, PID 911,
observed running throughout this session and left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-gate-c-pgdata-3267112874`
  (random suffix), initialized with `initdb --locale=C` using the
  `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **Own port:** `57231`, picked from the 55000-59999 range and verified free with `lsof -i` before
  use; the server was started with `listen_addresses=127.0.0.1` (loopback only, not reachable from
  the network) and its own Unix socket inside the ephemeral data directory.
- **Verification during the session:** `ps aux` confirmed two fully separate `postgres` processes —
  PID 911 on `-D /opt/homebrew/var/postgresql@15` (untouched shared instance) and PID 34202 on
  `-D /private/tmp/finance-v3-gate-c-pgdata-3267112874 -p 57231` (this work package's own cluster).
  `lsof -iTCP -sTCP:LISTEN` confirmed nothing else was bound to port 57231 before use.
- **`NODE_ENV=test`** was set only to satisfy the repo's own `assertNoPrivateRailwayDbHostOutsideRailway`
  / `resolveReachableDatabaseUrl` guard (`server/src/config/databaseTargetResolver.ts`) when pointing
  the migration runner at a loopback host — that guard's purpose is exactly this project's
  production-database incident, and it was left fully in place and exercised, not bypassed.
- **Teardown:** `pg_ctl stop` and `rm -rf` of the data directory, executed at the end of this work
  package (see §7). No Postgres process for this cluster was left running.

## 2. Migrations delivered

Seven new, purely additive files in `server/migrations/`, one per Gate B ADR (except B02, whose
`artifact_lifecycle_events` audit table is only a few lines and does not warrant its own file split
further):

| # | File | Source ADR | Creates |
|---|---|---|---|
| 1 | `20260809_finance_v3_b01_core_artifacts.sql` | WP-B01 | `finance_value_status` enum, `finance_artifacts`, `finance_engine_manifests` (+ `LEGACY_UNKNOWN` sentinel), `finance_business_versions` (base + all `GATE_B_INTEGRATION_RECONCILIATION.md` §2 columns + B02's CAS `version` counter), `finance_working_revisions`, `finance_artifact_aliases`, immutability trigger, `current_business_version_id` sync trigger |
| 2 | `20260809_finance_v3_b02_lifecycle_events.sql` | WP-B02 | `artifact_lifecycle_events` (append-only audit log) |
| 3 | `20260809_finance_v3_b03_lineage_freshness.sql` | WP-B03 | `finance_lineage_edges` (+ cycle-prevention trigger, append-only trigger), `finance_lineage_freshness_events` |
| 4 | `20260809_finance_v3_b04_compute_jobs.sql` | WP-B04 | `compute_jobs`, `compute_job_runs`, `compute_job_outputs` |
| 5 | `20260809_finance_v3_b05_exception_ledger.sql` | WP-B05 | `finance_exceptions` (+ append-only trigger), `finance_exceptions_current` view, `finance_reconciliation_runs`, `finance_business_versions.result_quality` |
| 6 | `20260809_finance_v3_b06_reproducibility_retention_export.sql` | WP-B06 | `finance_engine_manifests.rounding_convention`, `finance_compute_snapshots` (+ append-only trigger), `finance_business_versions.version_kind/restatement_reason/restatement_class`, `finance_retention_policies`, `finance_legal_holds`, `finance_export_manifests` (+ require-approved trigger + immutability trigger), `finance_export_manifest_sources`, `finance_export_evidence_items` |
| 7 | `20260809_finance_v3_b07_observability.sql` | WP-B07 | `finance_reason_codes` (+ 14-row seed), `compute_jobs.reason_code`/`compute_job_runs.reason_code`, `compute_jobs.replayed_from_job_id`, `finance_export_manifests.request_id` |

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any of the existing ~60 Finance tables (or any other
table) from Gate A. All new tables use `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text` and all
new columns are added with `ADD COLUMN IF NOT EXISTS`. `NOT VALID` + `VALIDATE CONSTRAINT` for FKs
was not needed anywhere — every new FK is either (a) on a brand-new, empty table, or (b) a deferred
FK added once its target table exists in the same migration run, also on brand-new/empty tables at
that point — there is no large, populated existing table being backfilled with a new constraint in
this work package (that is Gate C's later backfill work, WP-C03).

## 3. Fresh install replay

Ran the project's own runner (`server/scripts/migrate.postgres.ts`) against the empty ephemeral
database — i.e. every migration in `server/migrations/` (existing + the 7 new ones), in the
runner's own deterministic phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:57231/finance_v3_gate_c \
  npx tsx server/scripts/migrate.postgres.ts
```

- **586 migrations pending → 586 applied, 0 skipped, 0 errors.** (`grep -iE "skip|error|fail"` over
  the full run log outside the per-file `→ filename` progress lines returned nothing.)
- **Total wall time for all 586 migrations: 4.24s** (`sum(execution_time_ms)` from `schema_migrations`).
- **Per-file timing for the 7 new Finance v3 migrations** (from `schema_migrations.execution_time_ms`,
  which the runner records natively):

| Migration | Time |
|---|---|
| `20260809_finance_v3_b01_core_artifacts.sql` | 12 ms |
| `20260809_finance_v3_b02_lifecycle_events.sql` | 3 ms |
| `20260809_finance_v3_b03_lineage_freshness.sql` | 5 ms |
| `20260809_finance_v3_b04_compute_jobs.sql` | 7 ms |
| `20260809_finance_v3_b05_exception_ledger.sql` | 6 ms |
| `20260809_finance_v3_b06_reproducibility_retention_export.sql` | 11 ms |
| `20260809_finance_v3_b07_observability.sql` | 2 ms |

**None of the 7 new migrations exceed 1 s — no lock-time risk for a production backfill window.**
(The single slowest migration in the *entire* 586-file run was an unrelated, pre-existing migration
at 1.445 s — outside Finance v3's scope, noted here only for completeness, not flagged as this work
package's risk.) All 20 new tables were confirmed present afterward via
`information_schema.tables`.

## 4. Upgrade replay (idempotency on a non-empty database)

The runner itself already has a safe-guard: it tracks applied files in `schema_migrations` and only
executes files not already recorded as `success` (and has a `--safe` flag to record-and-continue on
error). To test the *SQL's own* idempotency — not just the runner's bookkeeping — this work package
directly re-executed all 7 raw `.sql` files with `psql -f` against the already-migrated database,
**with live test data already present** (see §5 fixtures: 3 `finance_business_versions` rows, 1
`finance_lineage_edges` row, 1 `finance_exceptions` row, 1 `finance_export_manifests` row):

- **All 7 files re-applied cleanly, 0 errors, 22-29 ms each.**
- **Row counts identical before/after** (3 / 1 / 1 / 1) — no data loss, no duplication.
- **`finance_engine_manifests` `LEGACY_UNKNOWN` sentinel:** still exactly 1 row (`INSERT ... ON
  CONFLICT DO NOTHING` worked).
- **`finance_reason_codes` seed:** still exactly 14 rows, not duplicated.
- **All triggers re-fired correctly after replay** (re-ran the immutability/append-only tests from
  §5 a second time post-replay — same rejections, same error messages; `DROP TRIGGER IF EXISTS` +
  `CREATE TRIGGER` in every migration means re-running never silently loses a trigger to a
  "already exists" skip).

This confirms the migrations are safe to re-run — the mechanism is `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION/VIEW`, `DROP TRIGGER IF EXISTS` + `CREATE
TRIGGER`, and `INSERT ... ON CONFLICT DO NOTHING` throughout — the exact pattern the brief asked to
verify.

## 5. Constraint / trigger verification (17 tests, all passed)

Fixtures: one test organization (`org_test_finv3`), one `BASELINE_MODEL` artifact taken through
`DRAFT → IN_REVIEW → APPROVED`, one `STATEMENT_PACK` artifact left in `DRAFT`.

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | `UPDATE ... SET status='APPROVED'` on a version with `compute_snapshot_id IS NULL` | rejected | ✅ rejected — `cannot APPROVE ... without compute_snapshot_id` |
| 2 | Create a `finance_compute_snapshots` row, then approve properly | succeeds | ✅ |
| 3 | **UPDATE `content_semantic_hash` on an `APPROVED` row** (the literal brief ask) | rejected | ✅ rejected — `is APPROVED; only status and its associated metadata columns may change` |
| 4 | **`UPDATE ... SET status='DRAFT'` on an `APPROVED` row** — i.e. the exact "reopen mutates Approved in place" bug from Gate A (`financialModelingService.ts` lines ~2001/2047/2059) replayed against the new schema | rejected | ✅ rejected — `is APPROVED and immutable; only SUPERSEDED/ARCHIVED/INVALIDATED transitions allowed` |
| 5 | `UPDATE` only `freshness`/`freshness_reason`/`stale_since` on an `APPROVED` row (B03 §6.1: freshness is metadata, not content) | succeeds | ✅ |
| 6 | Re-read the row after tests 3-5 — content untouched, freshness updated | — | ✅ `hash1｜APPROVED｜STALE_SOURCE` |
| 7 | Insert a `finance_lineage_edges` row (`STATEMENT_TO_MODEL`) | succeeds | ✅ |
| 8 | **`UPDATE` on `finance_lineage_edges`** | rejected | ✅ rejected — `is append-only; UPDATE not permitted` |
| 9 | **`DELETE` on `finance_lineage_edges`** | rejected | ✅ rejected — `is append-only; DELETE not permitted` |
| 10 | Insert an edge with `target_rank <= source_rank` (cycle) | rejected | ✅ rejected — `target stage_rank (0) must be greater than source stage_rank (2)` |
| 11 | `RAISE` a `finance_exceptions` row, then **UPDATE** and **DELETE** it | both rejected | ✅ both rejected — `is append-only` |
| 12 | Insert `severity='SECURITY'` without `blocking_category` | rejected | ✅ rejected — `chk_finance_exceptions_blocking_category` |
| 13 | Two concurrent open (non-terminal) children (`reopen`) of the same `parent_version_id` | second rejected | ✅ rejected — `uq_finance_bv_one_open_child` |
| 14 | `finance_export_manifests` pointing at a `DRAFT` `primary_business_version_id` | rejected | ✅ rejected — `must be APPROVED, is DRAFT` |
| 15 | Same, pointing at the `APPROVED` version | succeeds | ✅ |
| 16 | A second `APPROVED` business version on the same `artifact_id` | rejected | ✅ rejected — `uq_finance_bv_one_approved` |
| 17 | `finance_export_manifests` content mutation after `status='READY'`, then legal `READY → REVOKED` transition | first rejected, second succeeds | ✅ rejected then ✅ succeeded |

**All triggers required by the brief fire correctly: the B02 immutability trigger on
`finance_business_versions` (including the exact reopen-in-place scenario from Gate A) and the B03/B05
append-only triggers on `finance_lineage_edges`/`finance_exceptions` all physically block the
disallowed operation.**

## 6. Discrepancies between the ADRs and what shipped in SQL

None of the ADRs required anything literally inexpressible in Postgres (no subquery-in-CHECK was
needed anywhere in the final design — every cross-row rule that would have needed one was already
routed to a trigger by the ADR authors themselves, e.g. B01 §3 alternative 3 explicitly rules out a
CHECK-only immutability rule for exactly this reason). The divergences below are implementation
decisions made while turning ADR prose/DDL sketches into real, tested SQL — each is called out
inline in the migration file that makes it, and summarized here:

1. **UUID → TEXT identifiers.** B04's DDL sketch uses native `uuid` columns; every other ADR (and
   all ~60 live Finance tables per Gate A) uses `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`.
   B01 §4 itself flags this as a risk to reconcile ("WP-B04 powinien przyjąć ten sam wzorzec
   TEXT..."). Resolved by using `TEXT` everywhere in this migration set, matching the live schema
   and `organizations(id)` (`TEXT`).
2. **Immutability trigger rewritten from a deny-list to an allow-list diff.** WP-B01's own DDL
   sketch trigger only compares 7 hardcoded columns; that check would silently miss any column
   added later by B02/B03/B05/B06 reconciliation (`risk_tier`, `freshness_reason`, `result_quality`,
   `version_kind`, ...) — none of those appear in the sketch's hardcoded list, meaning the literal
   ADR code would have let them be mutated on an `APPROVED` row undetected. Rewritten as a
   `to_jsonb(OLD)`/`to_jsonb(NEW)` diff against an explicit allow-list of the columns that *are*
   meant to stay mutable (`status` and its direct metadata + freshness annotations) — this was
   caught and fixed before shipping, not discovered by the test suite (though test 3/6 does exercise
   it against a column outside the original 7).
3. **`finance_lineage_edges` and `finance_exceptions` append-only enforced via trigger, not (only)
   DB-role `GRANT`.** B03 §3.1 specifies append-only purely as an application-role `GRANT
   INSERT, SELECT` without `UPDATE`/`DELETE`. This migration set does not stand up a separate,
   narrower application role (out of scope for WP-C01, and a Postgres superuser — the only role
   available on the isolated test cluster — bypasses `GRANT` restrictions entirely, which would
   have made the append-only guarantee untestable in this harness). A `BEFORE UPDATE/DELETE` deny
   trigger was added for both tables (same pattern B05/B06 already use for `finance_exceptions` and
   `finance_compute_snapshots`/`finance_export_manifests`), so the guarantee is enforced and
   testable regardless of which role performs the write.
4. **Lineage cycle-prevention trigger derives artifact type from the database, not from the
   caller-supplied denormalized columns.** B03 §4's sketch trusts
   `NEW.source_artifact_type`/`NEW.target_artifact_type` as given. This migration's trigger instead
   looks up the real `artifact_type` via `finance_business_versions → finance_artifacts` for both
   endpoints, raises if the caller-supplied value doesn't match, and uses the looked-up (not
   caller-supplied) type for the rank comparison — closing a gap where a caller could set the
   denormalized columns to arbitrary values to defeat the cycle check.
5. **`VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT` added to `finance_lineage_edges.edge_type`'s `CHECK`
   enum in the B03 migration, even though it is only introduced by WP-B06 §4.5.** Postgres
   `CHECK`-based enums require a `DROP`/`ADD CONSTRAINT` to extend later; since B06 already
   documents this value as a deliberate same-rank sibling/variant exception to B03's own rule, it
   was simpler and lower-risk to include it in the original `CHECK` than to alter it in a later
   migration. The cycle-prevention trigger exempts this value explicitly, per B06 §4.5.
6. **`compute_jobs`/`compute_job_runs`/`compute_job_outputs` kept without the `finance_` prefix**, as
   in B04's original DDL. WP-B06 §0 explicitly flags this as a known, un-reconciled naming
   inconsistency ("bez prefiksu finance_ — niespójność nieadresowana przez rekoncyliację, bo ta
   objęła tylko B01-B03"). Left as-is rather than unilaterally renamed, since B05 (`evidence` JSONB),
   B06 (`finance_compute_snapshots.compute_run_id`) and B07 (`reason_code`, correlation-id chain) were
   all written and cross-checked against this exact naming. Flagged here as technical debt for a
   future orchestrator-approved rename, not silently fixed.
7. **Forward references without FK kept exactly as documented.** `finance_business_versions.compute_run_id`,
   `finance_working_revisions.compute_run_id`, `finance_lineage_edges.compute_run_id`,
   `finance_compute_snapshots.compute_run_id`, and `artifact_lifecycle_events.snapshot_id` are all
   plain `TEXT` with no FK to any B04 table — every ADR that introduces one of these columns says so
   explicitly ("bez FK, ten sam powod co B01 2.2"), because B04's actual DDL never defines a single
   canonical "compute run" identity to point at (it has `compute_jobs.id`, `compute_job_runs.id`
   with `attempt_number`, and `compute_job_outputs.id` — three different things a "compute_run_id"
   could plausibly mean, and no ADR resolves which). This migration set does not invent a resolution
   unilaterally; kept as the documented forward reference.
8. **`finance_engine_manifests.market_data_asof` not deprecated.** WP-B06 §3.1 recommends marking
   this column deprecated/superseded by `finance_compute_snapshots`, but says explicitly that doing
   so "wymaga wspólnej rewizji z właścicielem WP-B01... nie jest to zmiana, którą WP-B06 może
   jednostronnie scommitować do cudzego ADR" (B06 §8). This migration leaves the column in place
   (additive-safe either way) rather than resolving that cross-ADR question unilaterally.
9. **Not implemented, by design — no concrete DDL exists in any ADR to implement:** the
   artifact-level compute quarantine flag proposed in WP-B07's runbook §6.2 ("rozszerzyć mechanizm
   kill switch... o wariant keyed po `input_artifact_id`"), and the `org_concurrency_limit()` /
   `is_org_compute_killed()` SQL functions referenced in WP-B04's claim-query sketch (§5.1). Both are
   explicitly left as open, unresolved design questions by their own ADRs (storage mechanism
   unspecified — "v8_feature_flags" vs. a new table — and no default limit values are proposed
   anywhere). Implementing either would mean inventing schema the ADRs never designed; left as an
   open item for a future work package rather than guessed at here.
10. **`finance_reason_codes.code` is advisory (no FK) for `finance_exceptions.reason_code`,
    mandatory (FK) for `compute_jobs.reason_code`/`compute_job_runs.reason_code`** — exactly as
    WP-B07 §3.2 specifies, to avoid retroactively constraining WP-B05's already-shipped free-text
    column.

## 7. Teardown

`pg_ctl -D /private/tmp/finance-v3-gate-c-pgdata-3267112874 stop` followed by `rm -rf` of that
directory, executed immediately after this report was written. No Postgres process from this work
package was left running; the shared instance (PID 911, `/opt/homebrew/var/postgresql@15`) was
never connected to at any point in this work package.

## 8. Summary

- 7 new additive migration files in `server/migrations/`, one per Gate B ADR (B02 folded into a
  short standalone file rather than a separate B01/B02 split, since it is a single small table).
- Fresh install: 586/586 migrations applied, 0 errors, 4.24 s total, all 7 new files ≤ 12 ms each.
- Upgrade replay: all 7 files re-applied cleanly against a populated database, 0 errors, data and
  triggers intact afterward.
- 17/17 constraint and trigger tests passed, including the two most safety-critical ones from the
  brief: (a) `UPDATE` on an `APPROVED` `finance_business_versions` row is physically rejected by
  the database (closing the exact "reopen mutates Approved in place" bug found in Gate A), and (b)
  the B03/B05 append-only triggers on `finance_lineage_edges`/`finance_exceptions` reject both
  `UPDATE` and `DELETE`.
- 10 documented, intentional divergences from the literal ADR sketches (§6) — none silent, each
  justified against the ADRs' own text or against a gap the ADRs themselves left open.
