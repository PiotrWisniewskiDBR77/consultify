-- Mark chat-scoping cluster items as IN_PROGRESS after commit 5d3dc4343 deploy to staging.
-- Items covered:
--   4408f355-369d-4175-8f42-656fdc3c0fdb  CRITICAL  Quick savings miesza wątki między konwersacjami (context bleed)
--   5d9b15f7-91a2-46f0-9a87-b10e467c5977  MEDIUM    Dzienny brief pokazuje zadania powiązane z VTS (mylny kontekst)
--
-- Root cause (both):
--   * Quick savings: userMemory.recentTopics (GLOBAL per-user rollup across all
--     conversations/orgs) was injected into the AIPipeline system prompt — caused
--     Teresa to pull topics from other sessions.
--   * Daily brief: GET /api/daily-brief selected tasks by assignee_id only, with
--     no organization_id filter — leaked cross-org tasks (VTS visible from Aplix).
--
-- Fix (commit 5d3dc4343 on develop, deployed to staging):
--   * AIPipeline.ts: drop recentTopics from runtime context AND from the rendered
--     system prompt. Conversation-local context is still supplied via history + RAG.
--   * daily-brief.routes.ts: add organization_id = req.user.organizationId filter
--     to the tasks query; make due_date filter null-safe.

BEGIN;

UPDATE feedback_items SET
  status = 'IN_PROGRESS',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'owner', 'cursor',
            'source', 'cursor',
            'branch', 'develop',
            'commit', '5d3dc4343',
            'deployTargets', jsonb_build_array('staging'),
            'deployStatus', 'deployed-staging',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor', 'cursor-cto-chat-scoping-2026-04-18',
          'action', 'fix',
          'details', 'Commit 5d3dc4343: dropped cross-conversation userMemory.recentTopics leak from AIPipeline system prompt + runtime context; added organization_id filter to Daily Brief tasks query. Deployed to staging.'
        )),
      true
    )
  )::text
WHERE id IN (
  '4408f355-369d-4175-8f42-656fdc3c0fdb',
  '5d9b15f7-91a2-46f0-9a87-b10e467c5977'
);

COMMIT;
