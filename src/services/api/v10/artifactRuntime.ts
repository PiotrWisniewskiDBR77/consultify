import type { Artifact } from '@/models/artifact/Artifact';
import type { MutationProposal } from '@/models/artifact/MutationProposal';
import type { ReviewerRole } from '@/models/artifact/RoleBasedApprovalGates';
import type { SelectionScope } from '@/models/artifact/SelectionScope';

import { fetchWithRetry, handleDataResponse } from '../baseClient';

export type ArtifactMutationPlanRequest = {
  artifact: Artifact;
  proposal: MutationProposal;
  actorId?: string;
  selectedOpIndices?: number[];
  reviewEvent?: string;
  selectionContext?: {
    artifactId: string;
    selection: SelectionScope;
  };
  [key: string]: unknown;
};

export type ArtifactMutationPlanResponse = {
  runId: string;
  status: 'ready' | 'apply_ready' | 'rejected';
  scopeVerdict?: unknown;
  selectedOpIndices?: number[];
  acceptedOpIndices?: number[];
  rejectedOpIndices?: number[];
  previousReviewState?: string;
  nextReviewState?: string;
  pipeline?: {
    nextReviewState?: string | null;
    [key: string]: unknown;
  };
  selectedOps?: unknown[];
  capabilities?: {
    supportsSelectionScope?: boolean;
    [key: string]: unknown;
  };
  warnings?: string[];
  [key: string]: unknown;
};

export type ArtifactMutationApplyRequest = {
  artifactId: string;
  proposalId: string;
  intent: 'approve' | 'reject';
  actorId?: string;
  note?: string;
  rejectionReason?: string;
  selectedOpIndices?: number[];
  [key: string]: unknown;
};

export type ArtifactMutationApplyResponse = ArtifactMutationPlanResponse & {
  acceptedOps?: unknown[];
  reverseOps?: unknown[];
};

export type ArtifactExportPlanRequest = {
  artifact: Artifact;
  lineageNodes: readonly unknown[];
  sha256: string;
  format: string;
  destination: string;
  exportedBy?: string;
  sources: readonly unknown[];
  confidentialityTags: string[];
  watermark: { text: string; label?: string };
  tenantWatermarkPolicy: unknown;
  footerTarget: string;
  [key: string]: unknown;
};

export type ArtifactExportPlanResponse = {
  runId: string;
  exportAllowed: boolean;
  manifest: {
    format?: string;
    destination?: string;
    [key: string]: unknown;
  };
  provenanceFooter: {
    target?: string;
    [key: string]: unknown;
  };
  lineageRootId: string;
  supportedFormats?: string[];
  warnings?: string[];
  [key: string]: unknown;
};

export type ArtifactCommentPlanRequest = {
  artifactId: string;
  anchor: unknown;
  author: string;
  body: string;
  mentions: string[];
  kind: string;
  selection?: SelectionScope | null;
  [key: string]: unknown;
};

export type ArtifactCommentPlanResponse = {
  commentId: string;
  notificationsPlanned: number;
  mentionedUserIds: string[];
  reattachResult?: unknown;
  comment?: {
    kind?: string;
    state?: string;
    [key: string]: unknown;
  };
  anchorOutcome?: string;
  mentionNotifications?: unknown[];
  warnings?: string[];
  [key: string]: unknown;
};

export type ArtifactTemplateReuseRequest = {
  structure?: unknown;
  libraryFingerprints?: string[];
  placement?: unknown;
  transition?: unknown;
  [key: string]: unknown;
};

export type ArtifactTemplateReuseResponse = {
  fingerprint: string;
  recommendedTemplateId: string | null;
  matches: Array<{
    templateId: string;
    label: string;
    artifactType: string;
  }>;
  warnings: string[];
  [key: string]: unknown;
};

export type ArtifactApprovalEvaluationRequest = {
  context?: unknown;
  routingTable?: unknown;
  baselineRoutingTable?: unknown;
  [key: string]: unknown;
};

export type ArtifactApprovalEvaluationResponse = {
  status: 'ready' | 'attention_required' | 'blocked' | 'unknown';
  requiredReviewer: ReviewerRole;
  matchedBy: string;
  coverageSatisfied: boolean;
  reasons: string[];
  [key: string]: unknown;
};

export const ArtifactRuntimeApi = {
  planMutation: async (
    body: ArtifactMutationPlanRequest
  ): Promise<ArtifactMutationPlanResponse> => {
    const res = await fetchWithRetry('/api/v10/artifact-runtime/mutations/plan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ArtifactMutationPlanResponse>(
      res,
      'Failed to plan artifact mutation'
    );
  },

  applyMutation: async (
    body: ArtifactMutationApplyRequest
  ): Promise<ArtifactMutationApplyResponse> => {
    const res = await fetchWithRetry('/api/v10/artifact-runtime/mutations/apply', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ArtifactMutationApplyResponse>(
      res,
      'Failed to apply artifact mutation'
    );
  },

  planExport: async (body: ArtifactExportPlanRequest): Promise<ArtifactExportPlanResponse> => {
    const res = await fetchWithRetry('/api/v10/artifact-runtime/exports/plan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ArtifactExportPlanResponse>(res, 'Failed to plan artifact export');
  },

  planComment: async (body: ArtifactCommentPlanRequest): Promise<ArtifactCommentPlanResponse> => {
    const res = await fetchWithRetry('/api/v10/artifact-runtime/comments/plan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ArtifactCommentPlanResponse>(res, 'Failed to plan artifact comment');
  },

  reuseTemplate: async (
    body: ArtifactTemplateReuseRequest
  ): Promise<ArtifactTemplateReuseResponse> => {
    const res = await fetchWithRetry('/api/v10/artifact-runtime/templates/fingerprint', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ArtifactTemplateReuseResponse>(
      res,
      'Failed to evaluate artifact template reuse'
    );
  },

  evaluateApproval: async (
    body: ArtifactApprovalEvaluationRequest
  ): Promise<ArtifactApprovalEvaluationResponse> => {
    const res = await fetchWithRetry('/api/v10/artifact-runtime/approvals/evaluate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ArtifactApprovalEvaluationResponse>(
      res,
      'Failed to evaluate artifact approvals'
    );
  },
};
