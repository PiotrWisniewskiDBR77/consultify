import { useMutation } from '@tanstack/react-query';

import {
  type OutcomeAcceptancePreviewRequest,
  type OutcomeAcceptancePreviewResponse,
  type OutcomeAcceptanceResolveRequest,
  type OutcomeAcceptanceResolveResponse,
  type OutcomeBusinessLinkRequest,
  type OutcomeBusinessLinkResponse,
  OutcomeRuntimeApi,
  type OutcomeSignalIngestRequest,
  type OutcomeSignalIngestResponse,
} from '@/services/api/v10';
import { isOutcomeKpiAcceptOutcomeEnabled } from '@/utils/v10/outcomeKpiAcceptOutcomeFlag';
import { isOutcomeSignalEnabled } from '@/utils/v10/outcomeSignalFlag';
import { isPipelinesOutcomeRollupPipelineEnabled } from '@/utils/v10/pipelinesOutcomeRollupPipelineFlag';

export type {
  OutcomeAcceptancePreviewRequest,
  OutcomeAcceptancePreviewResponse,
  OutcomeAcceptanceResolveRequest,
  OutcomeAcceptanceResolveResponse,
  OutcomeBusinessLinkRequest,
  OutcomeBusinessLinkResponse,
  OutcomeConfidence,
  OutcomeEvidenceRefs,
  OutcomeKpiDomain,
  OutcomeMetric,
  OutcomeSignalIngestRequest,
  OutcomeSignalIngestResponse,
  OutcomeSignalKind,
} from '@/services/api/v10';

export interface OutcomeRuntimeCapabilities {
  readonly enabled: boolean;
  readonly previewAcceptance: boolean;
  readonly ingestSignal: boolean;
  readonly resolveAcceptance: boolean;
  readonly linkAnalysis: boolean;
}

export interface UseOutcomeRuntimeOptions {
  readonly enabled?: boolean;
}

function createCapabilityError(capability: string): Error {
  return new Error(`Outcome Runtime capability "${capability}" is disabled.`);
}

export function buildOutcomeRuntimeCapabilities(
  options: UseOutcomeRuntimeOptions = {}
): OutcomeRuntimeCapabilities {
  const baseEnabled = options.enabled ?? true;
  const outcomePipelineEnabled = baseEnabled && isPipelinesOutcomeRollupPipelineEnabled();
  const signalEnabled = baseEnabled && isOutcomeSignalEnabled();
  const acceptanceEnabled = baseEnabled && isOutcomeKpiAcceptOutcomeEnabled();

  return {
    enabled: outcomePipelineEnabled || signalEnabled || acceptanceEnabled,
    previewAcceptance: outcomePipelineEnabled,
    ingestSignal: signalEnabled,
    resolveAcceptance: acceptanceEnabled,
    linkAnalysis: outcomePipelineEnabled,
  };
}

export function useOutcomeRuntime(options: UseOutcomeRuntimeOptions = {}) {
  const capabilities = buildOutcomeRuntimeCapabilities(options);

  const previewAcceptanceMutation = useMutation<
    OutcomeAcceptancePreviewResponse,
    Error,
    OutcomeAcceptancePreviewRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.previewAcceptance) throw createCapabilityError('preview_acceptance');
      return OutcomeRuntimeApi.previewAcceptance(payload);
    },
  });

  const ingestSignalMutation = useMutation<
    OutcomeSignalIngestResponse,
    Error,
    OutcomeSignalIngestRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.ingestSignal) throw createCapabilityError('ingest_signal');
      return OutcomeRuntimeApi.ingestSignal(payload);
    },
  });

  const resolveAcceptanceMutation = useMutation<
    OutcomeAcceptanceResolveResponse,
    Error,
    OutcomeAcceptanceResolveRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.resolveAcceptance) throw createCapabilityError('resolve_acceptance');
      return OutcomeRuntimeApi.resolveAcceptance(payload);
    },
  });

  const linkAnalysisMutation = useMutation<
    OutcomeBusinessLinkResponse,
    Error,
    OutcomeBusinessLinkRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.linkAnalysis) throw createCapabilityError('link_analysis');
      return OutcomeRuntimeApi.linkAnalysisToBusinessOutcome(payload);
    },
  });

  const isWorking =
    previewAcceptanceMutation.isPending ||
    ingestSignalMutation.isPending ||
    resolveAcceptanceMutation.isPending ||
    linkAnalysisMutation.isPending;

  return {
    capabilities,
    isEnabled: capabilities.enabled,
    isWorking,
    previewAcceptance: previewAcceptanceMutation.mutateAsync,
    ingestSignal: ingestSignalMutation.mutateAsync,
    resolveAcceptance: resolveAcceptanceMutation.mutateAsync,
    linkAnalysisToBusinessOutcome: linkAnalysisMutation.mutateAsync,
    previewAcceptanceMutation,
    ingestSignalMutation,
    resolveAcceptanceMutation,
    linkAnalysisMutation,
  };
}
