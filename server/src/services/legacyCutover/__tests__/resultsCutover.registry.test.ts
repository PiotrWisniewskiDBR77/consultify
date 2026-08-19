import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { RESULTS_CUTOVER, RESULTS_LEGACY_CUTOVER_DENOMINATOR } from '../registry/results.js';

describe('Results legacy cutover registry', () => {
  it('retires exactly the canonical scorecard writer slice and keeps the remaining denominator open', () => {
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.totalDoors).toBe(28);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.retiredDoors).toEqual([
      'RESULTS-W33',
      'RESULTS-W35',
      'RESULTS-W36',
    ]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.openDoors).toHaveLength(25);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.unmappedDoors).toHaveLength(13);
  });

  it('gives every retired door a real canonical successor and narrow rollback unit', () => {
    for (const writerId of RESULTS_LEGACY_CUTOVER_DENOMINATOR.retiredDoors) {
      const writer = RESULTS_CUTOVER.writers.find((entry) => entry.writerId === writerId);
      expect(writer?.state).toBe('disabled');
      expect(writer?.successor).toMatch(/^\/api\/vnext\/results\/kpi\/scorecards/);
    }
    expect(RESULTS_CUTOVER.rollbackWritersEnv).toBe('RESULTS_LEGACY_ROLLBACK_WRITERS');
  });

  it('keeps the mounted Results hub caller on canonical scorecard adapters only', () => {
    const caller = readFileSync(
      path.resolve(__dirname, '../../../../../src/components/Results/ResultsKpiScorecardsView.tsx'),
      'utf8'
    );
    expect(caller).toContain('ResultsKpiRegistryPage');
    expect(caller).toContain('initialTab="scorecards"');
    expect(caller).not.toContain('@/services/api/v8/results');
    expect(caller).not.toMatch(
      /V8ResultsApi\.(?:createScorecard|addKpiToScorecard|removeKpiFromScorecard)/
    );

    const legacyClient = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(legacyClient).not.toMatch(
      /^\s+(?:createScorecard|addKpiToScorecard|removeKpiFromScorecard):/m
    );
  });
});
