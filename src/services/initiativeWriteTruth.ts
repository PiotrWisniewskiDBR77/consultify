import { Api } from '@/services/api';
import {
  V8PlanningApi,
  type V8PlanningGateReadinessCheck,
  type V8PlanningHistoryEvent,
  type V8PlanningStatusHistoryEntry,
} from '@/services/api/v8/planning';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';
import {
  amendRegisteredInitiative,
  cancelRegisteredInitiative,
  readRegisteredInitiative,
  registerSourceProposal,
  submitSourceProposal,
} from '@/services/initiatives-execution/runtimeApi';

export interface InitiativeWriteTruthBundle {
  initiative: any | null;
  gateReadiness: V8PlanningGateReadinessCheck | null;
  statusHistory: V8PlanningStatusHistoryEntry[];
  history: V8PlanningHistoryEvent[];
}

export interface InitiativeStatusPreflightTruth {
  readiness: V8PlanningGateReadinessCheck | null;
  transition: NonNullable<V8PlanningGateReadinessCheck['availableTransitions']>[number] | null;
  blockingItems: string[];
}

export async function getInitiativeReadTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getInitiative(initiativeId);
  } catch {
    return Api.get(`/initiatives/${initiativeId}`);
  }
}

export async function getInitiativeGateReadinessTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getGateReadiness(initiativeId);
  } catch {
    const response = await Api.get(`/initiatives/${initiativeId}/gate-readiness-check`);
    if (
      response &&
      typeof response === 'object' &&
      Array.isArray((response as any).readiness) &&
      Array.isArray((response as any).availableTransitions)
    ) {
      return response as V8PlanningGateReadinessCheck;
    }
    if (response?.readiness && typeof response.readiness === 'object') {
      return response.readiness as V8PlanningGateReadinessCheck;
    }
    return response || null;
  }
}

export async function getInitiativeStatusHistoryTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getStatusHistory(initiativeId);
  } catch {
    const response = await Api.get(`/initiatives/${initiativeId}/status-history`);
    return response?.history || (Array.isArray(response) ? response : []);
  }
}

export async function getInitiativeHistoryTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getHistory(initiativeId);
  } catch {
    const response = await Api.get(`/initiatives/${initiativeId}/history`);
    return response?.events || response?.history || (Array.isArray(response) ? response : []);
  }
}

export async function refreshInitiativeWriteTruth(
  initiativeId: string
): Promise<InitiativeWriteTruthBundle> {
  const [initiative, gateReadiness, statusHistory, history] = await Promise.all([
    getInitiativeReadTruth(initiativeId).catch(() => null),
    getInitiativeGateReadinessTruth(initiativeId).catch(() => null),
    getInitiativeStatusHistoryTruth(initiativeId).catch(() => []),
    getInitiativeHistoryTruth(initiativeId).catch(() => []),
  ]);

  return {
    initiative,
    gateReadiness,
    statusHistory,
    history,
  };
}

export async function getInitiativeStatusPreflightTruth(
  initiativeId: string,
  targetStatus: string
): Promise<InitiativeStatusPreflightTruth> {
  const readiness = await getInitiativeGateReadinessTruth(initiativeId);
  const transitions: NonNullable<V8PlanningGateReadinessCheck['availableTransitions']> =
    Array.isArray(readiness?.availableTransitions) ? readiness.availableTransitions : [];
  const transition =
    transitions.find(
      (item: NonNullable<V8PlanningGateReadinessCheck['availableTransitions']>[number]) =>
        String(item?.targetStatus || '').toUpperCase() === String(targetStatus || '').toUpperCase()
    ) || null;
  const blockingItems = Array.isArray(readiness?.readiness)
    ? readiness.readiness
        .filter(
          (item: V8PlanningGateReadinessCheck['readiness'][number]) =>
            item?.severity === 'blocking' && !item?.pass
        )
        .map((item: V8PlanningGateReadinessCheck['readiness'][number]) =>
          String(item?.label || item?.key || '').trim()
        )
        .filter(Boolean)
    : [];

  return {
    readiness,
    transition,
    blockingItems,
  };
}

export interface CanonicalInitiativeCreateInput {
  projectId?: string;
  initiativeOwnerId?: string;
  ownerId?: string;
  title: string;
  problem?: string;
  problemStatement?: string;
  summary?: string;
  description?: string;
  proposedOutcome?: string | null;
  visibility?: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  [key: string]: unknown;
}

