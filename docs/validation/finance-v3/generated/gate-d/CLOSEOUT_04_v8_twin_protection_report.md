# ROI-E007 CLOSEOUT CO-4 — schema-qualified ROI Actual protection (`v8.` twin)

**Work package:** CO-4, closing finding **F-1** of
`docs/validation/finance-v3/generated/gate-d/ROI_E007_FANIN_VERIFICATION_report.md`.
**Branch:** `codex/finance-v3-closeout-co4-v8twin`
**Date:** 2026-08-10

**Verdict: FIXED AND PROVEN.** The latent hole is closed, and closed *with* a red-before /
green-after proof rather than an assertion that the SQL looks right.

---

## 1. Confirmed starting state (measured, not assumed)

Every claim below was read off a **freshly migrated, ephemeral PostgreSQL 15 cluster** built for
this work package — full `server/scripts/migrate.postgres.ts` run, exit 0, `✅ Postgres migrations
complete` — with the CO-4 migration **absent**. Database `co4_base`.

### 1.1 Which physical instances exist

```sql
SELECT table_schema, table_name FROM information_schema.tables
 WHERE table_name IN ('v8_roi_realization_entries','roi_realized_values','benefit_tracking');
```

| table_schema | table_name |
| --- | --- |
| `public` | `roi_realized_values` |
| `public` | `v8_roi_realization_entries` |
| `v8` | `v8_roi_realization_entries` |

`benefit_tracking`: **zero rows returned — the table does not exist at all** on a fresh/strict
install. That is the already-documented `isSqliteOnlyMigration()` gap for
`067_economics_initiative_integration.sql`, not a new finding.

### 1.2 Where the protection triggers were actually attached

```sql
SELECT n.nspname, c.relname, t.tgname
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT t.tgisinternal AND c.relname IN (...);
```

| schema | table | trigger |
| --- | --- | --- |
| `public` | `roi_realized_values` | `trg_roi_realized_values_deny_delete` |
| `public` | `roi_realized_values` | `trg_roi_realized_values_deny_update` |
| `public` | `v8_roi_realization_entries` | `trg_v8_roi_realization_entries_deny_delete` |
| `public` | `v8_roi_realization_entries` | `trg_v8_roi_realization_entries_deny_update` |

**`v8.v8_roi_realization_entries`: no triggers. None.** Four triggers exist; all four sit on
`public`. F-1 confirmed exactly as reported.

Root cause, restated precisely: `20260809_finance_v3_e007_03_legacy_actual_protection.sql` writes
`CREATE TRIGGER ... ON v8_roi_realization_entries` — an **unqualified** identifier. The migration
session's `search_path` is `"$user", public`, so it resolves to `public` and stops. The `v8.` copy,
created by `20260719_baseline_gap.sql:11908` as `"v8"."v8_roi_realization_entries"`, was never
touched.

### 1.3 The hole, reproduced by hand on the unpatched database

Fixtures inserted **and confirmed by `SELECT` before the mutation** — see §4 for why that
confirmation is the whole point:

```
INSERT INTO v8.v8_kpi_definitions ...                                  -> INSERT 0 1
INSERT INTO v8.v8_roi_realization_entries ... realized_value = 500     -> INSERT 0 1
SELECT realized_value  (confirmation)                                  -> 500        [row exists]
UPDATE v8.v8_roi_realization_entries SET realized_value = 777777       -> UPDATE 1   [NO EXCEPTION]
SELECT realized_value                                                  -> 777777     [SILENTLY OVERWRITTEN]
DELETE FROM v8.v8_roi_realization_entries                              -> DELETE 1   [NO EXCEPTION]
SELECT count(*)                                                        -> 0          [ROW DESTROYED]
```

ROI Actual was silently overwritten *and* silently destroyed on a governed store.

### 1.4 Why this was latent rather than live

The runtime issues `SET search_path TO public, v8`
(`server/src/database/PostgresDatabase.ts:470,609`; `server/src/utils/queryHelpers.ts:242`), so
`public` resolves first and every unqualified application write lands on the protected copy. No
code anywhere references `v8.v8_roi_realization_entries` explicitly. The guarantee held for all
current callers — but it held because of a session variable, not because of the data. One
schema-qualified write, one reordering of `search_path`, or one `psql` session bypasses it.

---

## 2. Do the other protected tables have twins? (checked, not assumed)

| Store | Instances found | Twin? | Action |
| --- | --- | --- | --- |
| `v8_roi_realization_entries` | `public` **and** `v8` | **YES** | Both qualified and protected |
| `roi_realized_values` | `public` only | No | Re-attached qualified anyway; `v8.` slot probed so a future twin is picked up automatically |
| `benefit_tracking` | **none** (absent on fresh install) | No — and no `v8.benefit_tracking` in `20260719_baseline_gap.sql` either | Deliberately untouched (column-scoped protection, owned by a parallel work package). A read-only probe raises a `WARNING` if a twin ever appears |

