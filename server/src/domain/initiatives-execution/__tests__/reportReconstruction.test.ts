import { describe, expect, it } from 'vitest';

import { reconstructReportRun } from '../reportReconstruction.js';
import type { ReportRun } from '../reportRun.js';

const run = (sources: ReportRun['sources']): ReportRun =>
  ({ reportRunId: 'run-1', sources }) as ReportRun;

const source = (patch: Partial<ReportRun['sources'][number]> = {}) => ({
  sourceType: 'execution_task',
  sourceId: 'task-1',
  version: 3,
  capturedAt: '2026-08-01T00:00:00.000Z',
  freshness: 'CURRENT' as const,
  formula: null,
  unit: null,
  currency: null,
  window: null,
  confidence: 'HIGH' as const,
  accessState: 'FULL' as const,
  redactions: [],
  ...patch,
});

describe('report reconstruction honesty', () => {
  it('does not return captured current sources as historical state', () => {
    const result = reconstructReportRun(
      run([source()]),
      '2026-08-10T00:00:00.000Z',
      '2026-08-26T00:00:00.000Z'
    );
    expect(result).toMatchObject({ reconstructable: false, sources: [] });
    expect(result.gaps).toEqual([
      {
        sourceType: 'execution_task',
        sourceId: 'task-1',
        reason: 'NO_EVENT_HISTORY_BEFORE_AS_OF',
      },
    ]);
  });

  it('distinguishes history newer than asOf and denied access', () => {
    const result = reconstructReportRun(
      run([
        source({ capturedAt: '2026-08-20T00:00:00.000Z' }),
        source({ sourceId: 'task-2', accessState: 'DENIED' }),
      ]),
      '2026-08-10T00:00:00.000Z'
    );
    expect(result.gaps.map((gap) => gap.reason)).toEqual([
      'NO_EVENT_HISTORY_BEFORE_AS_OF',
      'ACCESS_DENIED',
    ]);
  });

  it('is deterministic for identical input', () => {
    const timestamp = '2026-08-26T00:00:00.000Z';
    expect(reconstructReportRun(run([source()]), '2026-08-10T00:00:00.000Z', timestamp)).toEqual(
      reconstructReportRun(run([source()]), '2026-08-10T00:00:00.000Z', timestamp)
    );
  });

  it('preserves the source-not-event-sourced gap for a run with no sources', () => {
    expect(reconstructReportRun(run([]), '2026-08-10T00:00:00.000Z').gaps).toEqual([
      {
        sourceType: 'report_run',
        sourceId: 'run-1',
        reason: 'SOURCE_NOT_EVENT_SOURCED',
      },
    ]);
  });

  it('rejects a future asOf', () => {
    expect(() => reconstructReportRun(run([]), '2999-01-01T00:00:00.000Z')).toThrow(
      'AS_OF_INVALID_OR_FUTURE'
    );
  });
});
