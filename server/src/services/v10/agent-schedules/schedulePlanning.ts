import type {
  AgentScheduleDraftInput,
  AgentScheduleNormalizedDraft,
  AgentSchedulePlanResponse,
  AgentSchedulePreview,
  AgentScheduleTriggerDecision,
} from './types.js';
import {
  DEFAULT_AGENT_SCHEDULE_APPROVAL_MODE,
  DEFAULT_AGENT_SCHEDULE_BUDGET,
  DEFAULT_AGENT_SCHEDULE_NOTIFICATION_PREFERENCES,
} from './types.js';

const INTERVAL_UNIT_MS = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type ParsedSchedule =
  | {
      readonly kind: 'cron';
      readonly fields: readonly [string, string, string, string, string];
    }
  | {
      readonly kind: 'interval';
      readonly amount: number;
      readonly unit: keyof typeof INTERVAL_UNIT_MS;
      readonly intervalMs: number;
    };

function assertNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must be non-empty`);
  }
  return trimmed;
}

function validateBudget(draft: AgentScheduleDraftInput): AgentScheduleNormalizedDraft['budget'] {
  const budget = draft.budget ?? DEFAULT_AGENT_SCHEDULE_BUDGET;
  const values = Object.entries(budget);
  for (const [key, value] of values) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`budget.${key} must be a finite positive number`);
    }
  }
  return budget;
}

function validateCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  if (/^\*\/[0-9]+$/.test(field)) {
    const step = Number(field.slice(2));
    return Number.isInteger(step) && step >= 1 && step <= max;
  }

  const parts = field.split(',');
  for (const part of parts) {
    if (/^[0-9]+$/.test(part)) {
      const value = Number(part);
      if (value < min || value > max) return false;
      continue;
    }

    const range = /^([0-9]+)-([0-9]+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < min || end > max || start > end) return false;
      continue;
    }

    return false;
  }

  return true;
}

function parseCronOrInterval(expression: string): ParsedSchedule {
  const trimmed = assertNonEmpty(expression, 'cronOrInterval');
  const intervalMatch = /^every\s+([0-9]+)\s*([smhd])$/i.exec(trimmed);
  if (intervalMatch) {
    const amount = Number(intervalMatch[1]);
    const unit = intervalMatch[2].toLowerCase() as keyof typeof INTERVAL_UNIT_MS;
    const intervalMs = amount * INTERVAL_UNIT_MS[unit];
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('interval amount must be a positive integer');
    }
    if (intervalMs < 5 * 60_000) {
      throw new Error('interval must be at least 5 minutes');
    }
    return { kind: 'interval', amount, unit, intervalMs };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("cron expression must have 5 fields or match 'every <N><unit>'");
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const isValid =
    validateCronField(minute, 0, 59) &&
    validateCronField(hour, 0, 23) &&
    validateCronField(dayOfMonth, 1, 31) &&
    validateCronField(month, 1, 12) &&
    validateCronField(dayOfWeek, 0, 6);

  if (!isValid) {
    throw new Error('cron expression contains an invalid field');
  }

  return { kind: 'cron', fields: [minute, hour, dayOfMonth, month, dayOfWeek] };
}

function matchesCronField(expression: string, value: number): boolean {
  if (expression === '*') return true;

  if (expression.startsWith('*/')) {
    const step = Number(expression.slice(2));
    return value % step === 0;
  }

  if (expression.includes(',')) {
    return expression.split(',').some((segment) => matchesCronField(segment, value));
  }

  if (expression.includes('-')) {
    const [start, end] = expression.split('-').map(Number);
    return value >= start && value <= end;
  }

  return Number(expression) === value;
}

function getDatePartsInTimezone(
  date: Date,
  timezone: string
): { minute: number; hour: number; day: number; month: number; dow: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    minute: Number(read('minute')),
    hour: Number(read('hour')) % 24,
    day: Number(read('day')),
    month: Number(read('month')),
    dow: dowMap[read('weekday')] ?? 0,
  };
}

function describeCron(
  fields: readonly [string, string, string, string, string],
  timezone: string
): string {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const parts: string[] = [];

  if (minute === '0' && hour !== '*') {
    parts.push(`At ${hour}:00`);
  } else if (minute.startsWith('*/')) {
    parts.push(`Every ${minute.slice(2)} minutes`);
  } else if (minute === '*') {
    parts.push('Every minute');
  } else {
    parts.push(`At minute ${minute}`);
  }

  if (hour !== '*' && !(minute === '0' && hour !== '*')) {
    parts.push(`past hour ${hour}`);
  }

  if (dayOfWeek !== '*') {
    parts.push(`on weekday ${dayOfWeek}`);
  }

  if (dayOfMonth !== '*') {
    parts.push(`on day ${dayOfMonth}`);
  }

  if (month !== '*') {
    parts.push(`in month ${month}`);
  }

  parts.push(`(${timezone})`);
  return parts.join(' ');
}

function computeNextCronRun(
  fields: readonly [string, string, string, string, string],
  timezone: string,
  after: Date
): Date {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 14; i++) {
    const parts = getDatePartsInTimezone(candidate, timezone);
    if (
      matchesCronField(minute, parts.minute) &&
      matchesCronField(hour, parts.hour) &&
      matchesCronField(dayOfMonth, parts.day) &&
      matchesCronField(month, parts.month) &&
      matchesCronField(dayOfWeek, parts.dow)
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error('could not compute the next cron run inside a 14-day search window');
}

function computeProjectedRunTimes(
  parsed: ParsedSchedule,
  timezone: string,
  count = 3
): readonly string[] {
  const projected: string[] = [];
  let cursor = new Date();

  for (let i = 0; i < count; i++) {
    if (parsed.kind === 'interval') {
      cursor = new Date(cursor.getTime() + parsed.intervalMs);
      projected.push(cursor.toISOString());
      continue;
    }

    cursor = computeNextCronRun(parsed.fields, timezone, cursor);
    projected.push(cursor.toISOString());
  }

  return projected;
}

function describeParsedSchedule(parsed: ParsedSchedule, timezone: string): string {
  if (parsed.kind === 'interval') {
    return `Every ${parsed.amount}${parsed.unit} (${timezone})`;
  }

  return describeCron(parsed.fields, timezone);
}

function normalizeTriggerDecision(
  overlapPolicy: AgentScheduleNormalizedDraft['overlapPolicy']
): AgentScheduleTriggerDecision {
  if (overlapPolicy === 'parallel') return 'start';
  if (overlapPolicy === 'skip') return 'skip';
  return 'queue';
}

export function normalizeDraft(
  draft: AgentScheduleDraftInput,
  tenantId: string
): AgentScheduleNormalizedDraft {
  const retentionDays = Number(draft.retentionDays);
  if (!Number.isInteger(retentionDays) || retentionDays <= 0 || retentionDays > 365) {
    throw new Error('retentionDays must be an integer between 1 and 365');
  }

  const overlapPolicy = draft.overlapPolicy;
  if (!['skip', 'queue', 'parallel'].includes(overlapPolicy)) {
    throw new Error('overlapPolicy must be one of skip, queue, or parallel');
  }

  return {
    tenantId,
    displayName: assertNonEmpty(draft.displayName, 'displayName'),
    description: draft.description?.trim() ? draft.description.trim() : null,
    agentDefinitionRef: assertNonEmpty(draft.agentDefinitionRef, 'agentDefinitionRef'),
    cronOrInterval: assertNonEmpty(draft.cronOrInterval, 'cronOrInterval'),
    overlapPolicy,
    retentionDays,
    timezone: draft.timezone?.trim() || 'UTC',
    approvalMode: draft.approvalMode ?? DEFAULT_AGENT_SCHEDULE_APPROVAL_MODE,
    budget: validateBudget(draft),
    notifications: {
      ...DEFAULT_AGENT_SCHEDULE_NOTIFICATION_PREFERENCES,
      ...(draft.notifications ?? {}),
    },
  };
}

export function buildSchedulePreview(draft: AgentScheduleNormalizedDraft): AgentSchedulePreview {
  const parsed = parseCronOrInterval(draft.cronOrInterval);
  const projectedRunTimes = computeProjectedRunTimes(parsed, draft.timezone);

  return {
    expressionKind: parsed.kind,
    description: describeParsedSchedule(parsed, draft.timezone),
    nextRunAt: projectedRunTimes[0] ?? new Date().toISOString(),
    projectedRunTimes,
    overlapDecisionIfRunning: normalizeTriggerDecision(draft.overlapPolicy),
    warnings:
      draft.notifications.emailEnabled && !draft.notifications.notifyOnFailure
        ? ['Email alerts are enabled, but failure notifications are turned off.']
        : [],
  };
}

export function buildSchedulePlan(
  draft: AgentScheduleDraftInput,
  tenantId: string
): AgentSchedulePlanResponse {
  const normalizedDraft = normalizeDraft(draft, tenantId);
  return {
    draft: normalizedDraft,
    preview: buildSchedulePreview(normalizedDraft),
  };
}
