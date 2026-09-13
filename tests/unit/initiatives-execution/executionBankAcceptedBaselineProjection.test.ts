import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import {
  buildExecutionBankRows,
  executionBankBaselineSource,
  type ExecutionBankCaseSource,
  type ExecutionBankInitiativeSource,
} from '../../../src/components/Execution/executionBankModel';

const AS_OF = '2028-01-31T00:00:00.000Z';

function initiative(
  overrides: Partial<ExecutionBankInitiativeSource> = {}
): ExecutionBankInitiativeSource {
  return {
    id: 'initiative-native',
    name: 'Native baseline projection',
    lifecycleStatus: 'IN_EXECUTION',
    ...overrides,
  };
}

function executionCase(overrides: Record<string, unknown> = {}): ExecutionBankCaseSource {
  return {
    executionCaseId: 'case-native',
    initiativeId: 'initiative-native',
    version: 3,
    state: 'ACTIVE',
    handoffPackageId: 'handoff-native-v7',
    handoffPackageVersion: 7,
    acceptedAt: '2028-01-10T12:00:00.000Z',
    acceptedBaseline: {
      baseline: {
        plannedStartDate: '2028-02-01',
        plannedEndDate: '2028-03-15',
      },
      plan: { window: { earliest: '2028-01-01', latest: '2028-12-31' } },
    },
    ...overrides,
  } as ExecutionBankCaseSource;
}

