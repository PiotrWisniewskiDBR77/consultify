import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from '../../../../server/src/controllers/UserController.js';

// Mock queryHelpers
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(),
}));

import * as queryHelpers from '../../../../server/src/utils/queryHelpers.js';
import { getTableColumns } from '../../../../server/src/utils/dbSchema.js';

describe('UserController', () => {
  let mockReq: any;
  let mockRes: any;
  let jsonFn: any;
  let statusFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTableColumns).mockImplementation(async (table: string) => {
      if (table === 'users') {
        return new Set([
          'id',
          'organization_id',
          'first_name',
          'last_name',
          'email',
          'status',
          'role',
          'updated_at',
        ]);
      }
      if (table === 'user_profiles') {
        return new Set(['id', 'user_id', 'job_title', 'department', 'updated_at']);
      }
      if (table === 'user_profile_extended') {
        return new Set(['user_id', 'department', 'title', 'updated_at']);
      }
      return new Set();
    });

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

    it('persists job title and department to user_profiles when users columns are missing', async () => {
      mockReq.params.id = 'user-1';
      mockReq.body = { jobTitle: 'Plant Lead', department: 'Engineering' };
      vi.mocked(getTableColumns).mockImplementation(async (table: string) => {
        if (table === 'users') {
          return new Set(['id', 'organization_id', 'updated_at']);
        }
        if (table === 'user_profiles') {
          return new Set(['id', 'user_id', 'job_title', 'department', 'updated_at']);
        }
        return new Set();
      });
      (queryHelpers.queryRun as any)
        .mockResolvedValueOnce({ changes: 0 })
        .mockResolvedValueOnce({ changes: 1 });

      await UserController.updateUser(mockReq, mockRes, vi.fn());

      expect(queryHelpers.queryRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_profiles SET'),
        expect.arrayContaining(['Plant Lead', 'Engineering', expect.any(String), 'user-1'])
      );
      expect(queryHelpers.queryRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_profiles'),
        expect.arrayContaining([expect.any(String), 'user-1'])
      );
      expect(jsonFn).toHaveBeenCalledWith({
        id: 'user-1',
        message: 'User updated successfully',
      });
    });

    it('persists to user_profile_extended when users and user_profiles lack profile columns', async () => {
      mockReq.params.id = 'user-1';
      mockReq.body = { jobTitle: 'Engineering Manager', department: 'Engineering' };
      vi.mocked(getTableColumns).mockImplementation(async (table: string) => {
        if (table === 'users') {
          return new Set(['id', 'organization_id', 'updated_at']);
        }
        if (table === 'user_profiles') {
          return new Set(['id', 'user_id', 'updated_at']);
        }
        if (table === 'user_profile_extended') {
          return new Set(['user_id', 'department', 'title', 'updated_at']);
        }
        return new Set();
      });
      (queryHelpers.queryRun as any)
        .mockResolvedValueOnce({ changes: 0 })
        .mockResolvedValueOnce({ changes: 1 });

      await UserController.updateUser(mockReq, mockRes, vi.fn());

      expect(queryHelpers.queryRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_profile_extended SET'),
        expect.arrayContaining(['Engineering Manager', 'Engineering', expect.any(String), 'user-1'])
      );
      expect(queryHelpers.queryRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_profile_extended'),
        expect.arrayContaining(['user-1', 'Engineering Manager', 'Engineering', expect.any(String)])
      );
      expect(jsonFn).toHaveBeenCalledWith({
        id: 'user-1',
        message: 'User updated successfully',
      });
    });

    it('does not scope self profile updates by active organization id', async () => {
      mockReq.params.id = 'user-1';
      mockReq.user.organizationId = 'active-org-not-primary-org';
      mockReq.body = { firstName: 'Jane' };
      (queryHelpers.queryRun as any).mockResolvedValue({ changes: 1 });

      await UserController.updateUser(mockReq, mockRes, vi.fn());

      expect(queryHelpers.queryRun).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        ['Jane', expect.any(String), 'user-1']
      );
      expect(String((queryHelpers.queryRun as any).mock.calls[0][0])).not.toContain(
        'organization_id = ?'
      );
    });
  });
});
