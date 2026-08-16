import { afterEach, describe, expect, it, vi } from 'vitest';

const { close, initWorker } = vi.hoisted(() => ({
  close: vi.fn(async () => undefined),
  initWorker: vi.fn(() => ({ close })),
}));

vi.mock('../aiWorker.js', () => ({ initWorker }));
vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  isAiTasksWorkerRunning,
  startAiTasksWorker,
  stopAiTasksWorker,
} from '../aiWorkerRuntime.js';

describe('ai-tasks worker controlled runtime', () => {
  afterEach(async () => {
    await stopAiTasksWorker();
    vi.clearAllMocks();
  });

  it('is default OFF and does not initialize a consumer', async () => {
    expect(await startAiTasksWorker({} as NodeJS.ProcessEnv)).toBeNull();
    expect(initWorker).not.toHaveBeenCalled();
    expect(isAiTasksWorkerRunning()).toBe(false);
  });

  it('fails closed when enabled with mock/unavailable Redis', async () => {
    await expect(
      startAiTasksWorker({
        ENABLE_AI_TASKS_WORKER: 'true',
        MOCK_REDIS: 'true',
      } as NodeJS.ProcessEnv)
    ).rejects.toThrow('AI_TASKS_WORKER_REQUIRES_REAL_REDIS');
  });

  it('starts once and closes the same worker during shutdown', async () => {
    const env = { ENABLE_AI_TASKS_WORKER: 'true' } as NodeJS.ProcessEnv;
    const first = await startAiTasksWorker(env);
    const second = await startAiTasksWorker(env);
    expect(first).toBe(second);
    expect(initWorker).toHaveBeenCalledOnce();
    expect(isAiTasksWorkerRunning()).toBe(true);
    await stopAiTasksWorker();
    expect(close).toHaveBeenCalledOnce();
    expect(isAiTasksWorkerRunning()).toBe(false);
  });
});
