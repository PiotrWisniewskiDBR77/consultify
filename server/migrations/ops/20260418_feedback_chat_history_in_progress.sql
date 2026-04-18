-- chat-history cluster sprint — IN_PROGRESS audit trail
-- Commit 76264853e on develop; staging deploy build bd477b19.
-- Fixes:
--   #3a41921c CRIT Trash infinite loading / refresh wipe           -> 20s fetch deadline
--   #45e50d65 MED  Move to folder: klik w search zamyka modal      -> createPortal
--   #84f6e58f MED  Move to folder nie przypisuje konwersacji       -> same portal fix
--   #fb2d4e30 MED  Move to folder: przypisanie nie działa          -> same portal fix
--   #407a17df MED  Nie można usuwać folderów (regression)          -> handleResponse + confirm + force refresh

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
            'commit', '76264853e',
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
          'actor', 'cursor-cto-chat-history-2026-04-18',
          'action', 'fix',
          'details', 'Commit 76264853e: (1) withDeadline(20s) on fetchConversations/fetchProjects to unstick infinite sidebar loading; (2) MoveToProjectModal rendered via React.createPortal(document.body) to stop clicks bubbling to ConversationItem onSelect (root cause of modal-closes-on-search-click and move-to-folder not attaching); (3) chat-projects API endpoints now use fetchWithRetry+handleResponse so 403/404/409 messages reach the UI; (4) force-refresh conversations after folder delete + confirm dialog + error alert in sidebar. Deployed to staging (build bd477b19).'
        )),
      true
    )
  )::text
WHERE id IN (
  '3a41921c-1210-4ac6-92d8-3b4a599be835',  -- CRIT Trash infinite loading
  '45e50d65-e7da-4cb1-8302-627ab39862f7',  -- MED Move: search zamyka modal
  '84f6e58f-24b7-4ddc-a63d-98aa305b3393',  -- MED Move: nie przypisuje
  'fb2d4e30-fb7f-45ad-b52d-1e74e6e8b4bb',  -- MED Move: przypisanie nie działa
  '407a17df-9b42-46c7-8ad2-3ac3f76711e4'   -- MED Nie można usuwać folderów
);

COMMIT;
