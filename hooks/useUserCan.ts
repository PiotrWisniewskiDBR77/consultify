import { useAppStore } from '../store/useAppStore';
import { UserRole } from '../types';

/**
 * MED-05: useUserCan Hook
 * Provides consistent permission checking across UI components
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
    | 'delete_items';

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
    SUPERADMIN: [
        'manage_users', 'edit_organization_settings', 'edit_project_settings',
        'manage_roadmap', 'approve_changes', 'manage_stage_gates',
        'manage_ai_policy', 'view_audit_logs', 'delete_items'
    ],
    ADMIN: [
        'manage_users', 'edit_organization_settings', 'edit_project_settings',
        'manage_roadmap', 'approve_changes', 'manage_stage_gates',
        'manage_ai_policy', 'view_audit_logs', 'delete_items'
    ],
    MANAGER: [
        'edit_project_settings', 'manage_roadmap', 'approve_changes',
        'manage_stage_gates', 'view_audit_logs'
    ],
    USER: [],
    OTHER: []
};

interface UseUserCanResult {
    can: (capability: Capability) => boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
    canManageAI: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isManager: boolean;
}

export const useUserCan = (): UseUserCanResult => {
    const currentUser = useAppStore(state => state.currentUser);

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
        isAdmin: role === 'ADMIN' || role === UserRole.ADMIN,
        isSuperAdmin: role === 'SUPERADMIN',
        isManager: role === 'MANAGER' || role === UserRole.MANAGER
    };
};

export default useUserCan;
