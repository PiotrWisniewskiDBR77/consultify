import { API_URL, getHeaders, handleResponse } from './baseClient';

export type AgentMaterializationTarget = 'task' | 'decision' | 'notebook';

export interface AgentMaterializationProposal {
  proposal_id: string;
  requester_id: string;
  source_plan_id: string;
  source_version: number;
  source_hash: string;
  target_kind: AgentMaterializationTarget;
  content: { title: string; description?: string; body?: string };
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'MATERIALIZED';
  state_version: number;
  expires_at: string;
  approval_id?: string | null;
  approver_id?: string | null;
  decision?: 'APPROVE' | 'REJECT' | null;
  receipt_status?: 'PENDING' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | null;
  target_id?: string | null;
  output_digest?: string | null;
  command_version?: number | null;
  last_error_code?: string | null;
}

export async function getAgentMaterializationSource(planId: string) {
  const response = await fetch(`${API_URL}/my-work/agent-materialization/source/${encodeURIComponent(planId)}`, {
    headers: getHeaders(),
  });
  return handleResponse<{ sourceVersion: number; sourceHash: string }>(response, 'Failed to load plan identity');
}

export async function listAgentMaterializationProposals(sourcePlanId?: string) {
  const query = sourcePlanId ? `?sourcePlanId=${encodeURIComponent(sourcePlanId)}` : '';
  const response = await fetch(`${API_URL}/my-work/agent-materialization/proposals${query}`, { headers: getHeaders() });
  return handleResponse<{ proposals: AgentMaterializationProposal[]; canReview: boolean }>(response, 'Failed to load proposals');
}

export async function createAgentMaterializationProposal(input: {
  sourcePlanId: string; sourceVersion: number; sourceHash: string; targetKind: AgentMaterializationTarget;
  content: { title: string; description?: string; body?: string }; idempotencyKey: string; expiresAt: string;
}) {
  const response = await fetch(`${API_URL}/my-work/agent-materialization/proposals`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify(input),
  });
  return handleResponse<{ proposal: AgentMaterializationProposal; replayed: boolean }>(response, 'Failed to create proposal');
}

export async function decideAgentMaterializationProposal(proposal: AgentMaterializationProposal, decision: 'APPROVE' | 'REJECT') {
  const response = await fetch(`${API_URL}/my-work/agent-materialization/proposals/${encodeURIComponent(proposal.proposal_id)}/decision`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify({ decision, expectedStateVersion: proposal.state_version, sourceHash: proposal.source_hash }),
  });
  return handleResponse<{ proposal: AgentMaterializationProposal }>(response, 'Failed to decide proposal');
}

export async function materializeAgentMaterializationProposal(proposal: AgentMaterializationProposal) {
  const response = await fetch(`${API_URL}/my-work/agent-materialization/proposals/${encodeURIComponent(proposal.proposal_id)}/materialize`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify({ expectedStateVersion: proposal.state_version }),
  });
  return handleResponse<{ receipt: { status: string; target_id?: string; output_digest?: string }; replayed: boolean }>(response, 'Failed to materialize proposal');
}
