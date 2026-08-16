import { describe, expect, it, vi } from 'vitest';

vi.mock('../asyncJobProcessor.js', () => ({ default: {} }));
vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('ai-tasks AGENT_BACKGROUND_TASK tenant envelope', () => {
  it('rejects missing organization before loading autonomous execution', async () => {
    const { processAiTaskJob } = await import('../aiWorker.js');
    await expect(
      processAiTaskJob({
        id: 'bad-org',
        name: 'agent',
        data: {
          taskType: 'AGENT_BACKGROUND_TASK',
          userId: 'u1',
          payload: { userId: 'u1', planId: 'p1' },
        },
      } as any)
    ).rejects.toThrow('AGENT_BACKGROUND_TASK_TENANT_CONTEXT_INVALID');
  });

  it('rejects a queue user/payload user mismatch', async () => {
    const { processAiTaskJob } = await import('../aiWorker.js');
    await expect(
      processAiTaskJob({
        id: 'bad-user',
        name: 'agent',
        data: {
          taskType: 'AGENT_BACKGROUND_TASK',
          userId: 'u1',
          payload: { organizationId: 'o1', userId: 'u2', planId: 'p1' },
        },
      } as any)
    ).rejects.toThrow('AGENT_BACKGROUND_TASK_TENANT_CONTEXT_INVALID');
  });
});
