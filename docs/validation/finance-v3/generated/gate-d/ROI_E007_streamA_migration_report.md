# ROI-E007 Stream A — Finance/KPI Seams Migration Report

**Program:** `docs/product/results-vnext/03_ROI_IMPLEMENTATION_PLAN.md`, `docs/product/results-vnext/07_EPIC_AND_TRACEABILITY_LEDGER.md` row ROI-E007 (line 60), XDOM-E003 (lines 81-82).
**Work package:** ROI-E007 Stream A — turns the accepted ADR
(`docs/validation/finance-v3/generated/gate-d/ROI_E007_finance_kpi_seams_ADR.md`) into real, additive SQL
migrations and tests them (fresh + upgrade replay, the ADR's own 15-scenario battery plus new scenarios for
the orchestrator's expanded scope) on an isolated Postgres — the same pattern WP-D01b/WP-D03b/WP-D05b/
WP-D07b/WP-D09b applied to their own ADRs in this session.
**Date:** 2026-08-10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** Real, tested, additive migrations landed in `server/migrations/`. This is the FIRST, sequential
stream of the ROI-E007 program — Streams B/C/D branch from this worktree's tip, after this commit, and
depend on the exact schema shape recorded here.

---

## 1. Database isolation

Own ephemeral cluster, never the shared Homebrew instance (PID 911, confirmed untouched via `ps aux` before
and after) and never any other concurrent session's own ephemeral cluster (two were observed running
independently throughout — ports 28711 and 28733 — both left completely alone).

- **Own ephemeral cluster:** data directory `/private/tmp/roi_e007_streama_pgdata`, `initdb --locale=C`,
  Homebrew PostgreSQL 15.15 (`/opt/homebrew/opt/postgresql@15/bin/`).
- **`LC_ALL=C`** exported for `initdb`/`pg_ctl`/`psql`/the migration runner — the same recurring macOS gotcha
  this session's prior work packages already documented (without it, postmaster fails to start).
- **Own port:** `57811` (in the 55000-59999 range), confirmed free via `lsof` before starting; loopback only
  (`-h 127.0.0.1`), Unix socket directory `/private/tmp`.
- **`NODE_ENV=test`** set only to satisfy `assertNoPrivateRailwayDbHostOutsideRailway` /
  `resolveReachableDatabaseUrl` when pointing the migration runner at a loopback host — not bypassed.
- **Teardown:** `pg_ctl -m fast stop` followed by `rm -rf` of the data directory, executed at the end of this
  work package. Final `ps aux` confirmed PID 911 and both unrelated concurrent sessions' processes (ports
  28711/28733) remained untouched; no process from this work package's cluster was left running.

## 2. Migrations delivered

Three new, purely additive files in `server/migrations/`:

