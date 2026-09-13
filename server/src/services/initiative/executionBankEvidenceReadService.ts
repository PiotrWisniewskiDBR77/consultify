import { queryAll as defaultQueryAll } from '../../utils/queryHelpers.js';

export type ExecutionBankEvidenceCompleteness = 'KNOWN' | 'PARTIAL' | 'UNKNOWN';
export type ExecutionBankEvidenceStaleness = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type ExecutionBankEvidenceReason =
  | 'VALUE_MISSING'
  | 'VALUE_INVALID'
  | 'OBSERVATION_MISSING'
  | 'OBSERVATION_INVALID'
  | 'NO_EVENT_HISTORY_BEFORE_AS_OF'
  | 'SOURCE_CONFLICT'
  | 'INCOMPLETE_TASK_INPUTS'
  | 'TASK_PROGRESS_OBSERVATION_UNPROVEN'
  | 'TASK_PROGRESS_MISMATCH'
  | 'FRESHNESS_POLICY_MISSING';

export type ExecutionBankEvidenceSource = {
  system: string;
  recordId: string | null;
  formulaId: string | null;
  formulaVersion: number | null;
};

export type ExecutionBankSourceEvidence<T> = {
  value: T | null;
  observedAt: string | null;
  asOf: string;
  source: ExecutionBankEvidenceSource;
  completeness: ExecutionBankEvidenceCompleteness;
  staleness: ExecutionBankEvidenceStaleness;
  reason: ExecutionBankEvidenceReason | null;
};

export type InitiativeExecutionEvidence = {
  progressEvidence: ExecutionBankSourceEvidence<number>;
  forecastStartEvidence: ExecutionBankSourceEvidence<string>;
  forecastEndEvidence: ExecutionBankSourceEvidence<string>;
};

export type ExecutionBankEvidenceCurrentRow = {
  initiativeId: string;
  progress: number | string | null;
  forecastStartDate: string | Date | null;
  forecastEndDate: string | Date | null;
};

export type ExecutionBankEvidenceReceipt = {
  id: string;
  system: 'initiative_history' | 'execution_audit_log' | 'manager_action_audit_log';
  action: string;
  oldValue: unknown;
  newValue: unknown;
  observedAt: string | Date | number;
};

export type ExecutionBankEvidenceTaskInput = {
  id: string;
  progress: number | string | null;
  priority: string | null;
  observedAt: string | Date | number | null;
  progressReceiptId?: string | null;
  progressReceiptValue?: unknown;
};

export type ExecutionBankEvidenceQuery = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<T[]>;

type ProjectEvidenceInput = {
  current: ExecutionBankEvidenceCurrentRow;
  receipts: readonly ExecutionBankEvidenceReceipt[];
  tasks: readonly ExecutionBankEvidenceTaskInput[];
  asOf: string;
};

type Field = 'progress' | 'forecastStartDate' | 'forecastEndDate';

const unavailableSource = (system: string): ExecutionBankEvidenceSource => ({
  system,
  recordId: null,
  formulaId: null,
  formulaVersion: null,
});

const unknownEvidence = <T>(
  asOf: string,
  reason: ExecutionBankEvidenceReason,
  source = unavailableSource('initiative')
): ExecutionBankSourceEvidence<T> => ({
  value: null,
  observedAt: null,
  asOf,
  source,
  completeness: 'UNKNOWN',
  staleness: 'UNKNOWN',
  reason,
});

const normalizeInstant = (value: string | Date | number | null | undefined): string | null => {
  if (value == null || value === '') return null;
  const numeric =
    typeof value === 'number' && Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  const date = value instanceof Date ? value : new Date(numeric);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const normalizeAsOf = (value: string): string => {
  const normalized = normalizeInstant(value);
  if (!normalized) throw new Error('Execution Bank evidence requires a valid controlled asOf');
  return normalized;
};

const normalizeDate = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  }
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const parsePayload = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const own = (value: unknown, key: string): boolean =>
  typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);

const explicitReceiptValue = (
  receipt: ExecutionBankEvidenceReceipt,
  field: Field
): { present: boolean; value: unknown } => {
  const action = receipt.action.trim().toLowerCase();
  const payload = parsePayload(receipt.newValue);
  if (field === 'progress') {
    if (!['progress', 'progress_updated'].includes(action)) return { present: false, value: null };
    if (own(payload, 'progress')) return { present: true, value: (payload as any).progress };
    return receipt.system === 'execution_audit_log'
      ? { present: true, value: payload }
      : { present: false, value: null };
  }

  if (!['reforecast', 'replan', 'smooth', 'manager_scope_reduction'].includes(action)) {
    return { present: false, value: null };
  }
  const keys =
    field === 'forecastStartDate'
      ? ['forecastStartDate', 'forecast_start_date']
      : ['forecastEndDate', 'forecast_end_date'];
  for (const key of keys) {
    if (own(payload, key)) return { present: true, value: (payload as any)[key] };
  }
  return { present: false, value: null };
};

