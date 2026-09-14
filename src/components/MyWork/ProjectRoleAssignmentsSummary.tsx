import React, { useMemo } from 'react';

export interface ProjectRoleAssignmentMember {
  id: string;
  role?: string | null;
  projectRole?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export const groupProjectMembersByRole = <T extends ProjectRoleAssignmentMember>(members: T[]) => {
  const grouped = new Map<string, T[]>();
  for (const member of members) {
    // The production PMO API returns projectRole. `role` remains only as a
    // controlled compatibility fallback for older callers.
    const roleKey = String(member.projectRole || member.role || 'UNASSIGNED').toUpperCase();
    grouped.set(roleKey, [...(grouped.get(roleKey) || []), member]);
  }
  return Array.from(grouped.entries())
    .map(([role, roleMembers]) => ({ role, members: roleMembers }))
    .sort((a, b) => b.members.length - a.members.length || a.role.localeCompare(b.role));
};

interface ProjectRoleAssignmentsSummaryProps<T extends ProjectRoleAssignmentMember> {
  members: T[];
  roleLabel: (roleKey: string) => string;
  memberLabel: (member: T) => string;
}

export function ProjectRoleAssignmentsSummary<T extends ProjectRoleAssignmentMember>({
  members,
  roleLabel,
  memberLabel,
}: ProjectRoleAssignmentsSummaryProps<T>) {
  const roleGroups = useMemo(() => groupProjectMembersByRole(members), [members]);

  return (
    <ul className="space-y-1.5" data-testid="pmo-role-assignments">
      {roleGroups.map(({ role, members: roleMembers }) => (
        <li key={role} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary shrink-0">
              {roleLabel(role)}
            </span>
            <span className="truncate text-c-text-muted">
              {roleMembers.map((member) => memberLabel(member)).join(', ')}
            </span>
          </span>
          <span className="shrink-0 font-semibold text-c-text">{roleMembers.length}</span>
        </li>
      ))}
    </ul>
  );
}
