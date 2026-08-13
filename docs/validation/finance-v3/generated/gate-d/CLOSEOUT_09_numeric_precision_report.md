# CLOSEOUT CO-9 — statement money stored as `real`, converted to `numeric`

**Branch** `codex/finance-v3-closeout-co9-numeric` · **Date** 2026-08-10 · **Engine** PostgreSQL 15.15 (Homebrew, ephemeral local cluster)
**Status** FIXED for the statement-ingestion chain · **LARGER FINDING REPORTED** (40 further money columns, out of scope here)

---

## 1. The defect

`financial_statement_values.value` — the column holding the actual monetary line values of an
ingested client financial statement — is `real`, i.e. IEEE-754 **binary32** with a 24-bit
significand. Read from `information_schema` on a freshly migrated database, not from a migration
file:

```
 table_name                  | column_name | data_type | numeric_precision
 financial_statement_values  | value       | real      | 24
```

Integers are exact in binary32 only up to **2^24 = 16 777 216**. Above that, stored values snap to
the nearest representable float:

```
revenue 1 227 799 000 PLN  ->  stored 1 227 799 040 PLN   (+40 PLN)
```

No error, no warning, no log entry. Every Apator figure exercised to date fits, because that
statement is reported in **thousands**. The first client statement filed in **units** loses money
silently, in the ledger that feeds ratios, reconciliation, valuation and the board deck.

### Provenance

| Question | Answer |
|---|---|
| Which migration creates it? | `server/migrations/20260316_financial_statement_packs.sql:78` (`value REAL`); identically in the older `567_financial_statements_ratios.sql:49` |
| Does any later migration change it? | **No.** `20260317_finance_v1_canonical_layer.sql:84`, `20260803_fin005_statement_ready_contract.sql:66` and `20260719_baseline_gap.sql` all only ADD columns |
| Schema twins? | **No.** Only `public`. (Checked because CO-4 found `public`/`v8` twins for the ROI tables.) |

---

## 2. Full census of `real` / `double precision` in financial tables

Scanned on a freshly migrated database (1455 tables) across `financial_*`, `finance_*`,
`analysis_*`, `initiative_financials`, `benefit_tracking*`, `roi_*`, `v8_*`.

**This is not one column. It is 82.** Repo-wide the count is **438 `real` + 13 `double precision`**
against 224 existing `numeric`.

Of the 82 in financial tables, CO-9 converts **6**; **40 money-like columns remain**, and 36 are
score/ratio columns where float is adequate.

### 2a. Converted by this closeout (6)

| Table | Column | Was | Now |
|---|---|---|---|
| `financial_statement_values` | `value` | real | **numeric** |
| `financial_statement_value_evidence` | `contribution_value` | real | **numeric** |
| `financial_statement_validations` | `expected_value` | real | **numeric** |
| `financial_statement_validations` | `actual_value` | real | **numeric** |
| `financial_statement_validations` | `difference` | real | **numeric** |
| `financial_statement_validations` | `tolerance` | real | **numeric** |

### 2b. Still `real`, SAME DEFECT CLASS — money in a binary float (40)

These are out of scope for CO-9 and need their own closeout. Each carries the identical
2^24 hazard.

| Subsystem | Columns |
|---|---|
| `benefit_tracking` | `planned_cost_savings`, `planned_revenue_increase`, `planned_productivity_gains`, `actual_cost_savings`, `actual_revenue_increase`, `actual_productivity_gains` |
| `roi_assumptions` | `capex`, `opex_annual`, `expected_npv`, `baseline_revenue`, `baseline_cost`, `expected_revenue_delta`, `expected_cost_delta` |
| `roi_realized_values` | `realized_revenue_delta`, `realized_cost_delta`, `realized_savings` |
| `roi_evidence` | `value` |
| `financial_model_validations` | `expected_value`, `actual_value`, `difference` |
| `financial_model_events` | `amount` |
| `financial_model_outputs` | `value` |
| `financial_allocations` | `amount` |
| `financial_variance_alerts` | `planned_amount`, `actual_amount` |
| `financial_roi_links` | `realized_value` |
| `finance_post_investment_reviews` | `projected_value`, `realized_value`, `variance` |
| `v8_kpi_definitions` | `baseline_value`, `target_value`, `current_value` |
| `v8_kpi_finance_reconciliations` | `projected_value`, `realized_value`, `deviation_absolute` |
| `v8_roi_realization_entries` | `realized_value` |
| `v8_unreconciled_delta_escalations` | `delta_magnitude` |
| `v8_deviation_records` | `observed_actual`, `observed_target` |
| `v8_health_signals` | `value` |

