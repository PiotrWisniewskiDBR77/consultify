-- P29 hardening: enforce bounded partner program ledger entry types at DB level.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_program_ledger_entry_type_check'
      AND conrelid = 'partner_program_ledger'::regclass
  ) THEN
    ALTER TABLE partner_program_ledger
      ADD CONSTRAINT partner_program_ledger_entry_type_check
      CHECK (
        entry_type IN (
          'accrual.posted',
          'accrual.adjustment',
          'accrual.reversal',
          'hold.placed',
          'hold.released',
          'payout.requested',
          'payout.approved',
          'payout.executed',
          'payout.failed',
          'payout.reconciled',
          'lifecycle.transition'
        )
      );
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore: bootstrap environments create the base table in earlier migrations
END $$;
