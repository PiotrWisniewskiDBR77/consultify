/**
 * Scoped MFA enrollment ticket ("ograniczona sesja").
 *
 * WHY
 * ---
 * Once an organisation's MFA grace period is spent, a member without a second
 * factor must still be able to ENROLL one — otherwise the refusal is a dead
 * end and the account is permanently locked out of the product. The password
 * has already been verified at the point this ticket is minted, so the ticket
 * grants no authority the caller did not already prove; it grants strictly
 * LESS than a session.
 *
 * WHAT IT MAY DO
 * --------------
 * Exactly three endpoints, mounted under /api/auth/mfa-enrollment:
 * read own MFA status, start TOTP enrollment, finish TOTP enrollment.
 * Nothing else. The ticket carries `purpose: 'mfa_enrollment'`, and
 * `verifyToken` (auth.middleware.ts) refuses ANY token carrying a `purpose`
 * claim, so a ticket presented to a normal API route is a 401 — the scoping is
 * enforced by default-deny on the main door, not by a list of exceptions.
 */

import jwt from 'jsonwebtoken';

import { config } from '../config/Config.js';

export const MFA_ENROLLMENT_TICKET_PURPOSE = 'mfa_enrollment';
/** Long enough to install an authenticator app, short enough to be useless later. */
export const MFA_ENROLLMENT_TICKET_TTL_SECONDS = 15 * 60;

export type MfaEnrollmentTicketClaims = {
  id: string;
  organizationId: string;
  email?: string;
  purpose: typeof MFA_ENROLLMENT_TICKET_PURPOSE;
};

export function issueMfaEnrollmentTicket(user: {
  id: string;
  organization_id: string;
  email?: string;
}): { token: string; expiresIn: number } {
  const token = jwt.sign(
    {
      id: user.id,
      organizationId: user.organization_id,
      organization_id: user.organization_id,
      email: user.email,
      purpose: MFA_ENROLLMENT_TICKET_PURPOSE,
    },
    config.JWT_SECRET,
    { expiresIn: MFA_ENROLLMENT_TICKET_TTL_SECONDS }
  );
  return { token, expiresIn: MFA_ENROLLMENT_TICKET_TTL_SECONDS };
}

export function verifyMfaEnrollmentTicket(token: string): MfaEnrollmentTicketClaims | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (!decoded || typeof decoded !== 'object') return null;
    const claims = decoded as Record<string, unknown>;
    if (claims.purpose !== MFA_ENROLLMENT_TICKET_PURPOSE) return null;
    const id = typeof claims.id === 'string' ? claims.id.trim() : '';
    const organizationId =
      typeof claims.organizationId === 'string'
        ? claims.organizationId.trim()
        : typeof claims.organization_id === 'string'
          ? String(claims.organization_id).trim()
          : '';
    if (!id || !organizationId) return null;
    return {
      id,
      organizationId,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      purpose: MFA_ENROLLMENT_TICKET_PURPOSE,
    };
  } catch {
    return null;
  }
}
