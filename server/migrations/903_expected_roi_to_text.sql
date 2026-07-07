-- Migration 903: `initiatives.expected_roi` REAL → TEXT
--
-- ROOT CAUSE (r7 Durable, "puste inicjatywy"): `initiatives.expected_roi` was
-- typed REAL (numeric), but `cardColumnHydration.extractRoiFromText` extracts
-- and writes a QUALITATIVE string — "ROI 200%", "44% (zysk netto ÷ nakład),
-- payback 14 mies", "rentowność Q3 2027" — never a bare number. The bulk
-- `UPDATE initiatives SET ...` in `generateInitiative.hydrateTypedColumns`
-- (server/src/services/ai/tools/generateInitiative.ts) tried to cast that
-- string into the REAL column, Postgres rejected it, and the SINGLE
-- try/catch around the whole bulk UPDATE swallowed the error — losing ALL
-- typed columns for the initiative, not just expected_roi. Result: a fresh
-- DRAFT initiative rendered as a 0/7 empty skeleton (problem_statement,
-- target_state, scope_in, success_criteria, ... all stayed empty) even
-- though Teresa's brain had generated full card content.
--
-- ROI here is intentionally qualitative (narrative %, payback period, basis)
-- — not a single numeric field — so TEXT is the correct type, not a REAL/
-- NUMERIC cast. This was already applied by hand on the TROLLEY (demo/
-- staging) database; this migration makes that fix durable in code/repro
-- for prod and any fresh database.
--
-- Idempotent + fail-soft: only alters the column if it still has a numeric
-- type; safe to re-run (no-op once already TEXT). Uses `::text` cast via
-- USING so any existing numeric values are preserved as their string form.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'initiatives'
      AND column_name = 'expected_roi'
      AND data_type IN ('real', 'double precision', 'numeric', 'integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE initiatives ALTER COLUMN expected_roi TYPE text USING expected_roi::text;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fail-soft: never let this migration block the run. If the ALTER can't
  -- apply for any reason, the per-column hydration fallback (generateInitiative.ts)
  -- still prevents a single bad column from wiping the rest of the row.
  RAISE NOTICE 'migration 903: expected_roi ALTER skipped/failed (ignored): %', SQLERRM;
END $$;
