import { Api } from '@/services/api';
import {
  V8PlanningApi,
  type V8PlanningGateReadinessCheck,
  type V8PlanningHistoryEvent,
  type V8PlanningStatusHistoryEntry,
} from '@/services/api/v8/planning';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';

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

export async function createInitiativeWriteTruth(payload: Record<string, unknown>) {
  const created = await Api.post('/initiatives', payload);
  const createdId = created?.id || created?.initiative?.id;
  bumpInitiativeRefresh();

  return {
    created,
    createdId: typeof createdId === 'string' ? createdId : null,
    truth:
      typeof createdId === 'string' && createdId
        ? await refreshInitiativeWriteTruth(createdId)
        : {
            initiative: null,
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
) {
  await Api.patch(`/initiatives/${initiativeId}/status`, {
    status: targetStatus,
    ...(overrideReason ? { overrideReason } : {}),
  });
  bumpInitiativeRefresh();
  return refreshInitiativeWriteTruth(initiativeId);
}

export async function quickUpdateInitiativeWriteTruth(
  initiativeId: string,
  updates: Record<string, unknown>
) {
  await Api.patch(`/initiatives/${initiativeId}/quick-update`, updates);
  bumpInitiativeRefresh();
  return refreshInitiativeWriteTruth(initiativeId);
}

export async function saveInitiativeWriteTruth(
  initiativeId: string,
  updates: Record<string, unknown>
) {
  await Api.put(`/initiatives/${initiativeId}`, updates);
  bumpInitiativeRefresh();
  return refreshInitiativeWriteTruth(initiativeId);
}
