import { describe, expect, it, vi } from 'vitest';

// P0-2 — resolveEffectiveAccess reads organization_members via queryHelpers;
// stub the DB layer so the baseline-capability tests below run hermetically.
//
// SECURITY NOTE: this stub used to resolve to `null` (no membership row). That only
// produced capabilities because readApplicationRole then fell back to the CALLER'S
// CLAIMED role — the vulnerability. resolveEffectiveAccess now fails closed on
// missing/non-ACTIVE membership, so these fixtures supply an AUTHORITATIVE ACTIVE
// row. The assertions are unchanged; only the fixture's honesty changed.
const mockQueryOne = vi.fn().mockResolvedValue(null);
vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: vi.fn().mockResolvedValue(undefined),
}));
const activeMembership = (role: string) => ({ role, status: 'ACTIVE' });

import {
  CANVAS_MEMBER_CAPABILITIES,
  FACTORY_ROLE_TEMPLATES,
  hasEffectiveCapability,
  mapLegacyPermissionToCapability,
  resolveEffectiveAccess,
} from '../effectiveAccessService.js';

describe('effectiveAccessService capability catalog', () => {
  it('maps legacy permissions into canonical dotted capabilities', () => {
    expect(mapLegacyPermissionToCapability('INTERVIEW_ASSIGN_MANAGE')).toBe(
      'interview.assignment.create'
    );
    expect(mapLegacyPermissionToCapability('MANAGE_STAGE_GATES')).toBe('initiative.approve');
    expect(mapLegacyPermissionToCapability('PROJECT_ROLES_MANAGE')).toBe(
      'admin.project_roles.manage'
    );
  });

  it('accepts scoped variants for canonical capability checks', () => {
    expect(
      hasEffectiveCapability(
        { capabilities: ['task.update.assigned'], platformRole: null },
        'task.update'
      )
    ).toBe(true);
  });

  it('keeps initiative workflow capabilities in factory templates used by P0 guards', () => {
    const leader = FACTORY_ROLE_TEMPLATES.find((template) => template.roleKey === 'PROJECT_LEADER');
    const sponsor = FACTORY_ROLE_TEMPLATES.find(
      (template) => template.roleKey === 'PROJECT_SPONSOR'
    );

    expect(leader?.capabilities).toEqual(
      expect.arrayContaining(['initiative.submit', 'initiative.review', 'initiative.complete'])
    );
    expect(sponsor?.capabilities).toEqual(
      expect.arrayContaining(['initiative.approve', 'initiative.promote', 'initiative.unblock'])
    );
  });
});

describe('P0-2 — Canvas baseline capabilities for members', () => {
  it('grants every canvas.* capability to a plain MEMBER without project context', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('MEMBER'));
    const access = await resolveEffectiveAccess({
      userId: 'user-member',
      organizationId: 'org-1',
      applicationRole: 'MEMBER',
    });

    expect(CANVAS_MEMBER_CAPABILITIES.length).toBeGreaterThanOrEqual(9);
    for (const capability of CANVAS_MEMBER_CAPABILITIES) {
      expect(hasEffectiveCapability(access, capability)).toBe(true);
    }
    expect(hasEffectiveCapability(access, 'canvas.share')).toBe(true);
    // Members must NOT pick up the admin wildcard along the way.
    expect(access.capabilities).not.toContain('*');
  });

  it('does not grant canvas capabilities to GUEST/VIEWER roles', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('GUEST'));
    const access = await resolveEffectiveAccess({
      userId: 'user-guest',
      organizationId: 'org-1',
      applicationRole: 'GUEST',
    });

    expect(hasEffectiveCapability(access, 'canvas.share')).toBe(false);
    expect(hasEffectiveCapability(access, 'canvas.convert.note')).toBe(false);
  });
});
