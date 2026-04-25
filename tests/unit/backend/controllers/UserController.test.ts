import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from '../../../../server/src/controllers/UserController.js';

// Mock queryHelpers
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

import * as queryHelpers from '../../../../server/src/utils/queryHelpers.js';

describe('UserController', () => {
  let mockReq: any;
  let mockRes: any;
  let jsonFn: any;
  let statusFn: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      user: { id: 'user-1', organizationId: 'org-1' },
      params: {},
      query: {},
      body: {},
    };

    jsonFn = vi.fn().mockReturnThis();
    statusFn = vi.fn().mockReturnThis();
    mockRes = {
      status: statusFn,
      json: jsonFn,
    };
  });

  describe('getUsers', () => {
    it('should return list of users for organization', async () => {
      const mockUsers = [
        { id: 'u1', first_name: 'John', last_name: 'Doe', email: 'j@d.com', role: 'USER' },
      ];
      (queryHelpers.queryAll as any).mockResolvedValue(mockUsers);

      await UserController.getUsers(mockReq, mockRes, vi.fn());

      expect(queryHelpers.queryAll).toHaveBeenCalledWith(
        expect.stringContaining('WHERE u.organization_id = ?'),
        ['org-1', 'org-1']
      );
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          users: expect.arrayContaining([expect.objectContaining({ id: 'u1' })]),
          total: 1,
        })
      );
    });

    it('should filter users if canReview query is set', async () => {
      mockReq.query.canReview = 'true';
      (queryHelpers.queryAll as any).mockResolvedValue([]);

      await UserController.getUsers(mockReq, mockRes, vi.fn());

      expect(queryHelpers.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("role IN ('ADMIN', 'MANAGER', 'REVIEWER', 'LEADER')"),
        ['org-1', 'org-1']
      );
    });

    it('should return 401 if organizationId is missing', async () => {
      mockReq.user.organizationId = undefined;
      await UserController.getUsers(mockReq, mockRes, vi.fn());
      expect(statusFn).toHaveBeenCalledWith(401);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('getUserById', () => {
    it('should return user details', async () => {
      mockReq.params.id = 'u1';
      const mockUser = { id: 'u1', email: 'test@test.com' };
      (queryHelpers.queryOne as any).mockResolvedValue(mockUser);

      await UserController.getUserById(mockReq, mockRes, vi.fn());

      expect(queryHelpers.queryOne).toHaveBeenCalledWith(expect.stringContaining('id = ?'), [
        'u1',
        'org-1',
      ]);
      expect(jsonFn).toHaveBeenCalledWith(mockUser);
    });

    it('should return 404 if user not found', async () => {
      mockReq.params.id = 'u1';
      (queryHelpers.queryOne as any).mockResolvedValue(null);

      await UserController.getUserById(mockReq, mockRes, vi.fn());

      expect(statusFn).toHaveBeenCalledWith(404);
      expect(jsonFn).toHaveBeenCalledWith({ error: 'User not found' });
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      mockReq.params.id = 'user-1'; // Match the authenticted user ID
      mockReq.body = { firstName: 'Jane' };

      // Mock permissions: user calling is admin or updating self?
      // The controller might check permissions? Let's assume generic case for now or check implementation.
      // Reading the implementation showed mocked logic for update.
      // Let's assume standard update.

      (queryHelpers.queryRun as any).mockResolvedValue({ changes: 1 });
      (queryHelpers.queryOne as any).mockResolvedValue({ id: 'u1', first_name: 'Jane' });

      await UserController.updateUser(mockReq, mockRes, vi.fn());

      // The controller constructs SQL based on fields.
      expect(queryHelpers.queryRun).toHaveBeenCalled();
      expect(jsonFn).toHaveBeenCalled();
    });
  });
});
