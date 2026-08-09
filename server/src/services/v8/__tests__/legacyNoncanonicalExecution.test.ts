import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const logInfo = vi.fn();
vi.mock('../../../utils/DbPromise.js', () => ({ get: dbGet }));
vi.mock('../../../utils/Logger.js', () => ({ default: { info: logInfo } }));

describe('legacy noncanonical execution isolation', () => {
  beforeEach(() => {
    dbGet.mockReset();
    logInfo.mockReset();
  });

  it('classifies a genuinely legacy execution with structured telemetry', async () => {
    dbGet.mockResolvedValue(null);
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'playbook_executor', organizationId: 'org-legacy', entityId: 'legacy-run', payloads: [{}],
    })).resolves.toEqual({ classification: 'legacy_noncanonical' });
    expect(logInfo).toHaveBeenCalledWith('[LegacyExecution] classified legacy_noncanonical', expect.objectContaining({ entrypoint: 'playbook_executor' }));
  });

  it('blocks an explicit canonical identity even when nested before any side effect', async () => {
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'async_job_service', organizationId: 'org-t01', entityId: 'legacy-decision',
      payloads: [{ context: { handoff: { canonicalRunId: 'run-t01' } } }],
    })).rejects.toThrow('legacy_noncanonical_canonical_identity_forbidden');
    expect(dbGet).not.toHaveBeenCalled();
    expect(logInfo).not.toHaveBeenCalled();
  });

  it.each([
    { nested: [{ payload: { Canonical_Run_ID: 'run-t01' } }] },
    { nested: { branch: [{ CANONICALRUNREF: 'run-t01' }] } },
    { nested: { context: { 'transformation-case-ref': 'case-t01' } } },
    { nested: { envelope: [{ canonical_execution_run_id: 'run-t01' }] } },
  ])('blocks canonical alias and casing smuggling %#', async (payload) => {
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'async_job_service', organizationId: 'org-t01', entityId: 'legacy', payloads: [payload],
    })).rejects.toThrow('legacy_noncanonical_canonical_identity_forbidden');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('blocks a legacy-shaped run id that resolves to canonical identity in the same tenant', async () => {
    dbGet.mockResolvedValue({ canonical_run_id: 'run-t01' });
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'ai_playbook_executor', organizationId: 'org-t01', entityId: 'run-t01', payloads: [{ runId: 'run-t01' }],
    })).rejects.toThrow('legacy_noncanonical_canonical_identity_forbidden');
    expect(logInfo).not.toHaveBeenCalled();
  });

  it('keeps canonical identity lookup tenant scoped', async () => {
    dbGet.mockResolvedValue(null);
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'async_job_processor', organizationId: 'org-foreign', entityId: 'run-t01', payloads: [],
    })).resolves.toEqual({ classification: 'legacy_noncanonical' });
    expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), ['org-foreign', 'run-t01']);
  });

  it('normalizes a legacy-shaped alternate-case run id before canonical lookup', async () => {
    dbGet.mockResolvedValue({ canonical_run_id: 'run-t01' });
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'async_job_processor', organizationId: 'org-t01', payloads: [{ Run_ID: 'run-t01' }],
    })).rejects.toThrow('legacy_noncanonical_canonical_identity_forbidden');
    expect(dbGet).toHaveBeenCalledWith(expect.any(String), ['org-t01', 'run-t01']);
  });

  it('degrades only a missing legacy identity store to explicit legacy telemetry', async () => {
    dbGet.mockRejectedValue(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'action_execution_adapter', organizationId: 'org-old', entityId: 'decision-old', payloads: [],
    })).resolves.toEqual({ classification: 'legacy_noncanonical' });
    expect(logInfo).toHaveBeenCalledOnce();
  });

  it('fails closed when canonical identity lookup has an operational error', async () => {
    dbGet.mockRejectedValue(Object.assign(new Error('connection lost'), { code: '08006' }));
    const { assertLegacyNoncanonicalExecution } = await import('../../../ai/legacyNoncanonicalExecution.js');
    await expect(assertLegacyNoncanonicalExecution({
      entrypoint: 'action_execution_adapter', organizationId: 'org', entityId: 'decision', payloads: [],
    })).rejects.toThrow('legacy_noncanonical_identity_check_failed');
    expect(logInfo).not.toHaveBeenCalled();
  });
});
