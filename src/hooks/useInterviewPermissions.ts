/**
 * useInterviewPermissions
 *
 * Hook do sprawdzania uprawnień użytkownika w module Interview.
 * Obsługuje dwa poziomy ról:
 * 1. Rola organizacyjna (users.role) - SUPERADMIN, OWNER, ADMIN, PROJECT_MANAGER, TEAM_MEMBER, VIEWER
 * 2. Rola projektowa (project_members.project_role) - PMO_LEAD, WORKSTREAM_OWNER, etc.
 *
 * @see wdrozenia/standards/05-RBAC-PERMISSIONS.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

export interface ProjectMembership {
  projectId: string;
  projectName: string;
  projectRole: string;
  workstreamId?: string;
}

export interface AssignmentScope {
  type: 'organization' | 'projects';
  organizationId?: string;
  projectIds?: string[];
}

export interface InterviewPermissions {
  // Podstawowe uprawnienia
  canAssign: boolean;
  canViewManaged: boolean;
  canViewOverdue: boolean;
  canSendReminder: boolean;
  canViewInsights: boolean;
  canCreateInsights: boolean;
  canReviewInsights: boolean;
  canPublishInsights: boolean;
  canHandoffInsights: boolean;

  // Scope przydziałów
  assignmentScope: AssignmentScope;

  // Role projektowe użytkownika
  projectMemberships: ProjectMembership[];

  // Pomocnicze
  isLoading: boolean;

  // Funkcje pomocnicze
  canAssignToUser: (userId: string, projectId?: string) => boolean;
  getAssignableProjects: () => ProjectMembership[];
}

export const useInterviewPermissions = (): InterviewPermissions => {
  const { currentUser, currentOrganization } = useAppStore();

  const orgRole = useMemo(() => {
    const r = ((currentUser as any)?.role || '').toUpperCase();
    return r;
  }, [currentUser]);

  const isPrivilegedOrgRole = useMemo(
    () => ['SUPERADMIN', 'OWNER', 'ADMIN'].includes(orgRole),
    [orgRole]
  );

  const explicitPermissions = useMemo(
    () =>
      Array.isArray((currentUser as any)?.permissions)
        ? ((currentUser as any).permissions as string[]).map((item) => String(item).toUpperCase())
        : [],
    [currentUser]
  );
  const [projectMemberships, setProjectMemberships] = useState<ProjectMembership[]>([]);
  const [effectiveCapabilities, setEffectiveCapabilities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pobierz role projektowe użytkownika
  useEffect(() => {
    const fetchProjectMemberships = async () => {
      if (!currentUser?.id) {
        setProjectMemberships([]);
        setIsLoading(false);
        return;
      }

      try {
        // Pobierz projekty użytkownika z API
        const response = await Api.get('/pmo/projects/my-memberships');
        const memberships = Array.isArray(response) ? response : response?.memberships || [];

        setProjectMemberships(
          memberships.map((m: any) => ({
            projectId: m.projectId || m.project_id,
            projectName: m.projectName || m.project_name || 'Unknown Project',
            projectRole: m.projectRole || m.project_role || '',
            workstreamId: m.workstreamId || m.workstream_id,
          }))
        );
      } catch (error) {
        // Jeśli endpoint nie istnieje, użyj pustej listy
        console.warn('[useInterviewPermissions] Failed to fetch project memberships:', error);
        setProjectMemberships([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectMemberships();
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchEffectiveAccess = async () => {
      if (!currentUser?.id) {
        setEffectiveCapabilities([]);
        return;
      }
      try {
        const response = await Api.get('/access/effective');
        const capabilities = response?.effectiveAccess?.capabilities;
        setEffectiveCapabilities(Array.isArray(capabilities) ? capabilities.map(String) : []);
      } catch (error) {
        console.warn('[useInterviewPermissions] Failed to fetch effective access:', error);
        setEffectiveCapabilities([]);
      }
    };

    fetchEffectiveAccess();
  }, [currentUser?.id, currentOrganization?.id]);

  const hasCapability = useCallback(
    (capability: string) => {
      const set = new Set(effectiveCapabilities);
      if (set.has('*') || set.has(capability)) return true;
      return ['.scoped', '.own', '.assigned', '.delegated'].some((suffix) =>
        set.has(`${capability}${suffix}`)
      );
    },
    [effectiveCapabilities]
  );

  const hasOrgLevelAssignPermission = useMemo(
    () => isPrivilegedOrgRole || hasCapability('interview.assignment.create') || hasCapability('admin.access'),
    [isPrivilegedOrgRole, hasCapability]
  );

  const hasProjectLevelAssignPermission = useMemo(
    () => isPrivilegedOrgRole || hasCapability('interview.assignment.create'),
    [isPrivilegedOrgRole, hasCapability]
  );

  const canAssign = useMemo(
    () => isPrivilegedOrgRole || hasCapability('interview.assignment.create') || hasCapability('admin.access'),
    [isPrivilegedOrgRole, hasCapability]
  );

  const hasExplicitInterviewPermission = useCallback(
    (permissionKey: string) =>
      explicitPermissions.length > 0 && explicitPermissions.includes(permissionKey.toUpperCase()),
    [explicitPermissions]
  );

  const canViewInsights = useMemo(
    () =>
      isPrivilegedOrgRole ||
      hasCapability('interview.insights.view') ||
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_VIEW') ||
      canAssign,
    [isPrivilegedOrgRole, hasCapability, hasExplicitInterviewPermission, canAssign]
  );
  const canCreateInsights = useMemo(
    () =>
      isPrivilegedOrgRole ||
      hasCapability('interview.insights.create') ||
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_CREATE') ||
      canAssign,
    [isPrivilegedOrgRole, hasCapability, hasExplicitInterviewPermission, canAssign]
  );
  const canReviewInsights = useMemo(
    () =>
      isPrivilegedOrgRole ||
      hasCapability('interview.assignment.review') ||
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_REVIEW') ||
      hasOrgLevelAssignPermission,
    [isPrivilegedOrgRole, hasCapability, hasExplicitInterviewPermission, hasOrgLevelAssignPermission]
  );
  const canPublishInsights = useMemo(
    () =>
      isPrivilegedOrgRole ||
      hasCapability('interview.insights.publish') ||
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_PUBLISH') ||
      hasOrgLevelAssignPermission,
    [isPrivilegedOrgRole, hasCapability, hasExplicitInterviewPermission, hasOrgLevelAssignPermission]
  );
  const canHandoffInsights = useMemo(
    () =>
      isPrivilegedOrgRole ||
      hasCapability('interview.insights.handoff') ||
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_HANDOFF') ||
      canAssign,
    [isPrivilegedOrgRole, hasCapability, hasExplicitInterviewPermission, canAssign]
  );

  // Scope przydziałów - komu użytkownik może przydzielać
  const assignmentScope = useMemo((): AssignmentScope => {
    // Jeśli ma uprawnienia na poziomie organizacji - może przydzielać wszystkim
    if (hasOrgLevelAssignPermission) {
      return {
        type: 'organization',
        organizationId: currentOrganization?.id || (currentUser as any)?.organizationId,
      };
    }

    // Jeśli ma uprawnienia na poziomie projektu - tylko członkom swoich projektów
    if (hasProjectLevelAssignPermission) {
      return {
        type: 'projects',
        projectIds: projectMemberships.map((pm) => pm.projectId),
      };
    }

    // Brak uprawnień
    return {
      type: 'projects',
      projectIds: [],
    };
  }, [
    hasOrgLevelAssignPermission,
    hasProjectLevelAssignPermission,
    projectMemberships,
    currentOrganization,
    currentUser,
  ]);

  // Sprawdź czy można przydzielić do konkretnego użytkownika
  const canAssignToUser = useCallback(
    (_userId: string, projectId?: string): boolean => {
      if (!canAssign) return false;
      if (isPrivilegedOrgRole) return true;
      if (assignmentScope.type === 'organization') return true;
      if (projectId && assignmentScope.projectIds?.includes(projectId)) return true;
      return false;
    },
    [canAssign, isPrivilegedOrgRole, assignmentScope]
  );

  // Pobierz projekty, do których użytkownik może przydzielać
  const getAssignableProjects = useCallback((): ProjectMembership[] => {
    if (!canAssign) return [];

    if (hasOrgLevelAssignPermission) {
      // Zwróć wszystkie projekty użytkownika (może przydzielać do wszystkich)
      return projectMemberships;
    }

    // Zwróć tylko projekty gdzie ma rolę zarządzającą
    return projectMemberships;
  }, [canAssign, hasOrgLevelAssignPermission, projectMemberships]);

  return {
    canAssign,
    canViewManaged: canAssign,
    canViewOverdue: canAssign,
    canSendReminder: canAssign,
    canViewInsights,
    canCreateInsights,
    canReviewInsights,
    canPublishInsights,
    canHandoffInsights,
    assignmentScope,
    projectMemberships,
    isLoading,
    canAssignToUser,
    getAssignableProjects,
  };
};

export default useInterviewPermissions;
