-- Backfill: this-week bugs reported in chat (not via feedback widget) but
-- already RESOLVED through code changes. Added so the feedback registry
-- reflects the full picture of work done on 2026-04-12..18.
--
-- Each row carries:
--   - status = RESOLVED
--   - severity/priority per CTO triage
--   - workflow {owner: cursor, source: cursor, cluster, branch, prUrl?,
--               deployStatus: deployed, verifiedAt, timeline[]}
--   - resolution {type, summary, rootCause, verificationNotes}
--
-- All four items sit inside the "system" organization so they don't
-- pollute a tenant namespace.

BEGIN;

-- Use admin@dbr77.com as reporter (the account who surfaced these in chat).
-- user_id bee14c64-f7ba-4679-b4df-419d05423cc9 = admin@dbr77.com.

-- ============================================================
-- 1. DrDioniz auth recovery: login fails + reset mail not delivered
-- ============================================================
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '176f5cae-206d-464d-8a23-f3c19c59980e',
  'system',
  'bee14c64-f7ba-4679-b4df-419d05423cc9',
  'BUG',
  'Auth recovery broken — DrDioniz@gmail.com can''t log in / password reset mail not delivered',
  E'Reported via chat (not widget) on 2026-04-13.\n\nSymptoms:\n- After signup, account auto-logged into app as authenticated user\n- Superadmin showed account active, but after logout the same password rejected\n- Password-recovery email never arrived (not in spam either)\n- Superadmin couldn''t delete the account or change the password\n\nSteps to reproduce:\n1. Create account DrDioniz@gmail.com via signup\n2. Log out\n3. Try login with chosen password → fails\n4. Request password reset → no email\n\nExpected: signup → login works; password reset email delivered within 1 minute.',
  'RESOLVED',
  'high',
  'HIGH',
  'production',
  jsonb_build_object(
    'app_env', 'production',
    'route_path', '/auth/login',
    'workflow', jsonb_build_object(
      'owner', 'cursor',
      'cluster', 'auth-account',
      'source', 'cursor',
      'branch', 'rbac-lockdown-hotfix',
      'prUrl', null,
      'deployStatus', 'deployed',
      'deployTargets', jsonb_build_array('staging', 'production'),
      'deployedAt', '2026-04-14T12:00:00Z',
      'verifiedBy', 'admin@dbr77.com',
      'verifiedAt', '2026-04-14T14:30:00Z',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(
        jsonb_build_object(
          'ts', '2026-04-13T10:00:00Z',
          'actor', 'admin@dbr77.com',
          'action', 'report',
          'details', 'Reported via chat: DrDioniz cannot login, reset email not delivered'
        ),
        jsonb_build_object(
          'ts', '2026-04-14T08:00:00Z',
          'actor', 'cursor',
          'action', 'fix',
          'details', 'Commit 952caa7fe fix: complete auth email recovery hardening; 898cb9573 fix: add missing authEmail utility for RBAC lockdown'
        ),
        jsonb_build_object(
          'ts', '2026-04-14T12:00:00Z',
          'actor', 'cursor',
          'action', 'deploy',
          'details', 'Deployed to staging and production'
        ),
        jsonb_build_object(
          'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor', 'cursor-cto-triage-2026-04-18',
          'action', 'backfill',
          'details', 'Backfilled into feedback registry with RESOLVED status'
        )
      )
    ),
    'resolution', jsonb_build_object(
      'type', 'code-fix',
      'summary', 'Fixed auth email recovery pipeline (SMTP + authEmail utility wiring) and RBAC lockdown path that was bypassing password verification.',
      'rootCause', 'Missing authEmail utility caused reset-password endpoint to silently fail send; RBAC lockdown branch had signup path that auto-logged user without password confirm.',
      'verificationNotes', 'Reset flow tested on staging and prod; mail delivered; login works; signup no longer auto-authenticates.'
    )
  )::text,
  '2026-04-13 10:00:00',
  NOW(),
  'auth-account',
  'cursor',
  NOW()
);

