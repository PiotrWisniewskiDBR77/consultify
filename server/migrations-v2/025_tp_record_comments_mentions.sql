-- Ported from: 20260411_tp_record_comments_mentions.sql
-- Optional @mention handles stored with record comments (JSON array of strings)
ALTER TABLE tp_record_comments
  ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
