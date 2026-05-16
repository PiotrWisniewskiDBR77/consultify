import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveEffectiveAccess = vi.fn();
const mockHasEffectiveCapability = vi.fn();

vi.mock('../../../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: (...args: unknown[]) => mockResolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: unknown[]) => mockHasEffectiveCapability(...args),
}));

describe('InvitationService security scoping', () => {
  const invitation = {
    id: 'inv-1',
    organization_id: 'org-a',
    email: 'person@example.com',
    status: 'PENDING',
    resend_count: 0,
    token_hash: 'hash',
  };

  let db: any;
  let dataService: any;
  let tokenService: any;
  let sendingService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    db = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ role: 'ADMIN' })
        .mockResolvedValueOnce({ role: 'ADMIN' }),
    };
    dataService = {
      getInvitationById: vi.fn().mockResolvedValue(invitation),
      getInvitationEvents: vi.fn().mockResolvedValue([]),
      updateForResend: vi.fn(),
      markAsRevoked: vi.fn(),
      logEvent: vi.fn(),
    };
    tokenService = {
      generateSecureToken: vi.fn().mockReturnValue('new-token'),
      hashToken: vi.fn().mockReturnValue('new-hash'),
      calculateExpiryDate: vi.fn().mockReturnValue('2030-01-01T00:00:00.000Z'),
    };
    sendingService = {
      sendResentInvitation: vi.fn().mockResolvedValue('https://invite.test/new-token'),
    };
    mockResolveEffectiveAccess.mockResolvedValue({
      capabilities: ['users.invite'],
      platformRole: null,
    });
    mockHasEffectiveCapability.mockReturnValue(true);
  });

  async function createService() {
    const { InvitationServiceClass } = await import(
      '../../../../server/src/services/invitationService.js'
    );
    return new InvitationServiceClass({
      db,
      dataService,
      tokenService,
      sendingService,
      uuidv4: () => 'uuid',
    });
  }

  it('blocks resend when invitation belongs to another organization', async () => {
    const service = await createService();

    await expect(service.resendInvitation('inv-1', 'user-1', {}, 'org-b')).rejects.toThrow(
      'Invitation not found'
    );
    expect(dataService.updateForResend).not.toHaveBeenCalled();
    expect(sendingService.sendResentInvitation).not.toHaveBeenCalled();
  });

  it('blocks revoke when invitation belongs to another organization', async () => {
    const service = await createService();

    await expect(service.revokeInvitation('inv-1', 'user-1', '', {}, 'org-b')).rejects.toThrow(
      'Invitation not found'
    );
    expect(dataService.markAsRevoked).not.toHaveBeenCalled();
  });

  it('requires invite capability before returning invitation audit', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const service = await createService();

    await expect(service.getInvitationAudit('inv-1', 'org-a', 'user-1')).rejects.toThrow(
      'Missing required invitation capability'
    );
    expect(dataService.getInvitationEvents).not.toHaveBeenCalled();
  });
});
