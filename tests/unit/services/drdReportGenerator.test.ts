import { describe, expect, it } from 'vitest';

import DRD_STRUCTURE, { getTotalAreaCount } from '../../../src/services/drdStructure';
import { areaScoresFromAxisData } from '../../../src/services/report/drdReportClient';
import {
  deterministicNarrator,
  type ConclusionInput,
} from '../../../src/services/report/drdConclusionContract';
import { generateDrdReport } from '../../../src/services/report/drdReportGenerator';
import {
  buildAreaRows,
  buildDimensions,
  buildDrdReportModel,
  type AreaScores,
} from '../../../src/services/report/drdReportModel';
import {
  assertNoCrimson,
  BANNED_CRIMSON_TOKENS,
  buildMatrixSvg,
  buildRadarSvg,
} from '../../../src/services/report/drdReportSvg';
import {
  SAMPLE_DRD_META,
  SAMPLE_DRD_SCORES,
} from '../../../src/services/report/drdReportSampleData';

const META = { organizationName: 'Test Co', language: 'pl' as const };

describe('DRD report — structure & mapping', () => {
  it('maps all 39 areas across 7 axes (39 → 7 dimensions)', () => {
    expect(getTotalAreaCount()).toBe(39);
    const rows = buildAreaRows(SAMPLE_DRD_SCORES, 'pl');
    expect(rows).toHaveLength(39);
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    expect(dims).toHaveLength(7);
    // every area row belongs to exactly one of the 7 axes
    const axisIds = new Set(DRD_STRUCTURE.map((a) => a.id));
    for (const r of rows) expect(axisIds.has(r.axisId)).toBe(true);
  });

  it('each dimension aggregates only its own axis areas', () => {
    const rows = buildAreaRows(SAMPLE_DRD_SCORES, 'pl');
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    for (const dim of dims) {
      const axisAreas = rows.filter((r) => r.axisId === dim.axisId);
      const axis = DRD_STRUCTURE.find((a) => a.id === dim.axisId)!;
      expect(axisAreas).toHaveLength(axis.areas.length);
      expect(dim.maxLevel).toBe(axis.levelCount);
    }
  });

  it('builds the full model with all 8 sections worth of data', async () => {
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    expect(model.credibility.totalAreas).toBe(39);
    expect(model.credibility.assessedAreas).toBe(39);
    expect(model.executiveSummary.paragraphs).toHaveLength(5); // 5-paragraph exec summary
    expect(model.dimensions).toHaveLength(7);
    expect(model.areas).toHaveLength(39);
    expect(model.gapCards).toHaveLength(3); // top-3 gap cards
    expect(model.chapters).toHaveLength(7);
    expect(model.methodology.axes).toHaveLength(7);
    expect(model.roadmap.length).toBeGreaterThan(0);
  });
});

describe('DRD report — numbers only from engine', () => {
  it('normalizes mixed 5/7-level scales to percentages correctly', () => {
    const scores: AreaScores = { '1A': { actual: 7, target: 7 }, '2A': { actual: 5, target: 5 } };
    const rows = buildAreaRows(scores, 'en');
    const a1 = rows.find((r) => r.areaId === '1A')!;
    const a2 = rows.find((r) => r.areaId === '2A')!;
    expect(a1.maxLevel).toBe(7);
    expect(a1.actualPercent).toBe(100);
    expect(a2.maxLevel).toBe(5);
    expect(a2.actualPercent).toBe(100);
  });

  it('gap = max(0, target - actual), never negative', () => {
    const scores: AreaScores = { '1A': { actual: 6, target: 3 } };
    const rows = buildAreaRows(scores, 'en');
    expect(rows.find((r) => r.areaId === '1A')!.gap).toBe(0);
  });

  it('deterministic narrator produces prose but no invented numbers beyond facts', () => {
    const input: ConclusionInput = {
      kind: 'gap_card',
      language: 'en',
      organizationName: 'Test Co',
      facts: {
        areaName: 'Sales Processes',
        axisName: 'Digital Processes',
        actual: 3,
        target: 6,
        maxLevel: 7,
        currentLevelTitle: 'Process Control',
        targetLevelTitle: 'ERP',
      },
      evidence: [{ type: 'drd_area', ref: '1A' }],
    };
    const out = deterministicNarrator(input);
    expect(out.aiGenerated).toBe(false); // stub, not LLM
    expect(out.paragraphs).toHaveLength(4); // co-jest → co-znaczy → co-robić → efekt
    // numbers in prose come from facts only
    expect(out.paragraphs[0]).toContain('3/7');
    expect(out.paragraphs[1]).toContain('6/7');
  });
});

