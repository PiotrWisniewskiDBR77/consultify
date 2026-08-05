import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrganizationController } from '../../../../server/src/controllers/OrganizationController.js';

// Mock the organization service
vi.mock('../../../../server/src/services/organizationService.js', () => ({
  getUserOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  getOrganizationById: vi.fn(),
  getOrganization: vi.fn(),
  getMembers: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));

// Import the mocked service to set return values
import * as organizationService from '../../../../server/src/services/organizationService.js';

describe('OrganizationController', () => {
  let mockReq: any;
  let mockRes: any;
  let jsonFn: any;
  let statusFn: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      user: { id: 'user-1', role: 'USER' },
      params: {},
      body: {},
    };

    jsonFn = vi.fn().mockReturnThis();
    statusFn = vi.fn().mockReturnThis();
    mockRes = {
      status: statusFn,
      json: jsonFn,
      set: vi.fn().mockReturnThis(),
    };
  });

  describe('getCurrentOrganizations', () => {
    it('should return user organizations', async () => {
      const mockOrgs = [{ id: 'org-1', name: 'Test Org' }];
      (organizationService.getUserOrganizations as any).mockResolvedValue(mockOrgs);

      await OrganizationController.getCurrentOrganizations(mockReq, mockRes, vi.fn());

      expect(organizationService.getUserOrganizations).toHaveBeenCalledWith('user-1');
      expect(jsonFn).toHaveBeenCalledWith({
        organizations: [
          expect.objectContaining({
            id: 'org-1',
            name: 'Test Org',
          }),
        ],
      });
      expect(mockRes.set).toHaveBeenCalledWith('Cache-Control', 'no-store, private');
    });

    it('should return 401 if user is not authenticated', async () => {
      mockReq.user = undefined;
      await OrganizationController.getCurrentOrganizations(mockReq, mockRes, vi.fn());
      expect(statusFn).toHaveBeenCalledWith(401);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('createOrganization', () => {
    it('should create organization successfully', async () => {
      mockReq.body = { name: 'New Org', industry: 'Tech' };
      const createdOrg = { id: 'org-new', name: 'New Org', industry: 'Tech' };
      (organizationService.createOrganization as any).mockResolvedValue(createdOrg);

      await OrganizationController.createOrganization(mockReq, mockRes, vi.fn());

      expect(organizationService.createOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          name: 'New Org',
          industry: 'Tech',
        })
      );
      expect(statusFn).toHaveBeenCalledWith(201);
      expect(jsonFn).toHaveBeenCalledWith(createdOrg);
    });

    it('should return 400 if name is missing', async () => {
      mockReq.body = { industry: 'Tech' };
      await OrganizationController.createOrganization(mockReq, mockRes, vi.fn());
      expect(statusFn).toHaveBeenCalledWith(400);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Name is required' });
    });
  });

  describe('getOrganizationById', () => {
    it('should return organization if user is a member', async () => {
      mockReq.params.orgId = 'org-1';

      // Mock getMembers to include current user
      (organizationService.getMembers as any).mockResolvedValue([
        { user_id: 'user-1', role: 'MEMBER' },
      ]);

      const mockOrg = { id: 'org-1', name: 'Test Org' };
      (organizationService.getOrganization as any).mockResolvedValue(mockOrg);

      await OrganizationController.getOrganizationById(mockReq, mockRes, vi.fn());

      expect(organizationService.getOrganization).toHaveBeenCalledWith('org-1');
      expect(jsonFn).toHaveBeenCalledWith(mockOrg);
    });

    it('should return 403 if user is not a member and not SUPERADMIN', async () => {
      mockReq.params.orgId = 'org-1';
      // User not in members list
      (organizationService.getMembers as any).mockResolvedValue([
        { user_id: 'other-user', role: 'MEMBER' },
      ]);

      await OrganizationController.getOrganizationById(mockReq, mockRes, vi.fn());

      expect(statusFn).toHaveBeenCalledWith(403);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(organizationService.getOrganization).not.toHaveBeenCalled();
    });

    it('should allow SUPERADMIN even if not a member', async () => {
      mockReq.params.orgId = 'org-1';
      mockReq.user.role = 'SUPERADMIN';

      (organizationService.getMembers as any).mockResolvedValue([
        { user_id: 'other-user', role: 'MEMBER' },
      ]);
      const mockOrg = { id: 'org-1', name: 'Test Org' };
      (organizationService.getOrganization as any).mockResolvedValue(mockOrg);

      await OrganizationController.getOrganizationById(mockReq, mockRes, vi.fn());

      expect(jsonFn).toHaveBeenCalledWith(mockOrg);
    });
  });
});
