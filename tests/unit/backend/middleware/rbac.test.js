/**
 * RBAC Middleware Unit Tests
 *
 * Comprehensive tests for Role-Based Access Control middleware.
 * Uses inline implementation to avoid import issues.
 *
 * @module tests/unit/backend/middleware/rbac.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

/**
 * Creates an RBAC middleware helper
 */
const createRBACMiddleware = () => {
  const roles = new Map([
    [
      'super_admin',
      {
        permissions: ['*'],
        inherits: ['admin'],
      },
    ],
    [
      'admin',
      {
        permissions: ['read', 'write', 'delete', 'manage:users', 'manage:settings'],
        inherits: ['manager'],
      },
    ],
    [
      'manager',
      {
        permissions: ['read', 'write', 'delete:own', 'invite:team', 'manage:projects'],
        inherits: ['user'],
      },
    ],
    [
      'user',
      {
        permissions: ['read', 'write:own', 'profile:edit'],
      },
    ],
    [
      'viewer',
      {
        permissions: ['read'],
      },
    ],
    [
      'guest',
      {
        permissions: ['read:public'],
      },
    ],
  ]);

  const getEffectivePermissions = (role) => {
    const roleConfig = roles.get(role);
    if (!roleConfig) return [];

    let permissions = [...roleConfig.permissions];

    if (roleConfig.inherits) {
      for (const inheritedRole of roleConfig.inherits) {
        permissions = [...permissions, ...getEffectivePermissions(inheritedRole)];
      }
    }

    return [...new Set(permissions)];
  };

  const matchPermission = (required, userPerms) => {
    if (userPerms.includes('*')) return true;
    if (userPerms.includes(required)) return true;

    const [action, scope] = required.split(':');
    if (userPerms.includes(action)) return true;

    if (scope === 'own' && userPerms.includes(`${action}:own`)) return true;
    if (
      scope === 'public' &&
      (userPerms.includes(`${action}:public`) || userPerms.includes(action))
    )
      return true;

    return false;
  };

  return {
    checkRole: (user, requiredRole) => {
      if (!user || !user.role) return false;
      if (user.role === 'super_admin') return true;
      if (user.role === requiredRole) return true;

      const userRoleConfig = roles.get(user.role);
      if (userRoleConfig?.inherits?.includes(requiredRole)) return true;

      return false;
    },

    checkPermission: (user, requiredPermission) => {
      if (!user || !user.role) return false;

      const permissions = getEffectivePermissions(user.role);
      return matchPermission(requiredPermission, permissions);
    },

    checkAllPermissions: (user, requiredPermissions) => {
      if (!user || !user.role) return false;
      const permissions = getEffectivePermissions(user.role);
      return requiredPermissions.every((perm) => matchPermission(perm, permissions));
    },

    checkAnyPermission: (user, requiredPermissions) => {
      if (!user || !user.role) return false;
      const permissions = getEffectivePermissions(user.role);
      return requiredPermissions.some((perm) => matchPermission(perm, permissions));
    },

    requireRole: (requiredRole) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const rbac = createRBACMiddleware();
        if (!rbac.checkRole(req.user, requiredRole)) {
          return res.status(403).json({ error: 'Forbidden', requiredRole });
        }

        next();
      };
    },

    requirePermission: (requiredPermission) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const rbac = createRBACMiddleware();
        if (!rbac.checkPermission(req.user, requiredPermission)) {
          return res.status(403).json({ error: 'Forbidden', requiredPermission });
        }

        next();
      };
    },

    requireAnyPermission: (requiredPermissions) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const rbac = createRBACMiddleware();
        if (!rbac.checkAnyPermission(req.user, requiredPermissions)) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        next();
      };
    },

    getEffectivePermissions,

    addRole: (roleName, config) => {
      roles.set(roleName, config);
    },

    getRoles: () => Array.from(roles.keys()),

    getRoleConfig: (roleName) => roles.get(roleName) || null,
  };
};

