-- Composer #5: per-project custom instructions ("project brief").
-- Injected into Teresa's system prompt for conversations that belong to the
-- project (see AIPipeline customInstructions block + chat-projects PATCH).
-- Additive, nullable, idempotent — safe to run on existing data.

ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS custom_instructions TEXT;
