import { describe, expect, it, vi } from 'vitest';

import Scheduler, { registerInternalBetaBackupJob } from '../../../../server/src/cron/Scheduler.js';

describe('DATA-DR Scheduler lifecycle authority', () => {
  it('registers exactly one UTC 15-minute job through the Scheduler seam', () => {
    const task = { stop: vi.fn() } as any;
    const schedule = vi.fn().mockReturnValue(task);
    expect(registerInternalBetaBackupJob(schedule)).toBe(task);
    expect(schedule).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function), { timezone: 'UTC' });
  });

  it('makes repeated Scheduler.init idempotent when jobs are already registered', async () => {
    const task = { stop: vi.fn() } as any;
    Scheduler.jobs = [task];
    await Scheduler.init();
    expect(Scheduler.jobs).toEqual([task]);
    Scheduler.jobs = [];
  });

  it('shares one initialization promise across concurrent callers', async () => {
    let release!: () => void;
    const original = Scheduler.initialize;
    const initialize = vi.spyOn(Scheduler, 'initialize').mockImplementation(
      () => new Promise<void>((resolve) => { release = resolve; })
    );
    const first = Scheduler.init();
    const second = Scheduler.init();
    expect(initialize).toHaveBeenCalledOnce();
    release();
    await Promise.all([first, second]);
    initialize.mockRestore();
    Scheduler.initialize = original;
  });

  it('stops every registered job and clears the registry', async () => {
    const taskA = { stop: vi.fn() } as any;
    const taskB = { stop: vi.fn() } as any;
    Scheduler.jobs = [taskA, taskB];
    await Scheduler.stop();
    expect(taskA.stop).toHaveBeenCalledOnce();
    expect(taskB.stop).toHaveBeenCalledOnce();
    expect(Scheduler.jobs).toEqual([]);
  });

  it('waits for an active initialization before draining registered jobs', async () => {
    let release!: () => void;
    const task = { stop: vi.fn() } as any;
    Scheduler.jobs = [task];
    Scheduler.initPromise = new Promise<void>((resolve) => { release = resolve; });
    const stopping = Scheduler.stop();
    await Promise.resolve();
    expect(task.stop).not.toHaveBeenCalled();
    release();
    await stopping;
    expect(task.stop).toHaveBeenCalledOnce();
    Scheduler.initPromise = null;
  });
});
