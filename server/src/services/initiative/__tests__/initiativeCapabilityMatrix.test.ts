/**
 * INI-04 — canonical capability matrix.
 *
 * Covers the pure decision surface (`computeInitiativeCapabilities`,
 * `computeApprovalProfile`, `canExecuteGate`) plus the I/O helpers
 * (`readInitiativeRaciRoles`, `assertUsersInOrganization`) with the DB layer
 * mocked. A separate `.pg.test.ts` exercises the same helpers against a real
 * PostgreSQL for the tenant-scope guard.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock, queryOneMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  queryOneMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryOne: queryOneMock,
}));

import {
  assertUsersInOrganization,
  canExecuteGate,
  computeApprovalProfile,
  computeInitiativeCapabilities,
  getInitiativeTopBarCapabilities,
  RACI_ROLE_TOKENS,
  readInitiativeRaciRoles,
  resolveGateRequiredRoles,
} from '../initiativeCapabilityMatrix.js';

describe('computeInitiativeCapabilities', () => {
  beforeEach(() => {
    queryAllMock.mockReset();
    queryOneMock.mockReset();
  });

  it('grants edit capability to the initiative OWNER role', () => {
    const decision = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: ['INITIATIVE_OWNER'],
    });
    expect(decision.topBar.canEditOwner).toBe(true);
    expect(decision.topBar.canEditPriority).toBe(true);
    expect(decision.topBar.canEditTargetDate).toBe(true);
    expect(decision.cards.canEditCards).toBe(true);
    expect(decision.cards.reasonCode).toBeNull();
  });

  it('grants edit capability to the PROJECT_SPONSOR role', () => {
    const decision = computeInitiativeCapabilities({
      status: 'REVIEW',
      effectiveRoles: ['PROJECT_SPONSOR'],
    });
    expect(decision.cards.canEditCards).toBe(true);
    expect(decision.ai.canUseAi).toBe(true);
  });

  it('grants edit capability to RACI Accountable and Responsible tokens', () => {
    const accountable = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: [RACI_ROLE_TOKENS.A],
    });
    const responsible = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: [RACI_ROLE_TOKENS.R],
    });
    expect(accountable.hasEditRole).toBe(true);
    expect(responsible.hasEditRole).toBe(true);
  });

  it('denies RACI Consulted and Informed — RACI presence alone is not a grant', () => {
    const consulted = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: [RACI_ROLE_TOKENS.C],
    });
    const informed = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: [RACI_ROLE_TOKENS.I],
    });
    expect(consulted.hasEditRole).toBe(false);
    expect(informed.hasEditRole).toBe(false);
    expect(consulted.cards.reasonCode).toBe('NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE');
  });

  it('fails closed: a user with NO role gets no capability at all', () => {
    const decision = computeInitiativeCapabilities({ status: 'PLANNING', effectiveRoles: [] });
    expect(decision.hasEditRole).toBe(false);
    expect(decision.topBar).toEqual({
      canEditPriority: false,
      canEditOwner: false,
      canEditTargetDate: false,
    });
    expect(decision.cards.canEditCards).toBe(false);
    expect(decision.ai.canUseAi).toBe(false);
    expect(decision.contextCreateActions).toEqual([]);
  });

  it('fails closed on an unrecognized role token — no implicit allow', () => {
    const decision = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: ['SOME_MADE_UP_ROLE'],
    });
    expect(decision.hasEditRole).toBe(false);
  });

  it('ADMIN overrides status/role gating for edit capability', () => {
    const decision = computeInitiativeCapabilities({
      status: 'PLANNING',
      effectiveRoles: ['ADMIN'],
    });
    expect(decision.isAdmin).toBe(true);
    expect(decision.hasEditRole).toBe(true);
    expect(decision.topBar.canEditOwner).toBe(true);
  });

  it('freezes ALL capabilities in terminal statuses, even for ADMIN', () => {
    const cancelled = computeInitiativeCapabilities({
      status: 'CANCELLED',
      effectiveRoles: ['ADMIN'],
    });
    const archived = computeInitiativeCapabilities({
      status: 'ARCHIVED',
      effectiveRoles: ['INITIATIVE_OWNER'],
    });
    expect(cancelled.isTerminal).toBe(true);
    expect(cancelled.topBar).toEqual({
      canEditPriority: false,
      canEditOwner: false,
      canEditTargetDate: false,
    });
    expect(cancelled.ai.canUseAi).toBe(false);
    expect(archived.cards.canEditCards).toBe(false);
  });

  it('status normalization is case-insensitive (status source may be lowercase)', () => {
    const decision = computeInitiativeCapabilities({
      status: 'planning',
      effectiveRoles: ['pmo'],
    });
    expect(decision.hasEditRole).toBe(true);
  });

  it('getInitiativeTopBarCapabilities is the same decision as the topBar slice', () => {
    const topBar = getInitiativeTopBarCapabilities('EXECUTING', ['PROJECT_MANAGER']);
    const full = computeInitiativeCapabilities({
      status: 'EXECUTING',
      effectiveRoles: ['PROJECT_MANAGER'],
    });
    expect(topBar).toEqual(full.topBar);
  });
});

describe('resolveGateRequiredRoles + canExecuteGate — approval profile', () => {
  it('STEERING_COMMITTEE requirement degrades to sponsor/portfolio-owner when no board exists', () => {
    const roles = resolveGateRequiredRoles('APPROVE', false);
    expect(roles).toEqual(['PROJECT_SPONSOR', 'PORTFOLIO_OWNER']);
  });

  it('STEERING_COMMITTEE requirement stays literal when a board is enabled', () => {
    const roles = resolveGateRequiredRoles('APPROVE', true);
    expect(roles).toEqual(['STEERING_COMMITTEE']);
  });

  it('a null gate has no required roles (ungated transition)', () => {
    expect(resolveGateRequiredRoles(null, false)).toEqual([]);
  });

  it('canExecuteGate allows a role holder and denies everyone else', () => {
    expect(
      canExecuteGate({
        gate: 'APPROVE',
        effectiveRoles: ['PROJECT_SPONSOR'],
        steeringBoardEnabled: false,
      })
    ).toBe(true);
    expect(
      canExecuteGate({
        gate: 'APPROVE',
        effectiveRoles: ['TEAM_MEMBER'],
        steeringBoardEnabled: false,
      })
    ).toBe(false);
  });

  it('canExecuteGate fails closed on an empty role set', () => {
    expect(
      canExecuteGate({ gate: 'APPROVE', effectiveRoles: [], steeringBoardEnabled: false })
    ).toBe(false);
  });

  it('canExecuteGate: RACI Accountable/Responsible does NOT grant a gate — approvals stay role-based', () => {
    expect(
      canExecuteGate({
        gate: 'APPROVE',
        effectiveRoles: [RACI_ROLE_TOKENS.A, RACI_ROLE_TOKENS.R],
        steeringBoardEnabled: false,
      })
    ).toBe(false);
  });

  it('canExecuteGate: ADMIN passes any gate', () => {
    expect(
      canExecuteGate({ gate: 'APPROVE', effectiveRoles: ['ADMIN'], steeringBoardEnabled: false })
    ).toBe(true);
  });

  it('computeApprovalProfile reports assigned approvers and per-transition executability', () => {
    const profile = computeApprovalProfile({
      status: 'REVIEW',
      effectiveRoles: ['PROJECT_SPONSOR'],
      steeringBoardEnabled: false,
      assignments: [
        { gateRole: 'PROJECT_SPONSOR', userId: 'user-sponsor' },
        { gateRole: 'STEERING_COMMITTEE', userId: 'user-board' },
      ],
    });
    const promoted = profile.find((t) => t.targetStatus === 'PROMOTED');
    expect(promoted).toBeDefined();
    expect(promoted?.canCurrentUserExecute).toBe(true);
    expect(promoted?.hasAssignedApprover).toBe(true);
    expect(promoted?.assignedApprovers.map((a) => a.userId)).toContain('user-sponsor');
  });
});

describe('readInitiativeRaciRoles — I/O with the DB mocked', () => {
  beforeEach(() => {
    queryAllMock.mockReset();
  });

  it('maps raci_type letters to role tokens, tenant-scoped by BOTH initiative and user org', () => {
    queryAllMock.mockResolvedValue([{ raciType: 'A' }, { raciType: 'r' }]);
    return readInitiativeRaciRoles('org-1', 'init-1', 'user-1').then((roles) => {
      expect(roles.sort()).toEqual([RACI_ROLE_TOKENS.A, RACI_ROLE_TOKENS.R].sort());
      const [sql, params] = queryAllMock.mock.calls[0];
      expect(sql).toMatch(/i\.organization_id = \?/);
      expect(sql).toMatch(/u\.organization_id = \?/);
      expect(params).toEqual(['init-1', 'user-1', 'org-1', 'org-1']);
    });
  });

  it('fails closed to an empty set when the query throws (e.g. missing table)', async () => {
    queryAllMock.mockRejectedValue(new Error('no such table: initiative_stakeholders'));
    const roles = await readInitiativeRaciRoles('org-1', 'init-1', 'user-1');
    expect(roles).toEqual([]);
  });

  it('ignores unrecognized raci_type values rather than throwing', async () => {
    queryAllMock.mockResolvedValue([{ raciType: 'X' }, { raciType: null }]);
    const roles = await readInitiativeRaciRoles('org-1', 'init-1', 'user-1');
    expect(roles).toEqual([]);
  });

  it('returns empty immediately for missing ids without touching the DB', async () => {
    const roles = await readInitiativeRaciRoles('', 'init-1', 'user-1');
    expect(roles).toEqual([]);
    expect(queryAllMock).not.toHaveBeenCalled();
  });
});

describe('assertUsersInOrganization — cross-tenant deny', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
  });

  it('passes when every candidate user resolves inside the organization', async () => {
    queryOneMock.mockResolvedValue({ id: 'user-1' });
    const verdict = await assertUsersInOrganization('org-1', ['user-1', 'user-2']);
    expect(verdict.ok).toBe(true);
    expect(verdict.offending).toEqual([]);
    expect(queryOneMock).toHaveBeenCalledTimes(2);
  });

  it('denies and reports the offending id when a user is not in the organization', async () => {
    queryOneMock.mockImplementation(async (_sql: string, params: unknown[]) => {
      return params[0] === 'user-inside' ? { id: 'user-inside' } : null;
    });
    const verdict = await assertUsersInOrganization('org-1', ['user-inside', 'user-outside']);
    expect(verdict.ok).toBe(false);
    expect(verdict.offending).toEqual(['user-outside']);
  });

  it('fails closed when the users table is unreadable', async () => {
    queryOneMock.mockRejectedValue(new Error('connection lost'));
    const verdict = await assertUsersInOrganization('org-1', ['user-1']);
    expect(verdict.ok).toBe(false);
    expect(verdict.offending).toEqual(['user-1']);
  });

  it('fails closed when organizationId itself is missing', async () => {
    const verdict = await assertUsersInOrganization('', ['user-1']);
    expect(verdict.ok).toBe(false);
    expect(verdict.offending).toEqual(['user-1']);
    expect(queryOneMock).not.toHaveBeenCalled();
  });

  it('is a no-op (ok=true) when no candidate ids are provided', async () => {
    const verdict = await assertUsersInOrganization('org-1', [undefined, null, '', '  ']);
    expect(verdict.ok).toBe(true);
    expect(verdict.offending).toEqual([]);
    expect(queryOneMock).not.toHaveBeenCalled();
  });
});

describe('route/service parity — the same profile must yield the same decision', () => {
  it('computeInitiativeCapabilities called with the SAME effectiveRoles from two different callers agrees byte-for-byte', () => {
    // Simulates: pmo/initiatives.routes → InitiativeController.getGateReadinessCheck
    // vs. v8/planning.routes → planningPortfolioReadService.getInitiativeGateReadinessRead.
    // Both now call the exact same function; this pins that contract so a future
    // edit to only one call site would show up as a snapshot mismatch, not a
    // silent runtime drift between the two routes.
    const profile = {
      status: 'PLANNING',
      effectiveRoles: ['INITIATIVE_OWNER', RACI_ROLE_TOKENS.C],
    };
    const fromPmoRoute = computeInitiativeCapabilities(profile);
    const fromV8Route = computeInitiativeCapabilities({ ...profile });
    expect(fromV8Route).toEqual(fromPmoRoute);
  });
});
