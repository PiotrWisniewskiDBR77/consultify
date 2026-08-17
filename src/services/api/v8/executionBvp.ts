import { v8Get, v8Post } from './client';

export type ExecutionDeliveryLink = {
  link_id: string;
  initiative_id: string | null;
  case_id: string | null;
  work_ref: string | null;
  resource_ref: string | null;
  control_ref: string | null;
  report_ref: string | null;
  status: 'ACTIVE' | 'CLOSED';
  version: number;
};

export type ExecutionDeliveryEvidence = {
  evidence_id: string;
  execution_link_id: string;
  artifact_link_id: string;
  content_digest: string;
  approval_status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submitted_by: string;
  approved_by: string | null;
  version: number;
};

export type ExecutionDeliverySnapshot = {
  link: ExecutionDeliveryLink;
  evidence: ExecutionDeliveryEvidence[];
  resultsReceipt: null | {
    signalId: string;
    deliveryStatus: string;
    attemptCount: number;
    payload: Record<string, unknown>;
    receiptId: string | null;
    observationPayload: Record<string, unknown> | null;
  };
};

const key = (): string => crypto.randomUUID();

export const ExecutionBvpApi = {
  read: (linkId: string) =>
    v8Get<ExecutionDeliverySnapshot>(`/case-workspace/execution-bvp/links/${encodeURIComponent(linkId)}`),
  link: (initiativeId: string, caseId: string) =>
    v8Post<ExecutionDeliveryLink>(
      '/case-workspace/execution-bvp/links',
      { initiativeId, caseId },
      { extraHeaders: { 'Idempotency-Key': key() } }
    ),
  recordSpine: (linkId: string, input: { workRef: string; resourceRef: string; controlRef: string; reportRef: string; expectedVersion: number }) =>
    v8Post<ExecutionDeliveryLink>(`/case-workspace/execution-bvp/links/${encodeURIComponent(linkId)}/spine`, input),
  submitEvidence: (linkId: string, input: { artifactLinkId: string; contentDigest: string }, idempotencyKey = key()) =>
    v8Post<ExecutionDeliveryEvidence>(
      `/case-workspace/execution-bvp/links/${encodeURIComponent(linkId)}/evidence`,
      input,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  approveEvidence: (evidenceId: string, expectedVersion: number) =>
    v8Post<ExecutionDeliveryEvidence>(
      `/case-workspace/execution-bvp/evidence/${encodeURIComponent(evidenceId)}/approve`,
      { expectedVersion }
    ),
  close: (linkId: string, evidenceId: string, expectedVersion: number, idempotencyKey = key()) =>
    v8Post<{ link: ExecutionDeliveryLink; signalId: string; replay: boolean }>(
      `/case-workspace/execution-bvp/links/${encodeURIComponent(linkId)}/close`,
      { evidenceId, expectedVersion },
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
};
