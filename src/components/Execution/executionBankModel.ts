export type ExecutionBankCompleteness = 'KNOWN' | 'PARTIAL' | 'UNKNOWN';
export type ExecutionBankStaleness = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type ExecutionBankHorizonMonths = 1 | 3 | 6 | 12;
export type ExecutionBankResolution = 'WEEK' | 'MONTH';

export type ExecutionBankUnknownReason =
  | 'INITIATIVE_MISSING'
  | 'PROGRESS_MISSING'
  | 'PROGRESS_INVALID'
  | 'BASELINE_MISSING'
  | 'BASELINE_INVALID'
  | 'BASELINE_OBSERVATION_MISSING'
  | 'BASELINE_OBSERVATION_INVALID'
  | 'BASELINE_AFTER_AS_OF'
  | 'CURRENT_PLAN_MISSING'
  | 'CURRENT_PLAN_INVALID'
  | 'FORECAST_MISSING'
  | 'FORECAST_INVALID'
  | 'FORECAST_OBSERVATION_MISSING'
  | 'FORECAST_OBSERVATION_INVALID'
  | 'FORECAST_AFTER_AS_OF'
  | 'NO_EVENT_HISTORY_BEFORE_AS_OF'
  | 'SOURCE_CONFLICT'
  | 'OBSERVATION_MISSING'
  | 'OBSERVATION_INVALID'
  | 'VALUE_MISSING'
  | 'VALUE_CLEARED'
  | 'VALUE_INVALID'
  | 'INCOMPLETE_TASK_INPUTS'
  | 'TASK_PROGRESS_OBSERVATION_UNPROVEN'
  | 'TASK_PROGRESS_MISMATCH'
  | 'FRESHNESS_POLICY_MISSING'
  | 'ACTUAL_MISSING'
  | 'ACTUAL_INVALID'
  | 'CONFIDENCE_MISSING'
  | 'HEALTH_MISSING'
  | 'UPDATED_AT_MISSING'
  | 'UPDATED_AT_INVALID';

export interface ExecutionBankEvidenceMeta {
  asOf: string;
  source: string;
  completeness: ExecutionBankCompleteness;
  staleness: ExecutionBankStaleness;
  formula: { id: string; version: number };
  inputs: Record<string, string | number | boolean | null>;
  window: { start: string; endExclusive: string } | null;
}
export type ExecutionBankEvidence<T> =
  | { status: 'KNOWN'; value: T; meta: ExecutionBankEvidenceMeta }
  | {
      status: 'UNKNOWN';
      value: null;
      reason: ExecutionBankUnknownReason;
      meta: ExecutionBankEvidenceMeta;
    };

export interface ExecutionBankInitiativeEvidenceSource<T> {
  value: T | null;
  observedAt: string | null;
  asOf: string;
  source: {
    system: string;
    recordId: string | null;
    formulaId: string | null;
    formulaVersion: number | null;
  };
  completeness: ExecutionBankCompleteness;
  staleness: ExecutionBankStaleness;
  reason?: ExecutionBankUnknownReason | string | null;
}

export interface ExecutionBankInitiativeSource {
  id: string;
  name: string;
  description?: string | null;
  lifecycleStatus?: string | null;
  projectId?: string | null;
  priority?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  progress?: number | null;
  progressEvidence?: ExecutionBankInitiativeEvidenceSource<number> | null;
  confidence?: string | number | null;
  baselineStartDate?: string | null;
  baselineEndDate?: string | null;
  scheduleBaselineId?: string | null;
  baselineVersion?: number | string | null;
  baselineObservedAt?: string | null;
  currentPlanStartDate?: string | null;
  currentPlanEndDate?: string | null;
  forecastStartDate?: string | null;
  forecastEndDate?: string | null;
  forecastStartEvidence?: ExecutionBankInitiativeEvidenceSource<string> | null;
  forecastEndEvidence?: ExecutionBankInitiativeEvidenceSource<string> | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  updatedAt?: string | null;
}

export function executionBankBaselineSource(
  initiative: Record<string, unknown>
): Pick<
  ExecutionBankInitiativeSource,
  | 'baselineStartDate'
  | 'baselineEndDate'
  | 'scheduleBaselineId'
  | 'baselineVersion'
  | 'baselineObservedAt'
> {
  return {
    baselineStartDate: (initiative.baselineStartDate as string | null | undefined) ?? null,
    baselineEndDate: (initiative.baselineEndDate as string | null | undefined) ?? null,
    scheduleBaselineId: (initiative.scheduleBaselineId as string | null | undefined) ?? null,
    baselineVersion: (initiative.baselineVersion as number | string | null | undefined) ?? null,
    baselineObservedAt: (initiative.baselineSetAt as string | null | undefined) ?? null,
  };
}

export interface ExecutionBankCaseSource {
  executionCaseId: string;
  initiativeId: string;
  initiativeTitle?: string | null;
  version?: number | string | null;
  state?: string | null;
  executionPhase?: string | null;
  executionManagerId?: string | null;
  deliveryProfile?: string | null;
  handoffPackageId?: string | null;
  handoffPackageVersion?: number | string | null;
  acceptedBaseline?: Record<string, unknown> | null;
  acceptedAt?: string | null;
  forecastStartDate?: string | null;
  forecastEndDate?: string | null;
  forecastObservedAt?: string | null;
  forecastSource?: string | null;
  forecastCompleteness?: ExecutionBankCompleteness | null;
  forecastStaleness?: ExecutionBankStaleness | null;
  health?: string | null;
  healthSource?: string | null;
  blockerCount?: number | string | null;
  pendingDecisionCount?: number | string | null;
  resourceConstraint?: string | null;
  nextAction?: string | null;
  updatedAt?: string | null;
}

