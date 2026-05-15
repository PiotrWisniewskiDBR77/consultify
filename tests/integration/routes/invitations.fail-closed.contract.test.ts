import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invitationServiceMock = {
  createInvitation: vi.fn(),
  createProjectInvitation: vi.fn(),
  getInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  getInvitationAudit: vi.fn(),
};

const acceptInvitationMock = vi.fn();
const validateInvitationTokenMock = vi.fn();

vi.mock('../../../server/src/services/invitationService.js', () => ({
  default: invitationServiceMock,
  acceptInvitation: (...args: unknown[]) => acceptInvitationMock(...args),
  validateInvitationToken: (...args: unknown[]) => validateInvitationTokenMock(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    if (req.headers['x-test-auth'] === 'none') {
      req.user = undefined;
      next();
      return;
    }
    req.user = {
      id: req.headers['x-test-user-id'] || 'user-1',
      organizationId: req.headers['x-test-org-id'] || 'org-1',
      role: 'ADMIN',
    };
    next();
  },
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
    invitePublicRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));

import invitationRoutes from '../../../server/src/routes/organization/invitations.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('invitations fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/invitations', invitationRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    invitationServiceMock.getInvitations.mockResolvedValue([]);
    invitationServiceMock.createInvitation.mockResolvedValue({ id: 'inv-1' });
    invitationServiceMock.createProjectInvitation.mockResolvedValue({ id: 'inv-proj-1' });
    invitationServiceMock.resendInvitation.mockResolvedValue({ id: 'inv-1' });
    invitationServiceMock.revokeInvitation.mockResolvedValue({ id: 'inv-1', status: 'revoked' });
    invitationServiceMock.getInvitationAudit.mockResolvedValue([]);
    acceptInvitationMock.mockResolvedValue({ success: true });
    validateInvitationTokenMock.mockResolvedValue({ invitationType: 'ORG' });
  });

  it('returns coded 401 with correlation parity when org context is missing', async () => {
    const res = await request(app)
      .get('/api/invitations/org')
      .set('x-test-auth', 'none')
      .set('X-Correlation-ID', 'pack10s1-inv-org-unauthorized');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('INVITATIONS_UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication is required.');
    expect(res.body.correlationId).toBe('pack10s1-inv-org-unauthorized');
  });

  it('returns coded 400 with correlation parity for missing invitation id on resend', async () => {
    const res = await request(app)
      .post('/api/invitations/resend')
      .send({})
      .set('X-Correlation-ID', 'pack10s1-inv-resend-id-required');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('INVITATION_ID_REQUIRED');
    expect(res.body.error.message).toBe('Invitation ID is required.');
    expect(res.body.correlationId).toBe('pack10s1-inv-resend-id-required');
  });

  it('returns coded non-leaking 500 for invitation creation failures', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    invitationServiceMock.createInvitation.mockRejectedValueOnce(
      new Error('SECRET_INTERNAL_INVITE_FAILURE')
    );

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/invitations/org')
        .send({ email: 'member@example.com', role: 'USER' })
        .set('X-Correlation-ID', 'pack10s1-inv-create-fail');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('INVITATION_CREATE_FAILED');
      expect(res.body.error.message).toBe('Failed to create invitation.');
      expect(res.body.correlationId).toBe('pack10s1-inv-create-fail');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_INTERNAL_INVITE_FAILURE');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded non-leaking 500 for accept failures with unique correlation ids', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    acceptInvitationMock.mockRejectedValueOnce(new Error('SECRET_ACCEPT_INTERNAL_FAILURE'));

    try {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/invitations/accept')
        .send({
          token: 'token-1',
          email: 'member@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          password: 'Password123!',
        })
        .set('X-Correlation-ID', 'pack10s1-inv-accept-fail-1');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('INVITATION_ACCEPT_FAILED');
      expect(res.body.error.message).toBe('Failed to accept invitation.');
      expect(res.body.correlationId).toBe('pack10s1-inv-accept-fail-1');
      expect(JSON.stringify(res.body)).not.toContain('SECRET_ACCEPT_INTERNAL_FAILURE');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('returns coded 404 with second deterministic correlation id for invalid token', async () => {
    validateInvitationTokenMock.mockRejectedValueOnce(new Error('Token missing'));

    const res = await request(app)
      .get('/api/invitations/validate/not-found-token')
      .set('X-Correlation-ID', 'pack10s1-inv-validate-not-found-2');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('INVITATION_TOKEN_NOT_FOUND');
    expect(res.body.error.message).toBe('Invitation token was not found.');
    expect(res.body.correlationId).toBe('pack10s1-inv-validate-not-found-2');
  });
});
