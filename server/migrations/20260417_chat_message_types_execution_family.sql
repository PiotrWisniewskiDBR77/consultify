-- Chat V8 / Wave A6 addendum
-- Extend the CHECK constraint on conversation_messages.message_type so that
-- the governed V8 execution family (proposal / progress / result) is a valid
-- first-class message type in the thread.
--
-- Safe, idempotent: drops the prior check if present, then re-adds the
-- superset. On non-Postgres engines the DO block is a no-op.

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
      'voice',
      'execution_proposal',
      'execution_progress',
      'execution_result'
    ));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
