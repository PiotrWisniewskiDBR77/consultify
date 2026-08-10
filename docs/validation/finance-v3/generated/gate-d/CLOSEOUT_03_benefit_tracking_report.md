# ROI-E007 closeout CO-3 — `benefit_tracking.actual_*` protection: EVIDENCE_MISSING closed

**Branch:** `codex/finance-v3-closeout-co3-benefittracking`
**Base HEAD before this work:** `eb0259a0e686efc55ee1dcb3259352124a6e1442`
**Date:** 2026-08-10
**Closes:** point **6c** of `ROI_E007_FANIN_VERIFICATION_report.md` (the single `EVIDENCE_MISSING`)

## Environment

Purpose-built ephemeral PostgreSQL, destroyed after the run. Nothing touched demo, prod or dev.

| Item | Value |
| --- | --- |
| Engine | PostgreSQL 15.15 (Homebrew, `postgresql@15` — not @16) |
| Port | 55021 (probed free with `lsof -i:PORT`; never 5432/28711/52824) |
| Locale | `LC_ALL=C` at both `initdb` and `pg_ctl start` |
| Database | `roi_e007_co3`, created empty, extensions `uuid-ossp` + `pgcrypto` |
| Vitest cwd | `server/` for `server/src/**`, repo root for `tests/**` |
| Teardown | `pg_ctl stop` + `rm -rf` on the data directory |

**Env contract.** The `.pg.test.ts` suites gate on `RUN_DB_TESTS=1` **and** `MOCK_DB=false` **and** a
`postgres…` `DATABASE_URL`. This was verified as a live negative control, not taken on trust: the
same command with `MOCK_DB=false` omitted reports `Tests 16 skipped (16)`, **exit 0**. Any green in
this report that does not also print a non-zero *passed* count has not touched a database.

---

## 1. Which route was taken, and the evidence for it

**Route (a) — create the table.** `benefit_tracking` is not an orphan; route (b) (retire the
endpoint) would have deleted a live path. Consumers, from grep, not assumption:

| Consumer | Evidence |
| --- | --- |
| `GET /api/economics/analyses/:id/benefits` | `server/src/routes/economics.routes.ts:1511` — `SELECT * FROM benefit_tracking WHERE organization_id = ? AND initiative_id = ?` |
| `PUT /api/economics/analyses/:id/benefits` | same file: `SELECT` at 1604, `UPDATE` at 1717/1720, `INSERT` at 1733 |
| Router actually mounted | `server/src/Gateway.ts:1110` — `app.use('/api/economics', betaGate, economicsRoutes)` (import at `Gateway.ts:115`) |
| Frontend | `src/components/Economics/BenefitsTrackingDashboard.tsx` — `Api.getAnalysisBenefits()` on load, `Api.updateAnalysisBenefits()` on save; exported from `src/components/Economics/index.ts:25` |
| Tests | `server/src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts` (HTTP-level), `tests/integration/routes/economics.missing-table-honesty.postgres.integration.test.ts:103` |

Decisive on top of the raw grep: the `PUT` handler was **rewritten by ROI-E007 Stream C
specifically to cooperate with the append-only trigger** — it omits `actual_cost_savings` from the
`UPDATE` on divergence, routes the disagreement into `rvn_roi_finance_reconciliations`, and answers
409 instead of 500. Retiring the endpoint would throw that work away and re-open the silent
overwrite the epic exists to close.

## 2. The fix

**New file:** `server/migrations/946_benefit_tracking_fresh_install.sql` — additive, numbered 946
(≥ 500, so `isSqliteOnlyMigration()` does not exclude it), `CREATE TABLE IF NOT EXISTS` +
`CREATE INDEX IF NOT EXISTS` only. No `ALTER`, no `DROP`, no `INSERT`. No other file was touched —
`migrate.postgres.ts`, `economics.routes.ts` and the protection migration are all unchanged.

**Ordering — why no second migration is needed.** `migrate.postgres.ts` sorts phase 0 (NUMBERED)
entirely before phase 1 (DATED) (`phaseAndKeyFor()`, rationale at lines 99-145). 946 is numbered,
`20260809_finance_v3_e007_03_legacy_actual_protection.sql` is dated, so the table exists by the time
the protection migration evaluates `to_regclass('public.benefit_tracking')`. Verified on the live
catalog below, not inferred. Trigger DDL therefore stays single-owned by the protection migration
instead of being duplicated.

