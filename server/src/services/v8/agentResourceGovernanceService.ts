import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';

export type AgentResourceReservationStatus =
  | 'reserved'
  | 'settled'
  | 'released'
  | 'expired'
  | 'denied';

export interface AgentResourceReservationDecision {
  allowed: boolean;
  reason: string;
  reservationId: string;
  status: AgentResourceReservationStatus;
  idempotentReplay: boolean;
  estimatedCostUsd: number;
  actualCostUsd: null;
  actualUsageSource: 'UNKNOWN';
  leaseExpiresAt: string | null;
}

interface ReservationRow {
  reservation_id: string;
  organization_id: string;
  project_id: string;
  run_id: string;
  user_id: string;
  agent_id: string;
  tool_name: string;
  idempotency_key: string;
  status: AgentResourceReservationStatus;
  decision_reason: string;
  estimated_cost_usd: string | number;
  actual_cost_usd: string | number | null;
  actual_usage_source: 'UNKNOWN';
  lease_expires_at: string | null;
}

interface PolicyRow {
  policy_id: string;
  max_concurrent_executions: number;
  max_estimated_cost_usd_per_run: string | number;
  lease_seconds: number;
}

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function mapDecision(row: ReservationRow, idempotentReplay: boolean): AgentResourceReservationDecision {
  return {
    allowed: row.status === 'reserved' || row.status === 'settled',
    reason: row.decision_reason,
    reservationId: row.reservation_id,
    status: row.status,
    idempotentReplay,
    estimatedCostUsd: Number(row.estimated_cost_usd),
    // Provider-reported usage has not been supplied by this bounded increment.
    actualCostUsd: null,
    actualUsageSource: 'UNKNOWN',
    leaseExpiresAt: row.lease_expires_at,
  };
}

async function insertDecision(
  client: PgTransactionClient,
  input: {
    reservationId: string;
    organizationId: string;
    projectId: string;
    runId: string;
    userId: string;
    agentId: string;
    toolName: string;
    idempotencyKey: string;
    policyId: string;
    status: 'reserved' | 'denied';
    reason: string;
    estimatedCostUsd: number;
    leaseExpiresAt: string | null;
    now: string;
  }
): Promise<ReservationRow> {
  const result = await client.query<ReservationRow>(
    `INSERT INTO v8_agent_resource_reservations
      (reservation_id, organization_id, project_id, run_id, user_id, agent_id, tool_name,
       idempotency_key, policy_id, status, decision_reason, estimated_cost_usd,
       actual_cost_usd, actual_usage_source, lease_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'UNKNOWN', ?, ?, ?)
     RETURNING *`,
    [
      input.reservationId,
      input.organizationId,
      input.projectId,
      input.runId,
      input.userId,
      input.agentId,
      input.toolName,
      input.idempotencyKey,
      input.policyId,
      input.status,
      input.reason,
      input.estimatedCostUsd,
      input.leaseExpiresAt,
      input.now,
      input.now,
    ]
  );
  return result.rows[0];
}

