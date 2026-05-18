/**
 * InvitationController unit tests (aligned with current controller + dynamic imports)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvitationServiceDefault = {
  getInvitations: vi.fn(),
  createInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  getInvitationAudit: vi.fn(),
};

const mockAcceptInvitation = vi.fn();
const mockValidateInvitationToken = vi.fn();

vi.mock('../../../../server/src/services/invitationService.js', () => ({
  default: mockInvitationServiceDefault,
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
  validateInvitationToken: (...args: unknown[]) => mockValidateInvitationToken(...args),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
  asyncHandler: (fn: Function) => fn,
}));

describe('InvitationController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      user: { id: 'user-123', organizationId: 'org-456' },
      params: {},
      query: {},
      body: {},
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('getInvitations should return 401 without org', async () => {
    mockReq.user.organizationId = null;
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.getInvitations(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('getInvitations should return service payload', async () => {
    mockInvitationServiceDefault.getInvitations.mockResolvedValueOnce({
      invitations: [],
      total: 0,
    });
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.getInvitations(mockReq, mockRes, mockNext);

    expect(mockInvitationServiceDefault.getInvitations).toHaveBeenCalledWith('org-456');
    expect(mockRes.json).toHaveBeenCalledWith({ invitations: [], total: 0 });
  });

  it('createInvitation should return 201 on success', async () => {
    mockReq.body = { email: 'new@user.com', role: 'member', message: 'hi' };
    mockInvitationServiceDefault.createInvitation.mockResolvedValueOnce({ id: 'inv-1' });

    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.createInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, invitation: { id: 'inv-1' } })
    );
  });

  it('resendInvitation should 400 without id', async () => {
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.resendInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invitation ID is required' });
  });

  it('resendInvitation should 401 without organization context', async () => {
    mockReq.body = { invitationId: 'inv-1' };
    mockReq.user.organizationId = null;
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.resendInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockInvitationServiceDefault.resendInvitation).not.toHaveBeenCalled();
  });

  it('resendInvitation forwards organization context to service', async () => {
    mockReq.body = { invitationId: 'inv-1' };
    mockInvitationServiceDefault.resendInvitation.mockResolvedValueOnce({ id: 'inv-1' });
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.resendInvitation(mockReq, mockRes, mockNext);

    expect(mockInvitationServiceDefault.resendInvitation).toHaveBeenCalledWith(
      'inv-1',
      'user-123',
      {},
      'org-456'
    );
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('acceptInvitation should return 400 on matching/accepted errors', async () => {
    mockReq.body = { token: 't', email: 'e', firstName: 'a', lastName: 'b', password: 'x' };
    mockAcceptInvitation.mockRejectedValueOnce(new Error('Token does not match'));

    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.acceptInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token does not match' });
  });

  it('acceptInvitation should return 400 on known invitation domain errors', async () => {
    mockReq.body = { token: 't', email: 'e', firstName: 'a', lastName: 'b', password: 'x' };
    mockAcceptInvitation.mockRejectedValueOnce(new Error('Invitation has expired'));

    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.acceptInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invitation has expired' });
  });

  it('acceptInvitation should keep 500 for unexpected failures', async () => {
    mockReq.body = { token: 't', email: 'e', firstName: 'a', lastName: 'b', password: 'x' };
    mockAcceptInvitation.mockRejectedValueOnce(new Error('Database exploded'));

    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.acceptInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database exploded' });
  });

  it('validateToken should include role and expiry details in success payload', async () => {
    mockReq.params = { token: 'invite-token-1' };
    mockValidateInvitationToken.mockResolvedValueOnce({
      invitationType: 'ORG',
      organizationName: 'Org A',
      email: 'invitee@example.com',
      roleToAssign: 'ADMIN',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.validateToken(mockReq, mockRes, mockNext);

    expect(mockValidateInvitationToken).toHaveBeenCalledWith('invite-token-1');
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        valid: true,
        roleToAssign: 'ADMIN',
        expiresAt: '2026-06-01T00:00:00.000Z',
      })
    );
  });

  it('getInvitationAudit should 401 without organization context', async () => {
    mockReq.params = { id: 'inv-1' };
    mockReq.user.organizationId = null;
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.getInvitationAudit(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockInvitationServiceDefault.getInvitationAudit).not.toHaveBeenCalled();
  });

  it('getInvitationAudit forwards org + user context', async () => {
    mockReq.params = { id: 'inv-77' };
    mockInvitationServiceDefault.getInvitationAudit.mockResolvedValueOnce([]);
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.getInvitationAudit(mockReq, mockRes, mockNext);

    expect(mockInvitationServiceDefault.getInvitationAudit).toHaveBeenCalledWith(
      'inv-77',
      'org-456',
      'user-123'
    );
    expect(mockRes.json).toHaveBeenCalledWith([]);
  });

  it('cancelInvitation should 401 without organization context', async () => {
    mockReq.params = { id: 'inv-1' };
    mockReq.user.organizationId = null;
    const { InvitationController } =
      await import('../../../../server/src/controllers/InvitationController.js');
    await InvitationController.cancelInvitation(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockInvitationServiceDefault.revokeInvitation).not.toHaveBeenCalled();
  });
});
