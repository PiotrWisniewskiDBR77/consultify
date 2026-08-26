import type { ReportRun, ReportSource } from './reportRun.js';

export type ReconstructionGapReason =
  | 'NO_EVENT_HISTORY_BEFORE_AS_OF'
  | 'SOURCE_NOT_EVENT_SOURCED'
  | 'ACCESS_DENIED';

export interface ReportReconstructionResult {
  reportRunId: string;
  asOf: string;
  reconstructable: boolean;
  sources: ReportSource[];
  gaps: Array<{ sourceType: string; sourceId: string; reason: ReconstructionGapReason }>;
  reconstructedAt: string;
}

/**
 * Runtime-v1 stores a report run snapshot, but does not provide an event-history
 * reader that can resolve every ReportSource to its version at an arbitrary
 * timestamp. Returning the captured run sources would therefore present a
 * current snapshot as historical truth. This read-model deliberately refuses
 * that substitution and enumerates the exact gaps deterministically.
 */
export function reconstructReportRun(
  run: ReportRun,
  asOf: string,
  reconstructedAt = new Date().toISOString()
): ReportReconstructionResult {
  const target = new Date(asOf);
  if (!Number.isFinite(target.getTime()) || target.getTime() > Date.now()) {
    throw new RangeError('AS_OF_INVALID_OR_FUTURE');
  }

  const sourceGaps = run.sources.map((source) => ({
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    reason: (source.accessState === 'DENIED'
      ? 'ACCESS_DENIED'
      : new Date(source.capturedAt).getTime() > target.getTime()
        ? 'NO_EVENT_HISTORY_BEFORE_AS_OF'
        : 'SOURCE_NOT_EVENT_SOURCED') as ReconstructionGapReason,
  }));
  const gaps =
    sourceGaps.length > 0
      ? sourceGaps
      : [
          {
            sourceType: 'report_run',
            sourceId: run.reportRunId,
            reason: 'SOURCE_NOT_EVENT_SOURCED' as const,
          },
        ];

  return {
    reportRunId: run.reportRunId,
    asOf: target.toISOString(),
    reconstructable: false,
    sources: [],
    gaps,
    reconstructedAt,
  };
}
