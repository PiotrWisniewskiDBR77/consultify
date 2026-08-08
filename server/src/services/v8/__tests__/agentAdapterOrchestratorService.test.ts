import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const { getMock, runMock, authorizeMock, reserveMock, settleMock, releaseMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  runMock: vi.fn(),
  authorizeMock: vi.fn(),
  reserveMock: vi.fn(),
  settleMock: vi.fn(),
  releaseMock: vi.fn(),
}));
vi.mock('../../../utils/DbPromise.js', () => ({ get: getMock, run: runMock, all: vi.fn() }));
vi.mock('../agentToolExecutionGovernanceService.js', () => ({
  authorizeAgentToolExecution: authorizeMock,
}));
vi.mock('../agentResourceGovernanceService.js', () => ({
  reserveAgentResource: reserveMock,
  settleAgentResource: settleMock,
  releaseAgentResource: releaseMock,
}));
import { dispatchAgentAdapter } from '../agentAdapterOrchestratorService.js';

const base = {
  canonicalRunId: 'run-1',
  organizationId: 'org-1',
  transformationCaseId: 'case-1',
  actorUserId: 'user-1',
  agentId: 'transformation-agent',
  toolName: 'ideas.create',
  projectId: 'project-1',
  idempotencyKey: 'ideas-1',
  payload: { title: 'Idea' },
};

