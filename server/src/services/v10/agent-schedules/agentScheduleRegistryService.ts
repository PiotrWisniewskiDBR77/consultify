import { randomUUID } from 'node:crypto';

import { unsafeActorId, unsafeTenantId } from '../../../models/agent/ExecutionProposalV1.js';
import { unsafeRunId } from '../../../models/agent/RunLedger.js';
import { agentRuntimeService } from '../agent/agentRuntimeService.js';
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

function severityFromApprovalMode(
  mode: AgentScheduleDraftInput['approvalMode']
): 'S0' | 'S1' | 'S2' | 'S3' | 'S4' {
  switch (mode) {
    case 'admin_only':
      return 'S4';
    case 'multi_reviewer':
      return 'S3';
    case 'explicit_form':
      return 'S2';
    case 'inline':
      return 'S1';
    case 'implicit':
    default:
      return 'S0';
  }
}

function autonomyRank(level: string | null | undefined): number {
  switch (
    String(level || '')
      .trim()
      .toUpperCase()
  ) {
    case 'AUTONOMOUS':
      return 4;
    case 'SUPERVISED':
      return 3;
    case 'ASSISTED':
      return 2;
    case 'SUGGEST_ONLY':
    default:
      return 1;
  }
}

function severityRank(severity: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): number {
  switch (severity) {
    case 'S4':
      return 4;
    case 'S3':
      return 3;
    case 'S2':
      return 2;
    case 'S1':
      return 1;
    case 'S0':
    default:
      return 0;
  }
}

