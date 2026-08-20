import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { RESULTS_CUTOVER, RESULTS_LEGACY_CUTOVER_DENOMINATOR } from '../registry/results.js';

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
    expect(RESULTS_LEGACY_CUTOVER_DENOMINATOR.unresolvedDoors).toEqual([]);
  });

  it('retires direct KPI edits and measurements only after mounted callers use canonical contracts', () => {
    const drawer = readFileSync(
      path.resolve(__dirname, '../../../../../src/components/Results/KPITimeSeriesDrawer.tsx'),
      'utf8'
    );
    const sheet = readFileSync(
      path.resolve(__dirname, '../../../../../src/components/Results/KpiSignalSheetView.tsx'),
      'utf8'
    );
    const client = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );

    expect(client).not.toMatch(/^\s+(?:updateKpi|createKpiTimeSeriesValue):/m);
    expect(drawer).not.toMatch(/V8ResultsApi\.(?:updateKpi|createKpiTimeSeriesValue)\b/);
    expect(drawer).not.toMatch(/Api\.(?:put|post)\(`\/benefits\/kpis\/\$\{kpiId\}/);
    expect(sheet).toContain('recordKpiMeasurement');
    expect(sheet).toContain('getKpiCurrentDefinitionVersion');
    expect(sheet).toContain('definitionVersionId: definition.definitionVersionId');
    expect(sheet).toContain('idempotencyKey: draft.idempotencyKey');
    expect(sheet).toContain('readback.some((row) => row.measurementId === measurement.measurementId)');
    expect(sheet).not.toContain('createKpiTimeSeriesValue');
    expect(sheet).not.toContain('/benefits/kpis/');
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
    expect(drawer).not.toContain(
      'Api.post(`/benefits/deviation-cases/${openCase.id}/resolve`, {})'
    );

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

  it('keeps legacy ROI history readable but removes both retired mutation callers', () => {
    const drawer = readFileSync(
      path.resolve(__dirname, '../../../../../src/components/Results/ROIDetailDrawer.tsx'),
      'utf8'
    );
    expect(drawer).toContain('legacy-roi-archive-notice');
    expect(drawer).toContain('href="/results/roi"');
    expect(drawer).toContain('<ROIAssumptionEditor');
    expect(drawer).toContain('disabled');
    expect(drawer).not.toMatch(
      /V8ResultsApi\.(?:updateRoiInitiativeAssumptions|createRoiInitiativeRealizedEntry)/
    );
    expect(drawer).not.toMatch(
      /Api\.(?:put|post)\(`\/benefits\/roi\/\$\{initiativeId\}\/(?:assumptions|realized)/
    );
    expect(drawer).not.toContain('handleRecordRealized');

    const legacyClient = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(legacyClient).not.toMatch(
      /^\s+(?:updateRoiInitiativeAssumptions|createRoiInitiativeRealizedEntry):/m
    );
  });

  it('removes every mounted Wave 4 legacy caller and directs mutation ownership to the canonical KPI surface', () => {
    const client = readFileSync(
      path.resolve(__dirname, '../../../../../src/services/api/v8/results.ts'),
      'utf8'
    );
    expect(client).not.toMatch(/^\s+(?:createKpi|deleteKpi|createKpiMapping):/m);

    for (const relative of [
      '../../../../../src/components/Results/ResultsHub.tsx',
      '../../../../../src/components/Results/KPITimeSeriesDrawer.tsx',
    ]) {
      const caller = readFileSync(path.resolve(__dirname, relative), 'utf8');
      expect(caller).not.toMatch(/V8ResultsApi\.(?:createKpi|deleteKpi|createKpiMapping)\b/);
      expect(caller).not.toMatch(/Api\.post\(['`]\/benefits\/(?:kpis|kpi-mappings)['`]/);
      expect(caller).not.toMatch(/Api\.delete\(`\/benefits\/kpis\/\$\{kpiId\}`\)/);
      expect(caller).not.toContain('KPICreateModal');
      expect(caller).not.toContain('handleDeleteKpi');
      expect(caller).not.toContain('handleLinkInitiative');
    }
  });
});
