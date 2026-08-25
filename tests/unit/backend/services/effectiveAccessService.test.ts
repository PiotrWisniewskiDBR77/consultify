/**
 * effectiveAccessService — unit tests
 *
 * Tests cover:
 *  1. hasEffectiveCapability — all boundary cases
 *  2. resolveEffectiveAccess — org-level caps per application role
 *  3. resolveEffectiveAccess — project-scoped caps per project role (mocked DB)
 *  4. FACTORY_ROLE_TEMPLATES — completeness & minimum caps
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── DB mock (must be before service import) ───────────────────────────────
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../server/src/utils/queryHelpers.ts', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../../server/src/utils/DbPromise.ts', () => ({
  get: vi.fn(),
  run: vi.fn().mockResolvedValue({ success: true }),
  all: vi.fn().mockResolvedValue([]),
}));

import {
  FACTORY_ROLE_TEMPLATES,
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../../../../server/src/services/effectiveAccessService.ts';

/** An AUTHORITATIVE ACTIVE organization_members row — the only thing that now confers a role. */
const activeMembership = (role: string) => ({ role, status: 'ACTIVE' });

// ─────────────────────────────────────────────────────────────────────────────
// 1. hasEffectiveCapability
// ─────────────────────────────────────────────────────────────────────────────

describe('hasEffectiveCapability', () => {
  const base = { capabilities: [] as string[], platformRole: null as null | 'SUPERADMIN' };

  it('returns false for empty capabilities and no platform role', () => {
    expect(hasEffectiveCapability(base, 'project.view')).toBe(false);
  });

  it('returns true for exact capability match', () => {
    expect(
      hasEffectiveCapability({ ...base, capabilities: ['project.view'] }, 'project.view')
    ).toBe(true);
  });

  it('returns true when wildcard * is present', () => {
    expect(hasEffectiveCapability({ ...base, capabilities: ['*'] }, 'anything.at.all')).toBe(true);
  });

  it('returns true when .scoped suffix is present', () => {
    expect(
      hasEffectiveCapability({ ...base, capabilities: ['project.view.scoped'] }, 'project.view')
    ).toBe(true);
  });

  it('returns true when .own suffix is present', () => {
    expect(
      hasEffectiveCapability(
        { ...base, capabilities: ['initiative.update.own'] },
        'initiative.update'
      )
    ).toBe(true);
  });

  it('returns true when .assigned suffix is present', () => {
    expect(
      hasEffectiveCapability({ ...base, capabilities: ['task.view.assigned'] }, 'task.view')
    ).toBe(true);
  });

  it('returns true when .delegated suffix is present', () => {
    expect(
      hasEffectiveCapability({ ...base, capabilities: ['task.review.delegated'] }, 'task.review')
    ).toBe(true);
  });

  it('returns true for SUPERADMIN regardless of capabilities', () => {
    expect(
      hasEffectiveCapability({ capabilities: [], platformRole: 'SUPERADMIN' }, 'any.cap')
    ).toBe(true);
  });

  it('returns false for unrelated capability', () => {
    expect(hasEffectiveCapability({ ...base, capabilities: ['task.view'] }, 'project.view')).toBe(
      false
    );
  });

  it('does not match partial string (no substring matching)', () => {
    // 'project.view.scoped' only satisfies 'project.view', not 'project'
    expect(
      hasEffectiveCapability({ ...base, capabilities: ['project.view.scoped'] }, 'project')
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. resolveEffectiveAccess — org-level caps by application role
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveEffectiveAccess — org level (no projectId)', () => {
  beforeEach(() => {
    mockQueryOne.mockReset();
    mockQueryRun.mockReset().mockResolvedValue(undefined);
    // SECURITY: this used to be `null` — no membership row — and the capabilities
    // below only appeared because readApplicationRole fell back to the CALLER'S
    // CLAIMED role. That fallback was the vulnerability and is gone. Each test now
    // supplies the AUTHORITATIVE ACTIVE membership that legitimately confers its
    // role. Assertions are unchanged.
    mockQueryOne.mockResolvedValue(activeMembership('USER'));
  });

  it('OWNER gets admin.access + admin.people.manage + admin.project_roles.manage', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('OWNER'));
    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.capabilities).toContain('admin.access');
    expect(access.capabilities).toContain('admin.people.manage');
    expect(access.capabilities).toContain('admin.project_roles.manage');
    expect(access.applicationRole).toBe('OWNER');
    expect(access.platformRole).toBeNull();
  });

  it('ADMIN gets admin.access + admin.people.manage but NOT admin.project_roles.manage', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('ADMIN'));
    const access = await resolveEffectiveAccess({
      userId: 'u2',
      organizationId: 'org1',
      applicationRole: 'ADMIN',
    });
    expect(access.capabilities).toContain('admin.access');
    expect(access.capabilities).toContain('admin.people.manage');
    expect(access.capabilities).not.toContain('admin.project_roles.manage');
    expect(access.applicationRole).toBe('ADMIN');
  });

  /**
   * DEC-2026-08-25-17 regression guard. The test above only checks the raw
   * `capabilities` array — it does NOT prove the actual authorization
   * decision, and it kept passing throughout the bug's lifetime because the
   * array never literally contained the string 'admin.project_roles.manage'.
   * The real vulnerability was ADMIN holding the bare '*' wildcard, which
   * `hasEffectiveCapability` treats as "allow anything" regardless of what
   * capability string is checked. This is the test that would actually have
   * caught it: call the real authorization function, the same one
   * access.routes.ts and security/roles.routes.ts call before mutating
   * project role templates.
   */
  it('DEC-2026-08-25-17: hasEffectiveCapability denies ADMIN admin.project_roles.manage, allows OWNER', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('ADMIN'));
    const adminAccess = await resolveEffectiveAccess({
      userId: 'u-admin',
      organizationId: 'org1',
      applicationRole: 'ADMIN',
    });
    expect(hasEffectiveCapability(adminAccess, 'admin.project_roles.manage')).toBe(false);
    // The wildcard itself must be gone — not just the one named capability.
    expect(adminAccess.capabilities).not.toContain('*');

    mockQueryOne.mockResolvedValue(activeMembership('OWNER'));
    const ownerAccess = await resolveEffectiveAccess({
      userId: 'u-owner',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(hasEffectiveCapability(ownerAccess, 'admin.project_roles.manage')).toBe(true);
  });

  /**
   * Fail-safe check: narrowing ADMIN must be exact, not collateral. Every
   * other capability ADMIN held via '*' must still resolve true, including
   * capability families ADMIN never explicitly lists (project/task/initiative/
   * interview/canvas/decision/... — anything project-role templates or other
   * subsystems check), so this fix cannot silently 403 ADMIN on unrelated
   * operations no one asked to restrict.
   */
  it('DEC-2026-08-25-17: ADMIN keeps every other capability it held via the old wildcard', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('ADMIN'));
    const access = await resolveEffectiveAccess({
      userId: 'u-admin',
      organizationId: 'org1',
      applicationRole: 'ADMIN',
    });
    expect(hasEffectiveCapability(access, 'admin.access')).toBe(true);
    expect(hasEffectiveCapability(access, 'admin.people.manage')).toBe(true);
    // Spot-check a wide, unrelated spread of capability families ADMIN never
    // explicitly lists but previously got via '*' — none of these are
    // owner-only, so none of them should have been narrowed.
    const unrestrictedSpotChecks = [
      'project.view',
      'project.team.manage',
      'task.create',
      'initiative.approve',
      'initiative.delete',
      'interview.assignment.create',
      'decision.approve',
      'stakeholder.registry.manage',
      'users.invite',
      'canvas.share',
      'okr.objective.create',
      'gate.approve',
      'some.capability.nobody.has.enumerated.yet',
    ];
    for (const capability of unrestrictedSpotChecks) {
      expect(hasEffectiveCapability(access, capability)).toBe(true);
    }
  });

  it('DEC-2026-08-25-17: SUPERADMIN is unaffected — still passes admin.project_roles.manage', async () => {
    const access = await resolveEffectiveAccess({
      userId: 'u-sa',
      organizationId: 'org1',
      applicationRole: 'SUPERADMIN',
    });
    expect(hasEffectiveCapability(access, 'admin.project_roles.manage')).toBe(true);
  });

  it('USER gets no admin capabilities at org level', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('USER'));
    const access = await resolveEffectiveAccess({
      userId: 'u3',
      organizationId: 'org1',
      applicationRole: 'USER',
    });
    expect(access.capabilities).not.toContain('admin.access');
    expect(access.capabilities).not.toContain('admin.people.manage');
    expect(access.applicationRole).toBe('USER');
  });

  it('GUEST gets no admin capabilities at org level', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('GUEST'));
    const access = await resolveEffectiveAccess({
      userId: 'u4',
      organizationId: 'org1',
      applicationRole: 'GUEST',
    });
    expect(access.capabilities).not.toContain('admin.access');
    expect(access.applicationRole).toBe('GUEST');
  });

  it('SUPERADMIN gets superadmin.access + audit.project.view', async () => {
    const access = await resolveEffectiveAccess({
      userId: 'u5',
      organizationId: 'org1',
      applicationRole: 'SUPERADMIN',
    });
    expect(access.capabilities).toContain('superadmin.access');
    expect(access.capabilities).toContain('audit.project.view');
    expect(access.platformRole).toBe('SUPERADMIN');
  });

  it('SUPERADMIN: hasEffectiveCapability always returns true', async () => {
    const access = await resolveEffectiveAccess({
      userId: 'u5',
      organizationId: 'org1',
      applicationRole: 'SUPERADMIN',
    });
    expect(hasEffectiveCapability(access, 'admin.project_roles.manage')).toBe(true);
    expect(hasEffectiveCapability(access, 'anything')).toBe(true);
  });

  it('no projectId → scope contains organization but not project', async () => {
    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.scope).toContain('organization');
    expect(access.scope).not.toContain('project');
  });

  it('impersonating actor → auditRequired is true', async () => {
    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'ADMIN',
      isImpersonating: true,
    });
    expect(access.auditRequired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveEffectiveAccess — project-scoped caps
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveEffectiveAccess — project scope (with projectId)', () => {
  beforeEach(() => {
    mockQueryOne.mockReset();
    mockQueryRun.mockReset().mockResolvedValue(undefined);
  });

  it('PROJECT_LEADER gets project.view + project.team.manage', async () => {
    // First call: org membership lookup → null (use applicationRole)
    // Second call: project membership lookup → PROJECT_LEADER
    // Third call: template capabilities → []  (fall back to FACTORY_ROLE_TEMPLATES)
    mockQueryOne
      .mockResolvedValueOnce(activeMembership('USER')) // AUTHORITATIVE org membership
      .mockResolvedValueOnce({
        // project membership
        project_role: 'PROJECT_LEADER',
        normalized_project_role: 'PROJECT_LEADER',
        role_template_id: null,
        permissions: null,
      })
      .mockResolvedValueOnce(null) // byId template lookup
      .mockResolvedValueOnce(null); // byRole template lookup (fall back to factory)

    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'USER',
      projectId: 'proj1',
    });

    expect(access.projectRole).toBe('PROJECT_LEADER');
    expect(access.capabilities).toContain('project.view');
    expect(access.capabilities).toContain('project.team.manage');
    expect(access.scope).toContain('project');
  });

  it('PROJECT_SPONSOR gets decision.approve', async () => {
    mockQueryOne
      .mockResolvedValueOnce(activeMembership('USER'))
      .mockResolvedValueOnce({
        project_role: 'PROJECT_SPONSOR',
        normalized_project_role: 'PROJECT_SPONSOR',
        role_template_id: null,
        permissions: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'USER',
      projectId: 'proj1',
    });

    expect(access.projectRole).toBe('PROJECT_SPONSOR');
    expect(access.capabilities).toContain('decision.approve');
  });

  it('OBSERVER gets project.view but not project.team.manage', async () => {
    mockQueryOne
      .mockResolvedValueOnce(activeMembership('GUEST'))
      .mockResolvedValueOnce({
        project_role: 'OBSERVER',
        normalized_project_role: 'OBSERVER',
        role_template_id: null,
        permissions: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'GUEST',
      projectId: 'proj1',
    });

    expect(access.capabilities).toContain('project.view');
    expect(access.capabilities).not.toContain('project.team.manage');
  });

  it('no project membership → fallback role from applicationRole (ADMIN → PROJECT_LEADER)', async () => {
    mockQueryOne
      .mockResolvedValueOnce(activeMembership('ADMIN')) // AUTHORITATIVE org membership
      .mockResolvedValueOnce(null) // project membership (not found)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'ADMIN',
      projectId: 'proj1',
    });

    expect(access.projectRole).toBe('PROJECT_LEADER');
    expect(access.warnings).toContain('PROJECT_ROLE_FALLBACK_FROM_APPLICATION_ROLE');
  });

  it('no project membership → OWNER falls back to PROJECT_SPONSOR', async () => {
    mockQueryOne
      .mockResolvedValueOnce(activeMembership('OWNER'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'OWNER',
      projectId: 'proj1',
    });

    expect(access.projectRole).toBe('PROJECT_SPONSOR');
  });

  it('project scope adds scoped to scope array when scoped caps present', async () => {
    mockQueryOne
      .mockResolvedValueOnce(activeMembership('GUEST'))
      .mockResolvedValueOnce({
        project_role: 'OBSERVER',
        normalized_project_role: 'OBSERVER',
        role_template_id: null,
        permissions: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const access = await resolveEffectiveAccess({
      userId: 'u1',
      organizationId: 'org1',
      applicationRole: 'GUEST',
      projectId: 'proj1',
    });

    // OBSERVER has task.view.scoped → scope should include 'scoped'
    expect(access.scope).toContain('scoped');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3b. AUTHORITATIVE MEMBERSHIP — fail-closed authorization (security)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveEffectiveAccess — authoritative ACTIVE membership required', () => {
  beforeEach(() => {
    mockQueryOne.mockReset();
    mockQueryRun.mockReset().mockResolvedValue(undefined);
  });

  /** The regression that would hurt most: a fix that over-denies legitimate users. */
  it('ACTIVE membership RETAINS access and full capabilities', async () => {
    mockQueryOne.mockResolvedValue(activeMembership('OWNER'));
    const access = await resolveEffectiveAccess({
      userId: 'u-active',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.applicationRole).toBe('OWNER');
    expect(access.capabilities).toContain('*');
    expect(access.capabilities).toContain('admin.access');
    expect(hasEffectiveCapability(access, 'initiative.view')).toBe(true);
    expect(access.warnings).not.toContain('NO_ACTIVE_ORGANIZATION_MEMBERSHIP');
  });

  it('ACTIVE membership is honoured case-insensitively (UPPER(status) canon)', async () => {
    mockQueryOne.mockResolvedValue({ role: 'OWNER', status: 'active' });
    const access = await resolveEffectiveAccess({
      userId: 'u-lower',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.capabilities).toContain('*');
  });

  /** HOLE 1 — a REVOKED row must confer nothing, whatever the token claims. */
  it.each(['REVOKED', 'SUSPENDED', 'PENDING', 'INVITED', ''])(
    'non-ACTIVE membership status %s is denied all capabilities',
    async (status) => {
      mockQueryOne.mockResolvedValue({ role: 'OWNER', status });
      const access = await resolveEffectiveAccess({
        userId: 'u-revoked',
        organizationId: 'org1',
        applicationRole: 'OWNER',
      });
      expect(access.capabilities).toEqual([]);
      expect(access.capabilities).not.toContain('*');
      expect(access.applicationRole).toBe('GUEST');
      expect(hasEffectiveCapability(access, 'initiative.view')).toBe(false);
      expect(access.warnings).toContain('NO_ACTIVE_ORGANIZATION_MEMBERSHIP');
    }
  );

  it('a NULL membership status is not ACTIVE and is denied', async () => {
    mockQueryOne.mockResolvedValue({ role: 'OWNER', status: null });
    const access = await resolveEffectiveAccess({
      userId: 'u-null-status',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.capabilities).toEqual([]);
    expect(hasEffectiveCapability(access, 'initiative.view')).toBe(false);
  });

  /**
   * HOLE 2 — the token's claimed role must NEVER become an application role.
   * Deleting a membership row must remove access, not hand control to the token.
   */
  it('NO membership row denies access even when the token claims OWNER', async () => {
    mockQueryOne.mockResolvedValue(null);
    const access = await resolveEffectiveAccess({
      userId: 'u-missing',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.capabilities).toEqual([]);
    expect(access.applicationRole).toBe('GUEST');
    expect(hasEffectiveCapability(access, 'admin.access')).toBe(false);
    expect(access.warnings).toContain('NO_ACTIVE_ORGANIZATION_MEMBERSHIP');
  });

  it('NO membership row denies project capabilities instead of falling back to a project role', async () => {
    mockQueryOne.mockResolvedValue(null);
    const access = await resolveEffectiveAccess({
      userId: 'u-missing',
      organizationId: 'org1',
      applicationRole: 'ADMIN',
      projectId: 'proj1',
    });
    expect(access.capabilities).toEqual([]);
    expect(access.projectRole).toBeNull();
    expect(access.scope).not.toContain('project');
    expect(access.warnings).not.toContain('PROJECT_ROLE_FALLBACK_FROM_APPLICATION_ROLE');
  });

  /** A transient DB error must DENY, not degrade to the token's claim. */
  it('membership lookup failure fails CLOSED rather than degrading to the token role', async () => {
    mockQueryOne.mockRejectedValue(new Error('connection reset'));
    const access = await resolveEffectiveAccess({
      userId: 'u-dberror',
      organizationId: 'org1',
      applicationRole: 'OWNER',
    });
    expect(access.capabilities).toEqual([]);
    expect(access.applicationRole).toBe('GUEST');
    expect(hasEffectiveCapability(access, '*')).toBe(false);
    expect(access.warnings).toContain('NO_ACTIVE_ORGANIZATION_MEMBERSHIP');
  });

  /**
   * HOLE 3 — DELIBERATELY UNCHANGED, PINNED HERE SO IT CANNOT DRIFT SILENTLY.
   *
   * Owner decision 15A: platform SUPERADMIN policy stays only where explicitly
   * authorized and tested. This lane did NOT change it. Recorded as a finding for
   * decision, NOT decided here: a SUPERADMIN token is granted org-level OWNER and
   * the '*' wildcard in ANY organization with NO membership row and NO database
   * lookup at all. If that is to change, it is a separate owner decision.
   */
  it('POLICY (explicit, authorized): a SUPERADMIN token is granted org OWNER and "*" WITHOUT any membership row', async () => {
    mockQueryOne.mockResolvedValue(null);
    const access = await resolveEffectiveAccess({
      userId: 'u-superadmin',
      organizationId: 'org-not-a-member-of',
      applicationRole: 'SUPERADMIN',
    });
    expect(access.platformRole).toBe('SUPERADMIN');
    expect(access.applicationRole).toBe('OWNER');
    expect(access.capabilities).toContain('*');
    expect(access.capabilities).toContain('superadmin.access');
    expect(hasEffectiveCapability(access, 'anything.at.all')).toBe(true);
    // Proof that no membership lookup was performed for the platform path.
    expect(mockQueryOne).not.toHaveBeenCalled();
    expect(access.warnings).not.toContain('NO_ACTIVE_ORGANIZATION_MEMBERSHIP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. FACTORY_ROLE_TEMPLATES — completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('FACTORY_ROLE_TEMPLATES — completeness', () => {
  const REQUIRED_ROLE_KEYS = [
    'PROJECT_SPONSOR',
    'PROJECT_LEADER',
    'TASK_ASSIGNEE',
    'OBSERVER',
    'PMO',
    'REVIEWER',
    'CONSULTANT',
  ];

  it('contains all required role keys', () => {
    const keys = FACTORY_ROLE_TEMPLATES.map((t) => t.roleKey);
    for (const required of REQUIRED_ROLE_KEYS) {
      expect(keys).toContain(required);
    }
  });

  it('every template has at least one capability', () => {
    for (const template of FACTORY_ROLE_TEMPLATES) {
      expect(template.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('PROJECT_SPONSOR has project.view and decision.approve', () => {
    const sponsor = FACTORY_ROLE_TEMPLATES.find((t) => t.roleKey === 'PROJECT_SPONSOR');
    expect(sponsor?.capabilities).toContain('project.view');
    expect(sponsor?.capabilities).toContain('decision.approve');
  });

  it('PROJECT_LEADER has project.team.manage', () => {
    const leader = FACTORY_ROLE_TEMPLATES.find((t) => t.roleKey === 'PROJECT_LEADER');
    expect(leader?.capabilities).toContain('project.team.manage');
  });

  it('OBSERVER does not have any manage capability', () => {
    const observer = FACTORY_ROLE_TEMPLATES.find((t) => t.roleKey === 'OBSERVER');
    const manageCaps = observer?.capabilities.filter((c) => c.includes('.manage'));
    expect(manageCaps?.length).toBe(0);
  });

  it('CONSULTANT has only scoped or assigned caps (no broad project.view)', () => {
    const consultant = FACTORY_ROLE_TEMPLATES.find((t) => t.roleKey === 'CONSULTANT');
    // Consultant should NOT have plain project.view (only project.view.scoped)
    const hasPlainProjectView = consultant?.capabilities.includes('project.view');
    expect(hasPlainProjectView).toBe(false);
  });

  it('no template contains superadmin.* capabilities (guardrail)', () => {
    for (const template of FACTORY_ROLE_TEMPLATES) {
      const superadminCaps = template.capabilities.filter((c) => c.startsWith('superadmin.'));
      expect(superadminCaps).toEqual([]);
    }
  });

  it('required templates have isRequired=true', () => {
    const requiredRoles = ['PROJECT_SPONSOR', 'PROJECT_LEADER', 'TASK_ASSIGNEE', 'OBSERVER'];
    for (const roleKey of requiredRoles) {
      const template = FACTORY_ROLE_TEMPLATES.find((t) => t.roleKey === roleKey);
      expect(template?.isRequired).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Faza B (2026-07-14) — new capability families completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('FACTORY_ROLE_TEMPLATES — Faza B capability families', () => {
  const byRole = (roleKey: string) =>
    FACTORY_ROLE_TEMPLATES.find((t) => t.roleKey === roleKey)?.capabilities ?? [];

  // Every capability wired into a Faza B shadow guard must exist in the
  // catalog for at least LEADER+PMO — otherwise shadow telemetry would report
  // wouldAllow=false for every non-admin and the data would be useless.
  const FAZA_B_FULL_CAPS = [
    'initiative.program.manage',
    'initiative.template.manage',
    'initiative.template.apply',
    'initiative.section_type.manage',
    'initiative.wizard.use',
    'initiative.dependency.manage',
    'initiative.milestone.manage',
    'initiative.resource.manage',
    'initiative.staffing.manage',
    'initiative.budget.manage',
    'initiative.tool.manage',
    'initiative.intangible.manage',
    'initiative.stakeholder.manage',
    'initiative.watcher.manage',
    'initiative.raid.manage',
    'initiative.link.manage',
    'initiative.gate_role.manage',
    'initiative.pir.manage',
    'change.champion.manage',
    'project.archive',
    'project.delete',
  ];

  const FAZA_B_OWNER_SCOPED_CAPS = [
    'initiative.template.apply.scoped',
    'initiative.wizard.use.scoped',
    'initiative.milestone.manage.scoped',
    'initiative.resource.manage.scoped',
    'initiative.staffing.manage.scoped',
    'initiative.budget.manage.scoped',
    'initiative.tool.manage.scoped',
    'initiative.intangible.manage.scoped',
    'initiative.stakeholder.manage.scoped',
    'initiative.watcher.manage.scoped',
    'initiative.raid.manage.scoped',
    'initiative.link.manage.scoped',
  ];

  it('PROJECT_LEADER has every Faza B capability (unscoped)', () => {
    const caps = byRole('PROJECT_LEADER');
    for (const cap of FAZA_B_FULL_CAPS) {
      expect(caps, `PROJECT_LEADER missing ${cap}`).toContain(cap);
    }
  });

  it('PMO has every Faza B capability (unscoped)', () => {
    const caps = byRole('PMO');
    for (const cap of FAZA_B_FULL_CAPS) {
      expect(caps, `PMO missing ${cap}`).toContain(cap);
    }
  });

  it('INITIATIVE_OWNER and WORKSTREAM_OWNER get the scoped building-block set', () => {
    for (const roleKey of ['INITIATIVE_OWNER', 'WORKSTREAM_OWNER']) {
      const caps = byRole(roleKey);
      for (const cap of FAZA_B_OWNER_SCOPED_CAPS) {
        expect(caps, `${roleKey} missing ${cap}`).toContain(cap);
      }
    }
  });

  it('owners do NOT get org-level asset management (programs/templates/section-types)', () => {
    for (const roleKey of ['INITIATIVE_OWNER', 'WORKSTREAM_OWNER']) {
      const caps = byRole(roleKey);
      expect(caps).not.toContain('initiative.program.manage');
      expect(caps).not.toContain('initiative.template.manage');
      expect(caps).not.toContain('initiative.section_type.manage');
      expect(caps).not.toContain('project.delete');
    }
  });

  it('read-only / support roles get NONE of the Faza B mutating capabilities', () => {
    for (const roleKey of ['OBSERVER', 'REVIEWER', 'SME', 'CONSULTANT', 'TASK_ASSIGNEE']) {
      const caps = byRole(roleKey);
      for (const cap of [...FAZA_B_FULL_CAPS, ...FAZA_B_OWNER_SCOPED_CAPS]) {
        expect(caps, `${roleKey} unexpectedly has ${cap}`).not.toContain(cap);
      }
    }
  });

  it('initiative.stakeholder.manage is distinct from org-level stakeholder.registry.manage', () => {
    // Dedicated initiative-level capability (audyt Fazy A): granting the
    // initiative list must NOT implicitly grant the org registry and vice versa.
    const leader = byRole('PROJECT_LEADER');
    expect(leader).toContain('initiative.stakeholder.manage');
    expect(leader).not.toContain('stakeholder.registry.manage');
    const pmo = byRole('PMO');
    expect(pmo).toContain('initiative.stakeholder.manage');
    expect(pmo).toContain('stakeholder.registry.manage');
  });

  it('scoped Faza B caps satisfy the base capability via suffix matching', () => {
    expect(
      hasEffectiveCapability(
        { capabilities: ['initiative.milestone.manage.scoped'], platformRole: null },
        'initiative.milestone.manage'
      )
    ).toBe(true);
  });
});
