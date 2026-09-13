import { describe, expect, it, vi } from 'vitest';

import {
  projectExecutionBankInitiativeEvidence,
  readExecutionBankInitiativeEvidence,
  type ExecutionBankEvidenceQuery,
} from '../executionBankEvidenceReadService.js';

const AS_OF = '2028-03-31T12:00:00.000Z';

const current = (overrides: Record<string, unknown> = {}) => ({
  initiativeId: 'initiative-a',
  progress: 42,
  forecastStartDate: '2028-04-01',
  forecastEndDate: '2028-06-30',
  ...overrides,
});

const receipt = (overrides: Record<string, unknown> = {}) => ({
  id: 'receipt-a',
  system: 'initiative_history' as const,
  action: 'progress_updated',
  oldValue: { progress: 10 },
  newValue: { progress: 42 },
  observedAt: '2028-03-20T12:00:00.000Z',
  ...overrides,
});

describe('E1b Initiative execution evidence projection', () => {
  it('exposes exact per-field replan and progress receipts at controlled asOf without relabeling updatedAt', () => {
    const result = projectExecutionBankInitiativeEvidence({
      current: current(),
      receipts: [
        receipt(),
        receipt({
          id: 'forecast-start-receipt',
          action: 'reforecast',
          newValue: { forecastStartDate: '2028-04-01' },
          observedAt: '2028-03-21T08:00:00.000Z',
        }),
        receipt({
          id: 'forecast-end-receipt',
          system: 'execution_audit_log',
          action: 'replan',
          newValue: { forecastEndDate: '2028-06-30' },
          observedAt: '2028-03-22T09:00:00.000Z',
        }),
      ],
      tasks: [],
      asOf: AS_OF,
    });

    expect(result.progressEvidence).toMatchObject({
      value: 42,
      observedAt: '2028-03-20T12:00:00.000Z',
      asOf: AS_OF,
      source: { system: 'initiative_history', recordId: 'receipt-a' },
      completeness: 'KNOWN',
      staleness: 'UNKNOWN',
      reason: 'FRESHNESS_POLICY_MISSING',
    });
    expect(result.forecastStartEvidence).toMatchObject({
      value: '2028-04-01',
      observedAt: '2028-03-21T08:00:00.000Z',
      source: { recordId: 'forecast-start-receipt' },
    });
    expect(result.forecastEndEvidence).toMatchObject({
      value: '2028-06-30',
      observedAt: '2028-03-22T09:00:00.000Z',
      source: { system: 'execution_audit_log', recordId: 'forecast-end-receipt' },
    });
  });

  it('preserves a measured progress zero and separates it from a missing observation', () => {
    const measuredZero = projectExecutionBankInitiativeEvidence({
      current: current({ progress: 0, forecastStartDate: null, forecastEndDate: null }),
      receipts: [receipt({ newValue: { progress: 0 } })],
      tasks: [],
      asOf: AS_OF,
    });
    const missing = projectExecutionBankInitiativeEvidence({
      current: current({ progress: null, forecastStartDate: null, forecastEndDate: null }),
      receipts: [],
      tasks: [],
      asOf: AS_OF,
    });

    expect(measuredZero.progressEvidence.value).toBe(0);
    expect(measuredZero.progressEvidence.completeness).toBe('KNOWN');
    expect(missing.progressEvidence).toMatchObject({
      value: null,
      observedAt: null,
      completeness: 'UNKNOWN',
      reason: 'VALUE_MISSING',
    });
  });

  it('does not relabel the current snapshot as historical when the latest observation is after asOf', () => {
    const result = projectExecutionBankInitiativeEvidence({
      current: current({ forecastStartDate: null }),
      receipts: [
        receipt(),
        receipt({
          id: 'later-end',
          action: 'reforecast',
          newValue: { forecastEndDate: '2028-06-30' },
          observedAt: '2028-04-01T00:00:00.000Z',
        }),
      ],
      tasks: [],
      asOf: AS_OF,
    });

    expect(result.forecastEndEvidence).toMatchObject({
      value: null,
      observedAt: null,
      completeness: 'UNKNOWN',
      reason: 'NO_EVENT_HISTORY_BEFORE_AS_OF',
    });
  });

  it('keeps a newer conflicting receipt UNKNOWN instead of falling back to an older matching receipt', () => {
    const result = projectExecutionBankInitiativeEvidence({
      current: current({ forecastStartDate: null }),
      receipts: [
        receipt({
          id: 'older-match',
          action: 'reforecast',
          newValue: { forecastEndDate: '2028-06-30' },
          observedAt: '2028-03-10T00:00:00.000Z',
        }),
        receipt({
          id: 'newer-conflict',
          action: 'reforecast',
          newValue: { forecastEndDate: '2028-07-15' },
          observedAt: '2028-03-20T00:00:00.000Z',
        }),
      ],
      tasks: [],
      asOf: AS_OF,
    });

    expect(result.forecastEndEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
      source: { recordId: 'newer-conflict' },
    });
  });

  it('preserves module history evidence when an older canonical receipt has no changedFields contract', () => {
    const result = projectExecutionBankInitiativeEvidence({
      current: current({
        forecastEndAuthority: 'canonical',
        aggregateVersion: 7,
        forecastEndPresent: true,
      }),
      receipts: [
        receipt({
          id: 'legacy-canonical-without-field-mask',
          system: 'ie_command_receipts',
          action: 'initiative.forecast.update',
          newValue: { forecastEndDate: '2028-06-30' },
          aggregateVersion: 7,
        }),
        receipt({
          id: 'module-history-proof',
          action: 'reforecast',
          newValue: { forecastEndDate: '2028-06-30' },
          observedAt: '2028-03-21T00:00:00.000Z',
        }),
      ],
      tasks: [],
      asOf: AS_OF,
    });

    expect(result.forecastEndEvidence).toMatchObject({
      value: '2028-06-30',
      completeness: 'KNOWN',
      source: { system: 'initiative_history', recordId: 'module-history-proof' },
    });
  });

  it('marks a canonical and module forecast mismatch as an explicit source conflict', () => {
    const result = projectExecutionBankInitiativeEvidence({
      current: current({
        forecastEndAuthority: 'canonical',
        forecastEndPresent: true,
        forecastEndSourceConflict: true,
      }),
      receipts: [],
      tasks: [],
      asOf: AS_OF,
    });

    expect(result.forecastEndEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
      source: { system: 'ie_aggregate_state+initiatives' },
    });
  });

  it.each([
    { label: 'object', malformed: {} },
    { label: 'number', malformed: 20280630 },
  ])('keeps a malformed $label forecast receipt UNKNOWN without crashing the list', ({ malformed }) => {
    expect(() =>
      projectExecutionBankInitiativeEvidence({
        current: current({ forecastStartDate: null }),
        receipts: [
          receipt({
            id: 'malformed-forecast',
            action: 'reforecast',
            newValue: { forecastEndDate: malformed },
          }),
        ],
        tasks: [],
        asOf: AS_OF,
      })
    ).not.toThrow();
    const result = projectExecutionBankInitiativeEvidence({
      current: current({ forecastStartDate: null }),
      receipts: [
        receipt({
          id: 'malformed-forecast',
          action: 'reforecast',
          newValue: { forecastEndDate: malformed },
        }),
      ],
      tasks: [],
      asOf: AS_OF,
    });
    expect(result.forecastEndEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
    });
  });

  it.each([false, [], {}])('never coerces malformed progress %j to a measured zero', (malformed) => {
    const result = projectExecutionBankInitiativeEvidence({
      current: current({ progress: 0, forecastStartDate: null, forecastEndDate: null }),
      receipts: [receipt({ newValue: { progress: malformed } })],
      tasks: [],
      asOf: AS_OF,
    });
    expect(result.progressEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
    });
  });

  it('labels only a complete matching task calculation as the legacy PARTIAL formula', () => {
    const complete = projectExecutionBankInitiativeEvidence({
      current: current({ progress: 50, forecastStartDate: null, forecastEndDate: null }),
      receipts: [],
      tasks: [
        { id: 'task-a', progress: 0, priority: 'high', observedAt: '2028-03-10T00:00:00Z', progressReceiptId: 'task-history-a', progressReceiptValue: 0 },
        { id: 'task-b', progress: 100, priority: 'high', observedAt: '2028-03-12T00:00:00Z', progressReceiptId: 'task-history-b', progressReceiptValue: 100 },
      ],
      asOf: AS_OF,
    });
    const incomplete = projectExecutionBankInitiativeEvidence({
      current: current({ progress: 50, forecastStartDate: null, forecastEndDate: null }),
      receipts: [],
      tasks: [
        { id: 'task-a', progress: null, priority: 'high', observedAt: '2028-03-10T00:00:00Z' },
        { id: 'task-b', progress: 100, priority: 'high', observedAt: '2028-03-12T00:00:00Z' },
      ],
      asOf: AS_OF,
    });

    expect(complete.progressEvidence).toMatchObject({
      value: 50,
      observedAt: '2028-03-12T00:00:00.000Z',
      completeness: 'PARTIAL',
      source: {
        system: 'tasks',
        formulaId: 'legacy-task-priority-weighted-progress',
        formulaVersion: 1,
      },
    });
    expect(incomplete.progressEvidence).toMatchObject({
      value: null,
      observedAt: null,
      completeness: 'UNKNOWN',
      reason: 'INCOMPLETE_TASK_INPUTS',
    });
  });

  it('batch reader returns only tenant-scoped Initiative identities', async () => {
    const queryAll = vi.fn(async (sql: string) => {
      if (sql.includes('FROM initiatives i')) {
        return [
          {
            initiative_id: 'initiative-a',
            progress: 42,
            forecast_start_date: null,
            forecast_end_date: null,
          },
        ];
      }
      return [];
    }) as ExecutionBankEvidenceQuery;

    const result = await readExecutionBankInitiativeEvidence(
      {
        organizationId: 'org-a',
        initiativeIds: ['initiative-a', 'foreign-initiative'],
        asOf: AS_OF,
      },
      { queryAll }
    );

    expect(Object.keys(result)).toEqual(['initiative-a']);
    for (const [sql, params] of vi.mocked(queryAll).mock.calls) {
      expect(sql).toMatch(/organization_id/i);
      expect(params).toContain('org-a');
    }
    const receiptQueries = vi
      .mocked(queryAll)
      .mock.calls.map(([sql]) => String(sql))
      .filter((sql) => /_history|_audit_log/.test(sql));
    expect(receiptQueries).toHaveLength(4);
    for (const sql of receiptQueries) expect(sql).toMatch(/EXTRACT\(EPOCH FROM/i);
  });
});