const sourceForReceipt = (
  receipt: ExecutionBankEvidenceReceipt
): ExecutionBankEvidenceSource => ({
  system: receipt.system,
  recordId: receipt.id,
  formulaId: null,
  formulaVersion: null,
});

const selectReceiptEvidence = <T>(args: {
  field: Field;
  value: T | null;
  receipts: readonly ExecutionBankEvidenceReceipt[];
  asOf: string;
  normalize: (value: unknown) => T | null;
}): ExecutionBankSourceEvidence<T> => {
  if (args.value == null) return unknownEvidence<T>(args.asOf, 'VALUE_MISSING');
  const candidates = args.receipts
    .map((receipt) => ({ receipt, extracted: explicitReceiptValue(receipt, args.field) }))
    .filter((candidate) => candidate.extracted.present);
  if (!candidates.length) return unknownEvidence<T>(args.asOf, 'OBSERVATION_MISSING');
  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    instant: normalizeInstant(candidate.receipt.observedAt),
  }));
  if (normalizedCandidates.some((candidate) => !candidate.instant)) {
    const invalid = normalizedCandidates.find((candidate) => !candidate.instant)!;
    return unknownEvidence<T>(args.asOf, 'OBSERVATION_INVALID', sourceForReceipt(invalid.receipt));
  }
  normalizedCandidates.sort((a, b) => {
    const byTime = Date.parse(b.instant!) - Date.parse(a.instant!);
    return byTime || b.receipt.id.localeCompare(a.receipt.id);
  });
  const latest = normalizedCandidates[0];
  if (Date.parse(latest.instant!) > Date.parse(args.asOf)) {
    return unknownEvidence<T>(
      args.asOf,
      'NO_EVENT_HISTORY_BEFORE_AS_OF',
      sourceForReceipt(latest.receipt)
    );
  }
  const receiptValue = args.normalize(latest.extracted.value);
  if (receiptValue == null || receiptValue !== args.value) {
    return unknownEvidence<T>(args.asOf, 'SOURCE_CONFLICT', sourceForReceipt(latest.receipt));
  }
  return {
    value: args.value,
    observedAt: latest.instant,
    asOf: args.asOf,
    source: sourceForReceipt(latest.receipt),
    completeness: 'KNOWN',
    staleness: 'UNKNOWN',
    reason: 'FRESHNESS_POLICY_MISSING',
  };
};

const normalizeProgress = (value: unknown): number | null => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const priorityWeight = (priority: string | null): number => {
  switch ((priority || 'medium').toLowerCase()) {
    case 'urgent':
    case 'high':
      return 1.5;
    case 'low':
      return 0.5;
    default:
      return 1;
  }
};

const taskProgressEvidence = (
  currentProgress: number,
  tasks: readonly ExecutionBankEvidenceTaskInput[],
  asOf: string
): ExecutionBankSourceEvidence<number> | null => {
  if (!tasks.length) return null;
  const normalized = tasks.map((task) => ({
    progress: normalizeProgress(task.progress),
    observedAt: normalizeInstant(task.observedAt),
    progressReceiptId: task.progressReceiptId ?? null,
    progressReceiptValue: normalizeProgress(task.progressReceiptValue),
    weight: priorityWeight(task.priority),
  }));
  if (normalized.some((task) => task.progress == null)) {
    return unknownEvidence<number>(asOf, 'INCOMPLETE_TASK_INPUTS', {
      system: 'tasks',
      recordId: null,
      formulaId: 'legacy-task-priority-weighted-progress',
      formulaVersion: 1,
    });
  }
  if (normalized.some((task) => task.observedAt == null || task.progressReceiptId == null)) {
    return unknownEvidence<number>(asOf, 'TASK_PROGRESS_OBSERVATION_UNPROVEN', {
      system: 'tasks',
      recordId: null,
      formulaId: 'legacy-task-priority-weighted-progress',
      formulaVersion: 1,
    });
  }
  if (normalized.some((task) => task.progressReceiptValue !== task.progress)) {
    return unknownEvidence<number>(asOf, 'SOURCE_CONFLICT', {
      system: 'task_history',
      recordId: null,
      formulaId: 'legacy-task-priority-weighted-progress',
      formulaVersion: 1,
    });
  }
  const latestObservedAt = normalized
    .map((task) => task.observedAt!)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  if (Date.parse(latestObservedAt) > Date.parse(asOf)) {
    return unknownEvidence<number>(asOf, 'NO_EVENT_HISTORY_BEFORE_AS_OF', {
      system: 'tasks',
      recordId: null,
      formulaId: 'legacy-task-priority-weighted-progress',
      formulaVersion: 1,
    });
  }
  const weighted = normalized.reduce(
    (sum, task) => sum + task.progress! * task.weight,
    0
  );
  const totalWeight = normalized.reduce((sum, task) => sum + task.weight, 0);
  const calculated = totalWeight > 0 ? Math.round(weighted / totalWeight) : null;
  if (calculated == null || calculated !== currentProgress) {
    return unknownEvidence<number>(asOf, 'TASK_PROGRESS_MISMATCH', {
      system: 'tasks',
      recordId: null,
      formulaId: 'legacy-task-priority-weighted-progress',
      formulaVersion: 1,
    });
  }
  return {
    value: currentProgress,
    observedAt: latestObservedAt,
    asOf,
    source: {
      system: 'tasks',
      recordId: null,
      formulaId: 'legacy-task-priority-weighted-progress',
      formulaVersion: 1,
    },
    completeness: 'PARTIAL',
    staleness: 'UNKNOWN',
    reason: 'FRESHNESS_POLICY_MISSING',
  };
};