describe('DRD report — gap card formula (co-jest → co-znaczy → co-robić → efekt)', () => {
  it('every gap card has the 4-part narrative', async () => {
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    for (const card of model.gapCards) {
      expect(card.narrative.paragraphs).toHaveLength(4);
      expect(card.target).toBeGreaterThan(card.actual);
    }
  });

  it('gap cards are the largest normalized gaps', async () => {
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    const cardGaps = model.gapCards.map((c) => {
      const row = model.areas.find((r) => r.areaId === c.areaId)!;
      return row.targetPercent - row.actualPercent;
    });
    // non-increasing order
    for (let i = 1; i < cardGaps.length; i++) {
      expect(cardGaps[i - 1]).toBeGreaterThanOrEqual(cardGaps[i]);
    }
  });
});

describe('DRD report — roadmap impact × effort (F1–F3)', () => {
  it('assigns every gapped area to a wave and only uses F1/F2/F3', async () => {
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    const gapped = model.areas.filter((r) => r.target > r.actual).length;
    expect(model.roadmap).toHaveLength(gapped);
    for (const item of model.roadmap) {
      expect(['F1', 'F2', 'F3']).toContain(item.wave);
      expect(['low', 'medium', 'high']).toContain(item.impact);
      expect(['low', 'medium', 'high']).toContain(item.effort);
    }
  });

  it('F3 items are all high effort; F1 items are all low effort', async () => {
    const model = await buildDrdReportModel(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    for (const item of model.roadmap) {
      if (item.wave === 'F3') expect(item.effort).toBe('high');
      if (item.wave === 'F1') expect(item.effort).toBe('low');
    }
  });
});

describe('DRD report — crimson ban (palette)', () => {
  it('BANNED_CRIMSON_TOKENS includes the HBS crimson family', () => {
    expect(BANNED_CRIMSON_TOKENS).toContain('#85182f');
    expect(BANNED_CRIMSON_TOKENS).toContain('crimson');
  });

  it('assertNoCrimson throws on crimson, passes on clean strings', () => {
    expect(() => assertNoCrimson('color: #3b82f6;')).not.toThrow();
    expect(() => assertNoCrimson('color: #85182F;')).toThrow(/crimson/i);
    expect(() => assertNoCrimson('class="text-primary"')).toThrow();
  });

  it('generated HTML contains NO crimson tokens', async () => {
    const { html } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    expect(() => assertNoCrimson(html)).not.toThrow();
  });

  it('radar and matrix SVGs contain no crimson', () => {
    const dims = buildDimensions(SAMPLE_DRD_SCORES, 'pl');
    const rows = buildAreaRows(SAMPLE_DRD_SCORES, 'pl');
    expect(() => assertNoCrimson(buildRadarSvg(dims))).not.toThrow();
    expect(() => assertNoCrimson(buildMatrixSvg(rows))).not.toThrow();
  });
});

describe('DRD report — HTML document', () => {
  it('is a complete standalone A4 print document', async () => {
    const { html } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
    expect(html).toContain('size: A4');
    expect(html).toContain('page-break');
    // 9 pages (cover + 7 sections + additive P3 industry benchmark section)
    expect((html.match(/class="page/g) || []).length).toBe(9);
    // 3 inline SVGs (radar, matrix, bars)
    expect((html.match(/<svg/g) || []).length).toBe(3);
  });

  it('renders in both PL and EN', async () => {
    const pl = await generateDrdReport(SAMPLE_DRD_SCORES, { ...META, language: 'pl' });
    const en = await generateDrdReport(SAMPLE_DRD_SCORES, { ...META, language: 'en' });
    expect(pl.html).toContain('Streszczenie zarządcze');
    expect(en.html).toContain('Executive Summary');
  });
});

describe('DRD report — client axis→area bridge', () => {
  it('expands per-axis data to all 39 areas', () => {
    const scores = areaScoresFromAxisData({
      processes: { actual: 4, target: 6 },
      aiMaturity: { actual: 2, target: 4 },
    });
    expect(Object.keys(scores)).toHaveLength(39);
    expect(scores['1A']).toEqual({ actual: 4, target: 6 });
    expect(scores['7A']).toEqual({ actual: 2, target: 4 });
    // unspecified axes default to 0
    expect(scores['2A']).toEqual({ actual: 0, target: 0 });
  });
});
