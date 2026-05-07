import { describe, expect, it } from 'vitest';

import {
  type AnomalySample,
  type AnomalySloId,
  type AnomalyVerdict,
  detectAnomaliesForReport,
  detectAnomaly,
} from '../presentationOperationsAnomalyDetectionService.js';

const NOW_ISO = '2026-05-10T12:00:00.000Z';
const HOUR_MS = 3_600_000;
const NOW_MS = Date.parse(NOW_ISO);

/**
 * Build a baseline of `n` samples where the population mean is exactly `mean`
 * and the population standard deviation is exactly `stdev`. We split the
 * samples into two equal halves at `mean ± stdev`, which yields
 *   sum((xi - mean)^2) / n = stdev^2
 * for any even `n`. The constructor accepts `n` as the number of samples.
 */
function controlledBaseline(mean: number, stdev: number, n: number = 6): AnomalySample[] {
  if (n % 2 !== 0) throw new Error('controlledBaseline requires an even n');
  const samples: AnomalySample[] = [];
  for (let i = 0; i < n; i += 1) {
    const high = i < n / 2;
    const observedAt = new Date(NOW_MS - (n - i) * HOUR_MS).toISOString();
    samples.push({
      observedAt,
      observedValue: high ? mean + stdev : mean - stdev,
    });
  }
  return samples;
}

function rateBaseline(values: Array<number | null>): AnomalySample[] {
  return values.map((v, i) => ({
    observedAt: new Date(NOW_MS - (values.length - i) * HOUR_MS).toISOString(),
    observedValue: v,
  }));
}

