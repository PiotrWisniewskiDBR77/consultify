/**
 * Gate for the enrollment-only mount (/api/auth/mfa-enrollment).
 *
 * Accepts EXCLUSIVELY the scoped ticket minted by AuthController after a valid
 * password when the organisation's MFA grace period is spent. A normal session
 * token is refused here on purpose: the two credentials never overlap, so
 * neither can be smuggled into the other's surface.
 *
 * The identity comes from the SIGNED ticket, never from the request body — the
 * caller cannot enroll a factor on somebody else's account.
 */

import type { NextFunction, Response } from 'express';

import { verifyMfaEnrollmentTicket } from '../services/mfaEnrollmentTicket.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import type { AuthRequest } from './auth.middleware.js';

function extractTicket(req: AuthRequest): string {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.mfaSetupToken === 'string') return body.mfaSetupToken.trim();
  const query = (req.query ?? {}) as Record<string, unknown>;
  if (typeof query.mfaSetupToken === 'string') return String(query.mfaSetupToken).trim();
  return '';
}

export const verifyMfaEnrollmentToken = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const ticket = extractTicket(req);
    if (!ticket) {
      res.status(401).json({ error: 'Unauthorized', code: 'MFA_ENROLLMENT_TICKET_MISSING' });
      return;
    }
    const claims = verifyMfaEnrollmentTicket(ticket);
    if (!claims) {
      res.status(401).json({ error: 'Unauthorized', code: 'MFA_ENROLLMENT_TICKET_INVALID' });
      return;
    }
    req.user = {
      id: claims.id,
      email: claims.email || '',
      name: claims.email || '',
      role: 'MEMBER',
      organizationId: claims.organizationId,
      isSuperAdmin: false,
      isDemo: false,
    } as AuthRequest['user'];
    req.userId = claims.id;
    req.organizationId = claims.organizationId;
    next();
  }
);
