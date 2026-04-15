-- Migration: 578_llm_logs_compat_columns.sql
-- Adds compatibility columns to llm_logs so queries using created_at, total_tokens,
-- error, user_id, tokens_used work against the existing schema (which uses timestamp,
-- tokens_in/tokens_out, error_message).

ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS total_tokens INTEGER;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

UPDATE llm_logs SET created_at = "timestamp" WHERE created_at IS NULL AND "timestamp" IS NOT NULL;
UPDATE llm_logs SET total_tokens = COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0) WHERE total_tokens IS NULL;
UPDATE llm_logs SET error = error_message WHERE error IS NULL AND error_message IS NOT NULL;
UPDATE llm_logs SET tokens_used = COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0) WHERE tokens_used IS NULL;

CREATE OR REPLACE FUNCTION llm_logs_compat_trigger() RETURNS trigger AS $$
BEGIN
  IF NEW.created_at IS NULL THEN NEW.created_at := COALESCE(NEW."timestamp", CURRENT_TIMESTAMP); END IF;
  IF NEW.total_tokens IS NULL THEN NEW.total_tokens := COALESCE(NEW.tokens_in, 0) + COALESCE(NEW.tokens_out, 0); END IF;
  IF NEW.error IS NULL AND NEW.error_message IS NOT NULL THEN NEW.error := NEW.error_message; END IF;
  IF NEW.tokens_used IS NULL THEN NEW.tokens_used := COALESCE(NEW.tokens_in, 0) + COALESCE(NEW.tokens_out, 0); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_llm_logs_compat ON llm_logs;
CREATE TRIGGER trg_llm_logs_compat BEFORE INSERT ON llm_logs FOR EACH ROW EXECUTE FUNCTION llm_logs_compat_trigger();

CREATE INDEX IF NOT EXISTS idx_llm_logs_created_at ON llm_logs(created_at);
