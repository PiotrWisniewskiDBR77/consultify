/**
 * DRD Report — data model builder (pure, deterministic)
 *
 * Turns raw assessment scores (`Record<areaId, {actual,target}>`) into the complete
 * data model for the 8-section publishing-grade DRD client report:
 *   1. Cover (with credibility metric)
 *   2. Executive summary (5 paragraphs)
 *   3. Radar 8D  (7 measured axes → communication dimensions)
 *   4. 39-area matrix
 *   5. Top-3 gap cards (co-jest → co-znaczy → co-robić → efekt)
 *   6. Roadmap impact×effort (F1–F3)
 *   7. Per-dimension chapters
 *   8. Methodology appendix
 *
 * HARD RULE: every number here is computed from the engine (`drdStructure` helpers).
 * The narrative (paragraphs) comes from a `DrdNarrator` — deterministic stub by default.
 *
 * On the 8D communication layer / MAP-1.0:
 *   The canon doc (`docs/product/DRD_CANON.md`) that would define the exact 7-axis →
 *   8-dimension mapping is NOT present in this branch. Inventing an 8th dimension's
 *   NUMBERS would violate "liczby tylko z silnika". Therefore the radar communicates
 *   the 7 measured axes (real engine output) as its dimensions, and `EIGHT_D_NOTE`
 *   documents the pending 8th communication dimension as an explicit TODO. When the
 *   canon lands, extend `buildDimensions()` with the grounded mapping.
 */

import DRD_STRUCTURE, {
  calculateAxisScore,
  calculateOverallScore,
  type DRDArea,
  getTotalAreaCount,
} from '../../data/drdStructure.js';
import type { DRDIndustryId } from '../assessmentKnowledge/drdIndustryProfiles.js';
import {
  type ConclusionEvidenceRef,
  type ConclusionOutput,
  deterministicNarrator,
  type DrdNarrator,
} from './drdConclusionContract.js';
import {
  buildDrdIndustryBenchmarkSection,
  DEFAULT_DRD_BENCHMARK_INDUSTRY,
  type DrdIndustryBenchmarkSection,
} from './drdIndustryBenchmark.js';
import type { DrdGroundingProvider } from './drdReportGrounding.js';
import { buildDRDVisualizationData } from './drdVizAdapter.js';

export type AreaScores = Record<string, { actual: number; target: number }>;

export interface DrdReportMeta {
  organizationName: string;
  language: 'pl' | 'en';
  reportDate?: string; // ISO or display string; defaults to today
  assessmentName?: string;
  /** Optional industry benchmark (engine/config supplied, NOT invented per-run). */
  benchmark?: { label: string; value: number } | null;
  /**
   * DRD industry reference profile segment (P3, expert-hypothesis-v1) used for
   * the "Benchmark branżowy" section. Sourced from the organization profile
   * when that field exists; otherwise defaults to `DEFAULT_DRD_BENCHMARK_INDUSTRY`
   * ("produkcja" / process-manufacturing).
   */
  industry?: DRDIndustryId;
}

export interface DrdReportOptions {
  /** Narrator for prose. Defaults to the deterministic stub (no LLM). */
  narrator?: DrdNarrator;
  /**
   * Optional per-axis RAG grounding (F14 / §7 KONCEPT_CONTENT_ENGINES) — when
   * supplied, book-methodology evidence (`type: 'drd_methodology_kb'`) is merged
   * into the executive summary, gap card, and chapter evidence arrays BEFORE
   * calling the narrator. Server-only (needs DB access) — see
   * `drdReportGrounding.ts`. Omitted on the FE copy of this file (browser bundle).
   */
  grounding?: DrdGroundingProvider;
}

/** Per-area row in the 39-area matrix. */
export interface DrdAreaRow {
  areaId: string;
  areaName: string;
  axisId: number;
  axisName: string;
  actual: number;
  target: number;
  gap: number;
  maxLevel: number;
  /** actual normalized to 0..100 for cross-scale comparison. */
  actualPercent: number;
  targetPercent: number;
  currentLevelTitle: string;
  targetLevelTitle: string;
  /** severity bucket for coloring (blue/teal/amber — never crimson). */
  severity: 'none' | 'low' | 'medium' | 'high';
}

