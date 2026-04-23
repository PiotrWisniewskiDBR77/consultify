import { randomUUID } from 'node:crypto';

import { buildSchedulePlan } from './schedulePlanning.js';
import type {
  AgentRunTimelineSummary,
  AgentScheduleCreateResponse,
  AgentScheduleDraftInput,
  AgentScheduleListItem,
  AgentScheduleNotificationPreferences,
  AgentScheduleNotificationPreferencesEnvelope,
  AgentSchedulePlanResponse,
} from './types.js';
import {
  DEFAULT_AGENT_RUN_TIMELINE_TOTALS,
  DEFAULT_AGENT_SCHEDULE_NOTIFICATION_PREFERENCES,
} from './types.js';

const schedulesByTenant = new Map<string, Map<string, AgentScheduleListItem>>();
const notificationPreferencesByTenant = new Map<
  string,
  AgentScheduleNotificationPreferencesEnvelope
>();

function getTenantSchedules(tenantId: string): Map<string, AgentScheduleListItem> {
  let schedules = schedulesByTenant.get(tenantId);
  if (!schedules) {
    schedules = new Map<string, AgentScheduleListItem>();
    schedulesByTenant.set(tenantId, schedules);
  }
  return schedules;
}

function buildEmptyTimelineSummary(scheduleId: string): AgentRunTimelineSummary {
  return {
    scheduleId,
    latestStatus: null,
    activeRunId: null,
    queuedCount: 0,
    totals: { ...DEFAULT_AGENT_RUN_TIMELINE_TOTALS },
    entries: [],
  };
}

function clonePreferences(
  tenantId: string,
  preferences: AgentScheduleNotificationPreferences
): AgentScheduleNotificationPreferencesEnvelope {
  return {
    tenantId,
    preferences: { ...preferences },
    updatedAt: new Date().toISOString(),
  };
}

function getDefaultTenantPreferences(
  tenantId: string
): AgentScheduleNotificationPreferencesEnvelope {
  const existing = notificationPreferencesByTenant.get(tenantId);
  if (existing) {
    return {
      tenantId: existing.tenantId,
      preferences: { ...existing.preferences },
      updatedAt: existing.updatedAt,
    };
  }

  const created = clonePreferences(tenantId, DEFAULT_AGENT_SCHEDULE_NOTIFICATION_PREFERENCES);
  notificationPreferencesByTenant.set(tenantId, created);
  return clonePreferences(tenantId, created.preferences);
}

export const agentScheduleRegistryService = {
  listSchedules(tenantId: string): AgentScheduleListItem[] {
    return [...getTenantSchedules(tenantId).values()].sort((left, right) =>
      left.nextRunAt.localeCompare(right.nextRunAt)
    );
  },

  planSchedule(tenantId: string, draft: AgentScheduleDraftInput): AgentSchedulePlanResponse {
    const defaults = getDefaultTenantPreferences(tenantId).preferences;
    return buildSchedulePlan(
      {
        ...draft,
        notifications: {
          ...defaults,
          ...(draft.notifications ?? {}),
        },
      },
      tenantId
    );
  },

  previewSchedule(tenantId: string, draft: AgentScheduleDraftInput): AgentSchedulePlanResponse {
    return this.planSchedule(tenantId, draft);
  },

  createSchedule(tenantId: string, draft: AgentScheduleDraftInput): AgentScheduleCreateResponse {
    const plan = this.planSchedule(tenantId, draft);
    const now = new Date().toISOString();
    const scheduleId = `agent-sched-${randomUUID()}`;
    const schedule: AgentScheduleListItem = {
      id: scheduleId,
      tenantId,
      displayName: plan.draft.displayName,
      description: plan.draft.description,
      agentDefinitionRef: plan.draft.agentDefinitionRef,
      cronOrInterval: plan.draft.cronOrInterval,
      overlapPolicy: plan.draft.overlapPolicy,
      retentionDays: plan.draft.retentionDays,
      timezone: plan.draft.timezone,
      nextRunAt: plan.preview.nextRunAt,
      lastRunAt: null,
      registryStatus: 'active',
      approvalMode: plan.draft.approvalMode,
      budget: { ...plan.draft.budget },
      notifications: { ...plan.draft.notifications },
      timelineSummary: buildEmptyTimelineSummary(scheduleId),
      createdAt: now,
      updatedAt: now,
    };

    getTenantSchedules(tenantId).set(schedule.id, schedule);
    return {
      schedule,
      preview: plan.preview,
    };
  },

  getRunTimelineSummary(tenantId: string, scheduleId: string): AgentRunTimelineSummary | null {
    const schedule = getTenantSchedules(tenantId).get(scheduleId);
    return schedule ? schedule.timelineSummary : null;
  },

  getNotificationPreferences(tenantId: string): AgentScheduleNotificationPreferencesEnvelope {
    return getDefaultTenantPreferences(tenantId);
  },

  updateNotificationPreferences(
    tenantId: string,
    updates: Partial<AgentScheduleNotificationPreferences>
  ): AgentScheduleNotificationPreferencesEnvelope {
    const current = getDefaultTenantPreferences(tenantId);
    const merged = clonePreferences(tenantId, {
      ...current.preferences,
      ...updates,
    });
    notificationPreferencesByTenant.set(tenantId, merged);
    return clonePreferences(tenantId, merged.preferences);
  },
};