export interface ExecutionBankRow {
  id: string;
  initiativeId: string;
  executionCaseId: string | null;
  executionCaseVersion: number | null;
  name: string;
  description: string | null;
  lifecycleStatus: string;
  projectId: string | null;
  priority: string | null;
  executionState: string;
  executionPhase: string | null;
  ownerId: string | null;
  ownerName: string | null;
  deliveryProfile: string | null;
  progress: ExecutionBankEvidence<number>;
  confidence: ExecutionBankEvidence<string | number>;
  baselineStart: ExecutionBankEvidence<string>;
  baselineFinish: ExecutionBankEvidence<string>;
  currentPlanStart: ExecutionBankEvidence<string>;
  currentPlanFinish: ExecutionBankEvidence<string>;
  forecastStart: ExecutionBankEvidence<string>;
  forecastFinish: ExecutionBankEvidence<string>;
  actualStart: ExecutionBankEvidence<string>;
  actualFinish: ExecutionBankEvidence<string>;
  varianceDays: ExecutionBankEvidence<number> & { reference?: 'FORECAST' | 'ACTUAL' };
  health: ExecutionBankEvidence<string>;
  blockerCount: number | null;
  pendingDecisionCount: number | null;
  resourceConstraint: string | null;
  nextAction: string | null;
  updatedAt: ExecutionBankEvidence<string>;
  displayFinish: ExecutionBankEvidence<string> & {
    reference?: 'CURRENT_PLAN' | 'FORECAST' | 'ACTUAL';
  };
  /**
   * H2 (FALA B, 14.09) — ŚLAD PRZEKAZANIA inicjatywy do Realizacji.
   *
   * DEC-453 pkt b nazwał to „silnikiem bez kierownicy": inicjatywa jest
   * zatwierdzana w jednym module i pojawia się w drugim, a nigdzie nie widać,
   * CZY i KIEDY ją faktycznie przekazano. Pytanie właściciela brzmi: „czy
   * widać i czy da się zmienić" — ta struktura odpowiada na pierwszą połowę.
   *
   * POMIAR 14.09 (kod, nie teza): dowód przekazania JEST już na froncie i nikt
   * go nie renderował. `postgresInitiativeReader.listExecutionCases` czyta
   * `handoffPackageId` + `acceptedAt` z `ie_aggregate_state`, trasa
   * `GET /api/initiatives/runtime-v1/execution-cases` je oddaje, a
   * `ExecutionBankCaseSource` ma oba pola od początku — używał ich WYŁĄCZNIE
   * dowód baseline'u. Dlatego H2 nie potrzebuje ani migracji, ani nowej trasy.
   *
   * (Tabela `initiative_handoffs` — zapisywana przez `recordHandoff` przy
   * KAŻDEJ zmianie statusu, `initiativeTransitionService.ts:1695` — to ślad
   * AUDYTOWY granic stage'ów, nie to samo co przyjęcie paczki przekazania,
   * które powołuje realizację. Bank pokazuje przyjęcie paczki, bo to ono
   * decyduje o istnieniu bytu w Realizacji.)
   */
  handoff: ExecutionBankHandoff;
}

export type ExecutionBankHandoffStatus =
  /** Paczka przyjęta i znamy datę — pełny ślad. */
  | 'ACCEPTED'
  /** Realizacja wskazuje paczkę, ale data przyjęcia nie dotarła. */
  | 'LINKED_WITHOUT_DATE'
  /** Brak jakiegokolwiek śladu przekazania. */
  | 'ABSENT';

export interface ExecutionBankHandoff {
  status: ExecutionBankHandoffStatus;
  acceptedAt: string | null;
  packageId: string | null;
  packageVersion: number | null;
  /**
   * SANITIZER (reguła z pamięci: rejestr wygrywa ze statusem wiersza).
   * `true` gdy inicjatywa MA status wykonawczy, a śladu przekazania brak —
   * wiersz zostaje WIDOCZNY z plakietką ostrzegawczą, nigdy ukryty.
   */
  missingForInExecution: boolean;
}

/**
 * Statusy, w których brak przekazania jest SPRZECZNOŚCIĄ, a nie normalnym
 * stanem. Słownik 7 (`IN_EXECUTION`) + stara nazwa frontowa (`EXECUTING`),
 * bo oba warianty realnie chodzą po tym ekranie (patrz nota `STATUS_ALIASES`
 * w `ExecutionHub.tsx`).
 */
export const EXECUTION_BANK_IN_EXECUTION_STATUSES: readonly string[] = [
  'IN_EXECUTION',
  'EXECUTING',
];

export function buildExecutionBankHandoff(
  lifecycleStatus: string,
  executionCase: {
    handoffPackageId?: string | null;
    handoffPackageVersion?: number | string | null;
    acceptedAt?: string | null;
  } | null
): ExecutionBankHandoff {
  const packageId = nonEmptyString(executionCase?.handoffPackageId ?? null);
  const rawAcceptedAt = nonEmptyString(executionCase?.acceptedAt ?? null);
  const acceptedAt =
    rawAcceptedAt && Number.isFinite(Date.parse(rawAcceptedAt)) ? rawAcceptedAt : null;
  const status: ExecutionBankHandoffStatus = acceptedAt
    ? 'ACCEPTED'
    : packageId
      ? 'LINKED_WITHOUT_DATE'
      : 'ABSENT';
  return {
    status,
    acceptedAt,
    packageId,
    packageVersion: optionalFiniteNumber(executionCase?.handoffPackageVersion ?? null),
    missingForInExecution:
      status !== 'ACCEPTED' &&
      EXECUTION_BANK_IN_EXECUTION_STATUSES.includes(String(lifecycleStatus || '').toUpperCase()),
  };
}