export interface DrdDimension {
  id: string;
  axisId: number;
  name: string;
  namePL?: string;
  actual: number;
  target: number;
  gap: number;
  maxLevel: number;
  actualPercent: number;
  targetPercent: number;
  color: string;
}

export interface DrdGapCard {
  areaId: string;
  areaName: string;
  axisName: string;
  actual: number;
  target: number;
  gap: number;
  maxLevel: number;
  narrative: ConclusionOutput;
}

export interface DrdRoadmapItem {
  areaId: string;
  areaName: string;
  axisName: string;
  gap: number;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  wave: 'F1' | 'F2' | 'F3';
}

export interface DrdChapter {
  axisId: number;
  axisName: string;
  actual: number;
  target: number;
  maxLevel: number;
  areas: DrdAreaRow[];
  narrative: ConclusionOutput;
}

export interface DrdReportModel {
  meta: Required<Pick<DrdReportMeta, 'organizationName' | 'language'>> & DrdReportMeta;
  credibility: {
    assessedAreas: number;
    totalAreas: number;
    completionPercent: number;
    /** overall confidence label derived from completion. */
    confidenceLabel: string;
  };
  overall: {
    actual: number;
    target: number;
    gap: number;
    actualPercent: number;
    targetPercent: number;
    maturityStage: string;
  };
  executiveSummary: ConclusionOutput;
  dimensions: DrdDimension[];
  areas: DrdAreaRow[];
  gapCards: DrdGapCard[];
  roadmap: DrdRoadmapItem[];
  chapters: DrdChapter[];
  methodology: {
    axes: { id: number; name: string; namePL?: string; areaCount: number; levelCount: number }[];
    totalAreas: number;
  };
  /**
   * Industry benchmark overlay (P3, expert-hypothesis-v1) — ADDITIVE, does not
   * replace or alter any other section. Always populated (falls back to
   * `DEFAULT_DRD_BENCHMARK_INDUSTRY` when `meta.industry` is not supplied).
   */
  industryBenchmark: DrdIndustryBenchmarkSection;
}

/**
 * The 8th communication dimension is defined by the (missing) DRD canon MAP-1.0.
 * Documented as a TODO so the radar stays engine-grounded (7 real axes) until then.
 */
export const EIGHT_D_NOTE =
  'TODO(canon): 8D communication layer (MAP-1.0) not yet defined in docs/product/DRD_CANON.md. ' +
  'Radar currently communicates the 7 measured axes (engine-exact). Add the 8th grounded ' +
  'dimension in buildDimensions() once the canon lands.';

const round1 = (n: number) => Math.round(n * 10) / 10;
/**
 * RENDER GUARD (finding O1 W7): `value` is a DRD maturity LEVEL (0..max), not a
 * percentage. Corrupt upstream data (bad seed/fixture/import writing 0-100 into
 * `axis_data`) must never reach a client report as e.g. "600%" — clamp into
 * [0,max] before dividing so the output is always a sane 0-100%, even if the
 * write-side guard (`areaScoresFromAxisData` in `drdReportService.ts`) was ever
 * bypassed or the DB already holds bad rows from before that guard existed.
 */
const pct = (value: number, max: number) => {
  if (max <= 0) return 0;
  const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  return Math.round((clamped / max) * 100);
};

function severityFor(gapPercent: number): DrdAreaRow['severity'] {
  if (gapPercent <= 0) return 'none';
  if (gapPercent < 15) return 'low';
  if (gapPercent < 30) return 'medium';
  return 'high';
}

function levelTitle(area: DRDArea, level: number): string {
  const rounded = Math.max(1, Math.min(area.levels.length, Math.round(level)));
  return area.levels[rounded - 1]?.title ?? `Level ${rounded}`;
}

