# ROI-E007 CLOSEOUT CO-6 — finding F-1: `benefit_tracking` is unprotected on the UPGRADE path

**Date:** 2026-08-10
**Branch:** `codex/finance-v3-closeout-co6-f1` (worktree `/Users/piotrwisniewski/consultify-wt/closeout-co6-f1`, tip of the CLOSEOUT fan-in)
**Status:** CLOSED — fix implemented, red-before / green-after proven physically, fresh-install path re-verified, regression green.

---

## 1. The defect, in one paragraph

`20260809_finance_v3_e007_03_legacy_actual_protection.sql` wraps its whole `benefit_tracking`
block — the protection **function** as well as both **triggers** — in
`IF to_regclass('public.benefit_tracking') IS NOT NULL THEN … ELSE RAISE NOTICE … END IF`.
On a database migrated **before** `946_benefit_tracking_fresh_install.sql` existed, that guard took
the ELSE branch. `RAISE NOTICE` is not an error, so the runner recorded the migration
`status = 'success'`, and `migrate.postgres.ts` re-runs only migrations whose recorded status is
**not** `'success'`:

```ts
const pending = filtered.filter((m) => { const a = applied.get(m.filename); return !a || a.status !== 'success'; });
```

946 is then applied on top and creates the table. Nothing re-evaluates the guard. The table ends up
existing with **zero triggers and no protection function at all** — a recorded ROI Actual can be
overwritten by a plain `UPDATE`, which is exactly the guarantee the ROI-E007 epic exists to make
physically impossible.

**Affected population:** every database whose history recorded `20260809_…_e007_03` as success while
`benefit_tracking` did not yet exist — strict/fresh installs built between the landing of 20260809
and the landing of 946 (CI databases, ephemeral verification clusters, the verification database of
the previous fan-in). **Not** demo/dev/prod: there `benefit_tracking` was created by
`PostgresDatabase.ts`'s own `initDb()` long before 20260809 ran, so the guard took its THEN branch.

## 2. The fix

`server/migrations/20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql` — additive,
idempotent, schema-qualified.

* **Additive by necessity.** Neither `946_*` nor `20260809_…_e007_03` may be edited: both are already
  recorded as applied (with their checksums) on other databases, so an edit would change nothing
  there while invalidating the recorded checksums. Only a *new* migration reaches the databases that
  are already in the broken state.
* **Ordering.** `2026-08-22` is a phase-1 (DATED) prefix. Phase 1 runs entirely after phase 0
  (NUMBERED), so the file sorts after 946 and after every earlier dated migration, including
  `20260809_…_e007_03` and `20260810_…_e007_04`.
* **Function ownership is not duplicated.** The existing function
  `public.benefit_tracking_deny_actual_overwrite()` is probed with
  `to_regprocedure('public.benefit_tracking_deny_actual_overwrite()')` and **reused as-is** when
  present (no `CREATE OR REPLACE`, no second differently-named function). It is created — verbatim
  from 20260809, byte-identical body — only on the F-1 databases, where it does not exist at all
  because it lives inside the skipped branch.
