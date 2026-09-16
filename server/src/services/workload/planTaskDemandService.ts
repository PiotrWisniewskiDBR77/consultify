import DbPromise from '../../utils/DbPromise.js';

const CLOSED_STATUSES = "('done','completed','validated','cancelled')";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlanDemandPeriod {
  periodId: string;
  /** Inclusive date or timestamp. */
  start: string;
  /** Date-only/midnight is exclusive; an end-of-day timestamp includes that day. */
  end: string;
}

export interface PlanTaskDemandRow {
  taskId: string;
  userId: string | null;
  roleLabel: string | null;
  estimatedHours: number | string | null;
  startedAt: string | Date | null;
  createdAt: string | Date | null;
  dueDate: string | Date | null;
}

export type IncompleteTaskReason =
  'MISSING_ASSIGNEE' | 'MISSING_ROLE' | 'MISSING_ESTIMATE' | 'MISSING_DUE_DATE';

export interface PlanTaskDemandContribution {
  taskId: string;
  userId: string | null;
  hours: number | null;
  startSource: 'started_at' | 'created_at' | 'due_date' | null;
  incompleteReasons: IncompleteTaskReason[];
}

export interface PlanTaskDemandCell {
  periodId: string;
  roleId: string;
  roleLabel: string;
  /** Null means at least one contributing task cannot be quantified. */
  demandHours: number | null;
  knowledgeState: 'KNOWN' | 'UNKNOWN';
  contributions: PlanTaskDemandContribution[];
}

export interface PlanTaskDemandResult {
  asOf: string;
  initiativeIds: string[];
  periods: PlanDemandPeriod[];
  cells: PlanTaskDemandCell[];
  incompleteTasks: Array<{
    taskId: string;
    reasons: IncompleteTaskReason[];
  }>;
  knowledgeState: 'KNOWN' | 'UNKNOWN';
}

interface NormalizedPeriod extends PlanDemandPeriod {
  startDay: number;
  endDayExclusive: number;
}

