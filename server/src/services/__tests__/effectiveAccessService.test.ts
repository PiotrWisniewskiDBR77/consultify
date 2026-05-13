import { describe, expect, it } from 'vitest';

import {
  FACTORY_ROLE_TEMPLATES,
  hasEffectiveCapability,
  LEGACY_PERMISSION_CAPABILITY_MAP,
  mapLegacyPermissionObjectToCapabilities,
  mapLegacyPermissionToCapability,
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
    const sponsor = FACTORY_ROLE_TEMPLATES.find((template) => template.roleKey === 'PROJECT_SPONSOR');

    expect(leader?.capabilities).toEqual(
      expect.arrayContaining(['initiative.create', 'initiative.update', 'initiative.promote'])
    );
    expect(sponsor?.capabilities).toEqual(
      expect.arrayContaining(['initiative.update', 'initiative.approve', 'initiative.complete'])
    );
  });
});
