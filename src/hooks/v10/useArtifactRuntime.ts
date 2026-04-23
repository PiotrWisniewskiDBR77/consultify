import { useMutation } from '@tanstack/react-query';

import {
  type ArtifactApprovalEvaluationRequest,
  type ArtifactApprovalEvaluationResponse,
  type ArtifactCommentPlanRequest,
  type ArtifactCommentPlanResponse,
  type ArtifactExportPlanRequest,
  type ArtifactExportPlanResponse,
  type ArtifactMutationApplyRequest,
  type ArtifactMutationApplyResponse,
  type ArtifactMutationPlanRequest,
  type ArtifactMutationPlanResponse,
  ArtifactRuntimeApi,
  type ArtifactTemplateReuseRequest,
  type ArtifactTemplateReuseResponse,
} from '@/services/api/v10/artifactRuntime';
import { isPipelinesArtifactExportPipelineEnabled } from '@/utils/v10/pipelinesArtifactExportPipelineFlag';
import { isPipelinesArtifactMutationPipelineEnabled } from '@/utils/v10/pipelinesArtifactMutationPipelineFlag';

export type {
  ArtifactApprovalEvaluationRequest,
  ArtifactApprovalEvaluationResponse,
  ArtifactCommentPlanRequest,
  ArtifactCommentPlanResponse,
  ArtifactExportPlanRequest,
  ArtifactExportPlanResponse,
  ArtifactMutationApplyRequest,
  ArtifactMutationApplyResponse,
  ArtifactMutationPlanRequest,
  ArtifactMutationPlanResponse,
  ArtifactTemplateLibraryEntry,
  ArtifactTemplateReuseRequest,
  ArtifactTemplateReuseResponse,
} from '@/services/api/v10/artifactRuntime';

export interface ArtifactRuntimeCapabilities {
  enabled: boolean;
  mutationPlan: boolean;
  mutationApply: boolean;
  exportPlan: boolean;
  commentPlan: boolean;
  templateReuse: boolean;
  approvalEvaluation: boolean;
}

export interface UseArtifactRuntimeOptions {
  enabled?: boolean;
}

function createCapabilityError(capability: string): Error {
  return new Error(`Artifact Runtime capability "${capability}" is disabled.`);
}

export function buildArtifactRuntimeCapabilities(
  options: UseArtifactRuntimeOptions = {}
): ArtifactRuntimeCapabilities {
  const baseEnabled = options.enabled ?? true;
  const mutationEnabled = baseEnabled && isPipelinesArtifactMutationPipelineEnabled();
  const exportEnabled = baseEnabled && isPipelinesArtifactExportPipelineEnabled();

  return {
    enabled: mutationEnabled || exportEnabled,
    mutationPlan: mutationEnabled,
    mutationApply: mutationEnabled,
    exportPlan: exportEnabled,
    commentPlan: mutationEnabled,
    templateReuse: mutationEnabled,
    approvalEvaluation: mutationEnabled,
  };
}

export function useArtifactRuntime(options: UseArtifactRuntimeOptions = {}) {
  const capabilities = buildArtifactRuntimeCapabilities(options);

  const mutationPlan = useMutation<
    ArtifactMutationPlanResponse,
    Error,
    ArtifactMutationPlanRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.mutationPlan) {
        throw createCapabilityError('mutation_plan');
      }
      return ArtifactRuntimeApi.planMutation(payload);
    },
  });

  const mutationApply = useMutation<
    ArtifactMutationApplyResponse,
    Error,
    ArtifactMutationApplyRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.mutationApply) {
        throw createCapabilityError('mutation_apply');
      }
      return ArtifactRuntimeApi.applyMutation(payload);
    },
  });

  const exportPlan = useMutation<ArtifactExportPlanResponse, Error, ArtifactExportPlanRequest>({
    mutationFn: async (payload) => {
      if (!capabilities.exportPlan) {
        throw createCapabilityError('export_plan');
      }
      return ArtifactRuntimeApi.planExport(payload);
    },
  });

  const commentPlan = useMutation<ArtifactCommentPlanResponse, Error, ArtifactCommentPlanRequest>({
    mutationFn: async (payload) => {
      if (!capabilities.commentPlan) {
        throw createCapabilityError('comment_plan');
      }
      return ArtifactRuntimeApi.planComment(payload);
    },
  });

  const templateReuse = useMutation<
    ArtifactTemplateReuseResponse,
    Error,
    ArtifactTemplateReuseRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.templateReuse) {
        throw createCapabilityError('template_reuse');
      }
      return ArtifactRuntimeApi.reuseTemplate(payload);
    },
  });

  const approvalEvaluation = useMutation<
    ArtifactApprovalEvaluationResponse,
    Error,
    ArtifactApprovalEvaluationRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.approvalEvaluation) {
        throw createCapabilityError('approval_evaluation');
      }
      return ArtifactRuntimeApi.evaluateApproval(payload);
    },
  });

  const isWorking =
    mutationPlan.isPending ||
    mutationApply.isPending ||
    exportPlan.isPending ||
    commentPlan.isPending ||
    templateReuse.isPending ||
    approvalEvaluation.isPending;

  return {
    capabilities,
    isEnabled: capabilities.enabled,
    isWorking,
    planMutation: mutationPlan.mutateAsync,
    applyMutation: mutationApply.mutateAsync,
    planExport: exportPlan.mutateAsync,
    planComment: commentPlan.mutateAsync,
    reuseTemplate: templateReuse.mutateAsync,
    evaluateApproval: approvalEvaluation.mutateAsync,
    mutationPlan,
    mutationApply,
    exportPlan,
    commentPlan,
    templateReuse,
    approvalEvaluation,
  };
}
