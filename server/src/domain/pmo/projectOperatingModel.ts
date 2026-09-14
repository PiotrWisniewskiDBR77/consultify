import { normalizeProjectRole } from '../../utils/roleNormalization.js';

export type CanonicalPmoRoleKey =
  | 'PROJECT_SPONSOR'
  | 'PROJECT_LEADER'
  | 'STEERING_COMMITTEE'
  | 'WORKSTREAM_OWNER'
  | 'TASK_ASSIGNEE';

export interface CanonicalPmoRole {
  key: CanonicalPmoRoleKey;
  label: { en: string; pl: string };
  description: { en: string; pl: string };
  can: string[];
  cannot: string[];
  decisionLevel: 1 | 2 | 3;
}

export const CANONICAL_PMO_ROLES: readonly CanonicalPmoRole[] = [
  {
    key: 'PROJECT_SPONSOR',
    label: { en: 'Project sponsor', pl: 'Sponsor projektu' },
    description: {
      en: 'Owns the business case and provides the final business authority.',
      pl: 'Odpowiada za uzasadnienie biznesowe i stanowi ostateczny autorytet biznesowy.',
    },
    can: ['approve-business-case', 'accept-stage-gate', 'escalate-to-portfolio'],
    cannot: ['replace-project-manager-in-daily-delivery'],
    decisionLevel: 3,
  },
  {
    key: 'PROJECT_LEADER',
    label: { en: 'Project manager', pl: 'Kierownik projektu' },
    description: {
      en: 'Owns delivery, coordinates the team and prepares stage-gate decisions.',
      pl: 'Odpowiada za realizację, koordynuje zespół i przygotowuje decyzje bramkowe.',
    },
    can: ['manage-delivery', 'assign-work', 'prepare-stage-gate'],
    cannot: ['approve-own-business-case'],
    decisionLevel: 2,
  },
  {
    key: 'STEERING_COMMITTEE',
    label: { en: 'Steering committee', pl: 'Komitet sterujący' },
    description: {
      en: 'Resolves escalations and makes cross-functional or high-impact decisions.',
      pl: 'Rozstrzyga eskalacje i podejmuje decyzje przekrojowe lub o dużym wpływie.',
    },
    can: ['resolve-escalations', 'accept-stage-gate', 'change-project-constraints'],
    cannot: ['manage-individual-tasks'],
    decisionLevel: 3,
  },
  {
    key: 'WORKSTREAM_OWNER',
    label: { en: 'Workstream owner', pl: 'Właściciel strumienia prac' },
    description: {
      en: 'Owns a workstream outcome and reports risks, progress and decisions.',
      pl: 'Odpowiada za wynik strumienia prac oraz raportuje ryzyka, postęp i decyzje.',
    },
    can: ['manage-workstream', 'recommend-decisions', 'report-risks'],
    cannot: ['approve-project-stage-gates'],
    decisionLevel: 1,
  },
  {
    key: 'TASK_ASSIGNEE',
    label: { en: 'Team member', pl: 'Członek zespołu' },
    description: {
      en: 'Delivers assigned work and reports progress, blockers and evidence.',
      pl: 'Realizuje przydzielone prace i raportuje postęp, blokady oraz dowody.',
    },
    can: ['deliver-assigned-work', 'report-progress', 'raise-blockers'],
    cannot: ['approve-stage-gates'],
    decisionLevel: 1,
  },
] as const;

export interface ProjectOperatingMember {
  userId: string;
  name: string;
  role: string;
  allocationPercent: number;
}

export interface ProjectCommunicationSettings {
  taskOverdue?: boolean;
  decisionPending?: boolean;
  weeklySummary?: boolean;
}

const toCanonicalRole = (role: unknown): CanonicalPmoRoleKey | null => {
  const normalized = normalizeProjectRole(role);
  return CANONICAL_PMO_ROLES.some((definition) => definition.key === normalized)
    ? (normalized as CanonicalPmoRoleKey)
    : null;
};

export function deriveProjectOperatingModel(input: {
  members: ProjectOperatingMember[];
  notifications?: ProjectCommunicationSettings;
}) {
  const members = input.members.map((member) => ({
    ...member,
    roleKey: toCanonicalRole(member.role),
    allocationPercent: Math.max(0, Math.min(100, Number(member.allocationPercent) || 0)),
  }));

  const roles = CANONICAL_PMO_ROLES.map((definition) => ({
    ...definition,
    memberIds: members
      .filter((member) => member.roleKey === definition.key)
      .map((member) => member.userId),
  }));

  const responsibilities = roles.map((role) => ({
    roleKey: role.key,
    decisionLevel: role.decisionLevel,
    accountableFor: role.can,
    excludedFrom: role.cannot,
    memberIds: role.memberIds,
  }));

  const allRecipientIds = members.map((member) => member.userId).sort();
  const managerRecipientIds = members
    .filter((member) =>
      ['PROJECT_SPONSOR', 'PROJECT_LEADER', 'STEERING_COMMITTEE'].includes(member.roleKey || '')
    )
    .map((member) => member.userId);
  const communication = [
    input.notifications?.taskOverdue
      ? { trigger: 'TASK_OVERDUE', recipientIds: managerRecipientIds }
      : null,
    input.notifications?.decisionPending
      ? { trigger: 'DECISION_PENDING', recipientIds: managerRecipientIds }
      : null,
    input.notifications?.weeklySummary
      ? { trigger: 'WEEKLY_SUMMARY', recipientIds: allRecipientIds }
      : null,
  ].filter((row): row is { trigger: string; recipientIds: string[] } => Boolean(row));

  const bindingByRole: Partial<
    Record<string, { roleKey: string; stageGateDuty: 'REVIEWER' | 'EXECUTOR' }>
  > = {
    PROJECT_SPONSOR: { roleKey: 'BUSINESS_AUTHORITY', stageGateDuty: 'REVIEWER' },
    STEERING_COMMITTEE: { roleKey: 'DOMAIN_AUTHORITY', stageGateDuty: 'REVIEWER' },
    PROJECT_LEADER: { roleKey: 'GATE_AUTHORITY', stageGateDuty: 'EXECUTOR' },
    PMO: { roleKey: 'GATE_AUTHORITY', stageGateDuty: 'EXECUTOR' },
  };
  const roleBindings = members.flatMap((member) => {
    const projectRole = normalizeProjectRole(member.role);
    const binding = projectRole ? bindingByRole[projectRole] : undefined;
    return binding
      ? [
          {
            roleKey: binding.roleKey,
            principalId: member.userId,
            projectRole,
            stageGateDuty: binding.stageGateDuty,
          },
        ]
      : [];
  });

  return {
    roles,
    responsibilities,
    capacity: members.map(({ userId, name, allocationPercent, roleKey }) => ({
      userId,
      name,
      allocationPercent,
      roleKey,
    })),
    communication,
    approvalInputs: { roleBindings },
    missingRequiredRoles: roles
      .filter((role) => ['PROJECT_SPONSOR', 'PROJECT_LEADER'].includes(role.key))
      .filter((role) => role.memberIds.length === 0)
      .map((role) => role.key),
  };
}