describe('agentAdapterOrchestratorService', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue(null);
    runMock.mockReset().mockResolvedValue({ changes: 1 });
    authorizeMock.mockReset().mockResolvedValue({
      allowed: true,
      reason: 'central_governance_allowed',
      eventId: 'event-1',
      toolId: 'tool-1',
    });
    reserveMock.mockReset().mockResolvedValue({
      allowed: true,
      reason: 'resource_reservation_allowed',
      reservationId: 'resource-1',
      status: 'reserved',
      idempotentReplay: false,
    });
    settleMock.mockReset().mockResolvedValue({ status: 'settled' });
    releaseMock.mockReset().mockResolvedValue({ status: 'released' });
  });

  it('normalizes a module result only after canonical owner readback', async () => {
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn().mockResolvedValue({
        artifactType: 'my_idea',
        artifactId: 'idea-1',
        module: 'Ideas',
        operation: 'create',
        data: { title: 'Idea' },
      }),
      readback: vi.fn().mockResolvedValue({ id: 'idea-1', title: 'Idea' }),
    };
    const result = await dispatchAgentAdapter({ ...base, adapter });
    expect(result.status).toBe('succeeded');
    expect(result.normalizedResult.artifactId).toBe('idea-1');
    expect(adapter.readback).toHaveBeenCalledWith('idea-1');
  });

  it('marks compensation required when canonical readback is missing', async () => {
    const adapter = {
      key: 'finance.create',
      compensationPolicy: 'manual_repair' as const,
      execute: vi.fn().mockResolvedValue({
        artifactType: 'financial_analysis',
        artifactId: 'fin-1',
        module: 'Finance',
        operation: 'create',
        data: {},
      }),
      readback: vi.fn().mockResolvedValue(null),
    };
    await expect(
      dispatchAgentAdapter({ ...base, idempotencyKey: 'fin-1', adapter })
    ).rejects.toThrow('canonical_readback_missing');
    expect(runMock).toHaveBeenCalledWith(
      expect.stringContaining("status='compensation_required'"),
      expect.any(Array)
    );
  });

  it('replays the same invocation but rejects an idempotency payload conflict', async () => {
    getMock.mockResolvedValue({
      invocation_id: 'inv-1',
      canonical_run_id: 'run-1',
      adapter_key: 'ideas.create',
      idempotency_key: 'ideas-1',
      input_digest: 'wrong',
      status: 'succeeded',
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn(),
      readback: vi.fn(),
    };
    await expect(dispatchAgentAdapter({ ...base, adapter })).rejects.toThrow('payload_conflict');
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('revalidates canonical owner readback before returning a succeeded replay', async () => {
    const readback = { id: 'idea-1', title: 'Idea' };
    getMock.mockResolvedValue({
      invocation_id: 'inv-1',
      canonical_run_id: 'run-1',
      adapter_key: 'ideas.create',
      idempotency_key: 'ideas-1',
      input_digest: createHash('sha256').update('{"title":"Idea"}').digest('hex'),
      status: 'succeeded',
      canonical_artifact_id: 'idea-1',
      readback_digest: createHash('sha256').update('{"id":"idea-1","title":"Idea"}').digest('hex'),
      normalized_result_json: {
        module: 'Ideas',
        operation: 'create',
        artifactType: 'my_idea',
        artifactId: 'idea-1',
        data: { title: 'Idea' },
      },
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn(),
      readback: vi.fn().mockResolvedValue(readback),
    };
    const result = await dispatchAgentAdapter({ ...base, adapter });
    expect(result.idempotentReplay).toBe(true);
    expect(adapter.readback).toHaveBeenCalledWith('idea-1');
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('marks compensation required when replay readback drifted', async () => {
    getMock.mockResolvedValue({
      invocation_id: 'inv-1',
      canonical_run_id: 'run-1',
      adapter_key: 'ideas.create',
      idempotency_key: 'ideas-1',
      input_digest: createHash('sha256').update('{"title":"Idea"}').digest('hex'),
      status: 'succeeded',
      canonical_artifact_id: 'idea-1',
      readback_digest: 'old-digest',
      normalized_result_json: {},
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn(),
      readback: vi.fn().mockResolvedValue({ id: 'idea-1', title: 'Changed' }),
    };
    await expect(dispatchAgentAdapter({ ...base, adapter })).rejects.toThrow(
      'adapter_replay_readback_drift'
    );
    expect(runMock).toHaveBeenCalledWith(
      expect.stringContaining("status='compensation_required'"),
      expect.arrayContaining(['canonical_readback_drift'])
    );
  });

  it('reclaims a stale running invocation once and executes without a second ledger insert', async () => {
    getMock.mockResolvedValue({
      invocation_id: 'inv-stale',
      canonical_run_id: 'run-1',
      adapter_key: 'ideas.create',
      idempotency_key: 'ideas-1',
      input_digest: createHash('sha256').update('{"title":"Idea"}').digest('hex'),
      status: 'running',
      created_at: '2020-01-01T00:00:00.000Z',
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn().mockResolvedValue({
        artifactType: 'my_idea',
        artifactId: 'idea-1',
        module: 'Ideas',
        operation: 'create',
        data: { title: 'Idea' },
      }),
      readback: vi.fn().mockResolvedValue({ id: 'idea-1', title: 'Idea' }),
    };
    const result = await dispatchAgentAdapter({ ...base, staleRunningAfterMs: 1, adapter });
    expect(result.invocationId).toBe('inv-stale');
    expect(runMock).toHaveBeenCalledWith(
      expect.stringContaining('attempt_count=attempt_count+1'),
      expect.any(Array)
    );
    expect(
      runMock.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO v8_agent_adapter'))
    ).toHaveLength(0);
  });

  it('retries a failed idempotent invocation using the same ledger identity', async () => {
    getMock.mockResolvedValue({
      invocation_id: 'inv-failed',
      canonical_run_id: 'run-1',
      adapter_key: 'ideas.create',
      idempotency_key: 'ideas-1',
      input_digest: createHash('sha256').update('{"title":"Idea"}').digest('hex'),
      status: 'failed',
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'manual_repair' as const,
      execute: vi
        .fn()
        .mockResolvedValue({
          artifactType: 'my_idea',
          artifactId: 'idea-1',
          module: 'Ideas',
          operation: 'create',
          data: {},
        }),
      readback: vi.fn().mockResolvedValue({ id: 'idea-1' }),
    };
    const result = await dispatchAgentAdapter({ ...base, adapter });
    expect(result.invocationId).toBe('inv-failed');
    expect(runMock).toHaveBeenCalledWith(
      expect.stringContaining("status='running'"),
      expect.any(Array)
    );
    expect(reserveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'a06:run-1:ideas.create:ideas-1',
        releasedRetry: {
          adapterKey: 'ideas.create',
          invocationIdempotencyKey: 'ideas-1',
          inputDigest: createHash('sha256').update('{"title":"Idea"}').digest('hex'),
        },
      })
    );
  });

  it('fails closed before ledger creation or adapter execution when central governance denies', async () => {
    authorizeMock.mockResolvedValue({
      allowed: false,
      reason: 'tool_not_ratified',
      eventId: 'event-denied',
      toolId: 'tool-1',
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn(),
      readback: vi.fn(),
    };
    await expect(dispatchAgentAdapter({ ...base, adapter })).rejects.toThrow(
      'adapter_governance_denied:tool_not_ratified'
    );
    expect(authorizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        agentId: 'transformation-agent',
        toolName: 'ideas.create',
        runId: 'run-1',
      })
    );
    expect(getMock).not.toHaveBeenCalled();
    expect(runMock).not.toHaveBeenCalled();
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('fails closed before invocation ledger or adapter side effects when resources deny', async () => {
    reserveMock.mockResolvedValue({
      allowed: false,
      reason: 'resource_concurrency_limit_exceeded',
      reservationId: 'resource-denied',
      status: 'denied',
      idempotentReplay: false,
    });
    const adapter = {
      key: 'ideas.create',
      compensationPolicy: 'delete_created' as const,
      execute: vi.fn(),
      readback: vi.fn(),
    };
    await expect(dispatchAgentAdapter({ ...base, adapter })).rejects.toThrow(
      'adapter_resource_denied:resource_concurrency_limit_exceeded'
    );
    expect(getMock).not.toHaveBeenCalled();
    expect(runMock).not.toHaveBeenCalled();
    expect(adapter.execute).not.toHaveBeenCalled();
  });
});
