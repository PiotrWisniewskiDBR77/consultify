-- chat-attachments cluster sprint — IN_PROGRESS audit trail
-- Commit b8bc523fa on develop; staging deploy build 4c0df7a8.
-- Fixes:
--   #ee34bf23 HIGH Add link: focus wypada po każdej literze (REGRESSION)
--     -> Modal.tsx stable refs for onClose/preventEscapeClose; effect only on `open`
--   #f590c4fc HIGH Chat nie widzi załączonych plików (REGRESSION)
--     -> fetchWithRetry+handleResponse on ingest; persistent chat message on failure; SSE attachments status events
--   #e196a572 HIGH Chat nie widzi podpiętej strony internetowej (REGRESSION)
--     -> same ingest hardening + SSE warning on metadata-only fallback
--   #0eb90842 MED  Nie można usunąć błędnie dodanego załącznika (partial)
--     -> ingest errors now surface as persistent chat message; explicit remove button in follow-up PR

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
            'commit', 'b8bc523fa',
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
          'actor', 'cursor-cto-chat-attachments-2026-04-18',
          'action', 'fix',
          'details', 'Commit b8bc523fa: (1) Modal.tsx — focus effect no longer depends on handleKeyDown callback identity; onClose/preventEscapeClose captured via stable refs so inputs inside modals keep focus across re-renders (root cause of Add-link focus-wypada). (2) Attachment + URL ingest routed via fetchWithRetry+handleResponse so server errors (policy 403, extraction failure) reach the UI. (3) UnifiedChatPanel — all-failed / partial-failed states now render a persistent, actionable chat message instead of silently removing the analyzing bubble. (4) AddFilesMenu closes its dropdown when opening the Add-link modal. (5) Backend /ai/chat/stream emits SSE thought events for attachments (completed / completed-direct-load / warning-metadata-only) so the chat UI can visibly reflect whether Teresa actually has the attachment content. Deployed to staging (build 4c0df7a8-86b1-472f-9b9d-ad536dc608d2).'
        )),
      true
    )
  )::text
WHERE id IN (
  'ee34bf23-513c-45e1-8b95-72470763cf64',  -- HIGH Add link focus wypada
  'f590c4fc-76a8-493d-a35a-18439fc0b8f1',  -- HIGH Chat nie widzi plików
  'e196a572-9c45-47b1-a6d7-2ccff803def2',  -- HIGH Chat nie widzi URL
  '0eb90842-4027-4f86-82c2-564efeec344f'   -- MED  Nie można usunąć załącznika (partial)
);

COMMIT;
