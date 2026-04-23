export type AgentRuntimeApprovalMode =
  | 'implicit'
  | 'inline'
  | 'explicit_form'
  | 'multi_reviewer'
  | 'admin_only';

export type AgentRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type AgentScheduleOverlapPolicy = 'skip' | 'queue' | 'parallel';
export type AgentScheduleDigestMode = 'immediate' | 'hourly' | 'daily';

export interface AgentScheduleBudgetV1 {
  readonly wallClockMaxMs: number;
  readonly costUsdCap: number;
  readonly toolCallCap: number;
  readonly tokenCap: number;
}

export interface AgentScheduleNotificationPreferences {
  readonly inAppEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly notifyOnSuccess: boolean;
  readonly notifyOnFailure: boolean;
  readonly notifyOnQueued: boolean;
  readonly digestMode: AgentScheduleDigestMode;
  readonly quietHoursStart: string | null;
  readonly quietHoursEnd: string | null;
}

export interface AgentScheduleDraftInput {
  readonly tenantId?: string;
  readonly displayName: string;
  readonly description?: string;
  readonly agentDefinitionRef: string;
  readonly cronOrInterval: string;
  readonly overlapPolicy: AgentScheduleOverlapPolicy;
  readonly retentionDays: number;
  readonly timezone?: string;
  readonly approvalMode?: AgentRuntimeApprovalMode;
  readonly budget?: AgentScheduleBudgetV1;
  readonly notifications?: Partial<AgentScheduleNotificationPreferences>;
}

export interface AgentSchedulePreview {
  readonly expressionKind: 'cron' | 'interval';
  readonly description: string;
  readonly nextRunAt: string;
  readonly projectedRunTimes: readonly string[];
  readonly overlapDecisionIfRunning: 'start' | 'skip' | 'queue';
  readonly warnings: readonly string[];
}

export interface AgentSchedulePlanResponse {
  readonly draft: Required<Omit<AgentScheduleDraftInput, 'notifications' | 'budget'>> & {
    readonly notifications: AgentScheduleNotificationPreferences;
    readonly budget: AgentScheduleBudgetV1;
  };
  readonly preview: AgentSchedulePreview;
}

export interface AgentRunTimelineEntry {
  readonly runId: string;
  readonly status: AgentRunStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly note: string;
  readonly isLongRunning: boolean;
}

export interface AgentRunTimelineSummary {
  readonly scheduleId: string;
  readonly latestStatus: AgentRunStatus | null;
  readonly activeRunId: string | null;
  readonly queuedCount: number;
  readonly totals: Readonly<Record<AgentRunStatus, number>>;
  readonly entries: readonly AgentRunTimelineEntry[];
}

export interface AgentScheduleListItem {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly agentDefinitionRef: string;
  readonly cronOrInterval: string;
  readonly overlapPolicy: AgentScheduleOverlapPolicy;
  readonly retentionDays: number;
  readonly timezone: string;
  readonly nextRunAt: string;
  readonly lastRunAt: string | null;
  readonly lastRunId?: string | null;
  readonly registryStatus: 'active' | 'paused';
  readonly approvalMode: AgentRuntimeApprovalMode;
  readonly budget: AgentScheduleBudgetV1;
  readonly notifications: AgentScheduleNotificationPreferences;
  readonly timelineSummary: AgentRunTimelineSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AgentScheduleCreateResponse {
  readonly schedule: AgentScheduleListItem;
  readonly preview: AgentSchedulePreview;
}

export interface AgentScheduleNotificationPreferencesEnvelope {
  readonly tenantId: string;
  readonly preferences: AgentScheduleNotificationPreferences;
  readonly updatedAt: string;
}

export function buildDefaultAgentScheduleDraft(args?: {
  tenantId?: string;
  notifications?: Partial<AgentScheduleNotificationPreferences>;
}): AgentScheduleDraftInput {
  return {
    tenantId: args?.tenantId,
    displayName: '',
    description: '',
    agentDefinitionRef: '',
    cronOrInterval: '',
    overlapPolicy: 'skip',
    retentionDays: 30,
    timezone: 'Europe/Warsaw',
    approvalMode: 'inline',
    budget: {
      wallClockMaxMs: 60_000,
      costUsdCap: 1,
      toolCallCap: 20,
      tokenCap: 60_000,
    },
    notifications: {
      inAppEnabled: true,
      emailEnabled: false,
      notifyOnSuccess: false,
      notifyOnFailure: true,
      notifyOnQueued: true,
      digestMode: 'immediate',
      quietHoursStart: null,
      quietHoursEnd: null,
      ...(args?.notifications ?? {}),
    },
  };
}

export function formatRunStatusLabel(status: AgentRunStatus | null | undefined): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused';
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'No runs yet';
  }
}
