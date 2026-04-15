-- P35: Full-text search for conversations (replaces ILIKE with tsvector + GIN)
-- Adds search_vector on conversations (title + last_message_preview)
-- and a trigger to keep it updated on conversation_messages changes.

-- 1) Add search_vector column (title A-weight, preview B-weight)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2) GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_conversations_search_vector
  ON conversations USING GIN(search_vector);

-- 3) Function to recompute search_vector from title + last_message_preview
CREATE OR REPLACE FUNCTION conversations_update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.last_message_preview, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger on conversations INSERT/UPDATE to keep search_vector fresh
DROP TRIGGER IF EXISTS trg_conversations_search_vector ON conversations;
CREATE TRIGGER trg_conversations_search_vector
  BEFORE INSERT OR UPDATE OF title, last_message_preview ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION conversations_update_search_vector();

-- 5) Backfill existing rows
UPDATE conversations SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(last_message_preview, '')), 'B')
WHERE search_vector IS NULL;

-- 6) Separate GIN index on conversation_messages.content for deep search
CREATE INDEX IF NOT EXISTS idx_conversation_messages_content_fts
  ON conversation_messages USING GIN(to_tsvector('simple', coalesce(content, '')));
