import { describe, expect, it, vi } from 'vitest';

import {
  projectExecutionBankInitiativeEvidence,
  readExecutionBankInitiativeEvidence,
} from '../executionBankEvidenceReadService.js';

const current = (overrides: Record<string, unknown> = {}) => ({
  initiativeId: 'initiative-a',
  progress: null,
  forecastStartDate: null,
  forecastEndDate: null,
  ...overrides,
});

const receipt = (overrides: Record<string, unknown> = {}) => ({
  id: 'receipt-a',
  system: 'initiative_history' as const,
  action: 'reforecast',
  oldValue: null,
  newValue: null,
  observedAt: '2028-01-10T12:00:00.000Z',
  ...overrides,
});

const project = (input: {
  current?: Record<string, unknown>;
  receipts?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  asOf?: string;
}) =>
  projectExecutionBankInitiativeEvidence({
    current: current(input.current),
    receipts: (input.receipts ?? []) as any,
    tasks: (input.tasks ?? []) as any,
    asOf: input.asOf ?? '2028-01-31T12:00:00.000Z',
  }) as any;

describe('E1b execution Bank evidence projection adversarial boundary', () => {
  it('does not skip a newer contradictory field receipt to select an older matching value', () => {
    const result = project({
      current: { forecastEndDate: '2028-04-30' },
      receipts: [
        receipt({
          id: 'older-matching',
          newValue: { forecastEndDate: '2028-04-30' },
          observedAt: '2028-01-10T12:00:00.000Z',
        }),
        receipt({
          id: 'newer-contradictory',
          newValue: { forecastEndDate: '2028-05-15' },
          observedAt: '2028-01-20T12:00:00.000Z',
        }),
      ],
    });

    expect(result.forecastEndEvidence.value).toBeNull();
    expect(result.forecastEndEvidence.completeness).toBe('UNKNOWN');
    expect(result.forecastEndEvidence.reason).toMatch(/CONFLICT/);
    expect(result.forecastEndEvidence.source.recordId).toBe('newer-contradictory');
  });

  it('keeps start-only and end-only receipts independent, including their source and observedAt', () => {
    const result = project({
      current: {
        forecastStartDate: '2028-02-01',
        forecastEndDate: '2028-04-30',
      },
      receipts: [
        receipt({
          id: 'start-only',
          newValue: JSON.stringify({ forecastStartDate: '2028-02-01' }),
          observedAt: '2028-01-05T08:00:00.125Z',
        }),
        receipt({
          id: 'end-only',
          system: 'execution_audit_log',
          action: 'smooth',
          newValue: { forecastEndDate: '2028-04-30' },
          observedAt: new Date('2028-01-20T09:30:00.750Z'),
        }),
      ],
    });

    expect(result.forecastStartEvidence.value).toBe('2028-02-01');
    expect(result.forecastStartEvidence.source.recordId).toBe('start-only');
    expect(result.forecastStartEvidence.observedAt).toBe('2028-01-05T08:00:00.125Z');
    expect(result.forecastEndEvidence.value).toBe('2028-04-30');
    expect(result.forecastEndEvidence.source.recordId).toBe('end-only');
    expect(result.forecastEndEvidence.observedAt).toBe('2028-01-20T09:30:00.750Z');
  });

  it('compares millisecond instants exactly across Date, epoch milliseconds, UTC and Chicago offsets', () => {
    const observedAt = Date.parse('2028-01-15T12:00:00.456Z');
    const evidenceInput = {
      current: {
        forecastEndDate: new Date('2028-03-10T06:00:00.000Z'),
      },
      receipts: [
        receipt({
          id: 'millisecond-receipt',
          newValue: { forecastEndDate: '2028-03-10' },
          observedAt,
        }),
      ],
    };

    const before = project({
      ...evidenceInput,
      asOf: '2028-01-15T06:00:00.000-06:00',
    });
    expect(before.forecastEndEvidence.value).toBeNull();
    expect(before.forecastEndEvidence.reason).toMatch(/AFTER_AS_OF|NO_EVENT_HISTORY_BEFORE_AS_OF/);

    const exact = project({
      ...evidenceInput,
      asOf: '2028-01-15T06:00:00.456-06:00',
    });
    expect(exact.forecastEndEvidence.value).toBe('2028-03-10');
    expect(exact.forecastEndEvidence.observedAt).toBe('2028-01-15T12:00:00.456Z');
  });

  it('does not reconstruct a historical field from an older receipt when the current value belongs to a later observation', () => {
    const result = project({
      current: { forecastEndDate: '2028-05-01' },
      asOf: '2028-01-15T12:00:00.000Z',
      receipts: [
        receipt({
          id: 'historical-value',
          newValue: { forecastEndDate: '2028-04-01' },
          observedAt: '2028-01-10T12:00:00.000Z',
        }),
        receipt({
          id: 'current-after-as-of',
          newValue: { forecastEndDate: '2028-05-01' },
          observedAt: '2028-01-20T12:00:00.000Z',
        }),
      ],
    });

    expect(result.forecastEndEvidence.value).toBeNull();
    expect(result.forecastEndEvidence.reason).toMatch(/AFTER_AS_OF|NO_EVENT_HISTORY_BEFORE_AS_OF/);
    expect(result.forecastEndEvidence.source.recordId).not.toBe('historical-value');
  });

  it('does not relabel MAX tasks.updated_at as an observed progress instant', () => {
    const result = project({
      current: { progress: 42 },
      tasks: [
        {
          id: 'task-1',
          progress: 42,
          priority: 'medium',
          observedAt: new Date('2028-01-20T12:00:00.100Z'),
        },
        {
          id: 'task-2',
          progress: 42,
          priority: 'high',
          // This can be a title/owner edit. The input has no progress-specific receipt.
          observedAt: Date.parse('2028-01-25T12:00:00.900Z'),
        },
      ],
    });

    expect(result.progressEvidence.completeness).not.toBe('KNOWN');
    expect(result.progressEvidence.staleness).toBe('UNKNOWN');
    expect(result.progressEvidence.observedAt).toBeNull();
    expect(result.progressEvidence.reason).toMatch(/OBSERVATION|UNPROVEN|PARTIAL/);
    if (result.progressEvidence.value !== null) expect(result.progressEvidence.value).toBe(42);
  });

  it('rejects the latest contradictory task progress receipt instead of finding an older match', () => {
    const result = project({
      current: { progress: 42 },
      tasks: [
        {
          id: 'task-1',
          progress: 42,
          priority: 'medium',
          observedAt: '2028-01-25T12:00:00.900Z',
          progressReceiptId: 'latest-task-progress',
          progressReceiptValue: 50,
        },
      ],
    });

    expect(result.progressEvidence.value).toBeNull();
    expect(result.progressEvidence.completeness).toBe('UNKNOWN');
    expect(result.progressEvidence.reason).toMatch(/CONFLICT|MISMATCH|INCOMPLETE/);
  });

  it('returns UNKNOWN instead of throwing when a forecast receipt carries a malformed non-date value', () => {
    expect(() =>
      project({
        current: { forecastStartDate: '2028-02-01', forecastEndDate: '2028-04-30' },
        receipts: [
          receipt({
            id: 'malformed-start-object',
            newValue: { forecastStartDate: {} },
          }),
          receipt({
            id: 'malformed-end-number',
            newValue: { forecastEndDate: 20280430 },
          }),
        ],
      })
    ).not.toThrow();

    const result = project({
      current: { forecastStartDate: '2028-02-01', forecastEndDate: '2028-04-30' },
      receipts: [
        receipt({
          id: 'malformed-start-object',
          newValue: { forecastStartDate: {} },
        }),
        receipt({
          id: 'malformed-end-number',
          newValue: { forecastEndDate: 20280430 },
        }),
      ],
    });

    expect(result.forecastStartEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
      source: { recordId: 'malformed-start-object' },
    });
    expect(result.forecastEndEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
      source: { recordId: 'malformed-end-number' },
    });
  });

  it.each([false, [], {}])(
    'does not coerce a malformed progress receipt %j into a measured numeric zero',
    (malformedProgress) => {
      const result = project({
        current: { progress: 0 },
        receipts: [
          receipt({
            id: 'malformed-progress-zero',
            action: 'progress_updated',
            newValue: { progress: malformedProgress },
          }),
        ],
      });

      expect(result.progressEvidence).toMatchObject({
        value: null,
        completeness: 'UNKNOWN',
        reason: 'SOURCE_CONFLICT',
        source: { recordId: 'malformed-progress-zero' },
      });
    }
  );

  it('recognizes the actual manager_scope_reduction receipt name without renaming writer history', () => {
    const result = project({
      current: { forecastEndDate: '2028-06-15' },
      receipts: [
        receipt({
          id: 'manager-scope-reduction',
          system: 'manager_action_audit_log',
          action: 'manager_scope_reduction',
          oldValue: { forecastEndDate: '2028-05-25' },
          newValue: { forecastEndDate: '2028-06-15' },
          observedAt: '2028-01-22T18:00:00.000Z',
        }),
      ],
    });

    expect(result.forecastEndEvidence.value).toBe('2028-06-15');
    expect(result.forecastEndEvidence.source.system).toBe('manager_action_audit_log');
    expect(result.forecastEndEvidence.source.recordId).toBe('manager-scope-reduction');
  });

  it('tenant-scopes the current row and every history source through initiatives', async () => {
    const queryAll = vi.fn(async (sql: string, _params: unknown[] = []) => {
      if (/FROM\s+initiatives\s+i\b/i.test(sql) && !/initiative_history/i.test(sql)) {
        return [
          {
            id: 'initiative-a',
            initiative_id: 'initiative-a',
            initiativeId: 'initiative-a',
            progress: null,
            forecast_start_date: null,
            forecast_end_date: null,
          },
        ];
      }
      return [];
    });

    await readExecutionBankInitiativeEvidence(
      {
        organizationId: 'org-a',
        initiativeIds: ['initiative-a'],
        asOf: '2028-01-31T12:00:00.000Z',
      },
      { queryAll: queryAll as any }
    );

    expect(queryAll).toHaveBeenCalled();
    for (const [, params] of queryAll.mock.calls) {
      expect(params).toContain('org-a');
    }
    const historySql = queryAll.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => /initiative_history/i.test(sql))
      .join('\n');
    expect(historySql).toMatch(/JOIN\s+initiatives\b/i);
    expect(historySql).toMatch(/organization_id/i);
    const managerSql = queryAll.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => /manager_action_audit_log/i.test(sql));
    expect(managerSql).toMatch(/manager_scope_reduction/);
  });

  it('projects every database receipt instant as epoch seconds before node-pg can reinterpret naive timestamps in the process timezone', async () => {
    const queryAll = vi.fn(async (sql: string) => {
      if (/SELECT\s+i\.id\s+AS\s+initiative_id/i.test(sql)) {
        return [
          {
            initiative_id: 'initiative-a',
            progress: null,
            forecast_start_date: null,
            forecast_end_date: null,
          },
        ];
      }
      return [];
    });

    await readExecutionBankInitiativeEvidence(
      {
        organizationId: 'org-a',
        initiativeIds: ['initiative-a'],
        asOf: '2028-01-31T12:00:00.000Z',
      },
      { queryAll: queryAll as any }
    );

    const receiptQueries = queryAll.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => /\bAS\s+(?:progress_)?observed_at\b/i.test(sql));
    // BRAMKA K2 (13.09): licznik jest TRIPWIRE na nowe źródło paragonu, które
    // NIE projektuje instantu (taka kwerenda nie ma `AS observed_at`, więc nie
    // wpada do pętli niżej). Napisany na 4 w `75f3228582`; `2ff754d84b` dodał
    // PIĄTE, kanoniczne źródło (`ie_command_receipts`) i podniósł liczbę.
    // Pięć źródeł: initiative_history · execution_audit_log ·
    // manager_action_audit_log · task_history (LATERAL) · ie_command_receipts.
    expect(receiptQueries).toHaveLength(5);
    for (const sql of receiptQueries) {
      expect(sql).toMatch(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+[^)]+\)/i);
      expect(sql).toMatch(/::\s*double\s+precision\s+AS\s+(?:progress_)?observed_at/i);
    }
  });
});
