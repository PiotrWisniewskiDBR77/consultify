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

// Role organizacyjne z uprawnieniami do przydzielania
// OWNER dziedziczy uprawnienia ADMIN (plus billing/ownership/deletion)
const ORG_ROLES_WITH_ASSIGN = ['SUPERADMIN', 'OWNER', 'ADMIN', 'PROJECT_MANAGER'];

// Role projektowe z uprawnieniami do przydzielania
const PROJECT_ROLES_WITH_ASSIGN = ['PMO_LEAD', 'WORKSTREAM_OWNER', 'INITIATIVE_OWNER', 'SPONSOR'];

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
  const explicitPermissions = useMemo(
    () =>
      Array.isArray((currentUser as any)?.permissions)
        ? ((currentUser as any).permissions as string[]).map((item) => String(item).toUpperCase())
        : [],
    [currentUser]
  );
  const [projectMemberships, setProjectMemberships] = useState<ProjectMembership[]>([]);
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

  // Sprawdź czy użytkownik ma uprawnienia do przydzielania na podstawie roli organizacyjnej
  const hasOrgLevelAssignPermission = useMemo(() => {
    if (!currentUser?.role) return false;
    return ORG_ROLES_WITH_ASSIGN.includes(currentUser.role.toUpperCase());
  }, [currentUser?.role]);

  // Sprawdź czy użytkownik ma uprawnienia do przydzielania na podstawie ról projektowych
  const hasProjectLevelAssignPermission = useMemo(() => {
    return projectMemberships.some((pm) =>
      PROJECT_ROLES_WITH_ASSIGN.includes((pm.projectRole ?? '').toUpperCase())
    );
  }, [projectMemberships]);

  // Główne uprawnienie do przydzielania
  const canAssign = useMemo(() => {
    return hasOrgLevelAssignPermission || hasProjectLevelAssignPermission;
  }, [hasOrgLevelAssignPermission, hasProjectLevelAssignPermission]);

  const hasExplicitInterviewPermission = useCallback(
    (permissionKey: string) =>
      explicitPermissions.length > 0 && explicitPermissions.includes(permissionKey.toUpperCase()),
    [explicitPermissions]
  );

  const canViewInsights = useMemo(
    () => hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_VIEW') || canAssign,
    [hasExplicitInterviewPermission, canAssign]
  );
  const canCreateInsights = useMemo(
    () => hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_CREATE') || canAssign,
    [hasExplicitInterviewPermission, canAssign]
  );
  const canReviewInsights = useMemo(
    () =>
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_REVIEW') || hasOrgLevelAssignPermission,
    [hasExplicitInterviewPermission, hasOrgLevelAssignPermission]
  );
  const canPublishInsights = useMemo(
    () =>
      hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_PUBLISH') || hasOrgLevelAssignPermission,
    [hasExplicitInterviewPermission, hasOrgLevelAssignPermission]
  );
  const canHandoffInsights = useMemo(
    () => hasExplicitInterviewPermission('INTERVIEW_INSIGHTS_HANDOFF') || canAssign,
    [hasExplicitInterviewPermission, canAssign]
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
      const managedProjectIds = projectMemberships
        .filter((pm) => PROJECT_ROLES_WITH_ASSIGN.includes((pm.projectRole ?? '').toUpperCase()))
        .map((pm) => pm.projectId);

      return {
        type: 'projects',
        projectIds: managedProjectIds,
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
    (userId: string, projectId?: string): boolean => {
      if (!canAssign) return false;

      // Jeśli ma uprawnienia na poziomie organizacji - może wszystkim
      if (assignmentScope.type === 'organization') {
        return true;
      }

      // Jeśli ma uprawnienia na poziomie projektu - sprawdź czy projekt jest w scope
      if (projectId && assignmentScope.projectIds?.includes(projectId)) {
        return true;
      }

      return false;
    },
    [canAssign, assignmentScope]
  );

  // Pobierz projekty, do których użytkownik może przydzielać
  const getAssignableProjects = useCallback((): ProjectMembership[] => {
    if (!canAssign) return [];

    if (hasOrgLevelAssignPermission) {
      // Zwróć wszystkie projekty użytkownika (może przydzielać do wszystkich)
      return projectMemberships;
    }

    // Zwróć tylko projekty gdzie ma rolę zarządzającą
    return projectMemberships.filter((pm) =>
      PROJECT_ROLES_WITH_ASSIGN.includes((pm.projectRole ?? '').toUpperCase())
    );
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
