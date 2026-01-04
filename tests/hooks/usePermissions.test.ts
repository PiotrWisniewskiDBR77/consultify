/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions, useUserCan } from '../../hooks/usePermissions';
import { useAppStore } from '../../store/useAppStore';
import { UserRole } from '../../types';

// Mock the store
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

describe('usePermissions Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Unauthenticated User', () => {
        beforeEach(() => {
            (useAppStore as any).mockReturnValue({
                currentUser: null,
                isAuthenticated: false
            });
        });

        it('returns isAuthenticated as false', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isAuthenticated).toBe(false);
        });

        it('returns null for userId', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.userId).toBeNull();
        });

        it('returns null for userRole', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.userRole).toBeNull();
        });

        it('denies all role-based checks', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isUser).toBe(false);
            expect(result.current.isManager).toBe(false);
            expect(result.current.isAdmin).toBe(false);
            expect(result.current.isSuperAdmin).toBe(false);
        });

        it('denies access to settings', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessSettings).toBe(false);
            expect(result.current.canEditProfile).toBe(false);
        });

        it('denies admin access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessAdmin).toBe(false);
        });

        it('denies super admin access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessSuperAdmin).toBe(false);
        });
    });

    describe('Regular User', () => {
        beforeEach(() => {
            (useAppStore as any).mockReturnValue({
                currentUser: {
                    id: 'user-1',
                    role: UserRole.MEMBER,
                    organizationId: 'org-1'
                },
                isAuthenticated: true
            });
        });

        it('returns isAuthenticated as true', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isAuthenticated).toBe(true);
        });

        it('returns correct userId', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.userId).toBe('user-1');
        });

        it('returns correct organizationId', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.organizationId).toBe('org-1');
        });

        it('sets isUser to true', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isUser).toBe(true);
        });

        it('denies manager role', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isManager).toBe(false);
        });

        it('denies admin role', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isAdmin).toBe(false);
        });

        it('allows access to settings', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessSettings).toBe(true);
            expect(result.current.canEditProfile).toBe(true);
        });

        it('allows user AI configuration', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManageUserAI).toBe(true);
        });

        it('denies org settings edit', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canEditOrgSettings).toBe(false);
        });

        it('denies admin panel access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessAdmin).toBe(false);
            expect(result.current.canManageOrgUsers).toBe(false);
        });
    });

    describe('Manager User', () => {
        beforeEach(() => {
            (useAppStore as any).mockReturnValue({
                currentUser: {
                    id: 'user-2',
                    role: UserRole.MANAGER,
                    organizationId: 'org-1'
                },
                isAuthenticated: true
            });
        });

        it('sets isManager to true', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isManager).toBe(true);
        });

        it('denies admin role', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isAdmin).toBe(false);
        });
    });

    describe('Admin User', () => {
        beforeEach(() => {
            (useAppStore as any).mockReturnValue({
                currentUser: {
                    id: 'admin-1',
                    role: UserRole.ADMIN,
                    organizationId: 'org-1'
                },
                isAuthenticated: true
            });
        });

        it('sets isAdmin to true', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isAdmin).toBe(true);
        });

        it('sets isManager to true (implied)', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isManager).toBe(true);
        });

        it('denies super admin role', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isSuperAdmin).toBe(false);
        });

        it('allows admin panel access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessAdmin).toBe(true);
        });

        it('allows org settings edit', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canEditOrgSettings).toBe(true);
        });

        it('allows user management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManageOrgUsers).toBe(true);
            expect(result.current.canInviteUsers).toBe(true);
            expect(result.current.canDeleteUsers).toBe(true);
            expect(result.current.canEditUsers).toBe(true);
        });

        it('allows project management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManageProjects).toBe(true);
            expect(result.current.canCreateProjects).toBe(true);
            expect(result.current.canDeleteProjects).toBe(true);
        });

        it('allows billing management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManageOrgBilling).toBe(true);
        });

        it('allows AI configuration', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canConfigureOrgAI).toBe(true);
        });

        it('allows analytics viewing', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canViewOrgAnalytics).toBe(true);
        });

        it('denies super admin panel access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessSuperAdmin).toBe(false);
        });
    });

    describe('Super Admin User', () => {
        beforeEach(() => {
            (useAppStore as any).mockReturnValue({
                currentUser: {
                    id: 'superadmin-1',
                    role: 'SUPERADMIN',
                    organizationId: 'org-platform'
                },
                isAuthenticated: true
            });
        });

        it('sets isSuperAdmin to true', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isSuperAdmin).toBe(true);
        });

        it('sets isAdmin to true (implied)', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isAdmin).toBe(true);
        });

        it('sets isManager to true (implied)', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.isManager).toBe(true);
        });

        it('allows super admin panel access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessSuperAdmin).toBe(true);
        });

        it('allows organization management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManageOrganizations).toBe(true);
            expect(result.current.canCreateOrganizations).toBe(true);
            expect(result.current.canDeleteOrganizations).toBe(true);
        });

        it('allows user impersonation', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canImpersonateUsers).toBe(true);
        });

        it('allows user blocking', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canBlockUsers).toBe(true);
        });

        it('allows platform AI management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManagePlatformAI).toBe(true);
        });

        it('allows billing and subscription management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManagePlatformBilling).toBe(true);
            expect(result.current.canManageSubscriptionPlans).toBe(true);
            expect(result.current.canManageTokenEconomy).toBe(true);
        });

        it('allows database access', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canAccessDatabase).toBe(true);
        });

        it('allows system health viewing', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canViewSystemHealth).toBe(true);
        });

        it('allows audit logs viewing', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canViewAuditLogs).toBe(true);
        });

        it('allows access codes management', () => {
            const { result } = renderHook(() => usePermissions());
            
            expect(result.current.canManageAccessCodes).toBe(true);
        });
    });
});

describe('useUserCan Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('provides quick access permissions for admin', () => {
        (useAppStore as any).mockReturnValue({
            currentUser: { id: 'admin-1', role: UserRole.ADMIN },
            isAuthenticated: true
        });

        const { result } = renderHook(() => useUserCan());

        expect(result.current.isAdmin).toBe(true);
        expect(result.current.isSuperAdmin).toBe(false);
        expect(result.current.canEdit).toBe(true);
        expect(result.current.canDelete).toBe(true);
    });

    it('provides full permissions object', () => {
        (useAppStore as any).mockReturnValue({
            currentUser: { id: 'user-1', role: UserRole.MEMBER },
            isAuthenticated: true
        });

        const { result } = renderHook(() => useUserCan());

        expect(result.current.permissions).toBeDefined();
        expect(result.current.permissions.isAuthenticated).toBe(true);
    });
});











