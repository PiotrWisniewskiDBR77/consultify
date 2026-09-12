import { Api } from '@/services/api';

export interface DefinitionApprovalDecision {
  decisionId: string;
  initiativeId: string;
  gate: 'DEFINITION';
  status: 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED';
  version: number;
  requesterId: string;
  authorityId: string;
  requestedAt: string;
  dueAt: string;
  rationale: string | null;
  cardVersions: Record<string, number>;
}
export interface DefinitionApprovalRead {
  enabled: boolean;
  sourceContract: 'RUNTIME_INITIATIVE_GATE';
  initiativeOrigin: 'initiatives-runtime-v1';
  initiativeId: string;
  initiativeVersion: number;
  lifecycleState: string;
  title: string;
  decision: DefinitionApprovalDecision | null;
  authorities: Array<{ id: string; name: string }>;
  actorId: string;
  participants: Array<{ id: string; name: string }>;
  capabilities: { request: boolean; decide: boolean; edit: boolean; review: boolean };
}
export type DefinitionApprovalListItem = DefinitionApprovalDecision & {
  sourceContract: 'RUNTIME_INITIATIVE_GATE';
  initiativeOrigin: 'initiatives-runtime-v1';
  initiativeVersion: number;
  initiativeTitle: string;
  projectId: string;
};
const base = '/initiatives/runtime-v1';
export const readDefinitionApproval = (id: string): Promise<DefinitionApprovalRead> =>
  Api.get(`${base}/initiatives/${encodeURIComponent(id)}/definition-approval`);
export const listDefinitionApprovals = (): Promise<{
  enabled: boolean;
  items: DefinitionApprovalListItem[];
}> => Api.get(`${base}/my-work/definition-approvals`);
export async function requestDefinitionApproval(
  read: DefinitionApprovalRead,
  authorityId: string,
  dueAt: string
) {
  const decisionId = read.decision?.decisionId ?? crypto.randomUUID();
  return Api.post(
    `${base}/initiatives/${encodeURIComponent(read.initiativeId)}/gates/definition/requests`,
    {
      expectedVersion: read.initiativeVersion,
      clientRequestId: crypto.randomUUID(),
      decisionId,
      authorityId,
      dueAt,
    }
  );
}
export async function decideDefinitionApproval(
  read: DefinitionApprovalRead,
  outcome: 'APPROVED' | 'RETURNED',
  rationale: string
) {
  if (!read.decision) throw new Error('Definition decision is missing');
  return Api.post(
    `${base}/initiatives/${encodeURIComponent(read.initiativeId)}/gates/definition/decisions`,
    {
      expectedVersion: read.initiativeVersion,
      clientRequestId: crypto.randomUUID(),
      decisionId: read.decision.decisionId,
      outcome,
      rationale,
    }
  );
}
