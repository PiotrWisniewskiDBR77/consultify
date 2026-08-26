import { describe, expect, it, vi } from 'vitest';

import { registerWorkSignalProducerJob } from '../Scheduler.js';

describe('work signal producer scheduler registration', () => {
  it('registers exactly one deterministic schedule at fifteen-minute cadence', () => {
    const schedule = vi.fn(() => ({ stop: vi.fn() })) as never;
    registerWorkSignalProducerJob(schedule);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function), {
      timezone: 'UTC',
    });
  });
});
