import { beforeEach, describe, expect, it, vi } from 'vitest';

const processDue = vi.fn();

vi.mock('../../services/wave8AgentRuntimeService.js', () => ({
  processDueWave8AgentSchedules: processDue,
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('wave8AgentScheduleJob', () => {
  beforeEach(() => processDue.mockReset());

  it('runs an organization-wide durable sweep with a unique worker identity', async () => {
    processDue.mockResolvedValue([{ runId: 'run-1' }, { runId: 'run-2' }]);
    const { runWave8AgentScheduleTick } = await import('../wave8AgentScheduleJob.js');

    const result = await runWave8AgentScheduleTick();

    expect(result.processed).toBe(2);
    expect(result.workerId).toMatch(/^wave8-cron-\d+-/);
    expect(processDue).toHaveBeenCalledWith({ workerId: result.workerId });
  });
});