export interface ExecutionBankFilter {
  search?: string;
  lifecycleStatuses?: readonly string[];
  executionStates?: readonly string[];
  executionPhases?: readonly string[];
  ownerIds?: readonly string[];
  /** `null` is the explicit bucket for inherited initiatives without a project (DEC-469). */
  projectIds?: readonly (string | null)[];
  priorities?: readonly string[];
  /** Half-open ISO date window applied to the best evidenced finish date. */
  timeWindow?: { start?: string; endExclusive?: string };
  health?: readonly string[];
  dataIssues?: readonly ('MISSING_BASELINE' | 'MISSING_FORECAST' | 'UNKNOWN_PROGRESS')[];
  preset?:
    | 'ALL'
    | 'AT_RISK'
    | 'CRITICAL'
    | 'MISSING_BASELINE'
    | 'MISSING_FORECAST'
    | 'UNKNOWN_DATA';
}

export interface ExecutionCalendarBucket {
  id: string;
  label: string;
  start: string;
  endExclusive: string;
}

export interface ExecutionCalendarWindow {
  asOf: string;
  horizonMonths: ExecutionBankHorizonMonths;
  resolution: ExecutionBankResolution;
  start: string;
  endExclusive: string;
  buckets: ExecutionCalendarBucket[];
  drilldown: null | {
    month: string;
    start: string;
    endExclusive: string;
    resolution: 'WEEK';
    buckets: ExecutionCalendarBucket[];
  };
  provenance: ExecutionBankEvidenceMeta;
}

const DAY_MS = 86_400_000;

const isoDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value.trim());
  if (!match || !Number.isFinite(Date.parse(value))) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const controlledAsOf = (value: string): string => {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Execution Bank requires a valid controlled asOf');
  return new Date(time).toISOString();
};

const meta = (
  asOf: string,
  source: string,
  formulaId: string,
  inputs: ExecutionBankEvidenceMeta['inputs'],
  completeness: ExecutionBankCompleteness = 'KNOWN',
  staleness: ExecutionBankStaleness = 'UNKNOWN',
  window: ExecutionBankEvidenceMeta['window'] = null
): ExecutionBankEvidenceMeta => ({
  asOf,
  source,
  completeness,
  staleness,
  formula: { id: formulaId, version: 1 },
  inputs,
  window,
});

const unknown = <T>(
  reason: ExecutionBankUnknownReason,
  evidenceMeta: ExecutionBankEvidenceMeta
): ExecutionBankEvidence<T> => ({
  status: 'UNKNOWN',
  value: null,
  reason,
  meta: { ...evidenceMeta, completeness: 'UNKNOWN' },
});

const known = <T>(value: T, evidenceMeta: ExecutionBankEvidenceMeta): ExecutionBankEvidence<T> => ({
  status: 'KNOWN',
  value,
  meta: evidenceMeta,
});

const dateEvidence = (
  value: string | null | undefined,
  asOf: string,
  source: string,
  formulaId: string,
  missing: ExecutionBankUnknownReason,
  invalid: ExecutionBankUnknownReason
): ExecutionBankEvidence<string> => {
  const evidenceMeta = meta(asOf, source, formulaId, { value: value ?? null });
  if (value == null || value === '') return unknown(missing, evidenceMeta);
  const parsed = isoDate(value);
  return parsed ? known(parsed, evidenceMeta) : unknown(invalid, evidenceMeta);
};

type BaselineEvidencePair = {
  start: ExecutionBankEvidence<string>;
  finish: ExecutionBankEvidence<string>;
};

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const positiveInteger = (value: unknown): number | null => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const baselinePair = (
  asOf: string,
  source: string,
  inputs: ExecutionBankEvidenceMeta['inputs'],
  startValue: string | null,
  finishValue: string | null,
  reason?: ExecutionBankUnknownReason
): BaselineEvidencePair => {
  const startMeta = meta(asOf, source, 'execution.bank.baseline-start', {
    ...inputs,
    value: startValue,
  });
  const finishMeta = meta(asOf, source, 'execution.bank.baseline-finish', {
    ...inputs,
    value: finishValue,
  });
  if (reason) {
    return {
      start: unknown(reason, startMeta),
      finish: unknown(reason, finishMeta),
    };
  }
  return {
    start: known(startValue as string, startMeta),
    finish: known(finishValue as string, finishMeta),
  };
};