**Shape — derived, not invented.** Columns/defaults/CHECKs are 067 lines 62-105 plus 068's
`tracking_period` ALTER (`068_economics_analysis_financials.sql:87`), in Postgres types. It matches
byte-for-byte the DDL the Stream C suite already builds for itself (`BENEFIT_TRACKING_DDL`), i.e.
the shape the live route is written against. Three deviations from 067's literal text, each forced:

| Deviation | Why it is not optional |
| --- | --- |
| `financial_id` NULLABLE, no FK (067: `TEXT NOT NULL REFERENCES initiative_financials(id)`) | The only writer in the codebase — the PUT handler's INSERT — passes `financial_id = null` literally, so `NOT NULL` would break the live route on every first save. And `initiative_financials` is created only by the same excluded 067, so the FK target does not exist on a fresh install. |
| `organization_id TEXT` (067: `INTEGER`) | The app passes `req.user.organizationId`, a string id. TEXT is also what the real-database pg_dump holds (`server/migrations-v2/001_baseline_20260413.sql:6872`). |
| `period_start`/`period_end` `TIMESTAMPTZ` (067: `DATE`) | The handler writes `new Date().toISOString()` into both and `GET` falls back to `row.period_start` as the displayed `trackingPeriod`; `DATE` would silently truncate. |

No `initiative_id` FK either — adding a constraint the live database does not have would make fresh
installs stricter than production. 067's `CREATE VIEW IF NOT EXISTS v_benefit_tracking_summary` is
not reproduced: that syntax is invalid in Postgres, and grep finds zero consumers of the view in
`server/src/` or `src/`. All five of 067's indexes are reproduced.

**Safety on demo.** `CREATE TABLE IF NOT EXISTS` and nothing else. Where the table already exists the
migration adds no column, alters no type, drops nothing and touches no row — it cannot reshape an
existing table, whatever that table's historical shape is.

## 3. Strict migration from zero — PASS

```
DOTENV_IGNORE_LOCAL=1 NODE_ENV=test DB_TYPE=postgres \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55021/roi_e007_co3 \
  npx tsx server/scripts/migrate.postgres.ts
```

| Metric | Value |
| --- | --- |
| Exit code | **0** |
| `schema_migrations` breakdown | `success = 626`, `failed = 0`, `skipped = 0` |
| Base tables in `public` | 1455 |

`--safe` deliberately not passed, so a failing migration aborts with exit 1 rather than being
recorded `skipped`. Single-status `success|626` is a real assertion, not the `--safe` artefact.

```
 filename                                                 | status
----------------------------------------------------------+---------
 946_benefit_tracking_fresh_install.sql                   | success
 20260809_finance_v3_e007_03_legacy_actual_protection.sql | success
```

067/068 remain excluded as before — `SELECT filename FROM schema_migrations WHERE filename LIKE
'067%' OR filename LIKE '068%'` returns **0 rows**. There is no duplicate producer of the table.

## 4. The triggers are now attached — PASS (this is what 6c could not show)

```sql
SELECT to_regclass('public.benefit_tracking')::text;   -- benefit_tracking   (was NULL before)
```

```
 tgname                                     | pg_get_triggerdef
--------------------------------------------+----------------------------------------------------------------------
 trg_benefit_tracking_deny_actual_overwrite | CREATE TRIGGER … BEFORE UPDATE ON public.benefit_tracking
                                            |   FOR EACH ROW EXECUTE FUNCTION benefit_tracking_deny_actual_overwrite()
 trg_benefit_tracking_deny_delete           | CREATE TRIGGER … BEFORE DELETE ON public.benefit_tracking
                                            |   FOR EACH ROW EXECUTE FUNCTION benefit_tracking_deny_actual_overwrite()
```

The protection migration's `to_regclass()` ELSE branch — the one that used to emit a NOTICE and
skip — is no longer taken.

## 5. Protection proved on a PHYSICALLY EXISTING row

Both triggers are `FOR EACH ROW`. With no row an `UPDATE` matches nothing, reports `UPDATE 0`, and
never fires the trigger — so "`UPDATE 0`, therefore protected" would be a false proof. Every attempt
below is bracketed by an out-of-band re-read.

### 5.1 The row exists (precondition, not assumed)

