import { queryAll as defaultQueryAll } from '../../utils/queryHelpers.js';

export type ExecutionBankEvidenceCompleteness = 'KNOWN' | 'PARTIAL' | 'UNKNOWN';
export type ExecutionBankEvidenceStaleness = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type ExecutionBankEvidenceReason =
  | 'VALUE_MISSING'
  | 'VALUE_CLEARED'
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
  aggregateVersion?: number | null;
  forecastStartPresent?: boolean;
  forecastEndPresent?: boolean;
  forecastStartSourceConflict?: boolean;
  forecastEndSourceConflict?: boolean;
  forecastStartAuthority?: 'canonical' | 'module';
  forecastEndAuthority?: 'canonical' | 'module';
};

type Field = 'progress' | 'forecastStartDate' | 'forecastEndDate';

export type ExecutionBankEvidenceReceipt = {
  id: string;
  system:
    | 'initiative_history'
    | 'execution_audit_log'
    | 'manager_action_audit_log'
    | 'ie_command_receipts';
  action: string;
  oldValue: unknown;
  newValue: unknown;
  observedAt: string | Date | number;
  aggregateVersion?: number | null;
  changedFields?: readonly Field[];
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
  if (receipt.system === 'ie_command_receipts') {
    if (action !== 'initiative.forecast.update') return { present: false, value: null };
    if (!receipt.changedFields?.includes(field)) return { present: false, value: null };
    if (!own(payload, field)) return { present: false, value: null };
    return { present: true, value: (payload as Record<string, unknown>)[field] };
  }
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

const sourceForReceipt = (receipt: ExecutionBankEvidenceReceipt): ExecutionBankEvidenceSource => ({
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
  present?: boolean;
  currentVersion?: number | null;
  authority?: 'canonical' | 'module';
  allowModuleReceiptFallback?: boolean;
  sourceConflict?: boolean;
}): ExecutionBankSourceEvidence<T> => {
  const extractedCandidates = args.receipts
    .map((receipt) => ({ receipt, extracted: explicitReceiptValue(receipt, args.field) }))
    .filter((candidate) => candidate.extracted.present);
  const canonicalCandidates = extractedCandidates.filter(
    (candidate) => candidate.receipt.system === 'ie_command_receipts'
  );
  const moduleCandidates = extractedCandidates.filter(
    (candidate) => candidate.receipt.system !== 'ie_command_receipts'
  );
  const candidates =
    args.authority === 'canonical'
      ? canonicalCandidates.length
        ? canonicalCandidates
        : args.allowModuleReceiptFallback
          ? moduleCandidates
          : []
      : args.authority === 'module'
        ? moduleCandidates
        : extractedCandidates;
  if (args.sourceConflict && !candidates.length) {
    return unknownEvidence<T>(args.asOf, 'SOURCE_CONFLICT', {
      system: 'ie_aggregate_state+initiatives',
      recordId: null,
      formulaId: null,
      formulaVersion: null,
    });
  }
  if (!candidates.length) {
    return args.value == null
      ? unknownEvidence<T>(args.asOf, 'VALUE_MISSING')
      : unknownEvidence<T>(args.asOf, 'OBSERVATION_MISSING');
  }
  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    instant: normalizeInstant(candidate.receipt.observedAt),
  }));
  if (normalizedCandidates.some((candidate) => !candidate.instant)) {
    const invalid = normalizedCandidates.find((candidate) => !candidate.instant)!;
    return unknownEvidence<T>(args.asOf, 'OBSERVATION_INVALID', sourceForReceipt(invalid.receipt));
  }
  const ahead = normalizedCandidates
    .filter(
      (candidate) =>
        candidate.receipt.system === 'ie_command_receipts' &&
        args.currentVersion != null &&
        (candidate.receipt.aggregateVersion == null ||
          !Number.isInteger(candidate.receipt.aggregateVersion) ||
          candidate.receipt.aggregateVersion > args.currentVersion)
    )
    .sort(
      (a, b) =>
        (b.receipt.aggregateVersion ?? Number.MAX_SAFE_INTEGER) -
          (a.receipt.aggregateVersion ?? Number.MAX_SAFE_INTEGER) ||
        b.receipt.id.localeCompare(a.receipt.id)
    )[0];
  if (ahead) {
    return unknownEvidence<T>(args.asOf, 'SOURCE_CONFLICT', sourceForReceipt(ahead.receipt));
  }
  normalizedCandidates.sort((a, b) => {
    if (a.receipt.system === 'ie_command_receipts' && b.receipt.system === 'ie_command_receipts') {
      const byVersion = (b.receipt.aggregateVersion ?? -1) - (a.receipt.aggregateVersion ?? -1);
      if (byVersion) return byVersion;
    }
    const byTime = Date.parse(b.instant!) - Date.parse(a.instant!);
    return byTime || b.receipt.id.localeCompare(a.receipt.id);
  });
  const latest = normalizedCandidates[0];
  if (args.present === false) {
    return unknownEvidence<T>(args.asOf, 'SOURCE_CONFLICT', sourceForReceipt(latest.receipt));
  }
  if (args.sourceConflict) {
    return unknownEvidence<T>(args.asOf, 'SOURCE_CONFLICT', sourceForReceipt(latest.receipt));
  }
  if (Date.parse(latest.instant!) > Date.parse(args.asOf)) {
    return unknownEvidence<T>(
      args.asOf,
      'NO_EVENT_HISTORY_BEFORE_AS_OF',
      sourceForReceipt(latest.receipt)
    );
  }
  const receiptValue = args.normalize(latest.extracted.value);
  if (args.value == null && latest.extracted.value === null) {
    return {
      value: null,
      observedAt: latest.instant,
      asOf: args.asOf,
      source: sourceForReceipt(latest.receipt),
      completeness: 'UNKNOWN',
      staleness: 'UNKNOWN',
      reason: 'VALUE_CLEARED',
    };
  }
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
  const weighted = normalized.reduce((sum, task) => sum + task.progress! * task.weight, 0);
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
    rawStart != null && rawStart !== '' && start == null
      ? unknownEvidence<string>(asOf, 'VALUE_INVALID')
      : selectReceiptEvidence({
          field: 'forecastStartDate',
          value: start,
          receipts: input.receipts,
          asOf,
          normalize: normalizeDate,
          present: input.current.forecastStartPresent,
          currentVersion: input.current.aggregateVersion,
          authority: input.current.forecastStartAuthority,
          allowModuleReceiptFallback:
            input.current.forecastStartAuthority === 'canonical' &&
            input.current.forecastStartSourceConflict !== true,
          sourceConflict: input.current.forecastStartSourceConflict,
        });

  const rawEnd = input.current.forecastEndDate;
  const end = normalizeDate(rawEnd);
  const forecastEndEvidence =
    rawEnd != null && rawEnd !== '' && end == null
      ? unknownEvidence<string>(asOf, 'VALUE_INVALID')
      : selectReceiptEvidence({
          field: 'forecastEndDate',
          value: end,
          receipts: input.receipts,
          asOf,
          normalize: normalizeDate,
          present: input.current.forecastEndPresent,
          currentVersion: input.current.aggregateVersion,
          authority: input.current.forecastEndAuthority,
          allowModuleReceiptFallback:
            input.current.forecastEndAuthority === 'canonical' &&
            input.current.forecastEndSourceConflict !== true,
          sourceConflict: input.current.forecastEndSourceConflict,
        });

  return { progressEvidence, forecastStartEvidence, forecastEndEvidence };
}

