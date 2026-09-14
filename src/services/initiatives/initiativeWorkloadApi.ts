import { getHeaders } from '@/services/apiUtils';
import type { ResourcePlanResponse, ResourcePlanRow } from '@/services/execution/resourcePlanApi';

export type InitiativeWorkloadRow = ResourcePlanRow & { capacityExceeded?: boolean };
export type InitiativeWorkloadResponse = Omit<ResourcePlanResponse, 'rows'> & {
  rows: InitiativeWorkloadRow[];
};

export interface InitiativeWorkloadQuery {
  weeks?: number;
  projectId?: string;
  initiativeStatuses?: string[];
}

export async function readInitiativeWorkload(
  query: InitiativeWorkloadQuery,
  signal?: AbortSignal
): Promise<InitiativeWorkloadResponse> {
  const params = new URLSearchParams({ weeks: String(query.weeks || 8) });
  if (query.projectId) params.set('projectId', query.projectId);
  if (query.initiativeStatuses?.length) {
    params.set('initiativeStatuses', query.initiativeStatuses.join(','));
  }
  const response = await fetch(`/api/execution-control/capacity/initiative-workload?${params}`, {
    headers: getHeaders(),
    signal,
  });
  if (!response.ok) throw new Error(`initiative-workload ${response.status}`);
  return (await response.json()) as InitiativeWorkloadResponse;
}
