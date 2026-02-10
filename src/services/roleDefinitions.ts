/**
 * B3.2: Centralized role definitions
 * Shared across all modules — ApprovalWorkflow, TeamManagement, Initiatives, etc.
 */

export type ProjectRole =
  | 'MANAGER'
  | 'PMO_LEAD'
  | 'SPONSOR'
  | 'TEAM_LEAD'
  | 'ANALYST'
  | 'DEVELOPER'
  | 'STAKEHOLDER'
  | 'VIEWER';

export interface RoleDefinition {
  id: ProjectRole;
  label: string;
  labelPl: string;
  description: string;
  /** Lucide icon name (for reference) */
  iconName: 'User' | 'Shield' | 'Crown' | 'Users' | 'Eye' | 'Code' | 'BarChart3' | 'UserCheck';
  /** Approval level (higher = more authority) */
  approvalLevel: number;
  /** Can approve reports/decisions */
  canApprove: boolean;
}

export const ROLE_DEFINITIONS: Record<ProjectRole, RoleDefinition> = {
  VIEWER: {
    id: 'VIEWER',
    label: 'Viewer',
    labelPl: 'Obserwator',
    description: 'Read-only access to project data',
    iconName: 'Eye',
    approvalLevel: 0,
    canApprove: false,
  },
  DEVELOPER: {
    id: 'DEVELOPER',
    label: 'Developer',
    labelPl: 'Deweloper',
    description: 'Team member executing tasks',
    iconName: 'Code',
    approvalLevel: 1,
    canApprove: false,
  },
  ANALYST: {
    id: 'ANALYST',
    label: 'Analyst',
    labelPl: 'Analityk',
    description: 'Business or technical analyst',
    iconName: 'BarChart3',
    approvalLevel: 1,
    canApprove: false,
  },
  TEAM_LEAD: {
    id: 'TEAM_LEAD',
    label: 'Team Lead',
    labelPl: 'Lider zespołu',
    description: 'Leads a delivery team',
    iconName: 'Users',
    approvalLevel: 2,
    canApprove: true,
  },
  MANAGER: {
    id: 'MANAGER',
    label: 'Project Manager',
    labelPl: 'Kierownik projektu',
    description: 'Manages project execution and delivery',
    iconName: 'UserCheck',
    approvalLevel: 3,
    canApprove: true,
  },
  PMO_LEAD: {
    id: 'PMO_LEAD',
    label: 'PMO Lead',
    labelPl: 'Szef PMO',
    description: 'Portfolio/program management office lead',
    iconName: 'Shield',
    approvalLevel: 4,
    canApprove: true,
  },
  SPONSOR: {
    id: 'SPONSOR',
    label: 'Sponsor',
    labelPl: 'Sponsor',
    description: 'Executive sponsor with final approval authority',
    iconName: 'Crown',
    approvalLevel: 5,
    canApprove: true,
  },
  STAKEHOLDER: {
    id: 'STAKEHOLDER',
    label: 'Stakeholder',
    labelPl: 'Interesariusz',
    description: 'Key stakeholder with review rights',
    iconName: 'Eye',
    approvalLevel: 2,
    canApprove: false,
  },
};

/** Get role label by role ID */
export const getRoleLabel = (role: string, lang: 'en' | 'pl' = 'en'): string => {
  const def = ROLE_DEFINITIONS[role as ProjectRole];
  if (!def) return role;
  return lang === 'pl' ? def.labelPl : def.label;
};

/** Get all roles sorted by approval level */
export const getRolesSortedByLevel = (): RoleDefinition[] =>
  Object.values(ROLE_DEFINITIONS).sort((a, b) => a.approvalLevel - b.approvalLevel);

/** Get roles that can approve */
export const getApproverRoles = (): RoleDefinition[] =>
  Object.values(ROLE_DEFINITIONS).filter((r) => r.canApprove);

/** Check if a role has higher authority than another */
export const hasHigherAuthority = (roleA: string, roleB: string): boolean => {
  const a = ROLE_DEFINITIONS[roleA as ProjectRole];
  const b = ROLE_DEFINITIONS[roleB as ProjectRole];
  if (!a || !b) return false;
  return a.approvalLevel > b.approvalLevel;
};
