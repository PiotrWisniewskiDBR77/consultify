import { beforeEach, describe, expect, it, vi } from 'vitest';

// r7 Durable — resilience regression test.
//
// ROOT CAUSE: `hydrateTypedColumns` used to run ONE bulk
// `UPDATE initiatives SET col1=?, col2=?, ...` for every generated card
// column. If a single column's value didn't fit its DB type (the concrete
// case: `expected_roi` was REAL but the extractor writes a qualitative
// string like "ROI 200%"), Postgres rejected the WHOLE statement and the
// surrounding try/catch swallowed it — losing every other good column too
// (0/7 empty initiative skeleton).
//
// FIX: on a bulk UPDATE failure, retry each column as its own UPDATE in its
// own try/catch, so good columns still persist and only the offending one is
// skipped (with a WARN log naming it).

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn(),
  queryOne: vi.fn(),
}));

import { hydrateTypedColumns } from '../../../server/src/services/ai/tools/generateInitiative.js';
import loggerModule from '../../../server/src/utils/Logger.js';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';

const mockQueryRun = queryHelpers.queryRun as unknown as ReturnType<typeof vi.fn>;
const mockQueryOne = queryHelpers.queryOne as unknown as ReturnType<typeof vi.fn>;
const loggerError = loggerModule.error as unknown as ReturnType<typeof vi.fn>;
const loggerWarn = loggerModule.warn as unknown as ReturnType<typeof vi.fn>;
const loggerInfo = loggerModule.info as unknown as ReturnType<typeof vi.fn>;

const ORG = 'org-1';
const INIT = 'init-1';

beforeEach(() => {
  vi.clearAllMocks();
  // Fresh DRAFT: no existing values for any candidate column.
  mockQueryOne.mockResolvedValue({});
});

describe('hydrateTypedColumns — per-column fallback resilience', () => {
  const colSet = new Set([
    'problem_statement',
    'target_state',
    'scope_in',
    'success_criteria',
    'expected_roi',
  ]);

  const cards = {
    problemDefinition: JSON.stringify({
      symptom: 'Manual picking is slow and error-prone across 3 warehouses.',
    }),
    targetState: JSON.stringify({
      targetDescription: 'Robotic picking cuts cycle time by 40% within 12 months.',
      successCriteria: ['Cycle time -40%', 'Error rate < 0.5%'],
    }),
    scope: JSON.stringify({
      inScope: ['Pick/pack automation'],
      outOfScope: ['Inbound receiving'],
    }),
    financialImpact: JSON.stringify({
      businessValue: 'Skraca cykl kompletacji o 40%.',
      benefitsRealization: 'Oczekiwane ROI 200% (zysk netto ÷ nakład), payback 14 mies.',
    }),
  };

  it('happy path: a single bulk UPDATE hydrates all columns', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });

    await hydrateTypedColumns(INIT, ORG, cards, colSet);

    const updateCalls = mockQueryRun.mock.calls.filter((c) => /^UPDATE initiatives SET/.test(String(c[0])));
    expect(updateCalls).toHaveLength(1);
    expect(String(updateCalls[0][0])).toMatch(/expected_roi = \?/);
    // No fallback path taken.
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('one poisoned column (expected_roi type mismatch) does NOT wipe the other good columns', async () => {
    // Simulate the real Postgres failure: bulk UPDATE throws because
    // expected_roi (REAL) can't hold "ROI 200% (zysk netto ÷ nakład)...".
    mockQueryRun.mockImplementation((sql: string) => {
      const s = String(sql);
      if (/^UPDATE initiatives SET .*expected_roi/.test(s) && / , |,.*,/.test(s.split('WHERE')[0])) {
        // bulk statement (multiple columns) → reject
        return Promise.reject(
          new Error('invalid input syntax for type real: "ROI 200% (zysk netto ÷ nakład), payback 14 mies."'),
        );
      }
      if (/^UPDATE initiatives SET expected_roi = \? WHERE/.test(s)) {
        // per-column retry for the poisoned column → still rejects
        return Promise.reject(new Error('invalid input syntax for type real'));
      }
      // per-column retry for any other single column → succeeds
      return Promise.resolve({ changes: 1 });
    });

    await hydrateTypedColumns(INIT, ORG, cards, colSet);

    // Bulk attempt happened first and failed loudly (real error surfaced).
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('bulk typed-column UPDATE failed'),
    );
    expect(loggerError.mock.calls[0][0]).toContain('invalid input syntax for type real');

    // Per-column fallback: every OTHER column got its own UPDATE call.
    const perColumnCalls = mockQueryRun.mock.calls.filter((c) =>
      /^UPDATE initiatives SET \w+ = \? WHERE/.test(String(c[0])),
    );
    const perColumnNames = perColumnCalls.map((c) => String(c[0]).match(/SET (\w+) = \?/)?.[1]);
    expect(perColumnNames).toEqual(
      expect.arrayContaining(['problem_statement', 'target_state', 'scope_in', 'success_criteria']),
    );
    // The poisoned column was attempted individually too (and skipped).
    expect(perColumnNames).toContain('expected_roi');

    // Skipped column logged by name.
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("skipped 'expected_roi'"),
    );

    // Completeness gate: the 4 KEY_COLS present in colSet must all be
    // considered filled (they succeeded on fallback) → no false-positive
    // "empty skeleton" error logged.
    const completenessErrors = loggerError.mock.calls.filter((c) =>
      String(c[0]).includes('COMPLETENESS GATE'),
    );
    expect(completenessErrors).toHaveLength(0);
  });
});
