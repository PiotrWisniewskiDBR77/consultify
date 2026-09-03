import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '../../../../server/src/config/Config.js';
import type { AuthRequest } from '../../../../server/src/middleware/auth.middleware.js';
import { verifyMfaEnrollmentToken } from '../../../../server/src/middleware/mfaEnrollmentToken.middleware.js';
import {
  issueMfaEnrollmentTicket,
  MFA_ENROLLMENT_TICKET_PURPOSE,
} from '../../../../server/src/services/mfaEnrollmentTicket.js';

describe('verifyMfaEnrollmentToken', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, body: {}, query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('runs with the explicitly selected PostgreSQL test engine', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
  });

  it('accepts a valid enrollment ticket and derives identity only from signed claims', async () => {
    const { token } = issueMfaEnrollmentTicket({
      id: 'user-owner',
      organization_id: 'org-owner',
      email: 'owner@example.test',
    });
    req.headers = { authorization: `Bearer ${token}` };
    req.body = { userId: 'user-attacker', organizationId: 'org-attacker' };

    await verifyMfaEnrollmentToken(req as AuthRequest, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.userId).toBe('user-owner');
    expect(req.organizationId).toBe('org-owner');
    expect(req.user).toMatchObject({
      id: 'user-owner',
      organizationId: 'org-owner',
      email: 'owner@example.test',
      role: 'MEMBER',
    });
  });

  it.each([
    ['missing', undefined],
    [
      'signed with a foreign secret',
      jwt.sign(
        {
          id: 'user-foreign',
          organizationId: 'org-foreign',
          purpose: MFA_ENROLLMENT_TICKET_PURPOSE,
        },
        'foreign-secret'
      ),
    ],
    [
      'expired',
      jwt.sign(
        {
          id: 'user-expired',
          organizationId: 'org-expired',
          purpose: MFA_ENROLLMENT_TICKET_PURPOSE,
        },
        config.JWT_SECRET,
        { expiresIn: -1 }
      ),
    ],
    [
      'normal session token',
      jwt.sign(
        { id: 'user-session', organizationId: 'org-session' },
        config.JWT_SECRET,
        { expiresIn: 60 }
      ),
    ],
  ])('rejects a %s credential without calling next', async (_label, token) => {
    if (token) req.headers = { authorization: `Bearer ${token}` };

    await verifyMfaEnrollmentToken(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      code: token ? 'MFA_ENROLLMENT_TICKET_INVALID' : 'MFA_ENROLLMENT_TICKET_MISSING',
    });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(req.organizationId).toBeUndefined();
  });

  it('accepts the scoped ticket from the documented body fallback', async () => {
    const { token } = issueMfaEnrollmentTicket({
      id: 'user-body',
      organization_id: 'org-body',
    });
    req.body = { mfaSetupToken: token };

    await verifyMfaEnrollmentToken(req as AuthRequest, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe('user-body');
    expect(req.organizationId).toBe('org-body');
  });
});
