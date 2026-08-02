-- EXE-09 (Codex review round 2, BLOCKER1) — additive backstop so
-- `closureDeliveryReceiptService.ts` can write into the CANONICAL Results
-- realization table (`roi_realized_values`, owned by
-- server/src/services/executionRealizationService.ts) instead of a new,
-- isolated ledger. `roi_realized_values` has no natural dedup key of its
-- own (it's an append-only human-entry log by design) — this nullable
-- column + partial unique index gives the closure-triggered write path a
-- real idempotency guarantee (one realization row per closure receipt) WITHOUT
-- touching the existing human-entry write path at all (that path never sets
-- this column, so it is completely unaffected).
--
-- Additive/idempotent (IF NOT EXISTS), same convention as every other
-- migration in this lineage.

ALTER TABLE roi_realized_values ADD COLUMN IF NOT EXISTS closure_receipt_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roi_realized_values_closure_receipt
  ON roi_realized_values (closure_receipt_id)
  WHERE closure_receipt_id IS NOT NULL;
