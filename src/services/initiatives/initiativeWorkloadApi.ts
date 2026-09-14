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

export interface InitiativeWorkloadProposal {
  proposalId: string;
  taskId: string;
  taskTitle: string;
  initiativeId: string;
  initiativeStatus: string;
  weekStart: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  proposedHours: number;
  rationale: string;
  requiresHumanApproval: true;
  applied: false;
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

export async function updateInitiativeWorkloadAvailability(
  userId: string,
  input: { weeklyCapacityHours: number; availabilityPercent: number }
): Promise<{ userId: string; weeklyCapacityHours: number; availabilityPercent: number }> {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/capacity`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`initiative-workload-capacity ${response.status}`);
  return response.json();
}

export async function proposeInitiativeWorkloadMoves(
  query: InitiativeWorkloadQuery
): Promise<{ proposals: InitiativeWorkloadProposal[]; applied: false; planningOnly: true }> {
  const response = await fetch('/api/initiatives/runtime-v1/workload-proposals', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      weeks: query.weeks || 8,
      projectId: query.projectId,
      initiativeStatuses: query.initiativeStatuses || [],
    }),
  });
  if (!response.ok) throw new Error(`initiative-workload-proposals ${response.status}`);
  return response.json();
}
