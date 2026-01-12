/**
 * useFrameworkPermissions Hook
 *
 * React hook for checking framework-specific permissions in UI components.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAppStore } from '../store/useAppStore';
import { AssessmentFramework } from '../store/useMultiFrameworkStore';

// ============================================
// TYPES
// ============================================

interface FrameworkPermissions {
    canCreate: boolean;
    canEdit: boolean;
    canView: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canReview: boolean;
    canApprove: boolean;
    canCertify: boolean;
    canExport: boolean;
    canGenerateReport: boolean;
    canGenerateInitiatives: boolean;
}

interface UseFrameworkPermissionsResult {
    permissions: FrameworkPermissions;
    isLoading: boolean;
    error: string | null;
    checkPermission: (action: string) => boolean;
    refreshPermissions: () => Promise<void>;
}

// ============================================
// DEFAULT PERMISSIONS
// ============================================

const DEFAULT_PERMISSIONS: FrameworkPermissions = {
    canCreate: false,
    canEdit: false,
    canView: true, // Default view access
    canDelete: false,
    canSubmit: false,
    canReview: false,
    canApprove: false,
    canCertify: false,
    canExport: true,
    canGenerateReport: false,
    canGenerateInitiatives: false,
};

// ============================================
// HOOK
// ============================================

export function useFrameworkPermissions(
    framework: AssessmentFramework | null,
    options: {
        assessmentId?: string;
        projectId?: string;
        organizationId?: string;
    } = {},
): UseFrameworkPermissionsResult {
    const [permissions, setPermissions] = useState<FrameworkPermissions>(DEFAULT_PERMISSIONS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { currentUser } = useAppStore();

    // Fetch permissions from server
    const fetchPermissions = useCallback(async () => {
        if (!framework) {
            setPermissions(DEFAULT_PERMISSIONS);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                framework,
                ...(options.assessmentId && { assessmentId: options.assessmentId }),
                ...(options.projectId && { projectId: options.projectId }),
                ...(options.organizationId && { organizationId: options.organizationId }),
            });

            const response = await fetch(`/api/framework-rbac/permissions?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setPermissions({
                    canCreate: data.create || false,
                    canEdit: data.edit || false,
                    canView: data.view ?? true,
                    canDelete: data.delete || false,
                    canSubmit: data.submit || false,
                    canReview: data.review || false,
                    canApprove: data.approve || false,
                    canCertify: data.certify || false,
                    canExport: data.export ?? true,
                    canGenerateReport: data.report || false,
                    canGenerateInitiatives: data.initiatives || false,
                });
            } else {
                // Fallback to role-based defaults if endpoint not available
                setPermissions(getDefaultPermissionsForUser(currentUser, framework));
            }
        } catch (err: any) {
            console.warn('[useFrameworkPermissions] Error:', err.message);
            // Use role-based defaults on error
            setPermissions(getDefaultPermissionsForUser(currentUser, framework));
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [framework, options.assessmentId, options.projectId, options.organizationId, currentUser]);

    // Load permissions on mount and when deps change
    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    // Check specific permission
    const checkPermission = useCallback(
        (action: string): boolean => {
            const actionMap: Record<string, keyof FrameworkPermissions> = {
                create: 'canCreate',
                edit: 'canEdit',
                view: 'canView',
                delete: 'canDelete',
                submit: 'canSubmit',
                review: 'canReview',
                approve: 'canApprove',
                certify: 'canCertify',
                export: 'canExport',
                report: 'canGenerateReport',
                initiatives: 'canGenerateInitiatives',
            };

            const permKey = actionMap[action.toLowerCase()];
            return permKey ? permissions[permKey] : false;
        },
        [permissions],
    );

    return {
        permissions,
        isLoading,
        error,
        checkPermission,
        refreshPermissions: fetchPermissions,
    };
}

// ============================================
// HELPERS
// ============================================

function getDefaultPermissionsForUser(user: any, framework: AssessmentFramework): FrameworkPermissions {
    if (!user) return DEFAULT_PERMISSIONS;

    const role = user.role || 'VIEWER';

    // Super admin has all permissions
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        return {
            canCreate: true,
            canEdit: true,
            canView: true,
            canDelete: true,
            canSubmit: true,
            canReview: true,
            canApprove: true,
            canCertify: framework !== 'CMMI', // CMMI requires special role
            canExport: true,
            canGenerateReport: true,
            canGenerateInitiatives: true,
        };
    }

    // Org admin
    if (role === 'ORG_ADMIN') {
        return {
            canCreate: true,
            canEdit: true,
            canView: true,
            canDelete: true,
            canSubmit: true,
            canReview: true,
            canApprove: true,
            canCertify: false,
            canExport: true,
            canGenerateReport: true,
            canGenerateInitiatives: true,
        };
    }

    // Project manager
    if (role === 'PROJECT_MANAGER') {
        return {
            canCreate: true,
            canEdit: true,
            canView: true,
            canDelete: false,
            canSubmit: true,
            canReview: false,
            canApprove: false,
            canCertify: false,
            canExport: true,
            canGenerateReport: true,
            canGenerateInitiatives: true,
        };
    }

    // Consultant
    if (role === 'CONSULTANT') {
        return {
            canCreate: true,
            canEdit: true,
            canView: true,
            canDelete: false,
            canSubmit: true,
            canReview: false,
            canApprove: false,
            canCertify: false,
            canExport: true,
            canGenerateReport: false,
            canGenerateInitiatives: false,
        };
    }

    // Default: viewer
    return DEFAULT_PERMISSIONS;
}

// ============================================
// ADDITIONAL HOOKS
// ============================================

/**
 * Hook to check if user can approve specific framework
 */
export function useCanApprove(framework: AssessmentFramework | null): boolean {
    const { permissions } = useFrameworkPermissions(framework);
    return permissions.canApprove;
}

/**
 * Hook to check if user can certify (for CMMI Lead Appraiser, etc.)
 */
export function useCanCertify(framework: AssessmentFramework | null): boolean {
    const { permissions } = useFrameworkPermissions(framework);
    return permissions.canCertify;
}

/**
 * Hook to check if assessment is editable based on status and permissions
 */
export function useIsEditable(framework: AssessmentFramework | null, status: string | null): boolean {
    const { permissions } = useFrameworkPermissions(framework);

    // Can't edit if no edit permission
    if (!permissions.canEdit) return false;

    // Can't edit approved or archived
    if (status === 'APPROVED' || status === 'ARCHIVED') return false;

    return true;
}

export default useFrameworkPermissions;

