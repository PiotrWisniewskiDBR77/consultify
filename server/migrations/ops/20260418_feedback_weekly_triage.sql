-- Weekly feedback triage: 2026-04-12 → 2026-04-18
-- Sets cluster / owner / severity / status for 36 feedback items reported
-- this week. Recorded as an audit entry (workflow.timeline) inside the
-- item's metadata_json so the Superadmin Feedback view shows the reason.
--
-- Clusters used:
--   i18n-teresa          — Teresa responds in PL while UI is EN
--   i18n-ui              — Static UI strings not localized
--   ai-teresa-runtime    — Teresa AI availability / VTS data / files / memory
--   superadmin-user-mgmt — Superadmin user/org CRUD
--   superadmin-infra     — Superadmin infra/navigation (providers, backlog nav)
--   ui-responsive        — Layout / small screens
--   ui-chat              — Chat UX (templates, attachments, surveys)
--   inbox                — Inbox bugs
--   auth-account         — Account settings / role consistency
--   triage-noise         — Low-quality test submissions → ARCHIVED

BEGIN;

-- Helper: merge a {workflow: {...}} object into metadata_json and append a
-- timeline entry. We encode the operation as a CTE-free function-less
-- expression so everything runs in a single transaction on Postgres.
--
-- For each row we:
--   1) upsert top-level columns (cluster, owner, severity, status, priority,
--      workflow_updated_at),
--   2) rewrite metadata_json with:
--        .workflow.cluster / .owner / .source / .lastUpdatedAt
--        .workflow.timeline += {ts, actor, action, details}
--
-- We compute the patched metadata_json inline.

-- ============================================================
-- ARCHIVE: triage-noise (low-quality test with no repro)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'triage-noise',
  owner   = 'admin@dbr77.com',
  status  = 'ARCHIVED',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'triage-noise',
            'owner',   'admin@dbr77.com',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'archive',
          'details','Low-quality test submission, no reproduction steps'
        )),
      true
    )
  )::text
WHERE id IN ('95c99a86-b6af-407e-8049-cf2fdfcc3f21');

-- (1d6f441d "Teat 2" is already ARCHIVED — just tag cluster for analytics.)
UPDATE feedback_items SET
  cluster = 'triage-noise',
  owner   = 'admin@dbr77.com',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'triage-noise',
            'owner',   'admin@dbr77.com',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: triage-noise (already archived test entry)'
        )),
      true
    )
  )::text
WHERE id IN ('1d6f441d-b648-4092-b7d8-a143e9931554');

-- ============================================================
-- CLUSTER: i18n-teresa (HIGH impact — blocker for EN-speaking users)
-- Canonical: 1291ee7a
-- ============================================================
UPDATE feedback_items SET
  cluster = 'i18n-teresa',
  owner   = 'cursor',
  severity = 'HIGH',
  priority = 'high',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'i18n-teresa',
            'owner',   'cursor',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: i18n-teresa — Teresa replies in PL on EN UI'
        )),
      true
    )
  )::text
WHERE id IN (
  '1291ee7a-60a1-41fc-9bd5-b9ad6a82c84d', -- canonical
  'e9a84e7f-280d-4b4f-a9ec-f804e1b5501a',
  'eb4ad332-9677-4391-9f4b-016855fb8296',
  '34439bbc-2730-45b1-99d4-91ff5ffb2de8',
  '81b674c9-c8be-4cc2-bdf4-b12761d12dba'  -- Interview marketing PL questions
);

-- ============================================================
-- CLUSTER: i18n-ui (static strings not translated — MEDIUM)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'i18n-ui',
  owner   = 'cursor',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'i18n-ui',
            'owner',   'cursor',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: i18n-ui — missing EN/PL translations in UI chrome'
        )),
      true
    )
  )::text
WHERE id IN (
  'ec74ce52-7c8e-4847-84b3-e7cd6667337a', -- Task label "Zadanie"
  '0ab2e845-98da-4dd3-b459-f490a326cd54', -- Interview Details EN
  '08a1263a-315b-4505-bb39-25fcdfe9831c'  -- Partial translations
);

-- ============================================================
-- CLUSTER: ai-teresa-runtime (files, memory, VTS data, AI availability)
-- Bumps: 3b6c0287 MEDIUM → HIGH (AI unavailable blocks interview flow)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'ai-teresa-runtime',
  owner   = 'cursor',
  severity = CASE WHEN severity = 'MEDIUM' AND id = '3b6c0287-99cc-45a9-a9e4-d945c49fcd2b' THEN 'HIGH' ELSE severity END,
  priority = CASE WHEN id = '3b6c0287-99cc-45a9-a9e4-d945c49fcd2b' THEN 'high' ELSE priority END,
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'ai-teresa-runtime',
            'owner',   'cursor',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: ai-teresa-runtime — Teresa AI availability/VTS data/files/memory'
        )),
      true
    )
  )::text
WHERE id IN (
  '1b81d375-8461-4396-843a-81d0bf8fae30', -- VTS data (CRITICAL, canonical)
  '3b6c0287-99cc-45a9-a9e4-d945c49fcd2b', -- AI unavailable VTS HQ (bump MEDIUM→HIGH)
  'fa158b06-45da-4c63-bd8e-4e23ffb5c87a', -- Teresa can't read PDF
  '53cc607e-5310-4d48-8309-64499e128be3', -- Chat has no memory
  '30592ee0-612f-454a-8106-41719f337161', -- Files in chat (also i18n adjacent)
  'a9fcdd99-df92-4228-9773-e624b8d954c9'  -- Circuit [openrouter] is OPEN
);

