/**
 * @vitest-environment jsdom
 *
 * usePermissions Hook Tests
 * Tests for permission checking across application layers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions, useUserCan } from '@/hooks/usePermissions';
import { useAppStore } from '@/store/useAppStore';

// Mock useAppStore
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    currentUser: {
      id: 'user-1',
      role: 'USER',
      organizationId: 'org-1',
    },
  })),
}));

describe('usePermissions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Info', () => {
    it('returns isAuthenticated', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.isAuthenticated).toBe('boolean');
    });

    it('returns userId', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userId === null || typeof result.current.userId === 'string').toBe(
        true
      );
    });

    it('returns userRole', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole === null || typeof result.current.userRole === 'string').toBe(
        true
      );
    });

    it('returns organizationId', () => {
      const { result } = renderHook(() => usePermissions());
      expect(
        result.current.organizationId === null || typeof result.current.organizationId === 'string'
      ).toBe(true);
    });
  });

  describe('Role Checks', () => {
    it('returns isUser flag', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.isUser).toBe('boolean');
    });

    it('returns isManager flag', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.isManager).toBe('boolean');
    });

    it('returns isAdmin flag', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.isAdmin).toBe('boolean');
    });

    it('returns isSuperAdmin flag', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.isSuperAdmin).toBe('boolean');
    });
  });

  describe('Settings Permissions', () => {
    it('returns canAccessSettings', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canAccessSettings).toBe('boolean');
    });

    it('returns canEditProfile', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canEditProfile).toBe('boolean');
    });

    it('returns canEditOrgSettings', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canEditOrgSettings).toBe('boolean');
    });
  });

  describe('Admin Permissions', () => {
    it('returns canAccessAdmin', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canAccessAdmin).toBe('boolean');
    });

    it('returns canManageOrgUsers', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canManageOrgUsers).toBe('boolean');
    });

    it('returns canManageProjects', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canManageProjects).toBe('boolean');
    });
  });

  describe('SuperAdmin Permissions', () => {
    it('returns canAccessSuperAdmin', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canAccessSuperAdmin).toBe('boolean');
    });

    it('returns canManageOrganizations', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canManageOrganizations).toBe('boolean');
    });

    it('returns canManageAllUsers', () => {
      const { result } = renderHook(() => usePermissions());
      expect(typeof result.current.canManageAllUsers).toBe('boolean');
    });

    it('treats SUPER_ADMIN as superadmin-equivalent', () => {
      vi.mocked(useAppStore).mockReturnValue({
        currentUser: {
          id: 'user-2',
          role: 'SUPER_ADMIN',
          organizationId: 'org-1',
        },
      } as any);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.userRole).toBe('SUPERADMIN');
      expect(result.current.isSuperAdmin).toBe(true);
      expect(result.current.canAccessSuperAdmin).toBe(true);
      expect(result.current.canManageAllUsers).toBe(true);
    });
  });
});

describe('useUserCan Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns canEdit', () => {
    const { result } = renderHook(() => useUserCan());
    expect(typeof result.current.canEdit).toBe('boolean');
  });

  it('returns canDelete', () => {
    const { result } = renderHook(() => useUserCan());
    expect(typeof result.current.canDelete).toBe('boolean');
  });

  it('returns isAdmin', () => {
    const { result } = renderHook(() => useUserCan());
    expect(typeof result.current.isAdmin).toBe('boolean');
  });

  it('returns isSuperAdmin', () => {
    const { result } = renderHook(() => useUserCan());
    expect(typeof result.current.isSuperAdmin).toBe('boolean');
  });

  it('returns full permissions object', () => {
    const { result } = renderHook(() => useUserCan());
    expect(result.current.permissions).toBeDefined();
    expect(typeof result.current.permissions.isAuthenticated).toBe('boolean');
  });
});
