import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAll = vi.fn();
const evaluate = vi.fn();
vi.mock('../../utils/queryHelpers.js', () => ({ queryAll }));
vi.mock('../../services/adminIamAlertEvaluator.js', () => ({
  evaluateAdminIamQueueAlerts: evaluate,
}));

describe('Admin IAM alert evaluation production job contract (mocked seam)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enumerates queue and durable-state tenants, then evaluates each once', async () => {
    queryAll.mockResolvedValue([{ organization_id: 'org-a' }, { organization_id: 'org-b' }]);
    evaluate.mockResolvedValue([]);
    const { runAdminIamAlertEvaluationTick } = await import('../adminIamAlertEvaluationJob.js');
    const result = await runAdminIamAlertEvaluationTick({ evaluatorId: 'test:runner', now: '2026-08-18T12:00:00.000Z' });
    expect(queryAll).toHaveBeenCalledWith(
      expect.stringContaining('UNION'),
      ['ADMIN_IAM_JOB_STALE', 'ADMIN_IAM_JOB_FAILED', 500],
    );
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenNthCalledWith(1, {
      organizationId: 'org-a', evaluatorId: 'test:runner', now: '2026-08-18T12:00:00.000Z',
    });
    expect(result).toEqual({ candidates: 2, evaluated: 2, failed: 0 });
  });

  it('bounds the batch and continues after one tenant fails', async () => {
    queryAll.mockResolvedValue([{ organization_id: 'org-a' }, { organization_id: 'org-b' }]);
    evaluate.mockRejectedValueOnce(new Error('forced')).mockResolvedValueOnce([]);
    const { runAdminIamAlertEvaluationTick } = await import('../adminIamAlertEvaluationJob.js');
    const result = await runAdminIamAlertEvaluationTick({ batchSize: 5000 });
    expect(queryAll.mock.calls[0][1]).toEqual(['ADMIN_IAM_JOB_STALE', 'ADMIN_IAM_JOB_FAILED', 1000]);
    expect(result).toEqual({ candidates: 2, evaluated: 1, failed: 1 });
  });
});
