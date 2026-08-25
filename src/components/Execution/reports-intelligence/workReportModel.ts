export type WorkItemKind = 'TASK' | 'DECISION' | 'MILESTONE';

export interface WorkReportItem {
  id: string;
  executionCaseId: string;
  initiativeId: string;
  title: string;
  kind: WorkItemKind;
  status: string;
  ownerId: string | null;
  dueAt: string | null;
  slaAt: string | null;
  dependencies: unknown[];
  evidenceRefs: unknown[];
  definitionOfDone: string | null;
  sourceVersion: number | null;
}

export type MetricValue =
  | { kind: 'CALCULATED'; value: number; numerator: number; denominator: number }
  | { kind: 'UNKNOWN'; reason: string };

export interface WorkMetric {
  id: string;
  value: MetricValue;
  drilldown: WorkReportItem[];
  severity: 'neutral' | 'amber' | 'red' | 'unknown';
}

export interface WorkReportModel {
  stateDate: string;
  calculatedAt: string;
  items: WorkReportItem[];
  metrics: WorkMetric[];
  buckets: Record<string, WorkReportItem[]>;
}

const CLOSED = new Set(['COMPLETED', 'DONE', 'DECIDED', 'APPROVED', 'CANCELED', 'CANCELLED']);

const open = (item: WorkReportItem) => !CLOSED.has(item.status.toUpperCase());
const time = (value: string | null) => (value ? Date.parse(value) : Number.NaN);

export function buildWorkReportModel(
  items: WorkReportItem[],
  stateDateInput: Date
): WorkReportModel {
  const stateDate = new Date(stateDateInput);
  stateDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(stateDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const day = 86_400_000;
  const openItems = items.filter(open);
  const overdue = openItems.filter(
    (item) => Number.isFinite(time(item.dueAt)) && time(item.dueAt) < stateDate.getTime()
  );
  const dueToday = openItems.filter(
    (item) =>
      Number.isFinite(time(item.dueAt)) &&
      time(item.dueAt) >= stateDate.getTime() &&
      time(item.dueAt) < nextDay.getTime()
  );
  const undated = openItems.filter((item) => !Number.isFinite(time(item.dueAt)));
  const blocked = openItems.filter((item) => item.status.toUpperCase() === 'BLOCKED');
  const dueIn = (from: number, to: number | null) =>
    openItems.filter((item) => {
      const due = time(item.dueAt);
      if (!Number.isFinite(due)) return false;
      const days = Math.ceil((due - stateDate.getTime()) / day);
      return days >= from && (to === null || days <= to);
    });
  const completenessChecks = (item: WorkReportItem) => [
    Boolean(item.ownerId),
    Boolean(item.dueAt),
    item.kind !== 'DECISION' || Boolean(item.slaAt),
    Boolean(item.initiativeId),
    Array.isArray(item.dependencies),
    Boolean(item.definitionOfDone),
    item.evidenceRefs.length > 0,
  ];
  const applicable = items.flatMap(completenessChecks);
  const complete = applicable.filter(Boolean).length;

  const calculated = (
    id: string,
    drilldown: WorkReportItem[],
    denominator = openItems.length,
    severity: WorkMetric['severity'] = 'neutral'
  ): WorkMetric => ({
    id,
    value: {
      kind: 'CALCULATED',
      value: drilldown.length,
      numerator: drilldown.length,
      denominator,
    },
    drilldown,
    severity,
  });

  return {
    stateDate: stateDate.toISOString(),
    calculatedAt: stateDateInput.toISOString(),
    items,
    metrics: [
      calculated(
        'overdueTasks',
        overdue.filter((item) => item.kind === 'TASK'),
        openItems.length,
        'red'
      ),
      calculated(
        'overdueDecisions',
        overdue.filter((item) => item.kind === 'DECISION'),
        openItems.length,
        'red'
      ),
      calculated('dueToday', dueToday, openItems.length, dueToday.length ? 'amber' : 'neutral'),
      calculated('due7', dueIn(1, 7), openItems.length, 'amber'),
      calculated('activeBlocks', blocked, openItems.length, blocked.length ? 'red' : 'neutral'),
      calculated('undatedRisk', undated, openItems.length, undated.length ? 'amber' : 'neutral'),
      {
        id: 'decisionLatency',
        value: { kind: 'UNKNOWN', reason: 'BRAK_API_HISTORY' },
        drilldown: [],
        severity: 'unknown',
      },
      {
        id: 'dataCompleteness',
        value: {
          kind: 'CALCULATED',
          value: complete,
          numerator: complete,
          denominator: applicable.length,
        },
        drilldown: items,
        severity: complete === applicable.length ? 'neutral' : 'amber',
      },
    ],
    buckets: {
      '1_7': dueIn(1, 7),
      '8_14': dueIn(8, 14),
      '15_30': dueIn(15, 30),
      '31_90': dueIn(31, 90),
      over90: dueIn(91, null),
      noDue: undated,
    },
  };
}
