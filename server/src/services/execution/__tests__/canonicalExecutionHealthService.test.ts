import { describe, expect, it } from 'vitest';

import {
  computeCanonicalExecutionHealth,
  EXECUTION_HEALTH_FORMULA_VERSION,
} from '../canonicalExecutionHealthService.js';

describe('canonical execution health v1', () => {
  it('uses one deterministic projection for progress, tasks, decisions and risk', () => {
    expect(
      computeCanonicalExecutionHealth({
        progressPct: 80,
        taskCompletionPct: 60,
        decisionHealthPct: 100,
        riskHealthPct: 80,
      }),
    ).toEqual({
      formulaVersion: EXECUTION_HEALTH_FORMULA_VERSION,
      score: 80,
      rag: 'GREEN',
      components: { progress: 80, tasks: 60, decisions: 100, risks: 80 },
    });
  });

  it.each([
    [0.95, 100, 'GREEN'],
    [0.85, 70, 'AMBER'],
    [0.84, 40, 'RED'],
  ] as const)('preserves the governed EVM threshold at SPI %s', (spi, score, rag) => {
    expect(computeCanonicalExecutionHealth({ spi })).toMatchObject({
      score,
      rag,
      components: { schedule: score },
    });
  });

  it.each([
    [{ criticalPathPercent: 20, overdueCriticalCount: 0 }, 100, 'GREEN'],
    [{ criticalPathPercent: 30, overdueCriticalCount: 0 }, 70, 'AMBER'],
    [{ criticalPathPercent: 10, overdueCriticalCount: 1 }, 70, 'AMBER'],
    [{ criticalPathPercent: 51, overdueCriticalCount: 0 }, 40, 'RED'],
    [{ criticalPathPercent: 10, overdueCriticalCount: 2 }, 40, 'RED'],
  ] as const)('normalizes critical-path health through the same formula', (input, score, rag) => {
    expect(computeCanonicalExecutionHealth(input)).toMatchObject({ score, rag });
  });

  it('returns explicit NA rather than fabricating health without facts', () => {
    expect(computeCanonicalExecutionHealth({})).toEqual({
      formulaVersion: EXECUTION_HEALTH_FORMULA_VERSION,
      score: null,
      rag: 'NA',
      components: {},
    });
  });
});
