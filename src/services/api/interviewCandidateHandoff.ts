/** Client for the server-derived accepted interview output -> Candidate flow. */
import { apiGet, apiPost } from './baseClient';

const BASE = '/interview/candidate-handoff';

export interface CandidatePreview {
  sourceType: 'interview_submission' | 'interview_insight_finding';
  sourceId: string;
  acceptedSnapshotId: string;
  title: string;
  rationale: string;
  alreadyHandedOff: boolean;
  existingCandidateId: string | null;
  projectId: string | null;
  projectName: string | null;
  authorName: string | null;
  authorEmail: string | null;
  evidenceSnippet: string | null;
  candidateStatus: string | null;
}

export interface CandidateHandoffResult {
  handoff: {
    id: string;
    organizationId: string;
    sourceType: string;
    sourceId: string;
    acceptedSnapshotId: string;
    candidateId: string;
    createdBy: string;
    createdAt: string;
  };
  created: boolean;
  candidate: { id: string; title: string; rationale: string; status: string };
}

export interface CandidateHandoffReceipt {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  acceptedSnapshotId: string;
  candidateId: string;
  createdBy: string;
  createdAt: string;
  initiativeId: string | null;
}

export const InterviewCandidateHandoffApi = {
  previewSubmission: (assignmentId: string) =>
    apiGet<{ data: CandidatePreview }>(
      `${BASE}/submission/${encodeURIComponent(assignmentId)}/preview`
    ).then((response) => response.data),
  approveSubmission: (assignmentId: string) =>
    apiPost<{ data: CandidateHandoffResult }>(
      `${BASE}/submission/${encodeURIComponent(assignmentId)}/approve`,
      {}
    ).then((response) => response.data),
  getSubmissionHandoff: (assignmentId: string) =>
    apiGet<{ data: CandidateHandoffReceipt }>(
      `${BASE}/submission/${encodeURIComponent(assignmentId)}`
    ).then((response) => response.data),
  previewInsightFinding: (findingId: string) =>
    apiGet<{ data: CandidatePreview }>(
      `${BASE}/insight-finding/${encodeURIComponent(findingId)}/preview`
    ).then((response) => response.data),
  approveInsightFinding: (findingId: string) =>
    apiPost<{ data: CandidateHandoffResult }>(
      `${BASE}/insight-finding/${encodeURIComponent(findingId)}/approve`,
      {}
    ).then((response) => response.data),
  getInsightFindingHandoff: (findingId: string) =>
    apiGet<{ data: CandidateHandoffReceipt }>(
      `${BASE}/insight-finding/${encodeURIComponent(findingId)}`
    ).then((response) => response.data),
};