type InitiativeDbRow = {
  initiative_id: string;
  progress: number | string | null;
  forecast_start_date: string | Date | null;
  forecast_end_date: string | Date | null;
};

type CanonicalInitiativeDbRow = {
  initiative_id: string;
  aggregate_version: number | string;
  payload_json: unknown;
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

type CanonicalReceiptDbRow = {
  id: string;
  initiative_id: string;
  aggregate_version: number | string;
  response_json: unknown;
  observed_at: string | Date | number;
  system: 'ie_command_receipts';
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

  const [moduleRows, canonicalRows] = await Promise.all([
    query<InitiativeDbRow>(
      `SELECT i.id AS initiative_id, i.progress, i.forecast_start_date, i.forecast_end_date
         FROM initiatives i
        WHERE i.organization_id = ? AND i.id IN (${placeholders})`,
      commonParams
    ),
    query<CanonicalInitiativeDbRow>(
      `SELECT aggregate_id AS initiative_id, version AS aggregate_version, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = ? AND aggregate_type = 'initiative'
          AND aggregate_id IN (${placeholders})`,
      commonParams
    ),
  ]);
  const moduleById = new Map(moduleRows.map((row) => [row.initiative_id, row]));
  const canonicalById = new Map(canonicalRows.map((row) => [row.initiative_id, row]));
  const returnedIds = initiativeIds.filter(
    (initiativeId) => moduleById.has(initiativeId) || canonicalById.has(initiativeId)
  );
  if (!returnedIds.length) return {};
  const returnedPlaceholders = returnedIds.map(() => '?').join(', ');
  const returnedParams = [input.organizationId, ...returnedIds];
  const moduleIds = returnedIds.filter((initiativeId) => moduleById.has(initiativeId));
  const modulePlaceholders = moduleIds.map(() => '?').join(', ');
  const moduleParams = [input.organizationId, ...moduleIds];

  const [historyRows, auditRows, managerRows, taskRows, canonicalReceiptRows] = await Promise.all([
    moduleIds.length
      ? query<ReceiptDbRow>(
          `SELECT h.id, h.initiative_id, h.action, h.old_value, h.new_value,
              EXTRACT(EPOCH FROM h.changed_at)::double precision AS observed_at,
              'initiative_history' AS system
         FROM initiative_history h
         JOIN initiatives i ON i.id = h.initiative_id
        WHERE i.organization_id = ? AND h.initiative_id IN (${modulePlaceholders})
          AND h.action IN ('progress_updated', 'reforecast')`,
          moduleParams
        )
      : Promise.resolve([]),
    moduleIds.length
      ? query<ReceiptDbRow>(
          `SELECT e.id, e.initiative_id, e.field_changed AS action, e.old_value, e.new_value,
              EXTRACT(EPOCH FROM e.changed_at)::double precision AS observed_at,
              'execution_audit_log' AS system
         FROM execution_audit_log e
         JOIN initiatives i ON i.id = e.initiative_id
        WHERE e.organization_id = ? AND i.organization_id = ?
          AND e.initiative_id IN (${modulePlaceholders})
          AND e.field_changed IN ('progress', 'replan', 'smooth')`,
          [input.organizationId, ...moduleParams]
        )
      : Promise.resolve([]),
    moduleIds.length
      ? query<ReceiptDbRow>(
          `SELECT m.id, m.entity_id AS initiative_id, m.action, m.old_value, m.new_value,
              EXTRACT(EPOCH FROM m.created_at)::double precision AS observed_at,
              'manager_action_audit_log' AS system
         FROM manager_action_audit_log m
         JOIN initiatives i ON i.id = m.entity_id
        WHERE m.organization_id = ? AND i.organization_id = ?
          AND m.entity_type = 'INITIATIVE'
          AND m.entity_id IN (${modulePlaceholders})
          AND m.action = 'manager_scope_reduction'`,
          [input.organizationId, ...moduleParams]
        )
      : Promise.resolve([]),
    moduleIds.length
      ? query<TaskDbRow>(
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
          AND t.initiative_id IN (${modulePlaceholders})`,
          [input.organizationId, input.organizationId, ...moduleParams]
        ).catch(() => [])
      : Promise.resolve([]),
    query<CanonicalReceiptDbRow>(
      `SELECT client_request_id AS id, aggregate_id AS initiative_id, aggregate_version,
              response_json, EXTRACT(EPOCH FROM created_at)::double precision AS observed_at,
              'ie_command_receipts' AS system
         FROM ie_command_receipts
        WHERE organization_id = ? AND aggregate_type = 'initiative'
          AND command_type = 'initiative.forecast.update'
          AND aggregate_id IN (${returnedPlaceholders})`,
      returnedParams
    ),
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
  for (const row of canonicalReceiptRows) {
    const response = parsePayload(row.response_json);
    const after = own(response, 'after')
      ? parsePayload((response as Record<string, unknown>).after)
      : null;
    const rawChangedFields = own(response, 'changedFields')
      ? (response as Record<string, unknown>).changedFields
      : null;
    const changedFields = Array.isArray(rawChangedFields)
      ? rawChangedFields.filter(
          (field): field is Field => field === 'forecastStartDate' || field === 'forecastEndDate'
        )
      : [];
    const receipts = receiptsByInitiative.get(row.initiative_id) ?? [];
    receipts.push({
      id: row.id,
      system: 'ie_command_receipts',
      action: 'initiative.forecast.update',
      oldValue: null,
      newValue: after,
      observedAt: row.observed_at,
      aggregateVersion: Number(row.aggregate_version),
      changedFields,
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
    returnedIds.map((initiativeId) => {
      const moduleRow = moduleById.get(initiativeId);
      const canonicalRow = canonicalById.get(initiativeId);
      const canonicalPayload = canonicalRow ? parsePayload(canonicalRow.payload_json) : null;
      const canonicalStartPresent = own(canonicalPayload, 'forecastStartDate');
      const canonicalEndPresent = own(canonicalPayload, 'forecastEndDate');
      const canonicalStart = canonicalStartPresent
        ? ((canonicalPayload as Record<string, unknown>).forecastStartDate as string | Date | null)
        : null;
      const canonicalEnd = canonicalEndPresent
        ? ((canonicalPayload as Record<string, unknown>).forecastEndDate as string | Date | null)
        : null;
      const moduleStart = moduleRow?.forecast_start_date ?? null;
      const moduleEnd = moduleRow?.forecast_end_date ?? null;
      const currentStart = canonicalStartPresent ? canonicalStart : moduleStart;
      const currentEnd = canonicalEndPresent ? canonicalEnd : moduleEnd;
      const canonicalVersion = canonicalRow ? Number(canonicalRow.aggregate_version) : null;
      return [
        initiativeId,
        projectExecutionBankInitiativeEvidence({
          current: {
            initiativeId,
            progress: moduleRow?.progress ?? null,
            forecastStartDate: currentStart,
            forecastEndDate: currentEnd,
            aggregateVersion: Number.isInteger(canonicalVersion) ? canonicalVersion : null,
            forecastStartPresent: canonicalStartPresent || moduleRow !== undefined,
            forecastEndPresent: canonicalEndPresent || moduleRow !== undefined,
            forecastStartAuthority: moduleRow !== undefined ? 'module' : 'canonical',
            forecastEndAuthority: moduleRow !== undefined ? 'module' : 'canonical',
            forecastStartSourceConflict:
              canonicalStartPresent && moduleRow !== undefined
                ? normalizeDate(canonicalStart) !== normalizeDate(moduleStart)
                : false,
            forecastEndSourceConflict:
              canonicalEndPresent && moduleRow !== undefined
                ? normalizeDate(canonicalEnd) !== normalizeDate(moduleEnd)
                : false,
          },
          receipts: receiptsByInitiative.get(initiativeId) ?? [],
          tasks: tasksByInitiative.get(initiativeId) ?? [],
          asOf,
        }),
      ] as const;
    })
  );
}