const newCommandId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export async function createInitiativeWriteTruth(payload: Record<string, unknown>) {
  const projectId = String(payload.projectId || '').trim();
  const initiativeOwnerId = String(payload.initiativeOwnerId || payload.ownerId || '').trim();
  const problem = String(
    payload.problem || payload.problemStatement || payload.summary || payload.description || payload.title
  ).trim();
  if (!projectId || !initiativeOwnerId) {
    throw new Error('Canonical initiative creation requires projectId and initiativeOwnerId');
  }
  const proposalId = newCommandId('proposal');
  const initiativeId = newCommandId('initiative');
  const sourceId = newCommandId('manual-hub');
  const capturedAt = new Date().toISOString();
  const proposedOutcome = String(payload.proposedOutcome || '').trim() || null;

  await submitSourceProposal({
    proposalId,
    expectedVersion: 0,
    clientRequestId: newCommandId('submit'),
    sourceType: 'MANUAL_HUB',
    sourceId,
    sourceVersion: 1,
    provenance: {
      system: 'consultify.initiatives-hub',
      recordType: 'manual-initiative-proposal',
      capturedAt,
      evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`],
    },
    title: String(payload.title || '').trim(),
    problem,
    proposedOutcome,
    projectId,
    initiativeOwnerId,
    visibility:
      payload.visibility === 'ORGANIZATION_RESTRICTED' ? 'ORGANIZATION_RESTRICTED' : 'PROJECT',
  });

  await registerSourceProposal({
    initiativeId,
    expectedVersion: 0,
    clientRequestId: newCommandId('register'),
    proposalId,
    proposalVersion: 1,
    sourceType: 'MANUAL_HUB',
    sourceId,
    sourceVersion: 1,
    title: String(payload.title || '').trim(),
    problem,
    proposedOutcome,
    projectId,
    visibility:
      payload.visibility === 'ORGANIZATION_RESTRICTED' ? 'ORGANIZATION_RESTRICTED' : 'PROJECT',
    initiativeOwnerId,
  });

  // Cold readback is authoritative; never synthesize success from command responses.
  const cold = await readRegisteredInitiative(initiativeId);
  const created = {
    ...cold,
    initiative: {
      ...cold.initiative,
      id: cold.initiative.initiativeId,
      name: cold.initiative.title,
      summary: cold.initiative.proposedOutcome || cold.initiative.problem || '',
      description: cold.initiative.problem || '',
      axis: String(payload.axis || 'transformational'),
      status: 'DRAFT',
      priority: String(payload.priority || 'MEDIUM'),
      progress: 0,
      budget: 0,
      createdAt: cold.updatedAt,
      created_at: cold.updatedAt,
      updatedAt: cold.updatedAt,
      updated_at: cold.updatedAt,
    },
  };
  bumpInitiativeRefresh();

  return {
    created,
    createdId: initiativeId,
    truth: {
      initiative: created.initiative,
      gateReadiness: null,
      statusHistory: [],
      history: [],
    },
  };
}

export async function updateInitiativeStatusWriteTruth(
  initiativeId: string,
  targetStatus: string,
  overrideReason?: string
): Promise<InitiativeWriteTruthBundle> {
  throw new Error(`Lifecycle status ${targetStatus} must be changed in its governed gate workflow`);
}

export async function quickUpdateInitiativeWriteTruth(
  initiativeId: string,
  updates: Record<string, unknown>,
  expectedVersion?: number
): Promise<InitiativeWriteTruthBundle> {
  if (!expectedVersion) throw new Error('Canonical version is required for initiative amendment');
  await amendRegisteredInitiative(initiativeId, {
    expectedVersion,
    clientRequestId: newCommandId('amend'),
    ...(typeof updates.title === 'string' ? { title: updates.title } : {}),
    ...(typeof updates.summary === 'string' ? { proposedOutcome: updates.summary } : {}),
    ...(typeof updates.description === 'string' ? { problem: updates.description } : {}),
    ...(typeof updates.ownerExecutionId === 'string' ? { initiativeOwnerId: updates.ownerExecutionId } : {}),
  });
  bumpInitiativeRefresh();
  const initiative = await readRegisteredInitiative(initiativeId);
  return { initiative: initiative.initiative, gateReadiness: null, statusHistory: [], history: [] };
}

export async function cancelInitiativeWriteTruth(initiativeId: string, expectedVersion: number, reason: string) {
  await cancelRegisteredInitiative(initiativeId, { expectedVersion, clientRequestId: newCommandId('cancel'), reason });
  bumpInitiativeRefresh();
  return readRegisteredInitiative(initiativeId);
}

export async function saveInitiativeWriteTruth(
  initiativeId: string,
  updates: Record<string, unknown>
) {
  await Api.put(`/initiatives/${initiativeId}`, updates);
  bumpInitiativeRefresh();
  return refreshInitiativeWriteTruth(initiativeId);
}