export async function reserveAgentResource(input: {
  organizationId: string;
  projectId?: string | null;
  runId?: string | null;
  userId: string;
  agentId: string;
  toolName: string;
  idempotencyKey?: string | null;
  estimatedCostUsd?: number | null;
  now?: string;
  leaseSeconds?: number;
  releasedRetry?: {
    adapterKey: string;
    invocationIdempotencyKey: string;
    inputDigest: string;
  };
}): Promise<AgentResourceReservationDecision> {
  const organizationId = requireNonBlank(input.organizationId, 'resource_organization_required');
  const projectId = requireNonBlank(input.projectId, 'resource_project_required');
  const runId = requireNonBlank(input.runId, 'resource_run_required');
  const idempotencyKey = requireNonBlank(
    input.idempotencyKey,
    'resource_idempotency_key_required'
  );
  const estimatedCostUsd = Number(input.estimatedCostUsd);
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
    throw new Error('resource_estimated_cost_required');
  }
  const now = input.now || new Date().toISOString();

  return withPgTransaction(async (client) => {
    // One tenant/project lock serializes admission, including policy lookup and recovery.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))`, [
      organizationId,
      projectId,
    ]);

    const existing = await client.query<ReservationRow>(
      `SELECT * FROM v8_agent_resource_reservations
       WHERE organization_id = ? AND idempotency_key = ? FOR UPDATE`,
      [organizationId, idempotencyKey]
    );
    if (existing.rows[0]) {
      const prior = existing.rows[0];
      if (
        prior.project_id !== projectId ||
        prior.run_id !== runId ||
        prior.user_id !== input.userId ||
        prior.agent_id !== input.agentId ||
        prior.tool_name !== input.toolName
      ) {
        throw new Error('resource_idempotency_scope_mismatch');
      }
      if (Number(prior.estimated_cost_usd) !== estimatedCostUsd) {
        throw new Error('resource_idempotency_cost_mismatch');
      }
      if (prior.status !== 'released') return mapDecision(prior, true);
      if (!input.releasedRetry) return mapDecision(prior, true);

      const invocation = await client.query<{ status: string; input_digest: string }>(
        `SELECT status, input_digest FROM v8_agent_adapter_invocations
          WHERE organization_id = ? AND canonical_run_id = ? AND adapter_key = ?
            AND idempotency_key = ? FOR UPDATE`,
        [
          organizationId,
          runId,
          input.releasedRetry.adapterKey,
          input.releasedRetry.invocationIdempotencyKey,
        ]
      );
      const failed = invocation.rows[0];
      if (!failed || failed.status !== 'failed') {
        throw new Error('resource_reclaim_failed_invocation_required');
      }
      if (failed.input_digest !== input.releasedRetry.inputDigest) {
        throw new Error('resource_reclaim_payload_conflict');
      }
    }

    const policyResult = await client.query<PolicyRow>(
      `SELECT policy_id, max_concurrent_executions, max_estimated_cost_usd_per_run, lease_seconds
       FROM v8_agent_resource_policies
       WHERE organization_id = ? AND project_id = ? AND enabled = 1
       FOR UPDATE`,
      [organizationId, projectId]
    );
    const policy = policyResult.rows[0];
    if (!policy) throw new Error('resource_policy_not_found');

    await client.query(
      `UPDATE v8_agent_resource_reservations
       SET status = 'expired', decision_reason = 'resource_lease_expired', updated_at = ?
       WHERE organization_id = ? AND project_id = ? AND status = 'reserved'
         AND lease_expires_at <= ?`,
      [now, organizationId, projectId, now]
    );

    const usageResult = await client.query<{
      active_count: string | number;
      reserved_cost: string | number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'reserved') AS active_count,
         COALESCE(SUM(estimated_cost_usd) FILTER (WHERE run_id = ? AND status IN ('reserved','settled')), 0)
           AS reserved_cost
       FROM v8_agent_resource_reservations
       WHERE organization_id = ? AND project_id = ?`,
      [runId, organizationId, projectId]
    );
    const usage = usageResult.rows[0] || { active_count: 0, reserved_cost: 0 };
    const prior = existing.rows[0];
    const reservationId = prior?.reservation_id ?? `agent-resource-${uuidv4()}`;
    let reason = 'resource_reservation_allowed';
    let status: 'reserved' | 'denied' = 'reserved';
    if (Number(usage.active_count) >= Number(policy.max_concurrent_executions)) {
      reason = 'resource_concurrency_limit_exceeded';
      status = 'denied';
    } else if (
      Number(usage.reserved_cost) + estimatedCostUsd >
      Number(policy.max_estimated_cost_usd_per_run)
    ) {
      reason = 'resource_estimated_cost_limit_exceeded';
      status = 'denied';
    }
    const leaseSeconds = Math.min(
      Math.max(1, Number(input.leaseSeconds || policy.lease_seconds)),
      86400
    );
    const leaseExpiresAt =
      status === 'reserved'
        ? new Date(Date.parse(now) + leaseSeconds * 1000).toISOString()
        : null;
    if (prior) {
      const reclaimed = await client.query<ReservationRow>(
        `UPDATE v8_agent_resource_reservations
            SET status = ?, decision_reason = ?, lease_expires_at = ?, updated_at = ?
          WHERE reservation_id = ? AND organization_id = ? AND project_id = ? AND status = 'released'
          RETURNING *`,
        [
          status === 'reserved' ? 'reserved' : 'released',
          status === 'reserved' ? 'resource_reclaimed_after_failed_invocation' : reason,
          leaseExpiresAt,
          now,
          reservationId,
          organizationId,
          projectId,
        ]
      );
      if (!reclaimed.rows[0]) throw new Error('resource_reclaim_lost');
      return mapDecision(reclaimed.rows[0], status !== 'reserved');
    }
    const row = await insertDecision(client, {
      reservationId,
      organizationId,
      projectId,
      runId,
      userId: input.userId,
      agentId: input.agentId,
      toolName: input.toolName,
      idempotencyKey,
      policyId: policy.policy_id,
      status,
      reason,
      estimatedCostUsd,
      leaseExpiresAt,
      now,
    });
    return mapDecision(row, false);
  });
}

async function transitionReservation(input: {
  reservationId: string;
  organizationId: string;
  projectId: string;
  targetStatus: 'settled' | 'released';
  reason: string;
  now?: string;
}): Promise<AgentResourceReservationDecision> {
  const now = input.now || new Date().toISOString();
  return withPgTransaction(async (client) => {
    const result = await client.query<ReservationRow>(
      `UPDATE v8_agent_resource_reservations
       SET status = ?, decision_reason = ?, lease_expires_at = NULL,
           settled_at = CASE WHEN ? = 'settled' THEN ? ELSE settled_at END,
           released_at = CASE WHEN ? = 'released' THEN ? ELSE released_at END,
           actual_cost_usd = NULL, actual_usage_source = 'UNKNOWN', updated_at = ?
       WHERE reservation_id = ? AND organization_id = ? AND project_id = ?
         AND status = 'reserved'
       RETURNING *`,
      [
        input.targetStatus,
        input.reason,
        input.targetStatus,
        now,
        input.targetStatus,
        now,
        now,
        input.reservationId,
        input.organizationId,
        input.projectId,
      ]
    );
    if (!result.rows[0]) throw new Error('resource_reservation_not_active');
    return mapDecision(result.rows[0], false);
  });
}

export function settleAgentResource(input: {
  reservationId: string;
  organizationId: string;
  projectId: string;
  now?: string;
}) {
  return transitionReservation({ ...input, targetStatus: 'settled', reason: 'resource_settled' });
}

export function releaseAgentResource(input: {
  reservationId: string;
  organizationId: string;
  projectId: string;
  reason?: string;
  now?: string;
}) {
  return transitionReservation({
    ...input,
    targetStatus: 'released',
    reason: input.reason || 'resource_released_after_execution_failure',
  });
}

export async function executeWithAgentResourceReservation<T>(input: {
  organizationId: string;
  projectId?: string | null;
  runId?: string | null;
  userId: string;
  agentId: string;
  toolName: string;
  idempotencyKey?: string | null;
  estimatedCostUsd?: number | null;
  now?: string;
  leaseSeconds?: number;
  execute: () => Promise<T>;
}): Promise<{
  allowed: boolean;
  reason: string;
  replayed: boolean;
  result?: T;
  resourceDecision: AgentResourceReservationDecision;
}> {
  const reservation = await reserveAgentResource(input);
  if (!reservation.allowed) {
    return {
      allowed: false,
      reason: reservation.reason,
      replayed: reservation.idempotentReplay,
      resourceDecision: reservation,
    };
  }
  if (reservation.idempotentReplay) {
    return {
      allowed: reservation.status === 'settled',
      reason:
        reservation.status === 'settled'
          ? 'resource_idempotent_completion_replay'
          : reservation.status === 'reserved'
            ? 'resource_idempotent_execution_in_progress'
            : reservation.reason,
      replayed: true,
      resourceDecision: reservation,
    };
  }
  try {
    const result = await input.execute();
    const settled = await settleAgentResource({
      reservationId: reservation.reservationId,
      organizationId: input.organizationId,
      projectId: String(input.projectId),
    });
    return {
      allowed: true,
      reason: settled.reason,
      replayed: false,
      result,
      resourceDecision: settled,
    };
  } catch (error) {
    await releaseAgentResource({
      reservationId: reservation.reservationId,
      organizationId: input.organizationId,
      projectId: String(input.projectId),
    });
    throw error;
  }
}
