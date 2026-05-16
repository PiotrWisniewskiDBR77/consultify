import { useMutation } from '@tanstack/react-query';

import {
  type ResearchMissionPlanRequest,
  type ResearchMissionPlanResponse,
  type ResearchMissionStartRequest,
  type ResearchMissionStartResponse,
  type ResearchMissionSummaryRequest,
  type ResearchMissionSummaryResponse,
  type ResearchMissionWatchRequest,
  type ResearchMissionWatchResponse,
  ResearchRuntimeApi,
} from '@/services/api/v10';
import { isPipelinesResearchMissionPipelineEnabled } from '@/utils/v10/pipelinesResearchMissionPipelineFlag';
import { isPipelinesResearchWatchPipelineEnabled } from '@/utils/v10/pipelinesResearchWatchPipelineFlag';

export type {
  ResearchMissionEvent,
  ResearchMissionEventKind,
  ResearchMissionPlanRequest,
  ResearchMissionPlanResponse,
  ResearchMissionStartRequest,
  ResearchMissionStartResponse,
  ResearchMissionSummaryRequest,
  ResearchMissionSummaryResponse,
  ResearchMissionWatchRequest,
  ResearchMissionWatchResponse,
} from '@/services/api/v10';

export interface ResearchRuntimeCapabilities {
  readonly enabled: boolean;
  readonly planMission: boolean;
  readonly startMission: boolean;
  readonly watchMission: boolean;
  readonly summary: boolean;
  readonly delegatePlan: boolean;
}

export interface UseResearchRuntimeOptions {
  readonly enabled?: boolean;
}

function createCapabilityError(capability: string): Error {
  return new Error(`Research Runtime capability "${capability}" is disabled.`);
}

export function buildResearchRuntimeCapabilities(
  options: UseResearchRuntimeOptions = {}
): ResearchRuntimeCapabilities {
  const baseEnabled = options.enabled ?? true;
  const missionPipelineEnabled = baseEnabled && isPipelinesResearchMissionPipelineEnabled();
  const watchPipelineEnabled = baseEnabled && isPipelinesResearchWatchPipelineEnabled();

  return {
    enabled: missionPipelineEnabled || watchPipelineEnabled,
    planMission: missionPipelineEnabled,
    startMission: missionPipelineEnabled,
    watchMission: watchPipelineEnabled,
    summary: missionPipelineEnabled,
    delegatePlan: missionPipelineEnabled,
  };
}

export function useResearchRuntime(options: UseResearchRuntimeOptions = {}) {
  const capabilities = buildResearchRuntimeCapabilities(options);

  const planMissionMutation = useMutation<
    ResearchMissionPlanResponse,
    Error,
    ResearchMissionPlanRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.planMission) throw createCapabilityError('plan_mission');
      return ResearchRuntimeApi.planMission(payload);
    },
  });

  const startMissionMutation = useMutation<
    ResearchMissionStartResponse,
    Error,
    ResearchMissionStartRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.startMission) throw createCapabilityError('start_mission');
      return ResearchRuntimeApi.startMission(payload);
    },
  });

  const watchMissionMutation = useMutation<
    ResearchMissionWatchResponse,
    Error,
    ResearchMissionWatchRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.watchMission) throw createCapabilityError('watch_mission');
      return ResearchRuntimeApi.watchMission(payload);
    },
  });

  const summaryMutation = useMutation<
    ResearchMissionSummaryResponse,
    Error,
    ResearchMissionSummaryRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.summary) throw createCapabilityError('summary');
      return ResearchRuntimeApi.getSummary(payload);
    },
  });

  const delegatePlanMutation = useMutation<
    ResearchMissionPlanResponse,
    Error,
    ResearchMissionPlanRequest
  >({
    mutationFn: async (payload) => {
      if (!capabilities.delegatePlan) throw createCapabilityError('delegate_plan');
      return ResearchRuntimeApi.delegatePlanFromReasoning(payload);
    },
  });

  const isWorking =
    planMissionMutation.isPending ||
    startMissionMutation.isPending ||
    watchMissionMutation.isPending ||
    summaryMutation.isPending ||
    delegatePlanMutation.isPending;

  return {
    capabilities,
    isEnabled: capabilities.enabled,
    isWorking,
    planMission: planMissionMutation.mutateAsync,
    startMission: startMissionMutation.mutateAsync,
    watchMission: watchMissionMutation.mutateAsync,
    getSummary: summaryMutation.mutateAsync,
    delegatePlanFromReasoning: delegatePlanMutation.mutateAsync,
    planMissionMutation,
    startMissionMutation,
    watchMissionMutation,
    summaryMutation,
    delegatePlanMutation,
  };
}
