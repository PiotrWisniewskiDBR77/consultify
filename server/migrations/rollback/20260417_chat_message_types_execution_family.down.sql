-- Rollback for 20260417_chat_message_types_execution_family.sql
-- Restores the pre-V2 CHECK constraint on conversation_messages.message_type.
-- Safe to run: if any execution_* rows exist, this will fail cleanly without
-- touching data, and you must first reclassify those rows (see NOTE below).
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260417_chat_message_types_execution_family.down.sql
--
-- NOTE: if rollback fails with "check constraint violated", there are rows
-- with message_type IN ('execution_proposal','execution_progress','execution_result').
-- You can either:
--   (a) Delete them:
--       DELETE FROM conversation_messages
--         WHERE message_type IN ('execution_proposal','execution_progress','execution_result');
--   (b) Reclassify to 'action_request':
--       UPDATE conversation_messages SET message_type = 'action_request'
--         WHERE message_type IN ('execution_proposal','execution_progress','execution_result');
-- …then re-run this rollback.

DO $$
BEGIN
  ALTER TABLE conversation_messages
    DROP CONSTRAINT IF EXISTS conversation_messages_message_type_check;

  ALTER TABLE conversation_messages
    ADD CONSTRAINT conversation_messages_message_type_check
    CHECK (message_type IN (
      'text',
      'action_request',
      'summary',
      'file',
      'tool_call',
      'voice'
    ));
EXCEPTION
  WHEN OTHERS THEN RAISE;
END $$;
