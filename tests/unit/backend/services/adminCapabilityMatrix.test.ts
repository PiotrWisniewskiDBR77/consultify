import { describe, expect, it } from 'vitest';
import { getTenantAdminCapabilityMatrix } from '../../../../server/src/services/adminCapabilityMatrix';

describe('ADM-001 tenant capability matrix', () => {
  it('maps the complete membership lifecycle to capability, scope, audit and guards', () => {
    const matrix = getTenantAdminCapabilityMatrix();
    expect(matrix.map((entry) => entry.id)).toEqual([
      'member.invite', 'invitation.accept', 'member.role.update', 'member.revoke',
    ]);
    for (const entry of matrix) {
      expect(entry.route).toMatch(/^\/api\//);
      expect(entry.organizationScope).toBeTruthy();
      expect(entry.auditEvent).toBeTruthy();
      expect(entry.guards.length).toBeGreaterThanOrEqual(3);
    }
    expect(matrix.find((entry) => entry.id === 'member.role.update')?.guards).toContain('last-owner-protected');
    expect(matrix.find((entry) => entry.id === 'member.revoke')?.guards).toContain('capability-current-at-write');
  });

  it('does not expose mutable registry state', () => {
    const first = getTenantAdminCapabilityMatrix() as any[];
    first[0].guards.push('tamper');
    expect(getTenantAdminCapabilityMatrix()[0].guards).not.toContain('tamper');
  });
});