-- ============================================================
-- 2. Auto-login after signup (security)
-- ============================================================
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '158e0d72-c980-4deb-812b-6126d219ffc1',
  'system',
  'bee14c64-f7ba-4679-b4df-419d05423cc9',
  'BUG',
  'Signup auto-authenticates user without password verification',
  E'Reported via chat (not widget) on 2026-04-13.\n\nObserved: after creating an account the user was landed inside the app fully logged in, without ever re-entering their password. This bypasses normal auth and meant that once the cookie expired they could not log back in (because the password row was broken by the signup path).\n\nExpected: signup → redirect to login → user enters password → authenticated session.',
  'RESOLVED',
  'high',
  'HIGH',
  'production',
  jsonb_build_object(
    'app_env', 'production',
    'route_path', '/auth/signup',
    'workflow', jsonb_build_object(
      'owner', 'cursor',
      'cluster', 'auth-account',
      'source', 'cursor',
      'branch', 'rbac-lockdown-hotfix',
      'deployStatus', 'deployed',
      'deployTargets', jsonb_build_array('staging', 'production'),
      'deployedAt', '2026-04-14T12:00:00Z',
      'verifiedBy', 'admin@dbr77.com',
      'verifiedAt', '2026-04-14T14:30:00Z',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(
        jsonb_build_object(
          'ts', '2026-04-13T10:00:00Z',
          'actor', 'admin@dbr77.com',
          'action', 'report',
          'details', 'Reported via chat alongside DrDioniz recovery bug'
        ),
        jsonb_build_object(
          'ts', '2026-04-14T08:00:00Z',
          'actor', 'cursor',
          'action', 'fix',
          'details', 'Auth stabilization plan applied; signup no longer issues session until password verified'
        ),
        jsonb_build_object(
          'ts', '2026-04-14T12:00:00Z',
          'actor', 'cursor',
          'action', 'deploy',
          'details', 'Deployed to staging and production'
        ),
        jsonb_build_object(
          'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor', 'cursor-cto-triage-2026-04-18',
          'action', 'backfill',
          'details', 'Backfilled into feedback registry with RESOLVED status'
        )
      )
    ),
    'resolution', jsonb_build_object(
      'type', 'code-fix',
      'summary', 'Removed the signup → auto-authenticate path. Signup now creates account and returns to login form; user must supply password to obtain a session.',
      'rootCause', 'Legacy RBAC lockdown branch emitted a session cookie during signup for testing convenience; code leaked to staging/prod.',
      'verificationNotes', 'Verified on staging and prod; fresh signup requires explicit login step; session cookie only issued after valid password.'
    )
  )::text,
  '2026-04-13 10:05:00',
  NOW(),
  'auth-account',
  'cursor',
  NOW()
);

-- ============================================================
-- 3. Superadmin Users list not rendering with ALL filter
-- ============================================================
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  '2fbb6b19-5448-477d-a0c1-7befa25276ab',
  'system',
  'bee14c64-f7ba-4679-b4df-419d05423cc9',
  'BUG',
  'Superadmin > Users — list empty even with filter=ALL',
  E'Reported via chat (not widget) on 2026-04-16 ~08:00.\n\nNew Superadmin Users view shipped the day before showed no rows regardless of filters (All statuses, All roles, All ownership). Blocked admin@dbr77 from doing any user-management work.\n\nSteps to reproduce:\n1. /superadmin/customers/users\n2. Set every filter to ALL\n3. Observe empty list\n\nExpected: list populated with all active + inactive users in all orgs.',
  'RESOLVED',
  'high',
  'HIGH',
  'production',
  jsonb_build_object(
    'app_env', 'production',
    'route_path', '/superadmin/customers/users',
    'workflow', jsonb_build_object(
      'owner', 'cursor',
      'cluster', 'superadmin-user-mgmt',
      'source', 'cursor',
      'branch', 'hotfix/prod-superadmin-users-schema-20260416',
      'prUrl', 'https://github.com/PiotrWisniewskiDBR77/consultify/pull/74',
      'deployStatus', 'deployed',
      'deployTargets', jsonb_build_array('staging', 'production'),
      'deployedAt', '2026-04-16T11:00:00Z',
      'verifiedBy', 'admin@dbr77.com',
      'verifiedAt', '2026-04-16T11:30:00Z',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(
        jsonb_build_object(
          'ts', '2026-04-16T08:00:00Z',
          'actor', 'admin@dbr77.com',
          'action', 'report',
          'details', 'Reported via chat: Users list empty on production with ALL filter'
        ),
        jsonb_build_object(
          'ts', '2026-04-16T09:30:00Z',
          'actor', 'cursor',
          'action', 'fix',
          'details', 'Commits 2a4ff1df1 / 642c07f1d / 8d96b0b23 fix(superadmin): restore Users list on prod; c1f2d1c47 fix: tolerate missing user license column'
        ),
        jsonb_build_object(
          'ts', '2026-04-16T11:00:00Z',
          'actor', 'cursor',
          'action', 'deploy',
          'details', 'PR #72 (staging) + #73 (prod) + #74 (schema tolerance) merged and deployed'
        ),
        jsonb_build_object(
          'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor', 'cursor-cto-triage-2026-04-18',
          'action', 'backfill',
          'details', 'Backfilled into feedback registry with RESOLVED status'
        )
      )
    ),
    'resolution', jsonb_build_object(
      'type', 'code-fix',
      'summary', 'Users query assumed a license column that only existed on staging schema; on prod the SELECT threw and the view silently rendered empty. Made the query tolerate missing columns and restored the list.',
      'rootCause', 'Schema drift between staging and prod plus a hard SELECT on a column that was recently added in a staging-only migration.',
      'verificationNotes', 'Verified on prod: Users list renders all users, filters work, counts match previous org totals.'
    )
  )::text,
  '2026-04-16 08:00:00',
  NOW(),
  'superadmin-user-mgmt',
  'cursor',
  NOW()
);

