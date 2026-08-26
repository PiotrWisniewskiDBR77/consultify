import { afterEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock, evaluateMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  evaluateMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({ queryAll: queryAllMock }));
vi.mock('../signalEvaluator.js', () => ({ evaluateSignalRules: evaluateMock }));

import {
  runDeterministicForOrganization,
  runDeterministicTick,
} from '../../../jobs/workSignalProducerJob.js';

describe('work signal producer kill-switch and tenant loop', () => {
  afterEach(() => {
    delete process.env.ENABLE_SIGNAL_PRODUCER;
    queryAllMock.mockReset();
    evaluateMock.mockReset();
  });

  it('records SKIPPED_DISABLED and never calls the evaluator when OFF', async () => {
    queryAllMock.mockResolvedValue([]);
    const result = await runDeterministicForOrganization({
      organizationId: 'org-a',
      trigger: 'CRON',
    });
    expect(result.status).toBe('SKIPPED_DISABLED');
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(queryAllMock).toHaveBeenCalledWith(
      expect.stringContaining('SKIPPED_DISABLED'),
      expect.any(Array)
    );
  });

  it('evaluates exactly the organization passed when ON', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    evaluateMock.mockResolvedValue({ status: 'OK' });
    await runDeterministicForOrganization({ organizationId: 'org-a', trigger: 'CRON' });
    expect(evaluateMock).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-a' }));
  });

  it('continues with the next organization after one failure', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    queryAllMock.mockResolvedValueOnce([{ id: 'org-a' }, { id: 'org-b' }]);
    evaluateMock
      .mockRejectedValueOnce(new Error('org-a failed'))
      .mockResolvedValueOnce({ status: 'OK' });
    const result = await runDeterministicTick();
    expect(result).toEqual({ organizations: 2, completed: 1, failed: 1 });
    expect(evaluateMock).toHaveBeenCalledTimes(2);
  });

  it('does not substitute a request organization into the tenant loop', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    queryAllMock.mockResolvedValueOnce([{ id: 'org-token' }]);
    evaluateMock.mockResolvedValue({ status: 'OK' });
    await runDeterministicTick();
    expect(evaluateMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-token' })
    );
  });
});
