/**
 * Guard on the switch that turns MFA enforcement ON for an organisation.
 *
 * WHY
 * ---
 * `organizations.mfa_required = 1` refuses the login of every member without an
 * enrolled second factor once the grace period is spent. If NOBODY in the
 * organisation has enrolled one, flipping that switch schedules a total
 * lockout: after the runway there is no account left that can log in, including
 * the admin who flipped it. That is the state the product must never be able to
 * reach, so it is blocked at the place where enforcement is switched on rather
 * than mourned afterwards.
 *
 * The counted population is deliberately the SAME one the login path enforces
 * against: `users.organization_id` (AuthController resolves the requirement
 * through `users u JOIN organizations o ON o.id = u.organization_id`). Counting
 * a different population — organisation_members, say — would let the guard pass
 * while login still locked everyone out.
 */

import { get as dbGet } from '../utils/DbPromise.js';

export const MFA_ENFORCE_NO_ENROLLED_ACCOUNTS = 'MFA_ENFORCE_NO_ENROLLED_ACCOUNTS';

export async function countAccountsWithEnrolledMfa(organizationId: string): Promise<number> {
  const row = await dbGet<{ enrolled: number | string }>(
    `SELECT COUNT(*) AS enrolled
       FROM users u
       JOIN user_mfa m ON m.user_id = u.id
      WHERE u.organization_id = ?
        AND m.enabled = true
        AND COALESCE(u.status, 'active') <> 'deleted'`,
    [organizationId],
    { fallback: false }
  );
  return Number(row?.enrolled ?? 0);
}

export type MfaEnforcementDenial = {
  error: string;
  code: typeof MFA_ENFORCE_NO_ENROLLED_ACCOUNTS;
  messageKey: string;
  enrolledAccounts: number;
};

/**
 * Returns a denial body when enforcement is being switched ON (off -> on) in an
 * organisation where no account has an enrolled factor. Returns null when the
 * change is safe, when enforcement is being switched OFF, or when it was
 * already on (an unrelated save of the same form must not be blocked).
 */
export async function denyUnsafeMfaEnforcement(
  organizationId: string,
  currentlyRequired: boolean,
  nextRequired: boolean
): Promise<MfaEnforcementDenial | null> {
  if (!nextRequired || currentlyRequired) return null;
  const enrolled = await countAccountsWithEnrolledMfa(organizationId);
  if (enrolled > 0) return null;
  return {
    error:
      'Nie można wymagać drugiego składnika: żadne konto w tej organizacji go nie ma. ' +
      'Skonfiguruj drugi składnik na co najmniej jednym koncie, zanim włączysz wymóg.',
    code: MFA_ENFORCE_NO_ENROLLED_ACCOUNTS,
    messageKey: 'admin.security.policyPanel.mfa.errors.noEnrolledAccounts',
    enrolledAccounts: enrolled,
  };
}
