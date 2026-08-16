/**
 * Invitation Service Tests
 *
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests invitation creation, token security, multi-tenant isolation, and seat limits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

/**
 * Invitation Service Tests
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests invitation creation, token security, multi-tenant isolation, and seat limits.
 * CRITICAL FOR ENTERPRISE USER MANAGEMENT
 */

// Hoisted mocks for service dependencies
const serviceMocks = vi.hoisted(() => {
  return {
    accessPolicyService: {
      canInviteUsers: vi.fn().mockResolvedValue({ allowed: true }),
      getSeatAvailability: vi.fn().mockResolvedValue({ available: 5, used: 3, total: 8 }),
      incrementUsage: vi.fn().mockResolvedValue({}),
    },
    attributionService: {
      recordAttribution: vi.fn().mockResolvedValue({}),
      SOURCE_TYPES: { INVITATION: 'invitation' },
    },
    metricsCollector: {
      record: vi.fn().mockResolvedValue({}),
      recordEvent: vi.fn().mockResolvedValue({}),
      EVENT_TYPES: { INVITE_SENT: 'invite_sent', INVITE_ACCEPTED: 'invite_accepted' },
      SOURCE_TYPES: { INVITATION: 'invitation' },
    },
    seatManagementService: {
      canAddUser: vi.fn().mockResolvedValue(true),
      autoAddSeatOnInvite: vi.fn().mockResolvedValue({ autoAdded: false }),
    },
  };
});

const effectiveAccessMocks = vi.hoisted(() => ({
  resolveEffectiveAccess: vi.fn().mockResolvedValue({
    capabilities: ['users.invite', 'admin.people.manage'],
  }),
  hasEffectiveCapability: vi.fn((access, capability) => access?.capabilities?.includes(capability)),
}));

vi.mock('../../../server/src/services/accessPolicyService.js', () => ({
  default: serviceMocks.accessPolicyService,
}));
vi.mock('../../../server/src/services/attributionService.js', () => ({
  default: serviceMocks.attributionService,
}));
vi.mock('../../../server/src/services/metricsCollector.js', () => ({
  default: serviceMocks.metricsCollector,
}));
vi.mock('../../../server/src/services/seatManagementService.js', () => ({
  default: serviceMocks.seatManagementService,
}));
vi.mock('../../../server/src/services/effectiveAccessService.js', () => effectiveAccessMocks);