* **`CREATE TRIGGER … IF NOT EXISTS` does not exist in Postgres**, so each trigger is attached with
  `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, under names byte-identical to 20260809's
  (`trg_benefit_tracking_deny_actual_overwrite`, `trg_benefit_tracking_deny_delete`). Re-running
  therefore *replaces*, never duplicates.
* **Schema-qualified** (lesson from CO-4): every identifier names its schema, and each physical
  instance is probed with `to_regclass()` individually, so an absent instance skips only itself.
* **Post-condition self-check:** after attaching, the migration reads `pg_trigger` back and raises if
  either trigger is not visible — "the DDL ran" and "the protection is there" are separate claims.
* **Explicit no-op, not silence:** if no physical `benefit_tracking` exists anywhere, the migration
  emits a `RAISE WARNING` naming the situation and what to do about it (rather than failing the whole
  run, which would be worse for a deployment that genuinely has no economics tables).

### 2.1 Twin check (asked for explicitly)

`benefit_tracking` has **no twin in another schema** — checked, not assumed:

* Repo-wide, `CREATE TABLE … benefit_tracking` exists in exactly three places:
  `067_economics_initiative_integration.sql:62` (unqualified),
  `946_benefit_tracking_fresh_install.sql:87` (unqualified),
  `server/migrations-v2/001_baseline_20260413.sql:6872` (`public.benefit_tracking`).
  There is no `v8.benefit_tracking` anywhere, including in `20260719_baseline_gap.sql`, which is what
  imported the `v8.` twins of the other ROI stores.
* Physically, on the freshly migrated cluster used for this work package:

```
SELECT table_schema FROM information_schema.tables WHERE table_name='benefit_tracking';
 table_schema | table_name
--------------+------------------
 public       | benefit_tracking
(1 row)

SELECT to_regclass('v8.benefit_tracking');  ->  NULL
```

A `v8` slot is probed anyway (same idiom CO-4 uses for `roi_realized_values`), so a future twin is
protected automatically on the next run instead of being silently unguarded — and CO-4's standing
`RAISE WARNING` twin probe stops being the only thing that would notice.

---

## 3. Are the other protected tables vulnerable to the same pattern? **No — with proof**

`20260809_…_e007_03` also protects `roi_realized_values` and `v8_roi_realization_entries`. Their
trigger DDL in that file is **not guarded** — `CREATE TRIGGER … ON roi_realized_values` executes
unconditionally. So on a database where either table was missing, the migration would have **raised**
(`relation … does not exist`) and been recorded `failed` (strict) or `skipped` (`--safe`) — never
`'success'`. In both of those states the runner's pending filter re-runs it on the next pass.
**"Recorded as success" therefore proves both tables existed at that moment**; there is no
silent-skip branch for them to fall through. This proof does not depend on file ordering at all.

Corroborating ordering evidence (belt and braces): `roi_realized_values` is created by
`565_kpi_time_series_roi_attribution_finance.sql` (phase 0, version ≥ 500, not excluded by
`isSqliteOnlyMigration()`), and `v8_roi_realization_entries` by `20260323_v8_results_roi.sql` with the
`v8.` twin from `20260719_baseline_gap.sql` — all strictly before `20260809` in both phase order and
calendar order. No other producer of either table exists in the repo.

Measured on the F-1 database itself (the one where `benefit_tracking` was unprotected), all six
expected triggers were present on all three physical instances:

```
                tbl                |                   tgname
-----------------------------------+--------------------------------------------
 public.roi_realized_values        | trg_roi_realized_values_deny_delete
 public.roi_realized_values        | trg_roi_realized_values_deny_update
 public.v8_roi_realization_entries | trg_v8_roi_realization_entries_deny_delete
 public.v8_roi_realization_entries | trg_v8_roi_realization_entries_deny_update
 v8.v8_roi_realization_entries     | trg_v8_roi_realization_entries_deny_delete
 v8.v8_roi_realization_entries     | trg_v8_roi_realization_entries_deny_update
```

They are therefore **not** re-attached by the new migration (trigger ownership stays with
20260809/CO-4). Instead the migration ends with a **read-only audit block** that walks every physical
instance of those two tables and raises a `WARNING` if any of them carries fewer than two deny
triggers, so this class of defect cannot go unnoticed a third time. The same invariant is asserted
executably in section F of the new test suite.

---

## 4. Physical proof — the exact upgrade scenario, reproduced end to end

Environment: ephemeral PostgreSQL **15.15** (Homebrew `postgresql@15`), `initdb` and `pg_ctl start`
both under `LC_ALL=C`, `lsof`-checked port **55000**, own data directory and socket directory,
dropped afterwards. Never 5432 / 28711 / 52824, never demo/staging/prod.

The three migration-runner stages used symlink directories (`--dir`) so that no repository file was
moved or edited to stage the history.

### Stage 1 — a database whose history contains 20260809 but not 946

```
tsx server/scripts/migrate.postgres.ts --dir <all migrations EXCEPT 946 and the new CO-6 file>
Applying migrations: 627 … ✅ Postgres migrations complete   (strict, no --safe, 0 failures, exit 0)
```

```
SELECT table_schema, table_name FROM information_schema.tables WHERE table_name='benefit_tracking';
(0 rows)                                          <- table absent, as on the historical install

