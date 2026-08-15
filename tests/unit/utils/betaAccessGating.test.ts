/**
 * M03 L-01 — beta gating logic for the My Work → Ideas sub-area.
 *
 * Pins the actual behaviour of the gate (the in-code comment at MyWorkHub had
 * drifted to claim BETA_ADMINS_EXEMPT=false / "everyone blocked", which was
 * false). The gate locks the Ideas tab only when the sub-area is 'closed' AND
 * the role is not exempt. This test documents the truth so the comment can't
 * silently rot again.
 */
import { describe, expect, it } from 'vitest';

import {
  BETA_ADMINS_EXEMPT,
  isBetaLockedForRole,
  isBetaSubareaClosed,
} from '../../../src/utils/betaAccess';

describe('M03 L-01 — beta gating', () => {
  it('MYWORK_IDEAS current config is closed', () => {
    expect(isBetaSubareaClosed('MYWORK_IDEAS')).toBe(true);
  });

  it('unknown sub-area ids are treated as not-closed', () => {
    expect(isBetaSubareaClosed('DOES_NOT_EXIST')).toBe(false);
    expect(isBetaSubareaClosed(null)).toBe(false);
    expect(isBetaSubareaClosed(undefined)).toBe(false);
  });

  describe('isBetaLockedForRole', () => {
    if (BETA_ADMINS_EXEMPT) {
      it('admins are exempt, non-admins are locked (EXEMPT=true)', () => {
        expect(isBetaLockedForRole('admin')).toBe(false);
        expect(isBetaLockedForRole('owner')).toBe(false);
        expect(isBetaLockedForRole('superadmin')).toBe(false);
        expect(isBetaLockedForRole('member')).toBe(true);
        expect(isBetaLockedForRole(null)).toBe(true);
      });
    } else {
      it('everyone is locked when EXEMPT=false', () => {
        expect(isBetaLockedForRole('admin')).toBe(true);
        expect(isBetaLockedForRole('member')).toBe(true);
      });
    }
  });

  it('effective lock requires BOTH closed sub-area AND non-exempt role', () => {
    const effective = (role: string | null) =>
      isBetaSubareaClosed('MYWORK_IDEAS') && isBetaLockedForRole(role);
    expect(effective('member')).toBe(true);
    expect(effective('admin')).toBe(false);
  });
});