```sql
INSERT INTO benefit_tracking (id, financial_id, initiative_id, organization_id, period_start,
  period_end, tracking_period, planned_cost_savings, actual_cost_savings, actual_revenue_increase,
  actual_productivity_gains, overall_variance_percent, created_by)
VALUES ('bt-co3-proof-1', NULL, 'init-co3-proof', 'org-co3-proof', now(), now(), '2026-Q1',
  100000, 250000, 30000, 12.5, 150, 'co3-agent');
-- INSERT 0 1
```

```
SELECT count(*) FROM benefit_tracking WHERE id='bt-co3-proof-1';   -->  1
id                        | bt-co3-proof-1
actual_cost_savings       | 250000
actual_revenue_increase   | 30000
actual_productivity_gains | 12.5
verification_status       | pending
```

The INSERT succeeded — no FK silently swallowed it. This is the check that would have caught a
vacuous run.

### 5.2 UPDATE of each protected column — REJECTED

| Attempt | Row present before | Result | Value after |
| --- | --- | --- | --- |
| `SET actual_cost_savings = 999999` | rows=1, value 250000 | **ERROR** — `benefit_tracking.actual_* is append-only under ROI-E007 governance; UPDATE … not permitted (row bt-co3-proof-1)` (`benefit_tracking_deny_actual_overwrite()` line 11) | rows=1, **250000** unchanged |
| `SET actual_revenue_increase = 999999` | rows=1, value 30000 | **ERROR** — same exception | rows=1, **30000** unchanged |
| `SET actual_productivity_gains = 999999` | rows=1, value 12.5 | **ERROR** — same exception | rows=1, **12.5** unchanged |

### 5.3 DELETE — REJECTED

```
before:  rows_present = 1, actual_cost_savings = 250000
DELETE FROM benefit_tracking WHERE id='bt-co3-proof-1';
ERROR: benefit_tracking is append-only for actual_* under ROI-E007 governance;
       DELETE not permitted (row bt-co3-proof-1) -- deleting the row destroys previously
       recorded actual_cost_savings/actual_revenue_increase/actual_productivity_gains
after:   rows_present = 1
```

### 5.4 Non-protected columns still update — the guard is column-scoped, not blanket-deny

| Attempt (row present, rows=1, before each) | Result |
| --- | --- |
| `SET planned_cost_savings=175000, overall_variance_percent=42.75, updated_at=now()` — literally what `PUT /benefits` writes on the divergence path | **UPDATE 1** |
| `SET verification_status='verified', verified_by=…, verified_at=now(), variance_notes=…, achievements=…, challenges=…, planned_revenue_increase=5, planned_productivity_gains=6` | **UPDATE 1** |
| `SET actual_cost_savings = 250000` (same value) `, planned_cost_savings = 180000` — the trigger's own `IS DISTINCT FROM` no-op path | **UPDATE 1** |

Final row state: `planned_cost_savings 180000`, `overall_variance_percent 42.75`,
`verification_status verified` — while `actual_cost_savings 250000`, `actual_revenue_increase 30000`,
`actual_productivity_gains 12.5` are exactly the values recorded at INSERT.

## 6. Tests

### 6.1 Stream C regression suite (the brief's point 4)

```
cd server && DOTENV_IGNORE_LOCAL=1 DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:55021/roi_e007_co3 \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts \
    --no-file-parallelism
```

**`Test Files 1 passed (1)` · `Tests 16 passed (16)`** — 11 adapter tests, 4 endpoint regressions,
1 negative control. Named results include: *REGRESSION A: divergent actual WITH a ROI case + link →
200 + reconciliationId, stored actual UNCHANGED* (149 ms), *REGRESSION B: divergent actual WITHOUT a
ROI case → 409, value unchanged, NOT 500* (5 ms), and the suite's own *negative control — the raw
pre-migration UPDATE really is rejected by the trigger* (3 ms).

What changed for this suite: its `beforeAll` creates `benefit_tracking` only *when missing*. On this
database the table came from migration 946, so the branch was not taken — the suite now exercises
the **migration-built** table instead of its own hand-rolled DDL. Confirmed by object identity: the
probe row `bt-co3-proof-1` inserted in §5 was still present after the run.

### 6.2 New regression guard

**New file:** `server/src/services/finance/canonical/__tests__/benefitTrackingActualProtection.pg.test.ts`
— **`Tests 10 passed (10)`**.

