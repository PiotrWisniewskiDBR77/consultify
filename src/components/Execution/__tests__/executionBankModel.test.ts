import { describe, expect, it } from 'vitest';

import {
  buildExecutionBankRows,
  buildExecutionCalendarWindow,
  type ExecutionBankCaseSource,
  type ExecutionBankInitiativeSource,
  filterExecutionBankRows,
} from '../executionBankModel';

const initiatives: ExecutionBankInitiativeSource[] = [
  {
    id: 'initiative-a',
    name: 'Alpha',
    lifecycleStatus: 'IN_EXECUTION',
    projectId: 'project-1',
    priority: 'HIGH',
    ownerId: 'owner-1',
    progress: null,
    baselineEndDate: '2028-02-10',
    currentPlanEndDate: '2028-03-20',
    actualEndDate: null,
    updatedAt: '2028-01-20T10:00:00Z',
  },
  {
    id: 'initiative-b',
    name: 'Beta',
    lifecycleStatus: 'SCHEDULED',
    projectId: null,
    priority: 'LOW',
    ownerId: null,
    progress: null,
    baselineEndDate: null,
    currentPlanEndDate: 'not-a-date',
    actualEndDate: null,
  },
  {
    id: 'initiative-c',
    name: 'Gamma',
    lifecycleStatus: 'CLOSED',
    projectId: 'project-2',
    priority: 'MEDIUM',
    ownerId: 'owner-2',
    progress: 100,
    baselineEndDate: '2028-02-28',
    currentPlanEndDate: '2028-03-10',
    actualEndDate: '2028-02-29',
  },
];

const cases: ExecutionBankCaseSource[] = [
  {
    executionCaseId: 'case-a',
    initiativeId: 'initiative-a',
    version: 4,
    state: 'ACTIVE',
    executionPhase: 'DELIVERY',
    deliveryProfile: 'STANDARD',
    forecastEndDate: '2028-03-01',
    forecastObservedAt: '2028-01-15T12:00:00Z',
    forecastSource: 'execution-case',
    health: 'AT_RISK',
    blockerCount: 0,
    pendingDecisionCount: 1,
  },
  { executionCaseId: 'case-b', initiativeId: 'initiative-b', version: 2, state: 'ACTIVE' },
  { executionCaseId: 'case-c', initiativeId: 'initiative-c', version: 7, state: 'CLOSED' },
];

