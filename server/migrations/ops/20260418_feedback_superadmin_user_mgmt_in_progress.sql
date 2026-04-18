-- Feedback cluster: superadmin-user-mgmt (5 items)
--
-- Items resolved in commit abf1c6de5:
--   #d11ec6b0 HIGH   — "Liczba Userów w organizacji" (APLIX missing Piotr)
--   #1e3d749a HIGH   — "EDIT USER - DrDioniz" (status change rejected)
--   #682d4134 MEDIUM — "Block user" (DrDioniz) did not work
--   #b8bf4422 MEDIUM — "Impersonate" (DrDioniz) did not work
--   #76ef6831 MEDIUM — "Move user to another organization" did not work
--
-- Two shared root causes:
--
-- 1. `admin.validators.ts` enums were out of sync with the live data model
--    (role/status casing, organizationId forced to UUID). Edit / Block /
--    Move all failed at Zod validation before reaching the controller.
--
-- 2. `SuperAdminController.getOrganizations` and `getUsers` (and the org-admin
--    `UserController.getUsers`) only considered `users.organization_id` and
--    ignored the `organization_members` join table, so a user whose primary
--    tenant differs from the org they actually belong to (e.g. Piotr primary
--    = `vts`, OWNER of `aplix-na`) vanished from the APLIX panel.
--
-- Plus: Impersonate was gated by `requireConfirmation` middleware but the
-- frontend only sent `{ userId }`, so the 428 CONFIRMATION_REQUIRED response
-- surfaced as a generic toast. `Api.impersonateUser` now always sends
-- `confirmation: true` + `reason` (with a reason prompt in the UI).
--
-- Audit commit: abf1c6de5
-- Staging deploy: pending (Railway auto-deploy on push to develop)

BEGIN;

UPDATE feedback_items
   SET status = 'IN_PROGRESS',
       updated_at = NOW(),
       metadata_json = (
           COALESCE(metadata_json::jsonb, '{}'::jsonb)
           || jsonb_build_object(
                'in_progress_at', NOW()::text,
                'commit_sha', 'abf1c6de5',
                'root_cause',
                  CASE substring(id::text, 1, 8)
                    WHEN 'd11ec6b0' THEN 'getOrganizations/getUsers counted users.organization_id only; multi-tenant membership via organization_members was ignored, so OWNERs with a different primary tenant disappeared from their own org view.'
                    WHEN '1e3d749a' THEN 'UpdateUserAdminSchema.status enforced upper-case ACTIVE/INACTIVE/SUSPENDED/PENDING but DB + UI use lowercase; every status change was rejected by Zod before reaching the controller.'
                    WHEN '682d4134' THEN 'Block toggle sends status=blocked which was not in the schema enum; validation 400 surfaced as generic "Failed to block" toast.'
                    WHEN 'b8bf4422' THEN 'POST /superadmin/impersonate is gated by requireConfirmation(impersonate_user, critical); frontend only sent {userId} so middleware returned 428 CONFIRMATION_REQUIRED.'
                    WHEN '76ef6831' THEN 'organizationId required z.string().uuid() while tenant ids are slugs (vts, aplix-na, org-dbr77-system), so the move-org PUT always failed validation.'
                    ELSE NULL
                  END,
                'fix_summary',
                  'Loosen admin validators (token role/status, slug-friendly organizationId), UNION users.organization_id + organization_members in getOrganizations/getUsers, send confirmation+reason from Api.impersonateUser, validate target org exists in updateUser, surface backend error messages in UI toasts.',
                'files',
                jsonb_build_array(
                  'server/src/validators/admin.validators.ts',
                  'server/src/controllers/SuperAdminController.ts',
                  'server/src/controllers/UserController.ts',
                  'src/services/api.ts',
                  'src/components/shared/UserManagementCore.tsx'
                ),
                'timeline_entry',
                jsonb_build_object(
                  'at', NOW()::text,
                  'by', 'system',
                  'type', 'progress',
                  'note',
                  'Cluster fix landed in abf1c6de5. Validators now accept the casing/slug variants the UI actually sends; organization counts & user lists union organization_members so Piotr (OWNER of aplix-na with primary vts) shows up; impersonate sends required confirmation+reason; backend error messages surface in the toast.'
                )
              )
       )::text
 WHERE substring(id::text, 1, 8) IN (
   'd11ec6b0', '1e3d749a', '682d4134', 'b8bf4422', '76ef6831'
 );

COMMIT;
