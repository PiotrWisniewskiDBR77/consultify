import type { WorkReportItem } from './workReportModel';

export type WorkAnalysisPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type WorkAttentionReason = 'BLOCKED' | 'OVERDUE' | 'UNASSIGNED' | 'NO_DUE_DATE';

export interface ExecutionWorkAnalysisItem extends WorkReportItem {
  projectId: string | null;
  projectTitle: string | null;
  priority: string | null;
  completedAt: string | null;
}

export interface WorkAnalysisWindow {
  start: string;
  end: string;
  items: ExecutionWorkAnalysisItem[];
  completed: { numerator: number; denominator: number };
}

export interface ExecutionWorkAnalysis {
  asOf: string;
  windows: {
    previousWeek: WorkAnalysisWindow;
    nextWeek: WorkAnalysisWindow;
    nextMonth: WorkAnalysisWindow;
  };
  byProject: Array<{
    projectId: string | null;
    projectTitle: string | null;
    items: ExecutionWorkAnalysisItem[];
  }>;
  byPriority: Record<WorkAnalysisPriority, ExecutionWorkAnalysisItem[]>;
  attention: Array<{ item: ExecutionWorkAnalysisItem; reasons: WorkAttentionReason[] }>;
}

const DAY = 86_400_000;
const CLOSED = new Set(['COMPLETED', 'DONE', 'DECIDED', 'APPROVED', 'CANCELED', 'CANCELLED']);
const PRIORITIES: WorkAnalysisPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

const timestamp = (value: string | null): number => (value ? Date.parse(value) : Number.NaN);
const isClosed = (item: ExecutionWorkAnalysisItem): boolean =>
  CLOSED.has(String(item.status || '').toUpperCase());

function mondayUtc(input: Date): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function inRange(value: number, start: number, end: number): boolean {
  return Number.isFinite(value) && value >= start && value < end;
}

function buildWindow(
  items: ExecutionWorkAnalysisItem[],
  start: number,
  end: number,
  previous: boolean
): WorkAnalysisWindow {
  const selected = items.filter((item) => {
    const relevant =
      previous && isClosed(item) && item.completedAt
        ? timestamp(item.completedAt)
        : timestamp(item.dueAt);
    return inRange(relevant, start, end);
  });
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    items: selected,
    completed: {
      numerator: selected.filter(isClosed).length,
      denominator: selected.length,
    },
  };
}

function priorityOf(item: ExecutionWorkAnalysisItem): WorkAnalysisPriority {
  const candidate = String(item.priority || '').toUpperCase();
  return PRIORITIES.includes(candidate as WorkAnalysisPriority)
    ? (candidate as WorkAnalysisPriority)
    : 'UNKNOWN';
}

export function buildExecutionWorkAnalysis(
  items: ExecutionWorkAnalysisItem[],
  selectedWeek: Date
): ExecutionWorkAnalysis {
  const weekStart = mondayUtc(selectedWeek).getTime();
  const previousStart = weekStart - 7 * DAY;
  const nextWeekEnd = weekStart + 7 * DAY;
  const nextMonthEnd = weekStart + 30 * DAY;

  const projects = new Map<string, ExecutionWorkAnalysisItem[]>();
  for (const item of items) {
    const key = item.projectId || '';
    const bucket = projects.get(key) ?? [];
    bucket.push(item);
    projects.set(key, bucket);
  }

  const byPriority = Object.fromEntries(
    PRIORITIES.map((priority) => [priority, [] as ExecutionWorkAnalysisItem[]])
  ) as Record<WorkAnalysisPriority, ExecutionWorkAnalysisItem[]>;
  for (const item of items) byPriority[priorityOf(item)].push(item);

  const attention = items.flatMap((item) => {
    if (isClosed(item)) return [];
    const reasons: WorkAttentionReason[] = [];
    if (String(item.status || '').toUpperCase() === 'BLOCKED') reasons.push('BLOCKED');
    const due = timestamp(item.dueAt);
    if (Number.isFinite(due) && due < weekStart) reasons.push('OVERDUE');
    if (!item.ownerId) reasons.push('UNASSIGNED');
    if (!Number.isFinite(due)) reasons.push('NO_DUE_DATE');
    return reasons.length ? [{ item, reasons }] : [];
  });

  return {
    asOf: new Date(weekStart).toISOString(),
    windows: {
      previousWeek: buildWindow(items, previousStart, weekStart, true),
      nextWeek: buildWindow(items, weekStart, nextWeekEnd, false),
      nextMonth: buildWindow(items, weekStart, nextMonthEnd, false),
    },
    byProject: [...projects.entries()]
      .map(([projectId, projectItems]) => ({
        projectId: projectId || null,
        projectTitle: projectItems[0]?.projectTitle ?? null,
        items: projectItems,
      }))
      .sort((left, right) => {
        if (left.projectId === null) return -1;
        if (right.projectId === null) return 1;
        return String(left.projectTitle || left.projectId).localeCompare(
          String(right.projectTitle || right.projectId)
        );
      }),
    byPriority,
    attention,
  };
}