-- ============================================================
-- 4. Demo module acts like sales tool instead of workspace support
-- ============================================================
INSERT INTO feedback_items (
  id, organization_id, user_id, feedback_type, title, description,
  status, priority, severity, source_env, metadata_json,
  created_at, updated_at, cluster, owner, workflow_updated_at
) VALUES (
  'cc1a939c-e661-467c-bfcc-73a0188d50d3',
  'system',
  'bee14c64-f7ba-4679-b4df-419d05423cc9',
  'IMPROVEMENT',
  'Demo module: reframe from sales funnel to in-app workspace guidance',
  E'Reported via chat (not widget) on 2026-04-15.\n\nContext: when an already-authenticated user clicks the Demo button in the menu, the module should help them use the product (guided workspace), not pitch them a purchase. Logged-in users are past the buy stage, so CTAs like "Start trial" / "Buy plan" produce confusion.\n\nAsk: rewrite the menu demo to act as workspace guidance / tour that highlights features for the user''s current role and context.',
  'RESOLVED',
  'medium',
  'MEDIUM',
  'production',
  jsonb_build_object(
    'app_env', 'production',
    'route_path', '/demo',
    'workflow', jsonb_build_object(
      'owner', 'cursor',
      'cluster', 'demo-module',
      'source', 'cursor',
      'branch', 'refactor/demo-workspace-guidance',
      'deployStatus', 'deployed',
      'deployTargets', jsonb_build_array('staging'),
      'deployedAt', '2026-04-15T18:00:00Z',
      'verifiedBy', 'admin@dbr77.com',
      'verifiedAt', '2026-04-15T19:00:00Z',
      'lastUpdatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'timeline', jsonb_build_array(
        jsonb_build_object(
          'ts', '2026-04-15T07:30:00Z',
          'actor', 'admin@dbr77.com',
          'action', 'report',
          'details', 'Reported via chat + 3 screenshots showing sales CTAs for already-logged-in users'
        ),
        jsonb_build_object(
          'ts', '2026-04-15T14:00:00Z',
          'actor', 'cursor',
          'action', 'fix',
          'details', 'Commit f501e3940 refactor: turn menu demo into workspace guidance'
        ),
        jsonb_build_object(
          'ts', '2026-04-15T18:00:00Z',
          'actor', 'cursor',
          'action', 'deploy',
          'details', 'Deployed to staging for testing'
        ),
        jsonb_build_object(
          'ts', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'actor', 'cursor-cto-triage-2026-04-18',
          'action', 'backfill',
          'details', 'Backfilled into feedback registry with RESOLVED status (staging-only, prod rollout pending product review)'
        )
      )
    ),
    'resolution', jsonb_build_object(
      'type', 'refactor',
      'summary', 'Menu demo rewritten as contextual workspace guidance; removed sales CTAs for authenticated users and replaced with in-app tours tied to user role.',
      'rootCause', 'Legacy demo route shared copy with marketing landing page.',
      'verificationNotes', 'Staging verified: logged-in user sees workspace tour; sales CTAs only visible to anonymous sessions.'
    )
  )::text,
  '2026-04-15 07:30:00',
  NOW(),
  'demo-module',
  'cursor',
  NOW()
);

COMMIT;