**Context that makes this worth institutionalising:** of the **121** tables in the `v8` schema,
**119** have a same-named twin in `public`. The twinning is a systemic property of the baseline-gap
import, not a one-off accident. Any future protection trigger on a `v8_*` table must be written
schema-qualified from the start, or it will reproduce F-1.

---

## 3. The fix

`server/migrations/20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql`

- **Additive only.** Zero `ALTER`, zero DDL on the tables themselves, zero rows touched, no
  application code changed. Triggers only.
- **Schema-qualified everywhere.** Both the protection functions (`public.<fn>()`) and every
  `CREATE TRIGGER ... ON <schema>.<table>`, built with `format('%I.%I', ...)`. The result does not
  depend on `search_path` in any direction.
- **Per-instance `to_regclass()` probing.** Each of the four candidate slots (`public`/`v8` ×
  `v8_roi_realization_entries`/`roi_realized_values`) is probed individually. A missing instance
  skips **only itself** and says so with an explicit `RAISE NOTICE` naming it — never a silent
  skip, and never a skip of the whole block.
- **Refuses to report a hollow success.** If *no* instance is found, the migration raises instead
  of committing a protection that provably protects nothing.
- **Idempotent.** `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` before each
  `CREATE TRIGGER`. Trigger names are byte-identical to the 20260809 file's, so on the `public`
  copies this is a no-op replacement rather than a second, duplicate trigger.

Observed output on a fresh run:

```
NOTICE: ROI-E007 CO-4: protection attached (schema-qualified) to public.v8_roi_realization_entries [...]
NOTICE: ROI-E007 CO-4: protection attached (schema-qualified) to v8.v8_roi_realization_entries [...]
NOTICE: ROI-E007 CO-4: protection attached (schema-qualified) to public.roi_realized_values [...]
NOTICE: ROI-E007 CO-4: SKIPPED v8.roi_realized_values -- this physical instance does not exist ...
NOTICE: ROI-E007 CO-4 summary: 3 physical instance(s) protected, 1 absent instance(s) skipped.
NOTICE: ROI-E007 CO-4: no v8.benefit_tracking twin present (checked, not assumed) ...
```

**Idempotency proven:** re-applying the file to an already-migrated database produced **0 errors**
and left the trigger count at **6**, not 12.

---

## 4. The method requirement: confirmed fixture rows before every probe

The fan-in verification's first pass at this reported `UPDATE 0` on every store and **read as a
PASS**. It was not one. The fixture `INSERT`s had been rejected by the per-schema foreign key
`kpi_id -> v8_kpi_definitions`, so there was no row for a `FOR EACH ROW` trigger to fire on.

> **`UPDATE 0` is not evidence of protection. It is evidence of an empty table.**

Every probe in the new suite therefore encodes the confirmation as an *assertion*, not as setup:

1. `INSERT` the fixture, assert `rowCount === 1`.
2. `SELECT` it back out-of-band, assert the row **exists** with the expected value.
3. Only then attempt the mutation, require a rejection, **and** re-read out-of-band to prove the
   stored value / row count did not move.

"The statement errored" and "the data survived" are two different claims; both are checked
separately. The suite also runs under a deliberately **hostile `SET search_path TO v8, public`**
(v8 first) with every statement schema-qualified, so no probe can pass merely because `public`
happened to resolve first.

---

## 5. Red-before / green-after

New suite: `server/src/services/finance/canonical/__tests__/roiActualProtectionSchemaQualified.pg.test.ts`
(14 cases). Identical file, identical command, two databases.

### 5.1 RED — `co4_base`, fully migrated **without** the CO-4 migration

```
Test Files  1 failed (1)
     Tests  4 failed | 10 passed (14)
```

The four failures are exactly the `v8.` twin cases, and nothing else:

| Case | Result |
| --- | --- |
| coverage › every physical `v8_roi_realization_entries` instance carries both deny triggers | **FAIL** — `v8.v8_roi_realization_entries is missing append-only protection (found: none)` |
| coverage › every physical `roi_realized_values` instance carries both deny triggers | PASS |
| `public.v8_roi_realization_entries` › fixture inserted AND confirmed | PASS |
| `public.v8_roi_realization_entries` › UPDATE rejected, value unmoved | PASS |
| `public.v8_roi_realization_entries` › non-ROI UPDATE rejected | PASS |
| `public.v8_roi_realization_entries` › DELETE rejected, row survives | PASS |
| **`v8.v8_roi_realization_entries` › fixture inserted AND confirmed** | **PASS** ← the row provably existed |
| **`v8.v8_roi_realization_entries` › UPDATE rejected, value unmoved** | **FAIL** — overwrite went through |
| **`v8.v8_roi_realization_entries` › non-ROI UPDATE rejected** | **FAIL** |
| **`v8.v8_roi_realization_entries` › DELETE rejected, row survives** | **FAIL** — `command: "DELETE", rowCount: 1` |
| `public.roi_realized_values` › fixture inserted AND confirmed | PASS |
| `public.roi_realized_values` › UPDATE rejected, value unmoved | PASS |
| `public.roi_realized_values` › non-ROI UPDATE rejected | PASS |
| `public.roi_realized_values` › DELETE rejected, row survives | PASS |

