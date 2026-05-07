import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_DIMENSIONS,
  buildBenchmarkTrendReport,
  type BenchmarkDimension,
  type BenchmarkRunRecord,
  type BuildBenchmarkTrendInput,
} from '../presentationBenchmarkTrendService.js';

const NOW_ISO = '2026-12-15T12:00:00.000Z';
const MONTH_MS = 1000 * 60 * 60 * 24 * 30;

function isoMonthsAgo(months: number): string {
  return new Date(Date.parse(NOW_ISO) - months * MONTH_MS).toISOString();
}

function makeRun(
  monthsAgo: number,
  scoreEachDim: number | Partial<Record<BenchmarkDimension, number>>,
  overrides: Partial<BenchmarkRunRecord> = {}
): BenchmarkRunRecord {
  const scores: Partial<Record<BenchmarkDimension, number>> =
    typeof scoreEachDim === 'number'
      ? Object.fromEntries(BENCHMARK_DIMENSIONS.map((d) => [d, scoreEachDim])) as Record<
          BenchmarkDimension,
          number
        >
      : { ...scoreEachDim };
  return {
    runId: `run-${monthsAgo}`,
    organizationId: 'org-1',
    referenceSet: 'dbr77',
    recordedAt: isoMonthsAgo(monthsAgo),
    scores,
    ...overrides,
  };
}

function baseInput(
  runs: BenchmarkRunRecord[],
  overrides: Partial<BuildBenchmarkTrendInput> = {}
): BuildBenchmarkTrendInput {
  return {
    runs,
    organizationId: 'org-1',
    referenceSet: 'dbr77',
    nowIso: NOW_ISO,
    ...overrides,
  };
}

