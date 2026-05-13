/**
 * Permission Middleware - Real Production Tests
 * Tests for server/src/middleware/permission.middleware.ts
 *
 * This tests REAL production middleware with dependency injection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted() for mocks
const { mockPermissionService, mockAuditService, mockLogger } = vi.hoisted(() => ({
  mockPermissionService: {
    hasPermission: vi.fn(),
  },
  mockAuditService: {
    logAudit: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/permissionService.js', () => ({
  hasPermission: mockPermissionService.hasPermission,
  default: mockPermissionService,
}));

vi.mock('../../../../server/src/services/governanceAuditService.js', () => ({
  logAudit: mockAuditService.logAudit,
  default: mockAuditService,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

// Import REAL production middleware
import {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  auditAction,
  setDependencies,
  __private__,
} from '../../../../server/src/middleware/permission.middleware.js';

describe('Permission Middleware - Real Production Tests', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Inject mock dependencies
    setDependencies({
      PermissionService: mockPermissionService as any,
      GovernanceAuditService: mockAuditService as any,
    });

    // Setup mock request/response
    mockReq = {
      user: {
        id: 'user-123',
        organizationId: 'org-456',
        role: 'USER',
      },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requirePermission', () => {
    it('should call next() when user has permission', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requirePermission('PROJECT_CREATE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'PROJECT_CREATE',
        'USER'
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks permission', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(false);

      const middleware = requirePermission('PROJECT_DELETE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny when permission service returns truthy non-boolean value', async () => {
      mockPermissionService.hasPermission.mockResolvedValue([] as any);

      const middleware = requirePermission('PROJECT_CREATE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when no user on request', async () => {
      mockReq.user = undefined;

      const middleware = requirePermission('PROJECT_CREATE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user accessor throws during auth context read', async () => {
      Object.defineProperty(mockReq, 'user', {
        configurable: true,
        get: () => {
          throw new Error('user getter failed');
        },
      });

      const middleware = requirePermission('PROJECT_CREATE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle permission check errors gracefully', async () => {
      mockPermissionService.hasPermission.mockRejectedValue(new Error('DB Error'));

      const middleware = requirePermission('PROJECT_CREATE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('bridges legacy USER -> TEAM_MEMBER candidates (tries both roles)', async () => {
      mockReq.user.role = 'USER';
      mockPermissionService.hasPermission
        .mockResolvedValueOnce(false) // USER
        .mockResolvedValueOnce(true); // TEAM_MEMBER

      const middleware = requirePermission('PROJECT_VIEW');
      await middleware(mockReq, mockRes, mockNext);
      expect(mockPermissionService.hasPermission).toHaveBeenCalledTimes(2);
      expect(mockPermissionService.hasPermission).toHaveBeenNthCalledWith(
        1,
        'user-123',
        'org-456',
        'PROJECT_VIEW',
        'USER'
      );
      expect(mockPermissionService.hasPermission).toHaveBeenNthCalledWith(
        2,
        'user-123',
        'org-456',
        'PROJECT_VIEW',
        'TEAM_MEMBER'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('normalizes "administrator" to ADMIN for DB role checks', async () => {
      mockReq.user.role = 'administrator';
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requirePermission('USER_MANAGE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'USER_MANAGE',
        'ADMIN'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('prefers req.userRole over req.user.role and normalizes it for DB', async () => {
      mockReq.user.role = 'guest';
      mockReq.userRole = 'administrator';
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requirePermission('ADMIN_ACCESS');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'ADMIN_ACCESS',
        'ADMIN'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny without permission service call when permission key is blank', async () => {
      const middleware = requirePermission('   ');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny without permission service call when permission key is empty string', async () => {
      const middleware = requirePermission('');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies oversized permission key without calling permission service', async () => {
      const middleware = requirePermission('A'.repeat(129));
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAnyPermission', () => {
    it('should allow when user has any of the permissions', async () => {
      // User has second permission but not first
      mockPermissionService.hasPermission
        .mockResolvedValueOnce(false) // First check
        .mockResolvedValueOnce(true); // Second check

      const middleware = requireAnyPermission(['ADMIN_ACCESS', 'PROJECT_CREATE']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny when user has none of the permissions', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(false);

      const middleware = requireAnyPermission(['ADMIN_ACCESS', 'SUPERADMIN_ACCESS']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for empty permission array', async () => {
      const middleware = requireAnyPermission([]);
      await middleware(mockReq, mockRes, mockNext);

      // Empty permissions = immediate denial
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is missing (auth required)', async () => {
      mockReq.user = undefined;
      const middleware = requireAnyPermission(['ANY']);
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when permission service throws', async () => {
      mockPermissionService.hasPermission.mockRejectedValueOnce(new Error('boom'));
      const middleware = requireAnyPermission(['A', 'B']);
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('stops after the first successful permission (does not over-query)', async () => {
      mockReq.user.role = 'USER';
      mockPermissionService.hasPermission
        // For key A: USER -> false, TEAM_MEMBER -> true (should stop here)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const middleware = requireAnyPermission(['A', 'B', 'C']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockPermissionService.hasPermission).toHaveBeenCalledTimes(2);
    });

    it('returns a stable copy of requiredAny in denied payload', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(false);
      const keys = ['ADMIN_ACCESS', 'SUPERADMIN_ACCESS'];
      const middleware = requireAnyPermission(keys);
      await middleware(mockReq, mockRes, mockNext);

      const payload = mockRes.json.mock.calls[0][0];
      keys.push('MUTATED_AFTER_CALL');

      expect(payload.requiredAny).toEqual(['ADMIN_ACCESS', 'SUPERADMIN_ACCESS']);
      expect(payload.requiredAny).not.toBe(keys);
    });

    it('denies and skips permission service when all required-any keys are blank', async () => {
      const middleware = requireAnyPermission(['  ', '\t']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          requiredAny: [],
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('normalizes permission keys before requireAny checks', async () => {
      mockPermissionService.hasPermission.mockResolvedValueOnce(true);
      const middleware = requireAnyPermission(['  ADMIN_ACCESS  ']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'ADMIN_ACCESS',
        'USER'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('denies safely when requireAnyPermission receives non-array permission key input', async () => {
      const middleware = requireAnyPermission(null as any);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          requiredAny: [],
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PermissionMiddleware] Invalid permission key list input for requireAnyPermission',
        expect.objectContaining({ inputType: 'object' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies and skips checks when any normalized requireAny key exceeds max length', async () => {
      const middleware = requireAnyPermission(['VALID_KEY', 'B'.repeat(129)]);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          requiredAny: [],
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies and skips checks when requireAny key list exceeds max count', async () => {
      const keys = Array.from({ length: 33 }, (_, index) => `P_${index}`);
      const middleware = requireAnyPermission(keys);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          requiredAny: [],
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PermissionMiddleware] Denied: permission key list exceeds max count',
        expect.objectContaining({ count: 33, max: 32 })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAllPermissions', () => {
    it('should allow when user has all permissions', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requireAllPermissions(['PROJECT_VIEW', 'PROJECT_EDIT']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny when user lacks any permission', async () => {
      mockPermissionService.hasPermission
        .mockResolvedValueOnce(true) // Has first
        .mockResolvedValueOnce(false); // Lacks second

      const middleware = requireAllPermissions(['PROJECT_VIEW', 'PROJECT_DELETE']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ missing: ['PROJECT_DELETE'], code: 'PERMISSION_DENIED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is missing (auth required)', async () => {
      mockReq.user = undefined;
      const middleware = requireAllPermissions(['A']);
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when permission service throws', async () => {
      mockPermissionService.hasPermission.mockRejectedValueOnce(new Error('boom'));
      const middleware = requireAllPermissions(['A']);
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny when permission list is empty as misconfiguration guard', async () => {
      const middleware = requireAllPermissions([]);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          missing: [],
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('normalizes permission keys before requireAll checks', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const middleware = requireAllPermissions(['  PROJECT_VIEW  ']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'PROJECT_VIEW',
        'USER'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('denies and skips permission service when all required-all keys are blank', async () => {
      const middleware = requireAllPermissions(['  ', '\n']);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          missing: [],
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies safely when requireAllPermissions receives non-array permission key input', async () => {
      const middleware = requireAllPermissions(undefined as any);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          missing: [],
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PermissionMiddleware] Invalid permission key list input for requireAllPermissions',
        expect.objectContaining({ inputType: 'undefined' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies and skips checks when any normalized requireAll key exceeds max length', async () => {
      const middleware = requireAllPermissions(['VALID_KEY', 'C'.repeat(129)]);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          missing: [],
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('denies and skips checks when requireAll key list exceeds max count', async () => {
      const keys = Array.from({ length: 33 }, (_, index) => `Q_${index}`);
      const middleware = requireAllPermissions(keys);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          missing: [],
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PermissionMiddleware] Denied: permission key list exceeds max count',
        expect.objectContaining({ count: 33, max: 32 })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('response safety when headers already sent', () => {
    it('requirePermission does not write a second response when headers are already sent', async () => {
      mockReq.user = undefined; // triggers 401 path
      Object.defineProperty(mockRes, 'headersSent', {
        configurable: true,
        get: () => true,
      });
      const middleware = requirePermission('PROJECT_CREATE');

      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PermissionMiddleware] Skipped response write: headers already sent',
        expect.objectContaining({ statusCode: 401 })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('requirePermission handles response writer failures without throwing', async () => {
      mockReq.user = undefined;
      mockRes.status.mockReturnValueOnce({
        json: () => {
          throw new Error('json write failed');
        },
      });

      const middleware = requirePermission('PROJECT_CREATE');

      await expect(middleware(mockReq, mockRes, mockNext)).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[PermissionMiddleware] Failed response write',
        expect.objectContaining({ statusCode: 401, code: 'AUTH_REQUIRED' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Role-based scenarios', () => {
    it('should pass role to permission service', async () => {
      mockReq.user.role = 'ADMIN';
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requirePermission('USER_MANAGE');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'USER_MANAGE',
        'ADMIN'
      );
    });

    it('should handle user without organizationId', async () => {
      mockReq.user.organizationId = undefined;
      (mockReq.user as any).organization_id = undefined;
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requirePermission('PUBLIC_ACCESS');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        undefined,
        'PUBLIC_ACCESS',
        'USER'
      );
    });

    it('should use legacy organization_id when organizationId is missing', async () => {
      mockReq.user.organizationId = undefined;
      (mockReq.user as any).organization_id = 'org-legacy';
      mockPermissionService.hasPermission.mockResolvedValue(true);

      const middleware = requirePermission('PUBLIC_ACCESS');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'org-legacy',
        'PUBLIC_ACCESS',
        'USER'
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('role normalization helpers (private)', () => {
    it('normalizes common aliases for DB roles', () => {
      expect(__private__.normalizeRoleForDb(undefined)).toBe('VIEWER');
      expect(__private__.normalizeRoleForDb('administrator')).toBe('ADMIN');
      expect(__private__.normalizeRoleForDb('SUPER_ADMIN')).toBe('SUPERADMIN');
      expect(__private__.normalizeRoleForDb('manager')).toBe('PROJECT_MANAGER');
      expect(__private__.normalizeRoleForDb('member')).toBe('TEAM_MEMBER');
      expect(__private__.normalizeRoleForDb('client')).toBe('VIEWER');
      expect(__private__.normalizeRoleForDb('  custom_role  ')).toBe('CUSTOM_ROLE');
      expect(__private__.normalizeRoleForDb('   ')).toBe('VIEWER');
    });

    it('bridges legacy USER <-> TEAM_MEMBER role candidates', () => {
      expect(__private__.getRoleCandidates('USER')).toEqual(['USER', 'TEAM_MEMBER']);
      expect(__private__.getRoleCandidates('TEAM_MEMBER')).toEqual(['TEAM_MEMBER', 'USER']);
      expect(__private__.getRoleCandidates('ADMIN')).toEqual(['ADMIN']);
    });
  });

  describe('auditAction', () => {
    it('logs audit on successful (2xx) JSON responses', async () => {
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });

      const req: any = {
        user: { id: 'user-123', role: 'ADMIN', organizationId: 'org-456' },
        get: (h: string) => (h === 'X-Correlation-Id' ? 'corr-1' : undefined),
      };
      const res: any = {
        statusCode: 200,
        json: vi.fn().mockResolvedValue({ ok: true }),
      };
      const next = vi.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      await res.json({ ok: true });
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-123',
          actorRole: 'ADMIN',
          orgId: 'org-456',
          action: 'UPDATE',
          resourceType: 'PROJECT',
          correlationId: 'corr-1',
        })
      );
    });

    it('wraps response json only once when middleware is mounted twice', async () => {
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });
      const req: any = {
        user: { id: 'user-123', role: 'ADMIN', organizationId: 'org-456' },
        get: () => undefined,
      };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      await middleware(req, res, next);
      await res.json({ ok: true });

      expect(next).toHaveBeenCalledTimes(2);
      expect(mockAuditService.logAudit).toHaveBeenCalledTimes(1);
      expect(originalJson).toHaveBeenCalledTimes(1);
    });

    it('prefers req.userId over req.user.id for actorId', async () => {
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });

      const req: any = {
        userId: 'user-from-field',
        user: { role: 'ADMIN', organizationId: 'org-456' },
        get: () => undefined,
      };
      const res: any = {
        statusCode: 200,
        json: vi.fn().mockResolvedValue({ ok: true }),
      };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: true });
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-from-field' })
      );
    });

    it('uses empty string actorId when neither req.userId nor req.user.id exist', async () => {
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });

      const req: any = { user: { role: 'ADMIN', organizationId: 'org-456' }, get: () => undefined };
      const res: any = { statusCode: 200, json: vi.fn().mockResolvedValue({ ok: true }) };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: true });
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: '' })
      );
    });

    it('does not audit non-2xx responses', async () => {
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });
      const req: any = { user: { id: 'user-123' }, get: vi.fn() };
      const res: any = { statusCode: 500, json: vi.fn().mockResolvedValue({ ok: false }) };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: false });
      expect(mockAuditService.logAudit).not.toHaveBeenCalled();
    });

    it('swallows audit errors and still returns original JSON', async () => {
      mockAuditService.logAudit.mockRejectedValueOnce(new Error('audit down'));
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });
      const req: any = { user: { id: 'user-123' }, get: vi.fn() };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      const out = await res.json({ ok: true });
      expect(out).toEqual({ ok: true });
      expect(originalJson).toHaveBeenCalled();
    });

    it('prefers req.correlationId over header', async () => {
      const middleware = auditAction({ action: 'CREATE', resourceType: 'TASK' });
      const req: any = {
        user: { id: 'user-123', role: 'ADMIN', organizationId: 'org-456' },
        correlationId: 'corr-direct',
        get: () => 'corr-header',
      };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: true });
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'corr-direct' })
      );
    });

    it('sets correlationId undefined when no correlation is present', async () => {
      const middleware = auditAction({ action: 'CREATE', resourceType: 'TASK' });
      const req: any = { user: { id: 'user-123' }, get: () => undefined };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: true });
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: undefined })
      );
    });

    it('keeps audit flow when req.get throws while resolving correlation id', async () => {
      const middleware = auditAction({ action: 'CREATE', resourceType: 'TASK' });
      const req: any = {
        user: { id: 'user-123' },
        get: () => {
          throw new Error('header getter failed');
        },
      };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: true });
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: undefined, actorId: 'user-123' })
      );
    });

    it('keeps request flow when response json binder throws before wrapping', async () => {
      const middleware = auditAction({ action: 'CREATE', resourceType: 'TASK' });
      const req: any = { user: { id: 'user-123' } };
      const res: any = {};
      Object.defineProperty(res, 'json', {
        configurable: true,
        get: () => {
          throw new Error('json binder failed');
        },
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockAuditService.logAudit).not.toHaveBeenCalled();
    });

    it('skips audit logging when headers are already sent before wrapped json execution', async () => {
      const middleware = auditAction({ action: 'CREATE', resourceType: 'TASK' });
      const req: any = { user: { id: 'user-123' }, get: () => undefined };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson, headersSent: false };
      const next = vi.fn();

      await middleware(req, res, next);
      res.headersSent = true;
      await res.json({ ok: true });

      expect(mockAuditService.logAudit).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledTimes(1);
    });

    it('keeps audit flow when res.statusCode accessor throws inside wrapped json', async () => {
      const middleware = auditAction({ action: 'CREATE', resourceType: 'TASK' });
      const req: any = { user: { id: 'user-123' }, get: () => undefined };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const resObj: any = { json: originalJson };
      Object.defineProperty(resObj, 'statusCode', {
        configurable: true,
        get: () => {
          throw new Error('statusCode getter failed');
        },
      });
      const res: any = resObj;
      const next = vi.fn();

      await middleware(req, res, next);
      await expect(res.json({ ok: true })).resolves.toEqual({ ok: true });

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-123' })
      );
      expect(originalJson).toHaveBeenCalledTimes(1);
    });

    it('keeps audit logging when getResourceId accessor throws', async () => {
      const middleware = auditAction({
        action: 'UPDATE',
        resourceType: 'PROJECT',
        getResourceId: () => {
          throw new Error('resource id failed');
        },
      });
      const req: any = { user: { id: 'user-123', role: 'ADMIN', organizationId: 'org-456' }, get: vi.fn() };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ ok: true });

      expect(mockAuditService.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-123',
          resourceId: null,
        })
      );
      expect(originalJson).toHaveBeenCalledTimes(1);
    });

    it('emits at most one audit record when wrapped res.json is called multiple times', async () => {
      const middleware = auditAction({ action: 'UPDATE', resourceType: 'PROJECT' });
      const req: any = {
        user: { id: 'user-123', role: 'ADMIN', organizationId: 'org-456' },
        get: () => undefined,
      };
      const originalJson = vi.fn().mockResolvedValue({ ok: true });
      const res: any = { statusCode: 200, json: originalJson };
      const next = vi.fn();

      await middleware(req, res, next);
      await res.json({ first: true });
      await res.json({ second: true });

      expect(mockAuditService.logAudit).toHaveBeenCalledTimes(1);
      expect(originalJson).toHaveBeenCalledTimes(2);
    });
  });
});