async function buildTimelineSummary(
  tenantId: string,
  scheduleId: string
): Promise<AgentRunTimelineSummary> {
  const result = await agentRuntimeService.queryRunLedger({
    query: {
      tenantId: unsafeTenantId(tenantId),
      correlationId: scheduleId,
      origin: 'scheduled_agent',
      runType: 'schedule_execution',
      limit: 20,
    },
  });
  if (!result.runs.length) {
    return buildEmptyTimelineSummary(scheduleId);
  }

  const latest = result.runs[0];
  const totals = { ...DEFAULT_AGENT_RUN_TIMELINE_TOTALS };
  for (const run of result.runs) {
    totals[run.status] = (totals[run.status] ?? 0) + 1;
  }

  return {
    scheduleId,
    latestStatus: latest.status,
    activeRunId:
      result.runs.find((run) => run.status === 'running' || run.status === 'paused')?.id || null,
    queuedCount: result.runs.filter((run) => run.status === 'pending').length,
    totals,
    entries: result.runs.map((run) => ({
      runId: String(run.id),
      status: run.status,
      startedAt: run.startedAt || new Date().toISOString(),
      finishedAt: run.finishedAt,
      durationMs:
        run.startedAt && run.finishedAt
          ? Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt))
          : null,
      note: `${run.origin || 'scheduled_agent'} · ${run.approvalState || 'n/a'}`,
      isLongRunning: run.status === 'running' || run.status === 'paused',
    })),
  };
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
  async listSchedules(tenantId: string): Promise<AgentScheduleListItem[]> {
    const schedules = [...getTenantSchedules(tenantId).values()].sort((left, right) =>
      left.nextRunAt.localeCompare(right.nextRunAt)
    );
    return Promise.all(
      schedules.map(async (schedule) => ({
        ...schedule,
        timelineSummary: await buildTimelineSummary(tenantId, schedule.id),
      }))
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

  async createSchedule(
    tenantId: string,
    draft: AgentScheduleDraftInput
  ): Promise<AgentScheduleCreateResponse> {
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
      lastRunId: null,
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
      schedule: {
        ...schedule,
        timelineSummary: await buildTimelineSummary(tenantId, schedule.id),
      },
      preview: plan.preview,
    };
  },

  async getRunTimelineSummary(
    tenantId: string,
    scheduleId: string
  ): Promise<AgentRunTimelineSummary | null> {
    const schedule = getTenantSchedules(tenantId).get(scheduleId);
    return schedule ? buildTimelineSummary(tenantId, scheduleId) : null;
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

  async triggerSchedule(
    tenantId: string,
    scheduleId: string,
    args?: { requestedBy?: string | null; autonomyLevel?: string | null }
  ): Promise<{
    runId: string;
    gateDecision: 'approved' | 'rejected' | 'requires_approval';
    timeline: AgentRunTimelineSummary;
  }> {
    const schedule = getTenantSchedules(tenantId).get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }
    if (schedule.registryStatus !== 'active') {
      throw new Error('Schedule is not active');
    }

    const now = new Date().toISOString();
    const runId = `agent-run-${randomUUID()}`;
    const severity = severityFromApprovalMode(schedule.approvalMode);
    const allowedAutonomy = autonomyRank(args?.autonomyLevel) > severityRank(severity);
    const effectiveApprovalMode =
      allowedAutonomy || schedule.approvalMode !== 'implicit' ? schedule.approvalMode : 'inline';
    const autoApprove = effectiveApprovalMode === 'implicit' && allowedAutonomy;
    const proposal = {
      id: `proposal-${runId}`,
      tenantId: unsafeTenantId(tenantId),
      correlationId: scheduleId,
      severity,
      approvalMode: effectiveApprovalMode,
      ops: [
        {
          kind: 'schedule_trigger',
          target: { kind: 'schedule', id: scheduleId },
          payload: {
            scheduleId,
            agentDefinitionRef: schedule.agentDefinitionRef,
          },
        },
      ],
      proposedBy: unsafeActorId(String(args?.requestedBy || `schedule:${scheduleId}`)),
    };
    const evaluation = await agentRuntimeService.evaluateExecutionProposal({
      pipelineRunId: `schedule-pipeline:${scheduleId}:${Date.now()}`,
      runId,
      proposal,
      operatorApproved: autoApprove ? true : undefined,
      now,
      persistRun: true,
    });

    if (evaluation.pipeline.gateDecision === 'requires_approval') {
      await agentRuntimeService.planApprovalBarrier({
        proposal,
        runId,
        emittedAt: now,
      });
      await agentRuntimeService.appendRunLedger({
        event: {
          tenantId: unsafeTenantId(tenantId),
          runId: unsafeRunId(runId),
          category: 'custom',
          recordedAt: now,
          actorId: String(args?.requestedBy || `schedule:${scheduleId}`),
          payload: {
            subtype: allowedAutonomy ? 'schedule_awaiting_approval' : 'schedule_autonomy_blocked',
            origin: 'scheduled_agent',
            runType: 'schedule_execution',
            conversationId: null,
            approvalState: allowedAutonomy ? 'awaiting_approval' : 'autonomy_blocked',
            latestBarrierState: allowedAutonomy ? 'barrier_planned' : 'autonomy_guardrail',
          },
        },
      });
    } else if (evaluation.pipeline.gateDecision === 'approved') {
      await agentRuntimeService.appendRunLedger({
        run: {
          id: unsafeRunId(runId),
          tenantId: unsafeTenantId(tenantId),
          correlationId: scheduleId,
          conversationId: null,
          origin: 'scheduled_agent',
          runType: 'schedule_execution',
          approvalState: 'approved',
          latestBarrierState: 'schedule_started',
          latestInterruptState: null,
          status: 'succeeded',
          severity,
          startedAt: now,
          finishedAt: now,
          budgetUsed: {
            wallMs: 0,
            costCents: 0,
            toolCalls: 1,
            tokens: 0,
          },
        },
        event: {
          tenantId: unsafeTenantId(tenantId),
          runId: unsafeRunId(runId),
          category: 'custom',
          recordedAt: now,
          actorId: String(args?.requestedBy || `schedule:${scheduleId}`),
          payload: {
            subtype: 'schedule_execution_completed',
            origin: 'scheduled_agent',
            runType: 'schedule_execution',
            approvalState: 'approved',
            latestBarrierState: 'schedule_completed',
          },
        },
      });
    }

    const nextSchedule: AgentScheduleListItem = {
      ...schedule,
      lastRunAt: now,
      lastRunId: runId,
      updatedAt: now,
      timelineSummary: await buildTimelineSummary(tenantId, scheduleId),
    };
    getTenantSchedules(tenantId).set(scheduleId, nextSchedule);

    return {
      runId,
      gateDecision: evaluation.pipeline.gateDecision,
      timeline: nextSchedule.timelineSummary,
    };
  },
};
