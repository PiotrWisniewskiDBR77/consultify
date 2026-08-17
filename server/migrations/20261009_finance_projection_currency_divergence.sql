-- Finance projection hard divergence: a currency mismatch is material even
-- when the two numeric values happen to be equal. This widens only the
-- existing immutable v1 policy CHECK; it does not rewrite historical rows.
DO $$
DECLARE
  current_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO current_definition
    FROM pg_constraint c
   WHERE c.conrelid = 'rvn_roi_finance_reconciliations'::regclass
     AND c.conname = 'rvn_roi_finance_reconciliations_policy_check';

  IF current_definition IS NULL OR position('divergence_reason' in current_definition) = 0 THEN
    ALTER TABLE rvn_roi_finance_reconciliations
      DROP CONSTRAINT IF EXISTS rvn_roi_finance_reconciliations_policy_check;
    ALTER TABLE rvn_roi_finance_reconciliations
      ADD CONSTRAINT rvn_roi_finance_reconciliations_policy_check CHECK (
        materiality_threshold_pct = 5
        AND decision_policy_version = 'DEC-FIN-RESULTS-RECONCILIATION-001/v1'
        AND decision_policy_digest = 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d'
        AND (
          divergence_reason = 'currency_mismatch'
          OR abs(finance_value - roi_value) > CASE
            WHEN abs(roi_value) = 0 THEN 0
            ELSE abs(roi_value) * 0.05
          END
        )
      ) NOT VALID;
    ALTER TABLE rvn_roi_finance_reconciliations
      VALIDATE CONSTRAINT rvn_roi_finance_reconciliations_policy_check;
  END IF;
END $$;
