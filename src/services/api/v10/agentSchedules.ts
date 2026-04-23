import type {
  AgentRunTimelineSummary,
  AgentScheduleCreateResponse,
  AgentScheduleDraftInput,
  AgentScheduleListItem,
  AgentScheduleNotificationPreferencesEnvelope,
  AgentSchedulePlanResponse,
  AgentSchedulePreview,
} from '@/models/agent/AgentScheduleSurfaceV1';

import { fetchWithRetry, handleDataResponse } from '../baseClient';

export const AgentSchedulesApi = {
  list: async (tenantId?: string): Promise<AgentScheduleListItem[]> => {
    void tenantId;
    const response = await fetchWithRetry('/api/v10/agent-schedules', { method: 'GET' });
    return handleDataResponse<AgentScheduleListItem[]>(response, 'Failed to load agent schedules');
  },

  plan: async (draft: AgentScheduleDraftInput): Promise<AgentSchedulePlanResponse> => {
    const res = await fetchWithRetry('/api/v10/agent-schedules/plan', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
    return handleDataResponse<AgentSchedulePlanResponse>(res, 'Failed to build agent schedule plan');
  },

  preview: async (draft: AgentScheduleDraftInput): Promise<AgentSchedulePreview> => {
    const res = await fetchWithRetry('/api/v10/agent-schedules/preview', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
    return handleDataResponse<AgentSchedulePreview>(res, 'Failed to preview agent schedule');
  },

  create: async (draft: AgentScheduleDraftInput): Promise<AgentScheduleCreateResponse> => {
    const res = await fetchWithRetry('/api/v10/agent-schedules', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
    return handleDataResponse<AgentScheduleCreateResponse>(res, 'Failed to create agent schedule');
  },

  getNotificationPreferences: async (
    tenantId?: string
  ): Promise<AgentScheduleNotificationPreferencesEnvelope> => {
    void tenantId;
    const response = await fetchWithRetry('/api/v10/agent-schedules/preferences', { method: 'GET' });
    return handleDataResponse<AgentScheduleNotificationPreferencesEnvelope>(
      response,
      'Failed to load agent schedule notification preferences'
    );
  },

  updateNotificationPreferences: async (
    updates: Partial<AgentScheduleNotificationPreferencesEnvelope['preferences']>,
    tenantId?: string
  ): Promise<AgentScheduleNotificationPreferencesEnvelope> => {
    void tenantId;
    const res = await fetchWithRetry('/api/v10/agent-schedules/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return handleDataResponse<AgentScheduleNotificationPreferencesEnvelope>(
      res,
      'Failed to update agent schedule notification preferences'
    );
  },

  getTimeline: async (scheduleId: string, tenantId?: string): Promise<AgentRunTimelineSummary> => {
    void tenantId;
    const response = await fetchWithRetry(`/api/v10/agent-schedules/${encodeURIComponent(scheduleId)}/timeline`, {
      method: 'GET',
    });
    return handleDataResponse<AgentRunTimelineSummary>(response, 'Failed to load agent schedule timeline');
  },

  trigger: async (
    scheduleId: string,
    tenantId?: string
  ): Promise<{ runId: string; gateDecision: string; timeline: AgentRunTimelineSummary }> => {
    void tenantId;
    const res = await fetchWithRetry(`/api/v10/agent-schedules/${encodeURIComponent(scheduleId)}/trigger`, {
      method: 'POST',
    });
    return handleDataResponse<{ runId: string; gateDecision: string; timeline: AgentRunTimelineSummary }>(
      res,
      'Failed to trigger agent schedule'
    );
  },
};
