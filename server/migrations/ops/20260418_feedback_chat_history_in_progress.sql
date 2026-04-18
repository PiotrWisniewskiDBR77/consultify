-- Feedback audit: chat-history HIGH pair closed on staging
-- Commit: 38d939efc fix(chat-history): unblock conversation open + persist AI replies
-- Staging deploy: 1a7a961a-4e1f-44a6-a100-15c198b0a858
-- Bug items addressed:
--   #2ee998d3 HIGH — Historyczne konwersacje widoczne, ale nie można ich otworzyć (REGRESSION)
--   #53cc607e HIGH — Chat nie pamięta rozmów

BEGIN;

UPDATE feedback_items
SET
  status = 'IN_PROGRESS',
  updated_at = NOW(),
  metadata_json = (
    COALESCE(metadata_json::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'workflow',
      jsonb_build_object(
        'timeline',
        COALESCE(metadata_json::jsonb -> 'workflow' -> 'timeline', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'actor', 'cto-agent',
            'event', 'IN_PROGRESS',
            'commit', '38d939efc',
            'deploy', 'staging/1a7a961a-4e1f-44a6-a100-15c198b0a858',
            'root_cause', 'setActiveConversation only scheduled a fetch and relied on fetchConversation to resolve before updating activeConversationId; dedupe/inflight guard returned without syncing state; click-to-open appeared to do nothing.',
            'fix', 'Sync activeConversationId + clear activeMessages eagerly in both setActiveConversation and fetchConversation (prev !== id guard) so every click produces instant, consistent UI feedback.',
            'files', jsonb_build_array('src/store/useConversationStore.ts')
          )
        )
      )
    )
  )::text
WHERE id = '2ee998d3-0345-4503-bc35-df63c0b15850';

UPDATE feedback_items
SET
  status = 'IN_PROGRESS',
  updated_at = NOW(),
  metadata_json = (
    COALESCE(metadata_json::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'workflow',
      jsonb_build_object(
        'timeline',
        COALESCE(metadata_json::jsonb -> 'workflow' -> 'timeline', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'actor', 'cto-agent',
            'event', 'IN_PROGRESS',
            'commit', '38d939efc',
            'deploy', 'staging/1a7a961a-4e1f-44a6-a100-15c198b0a858',
            'root_cause', 'UnifiedChatPanel onStreamDone captured activeConversationId from the render closure. When handleSendMessage created a new conversation mid-send, the stream callback still saw activeConversationId=null and short-circuited the AI message save — user messages persisted, AI replies did not.',
            'fix', 'Read useConversationStore.getState().activeConversationId inside onStreamDone for the AI save guard and for the Agent Audit Layer gate; keep the closure id as a fallback. Chat now remembers both user prompts and AI replies for fresh conversations.',
            'files', jsonb_build_array('src/components/AIChat/UnifiedChatPanel.tsx')
          )
        )
      )
    )
  )::text
WHERE id = '53cc607e-5310-4d48-8309-64499e128be3';

COMMIT;