| # | File | Creates |
|---|---|---|
| 1 | `20260809_finance_v3_e007_01_tables.sql` | `rvn_roi_finance_freshness` ENUM; `rvn_roi_finance_links` (pin + legacy bridge, with an explicit `status` column — see section 3); `rvn_roi_finance_reconciliations` (with `chk_rvn_rfr_resolution`); `rvn_roi_finance_link_events` (append-only ledger); all supporting indexes including `uq_rvn_rfl_one_active_per_slot` |
| 2 | `20260809_finance_v3_e007_02_integrity.sql` | `rvn_rfl_check_artifact_type()` (anti-spoof), `rvn_rfl_enforce_pin_immutability()` (allow-list-diff pin protection), `rvn_rfl_deny_hard_delete()` (new vs. the ADR sketch — see section 3), `rvn_roi_finance_link_events_deny_mutation()` (append-only), `rvn_roi_finance_mark_links_stale_on_new_approval()` + its trigger on `finance_business_versions` (the sole integration point with existing Finance v3 code — `approveVersion()` is untouched) |
| 3 | `20260809_finance_v3_e007_03_legacy_actual_protection.sql` | Deny-UPDATE/DELETE triggers on `roi_realized_values` and `v8_roi_realization_entries` (ADR section 5, both — the ADR's own Zalacznik A only spelled out `roi_realized_values` explicitly and flagged `v8_roi_realization_entries` as "identical shape" in escalation #7; this migration ships both), plus a column-scoped deny-UPDATE/deny-DELETE trigger on `benefit_tracking.actual_cost_savings`/`actual_revenue_increase`/`actual_productivity_gains` — the THIRD store, pulled into scope by the orchestrator, that the ADR's own section 2.4 / escalation #3 had deliberately left out of P0 |

Zero `DROP`/`RENAME`/`ALTER ... TYPE` on any existing table anywhere in this stream. The only touches to
pre-existing tables are: (a) triggers on `roi_realized_values`, `v8_roi_realization_entries`,
`benefit_tracking` (no column/CHECK change), (b) one new trigger on `finance_business_versions` (no
column/CHECK change). All three new tables use `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`, matching
the live-schema convention every other Finance v3 work package in this session already established.

### 3. Deliberate divergences from the literal ADR sketch

The ADR (section 11, escalation #4) explicitly flagged its own `superseded_at`/`superseded_by_link_id`
overloading as ambiguous for the "withdrawn without a successor" case, and recommended a fix without
implementing it ("osobna kolumna... zamiast przeciazac"). This stream applies that fix rather than leaving it
open, per the orchestrator's scope item 1 (API `DELETE` on a link = soft-delete via a status field, never a
hard `DELETE`):

1. **`rvn_roi_finance_links` gains an explicit `status` column** — `'ACTIVE' | 'SUPERSEDED' | 'WITHDRAWN'`
   — instead of the ADR sketch's overload of `superseded_at`/`superseded_by_link_id` with two meanings.
2. **`uq_rvn_rfl_one_active_per_slot` is scoped to `WHERE status = 'ACTIVE'`**, not the ADR sketch's
   `WHERE superseded_by_link_id IS NULL` (which under-constrains the withdrawn-without-successor case — the
   ADR's own escalation #4 showed this).
3. **`chk_rvn_rfl_status_metadata`** (new, not in the ADR sketch) makes the three states mutually exclusive
   and internally consistent: `ACTIVE` ⇒ both supersession fields `NULL`; `SUPERSEDED` ⇒ both `NOT NULL`;
   `WITHDRAWN` ⇒ `superseded_at` set, `superseded_by_link_id` `NULL`. Proven live: TEST 20 (rejects an
   inconsistent `INSERT`).
4. **A `BEFORE DELETE` deny trigger on `rvn_roi_finance_links` itself** (`rvn_rfl_deny_hard_delete`) — the
   ADR sketch left physical `DELETE` possible on this table (section 8 treated "DELETE" as an API-level
   convention only, not a schema guarantee). This migration makes "never a hard DELETE" a **physical**
   guarantee, matching orchestrator scope item 1 and the same physical-over-procedural reasoning the ADR
   itself uses for `roi_realized_values` (section 5.3). Proven live: TEST 17.

**A real implementation-sequencing finding, worth handing to whoever builds the `POST`/`DELETE`
`.../finance-links` endpoints (ADR section 8, Stream D scope):** because `uq_rvn_rfl_one_active_per_slot` is
a **non-deferred** partial unique index (Postgres cannot back a `DEFERRABLE` constraint with a partial
index, unlike the full-row `DEFERRABLE` constraints WP-D09 used elsewhere in this program for its
weight-sum/sensitivity-grid gates), the naive "insert successor ACTIVE, then mark predecessor SUPERSEDED"
order fails — both rows would be `ACTIVE` for the same slot simultaneously, even for one statement, even
inside a single transaction. The correct sequence, proven live in TEST 19, is three steps: (1) predecessor
→ `WITHDRAWN` (vacates the slot, needs no successor id yet), (2) `INSERT` the successor as `ACTIVE`, (3)
predecessor → `SUPERSEDED` with `superseded_by_link_id` now pointing at the (now-existing) successor. Every
intermediate state satisfies `chk_rvn_rfl_status_metadata`, and the slot is never double-occupied.

## 4. Fresh install replay

Ran the project's own runner (`server/scripts/migrate.postgres.ts`) against an **empty** ephemeral database
— every migration in `server/migrations/` (existing + the 3 new files), in the runner's deterministic
phase/date/filename order:

```
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:57811/roi_e007_streama_fresh \
  LC_ALL=C npx tsx server/scripts/migrate.postgres.ts
```

- **608 migrations recorded in `schema_migrations`, 0 errors, 0 skipped** (605 pre-existing at the time this
  stream started, plus this stream's 3 new files). Confirmed the 3 new files sort correctly right after
  `..._d_ap07_saved_views_01_tables.sql` and before `..._t01_u03_owner_backed_execution.sql`.
- **Per-file timing** (from `schema_migrations.execution_time_ms`): `..._01_tables.sql` 7 ms,
  `..._02_integrity.sql` 1 ms, `..._03_legacy_actual_protection.sql` 1 ms — 9 ms total, no lock-time risk.
- All 3 new tables confirmed present via `\dt rvn_roi_finance_*`; all constraints/indexes/triggers confirmed
  via `\d` (full column/constraint/trigger listing captured live, matching the design in section 3 of this
  report exactly).

### 4.1 A real, separate fresh-install gap found while testing this file (not a defect of this migration)

`..._03_legacy_actual_protection.sql`'s `benefit_tracking` block hit `relation "benefit_tracking" does not
exist` on the very first fresh-install attempt. Root cause: `benefit_tracking`'s own producer,
`server/migrations/067_economics_initiative_integration.sql` (version `067` < `500`), is silently excluded
by `migrate.postgres.ts`'s `isSqliteOnlyMigration()` blanket rule on a genuinely fresh/strict install — the
same class of gap `STRICT_SCHEMA_REPAIR_REPORT.md` already documented for `081_studio_tables.sql` /
`073_conversations.sql` / `215_partner_portal.sql` / `256_integrations_system.sql`, except `067` was never
added to that repair's `PROMOTED_LEGACY_PRODUCERS` list. On live demo/dev databases the table exists
(created via `PostgresDatabase.ts`'s own `initDb()`, a separate code path from this migration runner), so
this is a **fresh-install-runner gap, not a "does the table exist in production" gap**. Fixed in this
migration with a runtime `to_regclass('public.benefit_tracking') IS NOT NULL` guard (a `DO` block wrapping
the function/trigger DDL in `EXECUTE` strings) instead of promoting `067` into the runner's manifest, since
that promotion is a platform-wide decision touching every other in-flight worktree/stream — **flagged here
as a P1 for whoever owns `migrate.postgres.ts` next**, not fixed by this stream. Confirmed live: the fresh
install completed with 0 errors and the `benefit_tracking` block was skipped via a `RAISE NOTICE` (visible
when the file is run directly via `psql -f`; suppressed by the runner's `pool.query()` call but does not
affect the migration's recorded `success` status).

## 5. Upgrade replay (idempotency on a non-empty, populated database)

After loading test fixtures (section 6) and running the full test battery (section 7) — leaving 4 rows in
`rvn_roi_finance_links`, 2 in `rvn_roi_finance_reconciliations`, 2 in `rvn_roi_finance_link_events` — all
three raw `.sql` files were re-executed directly with `psql -f` against the already-migrated, populated
database:

- **All three files re-applied cleanly, 0 errors.** File 1 emitted `NOTICE: relation ... already exists,
  skipping` for every `CREATE TABLE/INDEX IF NOT EXISTS`; files 2/3 re-applied silently
  (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`/`CREATE TRIGGER` for every trigger).
- **Row counts identical before/after**: `links` 4/4, `reconciliations` 2/2, `events` 2/2.
- **The four highest-risk mechanisms re-verified live post-replay**, not merely inferred from a clean exit
  code:
  - Pin immutability: re-attempting `UPDATE rvn_roi_finance_links SET finance_version_id = ...` on a real,
    still-`ACTIVE` row (`lnk-1-succ`) raised the identical `is a pin; only status/freshness/supersession
    metadata may change...` message.
  - Hard-delete deny: re-attempting `DELETE FROM rvn_roi_finance_links WHERE id = 'lnk-2b'` (a real, still-
    `ACTIVE` row) raised the identical `hard DELETE is not permitted...` message.
  - `roi_realized_values` append-only: re-attempting `UPDATE ... SET realized_revenue_delta = 42` on the
    original fixture row raised the identical append-only message.
  - `benefit_tracking` actual-column protection: re-attempting `UPDATE ... SET actual_cost_savings = 1`
    raised the identical append-only message.

This confirms the migrations are safe to re-run — `CREATE TABLE/INDEX IF NOT EXISTS`,
`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — the same idempotent pattern
family every other Finance v3 work package in this session already established.

## 6. Test fixtures

One org (`org-e007a`). One Initiative (`init-e007a-1`, the legacy ROI-side bridge). One `BASELINE_MODEL`
Finance artifact (`fa-e007a-1`) with two business versions (`bv-e007a-1` → later `APPROVED` then
`SUPERSEDED`; `bv-e007a-1b` → its successor, later `APPROVED`), each backed by a real
`finance_working_revisions` → `finance_compute_snapshots` chain (required by WP-B01's own
`finance_bv_enforce_immutability` — "cannot APPROVE without `compute_snapshot_id`", and that column has a
real FK to `finance_compute_snapshots`, discovered live while building this fixture — not documented as an
FK in the WP-B01 migration's own header comment, which called it a "forward reference... deliberately no FK
yet" at authoring time; a later migration in this session evidently added it). One independent
`VALUATION_CASE` artifact (`fa-e007a-2`/`bv-e007a-2`), used only for the anti-spoof test. One
`roi_realized_values` row (`rrv-e007a-1`) and one `v8_roi_realization_entries` row (`v8rre-e007a-1`,
requiring a `v8_kpi_definitions` fixture row). One `initiative_financials` + `benefit_tracking` row
(`bt-e007a-1`) — **`initiative_financials`/`benefit_tracking` were created manually in this test database**
(their own migration `067` is excluded from a strict fresh install, section 4.1), using the exact column
shapes from `server/migrations/067_economics_initiative_integration.sql`, to prove the guarded trigger
activates correctly once the table exists (matching the live demo/dev shape, not the strict-fresh-install
shape).

All fixture/test SQL lives in the session scratchpad
(`/private/tmp/finance-v3-gate-a-20260809-scratch/e007_fixture.sql`, `e007_tests.sql`,
`e007_tests_benefit_tracking.sql`), not in the repo — same convention every prior work package in this
session used.

## 7. Constraint / trigger / function verification

### 7.1 The ADR's own 15 scenarios, all re-verified live, all passing

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Link to DRAFT finance version | Accepted | ✅ |
| 2 | `finance_artifact_type` spoofed (`VALUATION_CASE` claimed for a `BASELINE_MODEL` artifact) | Rejected (anti-spoof trigger) | ✅ |
| 3 | Second `ACTIVE` link, same (Case, artifact, purpose) slot | Rejected (`uq_rvn_rfl_one_active_per_slot`) | ✅ |
| 4 | Different `link_purpose`, same Case+artifact | Accepted | ✅ |
| 5 | Repin `finance_version_id` via `UPDATE` to a real, different version | Rejected (pin immutability) | ✅ |
| 6 | `UPDATE` only `freshness_state` | Accepted | ✅ |
| 7 | Open reconciliation (`OPEN`, `divergence_summary`) | Accepted | ✅ |
| 8 | `status='RESOLVED'` without `resolved_by`/`resolved_at`/`resolution_note` | Rejected (`chk_rvn_rfr_resolution`) | ✅ |
| 9 | `status='RESOLVED'` with full resolution fields | Accepted | ✅ |
| 10 | `UPDATE roi_realized_values.realized_revenue_delta` | Rejected | ✅ |
| 11 | `DELETE FROM roi_realized_values` | Rejected | ✅ |
| 12 | Correction as a new row (`source='correction'`) | Accepted | ✅ |
| 13 | Approve `bv-e007a-1` (13a, zero effect) → supersede + approve `bv-e007a-1b` (13b) → both links `STALE_SOURCE` (13c), `finance_version_id` unchanged, 2 append-only event rows (13d) | Accepted, exactly as designed | ✅ |
| 14 | `UPDATE` on `rvn_roi_finance_link_events` | Rejected | ✅ |
| 15 | `DELETE` on `rvn_roi_finance_link_events` | Rejected | ✅ |

### 7.2 New scenarios for the orchestrator's expanded scope

| # | Test | Expected | Result |
|---|---|---|---|
| 10b | `UPDATE v8_roi_realization_entries.realized_value` | Rejected — same append-only guarantee as `roi_realized_values`, on the entry_id-keyed table (ADR escalation #7) | ✅ |
| 11b | `DELETE FROM v8_roi_realization_entries` | Rejected | ✅ |
| 16 | Soft-delete `lnk-2` via `UPDATE ... SET status='WITHDRAWN', superseded_at=now()` (the API `DELETE`'s real implementation, ADR section 8 + orchestrator scope item 1) | Accepted — row still present, `status='WITHDRAWN'`, `superseded_by_link_id` `NULL` | ✅ |
| 17 | Hard `DELETE FROM rvn_roi_finance_links` | Rejected (`rvn_rfl_deny_hard_delete`) — never a hard delete, physically | ✅ |
| 18 | Re-`INSERT` into a slot vacated by a `WITHDRAWN` link | Accepted — proves `WHERE status='ACTIVE'` scoping does not permanently lock a slot after withdrawal (fixes the ADR's own escalation #4 ambiguity) | ✅ |
| 19 | Proper supersession chain (predecessor → `WITHDRAWN` → insert successor `ACTIVE` → predecessor → `SUPERSEDED` pointing at successor), 3-step sequence in one transaction | Accepted — see section 3's implementation-sequencing finding | ✅ |
| 20 | `INSERT` with `status='ACTIVE'` but `superseded_at` already set | Rejected (`chk_rvn_rfl_status_metadata`) | ✅ |
| 21 | `UPDATE benefit_tracking.actual_cost_savings` — the **exact statement shape** `PUT /api/economics/analyses/:id/benefits` (`server/src/routes/economics.routes.ts` lines 1576-1584) issues today for an existing period row | Rejected — see section 8 for the live-route consequence | ✅ |
| 22 | `UPDATE benefit_tracking.actual_revenue_increase` | Rejected — proves all three `actual_*` columns are covered, not just `actual_cost_savings` | ✅ |
| 23 | `UPDATE benefit_tracking` changing only `verification_status`/`verified_by`/`verified_at`/`variance_notes` | Accepted — proves the protection is column-scoped, not a blanket deny-all | ✅ |
| 24 | `UPDATE benefit_tracking` re-sending the same `actual_cost_savings` value (no-op) | Accepted — `IS DISTINCT FROM` correctly treats "same value again" as not an overwrite | ✅ |
| 25 | `DELETE FROM benefit_tracking` | Rejected — deleting the row destroys its `actual_*` values by omission | ✅ |

Final `benefit_tracking` row state confirmed via live `SELECT`: `planned_cost_savings=4600` (changed, TEST
24), `actual_cost_savings=4000` (the **original** value — never became 4800 or 1, despite three separate
attempts across TESTs 21/24/re-verified post-replay), `verification_status='verified'`,
`verified_by='user-2'` (both changed, TEST 23) — proving the column-scoped design works exactly as intended:
legitimate metadata updates go through, `actual_*` overwrites do not.

## 8. Resolve-readiness (orchestrator scope item 3)

`rvn_roi_finance_reconciliations` already carries `resolved_by`/`resolved_at`/`resolution_note` with
`chk_rvn_rfr_resolution` enforcing that `RESOLVED`/`DISMISSED` requires all three populated and
`OPEN`/`UNDER_REVIEW` requires all three `NULL` — this was already present in the ADR (section 4) and is
**not** a new addition by this stream. Proven live by TEST 9 (`RESOLVED` with full fields, accepted) and the
new TEST 9b (`DISMISSED` with full fields, accepted — the ADR's own battery only exercised the `RESOLVED`
terminal state; this stream additionally confirms `DISMISSED`). No endpoint was implemented in this stream
(that is explicitly Stream D scope, ADR section 11 escalation #5) — this section only confirms the schema
is ready for a future `PATCH .../finance-reconciliations/:id` resolve endpoint to write against, as the
orchestrator's task asked to verify.

## 9. Third ROI Actual store — exact identity (for Streams B/C/D)

**Table:** `benefit_tracking` (defined in `server/migrations/067_economics_initiative_integration.sql`,
lines 62-105).
**Protected columns:** `actual_cost_savings`, `actual_revenue_increase`, `actual_productivity_gains` (all
`REAL`).
**Protection mechanism:** `benefit_tracking_deny_actual_overwrite()` (in
`20260809_finance_v3_e007_03_legacy_actual_protection.sql`) — `BEFORE UPDATE`: rejects only if any of the
three protected columns' new value `IS DISTINCT FROM` its old value (other columns — `planned_*`,
`verification_status`, `verified_by`, `verified_at`, `variance_notes`, `achievements`, `challenges`,
`updated_at` — remain freely updatable); `BEFORE DELETE`: rejects unconditionally (deleting the row destroys
its `actual_*` values too).
**Deliberately NOT a blanket deny-all** (unlike `roi_realized_values`/`v8_roi_realization_entries`): a real,
currently-running route, `PUT /api/economics/analyses/:id/benefits`
(`server/src/routes/economics.routes.ts` lines 1529-1620), legitimately `UPDATE`s
`planned_cost_savings`/`overall_variance_percent`/`updated_at` as part of its own upsert logic and would 500
on every call under a blanket deny-all trigger — a regression the orchestrator's own scope item 2 language
("chroń kolumny actual\_\*") does not ask for.

**KNOWN, LIVE INCOMPATIBILITY — flagged prominently, not fixed by this stream:** that same route's `UPDATE`
branch (lines 1576-1584) sets `actual_cost_savings = ?` on an existing `(organization_id, initiative_id,
tracking_period)` row whenever the caller re-submits a period that already has a row — i.e., before this
migration, it silently overwrote a previously recorded actual. After this migration, that exact `UPDATE`
statement shape is physically rejected whenever the new value differs from the stored one (proven live,
TEST 21, using the identical column list the route issues), and the route will surface a `500` (its
existing `try/catch` only special-cases `FinanceStorageUnavailableError`, not this new trigger's exception)
until it is changed to either `INSERT` a new period row for a correction or call an explicit
correction/reconciliation path instead of `UPDATE`. This is the exact "cichy overwrite" the whole ROI-E007
epic exists to close — the trigger works as designed by closing it, not a migration defect — but it is a
real, live consequence for whichever stream next touches `economics.routes.ts`, not a hypothetical one.

## 10. Teardown

`pg_ctl -D /private/tmp/roi_e007_streama_pgdata -m fast stop` followed by `rm -rf` of that directory,
executed immediately after this report was written. Final `ps aux` confirmed only PID 911 (the shared
Homebrew instance) and two unrelated, independent concurrent sessions' own processes (ports 28711/28733,
never touched) remained; no process from this work package's ephemeral cluster was left running.

## 11. Summary

- **3 new additive migration files** in `server/migrations/`: `20260809_finance_v3_e007_01_tables.sql`,
  `..._02_integrity.sql`, `..._03_legacy_actual_protection.sql` — creating 1 new ENUM, 3 new tables
  (`rvn_roi_finance_links`, `rvn_roi_finance_reconciliations`, `rvn_roi_finance_link_events`), 6 new
  functions, and 9 new triggers on the 3 new tables, plus 6 new triggers on 3 pre-existing tables
  (`roi_realized_values`, `v8_roi_realization_entries`, `benefit_tracking` — column-scoped for the last one)
  and 1 new trigger on `finance_business_versions`. Zero columns added, zero columns altered, zero rows
  touched on any pre-existing table.
- **Fresh install: 608/608 migrations applied, 0 errors**; the 3 new files together add 9 ms. One real,
  separate fresh-install gap found and worked around (section 4.1): `benefit_tracking`'s own producer
  migration is excluded from a strict fresh install by the runner's pre-existing `isSqliteOnlyMigration()`
  rule — not a defect of this stream's migrations, guarded against with a runtime existence check, flagged
  as a P1 for the runner's owner.
- **Upgrade replay: all three files re-applied cleanly against a populated database, 0 errors, row counts
  identical before/after**, and the four highest-risk trigger mechanisms (pin immutability, hard-delete
  deny, `roi_realized_values` append-only, `benefit_tracking` actual-column protection) re-verified to raise
  the identical error live post-replay, not merely inferred from a clean exit code.
- **All 15 of the ADR's own scenarios re-verified live, all passing**, plus **10 new scenarios** (10b/11b for
  `v8_roi_realization_entries`, 16-20 for the `status`-column soft-delete/hard-delete-deny/supersession
  redesign, 21-25 for the third `benefit_tracking` store) — **25 scenarios total, 0 unexpected results.**
- **Orchestrator scope item 1 (soft-delete via status, never a hard DELETE)**: closed with a new explicit
  `status` column + `chk_rvn_rfl_status_metadata` + a physical `BEFORE DELETE` deny trigger — stronger than
  the ADR's own sketch, which left DELETE physically possible. Proven live: TESTs 16-20.
- **Orchestrator scope item 2 (third ROI Actual store)**: `benefit_tracking.actual_cost_savings` /
  `actual_revenue_increase` / `actual_productivity_gains` (migration `067_economics_initiative_
  integration.sql` lines 62-105) — column-scoped `BEFORE UPDATE`/`BEFORE DELETE` deny triggers, proven live
  (TESTs 21-25) including the exact statement shape the one real, currently-running caller uses (flagged as
  a known, live incompatibility for whoever owns `economics.routes.ts` next — section 9).
- **Orchestrator scope item 3 (resolve-readiness)**: confirmed already present in the ADR's own design
  (`resolved_by`/`resolved_at`/`resolution_note` + `chk_rvn_rfr_resolution`), extended test coverage to the
  `DISMISSED` terminal state (TEST 9b) in addition to the ADR's own `RESOLVED` test. No endpoint code written
  — Stream D scope (ADR section 11 escalation #5).
- **Zero application code changed.** This stream is migrations only. `server/src/services/finance/canonical/
  artifactVersionService.ts:521` (`approveVersion()`) remains completely untouched — the freshness
  propagation trigger on `finance_business_versions` is the only integration point, exactly as the ADR
  requires.

## 12. Handoff — exact schema shape for Streams B/C/D

- `rvn_roi_finance_links(id, organization_id, roi_case_bridge_type, roi_case_bridge_id, roi_case_id,
  finance_artifact_type, finance_artifact_id, finance_version_id, mapping_version, source, as_of,
  semantic_unit, semantic_currency, link_purpose, status, freshness_state, freshness_reason, stale_since,
  superseded_by_link_id, superseded_at, created_by, created_at)` — `status` is the new column vs. the ADR
  sketch; API `DELETE` = `UPDATE ... SET status='WITHDRAWN', superseded_at=now()`; proper supersession is
  the 3-step sequence in section 3.
- `rvn_roi_finance_reconciliations(id, organization_id, link_id, status, divergence_summary, opened_by,
  opened_at, resolved_by, resolved_at, resolution_note)` — unchanged from the ADR sketch, resolve-ready.
- `rvn_roi_finance_link_events(id, organization_id, link_id, previous_state, new_state, reason_code,
  triggering_finance_version_id, created_at)` — unchanged from the ADR sketch, append-only.
- Legacy stores now physically protected: `roi_realized_values` (deny all UPDATE/DELETE),
  `v8_roi_realization_entries` (deny all UPDATE/DELETE), `benefit_tracking` (deny UPDATE only of
  `actual_cost_savings`/`actual_revenue_increase`/`actual_productivity_gains`, deny all DELETE) — the third
  store `economics.routes.ts` (lines 1576-1584) will need updating before its existing upsert-with-overwrite
  behavior works again.