describe('E1b executionBankModel', () => {
  it('keeps lifecycle, execution state and native identities separate while using forecast or fixed actual variance', () => {
    const rows = buildExecutionBankRows(initiatives, cases, {
      asOf: '2028-01-31T00:00:00Z',
      identityMode: 'INITIATIVE',
    });
    expect(rows.map((row) => [row.initiativeId, row.executionCaseId])).toEqual([
      ['initiative-a', 'case-a'],
      ['initiative-c', 'case-c'],
      ['initiative-b', 'case-b'],
    ]);
    expect(rows[0]).toMatchObject({
      id: 'initiative-a',
      lifecycleStatus: 'IN_EXECUTION',
      executionState: 'ACTIVE',
      executionCaseVersion: 4,
    });
    expect(rows[0].varianceDays).toMatchObject({
      status: 'KNOWN',
      value: 20,
      reference: 'FORECAST',
    });
    expect(rows[0].varianceDays.meta).toMatchObject({
      asOf: '2028-01-31T00:00:00.000Z',
      source: 'execution-case',
      completeness: 'KNOWN',
      formula: { id: 'execution.bank.finish-variance-days', version: 1 },
    });
    expect(rows[0].varianceDays.meta.inputs).toEqual({
      baselineFinish: '2028-02-10',
      forecastFinish: '2028-03-01',
      actualFinish: null,
    });
    expect(rows[0].currentPlanFinish).toMatchObject({ status: 'KNOWN', value: '2028-03-20' });
    expect(rows[1].varianceDays).toMatchObject({ status: 'KNOWN', value: 1, reference: 'ACTUAL' });
  });

  it('renders one user-facing Initiative when several technical Execution Case shadows exist', () => {
    const rows = buildExecutionBankRows(
      [initiatives[0]],
      [
        { ...cases[0], executionCaseId: 'case-a-v3', version: 3 },
        { ...cases[0], executionCaseId: 'case-a-v5', version: 5 },
        { ...cases[0], executionCaseId: 'case-a-v4', version: 4 },
      ],
      { asOf: '2028-01-31', identityMode: 'INITIATIVE' }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'initiative-a',
      initiativeId: 'initiative-a',
      executionCaseId: 'case-a-v5',
      executionCaseVersion: 5,
    });
  });

  it('preserves the legacy row identity when the new default-OFF feature is not enabled', () => {
    const rows = buildExecutionBankRows(
      [initiatives[0], { ...initiatives[1], id: 'initiative-without-case' }],
      [cases[0]],
      { asOf: '2028-01-31', identityMode: 'LEGACY' }
    );

    expect(rows.map((row) => row.id).sort()).toEqual([
      'case-a',
      'initiative:initiative-without-case',
    ]);
  });

  it('keeps missing and invalid evidence UNKNOWN with reasons instead of zero or invented dates', () => {
    const [row] = buildExecutionBankRows([initiatives[1]], [cases[1]], { asOf: '2028-01-31' });
    expect(row.progress).toMatchObject({
      status: 'UNKNOWN',
      value: null,
      reason: 'PROGRESS_MISSING',
    });
    expect(row.baselineFinish).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_MISSING' });
    expect(row.forecastFinish).toMatchObject({ status: 'UNKNOWN', reason: 'FORECAST_MISSING' });
    expect(row.currentPlanFinish).toMatchObject({
      status: 'UNKNOWN',
      reason: 'CURRENT_PLAN_INVALID',
    });
    expect(row.varianceDays).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_MISSING' });
    expect(row.health).toMatchObject({ status: 'UNKNOWN', reason: 'HEALTH_MISSING' });
  });

  it('keeps missing case counters and version distinct from a measured numeric zero', () => {
    const rows = buildExecutionBankRows(
      [
        { id: 'initiative-null', name: 'Missing numbers', lifecycleStatus: 'IN_EXECUTION' },
        { id: 'initiative-zero', name: 'Measured zero', lifecycleStatus: 'IN_EXECUTION' },
      ],
      [
        {
          executionCaseId: 'case-null',
          initiativeId: 'initiative-null',
          version: null,
          blockerCount: '',
          pendingDecisionCount: null,
        },
        {
          executionCaseId: 'case-zero',
          initiativeId: 'initiative-zero',
          version: 0,
          blockerCount: 0,
          pendingDecisionCount: '0',
        },
      ],
      { asOf: '2028-01-31T00:00:00Z' }
    );
    const missing = rows.find((row) => row.executionCaseId === 'case-null');
    const zero = rows.find((row) => row.executionCaseId === 'case-zero');

    expect(missing).toMatchObject({
      executionCaseVersion: null,
      blockerCount: null,
      pendingDecisionCount: null,
    });
    expect(zero).toMatchObject({
      executionCaseVersion: 0,
      blockerCount: 0,
      pendingDecisionCount: 0,
    });
  });

  it('rejects a forecast observed after controlled asOf and never substitutes current plan', () => {
    const future = { ...cases[0], forecastObservedAt: '2028-02-01T00:00:00Z' };
    const [row] = buildExecutionBankRows([initiatives[0]], [future], {
      asOf: '2028-01-31T23:59:59Z',
    });
    expect(row.forecastFinish).toMatchObject({ status: 'UNKNOWN', reason: 'FORECAST_AFTER_AS_OF' });
    expect(row.varianceDays).toMatchObject({ status: 'UNKNOWN', reason: 'FORECAST_AFTER_AS_OF' });
    expect(row.currentPlanFinish).toMatchObject({ status: 'KNOWN', value: '2028-03-20' });
  });

  it('uses per-field Initiative evidence ahead of the legacy Execution Case forecast and preserves provenance', () => {
    const [row] = buildExecutionBankRows(
      [
        {
          ...initiatives[0],
          progress: 99,
          progressEvidence: {
            value: 42,
            observedAt: '2028-01-14T10:00:00.000Z',
            asOf: '2028-01-31T00:00:00.000Z',
            source: {
              system: 'initiative_history',
              recordId: 'progress-receipt',
              formulaId: null,
              formulaVersion: null,
            },
            completeness: 'KNOWN',
            staleness: 'UNKNOWN',
            reason: 'FRESHNESS_POLICY_MISSING',
          },
          forecastEndEvidence: {
            value: '2028-04-01',
            observedAt: '2028-01-15T10:00:00.000Z',
            asOf: '2028-01-31T00:00:00.000Z',
            source: {
              system: 'initiative_history',
              recordId: 'forecast-end-receipt',
              formulaId: null,
              formulaVersion: null,
            },
            completeness: 'KNOWN',
            staleness: 'UNKNOWN',
            reason: 'FRESHNESS_POLICY_MISSING',
          },
        },
      ],
      [cases[0]],
      { asOf: '2028-01-31T00:00:00.000Z' }
    );

    expect(row.progress).toMatchObject({
      status: 'KNOWN',
      value: 42,
      meta: { source: 'initiative_history:progress-receipt', completeness: 'KNOWN' },
    });
    expect(row.forecastFinish).toMatchObject({
      status: 'KNOWN',
      value: '2028-04-01',
      meta: { source: 'initiative_history:forecast-end-receipt' },
    });
    expect(row.varianceDays).toMatchObject({ status: 'KNOWN', value: 51 });
  });

  it('builds real 1/3/6/12 calendar-month windows with weekly and monthly resolution plus leap-week drilldown', () => {
    expect(buildExecutionCalendarWindow('2027-12-15', 1)).toMatchObject({
      start: '2027-12-01',
      endExclusive: '2028-01-01',
      resolution: 'WEEK',
      horizonMonths: 1,
    });
    const quarter = buildExecutionCalendarWindow('2027-12-15', 3);
    expect(quarter).toMatchObject({
      start: '2027-12-01',
      endExclusive: '2028-03-01',
      resolution: 'WEEK',
    });
    expect(
      quarter.buckets.some(
        (bucket) => bucket.start <= '2028-02-29' && bucket.endExclusive > '2028-02-29'
      )
    ).toBe(true);
    const half = buildExecutionCalendarWindow('2028-01-31', 6, '2028-02');
    expect(half).toMatchObject({
      start: '2028-01-01',
      endExclusive: '2028-07-01',
      resolution: 'MONTH',
    });
    expect(half.buckets).toHaveLength(6);
    expect(
      half.drilldown?.buckets.some(
        (bucket) => bucket.start <= '2028-02-29' && bucket.endExclusive > '2028-02-29'
      )
    ).toBe(true);
    const year = buildExecutionCalendarWindow('2028-01-31', 12);
    expect(year).toMatchObject({
      start: '2028-01-01',
      endExclusive: '2029-01-01',
      resolution: 'MONTH',
    });
    expect(year.buckets).toHaveLength(12);
  });

  it('applies one deterministic filter and sort contract to the shared rows', () => {
    const rows = buildExecutionBankRows(initiatives, cases, { asOf: '2028-01-31' });
    expect(
      filterExecutionBankRows(rows, { ownerIds: ['owner-1'], search: 'alpha' }).map(
        (row) => row.executionCaseId
      )
    ).toEqual(['case-a']);
    expect(
      filterExecutionBankRows(rows, { dataIssues: ['MISSING_FORECAST'] }).map(
        (row) => row.executionCaseId
      )
    ).toEqual(['case-c', 'case-b']);
    expect(
      filterExecutionBankRows(rows, { projectIds: [null] }).map((row) => row.initiativeId)
    ).toEqual(['initiative-b']);
    expect(
      filterExecutionBankRows(rows, { projectIds: ['project-1'], priorities: ['high'] }).map(
        (row) => row.initiativeId
      )
    ).toEqual(['initiative-a']);
    expect(
      filterExecutionBankRows(rows, {
        timeWindow: { start: '2028-02-01', endExclusive: '2028-03-02' },
      }).map((row) => row.initiativeId)
    ).toEqual(['initiative-a', 'initiative-c']);
  });
});

