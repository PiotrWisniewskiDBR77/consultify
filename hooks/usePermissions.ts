import { useMemo } from 'react';

import { useAppStore } from '../store/useAppStore';
import { UserRole } from '../types';

/**
 * Centralized permissions interface for Settings/Admin/SuperAdmin layers.
 * This hook provides a unified way to check user permissions across the application.
 */
export interface Permissions {
    // User Info
    isAuthenticated: boolean;
    userId: string | null;
    userRole: string | null;
    organizationId: string | null;

    // Role Checks
    isUser: boolean;
    isManager: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;

    // Settings Permissions
    canAccessSettings: boolean;
    canEditProfile: boolean;
    canEditOrgSettings: boolean;
    canManageUserAI: boolean;

    // Org Admin Permissions
    canAccessAdmin: boolean;
    canManageOrgUsers: boolean;
    canInviteUsers: boolean;
    canDeleteUsers: boolean;
    canEditUsers: boolean;
    canManageProjects: boolean;
    canCreateProjects: boolean;
    canDeleteProjects: boolean;
    canConfigureOrgAI: boolean;
    canManageOrgBilling: boolean;
    canViewOrgAnalytics: boolean;
    canManageOrgKnowledge: boolean;
    canManageConsultants: boolean;

    // Platform Admin Permissions
    canAccessSuperAdmin: boolean;
    canManageOrganizations: boolean;
    canCreateOrganizations: boolean;
    canDeleteOrganizations: boolean;
    canManageAllUsers: boolean;
    canImpersonateUsers: boolean;
    canBlockUsers: boolean;
    canMoveUsers: boolean;
    canManagePlatformAI: boolean;
    canManagePlatformBilling: boolean;
    canManageSubscriptionPlans: boolean;
    canManageTokenEconomy: boolean;
    canAccessDatabase: boolean;
    canViewSystemHealth: boolean;
    canManageSystemSettings: boolean;
    canManageSuperAdmins: boolean;
    canViewAuditLogs: boolean;
    canManageAccessCodes: boolean;
}

export const usePermissions = (): Permissions => {
    const { currentUser } = useAppStore();
    const isAuthenticated = !!currentUser;

    return useMemo(() => {
        const userId = currentUser?.id || null;
        const userRole = currentUser?.role || null;
        const organizationId = (currentUser as any)?.organizationId || (currentUser as any)?.organization_id || null;

        // Role checks
        const isUser = !!currentUser;
        const isManager = userRole === UserRole.MANAGER || userRole === UserRole.ADMIN || userRole === 'SUPERADMIN';
        const isAdmin = userRole === UserRole.ADMIN || userRole === 'SUPERADMIN';
        const isSuperAdmin = userRole === 'SUPERADMIN';

        return {
            // User Info
            isAuthenticated,
            userId,
            userRole,
            organizationId,

            // Role Checks
            isUser,
            isManager,
            isAdmin,
            isSuperAdmin,

            // Settings Permissions (All authenticated users)
            canAccessSettings: isUser,
            canEditProfile: isUser,
            canEditOrgSettings: isAdmin,
            canManageUserAI: isUser, // User can configure their own AI settings

            // Org Admin Permissions (ADMIN role)
            canAccessAdmin: isAdmin,
            canManageOrgUsers: isAdmin,
            canInviteUsers: isAdmin,
            canDeleteUsers: isAdmin,
            canEditUsers: isAdmin,
            canManageProjects: isAdmin,
            canCreateProjects: isAdmin,
            canDeleteProjects: isAdmin,
            canConfigureOrgAI: isAdmin,
            canManageOrgBilling: isAdmin,
            canViewOrgAnalytics: isAdmin,
            canManageOrgKnowledge: isAdmin,
            canManageConsultants: isAdmin,

            // Platform Admin Permissions (SUPERADMIN role only)
            canAccessSuperAdmin: isSuperAdmin,
            canManageOrganizations: isSuperAdmin,
            canCreateOrganizations: isSuperAdmin,
            canDeleteOrganizations: isSuperAdmin,
            canManageAllUsers: isSuperAdmin,
            canImpersonateUsers: isSuperAdmin,
            canBlockUsers: isSuperAdmin,
            canMoveUsers: isSuperAdmin,
            canManagePlatformAI: isSuperAdmin,
            canManagePlatformBilling: isSuperAdmin,
            canManageSubscriptionPlans: isSuperAdmin,
            canManageTokenEconomy: isSuperAdmin,
            canAccessDatabase: isSuperAdmin,
            canViewSystemHealth: isSuperAdmin,
            canManageSystemSettings: isSuperAdmin,
            canManageSuperAdmins: isSuperAdmin,
            canViewAuditLogs: isSuperAdmin,
            canManageAccessCodes: isSuperAdmin,
        };
    }, [currentUser, isAuthenticated]);
};

/**
 * Helper hook for quick role-based permission checks
 */
export const useUserCan = () => {
    const permissions = usePermissions();

    return {
        // Quick access to common permissions
        canEdit: permissions.canEditUsers,
        canDelete: permissions.canDeleteUsers,
        isAdmin: permissions.isAdmin,
        isSuperAdmin: permissions.isSuperAdmin,

        // Full permissions object
        permissions,
    };
};

export default usePermissions;


