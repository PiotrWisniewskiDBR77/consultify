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
  | 'CURRENT_PLAN_MISSING'
  | 'CURRENT_PLAN_INVALID'
  | 'FORECAST_MISSING'
  | 'FORECAST_INVALID'
  | 'FORECAST_OBSERVATION_MISSING'
  | 'FORECAST_OBSERVATION_INVALID'
  | 'FORECAST_AFTER_AS_OF'
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

export interface ExecutionBankInitiativeSource {
  id: string;
  name: string;
  description?: string | null;
  lifecycleStatus?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  progress?: number | null;
  confidence?: string | number | null;
  baselineStartDate?: string | null;
  baselineEndDate?: string | null;
  currentPlanStartDate?: string | null;
  currentPlanEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  updatedAt?: string | null;
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
}

export interface ExecutionBankFilter {
  search?: string;
  lifecycleStatuses?: readonly string[];
  executionStates?: readonly string[];
  executionPhases?: readonly string[];
  ownerIds?: readonly string[];
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

const forecastEvidence = (
  value: string | null | undefined,
  observedAt: string | null | undefined,
  source: ExecutionBankCaseSource | null,
  asOf: string,
  field: 'start' | 'finish'
): ExecutionBankEvidence<string> => {
  const provenance = source?.forecastSource?.trim() || 'execution-case';
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

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00.000Z`) / DAY_MS;

const optionalFiniteNumber = (value: number | string | null | undefined): number | null => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildRow = (
  initiative: ExecutionBankInitiativeSource | undefined,
  executionCase: ExecutionBankCaseSource | null,
  asOf: string
): ExecutionBankRow => {
  const baselineStart = dateEvidence(
    initiative?.baselineStartDate,
    asOf,
    'initiative.schedule-baseline',
    'execution.bank.baseline-start',
    'BASELINE_MISSING',
    'BASELINE_INVALID'
  );
  const baselineFinish = dateEvidence(
    initiative?.baselineEndDate,
    asOf,
    'initiative.schedule-baseline',
    'execution.bank.baseline-finish',
    'BASELINE_MISSING',
    'BASELINE_INVALID'
  );
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
  const forecastStart = forecastEvidence(
    executionCase?.forecastStartDate,
    executionCase?.forecastObservedAt,
    executionCase,
    asOf,
    'start'
  );
  const forecastFinish = forecastEvidence(
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

  const progressMeta = meta(asOf, 'initiative.progress', 'execution.bank.progress', {
    value: initiative?.progress ?? null,
  });
  const progress =
    initiative?.progress == null
      ? unknown<number>('PROGRESS_MISSING', progressMeta)
      : Number.isFinite(Number(initiative.progress)) &&
          Number(initiative.progress) >= 0 &&
          Number(initiative.progress) <= 100
        ? known(Number(initiative.progress), progressMeta)
        : unknown<number>('PROGRESS_INVALID', progressMeta);
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
    id: executionCase?.executionCaseId ?? `initiative:${initiative?.id ?? 'missing'}`,
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
  options: { asOf: string }
): ExecutionBankRow[] {
  const asOf = controlledAsOf(options.asOf);
  const initiativesById = new Map(initiatives.map((initiative) => [initiative.id, initiative]));
  const validCases = executionCases.filter(
    (executionCase) => executionCase.executionCaseId && executionCase.initiativeId
  );
  const initiativeIdsWithCases = new Set(
    validCases.map((executionCase) => executionCase.initiativeId)
  );
  return [
    ...validCases.map((executionCase) =>
      buildRow(initiativesById.get(executionCase.initiativeId), executionCase, asOf)
    ),
    ...initiatives
      .filter((initiative) => !initiativeIdsWithCases.has(initiative.id))
      .map((initiative) => buildRow(initiative, null, asOf)),
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
