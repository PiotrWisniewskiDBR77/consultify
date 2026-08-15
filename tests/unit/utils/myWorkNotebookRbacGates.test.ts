/**
 * M03 (My Work) + M04 (Notebook) RBAC gate contract — Harvard R2 #8.
 *
 * The navigation-permissions canon (§3 "Bramki uprawnień", L1 worklist) requires
 * that role/pilot/beta gates for M03/M04 be *explicit* — a tab or action is
 * either visible-and-usable, visible-but-locked, or hidden, never an ambiguous
 * dead control. This suite pins the composed allow/deny decisions the live shell
 * (MyWorkHub) makes so the gate cannot silently drift out of the canon again.
 *
 * SSOT under test:
 *  - src/utils/roleGuards.ts       → role bands + isPilotRestrictedRole
 *  - src/utils/pilotAccess.ts      → pilot tab/route scope
 *  - src/utils/betaAccess.ts       → beta open/closed + admin exemption
 */
import { describe, expect, it } from 'vitest';

import {
  BETA_ADMINS_EXEMPT,
  isBetaLockedForRole,
  isBetaSubareaClosed,
} from '../../../src/utils/betaAccess';
import { isPilotAllowedMyWorkTab } from '../../../src/utils/pilotAccess';
import {
  isAdminOwnerOrSuperAdminRole,
  isPilotRestrictedRole,
} from '../../../src/utils/roleGuards';

/**
 * Mirrors the gate MyWorkHub applies to the Manager tab
 * (`requiresManagerAccess: true` → hidden unless admin/manager/superadmin).
 */
const canViewManagerTab = (role: string | null | undefined): boolean =>
  isAdminOwnerOrSuperAdminRole(role) ||
  String(role || '').trim().toUpperCase() === 'MANAGER' ||
  String(role || '').trim().toUpperCase() === 'PROJECT_MANAGER';

/**
 * Mirrors the Ideas-tab lock in MyWorkHub:
 *   isLocked = isPilotParticipant || (MYWORK_IDEAS closed && role not exempt)
 */
const isIdeasTabLocked = (role: string | null | undefined): boolean =>
  isPilotRestrictedRole(role) ||
  (isBetaSubareaClosed('MYWORK_IDEAS') && isBetaLockedForRole(role));

describe('M03/M04 RBAC gates — explicit allow/deny', () => {
  describe('Manager tab (M03) — hidden for non-managers', () => {
    it('denies regular pilot/user roles', () => {
      expect(canViewManagerTab('USER')).toBe(false);
      expect(canViewManagerTab('MEMBER')).toBe(false);
      expect(canViewManagerTab('VIEWER')).toBe(false);
      expect(canViewManagerTab(null)).toBe(false);
    });

    it('allows admin/owner/superadmin and manager bands', () => {
      expect(canViewManagerTab('ADMIN')).toBe(true);
      expect(canViewManagerTab('OWNER')).toBe(true);
      expect(canViewManagerTab('SUPERADMIN')).toBe(true);
      expect(canViewManagerTab('MANAGER')).toBe(true);
      expect(canViewManagerTab('PROJECT_MANAGER')).toBe(true);
    });
  });

  describe('Pilot participants — My Work in scope, Ideas locked', () => {
    it('classifies genuine pilot respondents as restricted', () => {
      expect(isPilotRestrictedRole('USER')).toBe(true);
      expect(isPilotRestrictedRole('MEMBER')).toBe(true);
      expect(isPilotRestrictedRole('VIEWER')).toBe(true);
    });

    it('exempts delivery staff and admins from the pilot lock', () => {
      expect(isPilotRestrictedRole('CONSULTANT')).toBe(false);
      expect(isPilotRestrictedRole('PROJECT_MANAGER')).toBe(false);
      expect(isPilotRestrictedRole('MANAGER')).toBe(false);
      expect(isPilotRestrictedRole('ADMIN')).toBe(false);
      expect(isPilotRestrictedRole('SUPERADMIN')).toBe(false);
    });

    it('lets pilots use every My Work tab except Ideas', () => {
      expect(isPilotAllowedMyWorkTab('ideas')).toBe(false);
      for (const tab of ['notebook', 'inbox', 'calendar', 'tasks', 'decisions', 'home']) {
        expect(isPilotAllowedMyWorkTab(tab)).toBe(true);
      }
    });
  });

  describe('Ideas tab lock — composed decision', () => {
    it('locks Ideas for pilot respondents regardless of beta status', () => {
      expect(isIdeasTabLocked('USER')).toBe(true);
      expect(isIdeasTabLocked('VIEWER')).toBe(true);
    });

    it('locks Ideas for staff but preserves the closed-beta admin exemption', () => {
      expect(isBetaSubareaClosed('MYWORK_IDEAS')).toBe(true);
      expect(isIdeasTabLocked('CONSULTANT')).toBe(true);
      expect(isIdeasTabLocked('ADMIN')).toBe(false);
    });

    it('would keep admins in when a closed beta is admin-exempt', () => {
      // Documents the admin-exemption invariant the gate relies on.
      expect(BETA_ADMINS_EXEMPT).toBe(true);
      expect(isBetaLockedForRole('ADMIN')).toBe(false);
      expect(isBetaLockedForRole('USER')).toBe(true);
    });
  });
});