function dateDay(value: string | Date | null): number | null {
  if (!value) return null;
  const text =
    value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
          value.getDate()
        ).padStart(2, '0')}`
      : String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(timestamp).toISOString().slice(0, 10) !== normalized) return null;
  const day = timestamp / DAY_MS;
  return Number.isFinite(day) ? day : null;
}

function periodEndExclusiveDay(value: string | Date): number | null {
  const day = dateDay(value);
  if (day === null) return null;
  if (value instanceof Date) {
    return value.getHours() || value.getMinutes() || value.getSeconds() || value.getMilliseconds()
      ? day + 1
      : day;
  }
  const time = /T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/.exec(String(value));
  if (!time) return day;
  return time.slice(1).some((part) => Number(part || 0) !== 0) ? day + 1 : day;
}

function roleSlug(label: string): string {
  const ascii = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
  return (
    ascii
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bez-stanowiska'
  );
}

function workingDays(startDay: number, endDayInclusive: number): number {
  if (endDayInclusive < startDay) return 0;
  let count = 0;
  for (let day = startDay; day <= endDayInclusive && day - startDay <= 20_000; day += 1) {
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

function normalizePeriods(periods: PlanDemandPeriod[]): NormalizedPeriod[] {
  const seen = new Set<string>();
  const normalized = periods.map((period) => {
    const periodId = String(period.periodId || '').trim();
    const startDay = dateDay(period.start);
    const endDayExclusive = periodEndExclusiveDay(period.end);
    if (!periodId || seen.has(periodId)) throw new Error('M1_PERIOD_ID_INVALID');
    seen.add(periodId);
    if (startDay === null || endDayExclusive === null || endDayExclusive <= startDay)
      throw new Error('M1_PERIOD_RANGE_INVALID');
    return { ...period, periodId, startDay, endDayExclusive };
  });
  const ordered = [...normalized].sort(
    (a, b) => a.startDay - b.startDay || a.endDayExclusive - b.endDayExclusive
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startDay < ordered[index - 1].endDayExclusive)
      throw new Error(
        `M1_PERIODS_OVERLAP:${ordered[index - 1].periodId}:${ordered[index].periodId}`
      );
  }
  return normalized;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Pure M1a calculation. Hours are spread over working days in the task window,
 * then intersected with the explicit half-open plan periods. Every number keeps
 * its task-level provenance. Missing data remains UNKNOWN and never becomes 0.
 */
export function calculatePlanTaskDemand(
  rows: PlanTaskDemandRow[],
  periods: PlanDemandPeriod[],
  options: { asOf?: string; initiativeIds?: string[] } = {}
): PlanTaskDemandResult {
  const normalizedPeriods = normalizePeriods(periods);
  const cells = new Map<string, PlanTaskDemandCell & { knownHours: number; hasUnknown: boolean }>();
  const incompleteTasks = new Map<string, Set<IncompleteTaskReason>>();

  const addIncomplete = (taskId: string, reasons: IncompleteTaskReason[]) => {
    if (!reasons.length) return;
    const current = incompleteTasks.get(taskId) ?? new Set<IncompleteTaskReason>();
    for (const reason of reasons) current.add(reason);
    incompleteTasks.set(taskId, current);
  };

  for (const row of rows) {
    const taskId = String(row.taskId);
    const roleLabel = String(row.roleLabel || '').trim() || 'Bez stanowiska';
    const roleId = roleSlug(roleLabel);
    const estimate = Number(row.estimatedHours);
    const dueDay = dateDay(row.dueDate);
    const startedDay = dateDay(row.startedAt);
    const createdDay = dateDay(row.createdAt);
    const startDay = startedDay ?? createdDay ?? dueDay;
    const startSource: PlanTaskDemandContribution['startSource'] =
      startedDay !== null
        ? 'started_at'
        : createdDay !== null
          ? 'created_at'
          : dueDay !== null
            ? 'due_date'
            : null;
    const reasons: IncompleteTaskReason[] = [];
    if (!row.userId) reasons.push('MISSING_ASSIGNEE');
    if (!String(row.roleLabel || '').trim()) reasons.push('MISSING_ROLE');
    if (!Number.isFinite(estimate) || estimate <= 0) reasons.push('MISSING_ESTIMATE');
    if (dueDay === null) reasons.push('MISSING_DUE_DATE');
    addIncomplete(taskId, reasons);

    // A task without a due date cannot honestly be assigned to any period.
    if (dueDay === null || startDay === null) continue;
    const effectiveStart = Math.min(startDay, dueDay);
    const totalWorkingDays = workingDays(effectiveStart, dueDay);

    for (const period of normalizedPeriods) {
      const overlapStart = Math.max(effectiveStart, period.startDay);
      const overlapEnd = Math.min(dueDay, period.endDayExclusive - 1);
      if (overlapEnd < overlapStart) continue;
      const overlapWorkingDays = workingDays(overlapStart, overlapEnd);
      // Weekend-only tasks remain visible in the period containing their due date.
      const dueInside = dueDay >= period.startDay && dueDay < period.endDayExclusive;
      if (overlapWorkingDays === 0 && !(totalWorkingDays === 0 && dueInside)) continue;

      const key = `${period.periodId}|${roleId}`;
      const cell = cells.get(key) ?? {
        periodId: period.periodId,
        roleId,
        roleLabel,
        demandHours: 0,
        knowledgeState: 'KNOWN' as const,
        contributions: [],
        knownHours: 0,
        hasUnknown: false,
      };
      const quantifiable = reasons.every(
        (reason) =>
          reason !== 'MISSING_ESTIMATE' &&
          reason !== 'MISSING_ASSIGNEE' &&
          reason !== 'MISSING_ROLE'
      );
      const hours = quantifiable
        ? estimate * (totalWorkingDays === 0 ? 1 : overlapWorkingDays / totalWorkingDays)
        : null;
      if (hours === null) cell.hasUnknown = true;
      else cell.knownHours += hours;
      cell.contributions.push({
        taskId,
        userId: row.userId ? String(row.userId) : null,
        hours: hours === null ? null : round2(hours),
        startSource,
        incompleteReasons: reasons,
      });
      cells.set(key, cell);
    }
  }

  const outputCells: PlanTaskDemandCell[] = [...cells.values()]
    .map((cell) => ({
      periodId: cell.periodId,
      roleId: cell.roleId,
      roleLabel: cell.roleLabel,
      demandHours: cell.hasUnknown ? null : round2(cell.knownHours),
      knowledgeState: cell.hasUnknown ? ('UNKNOWN' as const) : ('KNOWN' as const),
      contributions: cell.contributions.sort((a, b) => a.taskId.localeCompare(b.taskId)),
    }))
    .sort((a, b) => a.periodId.localeCompare(b.periodId) || a.roleId.localeCompare(b.roleId));
  const incomplete = [...incompleteTasks.entries()]
    .map(([taskId, reasons]) => ({ taskId, reasons: [...reasons].sort() }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));

  return {
    asOf: options.asOf ?? new Date().toISOString(),
    initiativeIds: [...new Set(options.initiativeIds ?? [])].sort(),
    periods,
    cells: outputCells,
    incompleteTasks: incomplete,
    knowledgeState: incomplete.length ? 'UNKNOWN' : 'KNOWN',
  };
}

export async function readPlanTaskDemand(
  organizationId: string,
  initiativeIds: string[],
  periods: PlanDemandPeriod[],
  options: { asOf?: string } = {}
): Promise<PlanTaskDemandResult> {
  const scope = [...new Set(initiativeIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!organizationId.trim()) throw new Error('M1_ORGANIZATION_REQUIRED');
  if (!scope.length || scope.length > 100) throw new Error('M1_INITIATIVE_SCOPE_INVALID');
  if (!periods.length || periods.length > 104) throw new Error('M1_PERIOD_SCOPE_INVALID');

  const rows = await DbPromise.all<{
    task_id: string;
    user_id: string | null;
    role_label: string | null;
    estimated_hours: number | string | null;
    started_at: string | Date | null;
    created_at: string | Date | null;
    due_date: string | Date | null;
  }>(
    `SELECT t.id AS task_id, t.assignee_id AS user_id,
            COALESCE(NULLIF(TRIM(u.job_title), ''), NULLIF(TRIM(u.title), '')) AS role_label,
            t.estimated_hours, t.started_at, t.created_at, t.due_date
       FROM tasks t
       LEFT JOIN users u
         ON u.id=t.assignee_id AND u.organization_id=t.organization_id
      WHERE t.organization_id=?
        AND t.initiative_id IN (${scope.map(() => '?').join(',')})
        AND LOWER(COALESCE(t.status, '')) NOT IN ${CLOSED_STATUSES}
      ORDER BY t.id`,
    [organizationId, ...scope]
  );

  return calculatePlanTaskDemand(
    rows.map((row) => ({
      taskId: row.task_id,
      userId: row.user_id,
      roleLabel: row.role_label,
      estimatedHours: row.estimated_hours,
      startedAt: row.started_at,
      createdAt: row.created_at,
      dueDate: row.due_date,
    })),
    periods,
    { asOf: options.asOf, initiativeIds: scope }
  );
}
