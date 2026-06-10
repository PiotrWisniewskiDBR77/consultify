import { describe, expect, it, vi } from 'vitest';

// P0-2 — resolveEffectiveAccess reads organization_members via queryHelpers;
// stub the DB layer so the baseline-capability tests below run hermetically.
vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue(undefined),
}));

import {
  CANVAS_MEMBER_CAPABILITIES,
  FACTORY_ROLE_TEMPLATES,
  hasEffectiveCapability,
  LEGACY_PERMISSION_CAPABILITY_MAP,
  mapLegacyPermissionObjectToCapabilities,
  mapLegacyPermissionToCapability,
  resolveEffectiveAccess,
  WORKFLOW_CAPABILITIES,
} from '../effectiveAccessService.js';

describe('effectiveAccessService capability catalog', () => {
  it('maps legacy permissions into canonical dotted capabilities', () => {
    expect(mapLegacyPermissionToCapability('INTERVIEW_ASSIGN_MANAGE')).toBe(
      WORKFLOW_CAPABILITIES.INTERVIEW_ASSIGNMENT_CREATE
    );
    expect(mapLegacyPermissionToCapability('MANAGE_STAGE_GATES')).toBe(
      WORKFLOW_CAPABILITIES.INITIATIVE_APPROVE
    );
    expect(LEGACY_PERMISSION_CAPABILITY_MAP.PROJECT_ROLES_MANAGE).toBe(
      WORKFLOW_CAPABILITIES.ADMIN_PROJECT_ROLES_MANAGE
    );
  });

  it('maps legacy project member permission objects', () => {
    expect(
      mapLegacyPermissionObjectToCapabilities({
        canViewProject: true,
        canAssignTasks: true,
        canApproveDecisions: true,
      })
    ).toEqual([
      WORKFLOW_CAPABILITIES.PROJECT_VIEW,
      WORKFLOW_CAPABILITIES.TASK_ASSIGN,
      'decision.approve',
    ]);
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
      expect.arrayContaining(['initiative.create', 'initiative.update', 'initiative.promote'])
    );
    expect(sponsor?.capabilities).toEqual(
      expect.arrayContaining(['initiative.update', 'initiative.approve', 'initiative.complete'])
    );
  });
});

describe('P0-2 — Canvas baseline capabilities for members', () => {
  it('grants every canvas.* capability to a plain MEMBER without project context', async () => {
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
    const access = await resolveEffectiveAccess({
      userId: 'user-guest',
      organizationId: 'org-1',
      applicationRole: 'GUEST',
    });

    expect(hasEffectiveCapability(access, 'canvas.share')).toBe(false);
    expect(hasEffectiveCapability(access, 'canvas.convert.note')).toBe(false);
  });
});