-- ============================================================
-- CLUSTER: superadmin-user-mgmt (CRUD/impersonate/block/move)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'superadmin-user-mgmt',
  owner   = 'cursor',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'superadmin-user-mgmt',
            'owner',   'cursor',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: superadmin-user-mgmt — user/org CRUD, block/impersonate/move/count'
        )),
      true
    )
  )::text
WHERE id IN (
  '406b042a-89ea-40f8-a811-bb880a1a2b8e', -- Usuwanie kont (CRITICAL, canonical)
  '1e3d749a-e516-4b1e-9e97-dea42bbd2cb0', -- Edit user status error
  'd11ec6b0-7c04-4490-84f8-6f89a64eb921', -- Liczba userów in Organization
  '682d4134-d7e2-4326-ad97-65c27c378dcb', -- Block function
  'b8bf4422-4661-4091-816d-e8f53a73fa60', -- Impersonate function
  '76ef6831-72ce-4b28-8577-cf296c3240d8'  -- Move account between orgs
);

-- ============================================================
-- CLUSTER: superadmin-infra (LLM providers, feedback backlog navigation,
-- feedback submission latency)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'superadmin-infra',
  owner   = 'cursor',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'superadmin-infra',
            'owner',   'cursor',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: superadmin-infra — provider edit, backlog nav, feedback latency'
        )),
      true
    )
  )::text
WHERE id IN (
  '5e16d214-2842-4d9a-80d5-644577105d52', -- Edit Provider doesn't save
  '5e5a86c4-281f-455e-83f0-688a73dce738', -- Feedback Backlog opens new tab → prod
  '0e1e7dec-4cea-4f41-8bd0-840ad4533ae0'  -- Feedback submission is slow
);

-- ============================================================
-- CLUSTER: ui-responsive (layout / smaller screens)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'ui-responsive',
  owner   = 'unassigned',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'ui-responsive',
            'owner',   'unassigned',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: ui-responsive — viewport/scroll issues on smaller screens'
        )),
      true
    )
  )::text
WHERE id IN (
  '8b013c76-9169-4bf8-aaef-c7cc337cd12b', -- no scrollbar on small res
  '9e8c29b2-9ccb-48ab-990c-d2350ffa4d22'  -- Tenant & User Ops bar overflow
);

-- ============================================================
-- CLUSTER: ui-chat (chat buttons, templates, attachments, surveys)
-- ============================================================
UPDATE feedback_items SET
  cluster = 'ui-chat',
  owner   = 'unassigned',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'ui-chat',
            'owner',   'unassigned',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: ui-chat — chat controls, templates, attachments, surveys'
        )),
      true
    )
  )::text
WHERE id IN (
  '3f297cfe-4ba5-474e-ba79-6d1449b72fc8', -- chat button on right doesn't work
  '3ccebb2f-f29a-48bf-9f57-8f2138f445e0', -- templates (Global/HQ/Plant/Process) invisible
  'acc27ab3-0691-4ce4-aa4d-fc4d5ff3515f', -- Teresa "+" can't add link
  '8f12f96f-7df9-4fc4-97c3-54458cbbc878', -- Survey submit does nothing
  '0eb90842-4027-4f86-82c2-564efeec344f'  -- can't delete attachment
);

-- ============================================================
-- CLUSTER: inbox
-- ============================================================
UPDATE feedback_items SET
  cluster = 'inbox',
  owner   = 'unassigned',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'inbox',
            'owner',   'unassigned',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: inbox — Inbox opening/message visibility bugs'
        )),
      true
    )
  )::text
WHERE id IN (
  'a7e4d052-ff3d-452e-8c73-3f473b2aa3b4', -- Inbox "something went wrong"
  '347ac069-e3e9-40b8-ba66-f0967cd34041'  -- Inbox shows "no notifications"
);

-- ============================================================
-- CLUSTER: auth-account
-- ============================================================
UPDATE feedback_items SET
  cluster = 'auth-account',
  owner   = 'unassigned',
  workflow_updated_at = NOW(),
  metadata_json = (
    jsonb_set(
      jsonb_set(
        COALESCE(metadata_json::jsonb, '{}'::jsonb),
        '{workflow}',
        COALESCE(metadata_json::jsonb->'workflow', '{}'::jsonb)
          || jsonb_build_object(
            'cluster', 'auth-account',
            'owner',   'unassigned',
            'source',  'cursor',
            'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ),
        true
      ),
      '{workflow,timeline}',
      COALESCE(metadata_json::jsonb->'workflow'->'timeline', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'ts',     to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor',  'cursor-cto-triage-2026-04-18',
          'action', 'cluster',
          'details','Cluster: auth-account — password / role consistency'
        )),
      true
    )
  )::text
WHERE id IN (
  '5b28d67e-ccdf-4ffc-96d0-13d4fcc4fbeb', -- password change doesn't save
  '160c40be-6213-462a-b868-579cafb5c8ec'  -- member/admin inconsistency
);

COMMIT;