const nativeAcceptedBaseline = (
  executionCase: ExecutionBankCaseSource | null,
  asOf: string
): { kind: 'ABSENT' | 'VALID' | 'INVALID' | 'AFTER_AS_OF'; evidence: BaselineEvidencePair } => {
  const missing = baselinePair(
    asOf,
    executionCase ? `ie_aggregate_state:${executionCase.executionCaseId}` : 'ie_aggregate_state',
    {},
    null,
    null,
    'BASELINE_MISSING'
  );
  if (!executionCase?.acceptedBaseline) return { kind: 'ABSENT', evidence: missing };
  const baseline = executionCase.acceptedBaseline.baseline;
  if (baseline == null) {
    return { kind: 'ABSENT', evidence: missing };
  }
  if (typeof baseline !== 'object' || Array.isArray(baseline)) {
    return {
      kind: 'INVALID',
      evidence: baselinePair(
        asOf,
        `ie_aggregate_state:${executionCase.executionCaseId}`,
        {},
        null,
        null,
        'BASELINE_INVALID'
      ),
    };
  }
  const raw = baseline as Record<string, unknown>;
  const rawStart = raw.plannedStartDate;
  const rawFinish = raw.plannedEndDate;
  if ((rawStart == null || rawStart === '') && (rawFinish == null || rawFinish === '')) {
    return { kind: 'ABSENT', evidence: missing };
  }
  const start = isoDate(rawStart);
  const finish = isoDate(rawFinish);
  const executionCaseVersion = positiveInteger(executionCase.version);
  const handoffPackageId = nonEmptyString(executionCase.handoffPackageId);
  const handoffPackageVersion = positiveInteger(executionCase.handoffPackageVersion);
  const observedAt = nonEmptyString(executionCase.acceptedAt);
  const inputs = {
    executionCaseVersion,
    handoffPackageId,
    handoffPackageVersion,
    observedAt,
    startValue: start,
    finishValue: finish,
  };
  const source = `ie_aggregate_state:${executionCase.executionCaseId}`;
  if (!start || !finish || dayNumber(start) > dayNumber(finish)) {
    return {
      kind: 'INVALID',
      evidence: baselinePair(asOf, source, inputs, start, finish, 'BASELINE_INVALID'),
    };
  }
  if (!observedAt) {
    return {
      kind: 'INVALID',
      evidence: baselinePair(asOf, source, inputs, start, finish, 'BASELINE_OBSERVATION_MISSING'),
    };
  }
  const observedTime = Date.parse(observedAt);
  if (
    !Number.isFinite(observedTime) ||
    !executionCaseVersion ||
    !handoffPackageId ||
    !handoffPackageVersion
  ) {
    return {
      kind: 'INVALID',
      evidence: baselinePair(asOf, source, inputs, start, finish, 'BASELINE_OBSERVATION_INVALID'),
    };
  }
  if (observedTime > Date.parse(asOf)) {
    return {
      kind: 'AFTER_AS_OF',
      evidence: baselinePair(asOf, source, inputs, start, finish, 'BASELINE_AFTER_AS_OF'),
    };
  }
  return { kind: 'VALID', evidence: baselinePair(asOf, source, inputs, start, finish) };
};

const baselineEvidence = (
  initiative: ExecutionBankInitiativeSource | undefined,
  executionCase: ExecutionBankCaseSource | null,
  asOf: string
): BaselineEvidencePair => {
  const native = nativeAcceptedBaseline(executionCase, asOf);
  const rawStart = initiative?.baselineStartDate;
  const rawFinish = initiative?.baselineEndDate;
  const modulePresent = Boolean(
    (rawStart != null && rawStart !== '') || (rawFinish != null && rawFinish !== '')
  );
  if (!modulePresent) return native.evidence;

  const start = isoDate(rawStart);
  const finish = isoDate(rawFinish);
  const sourceId = nonEmptyString(initiative?.scheduleBaselineId);
  const source = sourceId
    ? `initiative_schedule_baselines:${sourceId}`
    : 'initiative.schedule-baseline';
  const observedAt = nonEmptyString(initiative?.baselineObservedAt);
  const inputs = {
    baselineVersion: positiveInteger(initiative?.baselineVersion),
    observedAt,
    startValue: start,
    finishValue: finish,
  };
  const fieldEvidence = (
    field: 'start' | 'finish',
    rawValue: unknown,
    value: string | null
  ): ExecutionBankEvidence<string> => {
    const fieldMeta = meta(asOf, source, `execution.bank.baseline-${field}`, {
      ...inputs,
      value,
    });
    if (rawValue == null || rawValue === '') return unknown('BASELINE_MISSING', fieldMeta);
    return value ? known(value, fieldMeta) : unknown('BASELINE_INVALID', fieldMeta);
  };
  let moduleEvidence: BaselineEvidencePair = {
    start: fieldEvidence('start', rawStart, start),
    finish: fieldEvidence('finish', rawFinish, finish),
  };
  if (start && finish && dayNumber(start) > dayNumber(finish)) {
    moduleEvidence = baselinePair(asOf, source, inputs, start, finish, 'BASELINE_INVALID');
  }
  if (observedAt) {
    const observedTime = Date.parse(observedAt);
    if (!Number.isFinite(observedTime)) {
      return {
        start:
          moduleEvidence.start.status === 'KNOWN'
            ? unknown('BASELINE_OBSERVATION_INVALID', moduleEvidence.start.meta)
            : moduleEvidence.start,
        finish:
          moduleEvidence.finish.status === 'KNOWN'
            ? unknown('BASELINE_OBSERVATION_INVALID', moduleEvidence.finish.meta)
            : moduleEvidence.finish,
      };
    }
    if (observedTime > Date.parse(asOf)) {
      return native.kind === 'VALID'
        ? native.evidence
        : {
            start:
              moduleEvidence.start.status === 'KNOWN'
                ? unknown('BASELINE_AFTER_AS_OF', moduleEvidence.start.meta)
                : moduleEvidence.start,
            finish:
              moduleEvidence.finish.status === 'KNOWN'
                ? unknown('BASELINE_AFTER_AS_OF', moduleEvidence.finish.meta)
                : moduleEvidence.finish,
          };
    }
  }
  if (native.kind !== 'VALID') return moduleEvidence;
  const resolveField = (
    field: 'start' | 'finish',
    moduleField: ExecutionBankEvidence<string>,
    nativeField: ExecutionBankEvidence<string>
  ): ExecutionBankEvidence<string> => {
    if (moduleField.status === 'UNKNOWN' && moduleField.reason === 'BASELINE_MISSING') {
      return nativeField;
    }
    if (moduleField.status === 'UNKNOWN' || nativeField.status === 'UNKNOWN') return moduleField;
    if (moduleField.value === nativeField.value) return moduleField;
    return unknown(
      'SOURCE_CONFLICT',
      meta(
        asOf,
        `${moduleField.meta.source}|${nativeField.meta.source}`,
        `execution.bank.baseline-${field}`,
        { moduleValue: moduleField.value, nativeValue: nativeField.value }
      )
    );
  };
  return {
    start: resolveField('start', moduleEvidence.start, native.evidence.start),
    finish: resolveField('finish', moduleEvidence.finish, native.evidence.finish),
  };
};