export function projectExecutionBankInitiativeEvidence(
  input: ProjectEvidenceInput
): InitiativeExecutionEvidence {
  const asOf = normalizeAsOf(input.asOf);
  const progress = normalizeProgress(input.current.progress);
  const progressEvidence =
    input.current.progress == null || input.current.progress === ''
      ? unknownEvidence<number>(asOf, 'VALUE_MISSING')
      : progress == null
        ? unknownEvidence<number>(asOf, 'VALUE_INVALID')
        : (() => {
            const receiptEvidence = selectReceiptEvidence({
              field: 'progress',
              value: progress,
              receipts: input.receipts,
              asOf,
              normalize: normalizeProgress,
            });
            if (receiptEvidence.reason !== 'OBSERVATION_MISSING') return receiptEvidence;
            return taskProgressEvidence(progress, input.tasks, asOf) ?? receiptEvidence;
          })();

  const rawStart = input.current.forecastStartDate;
  const start = normalizeDate(rawStart);
  const forecastStartEvidence =
    rawStart == null || rawStart === ''
      ? unknownEvidence<string>(asOf, 'VALUE_MISSING')
      : start == null
        ? unknownEvidence<string>(asOf, 'VALUE_INVALID')
        : selectReceiptEvidence({
            field: 'forecastStartDate',
            value: start,
            receipts: input.receipts,
            asOf,
            normalize: normalizeDate,
          });

  const rawEnd = input.current.forecastEndDate;
  const end = normalizeDate(rawEnd);
  const forecastEndEvidence =
    rawEnd == null || rawEnd === ''
      ? unknownEvidence<string>(asOf, 'VALUE_MISSING')
      : end == null
        ? unknownEvidence<string>(asOf, 'VALUE_INVALID')
        : selectReceiptEvidence({
            field: 'forecastEndDate',
            value: end,
            receipts: input.receipts,
            asOf,
            normalize: normalizeDate,
          });

  return { progressEvidence, forecastStartEvidence, forecastEndEvidence };
}

type InitiativeDbRow = {
  initiative_id: string;
  progress: number | string | null;
  forecast_start_date: string | Date | null;
  forecast_end_date: string | Date | null;
};

type ReceiptDbRow = {
  id: string;
  initiative_id: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  observed_at: string | Date | number;
  system: ExecutionBankEvidenceReceipt['system'];
};

type TaskDbRow = {
  id: string;
  initiative_id: string;
  progress: number | string | null;
  priority: string | null;
  progress_receipt_id: string | null;
  progress_receipt_value: unknown;
  progress_observed_at: string | Date | number | null;
};

