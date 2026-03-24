import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => `uuid-${Math.random()}`),
}));

describe('InitiativeGovernanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applyBlueprint creates tasks, dependencies, milestones and resources', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'bp-1',
      organization_id: 'org-1',
      initiative_id: 'init-1',
      status: 'proposed',
      generated_wbs: JSON.stringify([
        { id: 'task-a', title: 'Task A', description: 'Desc A' },
        { id: 'task-b', title: 'Task B', description: 'Desc B' },
      ]),
      generated_deps: JSON.stringify([{ from: 'task-a', to: 'task-b', type: 'hard' }]),
      generated_milestones: JSON.stringify([{ name: 'M1', targetDate: '2026-04-01' }]),
      generated_resources: JSON.stringify([{ name: 'Analyst', role: 'lead', allocationPercentage: 50 }]),
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { initiativeGovernanceService } = await import(
      '../../../../server/src/services/initiativeGovernanceService.js'
    );
    const result = await initiativeGovernanceService.applyBlueprint('org-1', 'bp-1', 'user-1');

    expect(result.ok).toBe(true);
    expect(result.tasksCreated).toBe(2);
    expect(result.dependenciesCreated).toBe(1);
    expect(result.milestonesCreated).toBe(1);
    expect(result.resourcesCreated).toBe(1);
    expect(mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO tasks'))).toBe(true);
    expect(mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO task_dependencies'))).toBe(true);
    expect(mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO initiative_milestones'))).toBe(true);
    expect(mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO initiative_resources'))).toBe(true);
  });

  it('evaluateGate accounts for decision, raid and approver requirements', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({
        required_decisions: JSON.stringify(['dec-1']),
        required_approvers: JSON.stringify(['user-approver']),
        required_raid_status: JSON.stringify({ mitigated: 1 }),
        initiative_id: 'init-1',
      })
      .mockResolvedValueOnce({ workflow_status: 'published' })
      .mockResolvedValueOnce({ cnt: 1 })
      .mockResolvedValueOnce({ id: 'dec-1' });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { initiativeGovernanceService } = await import(
      '../../../../server/src/services/initiativeGovernanceService.js'
    );
    const result = await initiativeGovernanceService.evaluateGate('org-1', 'gate-1');

    expect(result).toEqual(
      expect.objectContaining({
        status: 'passed',
        decisionsReady: true,
        raidReady: true,
        approversReady: true,
      })
    );
  });
});
