/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — ADMIN_ORG domain.
 *
 * THE FINDING THIS EXISTS FOR: organization membership has a split brain.
 * Canonical membership lives in `organization_members`
 * (`server/migrations/727_beta_missing_tables.sql:8-17`, unique on
 * `(organization_id, user_id)`), maintained through
 * `POST/PATCH/DELETE /api/organizations/:orgId/members[...]`
 * (`server/src/routes/organization/organizations.routes.ts:83-159`), which is
 * capability-checked, transactional, last-owner-protected and audited
 * (`orgPeopleIamService.ts:290-345`). Three writers on the `/api/admin` mount
 * disagree with that table, in two different ways:
 *
 *  - `POST /api/admin/users/bulk-import` and `POST /api/admin/users/bulk-role`
 *    (`server/src/routes/admin-bulk.routes.ts`) write only the legacy shadow —
 *    `users.organization_id`/`users.role` — and never touch
 *    `organization_members` at all. Every canonical-table reader
 *    (`orgPeopleIamService.ts:58-67`, `ownership.routes.ts:50-67`,
 *    `adminP32.routes.ts:316-319`) is blind to what these two writers do.
 *  - `POST /api/admin/people` (`server/src/routes/adminP32.routes.ts:2251-2280`)
 *    DOES write the canonical `organization_members` table, but through its own
 *    hand-rolled `getAdminActor` authorization instead of
 *    `organizationService.addMember`/`orgPeopleIamService` — a second,
 *    independently-implemented code path onto the same table, with weaker
 *    guarantees (no seat-limit check).
 *
 * `admin-bulk.routes.ts` and `adminP32.routes.ts` are both mounted at
 * `/api/admin` (`server/src/Gateway.ts:606-607`), so one config with
 * router-local paths covers every writer registered here regardless of which
 * of the two router files the guard ends up composed in front of.
 *
 * Per the lane rule, nothing here is `disabled`: none of the three writers has
 * a telemetry window yet, and two of them (bulk-import, bulk-role) have no
 * canonical successor to redirect to even if they did.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const ADMIN_ORG_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'admin_org',
  rollbackEnv: 'ADMIN_ORG_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'ADMIN_ORG_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'ADMIN_ORG_LEGACY_WRITER_DISABLED',
  unmappedCode: 'ADMIN_ORG_LEGACY_IDENTITY_UNMAPPED',
  writers: [
    {
      writerId: 'ADMIN_ORG-W05',
      method: 'POST',
      path: /^\/people\/?$/,
      state: 'protected',
      successor: '/api/organizations/:orgId/members',
      reason:
        "POST /api/admin/people (adminP32.routes.ts:2251-2280) INSERTs INTO organization_members " +
        '(adminP32.routes.ts:457-460, inside createAdminPeopleMember) — the canonical membership table — ' +
        'but authorizes the write through its own getAdminActor()+capability check (adminP32.routes.ts:286-345, ' +
        "requires 'people:write') instead of organizationService.addMember. The canonical " +
        'POST /api/organizations/:orgId/members (organizations.routes.ts:83-103) performs the equivalent ' +
        'organization_members INSERT via organizationService.addMember (organizationService.ts:340-345), ' +
        "gated by requireRole('ADMIN','OWNER','SUPERADMIN') plus an adminAuditService audit wrapper — " +
        'proven, byte-identical target table and column set, so the successor is recorded. Zero known ' +
        'frontend callers of this POST. Kept protected, not disabled: no writer retires without a telemetry window.',
    },
    {
      writerId: 'ADMIN_ORG-W06',
      method: 'POST',
      path: /^\/users\/bulk-import\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'POST /api/admin/users/bulk-import (admin-bulk.routes.ts:35-115) INSERTs a users row with ' +
        'organization_id and role set (admin-bulk.routes.ts:85-98) and never inserts a matching ' +
        'organization_members row. Every canonical membership reader (orgPeopleIamService.ts:58-67, ' +
        'ownership.routes.ts:50-67, adminP32 getAdminActor at adminP32.routes.ts:316-319) resolves ' +
        'membership from organization_members, so a user created here does not exist as an org member to ' +
        'any of them. No canonical successor exists for bulk membership creation, so this cannot be ' +
        'redirected — only observed. Live caller: src/views/superadmin/components/BulkOperationsView.tsx:216.',
    },
    {
      writerId: 'ADMIN_ORG-W07',
      method: 'POST',
      path: /^\/users\/bulk-role\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'POST /api/admin/users/bulk-role (admin-bulk.routes.ts:121-158) bulk-UPDATEs users.role only ' +
        '(admin-bulk.routes.ts:150-153) and never updates organization_members.role for the same users, ' +
        'so a user promoted here keeps their stale organization_members.role — the value every canonical ' +
        'reader (orgPeopleIamService, OrganizationController.updateMemberRole/removeMember) actually uses. ' +
        'No canonical bulk-role successor exists. Live caller: ' +
        'src/views/superadmin/components/BulkOperationsView.tsx:266.',
    },
  ],
};
