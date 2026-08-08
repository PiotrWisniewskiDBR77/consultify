import { beforeEach, describe, expect, it, vi } from 'vitest';

const { planner, queueAdd } = vi.hoisted(() => ({
  planner: {
    listScheduledPlansDue: vi.fn(),
    listWaitStepsDue: vi.fn(),
    gateScheduledWorkerDispatch: vi.fn(),
    resumeWaitStep: vi.fn(),
    executeGovernedEnqueue: vi.fn(),
  },
  queueAdd: vi.fn(),
}));

vi.mock('../../services/ai/agentPlannerService.js', () => ({ agentPlannerService: planner }));
vi.mock('../../queues/aiQueue.js', () => ({ default: { add: queueAdd } }));
vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('agent plan scheduler context gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planner.listScheduledPlansDue.mockResolvedValue([
      { id: 'plan-1', organizationId: 'org-1', userId: 'user-1' },
    ]);
    planner.listWaitStepsDue.mockResolvedValue([
      { planId: 'plan-2', stepIndex: 3, organizationId: 'org-1', userId: 'user-1' },
    ]);
    planner.executeGovernedEnqueue.mockImplementation(async (input) => ({
      replayed: false,
      result: await input.enqueue(),
    }));
  });

  it('does not enqueue or resume when canonical context is blocked', async () => {
    planner.gateScheduledWorkerDispatch.mockResolvedValue({
      allowed: false,
      decision: 'blocked_drift',
      reason: 'drift',
    });
    const { runAgentPlanScheduler } = await import('../agentPlanSchedulerJob.js');
    const result = await runAgentPlanScheduler(true);
    expect(result).toEqual({
      plansDispatched: 0,
      waitStepsResumed: 0,
      contextBlocked: 2,
      errors: 0,
    });
    expect(queueAdd).not.toHaveBeenCalled();
    expect(planner.resumeWaitStep).not.toHaveBeenCalled();
  });

  it('dispatches each clean worker item exactly once', async () => {
    planner.gateScheduledWorkerDispatch.mockResolvedValue({
      allowed: true,
      decision: 'allowed',
      reason: 'fresh',
    });
    queueAdd.mockResolvedValue({ id: 'job' });
    const { runAgentPlanScheduler } = await import('../agentPlanSchedulerJob.js');
    const result = await runAgentPlanScheduler(true);
    expect(result).toEqual({
      plansDispatched: 1,
      waitStepsResumed: 1,
      contextBlocked: 0,
      errors: 0,
    });
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(planner.resumeWaitStep).toHaveBeenCalledTimes(1);
  });

  it('resource denial produces zero resume and zero queue side effects', async () => {
    planner.listScheduledPlansDue.mockResolvedValue([
      {
        id: 'plan-1',
        organizationId: 'org-1',
        userId: 'user-1',
        canonicalRunId: 'canonical-1',
        projectId: 'project-1',
      },
    ]);
    planner.listWaitStepsDue.mockResolvedValue([
      {
        planId: 'plan-2',
        stepIndex: 3,
        organizationId: 'org-1',
        userId: 'user-1',
        canonicalRunId: 'canonical-1',
        projectId: 'project-1',
      },
    ]);
    planner.gateScheduledWorkerDispatch.mockResolvedValue({
      allowed: true,
      decision: 'allowed',
      reason: 'fresh',
    });
    planner.executeGovernedEnqueue.mockRejectedValue(
      new Error('resource_concurrency_limit_exceeded')
    );
    const { runAgentPlanScheduler } = await import('../agentPlanSchedulerJob.js');
    const result = await runAgentPlanScheduler(true);
    expect(result.errors).toBe(2);
    expect(queueAdd).not.toHaveBeenCalled();
    expect(planner.resumeWaitStep).not.toHaveBeenCalled();
  });
});
