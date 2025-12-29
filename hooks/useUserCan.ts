import { useAppStore } from '../store/useAppStore';
import { UserRole } from '../types';
import { usePermissions, Permissions } from './usePermissions';

/**
 * MED-05: useUserCan Hook
 * Provides consistent permission checking across UI components.
 * 
 * This hook wraps usePermissions for backward compatibility and adds
 * capability-based permission checking.
 * 
 * Usage:
 *   const { canEdit, canDelete, canApprove, isAdmin } = useUserCan();
 *   {canEdit && <EditButton />}
 */

type Capability =
    | 'manage_users'
    | 'edit_organization_settings'
    | 'edit_project_settings'
    | 'manage_roadmap'
    | 'approve_changes'
    | 'manage_stage_gates'
    | 'manage_ai_policy'
    | 'view_audit_logs'
    | 'delete_items'
    | 'generate_team_reports'
    | 'generate_steering_reports'
    | 'view_reports';

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
    SUPERADMIN: [
        'manage_users', 'edit_organization_settings', 'edit_project_settings',
        'manage_roadmap', 'approve_changes', 'manage_stage_gates',
        'manage_ai_policy', 'view_audit_logs', 'delete_items',
        'generate_team_reports', 'generate_steering_reports', 'view_reports'
    ],
    ADMIN: [
        'manage_users', 'edit_organization_settings', 'edit_project_settings',
        'manage_roadmap', 'approve_changes', 'manage_stage_gates',
        'manage_ai_policy', 'view_audit_logs', 'delete_items',
        'generate_team_reports', 'generate_steering_reports', 'view_reports'
    ],
    MANAGER: [
        'edit_project_settings', 'manage_roadmap', 'approve_changes',
        'manage_stage_gates', 'view_audit_logs',
        'generate_team_reports', 'generate_steering_reports', 'view_reports'
    ],
    USER: ['generate_team_reports', 'view_reports'],
    OTHER: ['view_reports']
};

interface UseUserCanResult {
    can: (capability: Capability) => boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
    canManageAI: boolean;
    canGenerateTeamReports: boolean;
    canGenerateSteeringReports: boolean;
    canViewReports: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isManager: boolean;
    // Extended permissions from usePermissions
    permissions: Permissions;
}

export const useUserCan = (): UseUserCanResult => {
    const currentUser = useAppStore(state => state.currentUser);
    const permissions = usePermissions();

    const role = currentUser?.role as string || 'USER';
    const capabilities = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.USER;

    const can = (capability: Capability): boolean => {
        return capabilities.includes(capability);
    };

    return {
        can,
        canEdit: capabilities.includes('edit_project_settings'),
        canDelete: capabilities.includes('delete_items'),
        canApprove: capabilities.includes('approve_changes'),
        canManageAI: capabilities.includes('manage_ai_policy'),
        canGenerateTeamReports: capabilities.includes('generate_team_reports'),
        canGenerateSteeringReports: capabilities.includes('generate_steering_reports'),
        canViewReports: capabilities.includes('view_reports'),
        isAdmin: permissions.isAdmin,
        isSuperAdmin: permissions.isSuperAdmin,
        isManager: permissions.isManager,
        // Expose full permissions object for advanced use cases
        permissions
    };
};

export default useUserCan;
