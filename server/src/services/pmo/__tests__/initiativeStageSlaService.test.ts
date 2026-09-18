import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock, queryRunMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  queryRunMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryRun: queryRunMock,
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  derivePmoRoleFromLegacyStakeholderRole,
  resolvePlanDrivenNextStage,
  runInitiativeStageSlaEscalationTick,
} from '../initiativeStageSlaService.js';

const NOW = new Date('2026-09-17T20:00:00.000Z');

beforeEach(() => {
  queryAllMock.mockReset();
  queryRunMock.mockReset();
});

describe('PMO-1b initiative stage SLA service', () => {
  it('derives PMO role without changing legacy stakeholder role semantics', () => {
    expect(derivePmoRoleFromLegacyStakeholderRole('SPONSOR')).toBe('SPONSOR');
    expect(derivePmoRoleFromLegacyStakeholderRole('OWNER')).toBe('OWNER');
    expect(derivePmoRoleFromLegacyStakeholderRole('CONTRIBUTOR')).toBe('MEMBER');
    expect(derivePmoRoleFromLegacyStakeholderRole('REVIEWER')).toBe('PMO');
    expect(derivePmoRoleFromLegacyStakeholderRole('INFORMED')).toBe('VIEWER');
    expect(derivePmoRoleFromLegacyStakeholderRole(null)).toBe('VIEWER');
    expect(derivePmoRoleFromLegacyStakeholderRole('Sponsor / CFO')).toBeNull();
  });

  it('uses the canonical plan-driven stage flow for 7 to 8: IN_EXECUTION to DELIVERED', () => {
    expect(resolvePlanDrivenNextStage('IN_EXECUTION')).toBe('DELIVERED');
    expect(resolvePlanDrivenNextStage('DELIVERED')).toBe('BENEFITS_TRACKING');
    expect(resolvePlanDrivenNextStage('unknown')).toBeNull();
  });

  it('degrades escalation target from empty steering committee to sponsor', async () => {
    queryAllMock
      .mockResolvedValueOnce([
        {
          due_date_id: 'due-1',
          organization_id: 'org-1',
          initiative_id: 'init-1',
          initiative_title: 'Northwind rollout',
          lifecycle_stage: 'IN_EXECUTION',
          next_lifecycle_stage: 'DELIVERED',
          due_at: '2026-09-16T20:00:00.000Z',
          current_level: 0,
          escalated_today: 0,
        },
      ])
      .mockResolvedValueOnce([
        { user_id: null, pmo_role: 'STEERING_COMMITTEE' },
        { user_id: 'sponsor-1', pmo_role: 'SPONSOR' },
        { user_id: 'pmo-1', pmo_role: 'PMO' },
      ]);

    const result = await runInitiativeStageSlaEscalationTick({
      dryRun: true,
      organizationId: 'org-1',
      now: NOW,
    });

    expect(result.escalated).toBe(0);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      dueDateId: 'due-1',
      route: 'sponsor',
      targetPmoRole: 'SPONSOR',
      targetUserId: 'sponsor-1',
      lifecycleStage: 'IN_EXECUTION',
      nextLifecycleStage: 'DELIVERED',
    });
    expect(queryRunMock).not.toHaveBeenCalled();
  });

  it('writes one escalation event on explicit non-dry tick', async () => {
    queryAllMock
      .mockResolvedValueOnce([
        {
          due_date_id: 'due-2',
          organization_id: 'org-1',
          initiative_id: 'init-2',
          initiative_title: 'Warehouse plan',
          lifecycle_stage: 'SCHEDULED',
          next_lifecycle_stage: 'IN_EXECUTION',
          due_at: '2026-09-16T20:00:00.000Z',
          current_level: 1,
          escalated_today: 0,
        },
      ])
      .mockResolvedValueOnce([{ user_id: 'pmo-2', pmo_role: 'PMO' }]);
    queryRunMock.mockResolvedValue({ changes: 1 });

    const result = await runInitiativeStageSlaEscalationTick({
      dryRun: false,
      organizationId: 'org-1',
      now: NOW,
    });

    expect(result.escalated).toBe(1);
    expect(queryRunMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryRunMock.mock.calls[0];
    expect(String(sql)).toContain('initiative_stage_escalation_events');
    expect(params).toEqual(
      expect.arrayContaining(['org-1', 'init-2', 'due-2', 'SCHEDULED', 'IN_EXECUTION', 2, 'PMO', 'pmo-2', 'pmo'])
    );
  });
});
