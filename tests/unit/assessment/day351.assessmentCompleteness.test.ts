// KONTRAKT DYŻURU 351 — cel metodyki nie jest odpowiedzią.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { hasAssessmentResponse as serverHasResponse } from '../../../server/src/services/report/assessmentCompleteness';
import {
  buildDRDVisualizationData as buildServerAreas,
  buildDRDVisualizationDataFromAxes as buildServerAxes,
} from '../../../server/src/services/report/drdVizAdapter';
import { hasAssessmentResponse as frontendHasResponse } from '../../../src/services/assessmentCompleteness';
import {
  buildDRDVisualizationData as buildFrontendAreas,
  buildDRDVisualizationDataFromAxes as buildFrontendAxes,
} from '../../../src/services/drdVizAdapter';

const manifest = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'evidence/silniki-raportu-oceny-20260904/day339-engine-manifest.json'),
    'utf8'
  )
) as { input: { areaScores: Record<string, { actual: number; target: number }> } };

const targetOnlyAxes = {
  processes: { actual: 0, target: 3 },
  digitalProducts: { actual: 0, target: 3 },
  businessModels: { actual: 0, target: 3 },
  dataManagement: { actual: 0, target: 3 },
  culture: { actual: 0, target: 3 },
  cybersecurity: { actual: 0, target: 3 },
  aiMaturity: { actual: 0, target: 3 },
};

describe('Dyżur 351 — jedna definicja kompletności per drzewo', () => {
  it('utrzymuje parytet definicji serwerowej i frontowej', () => {
    const samples = [
      null,
      { actual: 0, target: 5 },
      { actual: 2, target: 5 },
      { current: 0, target: 5 },
      { current: 2, target: 5 },
      { achievedLevel: 0, targetLevel: 5 },
      { achievedLevel: 2, targetLevel: 5 },
    ];
    expect(samples.map(serverHasResponse)).toEqual(samples.map(frontendHasResponse));
    expect(samples.map(frontendHasResponse)).toEqual([false, false, true, false, true, false, true]);
  });

  it('serwerowy adapter obszarów raportuje 7/39 jako 18%, a 39/39 jako 100%', () => {
    const partial = buildServerAreas(manifest.input.areaScores);
    const full = buildServerAreas(
      Object.fromEntries(Object.entries(manifest.input.areaScores).map(([id, s]) => [id, { ...s, actual: s.actual || 1 }]))
    );
    expect([partial.completionPercent, full.completionPercent]).toEqual([18, 100]);
  });

  it('frontowy adapter obszarów raportuje 7/39 jako 18%, a 39/39 jako 100%', () => {
    const partial = buildFrontendAreas(manifest.input.areaScores);
    const full = buildFrontendAreas(
      Object.fromEntries(Object.entries(manifest.input.areaScores).map(([id, s]) => [id, { ...s, actual: s.actual || 1 }]))
    );
    expect([partial.completionPercent, full.completionPercent]).toEqual([18, 100]);
  });

  it('serwerowy adapter osi nie uznaje samych celów za kompletność', () => {
    expect(buildServerAxes(targetOnlyAxes).completionPercent).toBe(0);
    const full = Object.fromEntries(Object.entries(targetOnlyAxes).map(([id, s]) => [id, { ...s, actual: 1 }]));
    expect(buildServerAxes(full).completionPercent).toBe(100);
  });

  it('frontowy adapter osi nie uznaje samych celów za kompletność', () => {
    expect(buildFrontendAxes(targetOnlyAxes).completionPercent).toBe(0);
    const full = Object.fromEntries(Object.entries(targetOnlyAxes).map(([id, s]) => [id, { ...s, actual: 1 }]));
    expect(buildFrontendAxes(full).completionPercent).toBe(100);
  });

  it('SIRIForm liczy postęp przez wspólną definicję, bez alternatywy target', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/assessment/tools/SIRIForm.tsx'), 'utf8');
    expect(source).toContain('Object.values(dimensions).filter(hasAssessmentResponse).length');
    expect(source).not.toContain('(d.current > 0 || d.target > 0)');
  });

  it('DRDForm liczy postęp przez wspólną definicję, bez alternatywy target', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/assessment/tools/DRDForm.tsx'), 'utf8');
    expect(source).toContain('if (hasAssessmentResponse(axisData))');
    expect(source).not.toContain('(axisData.actual > 0 || axisData.target > 0)');
  });
});
