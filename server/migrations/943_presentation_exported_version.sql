ALTER TABLE presentation_decks
  ADD COLUMN IF NOT EXISTS exported_version INTEGER;

UPDATE presentation_decks
SET exported_version = version
WHERE export_path IS NOT NULL
  AND exported_version IS NULL;