describe('E1b native accepted baseline read projection', () => {
  it('uses exact accepted Case baseline dates with existing Case/handoff provenance', () => {
    const [row] = buildExecutionBankRows([initiative()], [executionCase()], { asOf: AS_OF });

    expect(row.baselineStart).toMatchObject({
      status: 'KNOWN',
      value: '2028-02-01',
      meta: {
        source: 'ie_aggregate_state:case-native',
        formula: { id: 'execution.bank.baseline-start', version: 1 },
        inputs: {
          executionCaseVersion: 3,
          handoffPackageId: 'handoff-native-v7',
          handoffPackageVersion: 7,
          observedAt: '2028-01-10T12:00:00.000Z',
        },
      },
    });
    expect(row.baselineFinish).toMatchObject({ status: 'KNOWN', value: '2028-03-15' });
  });

  it('does not infer exact baseline dates from a Plan window or a status-only baseline', () => {
    const [row] = buildExecutionBankRows(
      [initiative()],
      [
        executionCase({
          acceptedBaseline: {
            baseline: { status: 'governed' },
            plan: {
              window: {
                earliest: '2028-02-01',
                target: '2028-02-15',
                latest: '2028-03-01',
              },
            },
          },
        }),
      ],
      { asOf: AS_OF }
    );

    expect(row.baselineStart).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_MISSING' });
    expect(row.baselineFinish).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_MISSING' });
  });

  it.each([
    {
      name: 'malformed date',
      patch: { plannedStartDate: {}, plannedEndDate: '2028-03-15' },
      acceptedAt: '2028-01-10T12:00:00.000Z',
      reason: 'BASELINE_INVALID',
    },
    {
      name: 'inverted range',
      patch: { plannedStartDate: '2028-04-01', plannedEndDate: '2028-03-15' },
      acceptedAt: '2028-01-10T12:00:00.000Z',
      reason: 'BASELINE_INVALID',
    },
    {
      name: 'future acceptance',
      patch: { plannedStartDate: '2028-02-01', plannedEndDate: '2028-03-15' },
      acceptedAt: '2028-02-01T00:00:00.000Z',
      reason: 'BASELINE_AFTER_AS_OF',
    },
  ])(
    'keeps $name UNKNOWN without throwing or inventing a date',
    ({ patch, acceptedAt, reason }) => {
      const [row] = buildExecutionBankRows(
        [initiative()],
        [
          executionCase({
            acceptedAt,
            acceptedBaseline: { baseline: patch },
          }),
        ],
        { asOf: AS_OF }
      );

      expect(row.baselineStart).toMatchObject({ status: 'UNKNOWN', value: null, reason });
      expect(row.baselineFinish).toMatchObject({ status: 'UNKNOWN', value: null, reason });
    }
  );

  it('treats a non-object accepted baseline as invalid evidence', () => {
    const [row] = buildExecutionBankRows(
      [initiative()],
      [executionCase({ acceptedBaseline: { baseline: 42 } })],
      { asOf: AS_OF }
    );

    expect(row.baselineStart).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_INVALID' });
    expect(row.baselineFinish).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_INVALID' });
  });

  it('keeps the module baseline when native evidence is absent and reports a conflict when both valid sources disagree', () => {
    const moduleInitiative = initiative({
      baselineStartDate: '2028-02-01',
      baselineEndDate: '2028-03-01',
      scheduleBaselineId: 'module-baseline-4',
      baselineVersion: 4,
      baselineObservedAt: '2028-01-05T08:00:00.000Z',
    } as Partial<ExecutionBankInitiativeSource>);

    const [compatible] = buildExecutionBankRows(
      [moduleInitiative],
      [executionCase({ acceptedBaseline: { baseline: { status: 'governed' } } })],
      { asOf: AS_OF }
    );
    expect(compatible.baselineFinish).toMatchObject({
      status: 'KNOWN',
      value: '2028-03-01',
      meta: { source: 'initiative_schedule_baselines:module-baseline-4' },
    });

    const [conflict] = buildExecutionBankRows([moduleInitiative], [executionCase()], {
      asOf: AS_OF,
    });
    expect(conflict.baselineStart).toMatchObject({ status: 'KNOWN', value: '2028-02-01' });
    expect(conflict.baselineFinish).toMatchObject({ status: 'UNKNOWN', reason: 'SOURCE_CONFLICT' });
  });

  it('preserves an existing module baseline finish when the historical row has no start date', () => {
    const [row] = buildExecutionBankRows(
      [
        initiative({
          baselineStartDate: null,
          baselineEndDate: '2028-03-01',
          scheduleBaselineId: 'module-baseline-finish-only',
          baselineVersion: 1,
          baselineObservedAt: '2028-01-05T08:00:00.000Z',
        } as Partial<ExecutionBankInitiativeSource>),
      ],
      [executionCase({ acceptedBaseline: { baseline: { status: 'governed' } } })],
      { asOf: AS_OF }
    );

    expect(row.baselineStart).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_MISSING' });
    expect(row.baselineFinish).toMatchObject({ status: 'KNOWN', value: '2028-03-01' });
  });

  it('fills an absent module field from valid native evidence and exposes a conflict on their shared field', () => {
    const [row] = buildExecutionBankRows(
      [
        initiative({
          baselineStartDate: null,
          baselineEndDate: '2028-03-01',
          scheduleBaselineId: 'module-baseline-partial',
          baselineVersion: 2,
          baselineObservedAt: '2028-01-05T08:00:00.000Z',
        } as Partial<ExecutionBankInitiativeSource>),
      ],
      [executionCase()],
      { asOf: AS_OF }
    );

    expect(row.baselineStart).toMatchObject({
      status: 'KNOWN',
      value: '2028-02-01',
      meta: { source: 'ie_aggregate_state:case-native' },
    });
    expect(row.baselineFinish).toMatchObject({ status: 'UNKNOWN', reason: 'SOURCE_CONFLICT' });
  });

  it('maps the accepted snapshot and causal provenance from the tenant-scoped Case list query', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          version: 3,
          aggregate_id: 'case-native',
          payload_json: {
            initiativeId: 'initiative-native',
            state: 'ACTIVE',
            executionManagerId: 'manager-1',
            handoffPackageId: 'handoff-native-v7',
            handoffPackageVersion: 7,
            acceptedBaseline: {
              baseline: {
                plannedStartDate: '2028-02-01',
                plannedEndDate: '2028-03-15',
              },
            },
            acceptedAt: '2028-01-10T12:00:00.000Z',
          },
          updated_at: new Date('2028-01-11T00:00:00.000Z'),
        },
      ],
    });
    const reader = new PostgresInitiativeReader({ query } as never);

    await expect(reader.listExecutionCases('org-native')).resolves.toEqual([
      expect.objectContaining({
        executionCaseId: 'case-native',
        initiativeId: 'initiative-native',
        version: 3,
        handoffPackageId: 'handoff-native-v7',
        handoffPackageVersion: 7,
        acceptedAt: '2028-01-10T12:00:00.000Z',
        acceptedBaseline: {
          baseline: {
            plannedStartDate: '2028-02-01',
            plannedEndDate: '2028-03-15',
          },
        },
      }),
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('organization_id=$1'), [
      'org-native',
    ]);
  });

  it('maps existing module baseline identity, version and persisted observation in the Hub adapter', () => {
    expect(
      executionBankBaselineSource({
        baselineStartDate: '2028-02-01',
        baselineEndDate: '2028-03-01',
        scheduleBaselineId: 'baseline-4',
        baselineVersion: 4,
        baselineSetAt: '2028-01-05T08:00:00.000Z',
      })
    ).toEqual({
      baselineStartDate: '2028-02-01',
      baselineEndDate: '2028-03-01',
      scheduleBaselineId: 'baseline-4',
      baselineVersion: 4,
      baselineObservedAt: '2028-01-05T08:00:00.000Z',
    });
  });
});
