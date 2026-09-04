ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS markup_multiplier REAL DEFAULT 2.0;