function maturityStage(actualPercent: number, isPL: boolean): string {
  if (actualPercent < 25) return isPL ? 'Inicjacja Cyfrowa' : 'Digital Initiation';
  if (actualPercent < 45) return isPL ? 'Podstawowa Digitalizacja' : 'Basic Digitalization';
  if (actualPercent < 65) return isPL ? 'Integracja Systemowa' : 'System Integration';
  if (actualPercent < 82) return isPL ? 'Zaawansowana Automatyzacja' : 'Advanced Automation';
  return isPL ? 'Lider Cyfrowy' : 'Digital Leader';
}

function confidenceLabel(completionPercent: number, isPL: boolean): string {
  if (completionPercent >= 90) return isPL ? 'Wysoka' : 'High';
  if (completionPercent >= 60) return isPL ? 'Średnia' : 'Medium';
  if (completionPercent >= 30) return isPL ? 'Niska' : 'Low';
  return isPL ? 'Niewystarczająca' : 'Insufficient';
}

/**
 * RENDER GUARD (finding O1 W7): clamps a raw engine-score level into [0,max]
 * before it's displayed (e.g. "actual/maxLevel"). `buildAreaRows`/`buildDimensions`
 * are the true render boundary — clamping here protects every caller, not just
 * the ones that route through `areaScoresFromAxisData`.
 */
const clampToMax = (value: number, max: number) =>
  Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));

/** Build the per-area matrix rows (39 areas) from engine scores. */
export function buildAreaRows(areaScores: AreaScores, language: 'pl' | 'en'): DrdAreaRow[] {
  const isPL = language === 'pl';
  const rows: DrdAreaRow[] = [];
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      const raw = areaScores[area.id];
      const maxLevel = axis.levelCount;
      const actual = round1(clampToMax(Number(raw?.actual ?? 0), maxLevel));
      const target = round1(clampToMax(Number(raw?.target ?? 0), maxLevel));
      const gap = round1(Math.max(0, target - actual));
      const actualPercent = pct(actual, maxLevel);
      const targetPercent = pct(target, maxLevel);
      rows.push({
        areaId: area.id,
        areaName: isPL ? area.namePL || area.name : area.name,
        axisId: axis.id,
        axisName: isPL ? axis.namePL || axis.name : axis.name,
        actual,
        target,
        gap,
        maxLevel,
        actualPercent,
        targetPercent,
        currentLevelTitle: levelTitle(area, actual),
        targetLevelTitle: levelTitle(area, target),
        severity: severityFor(targetPercent - actualPercent),
      });
    }
  }
  return rows;
}

/** Build the radar dimensions from engine scores (7 measured axes). */
export function buildDimensions(areaScores: AreaScores, language: 'pl' | 'en'): DrdDimension[] {
  const isPL = language === 'pl';
  const viz = buildDRDVisualizationData(areaScores);
  return viz.dimensions.map((d) => {
    const axisId = Number(d.id);
    const { gap } = calculateAxisScore(axisId, areaScores);
    const current = clampToMax(d.current, d.maxLevel);
    const target = clampToMax(d.target, d.maxLevel);
    return {
      id: d.id,
      axisId,
      name: isPL ? d.namePL || d.name : d.name,
      namePL: d.namePL,
      actual: round1(current),
      target: round1(target),
      gap: round1(gap),
      maxLevel: d.maxLevel,
      actualPercent: pct(current, d.maxLevel),
      targetPercent: pct(target, d.maxLevel),
      color: d.color || '#3b82f6',
    };
  });
}

