import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { RESULTS_CUTOVER, RESULTS_LEGACY_CUTOVER_DENOMINATOR } from '../registry/results.js';

describe('Results legacy cutover registry', () => {
  it('retires the scorecard and deviation command slices and keeps the remaining denominator open', () => {
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.totalDoors).toBe(28);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.retiredDoors).toEqual([
      'RESULTS-W19',
      'RESULTS-W20',
      'RESULTS-W21',
      'RESULTS-W22',
      'RESULTS-W24',
      'RESULTS-W33',
      'RESULTS-W35',
      'RESULTS-W36',
    ]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.openDoors).toHaveLength(20);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.unmappedDoors).toHaveLength(13);
  });

  it('gives every retired door a real canonical successor and narrow rollback unit', () => {
    for (const writerId of RESULTS_LEGACY_CUTOVER_DENOMINATOR.retiredDoors) {
      const writer = RESULTS_CUTOVER.writers.find((entry) => entry.writerId === writerId);
      expect(writer?.state).toBe('disabled');
      expect(writer?.successor).toMatch(
        /^\/api\/vnext\/results\/kpi\/(?:scorecards|deviation-cases)/
      );
    }
    expect(RESULTS_CUTOVER.rollbackWritersEnv).toBe('RESULTS_LEGACY_ROLLBACK_WRITERS');
  });

  it('does not retire W01 and keeps unmapped W23 resolve usable', () => {
    expect(RESULTS_CUTOVER.writers.find((entry) => entry.writerId === 'RESULTS-W01')?.state).toBe(
      'protected'
    );
    const resolve = RESULTS_CUTOVER.writers.find((entry) => entry.writerId === 'RESULTS-W23');
    expect(resolve?.state).toBe('observed');
    expect(resolve?.successor).toBeNull();
  });

  it('retires only mapped drawer commands and preserves unmapped resolve', () => {
    const drawer = readFileSync(
      path.resolve(__dirname, '../../../../../src/components/Results/KPITimeSeriesDrawer.tsx'),
      'utf8'
    );
    expect(drawer).toContain('Legacy deviation commands are partially retired');
    expect(drawer).toContain('V8ResultsApi.resolveDeviationCase(openCase.id)');
    expect(drawer).not.toMatch(
      /V8ResultsApi\.(?:acknowledgeDeviationCase|updateDeviationCaseRca|createDeviationAction|updateDeviationAction|closeDeviationCase)/
    );
    expect(drawer).not.toMatch(
      /Api\.(?:post|put)\(`\/benefits\/deviation-cases\/\$\{openCase\.id\}\/(?:acknowledge|rca|actions|close)/
    );
    expect(drawer).toContain('Api.post(`/benefits/deviation-cases/${openCase.id}/resolve`, {})');

    const legacyClient = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(legacyClient).not.toMatch(
      /^\s+(?:acknowledgeDeviationCase|updateDeviationCaseRca|createDeviationAction|updateDeviationAction|closeDeviationCase):/m
    );
    expect(legacyClient).toMatch(/^\s+resolveDeviationCase:/m);
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
