/**
 * O1 W7 — axis_data absurdity guard (client-report-facing, high risk).
 *
 * CONTEXT / FINDING
 * ------------------
 * `assessment_reports.axis_data` stores DRD/SIRI/ADMA maturity LEVELS
 * (0..axis.levelCount — 5 or 7 for DRD, 0..5 for SIRI/ADMA), never 0-100
 * percentages. The report renderer computes `pct(level, maxLevel) =
 * level/maxLevel*100`. Any seed/fixture/import that (mistakenly) writes a
 * 0-100 percentage into `axis_data` blows straight past 100% once rendered
 * ("Cyberbezpieczeństwo 600%") — a client-facing report Piotr will not sign.
 *
 * This suite proves BOTH halves of the defense-in-depth fix:
 *   1. WRITE-ADJACENT guard — `areaScoresFromAxisData` (server + FE mirror)
 *      clamps out-of-range axis_data into [0, axis.levelCount] the moment it
 *      is read back into engine scores, so bad data already sitting in the
 *      DB (any source) can never propagate.
 *   2. RENDER guard — `pct()` (server + FE `drdReportModel.ts`) clamps its
 *      own input, and `buildDrdReportHtmlServer`'s full HTML output for a
 *      deliberately corrupt axisData never contains a percent above 100%.
 *   3. SIRI/ADMA parity — `assessmentReportDataAdapter.ts` applies the same
 *      0..5 clamp at its single read choke point (`cell()` + explicit
 *      block/pillar/area reads), since those templates render
 *      `(current/5)*100%` bar widths with no guard of their own.
 *
 * No DB, no LLM key required — `buildDrdReportHtmlServer` without an `llm`
 * param uses the deterministic narrator (see drdReportService.test.ts for
 * precedent). Fast and hermetic.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  buildDrdReportHtmlServer,
  areaScoresFromAxisData as areaScoresFromAxisDataServer,
} from '../../../server/src/services/report/drdReportService';
import {
  buildADMAAssessmentData,
  buildSIRIAssessmentData,
} from '../../../src/services/report/assessmentReportDataAdapter';
import { areaScoresFromAxisData as areaScoresFromAxisDataFe } from '../../../src/services/report/drdReportClient';

const META = {
  organizationName: 'Guard Test Sp. z o.o.',
  language: 'pl' as const,
  assessmentName: 'Diagnoza DRD — axis_data guard',
};

describe('O1 W7 — write-adjacent guard: areaScoresFromAxisData clamps out-of-range levels', () => {
  it('server: clamps a mistaken 0-100 "percentage" (100) into the axis levelCount, never passes it through raw', () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // "processes" (axis 1) has levelCount=7; "cybersecurity" (axis 6) has levelCount=5.
    const corrupt = {
      processes: { actual: 100, target: 100 }, // way past 7
      cybersecurity: { actual: 100, target: 50 }, // way past 5
    };
    const scores = areaScoresFromAxisDataServer(corrupt);
    // Every area under axis 1 must be clamped to <=7, axis 6 to <=5 — never 100.
    expect(scores['1A'].actual).toBeLessThanOrEqual(7);
    expect(scores['1A'].target).toBeLessThanOrEqual(7);
    expect(scores['1A'].actual).not.toBe(100);
    expect(scores['6A'].actual).toBeLessThanOrEqual(5);
    expect(scores['6A'].target).toBeLessThanOrEqual(5);
    expect(scores['6A'].actual).not.toBe(100);
    warnSpy.mockRestore();
  });

  it('server: leaves in-range levels untouched (no false-positive clamping)', () => {
    const scores = areaScoresFromAxisDataServer({
      processes: { actual: 3, target: 4 },
      cybersecurity: { actual: 1, target: 5 },
    });
    expect(scores['1A']).toEqual({ actual: 3, target: 4 });
    expect(scores['6A']).toEqual({ actual: 1, target: 5 });
  });

  it('FE mirror (drdReportClient.ts) applies the identical clamp — no drift between the two copies', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const corrupt = { processes: { actual: 100, target: 100 } };
    const scores = areaScoresFromAxisDataFe(corrupt);
    expect(scores['1A'].actual).toBeLessThanOrEqual(7);
    expect(scores['1A'].actual).not.toBe(100);
    warnSpy.mockRestore();
  });
});

describe('O1 W7 — render guard: full report generation never emits >100% from corrupt axis_data', () => {
  it('a corrupt axisData (100 where max is 5 or 7) renders a report with no percentage above 100%', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const corruptAxisData = {
      processes: { actual: 100, target: 100 }, // levelCount 7 — would be 1428% unclamped
      digitalProducts: { actual: 100, target: 100 }, // levelCount 5 — would be 2000% unclamped
      businessModels: { actual: 3, target: 4 },
      dataManagement: { actual: 4, target: 6 },
      culture: { actual: 4, target: 5 },
      cybersecurity: { actual: 100, target: 5 }, // the exact "Cyberbezpieczeństwo 600%" scenario
      aiMaturity: { actual: 2, target: 4 },
    };

    const { html, model } = await buildDrdReportHtmlServer({
      axisData: corruptAxisData,
      meta: META,
    });

    expect(html).toContain('<!DOCTYPE html');

    // No percent token in the rendered HTML exceeds 100%.
    const percentMatches = [...html.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
    expect(percentMatches.length).toBeGreaterThan(0); // sanity: percentages actually render
    for (const p of percentMatches) {
      expect(p).toBeLessThanOrEqual(100);
    }

    // Structural proof at the model level, not just string-matching the HTML.
    for (const row of model.areas) {
      expect(row.actualPercent).toBeLessThanOrEqual(100);
      expect(row.actualPercent).toBeGreaterThanOrEqual(0);
      expect(row.targetPercent).toBeLessThanOrEqual(100);
      expect(row.actual).toBeLessThanOrEqual(row.maxLevel);
      expect(row.target).toBeLessThanOrEqual(row.maxLevel);
    }
    for (const dim of model.dimensions) {
      expect(dim.actualPercent).toBeLessThanOrEqual(100);
      expect(dim.targetPercent).toBeLessThanOrEqual(100);
      expect(dim.actual).toBeLessThanOrEqual(dim.maxLevel);
    }
    // The exact absurdity from the finding must never appear.
    expect(html).not.toMatch(/600%/);
    expect(html).not.toMatch(/1428%|2000%/);

    errSpy.mockRestore();
  }, 30_000);
});

describe('O1 W7 — SIRI/ADMA parity: assessmentReportDataAdapter clamps to the 0-5 scale', () => {
  it('buildSIRIAssessmentData clamps out-of-range block/dimension/prioritisation values', () => {
    const corrupt = {
      _framework: 'SIRI',
      block_PROCESS: { actual: 100, target: 100 },
      dim_operations: { actual: 100, target: 5 }, // real SIRI_DIMENSIONS id
      area_A1: 100,
    };
    const data = buildSIRIAssessmentData(corrupt as any);
    expect(data.buildingBlocks.PROCESS.score).toBeLessThanOrEqual(5);
    expect(data.buildingBlocks.PROCESS.score).not.toBe(100);
    expect(data.dimensions.operations?.current).toBeLessThanOrEqual(5);
    expect(data.prioritisationMatrix.A1).toBeLessThanOrEqual(5);
  });

  it('buildADMAAssessmentData clamps out-of-range pillar/dimension values', () => {
    const corrupt = {
      _framework: 'ADMA',
      pillar_strategy: { actual: 100, target: 100 },
      dim_digital_strategy: { actual: 100, target: 5 }, // real ADMA_DIMENSIONS id
    };
    const data = buildADMAAssessmentData(corrupt as any);
    expect(data.pillars.strategy?.current).toBeLessThanOrEqual(5);
    expect(data.pillars.strategy?.current).not.toBe(100);
    expect(data.dimensions.digital_strategy?.current).toBeLessThanOrEqual(5);
  });
});
