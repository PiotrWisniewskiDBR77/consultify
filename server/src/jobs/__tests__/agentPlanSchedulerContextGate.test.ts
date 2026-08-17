import { beforeEach, describe, expect, it, vi } from 'vitest';

const { planner, dispatchAgentTask } = vi.hoisted(() => ({
  planner: {
    listScheduledPlansDue: vi.fn(),
    listWaitStepsDue: vi.fn(),
    gateScheduledWorkerDispatch: vi.fn(),
    resumeWaitStep: vi.fn(),
    executeGovernedEnqueue: vi.fn(),
  },
  dispatchAgentTask: vi.fn(),
}));

vi.mock('../../services/ai/agentPlannerService.js', () => ({ agentPlannerService: planner }));
vi.mock('../../services/ai/agentTaskDispatchService.js', () => ({ dispatchAgentTask }));
vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('agent plan scheduler context gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_AI_TASKS_WORKER = 'true';
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

  it('does not inspect or enqueue due work while the shared worker flag is OFF', async () => {
    process.env.ENABLE_AI_TASKS_WORKER = 'false';
    const { runAgentPlanScheduler } = await import('../agentPlanSchedulerJob.js');
    expect(await runAgentPlanScheduler(true)).toEqual({
      plansDispatched: 0, waitStepsResumed: 0, contextBlocked: 0, errors: 0,
    });
    expect(planner.listScheduledPlansDue).not.toHaveBeenCalled();
    expect(dispatchAgentTask).not.toHaveBeenCalled();
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
    expect(dispatchAgentTask).not.toHaveBeenCalled();
    expect(planner.resumeWaitStep).not.toHaveBeenCalled();
  });

  it('dispatches each clean worker item exactly once', async () => {
    planner.gateScheduledWorkerDispatch.mockResolvedValue({
      allowed: true,
      decision: 'allowed',
      reason: 'fresh',
    });
    dispatchAgentTask.mockImplementation(async (_input, options) => {
      await options?.beforeEnqueue?.();
      return { status: 'ENQUEUED', receiptId: 'receipt-1' };
    });
    const { runAgentPlanScheduler } = await import('../agentPlanSchedulerJob.js');
    const result = await runAgentPlanScheduler(true);
    expect(result).toEqual({
      plansDispatched: 1,
      waitStepsResumed: 1,
      contextBlocked: 0,
      errors: 0,
    });
    expect(dispatchAgentTask).toHaveBeenCalledTimes(2);
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
    expect(dispatchAgentTask).not.toHaveBeenCalled();
    expect(planner.resumeWaitStep).not.toHaveBeenCalled();
  });
});
