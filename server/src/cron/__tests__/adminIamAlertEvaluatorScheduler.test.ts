import { afterEach, describe, expect, it, vi } from 'vitest';

const runTick = vi.fn();
vi.mock('../../jobs/adminIamAlertEvaluationJob.js', () => ({
  runAdminIamAlertEvaluationTick: runTick,
}));

describe('Admin IAM alert scheduler gate', () => {
  afterEach(() => {
    delete process.env.ADMIN_IAM_ALERT_EVALUATOR_CRON_ENABLED;
    vi.clearAllMocks();
  });

  it('is default-ON and runs exactly one bounded tick', async () => {
    runTick.mockResolvedValue({ candidates: 0, evaluated: 0, failed: 0 });
    const { runAdminIamAlertSchedulerTick } = await import('../Scheduler.js');
    await runAdminIamAlertSchedulerTick();
    expect(runTick).toHaveBeenCalledTimes(1);
  });

  it('performs no evaluation when explicitly disabled', async () => {
    process.env.ADMIN_IAM_ALERT_EVALUATOR_CRON_ENABLED = 'false';
    const { runAdminIamAlertSchedulerTick } = await import('../Scheduler.js');
    await runAdminIamAlertSchedulerTick();
    expect(runTick).not.toHaveBeenCalled();
  });

  it('contains a runner failure without retrying in the same tick', async () => {
    process.env.ADMIN_IAM_ALERT_EVALUATOR_CRON_ENABLED = 'true';
    runTick.mockRejectedValue(new Error('forced runner failure'));
    const { runAdminIamAlertSchedulerTick } = await import('../Scheduler.js');
    await expect(runAdminIamAlertSchedulerTick()).resolves.toBeUndefined();
    expect(runTick).toHaveBeenCalledTimes(1);
  });
});