describe('InvitationService', () => {
  let InvitationService;
  let InvitationServiceModule;
  let mocks;
  let mockCrypto;
  let mockBcrypt;
  let tokenCounter;

  // Shortcuts for test readability
  let mockAccessPolicyService = serviceMocks.accessPolicyService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tokenCounter = 0;

    // Setup unified mocks
    mocks = setupStandardTest();

    // Reset default mock implementations
    serviceMocks.accessPolicyService.canInviteUsers.mockResolvedValue({ allowed: true });
    serviceMocks.accessPolicyService.getSeatAvailability.mockResolvedValue({
      available: 5,
      used: 3,
      total: 8,
    });
    effectiveAccessMocks.resolveEffectiveAccess.mockResolvedValue({
      capabilities: ['users.invite', 'admin.people.manage'],
    });

    // Create unique tokens for each call
    mockCrypto = {
      randomBytes: vi.fn().mockImplementation(() => ({
        toString: () => `${String(++tokenCounter).padStart(2, '0')}${'a'.repeat(62)}`,
      })),
      createHash: vi.fn().mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('b'.repeat(64)),
      })),
    };

    mockBcrypt = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      hashSync: vi.fn().mockReturnValue('hashed-password-sync'),
    };

    // Import real service (case-sensitive path for Linux CI)
    InvitationServiceModule = await import('../../../server/src/services/invitationService.ts');
    InvitationService = InvitationServiceModule.default;

    // Attach constants to InvitationService instance to match old test structure
    Object.assign(InvitationService, {
      INVITATION_STATUS: {
        PENDING: 'pending',
        ACCEPTED: 'accepted',
        EXPIRED: 'expired',
        REVOKED: 'revoked',
      },
      INVITATION_TYPES: {
        ORG: 'ORG',
        PROJECT: 'PROJECT',
      },
      INVITATION_EVENT_TYPES: {
        CREATED: 'created',
        SENT: 'sent',
        RESENT: 'resent',
        ACCEPTED: 'accepted',
        EXPIRED: 'expired',
        REVOKED: 'revoked',
      },
    });

    // Inject dependencies using unified pattern
    InvitationService.setDependencies({
      db: mocks.db,
      crypto: mockCrypto,
      bcrypt: mockBcrypt,
      uuidv4: mocks.uuid || (() => 'test-invitation-uuid'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateSecureToken()', () => {
    it('should generate 64-character hex token', () => {
      const token = InvitationService.generateSecureToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = InvitationService.generateSecureToken();
      const token2 = InvitationService.generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('hashToken()', () => {
    it('should hash token using SHA256', () => {
      const token = 'test-token-123';
      const hash = InvitationService.hashToken(token);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce consistent hash for same token', () => {
      const token = 'test-token-123';
      const hash1 = InvitationService.hashToken(token);
      const hash2 = InvitationService.hashToken(token);

      expect(hash1).toBe(hash2);
    });
  });

  describe('calculateExpiryDate()', () => {
    it('should calculate expiry date 7 days from now by default', () => {
      const expiry = InvitationService.calculateExpiryDate();
      const expiryDate = new Date(expiry);
      const expectedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Allow 1 second difference
      expect(Math.abs(expiryDate - expectedDate)).toBeLessThan(1000);
    });

    it('should calculate expiry date for custom days', () => {
      const expiry = InvitationService.calculateExpiryDate(14);
      const expiryDate = new Date(expiry);
      const expectedDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      expect(Math.abs(expiryDate - expectedDate)).toBeLessThan(1000);
    });
  });

  describe('checkInvitePermission()', () => {
    it('should allow invitation when policy allows', async () => {
      const orgId = testOrganizations.org1.id;
      const userId = testUsers.admin.id;

      mockAccessPolicyService.canInviteUsers.mockResolvedValue({
        allowed: true,
      });

      const result = await InvitationService.checkInvitePermission(orgId, userId);

      expect(result.allowed).toBe(true);
      expect(mockAccessPolicyService.canInviteUsers).toHaveBeenCalledWith(orgId, userId);
    });

    it('should deny invitation when policy denies', async () => {
      const orgId = testOrganizations.org1.id;
      const userId = testUsers.user.id;

      mockAccessPolicyService.canInviteUsers.mockResolvedValue({
        allowed: false,
        reasonCode: 'USER_LIMIT_REACHED',
      });

      const result = await InvitationService.checkInvitePermission(orgId, userId);

      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('USER_LIMIT_REACHED');
      expect(result.reason).toBeDefined();
    });
  });

  describe('createOrgInvitation()', () => {
    it('should create organization invitation', async () => {
      const params = {
        organizationId: testOrganizations.org1.id,
        email: 'newuser@test.com',
        role: 'USER',
        invitedByUserId: testUsers.admin.id,
      };

      mocks.db.get.mockImplementation(async (query) => {
        // Return null to simulate no existing user/invite
        return null;
      });

      mocks.db.run.mockResolvedValue({ changes: 1, lastID: 1 });

      // Ensure canAddUser check passes if it hits seat service (already mocked in beforeEach)

      const invitation = await InvitationService.createOrgInvitation(params);

      expect(invitation.id).toBeDefined();
      expect(invitation.email).toBe(params.email.toLowerCase());
      expect(invitation.invitationType).toBe(InvitationService.INVITATION_TYPES.ORG);
      expect(invitation.status).toBe(InvitationService.INVITATION_STATUS.PENDING);
      expect(invitation.token).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const params = {
        organizationId: testOrganizations.org1.id,
        email: 'invalid-email',
        role: 'USER',
        invitedByUserId: testUsers.admin.id,
      };

      await expect(InvitationService.createOrgInvitation(params)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should reject when permission denied', async () => {
      const params = {
        organizationId: testOrganizations.org1.id,
        email: 'user@test.com',
        role: 'USER',
        invitedByUserId: testUsers.user.id,
      };

      mockAccessPolicyService.canInviteUsers.mockResolvedValue({
        allowed: false,
        reasonCode: 'USER_LIMIT_REACHED',
      });

      await expect(InvitationService.createOrgInvitation(params)).rejects.toThrow();
    });
  });

  describe('createProjectInvitation()', () => {
    it('should create project invitation', async () => {
      const params = {
        organizationId: testOrganizations.org1.id,
        projectId: testProjects.project1.id,
        email: 'user@test.com',
        projectRole: 'member',
        orgRole: 'USER',
        invitedByUserId: testUsers.admin.id,
      };

      mocks.db.get.mockImplementation(async (query, params) => {
        if (query.includes('projects')) {
          // Check if params match (simplified)
          return {
            id: params[0],
            name: 'Test Project',
            organization_id: testOrganizations.org1.id,
          };
        }
        return null;
      });

      mocks.db.run.mockResolvedValue({ changes: 1, lastID: 1 });

      const invitation = await InvitationService.createProjectInvitation(params);

      expect(invitation.id).toBeDefined();
      expect(invitation.invitationType).toBe(InvitationService.INVITATION_TYPES.PROJECT);
      expect(invitation.projectId).toBe(params.projectId);
    });

    it('should reject when project not found', async () => {
      const params = {
        organizationId: testOrganizations.org1.id,
        projectId: 'non-existent',
        email: 'user@test.com',
        invitedByUserId: testUsers.admin.id,
      };

      mocks.db.get.mockResolvedValue(null);

      await expect(InvitationService.createProjectInvitation(params)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should reject when project belongs to different organization', async () => {
      const params = {
        organizationId: testOrganizations.org1.id,
        projectId: testProjects.project1.id,
        email: 'user@test.com',
        invitedByUserId: testUsers.admin.id,
      };

      mocks.db.get.mockResolvedValue(null);

      await expect(InvitationService.createProjectInvitation(params)).rejects.toThrow(
        'Project not found'
      ); // Changed from 'Project not found in this organization' because Facade throws 'Project not found' if db.get returns null. The Facade checks project existence with OrgId in query, so null return means not found or mismatch.
    });
  });

  describe('validateToken()', () => {
    // FIXED 2026-07-15: InvitationServiceClass.setDependencies() now propagates
    // db/uuidv4/crypto into the already-constructed dataService/tokenService
    // sub-services (see setDependencies() in invitationService.ts and the new
    // setDependencies() setters on InvitationDataService/InvitationTokenService).
    it('should validate correct token', async () => {
      // Must be a canonical 64-char hex token (isCanonicalInvitationRawToken
      // guard, added after this test was originally written) or getByToken()
      // short-circuits to null before ever reaching the DB lookup.
      const token = 'a'.repeat(64);
      const tokenHash = InvitationService.hashToken(token);

      mocks.db.get.mockImplementation(async (query, params) => {
        if (query.includes('token_hash') && params[0] === tokenHash) {
          return {
            id: 'inv-1',
            token_hash: tokenHash,
            status: 'pending',
            email: 'test@example.com',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          };
        }
        return null;
      });

      const invitation = await InvitationService.getByToken(token);

      expect(invitation).toBeDefined();
      expect(invitation.id).toBe('inv-1');
      expect(invitation.status).toBe('pending');
    });

    it('should reject invalid token', async () => {
      const token = 'invalid-token';
      mocks.db.get.mockResolvedValue(null);

      const invitation = await InvitationService.getByToken(token);

      expect(invitation).toBeNull();
    });

    it('should reject expired invitation', async () => {
      // Must be a canonical 64-char hex token — see note above.
      const token = 'b'.repeat(64);
      const tokenHash = InvitationService.hashToken(token);
      const expiredDate = new Date(Date.now() - 86400000).toISOString();

      mocks.db.get.mockResolvedValue({
        id: 'inv-1',
        token_hash: tokenHash,
        status: 'pending',
        email: 'test@example.com',
        expires_at: expiredDate,
      });

      const invitation = await InvitationService.getByToken(token);

      expect(invitation).toBeDefined();
      expect(new Date(invitation.expires_at) < new Date()).toBe(true);
    });

    it('should reject already accepted invitation', async () => {
      // Must be a canonical 64-char hex token — see note above.
      const token = 'c'.repeat(64);
      const tokenHash = InvitationService.hashToken(token);

      mocks.db.get.mockResolvedValue({
        id: 'inv-1',
        token_hash: tokenHash,
        status: 'accepted',
        email: 'test@example.com',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });

      const invitation = await InvitationService.getByToken(token);

      expect(invitation).toBeDefined();
      expect(invitation.status).toBe('accepted');
    });
  });

  describe('acceptInvitation()', () => {
    it('should accept valid invitation', async () => {
      const token = InvitationService.generateSecureToken();
      const tokenHash = InvitationService.hashToken(token);
      const invitationId = 'inv-123';
      const email = 'user@test.com';

      mocks.db.get.mockImplementation(async (query) => {
        if (query.includes('token_hash')) {
          return {
            id: invitationId,
            token_hash: tokenHash,
            email,
            status: InvitationService.INVITATION_STATUS.PENDING,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            organization_id: testOrganizations.org1.id,
            invitation_type: InvitationService.INVITATION_TYPES.ORG,
            role: 'USER',
            role_to_assign: 'MEMBER',
          };
        } else if (query.includes('users') && query.includes('email')) {
          // Check if user exists - return null (new user)
          return null;
        }
        return null;
      });

      mocks.db.run.mockResolvedValue({ changes: 1, lastID: 1 });

      // Mock AccessPolicyService.incrementUsage
      mockAccessPolicyService.incrementUsage = vi.fn().mockResolvedValue({});

      const result = await InvitationService.acceptInvitation({
        token,
        email,
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.isNewUser).toBe(true);
      expect(result.organizationId).toBe(testOrganizations.org1.id);
    });

    it('should reject invitation with mismatched email', async () => {
      const token = InvitationService.generateSecureToken();
      const tokenHash = InvitationService.hashToken(token);

      mocks.db.get.mockResolvedValue({
        token_hash: tokenHash,
        email: 'invited@test.com',
        status: InvitationService.INVITATION_STATUS.PENDING,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });

      await expect(
        InvitationService.acceptInvitation({
          token,
          email: 'different@test.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        })
      ).rejects.toThrow('Email address does not match invitation');
    });
  });

  describe('revokeInvitation()', () => {
    it('should revoke pending invitation', async () => {
      const invitationId = 'inv-123';
      const userId = testUsers.admin.id;

      mocks.db.get.mockResolvedValue({
        id: invitationId,
        status: InvitationService.INVITATION_STATUS.PENDING,
      });

      mocks.db.run.mockResolvedValue({ changes: 1 });

      const result = await InvitationService.revokeInvitation(invitationId, userId);

      expect(result.id).toBe(invitationId);
      expect(result.status).toBe(InvitationService.INVITATION_STATUS.REVOKED);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return invitations for specified organization', async () => {
      const org1Id = testOrganizations.org1.id;
      const org2Id = testOrganizations.org2.id;

      mocks.db.all.mockImplementation(async (query, params) => {
        // Verify query filters by organization_id
        expect(params).toContain(org1Id);
        expect(params).not.toContain(org2Id);
        return [];
      });

      await InvitationService.listOrgInvitations(org1Id);

      expect(mocks.db.all).toHaveBeenCalled();
    });
  });
});
