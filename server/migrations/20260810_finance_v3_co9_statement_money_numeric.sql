-- Finance v3 / CLOSEOUT CO-9 — statement money columns: `real` (float4) -> `numeric`.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- `financial_statement_values.value` holds the actual monetary line values of an ingested
-- client financial statement. It was created as `REAL` in
-- `server/migrations/20260316_financial_statement_packs.sql:78` (and identically in the older
-- `567_financial_statements_ratios.sql:49`), and NO later migration ever changed it. Confirmed
-- physically against a freshly migrated Postgres 15 database, from `information_schema`, not
-- from the migration files:
--
--     table_name                  | column_name | data_type | numeric_precision
--     financial_statement_values  | value       | real      | 24
--
-- `real` is IEEE-754 binary32: a 24-bit significand. Integers are represented EXACTLY only up
-- to 2^24 = 16 777 216. Above that the representable values thin out, and the stored number is
-- silently snapped to the nearest one. Every Apator figure exercised so far happens to fit,
-- because that statement is reported in THOUSANDS. A statement reported in UNITS does not:
--
--     revenue 1 227 799 000 PLN  ->  stored as 1 227 799 040 PLN   (+40 PLN, silently)
--
-- Nothing errors, nothing warns, nothing is logged. The number the client gave us is not the
-- number we keep. That is a silent loss of precision on client financial data, and it is
-- unacceptable in the ledger that feeds ratios, reconciliation, valuation and the board deck.
--
-- SCOPE — WHY THESE SIX COLUMNS AND NOT MORE
-- ------------------------------------------
-- This migration converts the monetary columns of the STATEMENT INGESTION CHAIN, i.e. the set
-- of columns that hold the SAME currency amounts, in the SAME unit, and are compared against
-- or copied from each other:
--
--   financial_statement_values.value                    -- the amount itself
--   financial_statement_value_evidence.contribution_value
--        -- copied VERBATIM from `value` on the write path
--        -- (server/src/services/financialStatementValueWriteService.ts:253,265 -> `row.value`).
--        -- Leaving it `real` would re-quantize the amount one hop later and re-open the bug.
--   financial_statement_validations.expected_value
--   financial_statement_validations.actual_value
--   financial_statement_validations.difference
--   financial_statement_validations.tolerance
--        -- the balance-sheet / roll-forward checks compare these DIRECTLY against `value`.
--        -- A `numeric` amount checked against a `real` tolerance is a half-fix: the float
--        -- error simply moves from the value to the threshold it is judged by.
--
-- DELIBERATELY NOT CONVERTED (same table family, different semantics):
--   `confidence`, `mapping_confidence`, `weight`, `overall_confidence`, `readiness_score`,
--   `score`, `pack_readiness_score`, and every `*_pct` / `*_percent` column. These are scores
--   and ratios on 0..1 / 0..100. float4 carries ~7 significant digits, which is far more than
--   such a quantity means; converting them would multiply the driver-type blast radius (see
--   below) for zero precision benefit.
--
-- DELIBERATELY OUT OF SCOPE (reported, not fixed here — separate closeout):
--   The same `real`-for-money defect exists in ~60 further columns across other finance
--   subsystems: benefit_tracking (planned_/actual_ cost_savings, revenue_increase,
--   productivity_gains), roi_assumptions (capex, opex_annual, expected_npv, baseline_revenue,
--   baseline_cost, expected_revenue_delta, expected_cost_delta), roi_realized_values,
--   roi_evidence.value, financial_allocations.amount, financial_model_events.amount,
--   financial_model_outputs.value, financial_model_validations.*, financial_variance_alerts
--   (planned_amount, actual_amount), financial_roi_links.realized_value,
--   finance_post_investment_reviews (projected_value, realized_value, variance),
--   v8_kpi_definitions (baseline_value, target_value, current_value),
--   v8_kpi_finance_reconciliations (projected_value, realized_value, deviation_absolute),
--   v8_roi_realization_entries.realized_value, v8_unreconciled_delta_escalations.delta_magnitude,
--   v8_deviation_records (observed_actual, observed_target).
--   Each of those has its own read/serialization surface that must be audited the same way this
--   one was; batching them blindly into one ALTER wave is how a precision fix turns into an
--   outage. Full census: docs/validation/finance-v3/generated/gate-d/
--   CLOSEOUT_09_numeric_precision_report.md.
--
-- WHY `numeric` WITH NO PRECISION
-- -------------------------------
-- 1. It is ALREADY this repo's standard for money. The finance-v3 canonical layer stores every
--    monetary quantity as unparameterized `numeric` (finance_analysis_kpi_values.value_decimal,
--    finance_baseline_outputs.value_decimal, finance_prediction_*.{amount,implementation_cost}
--    _decimal, finance_exceptions.{expected,observed,delta}, ...). This migration brings the
--    legacy `financial_*` ingestion tables onto the convention the newer layer already uses,
--    rather than inventing a third one.
-- 2. Unparameterized `numeric` is exact and unbounded: no silent rounding on write, ever.
--    A fixed `numeric(20,2)` would silently round anything with >2 decimals (FX rates, per-unit
--    figures, statements filed with 3-4 decimals) and hard-error above its ceiling — trading a
--    known silent-corruption bug for a different one.
-- 3. Storage is variable-length, so the unbounded form costs nothing for small values, and it
--    is fully indexable and comparable.
--
-- DRIVER-TYPE CONSEQUENCE (deliberate, verified, NOT a side effect to discover in prod)
-- -------------------------------------------------------------------------------------
-- `node-pg` returns `real`/`double precision` (OID 700/701) as a JS **number**, but `numeric`
-- (OID 1700) as a JS **string**, because this codebase registers no type parser at all
-- (`grep -rn setTypeParser server/src src` -> no match; the same trap is already documented for
-- DATE/OID 1082 in server/src/services/financePeriodFormat.ts:9 and
-- server/src/services/resultsVnext/roi/roiCalculationRunCommands.ts:86).
-- Every read path of these columns was audited before this migration was written, and all of
-- them already coerce with `Number(...)` / `numberOrZero(...)` — financeStatementAnalyticsService,
-- financeStatementTrendService, ratioAnalysisService, financialAnalysisService,
-- financialModelingService, realizedValueReconciliationService, validateStatement(),
-- financialStatementReadService's readiness projection, the `/values/:id` JSON route, and the
-- React mappers (FinancialStatementWorkspace.tsx:1033, FinancialStatementPackWorkspace.tsx:170).
-- `initiative/financialsGrounding.ts:132` even branches on `typeof raw === 'string'` explicitly.
-- The ONE uncoerced consumer found — the v8 ratio-export XLSX writer, which dumped `fsv.*`
-- straight into ExcelJS cells and would have produced text cells instead of numeric cells — is
-- fixed in the same commit as this migration (server/src/routes/v8/finance.routes.ts).
--
-- ADDITIVE / IDEMPOTENT
-- ---------------------
-- Every column is probed INDIVIDUALLY through `information_schema.columns` and is altered only
-- when it is not already `numeric`. A column that is already converted skips ITSELF (with an
-- explicit RAISE NOTICE), never the rest of the block; a table that does not exist on a given
-- database skips itself too. Re-running this file any number of times is a no-op. The probe is
-- driven off `information_schema` rather than a hardcoded schema name, so it also covers any
-- `v8.`-schema twin of these tables should one ever appear (none exists today — verified).
--
-- DATA ALREADY STORED AS `real` IS NOT REPAIRED BY THIS MIGRATION.
-- A value that was already snapped to 1 227 799 040 on write is snapped; the information is
-- gone and no migration can invent it back. The conversion PRESERVES exactly what is currently
-- stored and guarantees that every write from this point on is exact. Rows ingested before this
-- migration must be re-ingested from source if bit-exactness matters for them.
--
-- ***** WHY THE CAST IS `::text::numeric` AND NOT THE OBVIOUS `::numeric` *****
-- The obvious form of this migration is a data-corruption bug, and it was caught only by
-- running it. Postgres' built-in float4->numeric cast (`float4_numeric`) formats the float with
-- `%.*g` at FLT_DIG = **6 significant digits**. So a bare
--     ALTER TABLE ... ALTER COLUMN value TYPE numeric;            -- or USING value::numeric
-- does not preserve the stored number at all — measured on Postgres 15.15:
--
--     stored real     bare ALTER -> numeric      ::text::numeric  (this migration)
--     12345.67        12345.7      <- grosze GONE      12345.67    <- preserved
--     1234567.89      1234570      <- 7.89 PLN GONE    1234567.9   <- preserved (float4 limit)
--     1227799000      1227800000   <- +1000 PLN        1227799000  <- preserved
--
-- i.e. the "fix" for a silent precision bug would itself have silently truncated every existing
-- amount to six digits — strictly worse than the defect being closed.
--
-- Casting through `text` uses `float4out`, which emits the SHORTEST DECIMAL THAT ROUND-TRIPS to
-- the same float4 bits. That is exactly the number the application reads today (node-pg receives
-- that same text form over the wire), so the conversion is invisible to every consumer while
-- being lossless with respect to the currently observable value.
-- (`::float8::numeric` is the third option and is also wrong for our purpose: it expands the
-- binary noise into fake precision — 12345.67 becomes 12345.669921875.)
--
-- `float4out`'s digit count is governed by `extra_float_digits`, which is a session GUC. The
-- shortest-round-trip behaviour requires a value >= 1 (the Postgres 12+ default is 1, but a
-- pooler, a `PGOPTIONS`, or an older client default can set it to 0 or -1, which silently
-- restores the 6-digit truncation). This file therefore PINS it explicitly for the duration of
-- the conversion and restores it afterwards, so the outcome cannot depend on session state.
--
-- LOCKING / DEPLOY NOTE
-- ---------------------
-- `ALTER TABLE ... ALTER COLUMN ... TYPE` rewrites the table and holds ACCESS EXCLUSIVE for the
-- duration — concurrent reads AND writes on these three tables block. Measured on Postgres 15
-- with a realistic table (timings and method in the CLOSEOUT_09 report). Run it in a
-- maintenance window on demo/prod, not against live ingestion traffic.

