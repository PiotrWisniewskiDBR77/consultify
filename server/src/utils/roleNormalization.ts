export const ApplicationRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  USER: 'USER',
  GUEST: 'GUEST',
} as const;

export const PlatformRole = {
  SUPERADMIN: 'SUPERADMIN',
} as const;

export const ProjectRole = {
  PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  PROJECT_LEADER: 'PROJECT_LEADER',
  TASK_ASSIGNEE: 'TASK_ASSIGNEE',
  OBSERVER: 'OBSERVER',
  PMO: 'PMO',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER',
  WORKSTREAM_OWNER: 'WORKSTREAM_OWNER',
  REVIEWER: 'REVIEWER',
  SME: 'SME',
  CONSULTANT: 'CONSULTANT',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  STEERING_COMMITTEE: 'STEERING_COMMITTEE',
} as const;

export type ApplicationRoleValue = (typeof ApplicationRole)[keyof typeof ApplicationRole];
export type PlatformRoleValue = (typeof PlatformRole)[keyof typeof PlatformRole];
export type ProjectRoleValue = (typeof ProjectRole)[keyof typeof ProjectRole];

export function normalizeUpper(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

export function normalizePlatformRole(role: unknown): PlatformRoleValue | null {
  const normalized = normalizeUpper(role);
  if (normalized === 'SUPER_ADMIN' || normalized === 'SUPERADMIN') return PlatformRole.SUPERADMIN;
  return null;
}

export function normalizeApplicationRole(role: unknown): ApplicationRoleValue {
  const normalized = normalizeUpper(role);

  if (normalized === 'OWNER') return ApplicationRole.OWNER;
  if (normalized === 'ADMIN' || normalized === 'ADMINISTRATOR') return ApplicationRole.ADMIN;
  if (['GUEST', 'CLIENT', 'VIEWER'].includes(normalized)) return ApplicationRole.GUEST;
  if (
    [
      'USER',
      'MEMBER',
      'TEAM_MEMBER',
      'PROJECT_MANAGER',
      'MANAGER',
      'CONSULTANT',
      'SME',
      'REVIEWER',
    ].includes(normalized)
  ) {
    return ApplicationRole.USER;
  }

  return ApplicationRole.USER;
}

export function normalizeProjectRole(role: unknown): ProjectRoleValue | null {
  const normalized = normalizeUpper(role);
  if (!normalized) return null;

  if (['PROJECT_SPONSOR', 'PROJECT_EXECUTIVE', 'SPONSOR'].includes(normalized)) {
    return ProjectRole.PROJECT_SPONSOR;
  }
  if (
    ['PROJECT_LEADER', 'PROJECT_LEAD', 'PROJECT_MANAGER', 'MANAGER', 'TEAM_LEAD'].includes(
      normalized
    )
  ) {
    return ProjectRole.PROJECT_LEADER;
  }
  if (['TASK_ASSIGNEE', 'TEAM_MEMBER', 'MEMBER', 'DEVELOPER', 'ANALYST'].includes(normalized)) {
    return ProjectRole.TASK_ASSIGNEE;
  }
  if (['OBSERVER', 'VIEWER', 'STAKEHOLDER', 'CLIENT'].includes(normalized)) {
    return ProjectRole.OBSERVER;
  }
  if (['PMO', 'PMO_LEAD', 'PMO_SUPPORT'].includes(normalized)) return ProjectRole.PMO;
  if (normalized === 'INITIATIVE_OWNER') return ProjectRole.INITIATIVE_OWNER;
  if (normalized === 'WORKSTREAM_OWNER') return ProjectRole.WORKSTREAM_OWNER;
  if (normalized === 'REVIEWER') return ProjectRole.REVIEWER;
  if (normalized === 'SME') return ProjectRole.SME;
  if (normalized === 'CONSULTANT') return ProjectRole.CONSULTANT;
  if (['BUSINESS_OWNER', 'SENIOR_USER', 'DECISION_OWNER'].includes(normalized)) {
    return ProjectRole.BUSINESS_OWNER;
  }
  if (['STEERING_COMMITTEE', 'STEERING_BOARD'].includes(normalized)) {
    return ProjectRole.STEERING_COMMITTEE;
  }

  if (normalized.startsWith('CUSTOM_')) return normalized as ProjectRoleValue;
  return null;
}

export function defaultProjectRoleForApplicationRole(role: unknown): ProjectRoleValue {
  const applicationRole = normalizeApplicationRole(role);
  if (applicationRole === ApplicationRole.OWNER) return ProjectRole.PROJECT_SPONSOR;
  if (applicationRole === ApplicationRole.ADMIN) return ProjectRole.PROJECT_LEADER;
  if (applicationRole === ApplicationRole.GUEST) return ProjectRole.OBSERVER;
  return ProjectRole.TASK_ASSIGNEE;
}

export function getPermissionRoleCandidates(role: unknown): string[] {
  const raw = normalizeUpper(role);
  const applicationRole = normalizeApplicationRole(raw);
  const platformRole = normalizePlatformRole(raw);
  const candidates = new Set<string>();

  if (platformRole) candidates.add(platformRole);
  candidates.add(applicationRole);

  if (applicationRole === ApplicationRole.OWNER) {
    candidates.add('OWNER');
    candidates.add('ADMIN');
  }
  if (applicationRole === ApplicationRole.ADMIN) candidates.add('ADMIN');
  if (applicationRole === ApplicationRole.USER) {
    candidates.add('USER');
    candidates.add('TEAM_MEMBER');
    candidates.add('MEMBER');
  }
  if (applicationRole === ApplicationRole.GUEST) {
    candidates.add('GUEST');
    candidates.add('VIEWER');
    candidates.add('CLIENT');
  }

  if (raw === 'PROJECT_MANAGER' || raw === 'MANAGER') candidates.add('PROJECT_MANAGER');
  return Array.from(candidates);
}