function classifyImpactEffort(row: DrdAreaRow): {
  impact: DrdRoadmapItem['impact'];
  effort: DrdRoadmapItem['effort'];
  wave: DrdRoadmapItem['wave'];
} {
  // Impact ~ size of the (normalized) gap: bigger gap = bigger strategic upside.
  const gapPct = row.targetPercent - row.actualPercent;
  const impact: DrdRoadmapItem['impact'] = gapPct >= 30 ? 'high' : gapPct >= 15 ? 'medium' : 'low';

  // Effort ~ how many maturity LEVELS must be climbed (the real delivery work),
  // with a bump when the target sits at the very top of the scale (hardest step).
  const levelsToClimb = row.target - row.actual;
  const targetsTop = row.target >= row.maxLevel;
  let effort: DrdRoadmapItem['effort'];
  if (levelsToClimb >= 3 || (levelsToClimb >= 2 && targetsTop)) effort = 'high';
  else if (levelsToClimb >= 2) effort = 'medium';
  else effort = 'low';

  // Wave sequencing (impact × effort):
  //   F1 = quick wins: high/medium impact AND low effort.
  //   F3 = transformational: high effort (many levels / top-of-scale).
  //   F2 = everything else (structural).
  let wave: DrdRoadmapItem['wave'] = 'F2';
  if (effort === 'high') wave = 'F3';
  else if (effort === 'low' && impact !== 'low') wave = 'F1';
  return { impact, effort, wave };
}

/**
 * Build the complete DRD report model from engine scores + meta.
 * The narrator (default deterministic) produces prose; numbers stay engine-exact.
 */
