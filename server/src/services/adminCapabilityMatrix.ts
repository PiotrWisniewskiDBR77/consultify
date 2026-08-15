/** ADM-001 — tenant-admin operations as a machine-readable authorization contract. */
export type TenantAdminCapability = 'people:read' | 'people:write' | 'iam:write' | 'audit:read';

export interface TenantAdminCapabilityEntry {
  id: 'member.invite' | 'invitation.accept' | 'member.role.update' | 'member.revoke';
  method: 'POST' | 'PATCH' | 'DELETE';
  route: string;
  capability: TenantAdminCapability | 'public-token';
  organizationScope: 'active-organization' | 'invitation-organization';
  auditEvent: string;
  guards: readonly string[];
}

export const TENANT_ADMIN_CAPABILITY_MATRIX: readonly TenantAdminCapabilityEntry[] = Object.freeze([
  {
    id: 'member.invite', method: 'POST', route: '/api/invitations/org', capability: 'people:write',
    organizationScope: 'active-organization', auditEvent: 'organization_invitation_created',
    guards: ['authenticated', 'same-organization', 'capability-current-at-write'],
  },
  {
    id: 'invitation.accept', method: 'POST', route: '/api/invitations/accept', capability: 'public-token',
    organizationScope: 'invitation-organization', auditEvent: 'organization_invitation_accepted',
    guards: ['hashed-token', 'not-expired', 'not-revoked', 'single-consume'],
  },
  {
    id: 'member.role.update', method: 'PATCH', route: '/api/organizations/:orgId/members/:memberId/role',
    capability: 'iam:write', organizationScope: 'active-organization', auditEvent: 'update_member_role',
    guards: ['same-organization', 'capability-current-at-write', 'last-owner-protected'],
  },
  {
    id: 'member.revoke', method: 'DELETE', route: '/api/organizations/:orgId/members/:memberId',
    capability: 'people:write', organizationScope: 'active-organization', auditEvent: 'remove_member',
    guards: ['same-organization', 'capability-current-at-write', 'last-owner-protected'],
  },
]);

export function getTenantAdminCapabilityMatrix(): readonly TenantAdminCapabilityEntry[] {
  return TENANT_ADMIN_CAPABILITY_MATRIX.map((entry) => ({ ...entry, guards: [...entry.guards] }));
}