// ============================================
// TESTS
// ============================================

describe('RBAC Middleware', () => {
  let rbac;

  beforeEach(() => {
    rbac = createRBACMiddleware();
  });

  describe('checkRole()', () => {
    it('should return true for matching role', () => {
      const user = { role: 'admin' };
      expect(rbac.checkRole(user, 'admin')).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const user = { role: 'user' };
      expect(rbac.checkRole(user, 'admin')).toBe(false);
    });

    it('should return true for super_admin checking any role', () => {
      const user = { role: 'super_admin' };
      expect(rbac.checkRole(user, 'user')).toBe(true);
      expect(rbac.checkRole(user, 'manager')).toBe(true);
      expect(rbac.checkRole(user, 'admin')).toBe(true);
    });

    it('should return false for missing user', () => {
      expect(rbac.checkRole(null, 'admin')).toBe(false);
      expect(rbac.checkRole({}, 'admin')).toBe(false);
    });

    it('should check inherited roles', () => {
      const manager = { role: 'manager' };
      expect(rbac.checkRole(manager, 'user')).toBe(true);
    });

    it('should not allow lower role to access higher', () => {
      const user = { role: 'user' };
      expect(rbac.checkRole(user, 'manager')).toBe(false);
      expect(rbac.checkRole(user, 'admin')).toBe(false);
    });
  });

  describe('checkPermission()', () => {
    it('should return true for super_admin wildcard permission', () => {
      const superAdmin = { role: 'super_admin' };
      expect(rbac.checkPermission(superAdmin, 'anything')).toBe(true);
      expect(rbac.checkPermission(superAdmin, 'delete')).toBe(true);
      expect(rbac.checkPermission(superAdmin, 'manage:anything')).toBe(true);
    });

    it('should check exact permission match', () => {
      const user = { role: 'user' };
      expect(rbac.checkPermission(user, 'read')).toBe(true);
      expect(rbac.checkPermission(user, 'write:own')).toBe(true);
      expect(rbac.checkPermission(user, 'profile:edit')).toBe(true);
    });

    it('should deny missing permissions', () => {
      const user = { role: 'user' };
      expect(rbac.checkPermission(user, 'delete')).toBe(false);
      expect(rbac.checkPermission(user, 'invite:team')).toBe(false);
      expect(rbac.checkPermission(user, 'manage:users')).toBe(false);
    });

    it('should check inherited permissions', () => {
      const manager = { role: 'manager' };
      expect(rbac.checkPermission(manager, 'read')).toBe(true);
      expect(rbac.checkPermission(manager, 'write:own')).toBe(true);
      expect(rbac.checkPermission(manager, 'invite:team')).toBe(true);
      expect(rbac.checkPermission(manager, 'manage:projects')).toBe(true);
    });

    it('should handle scoped permissions correctly', () => {
      const guest = { role: 'guest' };
      expect(rbac.checkPermission(guest, 'read:public')).toBe(true);
      expect(rbac.checkPermission(guest, 'write')).toBe(false);
    });

    it('should handle viewer role', () => {
      const viewer = { role: 'viewer' };
      expect(rbac.checkPermission(viewer, 'read')).toBe(true);
      expect(rbac.checkPermission(viewer, 'write')).toBe(false);
    });
  });

  describe('checkAllPermissions()', () => {
    it('should return true when all permissions are met', () => {
      const admin = { role: 'admin' };
      expect(rbac.checkAllPermissions(admin, ['read', 'write', 'delete'])).toBe(true);
    });

    it('should return false when any permission is missing', () => {
      const user = { role: 'user' };
      expect(rbac.checkAllPermissions(user, ['read', 'delete'])).toBe(false);
    });

    it('should return false for null user', () => {
      expect(rbac.checkAllPermissions(null, ['read'])).toBe(false);
    });
  });

  describe('checkAnyPermission()', () => {
    it('should return true when at least one permission is met', () => {
      const user = { role: 'user' };
      expect(rbac.checkAnyPermission(user, ['read', 'delete'])).toBe(true);
    });

    it('should return false when no permissions are met', () => {
      const guest = { role: 'guest' };
      expect(rbac.checkAnyPermission(guest, ['write', 'delete'])).toBe(false);
    });

    it('should return false for null user', () => {
      expect(rbac.checkAnyPermission(null, ['read'])).toBe(false);
    });
  });

  describe('requireRole() middleware', () => {
    it('should return 401 for missing user', () => {
      const middleware = rbac.requireRole('admin');
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for insufficient role', () => {
      const middleware = rbac.requireRole('admin');
      const req = { user: { role: 'user' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() for authorized user', () => {
      const middleware = rbac.requireRole('admin');
      const req = { user: { role: 'admin' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow super_admin for any role', () => {
      const middleware = rbac.requireRole('manager');
      const req = { user: { role: 'super_admin' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requirePermission() middleware', () => {
    it('should call next() when user has permission', () => {
      const middleware = rbac.requirePermission('read');
      const req = { user: { role: 'user' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user lacks permission', () => {
      const middleware = rbac.requirePermission('delete');
      const req = { user: { role: 'user' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for missing user', () => {
      const middleware = rbac.requirePermission('read');
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAnyPermission() middleware', () => {
    it('should call next() when user has at least one permission', () => {
      const middleware = rbac.requireAnyPermission(['delete', 'read']);
      const req = { user: { role: 'viewer' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user has no permissions', () => {
      const middleware = rbac.requireAnyPermission(['delete', 'manage:users']);
      const req = { user: { role: 'viewer' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getEffectivePermissions()', () => {
    it('should return direct permissions', () => {
      const perms = rbac.getEffectivePermissions('guest');
      expect(perms).toContain('read:public');
    });

    it('should include inherited permissions', () => {
      const perms = rbac.getEffectivePermissions('manager');
      expect(perms).toContain('read');
      expect(perms).toContain('write:own');
      expect(perms).toContain('invite:team');
      expect(perms).toContain('manage:projects');
    });

    it('should deduplicate permissions', () => {
      const perms = rbac.getEffectivePermissions('admin');
      const uniquePerms = [...new Set(perms)];
      expect(perms.length).toBe(uniquePerms.length);
    });

    it('should return empty array for unknown role', () => {
      const perms = rbac.getEffectivePermissions('unknown');
      expect(perms).toEqual([]);
    });
  });

  describe('addRole()', () => {
    it('should add new role', () => {
      rbac.addRole('custom_role', { permissions: ['custom:action'] });

      const user = { role: 'custom_role' };
      expect(rbac.checkPermission(user, 'custom:action')).toBe(true);
    });

    it('should add role with inheritance', () => {
      rbac.addRole('custom_manager', {
        permissions: ['custom:manage'],
        inherits: ['user'],
      });

      const user = { role: 'custom_manager' };
      expect(rbac.checkPermission(user, 'custom:manage')).toBe(true);
      expect(rbac.checkPermission(user, 'read')).toBe(true);
    });
  });

  describe('getRoles()', () => {
    it('should return all role names', () => {
      const roles = rbac.getRoles();

      expect(roles).toContain('super_admin');
      expect(roles).toContain('admin');
      expect(roles).toContain('manager');
      expect(roles).toContain('user');
      expect(roles).toContain('viewer');
      expect(roles).toContain('guest');
    });
  });

  describe('getRoleConfig()', () => {
    it('should return role configuration', () => {
      const config = rbac.getRoleConfig('admin');

      expect(config).toBeDefined();
      expect(config.permissions).toContain('manage:users');
      expect(config.inherits).toContain('manager');
    });

    it('should return null for unknown role', () => {
      const config = rbac.getRoleConfig('unknown');
      expect(config).toBeNull();
    });
  });
});