const forecastEvidence = (
  value: string | null | undefined,
  observedAt: string | null | undefined,
  source: ExecutionBankCaseSource | null,
  asOf: string,
  field: 'start' | 'finish'
): ExecutionBankEvidence<string> => {
  const provenance = source?.forecastSource?.trim() || 'legacy-execution-case-forecast';
  const evidenceMeta = meta(
    asOf,
    provenance,
    `execution.bank.forecast-${field}`,
    { value: value ?? null, observedAt: observedAt ?? null },
    source?.forecastCompleteness ?? 'KNOWN',
    source?.forecastStaleness ?? 'UNKNOWN'
  );
  if (value == null || value === '') return unknown('FORECAST_MISSING', evidenceMeta);
  const parsed = isoDate(value);
  if (!parsed) return unknown('FORECAST_INVALID', evidenceMeta);
  if (!observedAt) return unknown('FORECAST_OBSERVATION_MISSING', evidenceMeta);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed)) return unknown('FORECAST_OBSERVATION_INVALID', evidenceMeta);
  if (observed > Date.parse(asOf)) return unknown('FORECAST_AFTER_AS_OF', evidenceMeta);
  return known(parsed, evidenceMeta);
};

const initiativeSourceEvidence = <T>(
  evidence: ExecutionBankInitiativeEvidenceSource<T> | null | undefined,
  asOf: string,
  formulaId: string,
  normalize: (value: T) => T | null,
  missingReason: ExecutionBankUnknownReason,
  invalidReason: ExecutionBankUnknownReason
): ExecutionBankEvidence<T> | null => {
  if (!evidence) return null;
  const source =
    [evidence.source?.system, evidence.source?.recordId].filter(Boolean).join(':') || 'initiative';
  const evidenceMeta = meta(
    asOf,
    source,
    evidence.source?.formulaId || formulaId,
    {
      value: evidence.value as string | number | boolean | null,
      observedAt: evidence.observedAt,
      sourceRecordId: evidence.source?.recordId ?? null,
      reason: evidence.reason ?? null,
    },
    evidence.completeness,
    evidence.staleness
  );
  evidenceMeta.formula.version = evidence.source?.formulaVersion ?? 1;
  if (evidence.value == null || evidence.completeness === 'UNKNOWN') {
    const reason =
      evidence.reason === 'VALUE_MISSING'
        ? missingReason
        : evidence.reason === 'VALUE_INVALID'
          ? invalidReason
          : ((evidence.reason as ExecutionBankUnknownReason | null) ?? missingReason);
    return unknown<T>(reason, evidenceMeta);
  }
  const normalized = normalize(evidence.value);
  if (normalized == null) return unknown<T>(invalidReason, evidenceMeta);
  const evidenceAsOf = Date.parse(evidence.asOf);
  if (!Number.isFinite(evidenceAsOf) || evidenceAsOf !== Date.parse(asOf)) {
    return unknown<T>('SOURCE_CONFLICT', evidenceMeta);
  }
  const observedAt = evidence.observedAt ? Date.parse(evidence.observedAt) : Number.NaN;
  if (!Number.isFinite(observedAt)) return unknown<T>('OBSERVATION_MISSING', evidenceMeta);
  if (observedAt > Date.parse(asOf)) return unknown<T>('FORECAST_AFTER_AS_OF', evidenceMeta);
  return known(normalized, evidenceMeta);
};

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00.000Z`) / DAY_MS;

const optionalFiniteNumber = (value: number | string | null | undefined): number | null => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildRow = (
  initiative: ExecutionBankInitiativeSource | undefined,
  executionCase: ExecutionBankCaseSource | null,
  asOf: string,
  identityMode: 'INITIATIVE' | 'LEGACY'
): ExecutionBankRow => {
  const baseline = baselineEvidence(initiative, executionCase, asOf);
  const baselineStart = baseline.start;
  const baselineFinish = baseline.finish;
  const currentPlanStart = dateEvidence(
    initiative?.currentPlanStartDate,
    asOf,
    'initiative.current-plan',
    'execution.bank.current-plan-start',
    'CURRENT_PLAN_MISSING',
    'CURRENT_PLAN_INVALID'
  );
  const currentPlanFinish = dateEvidence(
    initiative?.currentPlanEndDate,
    asOf,
    'initiative.current-plan',
    'execution.bank.current-plan-finish',
    'CURRENT_PLAN_MISSING',
    'CURRENT_PLAN_INVALID'
  );
  const forecastStart =
    initiativeSourceEvidence(
      initiative?.forecastStartEvidence,
      asOf,
      'execution.bank.forecast-start',
      (value) => isoDate(value),
      'FORECAST_MISSING',
      'FORECAST_INVALID'
    ) ??
    forecastEvidence(
      executionCase?.forecastStartDate,
      executionCase?.forecastObservedAt,
      executionCase,
      asOf,
      'start'
    );
  const forecastFinish =
    initiativeSourceEvidence(
      initiative?.forecastEndEvidence,
      asOf,
      'execution.bank.forecast-finish',
      (value) => isoDate(value),
      'FORECAST_MISSING',
      'FORECAST_INVALID'
    ) ??
    forecastEvidence(
      executionCase?.forecastEndDate,
      executionCase?.forecastObservedAt,
      executionCase,
      asOf,
      'finish'
    );
  const actualStart = dateEvidence(
    initiative?.actualStartDate,
    asOf,
    'initiative.actual',
    'execution.bank.actual-start',
    'ACTUAL_MISSING',
    'ACTUAL_INVALID'
  );
  const actualFinish = dateEvidence(
    initiative?.actualEndDate,
    asOf,
    'initiative.actual',
    'execution.bank.actual-finish',
    'ACTUAL_MISSING',
    'ACTUAL_INVALID'
  );

  const progressMeta = meta(
    asOf,
    'legacy-initiative-progress-unproven',
    'execution.bank.progress',
    {
      value: initiative?.progress ?? null,
    },
    'PARTIAL'
  );
  const progress =
    initiativeSourceEvidence(
      initiative?.progressEvidence,
      asOf,
      'execution.bank.progress',
      (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
      },
      'PROGRESS_MISSING',
      'PROGRESS_INVALID'
    ) ??
    (initiative?.progress == null
      ? unknown<number>('PROGRESS_MISSING', progressMeta)
      : Number.isFinite(Number(initiative.progress)) &&
          Number(initiative.progress) >= 0 &&
          Number(initiative.progress) <= 100
        ? known(Number(initiative.progress), progressMeta)
        : unknown<number>('PROGRESS_INVALID', progressMeta));
  const confidenceMeta = meta(asOf, 'initiative.confidence', 'execution.bank.confidence', {
    value: initiative?.confidence ?? null,
  });
  const confidence =
    initiative?.confidence == null || initiative.confidence === ''
      ? unknown<string | number>('CONFIDENCE_MISSING', confidenceMeta)
      : known<string | number>(initiative.confidence, confidenceMeta);

  const varianceInputs = {
    baselineFinish: baselineFinish.status === 'KNOWN' ? baselineFinish.value : null,
    forecastFinish: forecastFinish.status === 'KNOWN' ? forecastFinish.value : null,
    actualFinish: actualFinish.status === 'KNOWN' ? actualFinish.value : null,
  };
  const reference = actualFinish.status === 'KNOWN' ? actualFinish : forecastFinish;
  const referenceKind =
    actualFinish.status === 'KNOWN' ? ('ACTUAL' as const) : ('FORECAST' as const);
  const varianceMeta = meta(
    asOf,
    reference.status === 'KNOWN' ? reference.meta.source : 'execution-bank',
    'execution.bank.finish-variance-days',
    varianceInputs,
    baselineFinish.status === 'KNOWN' && reference.status === 'KNOWN' ? 'KNOWN' : 'UNKNOWN',
    reference.meta.staleness
  );
  let varianceDays: ExecutionBankRow['varianceDays'];
  if (baselineFinish.status === 'UNKNOWN')
    varianceDays = unknown<number>(baselineFinish.reason, varianceMeta);
  else if (actualFinish.status === 'UNKNOWN' && initiative?.actualEndDate)
    varianceDays = unknown<number>(actualFinish.reason, varianceMeta);
  else if (reference.status === 'UNKNOWN')
    varianceDays = unknown<number>(reference.reason, varianceMeta);
  else
    varianceDays = {
      ...known(dayNumber(reference.value) - dayNumber(baselineFinish.value), varianceMeta),
      reference: referenceKind,
    };

  const healthMeta = meta(
    asOf,
    executionCase?.healthSource?.trim() || 'execution-case',
    'execution.bank.health',
    { value: executionCase?.health ?? null }
  );
  const health = executionCase?.health
    ? known(executionCase.health, healthMeta)
    : unknown<string>('HEALTH_MISSING', healthMeta);
  const updatedRaw = executionCase?.updatedAt ?? initiative?.updatedAt;
  const updatedMeta = meta(
    asOf,
    executionCase?.updatedAt ? 'execution-case' : 'initiative',
    'execution.bank.updated-at',
    { value: updatedRaw ?? null }
  );
  const updatedTime = updatedRaw ? Date.parse(updatedRaw) : Number.NaN;
  const updatedAt = !updatedRaw
    ? unknown<string>('UPDATED_AT_MISSING', updatedMeta)
    : Number.isFinite(updatedTime)
      ? known(new Date(updatedTime).toISOString(), updatedMeta)
      : unknown<string>('UPDATED_AT_INVALID', updatedMeta);

  const displayFinish: ExecutionBankRow['displayFinish'] =
    actualFinish.status === 'KNOWN'
      ? { ...actualFinish, reference: 'ACTUAL' }
      : forecastFinish.status === 'KNOWN'
        ? { ...forecastFinish, reference: 'FORECAST' }
        : currentPlanFinish.status === 'KNOWN'
          ? { ...currentPlanFinish, reference: 'CURRENT_PLAN' }
          : unknown<string>(
              currentPlanFinish.status === 'UNKNOWN'
                ? currentPlanFinish.reason
                : 'CURRENT_PLAN_MISSING',
              meta(asOf, 'execution-bank', 'execution.bank.display-finish', {
                actual: null,
                forecast: null,
                currentPlan: null,
              })
            );

  return {
    // The Execution Case is an implementation shadow. Bank identity is always
    // the Initiative identity visible to the user (F2-2 R0.3).
    id:
      identityMode === 'INITIATIVE'
        ? (executionCase?.initiativeId ?? initiative?.id ?? 'missing-initiative')
        : (executionCase?.executionCaseId ??
          (initiative?.id ? `initiative:${initiative.id}` : 'missing-initiative')),
    initiativeId: executionCase?.initiativeId ?? initiative?.id ?? '',
    executionCaseId: executionCase?.executionCaseId ?? null,
    executionCaseVersion: optionalFiniteNumber(executionCase?.version),
    name:
      initiative?.name ||
      executionCase?.initiativeTitle ||
      executionCase?.executionCaseId ||
      'Unknown Initiative',
    description: initiative?.description ?? null,
    lifecycleStatus: initiative?.lifecycleStatus || 'UNKNOWN',
    handoff: buildExecutionBankHandoff(
      initiative?.lifecycleStatus || 'UNKNOWN',
      executionCase
    ),
    projectId: initiative?.projectId?.trim() || null,
    priority: initiative?.priority?.trim() || null,
    executionState: executionCase?.state || 'UNKNOWN',
    executionPhase: executionCase?.executionPhase ?? null,
    ownerId: executionCase?.executionManagerId ?? initiative?.ownerId ?? null,
    ownerName: initiative?.ownerName ?? null,
    deliveryProfile: executionCase?.deliveryProfile ?? null,
    progress,
    confidence,
    baselineStart,
    baselineFinish,
    currentPlanStart,
    currentPlanFinish,
    forecastStart,
    forecastFinish,
    actualStart,
    actualFinish,
    varianceDays,
    health,
    blockerCount: optionalFiniteNumber(executionCase?.blockerCount),
    pendingDecisionCount: optionalFiniteNumber(executionCase?.pendingDecisionCount),
    resourceConstraint: executionCase?.resourceConstraint ?? null,
    nextAction: executionCase?.nextAction ?? null,
    updatedAt,
    displayFinish,
  };
};

const healthRank = (row: ExecutionBankRow): number => {
  if (row.health.status === 'UNKNOWN') return 1;
  return (
    ({ CRITICAL: 5, AT_RISK: 4, ON_TRACK: 2, NOT_APPLICABLE: 0 } as Record<string, number>)[
      row.health.value.toUpperCase()
    ] ?? 1
  );
};

export function buildExecutionBankRows(
  initiatives: readonly ExecutionBankInitiativeSource[],
  executionCases: readonly ExecutionBankCaseSource[],
  options: { asOf: string; identityMode?: 'INITIATIVE' | 'LEGACY' }
): ExecutionBankRow[] {
  const asOf = controlledAsOf(options.asOf);
  const identityMode = options.identityMode ?? 'LEGACY';
  const initiativesById = new Map(initiatives.map((initiative) => [initiative.id, initiative]));
  const validCases = executionCases.filter(
    (executionCase) => executionCase.executionCaseId && executionCase.initiativeId
  );
  const casesByInitiative = new Map<string, ExecutionBankCaseSource>();
  for (const executionCase of validCases) {
    const current = casesByInitiative.get(executionCase.initiativeId);
    const currentVersion = optionalFiniteNumber(current?.version) ?? -1;
    const candidateVersion = optionalFiniteNumber(executionCase.version) ?? -1;
    const currentUpdatedAt = Date.parse(current?.updatedAt ?? '') || 0;
    const candidateUpdatedAt = Date.parse(executionCase.updatedAt ?? '') || 0;
    if (
      !current ||
      candidateVersion > currentVersion ||
      (candidateVersion === currentVersion && candidateUpdatedAt > currentUpdatedAt) ||
      (candidateVersion === currentVersion &&
        candidateUpdatedAt === currentUpdatedAt &&
        executionCase.executionCaseId.localeCompare(current.executionCaseId) > 0)
    ) {
      casesByInitiative.set(executionCase.initiativeId, executionCase);
    }
  }
  const visibleCases = identityMode === 'INITIATIVE' ? [...casesByInitiative.values()] : validCases;
  const initiativeIdsWithCases = new Set(
    visibleCases.map((executionCase) => executionCase.initiativeId)
  );
  return [
    ...visibleCases.map((executionCase) =>
      buildRow(initiativesById.get(executionCase.initiativeId), executionCase, asOf, identityMode)
    ),
    ...initiatives
      .filter((initiative) => !initiativeIdsWithCases.has(initiative.id))
      .map((initiative) => buildRow(initiative, null, asOf, identityMode)),
  ].sort((a, b) => {
    const health = healthRank(b) - healthRank(a);
    if (health) return health;
    const blockers = (b.blockerCount ?? 0) - (a.blockerCount ?? 0);
    if (blockers) return blockers;
    const varianceA =
      a.varianceDays.status === 'KNOWN' ? a.varianceDays.value : Number.NEGATIVE_INFINITY;
    const varianceB =
      b.varianceDays.status === 'KNOWN' ? b.varianceDays.value : Number.NEGATIVE_INFINITY;
    if (varianceA !== varianceB) return varianceB - varianceA;
    return (
      a.name.localeCompare(b.name) ||
      (a.executionCaseId ?? '').localeCompare(b.executionCaseId ?? '')
    );
  });
}

export function filterExecutionBankRows(
  rows: readonly ExecutionBankRow[],
  filter: ExecutionBankFilter = {}
): ExecutionBankRow[] {
  const search = filter.search?.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (
      search &&
      !`${row.name} ${row.description ?? ''} ${row.initiativeId} ${row.executionCaseId ?? ''}`
        .toLocaleLowerCase()
        .includes(search)
    )
      return false;
    if (filter.lifecycleStatuses?.length && !filter.lifecycleStatuses.includes(row.lifecycleStatus))
      return false;
    if (filter.executionStates?.length && !filter.executionStates.includes(row.executionState))
      return false;
    if (
      filter.executionPhases?.length &&
      !filter.executionPhases.includes(row.executionPhase ?? 'UNKNOWN')
    )
      return false;
    if (filter.ownerIds?.length && !filter.ownerIds.includes(row.ownerId ?? 'UNKNOWN'))
      return false;
    if (filter.projectIds?.length && !filter.projectIds.includes(row.projectId)) return false;
    if (
      filter.priorities?.length &&
      !filter.priorities.some(
        (priority) =>
          priority.toLocaleUpperCase() === (row.priority ?? 'UNKNOWN').toLocaleUpperCase()
      )
    )
      return false;
    if (filter.timeWindow) {
      if (row.displayFinish.status !== 'KNOWN') return false;
      const finish = row.displayFinish.value.slice(0, 10);
      if (filter.timeWindow.start && finish < filter.timeWindow.start.slice(0, 10)) return false;
      if (filter.timeWindow.endExclusive && finish >= filter.timeWindow.endExclusive.slice(0, 10))
        return false;
    }
    if (
      filter.health?.length &&
      !filter.health.includes(row.health.status === 'KNOWN' ? row.health.value : 'UNKNOWN')
    )
      return false;
    if (filter.dataIssues?.length) {
      const matches = filter.dataIssues.some((issue) =>
        issue === 'MISSING_BASELINE'
          ? row.baselineFinish.status === 'UNKNOWN'
          : issue === 'MISSING_FORECAST'
            ? row.forecastFinish.status === 'UNKNOWN'
            : row.progress.status === 'UNKNOWN'
      );
      if (!matches) return false;
    }
    switch (filter.preset) {
      case 'AT_RISK':
        if (!(row.health.status === 'KNOWN' && row.health.value === 'AT_RISK')) return false;
        break;
      case 'CRITICAL':
        if (!(row.health.status === 'KNOWN' && row.health.value === 'CRITICAL')) return false;
        break;
      case 'MISSING_BASELINE':
        if (row.baselineFinish.status !== 'UNKNOWN') return false;
        break;
      case 'MISSING_FORECAST':
        if (row.forecastFinish.status !== 'UNKNOWN') return false;
        break;
      case 'UNKNOWN_DATA':
        if (
          ![row.progress, row.baselineFinish, row.forecastFinish, row.health].some(
            (item) => item.status === 'UNKNOWN'
          )
        )
          return false;
        break;
      default:
        break;
    }
    return true;
  });
}

const pad = (value: number) => String(value).padStart(2, '0');
const formatUtcDate = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

const weeklyBuckets = (start: Date, endExclusive: Date): ExecutionCalendarBucket[] => {
  const buckets: ExecutionCalendarBucket[] = [];
  let cursor = new Date(start);
  while (cursor < endExclusive) {
    const next = new Date(Math.min(cursor.getTime() + 7 * DAY_MS, endExclusive.getTime()));
    const bucketStart = formatUtcDate(cursor);
    const bucketEnd = formatUtcDate(next);
    buckets.push({
      id: `week-${bucketStart}`,
      label: bucketStart,
      start: bucketStart,
      endExclusive: bucketEnd,
    });
    cursor = next;
  }
  return buckets;
};

const monthlyBuckets = (start: Date, endExclusive: Date): ExecutionCalendarBucket[] => {
  const buckets: ExecutionCalendarBucket[] = [];
  let cursor = new Date(start);
  while (cursor < endExclusive) {
    const next = addMonths(cursor, 1);
    const bucketStart = formatUtcDate(cursor);
    const bucketEnd = formatUtcDate(next);
    buckets.push({
      id: `month-${bucketStart.slice(0, 7)}`,
      label: bucketStart.slice(0, 7),
      start: bucketStart,
      endExclusive: bucketEnd,
    });
    cursor = next;
  }
  return buckets;
};

export function buildExecutionCalendarWindow(
  asOfInput: string,
  horizonMonths: ExecutionBankHorizonMonths,
  drilldownMonth?: string | null
): ExecutionCalendarWindow {
  const asOf = controlledAsOf(asOfInput);
  const start = startOfMonth(new Date(asOf));
  const endExclusive = addMonths(start, horizonMonths);
  const resolution: ExecutionBankResolution = horizonMonths <= 3 ? 'WEEK' : 'MONTH';
  const buckets =
    resolution === 'WEEK'
      ? weeklyBuckets(start, endExclusive)
      : monthlyBuckets(start, endExclusive);
  let drilldown: ExecutionCalendarWindow['drilldown'] = null;
  if (resolution === 'MONTH' && drilldownMonth && /^\d{4}-\d{2}$/.test(drilldownMonth)) {
    const monthStart = new Date(`${drilldownMonth}-01T00:00:00.000Z`);
    const monthEnd = addMonths(monthStart, 1);
    if (monthStart >= start && monthStart < endExclusive) {
      drilldown = {
        month: drilldownMonth,
        start: formatUtcDate(monthStart),
        endExclusive: formatUtcDate(monthEnd),
        resolution: 'WEEK',
        buckets: weeklyBuckets(monthStart, monthEnd),
      };
    }
  }
  const startText = formatUtcDate(start);
  const endText = formatUtcDate(endExclusive);
  return {
    asOf,
    horizonMonths,
    resolution,
    start: startText,
    endExclusive: endText,
    buckets,
    drilldown,
    provenance: meta(
      asOf,
      'execution-bank-calendar',
      'execution.bank.calendar-window',
      { horizonMonths, drilldownMonth: drilldownMonth ?? null },
      'KNOWN',
      'CURRENT',
      { start: startText, endExclusive: endText }
    ),
  };
}
