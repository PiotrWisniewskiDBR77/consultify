-- Feedback cluster: superadmin-infra (3 items)
--
-- Items resolved in commit e08da376a:
--   #5e16d214 HIGH   — "Edit Provider" (activation does not persist)
--   #5e5a86c4 HIGH   — Feedback Backlog opens new tab to non-existent route
--   #0e1e7dec MEDIUM — HIGH/CRITICAL feedback submit latency multi-seconds
--
-- Root causes:
-- 1. `LLMController.updateProvider` + `createProvider` coerced booleans to
--    1/0. Postgres `is_active` / `is_default` columns are boolean; the type
--    mismatch error was swallowed by DbPromise's fallback envelope, so the
--    UPDATE silently no-op'd and the UI showed "saved" with stale data.
-- 2. SuperAdmin Feedback Backlog opened `/my-work/tasks/:id` in `_blank`,
--    but that route doesn't exist in the SPA; the wildcard just re-rendered
--    the generic My Work dashboard, confusing the admin.
-- 3. `/api/feedback` awaited Slack + email + WhatsApp network calls before
--    responding. Severity HIGH adds email, CRITICAL adds WhatsApp, so those
--    submissions blocked the user for seconds compared to MEDIUM/LOW.
--
-- Fixes:
-- - Pass JS booleans through to pg, run UPDATE with fallback:false so real
--   DB errors surface, allow `priority` in updates.
-- - Replace backlog row nav with in-place expand (description + tags +
--   deep-link to the source feedback ticket) so the admin stays inside the
--   console.
-- - Detach `dispatchFeedbackEscalation` (and the metadata back-write) into a
--   fire-and-forget promise; respond 200 immediately with feedback + task id.
--
-- Audit commit: e08da376a
-- Staging deploy: pending (Railway auto-deploy on push to develop)

BEGIN;

UPDATE feedback_items
   SET status = 'IN_PROGRESS',
       updated_at = NOW(),
       metadata_json = (
           COALESCE(metadata_json::jsonb, '{}'::jsonb)
           || jsonb_build_object(
                'in_progress_at', NOW()::text,
                'commit_sha', 'e08da376a',
                'root_cause',
                  CASE substring(id::text, 1, 8)
                    WHEN '5e16d214' THEN 'LLMController.updateProvider coerced booleans to 1/0; Postgres rejects the cast for is_active/is_default; DbPromise fallback swallowed the error and returned the unchanged row, so the UI showed "saved" with no actual change.'
                    WHEN '5e5a86c4' THEN 'Superadmin Feedback Backlog opened /my-work/tasks/:id in a new tab, but no such route exists; the wildcard re-rendered the generic My Work dashboard so the admin ended up in an unrelated task list in production.'
                    WHEN '0e1e7dec' THEN 'POST /api/feedback awaited Slack + email + WhatsApp fan-out before responding; higher severities fan out to more channels, so HIGH/CRITICAL submits blocked the user for multiple seconds while MEDIUM/LOW (in-app + slack only) felt fast.'
                    ELSE NULL
                  END,
                'fix_summary',
                  'Pass real booleans to pg and surface DB errors (LLMController); replace backlog row nav with in-place expand + feedback ticket deep-link; fire-and-forget feedback escalation so the POST returns immediately.',
                'files',
                jsonb_build_array(
                  'server/src/controllers/ai/LLMController.ts',
                  'server/src/routes/feedback.routes.ts',
                  'src/views/superadmin/SuperAdminFeedbackBacklogView.tsx'
                ),
                'timeline_entry',
                jsonb_build_object(
                  'at', NOW()::text,
                  'by', 'system',
                  'type', 'progress',
                  'note',
                  'Cluster fix landed in e08da376a. Provider activation now persists (boolean casting + loud DB errors); Feedback Backlog stays inside superadmin with an in-place detail row; HIGH/CRITICAL feedback submit is now as fast as MEDIUM/LOW because Slack/email/WhatsApp fan-out happens in the background.'
                )
              )
       )::text
 WHERE substring(id::text, 1, 8) IN (
   '5e16d214', '5e5a86c4', '0e1e7dec'
 );

COMMIT;