describe('presentationBenchmarkTrendService — buildBenchmarkTrendReport', () => {
  it('1) empty runs → INCONCLUSIVE verdict, all dimensions inconclusive', () => {
    const report = buildBenchmarkTrendReport(baseInput([]));
    expect(report.overallVerdict).toBe('INCONCLUSIVE');
    expect(report.dimensions).toHaveLength(BENCHMARK_DIMENSIONS.length);
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('inconclusive');
      expect(dim.latestValue).toBeNull();
      expect(dim.points).toEqual([]);
      expect(dim.distanceToGamma).toBeNull();
      expect(dim.estimatedRunsToGamma).toBeNull();
    }
    expect(report.summary).toMatch(/insufficient/i);
  });

  it('2) single run → all dimensions inconclusive (averages need ≥3 / ≥6)', () => {
    const report = buildBenchmarkTrendReport(baseInput([makeRun(0, 3.2)]));
    expect(report.overallVerdict).toBe('INCONCLUSIVE');
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('inconclusive');
      expect(dim.points).toHaveLength(1);
      expect(dim.latestValue).toBeCloseTo(3.2, 6);
      expect(dim.averageLast3).toBeNull();
      expect(dim.averageLast6).toBeNull();
    }
  });

  it('3) 3 runs improving by +0.2 each → all improving, verdict TRACKING', () => {
    const runs = [makeRun(2, 3.0), makeRun(1, 3.2), makeRun(0, 3.4)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('improving');
      expect(dim.latestValue).toBeCloseTo(3.4, 6);
    }
    expect(report.overallVerdict).toBe('TRACKING');
  });

  it('4) 3 runs decreasing → all regressing', () => {
    const runs = [makeRun(2, 3.6), makeRun(1, 3.4), makeRun(0, 3.2)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('regressing');
    }
  });

  it('5) 6 runs flat → all stable', () => {
    const runs = [5, 4, 3, 2, 1, 0].map((m) => makeRun(m, 3.5));
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('stable');
      expect(dim.averageLast6).toBeCloseTo(3.5, 6);
      expect(dim.averageLast3).toBeCloseTo(3.5, 6);
    }
  });

  it('6) latest value ≥ gamma → distanceToGamma ≤ 0', () => {
    const runs = [makeRun(1, 3.5), makeRun(0, 4.2)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(dim.latestValue).toBeCloseTo(4.2, 6);
      expect(dim.distanceToGamma).not.toBeNull();
      expect(dim.distanceToGamma!).toBeLessThanOrEqual(0);
    }
  });

  it('7) estimatedRunsToGamma: 6 improving runs from 3.5 to 4.0 (+0.1/run) → 5 runs', () => {
    const series = [3.5, 3.6, 3.7, 3.8, 3.9, 4.0];
    const runs = series.map((v, i) => makeRun(series.length - 1 - i, v));
    const report = buildBenchmarkTrendReport(baseInput(runs, { gammaTarget: 4.5 }));
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('improving');
      expect(dim.estimatedRunsToGamma).toBe(5);
    }
  });

  it('8) estimatedRunsToGamma: already at gamma → 0', () => {
    const runs = [makeRun(1, 4.0), makeRun(0, 4.1)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(dim.estimatedRunsToGamma).toBe(0);
    }
  });

  it('9) estimatedRunsToGamma: regressing → null', () => {
    const series = [4.0, 3.9, 3.8, 3.7, 3.6, 3.5];
    const runs = series.map((v, i) => makeRun(series.length - 1 - i, v));
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('regressing');
      expect(dim.estimatedRunsToGamma).toBeNull();
    }
  });

  it('10) mixed: 4 improving, 1 regressing below 3.5 → verdict AT_RISK', () => {
    const improvingSeries = [3.0, 3.2, 3.4]; // simple +0.2 per run
    const regressingSeries = [3.8, 3.5, 3.2]; // last well below 3.5 warning
    const runs: BenchmarkRunRecord[] = [];
    for (let i = 0; i < 3; i++) {
      const monthsAgo = 2 - i;
      const scores: Partial<Record<BenchmarkDimension, number>> = {};
      for (let d = 0; d < BENCHMARK_DIMENSIONS.length; d++) {
        const dim = BENCHMARK_DIMENSIONS[d]!;
        scores[dim] = d === 3 ? regressingSeries[i]! : improvingSeries[i]!;
      }
      runs.push(makeRun(monthsAgo, scores));
    }
    const report = buildBenchmarkTrendReport(baseInput(runs));
    expect(report.overallVerdict).toBe('AT_RISK');
    const regressingDim = report.dimensions.find(
      (d) => d.dimension === BENCHMARK_DIMENSIONS[3]
    );
    expect(regressingDim?.status).toBe('regressing');
    expect(regressingDim?.latestValue).toBeLessThan(3.5);
  });

  it('11) all dimensions at/above gamma → AHEAD_OF_TARGET', () => {
    const runs = [makeRun(1, 4.1), makeRun(0, 4.3)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    expect(report.overallVerdict).toBe('AHEAD_OF_TARGET');
    expect(report.summary).toMatch(/Gamma/);
  });

  it('12) report is JSON-serializable', () => {
    const runs = [makeRun(2, 3.0), makeRun(1, 3.2), makeRun(0, 3.4)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    expect(() => JSON.stringify(report)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(report));
    expect(roundTripped.overallVerdict).toBe(report.overallVerdict);
    expect(roundTripped.dimensions).toHaveLength(BENCHMARK_DIMENSIONS.length);
  });

  it('13) never throws on malformed input', () => {
    const malformed: unknown[] = [
      null,
      undefined,
      {},
      { runs: null },
      { runs: 'not-an-array' },
      {
        runs: [
          null,
          { recordedAt: 'not-a-date', scores: { content_quality: 'bad' } },
          { recordedAt: NOW_ISO, scores: { content_quality: NaN } },
          { recordedAt: NOW_ISO, scores: { content_quality: 99 } }, // out of range → null
          { recordedAt: NOW_ISO }, // no scores at all
        ],
      },
    ];
    for (const candidate of malformed) {
      expect(() =>
        buildBenchmarkTrendReport(candidate as BuildBenchmarkTrendInput)
      ).not.toThrow();
    }
  });

  it('14) custom gammaTarget honored (distance + estimated runs respect override)', () => {
    const series = [3.0, 3.1, 3.2, 3.3, 3.4, 3.5];
    const runs = series.map((v, i) => makeRun(series.length - 1 - i, v));
    const report = buildBenchmarkTrendReport(
      baseInput(runs, { gammaTarget: 5.0 })
    );
    expect(report.gammaTarget).toBe(5.0);
    for (const dim of report.dimensions) {
      expect(dim.status).toBe('improving');
      expect(dim.distanceToGamma).toBeCloseTo(1.5, 6);
      expect(dim.estimatedRunsToGamma).not.toBeNull();
      expect(dim.estimatedRunsToGamma!).toBeGreaterThan(0);
    }
  });

  it('15) run order independence: shuffled input produces same per-dimension series', () => {
    const ascending = [makeRun(2, 3.0), makeRun(1, 3.2), makeRun(0, 3.4)];
    const shuffled = [ascending[1]!, ascending[2]!, ascending[0]!];
    const a = buildBenchmarkTrendReport(baseInput(ascending));
    const b = buildBenchmarkTrendReport(baseInput(shuffled));
    for (let i = 0; i < a.dimensions.length; i++) {
      expect(b.dimensions[i]!.points.map((p) => p.value)).toEqual(
        a.dimensions[i]!.points.map((p) => p.value)
      );
      expect(b.dimensions[i]!.status).toBe(a.dimensions[i]!.status);
      expect(b.dimensions[i]!.latestValue).toBe(a.dimensions[i]!.latestValue);
    }
  });

  it('16) reference target line is implicit: gammaTarget always present even with no data', () => {
    const report = buildBenchmarkTrendReport(baseInput([]));
    expect(report.gammaTarget).toBeCloseTo(4.0, 6);
    expect(report.warningThreshold).toBeCloseTo(3.5, 6);
  });

  it('17) sparkline-friendly: dimensions all return arrays the UI can render even with sparse data', () => {
    const runs = [makeRun(2, 3.0), makeRun(1, 3.2)];
    const report = buildBenchmarkTrendReport(baseInput(runs));
    for (const dim of report.dimensions) {
      expect(Array.isArray(dim.points)).toBe(true);
      expect(dim.points.length).toBe(2);
      // Status is inconclusive (< 3 points) — UI should treat per-point dots
      // as hollow circles per the SVG spec.
      expect(dim.status).toBe('inconclusive');
    }
  });

  it('18) per-point delta computed against previous finite point only', () => {
    const partial: BenchmarkRunRecord[] = [
      makeRun(3, { content_quality: 3.0 }),
      makeRun(2, {}), // missing — should not break delta chain
      makeRun(1, { content_quality: 3.2 }),
      makeRun(0, { content_quality: 3.5 }),
    ];
    const report = buildBenchmarkTrendReport(baseInput(partial));
    const dim = report.dimensions.find((d) => d.dimension === 'content_quality');
    expect(dim).toBeDefined();
    const points = dim!.points;
    expect(points).toHaveLength(4);
    expect(points[0]!.value).toBeCloseTo(3.0);
    expect(points[0]!.delta).toBeNull();
    expect(points[1]!.value).toBeNull();
    expect(points[1]!.delta).toBeNull();
    expect(points[2]!.value).toBeCloseTo(3.2);
    expect(points[2]!.delta).toBeCloseTo(0.2, 6);
    expect(points[3]!.value).toBeCloseTo(3.5);
    expect(points[3]!.delta).toBeCloseTo(0.3, 6);
  });
});
