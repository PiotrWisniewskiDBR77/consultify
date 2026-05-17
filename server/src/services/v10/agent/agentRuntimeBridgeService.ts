import { unsafeTenantId } from '../../../models/agent/ExecutionProposalV1.js';
import { unsafeRunId } from '../../../models/agent/RunLedger.js';
import { agentRuntimeService } from './agentRuntimeService.js';

function mapAuditStatusToRuntime(args: {
  qualityStatus?: string | null;
  acceptedAt?: string | null;
}): {
  status: 'pending' | 'paused' | 'succeeded';
  approvalState: string;
  latestBarrierState: string | null;
} {
  if (args.acceptedAt) {
    return {
      status: 'succeeded',
      approvalState: 'accepted_risk',
      latestBarrierState: 'risk_accepted',
    };
  }
  if (
    String(args.qualityStatus || '')
      .trim()
      .toUpperCase() === 'FAIL'
  ) {
    return {
      status: 'paused',
      approvalState: 'awaiting_risk_decision',
      latestBarrierState: 'audit_failed',
    };
  }
  return {
    status: 'succeeded',
    approvalState: 'approved',
    latestBarrierState: 'audit_completed',
  };
}

function runtimeStateFromStatus(
  status: 'pending' | 'paused' | 'succeeded'
): 'idle' | 'paused' | 'completed' {
  if (status === 'paused') return 'paused';
  if (status === 'succeeded') return 'completed';
  return 'idle';
}

export async function syncAgentAuditRunIntoRuntime(args: {
  runId: string;
  organizationId: string;
  conversationId?: string | null;
  qualityStatus?: string | null;
  acceptedAt?: string | null;
  loopIteration?: number;
  selectedAgentIds?: string[];
  userIntent?: string | null;
  actorId?: string | null;
}): Promise<void> {
  const tenantId = unsafeTenantId(args.organizationId);
  const runtimeRunId = unsafeRunId(args.runId);
  const store = agentRuntimeService.getStore();
  const existing = await store.getRun(runtimeRunId, tenantId);
  const mapping = mapAuditStatusToRuntime({
    qualityStatus: args.qualityStatus || null,
    acceptedAt: args.acceptedAt || null,
  });
  const correlationId = String(args.conversationId || args.runId);

  await store.upsertRun({
    id: runtimeRunId,
    tenantId,
    correlationId,
    conversationId: args.conversationId || null,
    origin: 'deep_thinking_audit',
    runType: 'agent_audit',
    parentRunId: existing?.parentRunId ?? null,
    approvalState: mapping.approvalState,
    latestBarrierState: mapping.latestBarrierState,
    latestInterruptState: existing?.latestInterruptState ?? null,
    status: mapping.status,
    severity: mapping.status === 'paused' ? 'S3' : 'S2',
    startedAt: existing?.startedAt ?? new Date().toISOString(),
    finishedAt:
      mapping.status === 'succeeded' ? new Date().toISOString() : (existing?.finishedAt ?? null),
    budgetUsed: existing?.budgetUsed ?? {
      wallMs: 0,
      costCents: 0,
      toolCalls: 0,
      tokens: 0,
    },
  });
  await store.setRuntimeState(runtimeRunId, tenantId, runtimeStateFromStatus(mapping.status));
  await store.appendEvent({
    id: `custom:${args.runId}:${Date.now()}`,
    tenantId,
    runId: runtimeRunId,
    category: 'custom',
    recordedAt: new Date().toISOString(),
    actorId: args.actorId || null,
    payload: {
      subtype: args.acceptedAt ? 'agent_audit_accepted' : 'agent_audit_completed',
      origin: 'deep_thinking_audit',
      runType: 'agent_audit',
      conversationId: args.conversationId || null,
      qualityStatus: args.qualityStatus || null,
      acceptedAt: args.acceptedAt || null,
      loopIteration: Number(args.loopIteration || 1),
      selectedAgentCount: Array.isArray(args.selectedAgentIds) ? args.selectedAgentIds.length : 0,
      userIntent: args.userIntent || null,
      approvalState: mapping.approvalState,
      latestBarrierState: mapping.latestBarrierState,
    },
  });
}