SELECT filename, status FROM schema_migrations WHERE filename LIKE '%e007%';
 20260809_finance_v3_e007_03_legacy_actual_protection.sql            | success   <- never re-runs
 20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql  | success

SELECT count(*) FROM pg_proc WHERE proname='benefit_tracking_deny_actual_overwrite';  -> 0
```

### Stage 2 — 946 lands on top: the table appears, **still unprotected** (this is F-1, RED)

```
tsx server/scripts/migrate.postgres.ts --dir <all EXCEPT the new CO-6 file>
Applying migrations: 1
→ 946_benefit_tracking_fresh_install.sql
✅ Postgres migrations complete
```

```
SELECT to_regclass('public.benefit_tracking');                        -> benefit_tracking
SELECT count(*) FROM pg_trigger … WHERE relname='benefit_tracking';   -> 0
SELECT count(*) FROM pg_proc WHERE proname='benefit_tracking_deny_actual_overwrite'; -> 0
```

Silent overwrite, measured (`scratchpad/red_evidence.txt`):

```
INSERT INTO public.benefit_tracking (id, initiative_id, organization_id, period_start, period_end,
                                     actual_cost_savings)
VALUES ('bt-f1-red','init-f1','org-f1', now(), now(), 4200);          INSERT 0 1
SELECT id, actual_cost_savings …                                       bt-f1-red | 4200

UPDATE public.benefit_tracking SET actual_cost_savings = 9999999 …;    UPDATE 1        <- NO ERROR
SELECT id, actual_cost_savings …                                       bt-f1-red | 9.999999e+06

DELETE FROM public.benefit_tracking WHERE id='bt-f1-red';              DELETE 1        <- NO ERROR
SELECT count(*) …                                                      0
```

### Stage 3 — the CO-6 migration lands: GREEN

```
tsx server/scripts/migrate.postgres.ts --dir <all migrations>
Applying migrations: 1
→ 20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql
✅ Postgres migrations complete
```

```
           tbl           |                   tgname                   |   ev
-------------------------+--------------------------------------------+--------
 public.benefit_tracking | trg_benefit_tracking_deny_actual_overwrite | UPDATE
 public.benefit_tracking | trg_benefit_tracking_deny_delete           | DELETE
```

Row-level probes on a **confirmed** row (`scratchpad/green_evidence.txt`) — every probe inserts,
re-reads the row out of band, and only then mutates, because `UPDATE 0` on an empty table is not
evidence of protection:

| probe | result |
|---|---|
| `INSERT … actual_cost_savings = 4200` | `INSERT 0 1`, read-back `4200` |
| `UPDATE … actual_cost_savings = 9999999` | **ERROR** `benefit_tracking.actual_* is append-only under ROI-E007 governance…` |
| re-read after rejected UPDATE | `4200` — **unchanged** |
| `DELETE …` | **ERROR** `benefit_tracking is append-only for actual_* … DELETE not permitted` |
| re-read after rejected DELETE | row still present, `4200` |
| `UPDATE … planned_cost_savings = 7777, overall_variance_percent = 42, verification_status='verified'` | `UPDATE 1` — `7777 / 42 / verified`, `actual_cost_savings` still `4200` |

### Idempotence

The migration file was applied **two further times** directly with `psql -v ON_ERROR_STOP=1`. Both
runs committed, both emitted
`public.benefit_tracking_deny_actual_overwrite() already exists … reused as-is, not redefined.`,
and afterwards:

```
 nspname |     relname      | count
