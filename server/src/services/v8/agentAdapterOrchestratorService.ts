import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { authorizeAgentToolExecution } from './agentToolExecutionGovernanceService.js';
import {
  releaseAgentResource,
  reserveAgentResource,
  settleAgentResource,
} from './agentResourceGovernanceService.js';

export interface AdapterExecutionResult {
  artifactType: string;
  artifactId: string;
  module: string;
  operation: string;
  data: Record<string, unknown>;
}

export interface AgentModuleAdapter {
  key: string;
  compensationPolicy: 'delete_created' | 'reverse_transition' | 'manual_repair';
  execute(): Promise<AdapterExecutionResult>;
  readback(artifactId: string): Promise<Record<string, unknown> | null>;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

const DEFAULT_STALE_RUNNING_AFTER_MS = 5 * 60 * 1000;

export async function dispatchAgentAdapter(input: {
  canonicalRunId: string;
  organizationId: string;
  transformationCaseId: string;
  actorUserId: string;
  agentId: string;
  toolName: string;
  projectId?: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  adapter: AgentModuleAdapter;
  staleRunningAfterMs?: number;
  estimatedCostUsd?: number;
}) {
  if (!input.idempotencyKey.trim()) throw new Error('adapter_idempotency_key_required');
  if (!input.actorUserId.trim()) throw new Error('adapter_actor_user_id_required');
  if (!input.agentId.trim()) throw new Error('adapter_agent_id_required');
  if (!input.toolName.trim()) throw new Error('adapter_tool_name_required');
  const governance = await authorizeAgentToolExecution({
    organizationId: input.organizationId,
    userId: input.actorUserId,
    agentId: input.agentId,
    toolName: input.toolName,
    toolInput: input.payload,
    projectId: input.projectId ?? null,
    runId: input.canonicalRunId,
  });
  if (!governance.allowed) throw new Error(`adapter_governance_denied:${governance.reason}`);
  const resource = await reserveAgentResource({
    organizationId: input.organizationId,
    projectId: input.projectId,
    runId: input.canonicalRunId,
    userId: input.actorUserId,
    agentId: input.agentId,
    toolName: input.toolName,
    idempotencyKey: `a06:${input.canonicalRunId}:${input.adapter.key}:${input.idempotencyKey}`,
    estimatedCostUsd: input.estimatedCostUsd ?? 0,
    releasedRetry: {
      adapterKey: input.adapter.key,
      invocationIdempotencyKey: input.idempotencyKey,
      inputDigest: hash(input.payload),
    },
  });
  if (!resource.allowed) throw new Error(`adapter_resource_denied:${resource.reason}`);
  if (resource.idempotentReplay && resource.status !== 'settled') {
    throw new Error('adapter_resource_execution_in_progress');
  }
  try {
    const result = await dispatchAgentAdapterAfterResource(
      input,
      resource.idempotentReplay && resource.status === 'settled'
    );
    if (!resource.idempotentReplay) {
      await settleAgentResource({
        reservationId: resource.reservationId,
        organizationId: input.organizationId,
        projectId: String(input.projectId),
      });
    }
    return result;
  } catch (error) {
    if (!resource.idempotentReplay) {
      await releaseAgentResource({
        reservationId: resource.reservationId,
        organizationId: input.organizationId,
        projectId: String(input.projectId),
      });
    }
    throw error;
  }
}

async function dispatchAgentAdapterAfterResource(
  input: Parameters<typeof dispatchAgentAdapter>[0],
  replayOnly: boolean
) {
  const inputDigest = hash(input.payload);
  const existing = await dbGet<any>(
    `SELECT * FROM v8_agent_adapter_invocations
      WHERE organization_id=? AND canonical_run_id=? AND adapter_key=? AND idempotency_key=?`,
    [input.organizationId, input.canonicalRunId, input.adapter.key, input.idempotencyKey]
  );
  let invocationId: string;
  if (existing) {
    if (existing.input_digest !== inputDigest)
      throw new Error('adapter_idempotency_payload_conflict');
    if (existing.status === 'succeeded') {
      if (!existing.canonical_artifact_id || !existing.readback_digest) {
        await requireCompensation(existing.invocation_id, 'replay_receipt_incomplete');
        throw new Error('adapter_replay_receipt_incomplete');
      }
      const readback = await input.adapter.readback(existing.canonical_artifact_id);
      const replayDigest = readback ? hash(readback) : null;
      if (!readback || replayDigest !== existing.readback_digest) {
        await requireCompensation(
          existing.invocation_id,
          readback ? 'canonical_readback_drift' : 'canonical_readback_missing'
        );
        throw new Error(
          readback ? 'adapter_replay_readback_drift' : 'adapter_replay_canonical_readback_missing'
        );
      }
      return { ...normalizeRow(existing), idempotentReplay: true };
    }
    if (existing.status === 'failed') {
      const retried = await dbRun(
        `UPDATE v8_agent_adapter_invocations
            SET status='running',created_at=?,completed_at=NULL,failure_code=NULL,
                attempt_count=attempt_count+1
          WHERE invocation_id=? AND organization_id=? AND status='failed'`,
        [new Date().toISOString(), existing.invocation_id, input.organizationId]
      );
      if (Number(retried?.changes ?? 0) !== 1) throw new Error('adapter_failed_retry_lost');
      invocationId = existing.invocation_id;
    } else {
      if (existing.status !== 'running') throw new Error(`adapter_invocation_${existing.status}`);
      const staleAfterMs = input.staleRunningAfterMs ?? DEFAULT_STALE_RUNNING_AFTER_MS;
      if (!Number.isFinite(staleAfterMs) || staleAfterMs < 1)
        throw new Error('adapter_stale_running_window_invalid');
      const createdAtMs = new Date(existing.created_at).getTime();
      if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs < staleAfterMs)
        throw new Error('adapter_invocation_running');
      const reclaimed = await dbRun(
        `UPDATE v8_agent_adapter_invocations
            SET created_at=?,completed_at=NULL,failure_code=NULL,attempt_count=attempt_count+1
          WHERE invocation_id=? AND organization_id=? AND status='running' AND created_at=?`,
        [
          new Date().toISOString(),
          existing.invocation_id,
          input.organizationId,
          existing.created_at,
        ]
      );
      if (Number(reclaimed?.changes ?? 0) !== 1)
        throw new Error('adapter_stale_running_reclaim_lost');
      invocationId = existing.invocation_id;
    }
  } else {
    if (replayOnly) throw new Error('adapter_resource_replay_receipt_missing');
    invocationId = uuidv4();
    await dbRun(
      `INSERT INTO v8_agent_adapter_invocations
        (invocation_id,canonical_run_id,organization_id,transformation_case_id,adapter_key,
         idempotency_key,input_digest,status,compensation_policy,attempt_count)
       VALUES (?,?,?,?,?,?,?,'running',?,1)`,
      [
        invocationId,
        input.canonicalRunId,
        input.organizationId,
        input.transformationCaseId,
        input.adapter.key,
        input.idempotencyKey,
        inputDigest,
        input.adapter.compensationPolicy,
      ]
    );
  }
  try {
    const result = await input.adapter.execute();
    const readback = await input.adapter.readback(result.artifactId);
    if (!readback) {
      await dbRun(
        `UPDATE v8_agent_adapter_invocations SET status='compensation_required',failure_code='canonical_readback_missing',completed_at=? WHERE invocation_id=?`,
        [new Date().toISOString(), invocationId]
      );
      throw new Error('adapter_canonical_readback_missing');
    }
    const normalized = {
      module: result.module,
      operation: result.operation,
      artifactType: result.artifactType,
      artifactId: result.artifactId,
      data: result.data,
    };
    const completedAt = new Date().toISOString();
    await dbRun(
      `UPDATE v8_agent_adapter_invocations SET status='succeeded',canonical_artifact_type=?,
       canonical_artifact_id=?,normalized_result_json=?::jsonb,readback_digest=?,completed_at=? WHERE invocation_id=?`,
      [
        result.artifactType,
        result.artifactId,
        JSON.stringify(normalized),
        hash(readback),
        completedAt,
        invocationId,
      ]
    );
    return {
      invocationId,
      canonicalRunId: input.canonicalRunId,
      status: 'succeeded',
      normalizedResult: normalized,
      readbackDigest: hash(readback),
      idempotentReplay: false,
    };
  } catch (error) {
    if ((error as Error).message !== 'adapter_canonical_readback_missing')
      await dbRun(
        `UPDATE v8_agent_adapter_invocations SET status='failed',failure_code=?,completed_at=? WHERE invocation_id=? AND status='running'`,
        [(error as Error).message, new Date().toISOString(), invocationId]
      );
    throw error;
  }
}

async function requireCompensation(invocationId: string, failureCode: string): Promise<void> {
  await dbRun(
    `UPDATE v8_agent_adapter_invocations
        SET status='compensation_required',failure_code=?,completed_at=?
      WHERE invocation_id=? AND status='succeeded'`,
    [failureCode, new Date().toISOString(), invocationId]
  );
}

function normalizeRow(row: any) {
  const value =
    typeof row.normalized_result_json === 'string'
      ? JSON.parse(row.normalized_result_json)
      : row.normalized_result_json;
  return {
    invocationId: row.invocation_id,
    canonicalRunId: row.canonical_run_id,
    status: row.status,
    normalizedResult: value,
    readbackDigest: row.readback_digest,
  };
}

export async function getAdapterRunLedger(canonicalRunId: string, organizationId: string) {
  const { all } = await import('../../utils/DbPromise.js');
  return all(
    `SELECT * FROM v8_agent_adapter_invocations WHERE canonical_run_id=? AND organization_id=? ORDER BY created_at`,
    [canonicalRunId, organizationId]
  );
}