The bolded pairing is what makes this a real red: the fixture case **passed**, so the three
failures below it are failures of the *trigger*, not of the fixture. This is precisely the
distinction the original `UPDATE 0` probe could not make.

### 5.2 GREEN — `co4_full`, fresh cluster, full migration run **including** CO-4

Trigger state after migration — six triggers, the `v8.` twin now covered:

| schema | table | trigger |
| --- | --- | --- |
| `public` | `roi_realized_values` | `..._deny_delete`, `..._deny_update` |
| `public` | `v8_roi_realization_entries` | `..._deny_delete`, `..._deny_update` |
| **`v8`** | **`v8_roi_realization_entries`** | **`..._deny_delete`, `..._deny_update`** |

```
Test Files  1 passed (1)
     Tests  14 passed (14)
```

All 14 green, including all four previously-red `v8.` twin cases.

Rejection now raised by the twin:

```
ERROR:  v8_roi_realization_entries is append-only under ROI-E007 governance; UPDATE not permitted
(row entry-co4-v8-...) -- corrections must be new rows, reconciliation must open a row in
rvn_roi_finance_reconciliations, never UPDATE realized_value here
CONTEXT:  PL/pgSQL function v8_roi_realization_entries_deny_mutation() line 3 at RAISE
```

### 5.3 Negative control — the suite cannot go green without touching a database

Run with the gate env vars omitted:

```
Test Files  1 skipped (1)
     Tests  14 skipped (14)
```

**SKIPPED, not passed.** The known `RUN_DB_TESTS` / `MOCK_DB` false-green trap does not apply to
this file.

---

## 6. Regression

`server/src/services/finance/canonical/__tests__/` in full, against `co4_full`:

```
Test Files  20 passed (20)
     Tests  284 passed (284)
```

Zero failures. 20 files = the 19 pre-existing suites plus the new one.

Widened to the whole of `server/src/services/finance/`, to compare directly against the fan-in
verification's last measurement (452/452):

```
Test Files  28 passed (28)
     Tests  466 passed (466)
```

**466 = 452 + 14.** The baseline is intact to the test and the delta is exactly the new suite —
nothing was displaced, weakened, or quietly re-scoped. In particular the pre-existing
`benefit_tracking` route/trigger suites (`roiFinanceReconciliationAdapter.pg.test.ts`) stay green,
confirming the CO-4 migration does not disturb the store owned by the parallel work package.

---

## 7. Reproduction

```bash
# ephemeral PG15 (NOT @16 — no pgvector there, migrations break)
LC_ALL=C initdb -D "$PGDATA" -U postgres --encoding=UTF8 --locale=C
LC_ALL=C pg_ctl -D "$PGDATA" -o "-p 55000 -k /tmp/co4pg -c listen_addresses=127.0.0.1" start

createdb -h 127.0.0.1 -p 55000 -U postgres co4_full
DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:55000/co4_full \
  npx tsx server/scripts/migrate.postgres.ts

cd server
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:55000/co4_full \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/roiActualProtectionSchemaQualified.pg.test.ts \
    --no-file-parallelism
```

For the red run, migrate a second database with
`server/migrations/20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql` removed.

`LC_ALL=C` is required on **both** `initdb` and `pg_ctl start` — omitting it on the start line
produces "postmaster became multithreaded".

---

## 8. Residual items (not in CO-4 scope)

1. **`benefit_tracking` protection is still attached unqualified** by the 20260809 migration. It
   has no twin today and does not exist at all on a fresh install, so there is nothing to exploit —
   but the *pattern* is the same one that produced F-1. The CO-4 migration warns if a twin appears.
   Owner: the parallel `benefit_tracking` closeout work package.
2. **119 of 121 `v8` tables are twinned in `public`.** Any future append-only / governance trigger
   on a `v8_*` table must be schema-qualified from the start. Worth a lint or a checklist item
   rather than rediscovering it per-table.
3. **`067_economics_initiative_integration.sql` is still excluded on fresh installs** by
   `migrate.postgres.ts`'s blanket `isSqliteOnlyMigration()` `<500` rule, so `benefit_tracking`
   is absent from any freshly built schema. Pre-existing, already flagged in the Stream A migration
   report; unchanged by this work package.