---------+------------------+-------
 public  | benefit_tracking |     2      <- still exactly two, not four or six
```

Existing rows were untouched (`bt-f1-green | 4200`).

---

## 5. Fresh install unaffected — no double triggers

Two independent full runs from an empty database on the same cluster:

| database | migration set | triggers on `benefit_tracking` |
|---|---|---|
| `co6_fresh_base` | **without** the CO-6 file (pre-change baseline) | **2** |
| `co6_fresh` | **with** the CO-6 file | **2** |

Both runs strict (no `--safe`), 0 failed migrations, exit 0. Trigger definitions on the fresh install
are the 20260809 ones (`EXECUTE FUNCTION benefit_tracking_deny_actual_overwrite()`), replaced
in place by identically-named triggers — the count is identical before and after the change, so the
fresh-install path gained nothing to clean up and lost nothing.

---

## 6. Tests

New suite: `server/src/services/finance/canonical/__tests__/benefitTrackingUpgradeProtection.pg.test.ts`
(15 tests). It does not merely assert the end state — it **recreates the F-1 catalog state**
(drops both triggers on every physical instance, drops the protection function), **proves that state
is genuinely unprotected** (overwrite and delete both succeed), then applies the migration from disk
and proves the same operations are rejected, that unprotected columns still move, and that a second
and third application leave exactly two triggers per instance. Section F asserts the sibling-store
invariant from section 3 on the live catalog.

Safety: gated on `RUN_DB_TESTS=1` **and** `MOCK_DB=false` **and** a `postgres…` `DATABASE_URL`, and —
because it temporarily removes protection — it additionally refuses any non-loopback host. `afterAll`
re-applies the migration unconditionally and removes only this run's rows (capturing
`pg_get_triggerdef`, dropping that one trigger, deleting, restoring the captured definition verbatim).

### Results

| run | result |
|---|---|
| new suite vs fresh-install DB (`co6_fresh`) | **15 passed** |
| new suite vs the F-1 upgrade DB (`co6_upgrade`) | **15 passed** |
| new + CO-3 + CO-4 protection suites vs upgrade DB | **3 files, 39 passed** |
| **regression:** whole `server/src/services/finance/canonical/__tests__` | **22 files, 309 passed, 0 failed, 0 skipped** (was 21 files / 294 before this work package; the delta is exactly the 15 new tests) |

### Negative controls (the green is not free)

1. **Gate off** (no `RUN_DB_TESTS` / `MOCK_DB`): `1 skipped (1) · 15 skipped (15)` — the suite reports
   SKIPPED, never a false green on a database it never touched.
2. **Neutered migration**: the migration file was temporarily replaced with `BEGIN; COMMIT;` and the
   suite re-run against the same database → **9 of 15 tests failed** (every protection assertion in
   blocks D and E). The file was then restored and byte-compared against its backup (`IDENTICAL`).
   The suite therefore fails when the fix is absent, which is the only thing that makes its passing
   meaningful.

### Reproduce

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
npx vitest run --config vitest.config.ts \
  src/services/finance/canonical/__tests__/benefitTrackingUpgradeProtection.pg.test.ts \
  --no-file-parallelism            # run from the `server/` directory
```

---

## 7. Files changed

| file | kind |
|---|---|
| `server/migrations/20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql` | new, additive migration |
| `server/src/services/finance/canonical/__tests__/benefitTrackingUpgradeProtection.pg.test.ts` | new test suite |
| `docs/validation/finance-v3/generated/gate-d/CLOSEOUT_06_F1_upgrade_protection_report.md` | this report |

`946_benefit_tracking_fresh_install.sql` and `20260809_finance_v3_e007_03_legacy_actual_protection.sql`
were **not** modified — they are already applied elsewhere and the repair had to be additive.
No application code changed.