It exists because the Stream C suite *cannot* guard this gap: that suite builds the table itself when
absent, so it stays green whether or not the runner produces it — which is precisely how 6c became
EVIDENCE_MISSING. The new suite creates no schema at all. It asserts the table exists, that
`946_benefit_tracking_fresh_install.sql` is recorded `success` in `schema_migrations`, that both
triggers are attached, and then repeats §5's row-level proofs with an explicit row re-read before
every attempt.

**Negative control on the new suite** (mandatory — a protection test that cannot go red proves
nothing): with both triggers dropped, it reports **`8 failed | 2 passed`** — only the two pure schema
assertions survive, every protection assertion goes red. Triggers were restored by re-running the
real protection migration file verbatim; the suite then returns to green. Combined final run of both
suites: **`Test Files 2 passed (2)` · `Tests 26 passed (26)`**.

Cleanup: the suite's `afterAll` captures the live `pg_get_triggerdef`, drops only
`trg_benefit_tracking_deny_delete`, deletes its own rows, and restores the trigger from the captured
text (never re-typed). Verified: after the run the table held no suite rows.

---

## 7. Consequence found while verifying — flagged, not fixed (outside allowlist)

`tests/integration/routes/economics.missing-table-honesty.postgres.integration.test.ts` reproduces
the **demo gap** ("`benefit_tracking` does not exist") and asserts M08-H02 answers 503
`FINANCE_STORAGE_UNAVAILABLE` with `table: 'benefit_tracking'`. That premise no longer holds on a
migrated database.

Measured, not predicted, on this cluster:

- **As CI runs it today** (`db:migrate:strict`, then `vitest run tests/integration` with
  `RUN_DB_TESTS=1 MOCK_DB=false`, `.github/workflows/test-suite.yml:655-668`): all **three** tests
  already fail, and the cause is missing seed data, not this change — nothing creates the `an-1`
  analysis the file assumes (`H03: expected 0 to be greater than 0`, `H01: expected 404 …`,
  `H02: expected 400 to be 503`). The file is pre-existing red in that job; **this change does not
  break a green**.
- **With `an-1` seeded** (probe, then removed): **H01 and H03 pass** — `analysis_financials` and
  `analysis_financial_scenarios` are still absent — while **H02 fails with `expected true not to be
  true`**, i.e. the benefit write genuinely succeeded. That is the correct new behaviour; the
  assertion is what is now stale.

**Related, larger gap this exposes** (not in CO-3's scope): the same `isSqliteOnlyMigration()`
exclusion still leaves `analysis_financials`, `analysis_financial_scenarios` and
`initiative_financials` absent on a strict fresh install, and the same mounted router writes to all
three. CO-3 closed only `benefit_tracking`.

## 8. Residual risk on demo — the one check I could not run

The protection migration is already recorded in `schema_migrations` on demo, so it will **not**
re-run there, and migration 946 is a no-op because the table exists. Whether demo's triggers are
attached therefore depends on whether `benefit_tracking` existed at the moment
`20260809_finance_v3_e007_03…` was applied — which cannot be established from the repo. Note also
that the pg_dump baseline (`server/migrations-v2/001_baseline_20260413.sql:6872`) records a
*different, simpler* historical shape (`planned_benefits`/`actual_benefits`/`variance_percent`, no
`actual_cost_savings`), so demo's live shape should be read before anything is concluded about it.

Read-only check to run on demo (schema-qualified, per the `search_path` trap):

```sql
SELECT to_regclass('public.benefit_tracking')::text;
SELECT tgname FROM pg_trigger
 WHERE tgrelid = 'public.benefit_tracking'::regclass AND NOT tgisinternal;
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='benefit_tracking' ORDER BY ordinal_position;
```

If the triggers are absent there, re-applying the protection migration file is sufficient and
idempotent (proved in §6.2 — it was re-applied verbatim on this cluster and recreated both triggers).

---

## Verdict

| Question | Answer |
| --- | --- |
| Route chosen | **(a)** — create the table; the endpoint, its Stream C rewrite, and a frontend dashboard are all live |
| Table on strict fresh install | **Yes** — 626 migrations, 0 failed, 0 skipped |
| Protection triggers attached | **Yes** — both, on the migration-built table |
| UPDATE of `actual_*` on an existing row | **REJECTED** ×3, values unchanged, row still present |
| DELETE | **REJECTED**, row still present |
| Non-protected columns | **Still writable** — three UPDATEs succeeded, protected values intact |
| Stream C suite | **16/16 passed** on a database where the table now exists |
| Fan-in point 6c | **EVIDENCE_MISSING → PASS** |
