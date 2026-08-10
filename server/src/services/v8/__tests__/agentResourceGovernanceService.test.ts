import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionClients: Array<{ query: ReturnType<typeof vi.fn> }> = [];

vi.mock('../../../utils/queryHelpers.js', () => ({
  withPgTransaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => {
    const client = transactionClients.shift();
    if (!client) throw new Error('missing_test_transaction_client');
    return callback(client);
  }),
}));
vi.mock('uuid', () => ({ v4: () => 'reservation-uuid' }));

const base = {
  organizationId: 'org-a09',
  projectId: 'project-a09',
  runId: 'run-a09',
  userId: 'user-a09',
  agentId: 'execution-agent',
  toolName: 'bounded-tool',
  idempotencyKey: 'request-a09',
  estimatedCostUsd: 0.6,
  now: '2026-08-08T10:00:00.000Z',
};

function reservation(status: 'reserved' | 'settled' | 'released' | 'denied', reason: string) {
  return {
    reservation_id: 'agent-resource-reservation-uuid',
    organization_id: 'org-a09',
    project_id: 'project-a09',
    run_id: 'run-a09',
    user_id: 'user-a09',
    agent_id: 'execution-agent',
    tool_name: 'bounded-tool',
    idempotency_key: 'request-a09',
    status,
    decision_reason: reason,
    estimated_cost_usd: '0.600000',
    actual_cost_usd: null,
    actual_usage_source: 'UNKNOWN',
    lease_expires_at: status === 'reserved' ? '2026-08-08T10:05:00.000Z' : null,
  };
}

function admissionClient(input: { active?: number; cost?: number; insertedStatus?: 'reserved' | 'denied' }) {
  const insertedStatus = input.insertedStatus || 'reserved';
  const reason =
    insertedStatus === 'reserved'
      ? 'resource_reservation_allowed'
      : input.active
        ? 'resource_concurrency_limit_exceeded'
        : 'resource_estimated_cost_limit_exceeded';
  const rows = [
    [],
    [],
    [
      {
        policy_id: 'policy-a09',
        max_concurrent_executions: 2,
        max_estimated_cost_usd_per_run: '1.000000',
        lease_seconds: 300,
      },
    ],
    [],
    [{ active_count: input.active || 0, reserved_cost: input.cost || 0 }],
    [reservation(insertedStatus, reason)],
  ];
  return { query: vi.fn(async () => ({ rows: rows.shift() || [], rowCount: 1 })) };
}

