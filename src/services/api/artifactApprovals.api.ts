/**
 * Artifact Approval API client (HP-7/HP-8).
 *
 * Thin wrapper over `/api/artifact-approvals/:type/:id/...`
 * (server/src/routes/artifactApprovals.routes.ts). Actor identity
 * (submitted-by/approved-by/rejected-by) and org scope are resolved
 * server-side from the auth token — this client never sends them.
 */
import { API_URL, getHeaders, handleResponse } from './baseClient';

export type ArtifactApprovalState = 'draft' | 'review' | 'approved' | 'rejected';

export interface ArtifactApprovalAssignment {
  id: string;
  status: string;
  assigned_to_user_id: string;
  sla_due_at: string;
  artifact_type: string | null;
  artifact_id: string | null;
  [key: string]: unknown;
}

export interface ArtifactApprovalStatusResponse {
  state: ArtifactApprovalState;
  assignment: ArtifactApprovalAssignment | null;
}

export interface ArtifactApprovalActionResponse {
  state: ArtifactApprovalState;
  assignment: ArtifactApprovalAssignment;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

export async function getArtifactApprovalState(
  artifactType: string,
  artifactId: string
): Promise<ArtifactApprovalStatusResponse> {
  const res = await fetch(
    `${API_URL}/artifact-approvals/${encodePathPart(artifactType)}/${encodePathPart(artifactId)}/approval-state`,
    { headers: getHeaders() }
  );
  return handleResponse<ArtifactApprovalStatusResponse>(res, 'Failed to load approval state');
}

export async function submitArtifactForReview(
  artifactType: string,
  artifactId: string,
  params: { assignedToUserId: string; slaDueAt?: string }
): Promise<ArtifactApprovalActionResponse> {
  const res = await fetch(
    `${API_URL}/artifact-approvals/${encodePathPart(artifactType)}/${encodePathPart(artifactId)}/approval/submit`,
    { method: 'POST', headers: getHeaders(), body: JSON.stringify(params) }
  );
  return handleResponse<ArtifactApprovalActionResponse>(
    res,
    'Failed to submit artifact for review'
  );
}

export async function approveArtifact(
  artifactType: string,
  artifactId: string
): Promise<ArtifactApprovalActionResponse> {
  const res = await fetch(
    `${API_URL}/artifact-approvals/${encodePathPart(artifactType)}/${encodePathPart(artifactId)}/approval/approve`,
    { method: 'POST', headers: getHeaders() }
  );
  return handleResponse<ArtifactApprovalActionResponse>(res, 'Failed to approve artifact');
}

export async function rejectArtifact(
  artifactType: string,
  artifactId: string,
  params?: { reason?: string }
): Promise<ArtifactApprovalActionResponse> {
  const res = await fetch(
    `${API_URL}/artifact-approvals/${encodePathPart(artifactType)}/${encodePathPart(artifactId)}/approval/reject`,
    { method: 'POST', headers: getHeaders(), body: JSON.stringify(params || {}) }
  );
  return handleResponse<ArtifactApprovalActionResponse>(res, 'Failed to reject artifact');
}

export async function acknowledgeArtifactReview(
  artifactType: string,
  artifactId: string
): Promise<ArtifactApprovalActionResponse> {
  const res = await fetch(
    `${API_URL}/artifact-approvals/${encodePathPart(artifactType)}/${encodePathPart(artifactId)}/approval/acknowledge`,
    { method: 'POST', headers: getHeaders() }
  );
  return handleResponse<ArtifactApprovalActionResponse>(res, 'Failed to acknowledge review');
}