-- Pin shortest-round-trip float output for the conversion (see the cast note above).
SET extra_float_digits = 3;

DO $$
DECLARE
  instance      RECORD;
  altered_count INTEGER := 0;
BEGIN
  -- One pass per PHYSICAL TABLE instance (schema x table). All of that table's pending columns
  -- are converted in a SINGLE `ALTER TABLE` with several `ALTER COLUMN` clauses, so the table is
  -- rewritten ONCE and the ACCESS EXCLUSIVE lock is taken ONCE — issuing one statement per
  -- column would rewrite `financial_statement_validations` four times over.
  -- A column already converted simply does not match, so it is skipped individually; a table
  -- absent from this database does not match either, so it skips itself and not the rest.
  FOR instance IN
    SELECT c.table_schema,
           c.table_name,
           string_agg(
             format('ALTER COLUMN %I TYPE numeric USING %I::text::numeric',
                    c.column_name, c.column_name),
             ', ' ORDER BY c.column_name
           )                             AS clauses,
           string_agg(c.column_name || ' (' || c.data_type || ')',
                      ', ' ORDER BY c.column_name) AS described,
           count(*)                      AS column_count
      FROM information_schema.columns c
      JOIN (
        VALUES
          ('financial_statement_values',         'value'),
          ('financial_statement_value_evidence', 'contribution_value'),
          ('financial_statement_validations',    'expected_value'),
          ('financial_statement_validations',    'actual_value'),
          ('financial_statement_validations',    'difference'),
          ('financial_statement_validations',    'tolerance')
      ) AS t(table_name, column_name)
        ON t.table_name = c.table_name
       AND t.column_name = c.column_name
     WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
       AND c.data_type <> 'numeric'
     GROUP BY c.table_schema, c.table_name
     ORDER BY c.table_schema, c.table_name
  LOOP
    -- `::text::numeric`, NOT `::numeric` — the built-in float4->numeric cast truncates to 6
    -- significant digits and would corrupt every existing amount. See the cast note above.
    EXECUTE format('ALTER TABLE %I.%I %s',
                   instance.table_schema, instance.table_name, instance.clauses);
    altered_count := altered_count + instance.column_count;
    RAISE NOTICE 'CO-9: %.% converted to numeric: %',
      instance.table_schema, instance.table_name, instance.described;
  END LOOP;

  IF altered_count = 0 THEN
    RAISE NOTICE 'CO-9: no-op — every targeted statement money column is already numeric';
  ELSE
    RAISE NOTICE 'CO-9: % column instance(s) converted to numeric', altered_count;
  END IF;
END
$$;

RESET extra_float_digits;
