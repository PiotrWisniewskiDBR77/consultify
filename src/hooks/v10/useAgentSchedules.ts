import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AgentRunTimelineSummary,
  AgentScheduleCreateResponse,
  AgentScheduleDraftInput,
  AgentScheduleListItem,
  AgentScheduleNotificationPreferencesEnvelope,
  AgentSchedulePlanResponse,
  AgentSchedulePreview,
} from '@/models/agent/AgentScheduleSurfaceV1';
import { AgentSchedulesApi } from '@/services/api/v10/agentSchedules';
import { isAgentScheduleDefinitionEnabled } from '@/utils/v10/agentScheduleDefinitionFlag';
import { isAgentScheduleRegistryEnabled } from '@/utils/v10/agentScheduleRegistryFlag';

export type {
  AgentRunTimelineEntry,
  AgentRunTimelineSummary,
  AgentScheduleCreateResponse,
  AgentScheduleDraftInput,
  AgentScheduleListItem,
  AgentScheduleNotificationPreferences,
  AgentScheduleNotificationPreferencesEnvelope,
  AgentSchedulePlanResponse,
  AgentSchedulePreview,
} from '@/models/agent/AgentScheduleSurfaceV1';

export const V10_AGENT_SCHEDULE_KEYS = {
  all: (tenantId?: string) => ['v10', 'agent-schedules', tenantId ?? 'default'] as const,
  list: (tenantId?: string) => ['v10', 'agent-schedules', tenantId ?? 'default', 'list'] as const,
  preferences: (tenantId?: string) =>
    ['v10', 'agent-schedules', tenantId ?? 'default', 'preferences'] as const,
  timeline: (tenantId: string | undefined, scheduleId: string | undefined) =>
    ['v10', 'agent-schedules', tenantId ?? 'default', 'timeline', scheduleId ?? ''] as const,
} as const;

export interface AgentRuntimeCapabilities {
  readonly enabled: boolean;
  readonly schedules: boolean;
  readonly preferences: boolean;
  readonly plan: boolean;
  readonly preview: boolean;
  readonly create: boolean;
  readonly trigger: boolean;
  readonly timeline: boolean;
}

export function buildAgentRuntimeCapabilities(enabled = true): AgentRuntimeCapabilities {
  const definitionEnabled = enabled && isAgentScheduleDefinitionEnabled();
  const registryEnabled = enabled && isAgentScheduleRegistryEnabled();
  const runtimeEnabled = definitionEnabled || registryEnabled;

  return {
    enabled: runtimeEnabled,
    schedules: runtimeEnabled,
    preferences: runtimeEnabled,
    plan: definitionEnabled,
    preview: definitionEnabled,
    create: definitionEnabled,
    trigger: runtimeEnabled,
    timeline: runtimeEnabled,
  };
}

export function useAgentSchedules(tenantId?: string) {
  const queryClient = useQueryClient();
  const capabilities = buildAgentRuntimeCapabilities();

  const schedulesQuery = useQuery<AgentScheduleListItem[]>({
    queryKey: V10_AGENT_SCHEDULE_KEYS.list(tenantId),
    queryFn: () => AgentSchedulesApi.list(tenantId),
    enabled: capabilities.schedules,
  });

  const preferencesQuery = useQuery<AgentScheduleNotificationPreferencesEnvelope>({
    queryKey: V10_AGENT_SCHEDULE_KEYS.preferences(tenantId),
    queryFn: () => AgentSchedulesApi.getNotificationPreferences(tenantId),
    enabled: capabilities.preferences,
  });

  const planMutation = useMutation<AgentSchedulePlanResponse, Error, AgentScheduleDraftInput>({
    mutationFn: (draft) => AgentSchedulesApi.plan(draft),
  });

  const previewMutation = useMutation<AgentSchedulePreview, Error, AgentScheduleDraftInput>({
    mutationFn: (draft) => AgentSchedulesApi.preview(draft),
  });

  const createMutation = useMutation<AgentScheduleCreateResponse, Error, AgentScheduleDraftInput>({
    mutationFn: (draft) => AgentSchedulesApi.create(draft),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: V10_AGENT_SCHEDULE_KEYS.list(tenantId),
      });
      queryClient.setQueryData(
        V10_AGENT_SCHEDULE_KEYS.timeline(tenantId, result.schedule.id),
        result.schedule.timelineSummary
      );
    },
  });

  const updatePreferencesMutation = useMutation<
    AgentScheduleNotificationPreferencesEnvelope,
    Error,
    Partial<AgentScheduleNotificationPreferencesEnvelope['preferences']>
  >({
    mutationFn: (updates) => AgentSchedulesApi.updateNotificationPreferences(updates, tenantId),
    onSuccess: (result) => {
      queryClient.setQueryData(V10_AGENT_SCHEDULE_KEYS.preferences(tenantId), result);
    },
  });

  const triggerMutation = useMutation<
    { runId: string; gateDecision: string; timeline: AgentRunTimelineSummary },
    Error,
    string
  >({
    mutationFn: (scheduleId) => AgentSchedulesApi.trigger(scheduleId, tenantId),
    onSuccess: async (_result, scheduleId) => {
      await queryClient.invalidateQueries({
        queryKey: V10_AGENT_SCHEDULE_KEYS.list(tenantId),
      });
      await queryClient.invalidateQueries({
        queryKey: V10_AGENT_SCHEDULE_KEYS.timeline(tenantId, scheduleId),
      });
    },
  });

  const isWorking =
    planMutation.isPending ||
    previewMutation.isPending ||
    createMutation.isPending ||
    updatePreferencesMutation.isPending ||
    triggerMutation.isPending;
  const isLoading = schedulesQuery.isLoading || preferencesQuery.isLoading;
  const isFetching = schedulesQuery.isFetching || preferencesQuery.isFetching;

  return {
    capabilities,
    isEnabled: capabilities.enabled,
    isWorking,
    isLoading,
    isFetching,
    schedulesQuery,
    preferencesQuery,
    planMutation,
    previewMutation,
    createMutation,
    updatePreferencesMutation,
    triggerMutation,
  };
}

export function useAgentScheduleTimeline(scheduleId: string | undefined, tenantId?: string) {
  const capabilities = buildAgentRuntimeCapabilities();
  return useQuery<AgentRunTimelineSummary>({
    queryKey: V10_AGENT_SCHEDULE_KEYS.timeline(tenantId, scheduleId),
    queryFn: async () => {
      if (!scheduleId) {
        throw new Error('scheduleId is required to fetch the agent run timeline');
      }
      return AgentSchedulesApi.getTimeline(scheduleId, tenantId);
    },
    enabled: capabilities.timeline && Boolean(scheduleId),
  });
}
