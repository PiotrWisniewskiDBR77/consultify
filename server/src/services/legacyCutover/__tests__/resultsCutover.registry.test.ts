import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { RESULTS_CUTOVER, RESULTS_LEGACY_CUTOVER_DENOMINATOR } from '../registry/results.js';

// NOTE (cieciie ResultsHub, 2026-09-02): this guard used to assert the *content*
// of five files under src/components/Results/ (ResultsHub, KPITimeSeriesDrawer,
// KpiSignalSheetView, ResultsKpiScorecardsView, ROIDetailDrawer). That whole
// subtree was deleted — it had been unreachable from every route since
// 8df1cd413d (2026-08-24), so "the retired writer has no mounted caller" is now
// proven by the caller's absence, not by grepping its source. The assertions on
// the still-live legacy client (src/services/api/v8/results.ts) are untouched,
// including the four that are currently RED: that client still exports writers
// this registry declares retired, and that gap predates this cut.
describe('Results legacy cutover registry', () => {
  it('retires scorecard, deviation-command and legacy ROI-write slices and keeps the remaining denominator open', () => {
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.totalDoors).toBe(28);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.retiredDoors).toEqual([
      'RESULTS-W01',
      'RESULTS-W02',
      'RESULTS-W03',
      'RESULTS-W04',
      'RESULTS-W17',
      'RESULTS-W19',
      'RESULTS-W20',
      'RESULTS-W21',
      'RESULTS-W22',
      'RESULTS-W24',
      'RESULTS-W25',
      'RESULTS-W26',
      'RESULTS-W27',
      'RESULTS-W28',
      'RESULTS-W29',
      'RESULTS-W30',
      'RESULTS-W31',
      'RESULTS-W32',
      'RESULTS-W33',
      'RESULTS-W35',
      'RESULTS-W36',
      'RESULTS-W48',
      'RESULTS-W49',
    ]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.openDoors).toEqual([
      'RESULTS-W05', 'RESULTS-W06', 'RESULTS-W18', 'RESULTS-W23', 'RESULTS-W34',
    ]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.unmappedDoors).toEqual([
      'RESULTS-W05', 'RESULTS-W06', 'RESULTS-W18', 'RESULTS-W23', 'RESULTS-W34',
    ]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.canonicalCurrentDoors).toEqual([
      'RESULTS-W05', 'RESULTS-W06', 'RESULTS-W18', 'RESULTS-W23', 'RESULTS-W34',
    ]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.canonicalCurrentOwners).toEqual({
      'RESULTS-W05': 'results.routes:promote-closure-benefit',
      'RESULTS-W06': 'results.routes:dismiss-closure-benefit',
      'RESULTS-W18': 'results.routes:delete-kpi-mapping',
      'RESULTS-W23': 'results.routes:resolve-deviation-case',
      'RESULTS-W34': 'kpiScorecardService:updateScorecard',
    });
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.ownerlessCanonicalCurrentDoors).toEqual([]);
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.unresolvedDoors).toEqual([]);
  });

  it('retires direct KPI edits and measurements on the legacy client', () => {
    const client = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );

    expect(client).not.toMatch(/^\s+(?:updateKpi|createKpiTimeSeriesValue):/m);
  });

  it('gives every retired door a real canonical successor and narrow rollback unit', () => {
    for (const writerId of RESULTS_LEGACY_CUTOVER_DENOMINATOR.retiredDoors) {
      const writer = RESULTS_CUTOVER.writers.find((entry) => entry.writerId === writerId);
      expect(writer?.state).toBe('disabled');
      expect(writer?.successor).toMatch(/^\/api\/vnext\/results\/(?:kpi|initiatives|roi\/cases)/);
    }
    expect(RESULTS_CUTOVER.rollbackWritersEnv).toBe('RESULTS_LEGACY_ROLLBACK_WRITERS');
  });

  it('retires W01 and keeps the guarded W23 resolve usable', () => {
    expect(RESULTS_CUTOVER.writers.find((entry) => entry.writerId === 'RESULTS-W01')?.state).toBe('disabled');
    const resolve = RESULTS_CUTOVER.writers.find((entry) => entry.writerId === 'RESULTS-W23');
    expect(resolve?.state).toBe('observed');
    expect(resolve?.successor).toBeNull();
    expect(resolve?.disposition).toBe('canonical_current');
  });

  it('keeps resolve on the guarded V8 owner and removes the benefits fallback', () => {
    const legacyClient = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(legacyClient).not.toMatch(
      /^\s+(?:acknowledgeDeviationCase|updateDeviationCaseRca|createDeviationAction|updateDeviationAction|closeDeviationCase):/m
    );
    expect(legacyClient).toMatch(/^\s+resolveDeviationCase:/m);
  });

  it('removes the legacy scorecard writers from the V8 client', () => {
    const legacyClient = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(legacyClient).not.toMatch(
      /^\s+(?:createScorecard|addKpiToScorecard|removeKpiFromScorecard):/m
    );
  });

  it('removes both retired ROI mutation writers from the V8 client', () => {
    const legacyClient = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(legacyClient).not.toMatch(
      /^\s+(?:updateRoiInitiativeAssumptions|createRoiInitiativeRealizedEntry):/m
    );
  });

  it('directs Wave 4 mutation ownership to the canonical KPI surface', () => {
    const client = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(client).not.toMatch(/^\s+(?:createKpi|deleteKpi|createKpiMapping):/m);
  });
});
