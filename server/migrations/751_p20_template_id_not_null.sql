-- P20 Contract Compliance: template_id must be mandatory (FINAL_IMPLEMENTATION_PLAN §2.3)
-- Backfill NULL template_id rows with 'default', then enforce NOT NULL.

UPDATE presentation_decks SET template_id = 'default' WHERE template_id IS NULL;

-- SQLite does not support ALTER COLUMN SET NOT NULL natively.
-- Enforce via CHECK constraint on new inserts/updates.
-- For Postgres deployments, a proper ALTER would be used.
CREATE TRIGGER IF NOT EXISTS trg_presentation_decks_template_id_not_null
  BEFORE INSERT ON presentation_decks
  FOR EACH ROW
  WHEN NEW.template_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'template_id is required for presentation_decks (P20 contract §2.3)');
END;

CREATE TRIGGER IF NOT EXISTS trg_presentation_decks_template_id_not_null_update
  BEFORE UPDATE ON presentation_decks
  FOR EACH ROW
  WHEN NEW.template_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'template_id cannot be set to NULL (P20 contract §2.3)');
END;