/**
 * F12 (2026-09-15) — KSZTAŁT ZAAKCEPTOWANEGO BASELINE'U.
 *
 * `nativeAcceptedBaseline` czytał WYŁĄCZNIE `plannedStartDate`/`plannedEndDate`.
 * POMIAR na żywym stagingu (Northwind, `GET /api/initiatives/runtime-v1/
 * execution-cases`, 4 sprawy w realizacji — dowód
 * `cto-codex/fala-f12-20260915/pomiar/SNAPSHOT-execution-cases-przed.json`)
 * pokazał kształt `{ start, end, requiredFte }` i ZERO kluczy `planned*`.
 * Skutek na ekranie: „Baseline start" puste, „Baseline finish" pokazujące
 * przeterminowane `initiatives.baseline_end_date` (29 Jan 2027 dla trzech
 * różnych inicjatyw), a „Variance" licząca 103 dni zamiast 42.
 *
 * DOWÓD MUTACYJNY: przywrócenie `raw.plannedStartDate` bez gałęzi `raw.start`
 * łamie pierwszy test (BASELINE_MISSING zamiast daty).
 */
describe('F12 — baseline z ie_aggregate_state czytany w ZAPISANYM kształcie', () => {
  const inicjatywa: ExecutionBankInitiativeSource = {
    id: 'skills',
    name: 'Skills Matrix and Upskilling',
    lifecycleStatus: 'IN_EXECUTION',
    progress: 30,
    baselineStartDate: null,
    baselineEndDate: null,
    currentPlanStartDate: '2026-02-02',
    currentPlanEndDate: '2026-12-18',
  };
  const sprawa = (baseline: Record<string, unknown>): ExecutionBankCaseSource => ({
    executionCaseId: 'case-skills',
    initiativeId: 'skills',
    version: 1,
    state: 'ACTIVE',
    handoffPackageId: 'handoff:skills:v4',
    handoffPackageVersion: 1,
    acceptedAt: '2026-09-08T14:48:41.790Z',
    acceptedBaseline: { baseline },
  });

  it('kształt {start,end} — ten, który naprawdę leży w bazie — daje ZNANY baseline', () => {
    const [row] = buildExecutionBankRows(
      [inicjatywa],
      [sprawa({ start: '2026-02-02', end: '2026-12-18', requiredFte: 0.9 })],
      { asOf: '2026-09-15' }
    );

    expect(row.baselineStart.status).toBe('KNOWN');
    expect(row.baselineStart.value).toBe('2026-02-02');
    expect(row.baselineFinish.status).toBe('KNOWN');
    expect(row.baselineFinish.value).toBe('2026-12-18');
  });

  it('starszy kształt {plannedStartDate,plannedEndDate} działa jak dotąd', () => {
    const [row] = buildExecutionBankRows(
      [inicjatywa],
      [sprawa({ plannedStartDate: '2026-02-02', plannedEndDate: '2026-12-18' })],
      { asOf: '2026-09-15' }
    );

    expect(row.baselineStart.value).toBe('2026-02-02');
    expect(row.baselineFinish.value).toBe('2026-12-18');
  });

  it('jawny null w kształcie planned* NIE sięga po start/end (brak to decyzja)', () => {
    const [row] = buildExecutionBankRows(
      [inicjatywa],
      [
        sprawa({
          plannedStartDate: null,
          plannedEndDate: null,
          start: '2026-02-02',
          end: '2026-12-18',
        }),
      ],
      { asOf: '2026-09-15' }
    );

    expect(row.baselineStart.status).toBe('UNKNOWN');
    expect(row.baselineFinish.status).toBe('UNKNOWN');
  });

  it('odchylenie liczy się od ZAAKCEPTOWANEGO baselinu, nie od przeterminowanej kopii', () => {
    const [row] = buildExecutionBankRows(
      [
        {
          ...inicjatywa,
          forecastEndDate: '2026-12-04',
          forecastStartDate: '2026-02-02',
        },
      ],
      [
        {
          ...sprawa({ start: '2026-02-02', end: '2026-12-18', requiredFte: 0.9 }),
          forecastEndDate: '2026-12-04',
          forecastObservedAt: '2026-09-14T10:00:00Z',
        },
      ],
      { asOf: '2026-09-15' }
    );

    expect(row.varianceDays.status).toBe('KNOWN');
    expect(row.varianceDays.value).toBe(-14);
  });
});
