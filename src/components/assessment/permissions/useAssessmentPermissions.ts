/**
 * useAssessmentPermissions Hook
 *
 * Provides role and permission information for the current user
 * in the context of a specific assessment.
 *
 * Features:
 * - Fetches user's role and permissions from API
 * - Caches results to avoid repeated API calls
 * - Provides helper methods for permission checks
 * - Handles access request creation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';
import { V8AssessmentApi } from '@/services/api/v8';
import { useAppStore } from '@/store/useAppStore';

// ==========================================
// TYPES
// ==========================================

export type AssessmentRole = 'admin' | 'manager' | 'editor' | 'viewer';

export interface AssessmentPermissions {
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  canManageTeam: boolean;
  canChangeStatus: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canGenerateReport: boolean;
  canGenerateInitiatives: boolean;
  canRequestAccess: boolean;
}

export interface UserRoleInfo {
  role: AssessmentRole;
  permissions: AssessmentPermissions;
  assignedAreas: string[] | null;
  isOwner: boolean;
}

export interface AccessRequest {
  id: string;
  assessmentId: string;
  requesterId: string;
  requestedRole: 'editor' | 'manager';
  requestedAreas: string[] | null;
  justification: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  requesterName?: string;
  requesterEmail?: string;
}

export interface CreateAccessRequestParams {
  requestedRole: 'editor' | 'manager';
  requestedAreas?: string[];
  justification: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface UseAssessmentPermissionsResult {
  // State
  role: AssessmentRole;
  permissions: AssessmentPermissions;
  assignedAreas: string[] | null;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  requestAccess: (params: CreateAccessRequestParams) => Promise<AccessRequest>;
  refreshPermissions: () => Promise<void>;

  // Helpers
  hasPermission: (permission: keyof AssessmentPermissions) => boolean;
  canEditArea: (areaId: string) => boolean;
}

// ==========================================
// DEFAULT VALUES
// ==========================================

const DEFAULT_PERMISSIONS: AssessmentPermissions = {
  canView: true,
  canEdit: false,
  canManage: false,
  canManageTeam: false,
  canChangeStatus: false,
  canApprove: false,
  canDelete: false,
  canGenerateReport: false,
  canGenerateInitiatives: false,
  canRequestAccess: true,
};

function shouldFallbackToLegacyAssessmentPermissions(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status);
  return [400, 403, 404, 405, 501].includes(status);
}

// ==========================================
// HOOK
// ==========================================

export function useAssessmentPermissions(
  assessmentId: string | undefined,
  options: { enabled?: boolean } = {}
): UseAssessmentPermissionsResult {
  const enabled = options.enabled !== false;
  const [role, setRole] = useState<AssessmentRole>('viewer');
  const [permissions, setPermissions] = useState<AssessmentPermissions>(DEFAULT_PERMISSIONS);
  const [assignedAreas, setAssignedAreas] = useState<string[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useAppStore();

  const isGlobalAdmin = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase();
    return (
      r === 'admin' ||
      r === 'owner' ||
      r === 'superadmin' ||
      r === 'super_admin' ||
      r === 'administrator'
    );
  }, [currentUser?.role]);

  const GLOBAL_ADMIN_PERMISSIONS: AssessmentPermissions = useMemo(
    () => ({
      canView: true,
      canEdit: true,
      canManage: true,
      canManageTeam: true,
      canChangeStatus: true,
      canApprove: true,
      canDelete: true,
      canGenerateReport: true,
      canGenerateInitiatives: true,
      canRequestAccess: false,
    }),
    []
  );

  // Fetch permissions from API
  const fetchPermissions = useCallback(async () => {
    if (!assessmentId || !enabled) {
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let response: UserRoleInfo;
      try {
        response = (await V8AssessmentApi.getMyRole(assessmentId)) as UserRoleInfo;
      } catch (error) {
        if (!shouldFallbackToLegacyAssessmentPermissions(error)) {
          throw error;
        }
        response = (await Api.get(
          `/assessment-workflow-v2/${assessmentId}/my-role`
        )) as UserRoleInfo;
      }

      if (response) {
        setRole(response.role || 'viewer');
        setPermissions(response.permissions || DEFAULT_PERMISSIONS);
        setAssignedAreas(response.assignedAreas || null);
        setIsOwner(response.isOwner || false);
      }
    } catch (err: any) {
      console.error(
        '[useAssessmentPermissions] Error fetching permissions:',
        err,
        'assessmentId:',
        assessmentId
      );
      setError(err.message || 'Failed to load permissions');
      // Fallback: if user is global admin, keep admin rights even if permissions API fails.
      if (isGlobalAdmin) {
        setRole('admin');
        setPermissions(GLOBAL_ADMIN_PERMISSIONS);
        setAssignedAreas(null);
        setIsOwner(true);
      } else {
        // Default to viewer on error
        setRole('viewer');
        setPermissions(DEFAULT_PERMISSIONS);
        setAssignedAreas(null);
        setIsOwner(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, enabled, isGlobalAdmin, GLOBAL_ADMIN_PERMISSIONS]);

  // Fetch on mount and when assessmentId changes
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Request access
  const requestAccess = useCallback(
    async (params: CreateAccessRequestParams): Promise<AccessRequest> => {
      if (!assessmentId) {
        throw new Error('Assessment ID is required');
      }

      const response = await Api.post(
        `/assessment-workflow-v2/${assessmentId}/access-requests`,
        params
      );

      return response;
    },
    [assessmentId]
  );

  // Refresh permissions
  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  // Check if user has specific permission
  const hasPermission = useCallback(
    (permission: keyof AssessmentPermissions): boolean => {
      return permissions[permission] ?? false;
    },
    [permissions]
  );

  // Check if user can edit specific area
  const canEditArea = useCallback(
    (areaId: string): boolean => {
      if (!permissions.canEdit) return false;
      if (assignedAreas === null) return true; // No restrictions
      return assignedAreas.includes(areaId);
    },
    [permissions.canEdit, assignedAreas]
  );

  return {
    role,
    permissions,
    assignedAreas,
    isOwner,
    isLoading,
    error,
    requestAccess,
    refreshPermissions,
    hasPermission,
    canEditArea,
  };
}

export default useAssessmentPermissions;
