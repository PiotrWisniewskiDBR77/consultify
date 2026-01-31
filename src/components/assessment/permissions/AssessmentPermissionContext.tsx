/**
 * AssessmentPermissionContext
 *
 * React Context for sharing assessment permissions across components.
 * Wraps the useAssessmentPermissions hook in a context provider.
 */

import React, { createContext, useContext, useMemo } from 'react';

import {
  AccessRequest,
  AssessmentPermissions,
  AssessmentRole,
  CreateAccessRequestParams,
  useAssessmentPermissions,
} from './useAssessmentPermissions';

// ==========================================
// CONTEXT TYPE
// ==========================================

interface AssessmentPermissionContextValue {
  role: AssessmentRole;
  permissions: AssessmentPermissions;
  assignedAreas: string[] | null;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
  requestAccess: (params: CreateAccessRequestParams) => Promise<AccessRequest>;
  refreshPermissions: () => Promise<void>;
  hasPermission: (permission: keyof AssessmentPermissions) => boolean;
  canEditArea: (areaId: string) => boolean;
}

// ==========================================
// CONTEXT
// ==========================================

const AssessmentPermissionContext = createContext<AssessmentPermissionContextValue | null>(null);

// ==========================================
// PROVIDER
// ==========================================

interface AssessmentPermissionProviderProps {
  assessmentId: string | undefined;
  children: React.ReactNode;
}

export const AssessmentPermissionProvider: React.FC<AssessmentPermissionProviderProps> = ({
  assessmentId,
  children,
}) => {
  const permissionData = useAssessmentPermissions(assessmentId);

  const value = useMemo(
    () => ({
      role: permissionData.role,
      permissions: permissionData.permissions,
      assignedAreas: permissionData.assignedAreas,
      isOwner: permissionData.isOwner,
      isLoading: permissionData.isLoading,
      error: permissionData.error,
      requestAccess: permissionData.requestAccess,
      refreshPermissions: permissionData.refreshPermissions,
      hasPermission: permissionData.hasPermission,
      canEditArea: permissionData.canEditArea,
    }),
    [permissionData]
  );

  return (
    <AssessmentPermissionContext.Provider value={value}>
      {children}
    </AssessmentPermissionContext.Provider>
  );
};

// ==========================================
// HOOK
// ==========================================

export function useAssessmentPermissionContext(): AssessmentPermissionContextValue {
  const context = useContext(AssessmentPermissionContext);

  if (!context) {
    throw new Error(
      'useAssessmentPermissionContext must be used within an AssessmentPermissionProvider'
    );
  }

  return context;
}

// ==========================================
// PERMISSION GATE COMPONENT
// ==========================================

interface PermissionGateProps {
  permission: keyof AssessmentPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showRequestAccess?: boolean;
}

/**
 * Conditionally renders children based on permission
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  children,
  fallback = null,
  showRequestAccess = false,
}) => {
  const { hasPermission, permissions } = useAssessmentPermissionContext();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  if (showRequestAccess && permissions.canRequestAccess) {
    // Could render a "Request Access" button here
    return <>{fallback}</>;
  }

  return <>{fallback}</>;
};

// ==========================================
// EXPORTS
// ==========================================

export { AssessmentPermissionContext };
export type { AssessmentPermissionContextValue };