export async function buildDrdReportModel(
  areaScores: AreaScores,
  meta: DrdReportMeta,
  options: DrdReportOptions = {}
): Promise<DrdReportModel> {
  const language = meta.language;
  const isPL = language === 'pl';
  const narrator = options.narrator ?? deterministicNarrator;
  const grounding = options.grounding;

  /** Fetch book-methodology evidence for an axis (fail-safe: [] on any error). */
  const groundAxis = async (axisId: number, axisName: string): Promise<ConclusionEvidenceRef[]> => {
    if (!grounding) return [];
    try {
      return await grounding(axisId, axisName);
    } catch {
      return [];
    }
  };

  const areas = buildAreaRows(areaScores, language);
  const dimensions = buildDimensions(areaScores, language);
  const overall = calculateOverallScore(areaScores);
  const industryBenchmark = buildDrdIndustryBenchmarkSection(
    dimensions,
    meta.industry ?? DEFAULT_DRD_BENCHMARK_INDUSTRY
  );

  const totalAreas = getTotalAreaCount();
  const assessedAreas = Object.values(areaScores).filter(
    (s) => s && (Number(s.actual) > 0 || Number(s.target) > 0)
  ).length;
  const completionPercent = totalAreas > 0 ? Math.round((assessedAreas / totalAreas) * 100) : 0;

  // Overall percent = mean of dimension actual-percents (normalizes mixed 5/6/7 scales).
  const overallPercent =
    dimensions.length > 0
      ? Math.round(dimensions.reduce((s, d) => s + d.actualPercent, 0) / dimensions.length)
      : 0;
  const targetPercent =
    dimensions.length > 0
      ? Math.round(dimensions.reduce((s, d) => s + d.targetPercent, 0) / dimensions.length)
      : 0;

  const strongest = [...dimensions].sort((a, b) => b.actualPercent - a.actualPercent)[0];
  const weakest = [...dimensions].sort(
    (a, b) => b.targetPercent - b.actualPercent - (a.targetPercent - a.actualPercent)
  )[0];
  const stage = maturityStage(overallPercent, isPL);

  // Executive summary is grounded on the strongest + weakest axis (the two the
  // narrative actually discusses) — avoids 7 RAG calls for a summary that only
  // needs two axes of methodology context.
  const execSummaryGrounding = (
    await Promise.all(
      [strongest, weakest]
        .filter((d): d is DrdDimension => Boolean(d))
        .map((d) => groundAxis(d.axisId, d.name))
    )
  ).flat();

  const executiveSummary = await narrator({
    kind: 'executive_summary',
    language,
    organizationName: meta.organizationName,
    facts: {
      overallPercent,
      targetPercent,
      strongestAxisName: strongest?.name,
      weakestAxisName: weakest?.name,
      maturityStage: stage,
      assessedAreas,
      totalAreas,
    },
    evidence: [
      ...dimensions.map((d) => ({
        type: 'drd_axis',
        ref: String(d.axisId),
        excerpt: `${d.name}: ${d.actual}/${d.maxLevel}`,
      })),
      ...execSummaryGrounding,
    ],
  });

  // Top-3 gap cards: largest normalized gaps.
  const topGapRows = [...areas]
    .filter((r) => r.target > r.actual)
    .sort((a, b) => b.targetPercent - b.actualPercent - (a.targetPercent - a.actualPercent))
    .slice(0, 3);

  const gapCards: DrdGapCard[] = [];
  for (const row of topGapRows) {
    const rowGrounding = await groundAxis(row.axisId, row.axisName);
    const narrative = await narrator({
      kind: 'gap_card',
      language,
      organizationName: meta.organizationName,
      facts: {
        areaName: row.areaName,
        axisName: row.axisName,
        actual: row.actual,
        target: row.target,
        maxLevel: row.maxLevel,
        currentLevelTitle: row.currentLevelTitle,
        targetLevelTitle: row.targetLevelTitle,
      },
      evidence: [
        { type: 'drd_area', ref: row.areaId, excerpt: `${row.actual}→${row.target}` },
        ...rowGrounding,
      ],
    });
    gapCards.push({
      areaId: row.areaId,
      areaName: row.areaName,
      axisName: row.axisName,
      actual: row.actual,
      target: row.target,
      gap: row.gap,
      maxLevel: row.maxLevel,
      narrative,
    });
  }

  // Roadmap: every area with a gap, classified into F1–F3.
  const roadmap: DrdRoadmapItem[] = areas
    .filter((r) => r.target > r.actual)
    .map((r) => {
      const { impact, effort, wave } = classifyImpactEffort(r);
      return {
        areaId: r.areaId,
        areaName: r.areaName,
        axisName: r.axisName,
        gap: r.gap,
        impact,
        effort,
        wave,
      };
    })
    .sort((a, b) => a.wave.localeCompare(b.wave) || b.gap - a.gap);

  // Per-dimension chapters.
  const chapters: DrdChapter[] = [];
  for (const dim of dimensions) {
    const axisAreas = areas.filter((r) => r.axisId === dim.axisId);
    const dimGrounding = await groundAxis(dim.axisId, dim.name);
    const narrative = await narrator({
      kind: 'dimension_chapter',
      language,
      organizationName: meta.organizationName,
      facts: {
        axisName: dim.name,
        actual: dim.actual,
        target: dim.target,
        maxLevel: dim.maxLevel,
      },
      evidence: [
        ...axisAreas.map((r) => ({
          type: 'drd_area',
          ref: r.areaId,
          excerpt: `${r.actual}/${r.maxLevel}`,
        })),
        ...dimGrounding,
      ],
    });
    chapters.push({
      axisId: dim.axisId,
      axisName: dim.name,
      actual: dim.actual,
      target: dim.target,
      maxLevel: dim.maxLevel,
      areas: axisAreas,
      narrative,
    });
  }

  return {
    meta: {
      organizationName: meta.organizationName,
      language,
      reportDate: meta.reportDate ?? new Date().toISOString().slice(0, 10),
      assessmentName: meta.assessmentName,
      benchmark: meta.benchmark ?? null,
    },
    credibility: {
      assessedAreas,
      totalAreas,
      completionPercent,
      confidenceLabel: confidenceLabel(completionPercent, isPL),
    },
    overall: {
      actual: overall.actual,
      target: overall.target,
      gap: overall.gap,
      actualPercent: overallPercent,
      targetPercent,
      maturityStage: stage,
    },
    executiveSummary,
    dimensions,
    areas,
    gapCards,
    roadmap,
    chapters,
    methodology: {
      axes: DRD_STRUCTURE.map((a) => ({
        id: a.id,
        name: a.name,
        namePL: a.namePL,
        areaCount: a.areas.length,
        levelCount: a.levelCount,
      })),
      totalAreas,
    },
    industryBenchmark,
  };
}