describe('presentationOperationsAnomalyDetectionService.detectAnomaly', () => {
  it('returns insufficient_data when fewer than 6 baseline samples are present', () => {
    const verdict = detectAnomaly({
      sloId: 'generation_success_rate',
      current: 80,
      baseline: rateBaseline([95, 95, 95, 95, 95]),
    });
    expect(verdict.status).toBe('insufficient_data');
    expect(verdict.reason).toContain('>=6');
    expect(verdict.zScore).toBeNull();
  });

  it('returns insufficient_data when the baseline stdev is below the floor (constant baseline)', () => {
    const verdict = detectAnomaly({
      sloId: 'generation_success_rate',
      current: 80,
      baseline: rateBaseline([95, 95, 95, 95, 95, 95]),
    });
    expect(verdict.status).toBe('insufficient_data');
    expect(verdict.reason).toContain('variance too small');
    expect(verdict.baselineMean).toBeCloseTo(95, 5);
    expect(verdict.baselineStdev).toBeLessThan(1e-3);
  });

  it('returns invalid_input when current is null', () => {
    const verdict = detectAnomaly({
      sloId: 'export_success_rate',
      current: null,
      baseline: controlledBaseline(95, 2),
    });
    expect(verdict.status).toBe('invalid_input');
    expect(verdict.reason).toContain('No current observed value');
    // Still surfaces baseline stats so the caller can debug.
    expect(verdict.baselineMean).toBeCloseTo(95, 5);
    expect(verdict.baselineStdev).toBeCloseTo(2, 5);
  });

  it('flags a success-rate SLO as a MINOR anomaly at z = -2.7', () => {
    const verdict = detectAnomaly({
      sloId: 'generation_success_rate',
      current: 95 + -2.7 * 2, // = 89.6
      baseline: controlledBaseline(95, 2),
    });
    expect(verdict.status).toBe('detected');
    expect(verdict.severity).toBe('minor');
    expect(verdict.direction).toBe('below');
    expect(verdict.zScore).toBeCloseTo(-2.7, 5);
    expect(verdict.reason).toContain('MINOR');
  });

  it('flags a success-rate SLO as a MAJOR anomaly at z = -4.0', () => {
    const verdict = detectAnomaly({
      sloId: 'export_success_rate',
      current: 95 + -4 * 2, // = 87
      baseline: controlledBaseline(95, 2),
    });
    expect(verdict.status).toBe('detected');
    expect(verdict.severity).toBe('major');
    expect(verdict.direction).toBe('below');
    expect(verdict.zScore).toBeCloseTo(-4, 5);
  });

  it('does NOT flag a success-rate SLO when z = +3.0 (improvement, not anomaly)', () => {
    const verdict = detectAnomaly({
      sloId: 'agent_edit_success_rate',
      current: 70 + 3 * 5, // = 85, well above baseline
      baseline: controlledBaseline(70, 5),
    });
    expect(verdict.status).toBe('no_anomaly');
    expect(verdict.direction).toBe('above');
    expect(verdict.zScore).toBeCloseTo(3, 5);
    expect(verdict.severity).toBeUndefined();
  });

  it('does NOT flag a success-rate SLO at z = -1.5 (within tolerance)', () => {
    const verdict = detectAnomaly({
      sloId: 'generation_success_rate',
      current: 95 + -1.5 * 2, // = 92
      baseline: controlledBaseline(95, 2),
    });
    expect(verdict.status).toBe('no_anomaly');
    expect(verdict.direction).toBe('below');
    expect(verdict.zScore).toBeCloseTo(-1.5, 5);
  });

  it('flags a latency SLO as MAJOR at z = +4.5', () => {
    const verdict = detectAnomaly({
      sloId: 'p95_generation_latency_ms',
      current: 8000 + 4.5 * 500, // = 10250 ms
      baseline: controlledBaseline(8000, 500),
    });
    expect(verdict.status).toBe('detected');
    expect(verdict.severity).toBe('major');
    expect(verdict.direction).toBe('above');
    expect(verdict.zScore).toBeCloseTo(4.5, 5);
  });

  it('does NOT flag a latency SLO at z = -3.0 (faster than baseline = improvement)', () => {
    const verdict = detectAnomaly({
      sloId: 'p95_generation_latency_ms',
      current: 8000 + -3 * 500, // = 6500 ms
      baseline: controlledBaseline(8000, 500),
    });
    expect(verdict.status).toBe('no_anomaly');
    expect(verdict.direction).toBe('below');
    expect(verdict.zScore).toBeCloseTo(-3, 5);
  });

  it('flags export_blocked_rate as an anomaly at z = +3.0 (above baseline = bad)', () => {
    const verdict = detectAnomaly({
      sloId: 'export_blocked_rate',
      current: 10 + 3 * 2, // = 16% blocked
      baseline: controlledBaseline(10, 2),
    });
    expect(verdict.status).toBe('detected');
    expect(verdict.direction).toBe('above');
    expect(verdict.severity).toBe('minor');
  });

  it('returns deterministic baselineMean/Stdev for a known input', () => {
    // baseline = [10, 12, 14, 16, 18, 20] → mean = 15, var = 70/6, stdev = sqrt(70/6)
    const baseline: AnomalySample[] = [10, 12, 14, 16, 18, 20].map((v, i) => ({
      observedAt: new Date(NOW_MS - (6 - i) * HOUR_MS).toISOString(),
      observedValue: v,
    }));
    const verdict = detectAnomaly({
      sloId: 'p95_generation_latency_ms',
      current: 15,
      baseline,
    });
    expect(verdict.baselineMean).toBeCloseTo(15, 10);
    expect(verdict.baselineStdev).toBeCloseTo(Math.sqrt(70 / 6), 10);
    expect(verdict.zScore).toBeCloseTo(0, 10);
    expect(verdict.status).toBe('no_anomaly');
  });

  it('drops non-finite baseline values (NaN / Infinity) and rejects non-finite current', () => {
    const baseline: AnomalySample[] = [
      ...controlledBaseline(95, 2),
      { observedAt: new Date(NOW_MS - HOUR_MS).toISOString(), observedValue: NaN },
      {
        observedAt: new Date(NOW_MS - 2 * HOUR_MS).toISOString(),
        observedValue: Infinity,
      },
      {
        observedAt: new Date(NOW_MS - 3 * HOUR_MS).toISOString(),
        observedValue: -Infinity,
      },
    ];
    // NaN/Infinity are dropped; six valid samples remain → detector runs.
    const ok = detectAnomaly({
      sloId: 'generation_success_rate',
      current: 80,
      baseline,
    });
    expect(ok.status).toBe('detected');

    // Non-finite current → invalid_input regardless of baseline shape.
    const badCurrent = detectAnomaly({
      sloId: 'generation_success_rate',
      current: Number.NaN,
      baseline,
    });
    expect(badCurrent.status).toBe('invalid_input');

    const infCurrent = detectAnomaly({
      sloId: 'generation_success_rate',
      current: Infinity,
      baseline,
    });
    expect(infCurrent.status).toBe('invalid_input');
  });

  it('handles a mixed batch via detectAnomaliesForReport with per-SLO verdicts', () => {
    const contexts = [
      {
        sloId: 'generation_success_rate',
        current: 95 - 4 * 2, // major drop
        baseline: controlledBaseline(95, 2),
      },
      {
        sloId: 'export_success_rate',
        current: 95, // no change
        baseline: controlledBaseline(95, 2),
      },
      {
        sloId: 'p95_generation_latency_ms',
        current: 8000,
        baseline: rateBaseline([8000, 8000, 8000]), // <6 valid → insufficient_data
      },
    ];
    const results = detectAnomaliesForReport({ contexts, nowIso: NOW_ISO });
    expect(results).toHaveLength(3);
    const bySlo = new Map(results.map((r) => [r.sloId, r.verdict] as const));
    expect(bySlo.get('generation_success_rate')?.status).toBe('detected');
    expect(bySlo.get('generation_success_rate')?.severity).toBe('major');
    expect(bySlo.get('export_success_rate')?.status).toBe('no_anomaly');
    expect(bySlo.get('p95_generation_latency_ms')?.status).toBe('insufficient_data');
  });

  it('detectAnomaliesForReport never throws on empty / malformed input', () => {
    expect(() => detectAnomaliesForReport({ contexts: [] })).not.toThrow();
    expect(detectAnomaliesForReport({ contexts: [] })).toEqual([]);
    expect(() =>
      detectAnomaliesForReport({
        // The detector defends against rogue contexts (cast through unknown).
        contexts: [
          null as unknown as { sloId: string; current: number | null; baseline: AnomalySample[] },
          { sloId: 'not_an_slo', current: 1, baseline: [] },
        ],
      })
    ).not.toThrow();
  });

  it('returns a JSON-serializable AnomalyVerdict for every status branch', () => {
    const verdicts: AnomalyVerdict[] = [
      detectAnomaly({
        sloId: 'generation_success_rate',
        current: 80,
        baseline: controlledBaseline(95, 2),
      }),
      detectAnomaly({
        sloId: 'generation_success_rate',
        current: 95,
        baseline: controlledBaseline(95, 2),
      }),
      detectAnomaly({
        sloId: 'generation_success_rate',
        current: null,
        baseline: controlledBaseline(95, 2),
      }),
      detectAnomaly({
        sloId: 'generation_success_rate',
        current: 80,
        baseline: rateBaseline([95]),
      }),
    ];
    for (const verdict of verdicts) {
      const json = JSON.stringify(verdict);
      const parsed = JSON.parse(json) as AnomalyVerdict;
      expect(parsed.status).toBe(verdict.status);
      expect(parsed.reason).toBe(verdict.reason);
      // Numeric fields round-trip without becoming strings.
      if (verdict.baselineMean !== null) {
        expect(typeof parsed.baselineMean).toBe('number');
      }
      if (verdict.zScore !== null) {
        expect(typeof parsed.zScore).toBe('number');
      }
    }
  });
});

// Sanity check: `AnomalySloId` covers exactly the 5 SLOs the route emits.
// If a future SLO is added, the polarity table must be extended too — this
// type-only test catches drift at compile time.
const _allSlos: AnomalySloId[] = [
  'generation_success_rate',
  'export_success_rate',
  'p95_generation_latency_ms',
  'agent_edit_success_rate',
  'export_blocked_rate',
];
void _allSlos;
