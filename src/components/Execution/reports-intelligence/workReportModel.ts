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
const isTaskOrDecision = (item: WorkReportItem) => item.kind === 'TASK' || item.kind === 'DECISION';

// Per-record completeness: an item is complete only when EVERY applicable
// field check passes (logical AND), not when some fraction of individual
// field-checks across the whole population pass. `Array.isArray(dependencies)`
// is intentionally not one of the checks: `dependencies` is typed as an array
// on every WorkReportItem, so that check was always true and measured nothing.
const completenessChecks = (item: WorkReportItem): boolean[] => [
  Boolean(item.ownerId),
  Boolean(item.dueAt),
  item.kind !== 'DECISION' || Boolean(item.slaAt),
  Boolean(item.initiativeId),
  Boolean(item.definitionOfDone),
  item.evidenceRefs.length > 0,
];
const isRecordComplete = (item: WorkReportItem) => completenessChecks(item).every(Boolean);

export function buildWorkReportModel(
  items: WorkReportItem[],
  stateDateInput: Date
): WorkReportModel {
  const stateDate = new Date(stateDateInput);
  stateDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(stateDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const day = 86_400_000;

  // Executive Pulse KPIs and data completeness are contractually task/decision
  // KPIs (EXE-WORK-REPORT-01). MILESTONE records structurally cannot satisfy
  // fields such as slaAt/definitionOfDone/dependencies and must not be mixed
  // into these calculations, or they silently drag KPI/completeness numbers
  // down for a record type the KPI was never about. Milestones remain visible
  // in `items` (the audit register) and in the "what's approaching" buckets,
  // which are a distinct, all-kinds section of the contract.
  const kpiItems = items.filter(isTaskOrDecision);
  const kpiOpenItems = kpiItems.filter(open);
  const openTasks = kpiOpenItems.filter((item) => item.kind === 'TASK');
  const openDecisions = kpiOpenItems.filter((item) => item.kind === 'DECISION');

  const overdueKpi = kpiOpenItems.filter(
    (item) => Number.isFinite(time(item.dueAt)) && time(item.dueAt) < stateDate.getTime()
  );
  const dueTodayKpi = kpiOpenItems.filter(
    (item) =>
      Number.isFinite(time(item.dueAt)) &&
      time(item.dueAt) >= stateDate.getTime() &&
      time(item.dueAt) < nextDay.getTime()
  );
  const undatedKpi = kpiOpenItems.filter((item) => !Number.isFinite(time(item.dueAt)));
  const blockedKpi = kpiOpenItems.filter((item) => item.status.toUpperCase() === 'BLOCKED');
  const dueInKpi = (from: number, to: number | null) =>
    kpiOpenItems.filter((item) => {
      const due = time(item.dueAt);
      if (!Number.isFinite(due)) return false;
      const days = Math.ceil((due - stateDate.getTime()) / day);
      return days >= from && (to === null || days <= to);
    });

  // "What is approaching" (section 4) is a whole-population bucket view and
  // legitimately includes MILESTONE due dates; only the Executive Pulse KPIs
  // above are task/decision-scoped.
  const openItemsAll = items.filter(open);
  const undatedAll = openItemsAll.filter((item) => !Number.isFinite(time(item.dueAt)));
  const dueInAll = (from: number, to: number | null) =>
    openItemsAll.filter((item) => {
      const due = time(item.dueAt);
      if (!Number.isFinite(due)) return false;
      const days = Math.ceil((due - stateDate.getTime()) / day);
      return days >= from && (to === null || days <= to);
    });

  const completeItems = kpiItems.filter(isRecordComplete);
  const incompleteItems = kpiItems.filter((item) => !isRecordComplete(item));

  const calculated = (
    id: string,
    drilldown: WorkReportItem[],
    denominator: number,
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
        overdueKpi.filter((item) => item.kind === 'TASK'),
        openTasks.length,
        overdueKpi.some((item) => item.kind === 'TASK') ? 'red' : 'neutral'
      ),
      calculated(
        'overdueDecisions',
        overdueKpi.filter((item) => item.kind === 'DECISION'),
        openDecisions.length,
        overdueKpi.some((item) => item.kind === 'DECISION') ? 'red' : 'neutral'
      ),
      calculated(
        'dueToday',
        dueTodayKpi,
        kpiOpenItems.length,
        dueTodayKpi.length ? 'amber' : 'neutral'
      ),
      calculated(
        'due7',
        dueInKpi(1, 7),
        kpiOpenItems.length,
        dueInKpi(1, 7).length ? 'amber' : 'neutral'
      ),
      calculated(
        'activeBlocks',
        blockedKpi,
        kpiOpenItems.length,
        blockedKpi.length ? 'red' : 'neutral'
      ),
      calculated(
        'undatedRisk',
        undatedKpi,
        kpiOpenItems.length,
        undatedKpi.length ? 'amber' : 'neutral'
      ),
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
          // Displayed as a percentage of task/decision records that pass
          // every applicable completeness check (per-record AND), not the
          // fraction of individual field-checks passed across the whole
          // population.
          value: kpiItems.length
            ? Math.round((completeItems.length / kpiItems.length) * 100)
            : 0,
          numerator: completeItems.length,
          denominator: kpiItems.length,
        },
        drilldown: incompleteItems,
        severity: incompleteItems.length === 0 ? 'neutral' : 'amber',
      },
    ],
    buckets: {
      '1_7': dueInAll(1, 7),
      '8_14': dueInAll(8, 14),
      '15_30': dueInAll(15, 30),
      '31_90': dueInAll(31, 90),
      over90: dueInAll(91, null),
      noDue: undatedAll,
    },
  };
}
