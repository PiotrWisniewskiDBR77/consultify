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

export function useAgentSchedules(tenantId?: string) {
  const queryClient = useQueryClient();

  const schedulesQuery = useQuery<AgentScheduleListItem[]>({
    queryKey: V10_AGENT_SCHEDULE_KEYS.list(tenantId),
    queryFn: () => AgentSchedulesApi.list(tenantId),
  });

  const preferencesQuery = useQuery<AgentScheduleNotificationPreferencesEnvelope>({
    queryKey: V10_AGENT_SCHEDULE_KEYS.preferences(tenantId),
    queryFn: () => AgentSchedulesApi.getNotificationPreferences(tenantId),
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

  return {
    schedulesQuery,
    preferencesQuery,
    planMutation,
    previewMutation,
    createMutation,
    updatePreferencesMutation,
  };
}

export function useAgentScheduleTimeline(scheduleId: string | undefined, tenantId?: string) {
  return useQuery<AgentRunTimelineSummary>({
    queryKey: V10_AGENT_SCHEDULE_KEYS.timeline(tenantId, scheduleId),
    queryFn: async () => {
      if (!scheduleId) {
        throw new Error('scheduleId is required to fetch the agent run timeline');
      }
      return AgentSchedulesApi.getTimeline(scheduleId, tenantId);
    },
    enabled: Boolean(scheduleId),
  });
}
