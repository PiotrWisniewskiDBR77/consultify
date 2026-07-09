import { describe, expect, it } from 'vitest';

import {
  DRD_INDUSTRY_IDS,
  getDRDIndustryProfile,
} from '../../../src/services/assessmentKnowledge/drdIndustryProfiles';
import { buildDimensions } from '../../../src/services/report/drdReportModel';
import {
  AXIS_TO_DRD_DIMENSION_ID,
  buildDrdIndustryBenchmarkSection,
  DEFAULT_DRD_BENCHMARK_INDUSTRY,
} from '../../../src/services/report/drdIndustryBenchmark';
import { generateDrdReport } from '../../../src/services/report/drdReportGenerator';
import { assertNoCrimson } from '../../../src/services/report/drdReportSvg';
import { SAMPLE_DRD_META, SAMPLE_DRD_SCORES } from '../../../src/services/report/drdReportSampleData';

describe('DRD industry benchmark — branża→profil→delta mapping', () => {
  it('defaults to process-manufacturing ("produkcja") when no industry is given', () => {
    expect(DEFAULT_DRD_BENCHMARK_INDUSTRY).toBe('process-manufacturing');
  });

  it('maps the 7 engine axes onto 6 of the 8 D-dimensions, leaving D5 unmatched', () => {
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    const section = buildDrdIndustryBenchmarkSection(dims, 'process-manufacturing');
    expect(section.rows).toHaveLength(7);
    expect(section.rows.map((r) => r.dimensionId).sort()).toEqual([
      'D1',
      'D2',
      'D3',
      'D4',
      'D6',
      'D7',
      'D8',
    ]);
    expect(section.unmatchedDimensionIds).toEqual(['D5']);
  });

  it('every axis id maps to exactly one D-dimension id used by the profiles', () => {
    const mappedIds = Object.values(AXIS_TO_DRD_DIMENSION_ID);
    expect(new Set(mappedIds).size).toBe(mappedIds.length); // no axis collapses two axes onto one D-id
    for (const id of mappedIds) {
      expect(['D1', 'D2', 'D3', 'D4', 'D6', 'D7', 'D8']).toContain(id);
    }
  });

  it('computes deltas as actualPercent - {typical,leader}Percent, from engine + profile only', () => {
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    const section = buildDrdIndustryBenchmarkSection(dims, 'discrete-manufacturing');
    const profile = getDRDIndustryProfile('discrete-manufacturing');
    for (const row of section.rows) {
      const benchmark = profile.dimensionBenchmarks[row.dimensionId];
      const typicalPercent = Math.round((benchmark.typical / 5) * 100);
      const leaderPercent = Math.round((benchmark.leader / 5) * 100);
      expect(row.typicalPercent).toBe(typicalPercent);
      expect(row.leaderPercent).toBe(leaderPercent);
      expect(row.deltaToTypical).toBe(row.actualPercent - typicalPercent);
      expect(row.deltaToLeader).toBe(row.actualPercent - leaderPercent);
    }
  });

  it('every industry id builds a valid section carrying the mandatory disclaimer', () => {
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    for (const industry of DRD_INDUSTRY_IDS) {
      const section = buildDrdIndustryBenchmarkSection(dims, industry);
      expect(section.industry).toBe(industry);
      expect(section.disclaimer.pl).toMatch(/hipoteza/i);
      expect(section.disclaimer.en).toMatch(/hypothesis/i);
      expect(section.source).toBe('expert-hypothesis-v1');
    }
  });

  it('leader percent is always >= typical percent (profile invariant survives the D->axis mapping)', () => {
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    for (const industry of DRD_INDUSTRY_IDS) {
      const section = buildDrdIndustryBenchmarkSection(dims, industry);
      for (const row of section.rows) {
        expect(row.leaderPercent).toBeGreaterThanOrEqual(row.typicalPercent);
      }
    }
  });
});

describe('DRD report — industry benchmark section is additive to the model', () => {
  it('buildDrdReportModel always populates industryBenchmark (default industry when meta.industry is absent)', async () => {
    const { buildDrdReportModel } = await import('../../../src/services/report/drdReportModel');
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    expect(model.industryBenchmark).toBeDefined();
    expect(model.industryBenchmark.industry).toBe(DEFAULT_DRD_BENCHMARK_INDUSTRY);
    // existing sections untouched
    expect(model.dimensions).toHaveLength(7);
    expect(model.chapters).toHaveLength(7);
    expect(model.gapCards).toHaveLength(3);
  });

  it('honors an explicit meta.industry over the default', async () => {
    const { buildDrdReportModel } = await import('../../../src/services/report/drdReportModel');
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, {
      ...SAMPLE_DRD_META,
      industry: 'professional-services',
    });
    expect(model.industryBenchmark.industry).toBe('professional-services');
  });
});

describe('DRD report HTML — benchmark section renders, no crimson, disclaimer present', () => {
  it('renders a 9th benchmark page with the disclaimer and industry label', async () => {
    const { html, model } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    expect(html).toContain(model.industryBenchmark.disclaimer.pl);
    expect(html).toContain(model.industryBenchmark.industryLabel.pl);
    expect(() => assertNoCrimson(html)).not.toThrow();
  });

  it('does not alter the byte-identical structure of the pre-existing 8 sections (section tags 01-07 present)', async () => {
    const { html } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    for (const tag of ['01', '02', '03', '04', '05', '06', '07']) {
      expect(html).toContain(`section-tag">${tag}<`);
    }
  });
});