describe('agentResourceGovernanceService', () => {
  beforeEach(() => {
    transactionClients.length = 0;
  });

  it('fails closed before database access when tenant scope is incomplete', async () => {
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    await expect(reserveAgentResource({ ...base, projectId: null })).rejects.toThrow(
      'resource_project_required'
    );
  });

  it('creates an allowed reservation with provider actual usage UNKNOWN', async () => {
    transactionClients.push(admissionClient({}));
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    const result = await reserveAgentResource(base);
    expect(result).toEqual(
      expect.objectContaining({
        allowed: true,
        status: 'reserved',
        actualCostUsd: null,
        actualUsageSource: 'UNKNOWN',
      })
    );
  });

  it('durably denies when the atomic concurrency ceiling is exhausted', async () => {
    transactionClients.push(admissionClient({ active: 2, insertedStatus: 'denied' }));
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    const result = await reserveAgentResource(base);
    expect(result).toEqual(
      expect.objectContaining({
        allowed: false,
        status: 'denied',
        reason: 'resource_concurrency_limit_exceeded',
      })
    );
  });

  it('durably denies an estimated-cost overrun', async () => {
    transactionClients.push(admissionClient({ cost: 0.6, insertedStatus: 'denied' }));
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    const result = await reserveAgentResource(base);
    expect(result.reason).toBe('resource_estimated_cost_limit_exceeded');
  });

  it('replays the existing reservation without inserting a duplicate', async () => {
    const query = vi.fn(async (_sql: string) => {
      if (query.mock.calls.length === 1) return { rows: [], rowCount: 1 };
      return {
        rows: [reservation('settled', 'resource_settled')],
        rowCount: 1,
      };
    });
    transactionClients.push({ query });
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    const result = await reserveAgentResource(base);
    expect(result.idempotentReplay).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the same idempotency key changes estimated cost', async () => {
    const query = vi.fn(async () => ({ rows: query.mock.calls.length === 1 ? [] : [reservation('settled', 'resource_settled')], rowCount: 1 }));
    transactionClients.push({ query });
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    await expect(reserveAgentResource({ ...base, estimatedCostUsd: 0.61 })).rejects.toThrow('resource_idempotency_cost_mismatch');
  });

  it('fails closed on project drift for the same tenant/key', async () => {
    const query = vi.fn(async () => ({ rows: query.mock.calls.length === 1 ? [] : [reservation('settled', 'resource_settled')], rowCount: 1 }));
    transactionClients.push({ query });
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    await expect(reserveAgentResource({ ...base, projectId: 'project-foreign' })).rejects.toThrow('resource_idempotency_scope_mismatch');
  });

  it('cannot replay a same-key reservation from a foreign tenant', async () => {
    const rows = [[], [], []];
    // Declare the parameters so `mock.calls[n]` is the recorded (sql, params)
    // pair rather than an element of an empty tuple.
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: rows.shift() || [],
      rowCount: 1,
    }));
    transactionClients.push({ query });
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    await expect(reserveAgentResource({ ...base, organizationId: 'org-foreign' })).rejects.toThrow('resource_policy_not_found');
    expect(query.mock.calls[1]?.[1]).toEqual(['org-foreign', base.idempotencyKey]);
  });

  it('settles after exactly one callback and skips it on settled replay', async () => {
    transactionClients.push(admissionClient({}));
    transactionClients.push({
      query: vi.fn(async () => ({
        rows: [reservation('settled', 'resource_settled')],
        rowCount: 1,
      })),
    });
    let callbacks = 0;
    const { executeWithAgentResourceReservation } =
      await import('../agentResourceGovernanceService.js');
    const first = await executeWithAgentResourceReservation({
      ...base,
      execute: async () => {
        callbacks += 1;
        return 'ok';
      },
    });
    expect(first.allowed).toBe(true);
    expect(callbacks).toBe(1);

    const replayQuery = vi.fn(async () => ({
      rows: replayQuery.mock.calls.length === 1 ? [] : [reservation('settled', 'resource_settled')],
      rowCount: 1,
    }));
    transactionClients.push({ query: replayQuery });
    const replay = await executeWithAgentResourceReservation({
      ...base,
      execute: async () => {
        callbacks += 1;
        return 'should-not-run';
      },
    });
    expect(replay.replayed).toBe(true);
    expect(callbacks).toBe(1);
  });

  it('does not duplicate a callback while the idempotent reservation is active', async () => {
    const query = vi.fn(async () => ({
      rows: query.mock.calls.length === 1 ? [] : [reservation('reserved', 'resource_reservation_allowed')],
      rowCount: 1,
    }));
    transactionClients.push({ query });
    let callbacks = 0;
    const { executeWithAgentResourceReservation } =
      await import('../agentResourceGovernanceService.js');
    const result = await executeWithAgentResourceReservation({
      ...base,
      execute: async () => {
        callbacks += 1;
        return 'duplicate';
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        allowed: false,
        replayed: true,
        reason: 'resource_idempotent_execution_in_progress',
      })
    );
    expect(callbacks).toBe(0);
  });

  it('atomically reclaims one released row for the exact failed A06 invocation', async () => {
    const released = reservation('released', 'resource_released_after_execution_failure');
    const reclaimed = reservation('reserved', 'resource_reclaimed_after_failed_invocation');
    const rows = [
      [],
      [released],
      [{ status: 'failed', input_digest: 'digest-a' }],
      [{ policy_id: 'policy-a09', max_concurrent_executions: 2, max_estimated_cost_usd_per_run: '1.000000', lease_seconds: 300 }],
      [],
      [{ active_count: 0, reserved_cost: 0 }],
      [reclaimed],
    ];
    // Declare the parameters so `mock.calls[n]` is the recorded (sql, params)
    // pair rather than an element of an empty tuple.
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: rows.shift() || [],
      rowCount: 1,
    }));
    transactionClients.push({ query });
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    const result = await reserveAgentResource({
      ...base,
      releasedRetry: { adapterKey: 'interviews', invocationIdempotencyKey: 'materialize-1', inputDigest: 'digest-a' },
    });
    expect(result).toEqual(expect.objectContaining({ allowed: true, status: 'reserved', idempotentReplay: false, reservationId: released.reservation_id }));
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO v8_agent_resource_reservations'))).toHaveLength(0);
  });

  it('fails closed when a released reclaim payload differs from the failed invocation', async () => {
    const rows = [[], [reservation('released', 'resource_released_after_execution_failure')], [{ status: 'failed', input_digest: 'other-digest' }]];
    transactionClients.push({ query: vi.fn(async () => ({ rows: rows.shift() || [], rowCount: 1 })) });
    const { reserveAgentResource } = await import('../agentResourceGovernanceService.js');
    await expect(reserveAgentResource({ ...base, releasedRetry: { adapterKey: 'interviews', invocationIdempotencyKey: 'materialize-1', inputDigest: 'digest-a' } })).rejects.toThrow('resource_reclaim_payload_conflict');
  });
});