> `v8_roi_realization_entries.realized_value` and `roi_realized_values.*` are the append-only
> ROI Actual stores protected by ROI-E007/CO-4. Their governance guarantees the value cannot be
> *overwritten* — it does not guarantee the value was stored *exactly*. Worth sequencing early.

### 2c. Deliberately left as `real` (36) — scores and ratios

`confidence`, `mapping_confidence`, `weight`, `overall_confidence`, `readiness_score`, `score`,
`pack_readiness_score`, `eval_score`, `coverage_pct`, `ratio_value`, benchmark `p25`/`median`/
`p75`/`target_min`/`target_max`, and every `*_pct` / `*_percent`. These are 0..1 / 0..100
quantities; float4's ~7 significant digits exceed what such a number means. Converting them
would multiply the driver blast radius (§4) for zero precision benefit. Pinned by test so a
later "convert everything" sweep must argue with an assertion.

---

## 3. The trap: the obvious migration is itself a data-corruption bug

**The naive `ALTER TABLE ... ALTER COLUMN value TYPE numeric` destroys more data than the defect
it fixes.** Postgres' built-in `float4 -> numeric` cast (`float4_numeric`) formats with `%.*g` at
`FLT_DIG = 6` — six significant digits. Measured on PG 15.15:

| stored `real` | bare `ALTER` → numeric | `::text::numeric` (used here) |
|---|---|---|
| `12345.67` | `12345.7` ← **grosze destroyed** | `12345.67` |
| `1234567.89` | `1234570` ← **7.89 PLN + 2 digits gone** | `1234567.9` |
| `1227799000` | `1227800000` ← **+1000 PLN** | `1227799000` |

Casting through `text` uses `float4out`, which emits the shortest decimal that **round-trips** to
the same float4 bits — exactly the number the application reads today, since node-pg receives that
same text form over the wire. The third option, `::float8::numeric`, is also wrong for this
purpose: it expands binary noise into fake precision (`12345.67` → `12345.669921875`).

`float4out`'s digit count is governed by `extra_float_digits`, a **session GUC**. Shortest-round-trip
requires ≥ 1 (PG 12+ default is 1, but a pooler, `PGOPTIONS`, or an older client can set 0 or −1 and
silently restore the 6-digit truncation). The migration therefore **pins it explicitly** and resets
it afterwards, so the outcome cannot depend on session state.

*This was caught by running the migration, not by reading it.*

---

## 4. Consumer audit — does anything assume `number`?

**Yes, one — and it is fixed in this closeout.**

node-pg returns `real`/`double precision` (OID 700/701) as a JS **number**, but `numeric`
(OID 1700) as a JS **string**. This repo registers **no type parser at all**
(`grep -rn setTypeParser server/src src` → no match); the same trap is already documented for
DATE/OID 1082 in `financePeriodFormat.ts:9` and `roiCalculationRunCommands.ts:86`.

Every read path of `financial_statement_values.value` was audited before the migration was written:

| Consumer | Handling | Verdict |
|---|---|---|
| `financeStatementAnalyticsService.ts:225,281,292,329` | `Number(row.value \|\| 0)` | safe |
| `financeStatementTrendService.ts:319` | `Number(r.value ?? 0)` | safe |
| `ratioAnalysisService.ts:926,1049` | `Number(row.value \|\| 0)` | safe |
| `financialAnalysisService.ts:1008,1093` | `Number(o.value \|\| 0)` | safe |
| `financialModelingService.ts:364,491` | `numberOrZero(row.value)` | safe |
| `realizedValueReconciliationService.ts:196` | `Number(r.statementValue)` | safe |
| `financialStatementService.ts:6956` (`validateStatement`) | `Number(line.value \|\| 0)` | safe |
| `financialStatementReadService.ts:239` | `Number(value.value \|\| 0)` | safe |
| `finance-statements.routes.ts:3076` | `Number(head.value \|\| 0)` | safe |
| `initiative/financialsGrounding.ts:132` | branches on `typeof raw === 'string'` explicitly | safe |
| `FinancialStatementWorkspace.tsx:1033` | `Number(value.value \|\| 0).toLocaleString(...)` | safe |
| `FinancialStatementPackWorkspace.tsx:170-180` | `Number(validation.expected_value)` etc. | safe |
| **`routes/v8/finance.routes.ts:3272`** | **`SELECT fsv.*` piped raw into `addRowsSheet()` → ExcelJS** | **BROKEN → fixed** |