export async function readExecutionBankInitiativeEvidence(
  input: { organizationId: string; initiativeIds: readonly string[]; asOf: string },
  deps: { queryAll?: ExecutionBankEvidenceQuery } = {}
): Promise<Record<string, InitiativeExecutionEvidence>> {
  const asOf = normalizeAsOf(input.asOf);
  const initiativeIds = [...new Set(input.initiativeIds.map(String).filter(Boolean))];
  if (!input.organizationId || !initiativeIds.length) return {};
  const query = deps.queryAll ?? defaultQueryAll;
  const placeholders = initiativeIds.map(() => '?').join(', ');
  const commonParams = [input.organizationId, ...initiativeIds];

  const currentRows = await query<InitiativeDbRow>(
    `SELECT i.id AS initiative_id, i.progress, i.forecast_start_date, i.forecast_end_date
       FROM initiatives i
      WHERE i.organization_id = ? AND i.id IN (${placeholders})`,
    commonParams
  );
  if (!currentRows.length) return {};
  const returnedIds = currentRows.map((row) => row.initiative_id);
  const returnedPlaceholders = returnedIds.map(() => '?').join(', ');
  const returnedParams = [input.organizationId, ...returnedIds];

  const [historyRows, auditRows, managerRows, taskRows] = await Promise.all([
    query<ReceiptDbRow>(
      `SELECT h.id, h.initiative_id, h.action, h.old_value, h.new_value,
              EXTRACT(EPOCH FROM h.changed_at)::double precision AS observed_at,
              'initiative_history' AS system
         FROM initiative_history h
         JOIN initiatives i ON i.id = h.initiative_id
        WHERE i.organization_id = ? AND h.initiative_id IN (${returnedPlaceholders})
          AND h.action IN ('progress_updated', 'reforecast')`,
      returnedParams
    ),
    query<ReceiptDbRow>(
      `SELECT e.id, e.initiative_id, e.field_changed AS action, e.old_value, e.new_value,
              EXTRACT(EPOCH FROM e.changed_at)::double precision AS observed_at,
              'execution_audit_log' AS system
         FROM execution_audit_log e
         JOIN initiatives i ON i.id = e.initiative_id
        WHERE e.organization_id = ? AND i.organization_id = ?
          AND e.initiative_id IN (${returnedPlaceholders})
          AND e.field_changed IN ('progress', 'replan', 'smooth')`,
      [input.organizationId, ...returnedParams]
    ),
    query<ReceiptDbRow>(
      `SELECT m.id, m.entity_id AS initiative_id, m.action, m.old_value, m.new_value,
              EXTRACT(EPOCH FROM m.created_at)::double precision AS observed_at,
              'manager_action_audit_log' AS system
         FROM manager_action_audit_log m
         JOIN initiatives i ON i.id = m.entity_id
        WHERE m.organization_id = ? AND i.organization_id = ?
          AND m.entity_type = 'INITIATIVE'
          AND m.entity_id IN (${returnedPlaceholders})
          AND m.action = 'manager_scope_reduction'`,
      [input.organizationId, ...returnedParams]
    ),
    query<TaskDbRow>(
      `SELECT t.id, t.initiative_id, t.progress, t.priority,
              ph.id AS progress_receipt_id,
              ph.new_value AS progress_receipt_value,
              ph.progress_observed_at
         FROM tasks t
         JOIN initiatives i ON i.id = t.initiative_id
         LEFT JOIN LATERAL (
           SELECT h.id, h.new_value,
                  EXTRACT(EPOCH FROM h.changed_at)::double precision AS progress_observed_at
             FROM task_history h
            WHERE h.task_id = t.id AND h.organization_id = ? AND h.field = 'progress'
            ORDER BY h.changed_at DESC, h.id DESC
            LIMIT 1
         ) ph ON TRUE
        WHERE t.organization_id = ? AND i.organization_id = ?
          AND t.initiative_id IN (${returnedPlaceholders})`,
      [input.organizationId, input.organizationId, ...returnedParams]
    ).catch(() => []),
  ]);

  const receiptsByInitiative = new Map<string, ExecutionBankEvidenceReceipt[]>();
  for (const row of [...historyRows, ...auditRows, ...managerRows]) {
    const receipts = receiptsByInitiative.get(row.initiative_id) ?? [];
    receipts.push({
      id: row.id,
      system: row.system,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      observedAt: row.observed_at,
    });
    receiptsByInitiative.set(row.initiative_id, receipts);
  }
  const tasksByInitiative = new Map<string, ExecutionBankEvidenceTaskInput[]>();
  for (const row of taskRows) {
    const tasks = tasksByInitiative.get(row.initiative_id) ?? [];
    tasks.push({
      id: row.id,
      progress: row.progress,
      priority: row.priority,
      observedAt: row.progress_observed_at,
      progressReceiptId: row.progress_receipt_id,
      progressReceiptValue: row.progress_receipt_value,
    });
    tasksByInitiative.set(row.initiative_id, tasks);
  }

  return Object.fromEntries(
    currentRows.map((row) => [
      row.initiative_id,
      projectExecutionBankInitiativeEvidence({
        current: {
          initiativeId: row.initiative_id,
          progress: row.progress,
          forecastStartDate: row.forecast_start_date,
          forecastEndDate: row.forecast_end_date,
        },
        receipts: receiptsByInitiative.get(row.initiative_id) ?? [],
        tasks: tasksByInitiative.get(row.initiative_id) ?? [],
        asOf,
      }),
    ])
  );
}
