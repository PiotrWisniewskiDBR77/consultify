-- Naprawia readiness_status + validation_status dla seeded statements na demo.
--
-- Problem: reset-and-seed-finance-demo.ts ustawia readiness_status='ready'
-- i validation_status='pass', ale skrypt był uruchamiany na PG (not SQLite),
-- więc demo (caboose/SQLite) ma te pola NULL/recoverable.
-- assertReadyStatement() rzuca 404 dla readiness != 'ready' → BUG-03.
--
-- Bezpieczna: UPDATE tylko na znanych seed ID z prefiksem 'staging-'.
-- Na prod/staging nie istnieją te ID — WHERE jest no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_statements'
      AND column_name = 'readiness_status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_statements'
      AND column_name = 'validation_status'
  ) THEN
    UPDATE financial_statements
    SET validation_status = 'pass', readiness_status = 'ready'
    WHERE id LIKE 'staging-%'
      AND status = 'confirmed'
      AND (readiness_status IS NULL OR readiness_status != 'ready');
  END IF;
END $$;