The one break is real and concrete: `addRowsSheet()` writes each field into an ExcelJS cell
verbatim (`finance.routes.ts:183-191`, no coercion). A string lands as a **text cell**, so the
exported ratio workbook would show amounts as "number stored as text" and every downstream `SUM`
in that sheet would silently evaluate to 0. Fixed at the query boundary with an explicit
`Number()` map and a comment naming the cause.

One further coupling justified widening scope beyond the single commissioned column:
`financialStatementValueWriteService.ts:253,265` copies `row.value` **verbatim** into
`financial_statement_value_evidence.contribution_value`. Had that stayed `real`, the amount would
have been re-quantized one hop later and the bug would have survived the fix.

---

## 5. Measured cost of the rewrite

`ALTER TABLE ... ALTER COLUMN ... TYPE` rewrites the table and holds **ACCESS EXCLUSIVE** for the
duration — concurrent reads *and* writes block. Measured for the whole migration file (all three
tables), local NVMe, warm cache, PG 15.15:

| Fixture | `financial_statement_values` size | Wall time |
|---|---|---|
| 100k fsv + 20k fsve + 20k fsval | 19 MB | **0.73 s** |
| 500k fsv + 100k fsve + 100k fsval | 94 MB | **2.1 – 4.5 s** across runs |

The migration groups each table's columns into a **single** `ALTER TABLE` with multiple
`ALTER COLUMN` clauses, so each table is rewritten once. Issuing one statement per column rewrote
`financial_statement_validations` four times and measured **3.95 s vs 2.10 s** on the same fixture —
roughly 2× the lock window for identical output.

**Deploy guidance:** at demo's current statement volumes this is a sub-second operation, but
production I/O is slower than a warm local NVMe and the lock is total. Run it in a short
maintenance window, not against live ingestion traffic.

---

## 6. What this migration does NOT do

**It does not repair historical data.** A value already snapped to `1 227 799 040` on write is
snapped; the information is gone and no `ALTER` can invent it back. The conversion **preserves**
exactly what is currently stored and guarantees every write from this point on is exact. Rows
ingested before this migration must be **re-ingested from source** if bit-exactness matters for
them. A dedicated test pins this fact so the migration is never mistaken for a data repair.

---

## 7. Evidence

Fresh cluster: `initdb` + `pg_ctl start` under `LC_ALL=C`, short socket dir, port 55317
(lsof-checked), `RUN_DB_TESTS=1 MOCK_DB=false`.

| Check | Result |
|---|---|
| Fresh install from zero (`migrate.postgres.ts`, exit 0, 1455 tables) | all 6 columns `numeric`; `confidence` still `real` |
| Migration idempotency (second run) | `NOTICE: CO-9: no-op — every targeted statement money column is already numeric` |
| Value preservation, 500 000 rows compared semantically | **500 000 identical / 0 changed** |
| New suite `statementMoneyNumericPrecision.pg.test.ts` | **23/23 pass** |
| **Negative control** — same suite without the migration | **14 of 23 RED**, incl. the headline production-column round-trip |
| Regression `finance/canonical/__tests__/` | 22 files, **317/317** |
| Regression `finance/` | 30 files, **499/499** (476 baseline + 23 new) |
| Consumer regression `demo/__tests__/` + finance seed scripts | 348/358 pass, 9 skipped, **1 pre-existing failure** (below) |

### Pre-existing failure, unrelated to CO-9

`src/scripts/__tests__/fin005SeedAtelierFinance.test.ts:392` —
*"4b. refuses a production-looking target before consulting anything else"* expects
`/matches a forbidden production/` but the guard raises the WP-A04 message
(*"points to the production database host ... Refusing to start"*). The guard **fires correctly**;
only the test's expected message is stale. **Proven pre-existing**: it fails identically against
the *unmigrated* database.

---

## 8. Recommended follow-ups

1. **CO-10 (high):** convert the 40 remaining money columns in §2b. Same defect, same hazard,
   different subsystems — each needs its own consumer audit, and each must use the
   `::text::numeric` cast, not the naive one.
2. **Consider a global `pg.types.setTypeParser(1700, ...)` decision.** With 224 `numeric` columns
   already present and more coming, the repo relies on every individual call site remembering to
   coerce. That is a standing trap; it should be a deliberate, documented choice either way.
3. **Fix the stale assertion** in `fin005SeedAtelierFinance.test.ts:392`.
