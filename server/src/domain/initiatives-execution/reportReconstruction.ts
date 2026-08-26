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
  reconstructionLevel: 'P1_VERSION_AT_INSTANT';
  sourceVersions: Array<{
    sourceType: string;
    sourceId: string;
    version: number;
    eventCreatedAt: string;
  }>;
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
  resolvedVersions: Array<{
    sourceType: string;
    sourceId: string;
    version: number;
    eventCreatedAt: string;
  }> = [],
  reconstructedAt = new Date().toISOString()
): ReportReconstructionResult {
  const target = new Date(asOf);
  if (!Number.isFinite(target.getTime()) || target.getTime() > Date.now()) {
    throw new RangeError('AS_OF_INVALID_OR_FUTURE');
  }

  const versionBySource = new Map(
    resolvedVersions.map((source) => [`${source.sourceType}\u0000${source.sourceId}`, source])
  );
  const resolvedSources = run.sources.flatMap((source) => {
    if (source.accessState === 'DENIED') return [];
    const resolved = versionBySource.get(`${source.sourceType}\u0000${source.sourceId}`);
    return resolved
      ? [{ ...source, version: resolved.version, capturedAt: resolved.eventCreatedAt }]
      : [];
  });
  const sourceGaps = run.sources.flatMap((source) => {
    const resolved = versionBySource.get(`${source.sourceType}\u0000${source.sourceId}`);
    if (source.accessState !== 'DENIED' && resolved) return [];
    return [
      {
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        reason: (source.accessState === 'DENIED'
          ? 'ACCESS_DENIED'
          : 'NO_EVENT_HISTORY_BEFORE_AS_OF') as ReconstructionGapReason,
      },
    ];
  });
  const gaps =
    run.sources.length > 0
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
    reconstructable: resolvedSources.length > 0,
    sources: resolvedSources,
    gaps,
    reconstructedAt,
    reconstructionLevel: 'P1_VERSION_AT_INSTANT',
    sourceVersions: resolvedVersions,
  };
}
