import { afterEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock, evaluateMock, loggerErrorMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  evaluateMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({ queryAll: queryAllMock }));
vi.mock('../signalEvaluator.js', () => ({ evaluateSignalRules: evaluateMock }));
vi.mock('../../../utils/Logger.js', () => ({
  default: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

import {
  runDeterministicForOrganization,
  runDeterministicTick,
} from '../../../jobs/workSignalProducerJob.js';

describe('work signal producer kill-switch and tenant loop', () => {
  afterEach(() => {
    delete process.env.ENABLE_SIGNAL_PRODUCER;
    queryAllMock.mockReset();
    evaluateMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it('records SKIPPED_DISABLED without writing a run row when OFF via CRON', async () => {
    // FIX-3 (day18 layer-1 acceptance): the CRON trigger fires every 15
    // minutes for every active org, so while the flag is OFF it must NOT
    // insert a SKIPPED_DISABLED row per tick per org (~96 rows/day/org
    // register bloat before anything is ever enabled).
    queryAllMock.mockResolvedValue([]);
    const result = await runDeterministicForOrganization({
      organizationId: 'org-a',
      trigger: 'CRON',
    });
    expect(result.status).toBe('SKIPPED_DISABLED');
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(queryAllMock).not.toHaveBeenCalled();
  });

  it('records SKIPPED_DISABLED and writes a run row when OFF via ON_DEMAND', async () => {
    // The ON_DEMAND trigger is a user-initiated request from the UI — a 200
    // with producerEnabled:false backed by a real run row is useful there,
    // so this path keeps writing (FIX-3 scope: CRON path only).
    queryAllMock.mockResolvedValue([]);
    const result = await runDeterministicForOrganization({
      organizationId: 'org-a',
      trigger: 'ON_DEMAND',
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

  it('continues with the next organization after one failure and logs the failure with org context', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    queryAllMock.mockResolvedValueOnce([{ id: 'org-a' }, { id: 'org-b' }]);
    evaluateMock
      .mockRejectedValueOnce(new Error('org-a failed'))
      .mockResolvedValueOnce({ status: 'OK' });
    const result = await runDeterministicTick();
    expect(result).toEqual({ organizations: 2, completed: 1, failed: 1 });
    expect(evaluateMock).toHaveBeenCalledTimes(2);
    // FIX-2 (day18 layer-1 acceptance): the per-organization catch used to
    // be silent (`catch { failed += 1; }`). It must now log with enough
    // context (org, error) to find the failure without re-running the tick.
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    const [message, meta] = loggerErrorMock.mock.calls[0];
    expect(String(message)).toMatch(/failed/i);
    expect(meta).toEqual(
      expect.objectContaining({ organizationId: 'org-a', error: 'org-a failed' })
    );
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
