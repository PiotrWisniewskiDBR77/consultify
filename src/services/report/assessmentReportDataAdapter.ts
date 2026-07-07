/**
 * Assessment Report Data Adapter (OXFORD #103/#104)
 *
 * Bridges the report row's stored `axisData` (the flat, prefixed shape produced
 * by the backend's `computeAxisDataFromAssessment`) back into the fully-typed
 * `SIRIAssessmentData` / `ADMAAssessmentData` structures that the SIRI/ADMA
 * report templates (and their WNIOSKOWA conclusion layer) consume.
 *
 * Backend `axisData` conventions (see server/src/routes/assessment-reports.routes.ts):
 *   SIRI: { _framework:'SIRI', block_<ID>:{actual,target}, dim_<ID>:{actual,target}, area_<ID>:{actual,target} }
 *   ADMA: { _framework:'ADMA', pillar_<ID>:{actual,target}, dim_<ID>:{actual,target} }
 *   DRD : { "1":{actual,target}, … }  (handled elsewhere via drdVizAdapter)
 *
 * DETERMINISM: block/pillar/overall aggregation is a plain average over
 * assessed dimensions — the same "gap = target − current" rule the conclusion
 * builders use. No LLM, no invented numbers; a missing dimension is simply 0
 * (treated as "not assessed" downstream), never a crash.
 *
 * FAIL-SOFT: every helper tolerates missing/partial input and returns a
 * well-formed (possibly all-zero) structure so the report view can render an
 * EmptyState rather than throwing.
 */

import { ADMA_DIMENSIONS, ADMA_PILLARS } from '@/services/admaStructure';
import DRD_STRUCTURE from '@/services/drdStructure';
import { SIRI_DIMENSIONS } from '@/services/siriStructure';
import type {
  ADMAAssessmentData,
  ADMAPillarId,
  DRDAssessmentData,
  DRDAxisId,
  DRDAxisScore,
  SIRIAssessmentData,
} from '@/types';

/** SIRI building-block ids (kept local: not re-exported from @/types index). */
type SIRIBuildingBlockId = 'PROCESS' | 'TECHNOLOGY' | 'ORGANIZATION';

/** One flat axis cell as stored on the report row. */
export interface AxisCell {
  actual?: number;
  target?: number;
  justification?: string;
}

export type ReportAxisData = Record<string, AxisCell | number | string | undefined>;

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Reads a `{actual,target}` cell for a prefixed key, tolerant of shape drift. */
const cell = (axisData: ReportAxisData, key: string): { current: number; target: number } => {
  const raw = axisData?.[key];
  if (raw && typeof raw === 'object') {
    const c = raw as AxisCell;
    return { current: num(c.actual), target: num(c.target) };
  }
  // Some legacy area_* cells store a bare number.
  if (typeof raw === 'number') return { current: num(raw), target: 0 };
  return { current: 0, target: 0 };
};

/** Detect the framework a report's axisData belongs to (marker first, then key shape). */
export function detectReportFramework(
  axisData: ReportAxisData | null | undefined,
  assessmentType?: string | null
): 'DRD' | 'SIRI' | 'ADMA' | 'UNKNOWN' {
  const explicit = String(assessmentType || '').toUpperCase();
  if (explicit === 'SIRI' || explicit === 'ADMA' || explicit === 'DRD') return explicit;

  const marker = String((axisData as any)?._framework || '').toUpperCase();
  if (marker === 'SIRI' || marker === 'ADMA' || marker === 'DRD') return marker as any;

  const keys = Object.keys(axisData || {});
  if (keys.some((k) => k.startsWith('pillar_'))) return 'ADMA';
  if (keys.some((k) => k.startsWith('block_') || k.startsWith('area_'))) return 'SIRI';
  // DRD stores numeric axis ids ("1".."7").
  if (keys.some((k) => /^\d$/.test(k))) return 'DRD';
  return 'UNKNOWN';
}

/**
 * Reconstruct `SIRIAssessmentData` from a report's flat axisData.
 * buildingBlock scores are averaged over that block's dimensions (SIRI_DIMENSIONS
 * carries the dimension→block mapping); overallScore averages all assessed dims.
 */
export function buildSIRIAssessmentData(
  axisData: ReportAxisData | null | undefined,
  assessmentDate?: string
): SIRIAssessmentData {
  const data = axisData || {};

  const dimensions: SIRIAssessmentData['dimensions'] = {};
  const blockCurrents: Record<SIRIBuildingBlockId, number[]> = {
    PROCESS: [],
    TECHNOLOGY: [],
    ORGANIZATION: [],
  };
  const blockTargets: Record<SIRIBuildingBlockId, number[]> = {
    PROCESS: [],
    TECHNOLOGY: [],
    ORGANIZATION: [],
  };
  const allCurrents: number[] = [];

  for (const dim of SIRI_DIMENSIONS) {
    const { current, target } = cell(data, `dim_${dim.id}`);
    const gap = round1(Math.max(0, target - current));
    dimensions[dim.id] = { current: round1(current), target: round1(target), gap };
    const block = dim.buildingBlock as SIRIBuildingBlockId;
    if (current > 0 || target > 0) {
      blockCurrents[block].push(current);
      blockTargets[block].push(target);
    }
    if (current > 0) allCurrents.push(current);
  }

  const buildingBlocks = {} as SIRIAssessmentData['buildingBlocks'];
  (['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'] as SIRIBuildingBlockId[]).forEach((block) => {
    // Prefer an explicit block_* cell when present; else average the block's dims.
    const explicit = data[`block_${block}`];
    const score =
      explicit && typeof explicit === 'object'
        ? num((explicit as AxisCell).actual)
        : avg(blockCurrents[block]);
    const target =
      explicit && typeof explicit === 'object'
        ? num((explicit as AxisCell).target)
        : avg(blockTargets[block]);
    buildingBlocks[block] = {
      score: round1(score),
      target: round1(target),
      dimensionScores: {},
    };
  });

  const prioritisationMatrix: Record<string, number> = {};
  for (const [key, val] of Object.entries(data)) {
    if (!key.startsWith('area_')) continue;
    const areaId = key.slice('area_'.length);
    prioritisationMatrix[areaId] =
      val && typeof val === 'object' ? num((val as AxisCell).actual) : num(val);
  }

  return {
    buildingBlocks,
    dimensions,
    prioritisationMatrix,
    overallScore: round1(avg(allCurrents)),
    metadata: {
      assessmentDate: assessmentDate || new Date().toISOString().slice(0, 10),
      version: '2.0',
      source: 'manual',
    },
  };
}

/**
 * Reconstruct `ADMAAssessmentData` from a report's flat axisData.
 * pillar scores are averaged over that pillar's dimensions when no explicit
 * pillar_* cell is present; overallMaturity averages all assessed dimensions.
 */
export function buildADMAAssessmentData(
  axisData: ReportAxisData | null | undefined,
  assessmentDate?: string
): ADMAAssessmentData {
  const data = axisData || {};

  const dimensions: ADMAAssessmentData['dimensions'] = {};
  const pillarCurrents: Record<string, number[]> = {};
  const pillarTargets: Record<string, number[]> = {};
  const allCurrents: number[] = [];

  for (const dim of ADMA_DIMENSIONS) {
    const { current, target } = cell(data, `dim_${dim.id}`);
    const gap = round1(Math.max(0, target - current));
    dimensions[dim.id] = { current: round1(current), target: round1(target), gap };
    (pillarCurrents[dim.pillar] ||= []).push(current);
    (pillarTargets[dim.pillar] ||= []).push(target);
    if (current > 0) allCurrents.push(current);
  }

  const pillars = {} as ADMAAssessmentData['pillars'];
  (Object.keys(ADMA_PILLARS) as ADMAPillarId[]).forEach((pillarId) => {
    const explicit = data[`pillar_${pillarId}`];
    const current =
      explicit && typeof explicit === 'object'
        ? num((explicit as AxisCell).actual)
        : avg((pillarCurrents[pillarId] || []).filter((v) => v > 0));
    const target =
      explicit && typeof explicit === 'object'
        ? num((explicit as AxisCell).target)
        : avg((pillarTargets[pillarId] || []).filter((v) => v > 0));
    pillars[pillarId] = {
      current: round1(current),
      target: round1(target),
      gap: round1(Math.max(0, target - current)),
      dimensionScores: {},
    };
  });

  return {
    pillars,
    dimensions,
    overallMaturity: round1(avg(allCurrents)),
    metadata: {
      assessmentDate: assessmentDate || new Date().toISOString().slice(0, 10),
      version: '2.0',
      source: 'manual',
    },
  };
}

/**
 * Reconstruct `DRDAssessmentData` from a report's flat axisData.
 *
 * DRD backend convention (see server/src/routes/assessment-reports.routes.ts →
 * computeAxisDataFromAssessment): NUMERIC axis keys "1".."7", each a
 * `{actual,target}` cell already averaged over that axis' assessed areas.
 * Per-area raw cells, when present, arrive as `area_<id>` (e.g. `area_1A`).
 *
 * MIXED SCALES: DRD axes have different maxLevel (5, 6 or 7 — from DRD_STRUCTURE).
 * We keep the raw level AND a scale-independent 0–100% projection
 * (normalized = level / levelCount × 100) so the 7-arm radar can plot
 * heterogeneous axes on one grid. overallNormalized averages the normalized
 * currents across ASSESSED axes only (current > 0), matching the DRD report
 * template's normalization rule.
 *
 * FAIL-SOFT: missing axes → all-zero score; never throws.
 */
export function buildDRDAssessmentData(
  axisData: ReportAxisData | null | undefined,
  assessmentDate?: string
): DRDAssessmentData {
  const data = axisData || {};

  const axes = {} as DRDAssessmentData['axes'];
  const normalizedCurrents: number[] = [];
  const normalizedTargets: number[] = [];

  for (const axis of DRD_STRUCTURE) {
    const axisId = axis.id as DRDAxisId;
    const levelCount = axis.levelCount || 5;

    // Backend writes numeric keys; tolerate a stray named key too.
    const { current, target } = cell(data, String(axis.id));

    // Per-area cells (optional) — `area_<id>` shape, tolerant of bare numbers.
    const areas: DRDAxisScore['areas'] = {};
    for (const area of axis.areas) {
      const areaKey = `area_${area.id}`;
      if (data[areaKey] !== undefined) {
        const c = cell(data, areaKey);
        areas[area.id] = { current: round1(c.current), target: round1(c.target) };
      }
    }

    const normalizedCurrent = levelCount > 0 ? Math.round((current / levelCount) * 100) : 0;
    const normalizedTarget = levelCount > 0 ? Math.round((target / levelCount) * 100) : 0;

    axes[axisId] = {
      current: round1(current),
      target: round1(target),
      gap: round1(Math.max(0, target - current)),
      levelCount,
      normalizedCurrent,
      normalizedTarget,
      areas,
    };

    if (current > 0) normalizedCurrents.push(normalizedCurrent);
    if (current > 0 || target > 0) normalizedTargets.push(normalizedTarget);
  }

  return {
    axes,
    overallNormalized: Math.round(avg(normalizedCurrents)),
    targetNormalized: Math.round(avg(normalizedTargets)),
    metadata: {
      assessmentDate: assessmentDate || new Date().toISOString().slice(0, 10),
      version: '1.0',
      source: 'manual',
    },
  };
}

/** True when the reconstructed DRD data carries at least one assessed axis. */
export function drdDataHasContent(data: DRDAssessmentData): boolean {
  return Object.values(data.axes || {}).some((a) => (a?.current ?? 0) > 0 || (a?.target ?? 0) > 0);
}

/** True when the reconstructed data carries at least one assessed dimension. */
export function siriDataHasContent(data: SIRIAssessmentData): boolean {
  return Object.values(data.dimensions || {}).some((d) => (d?.current ?? 0) > 0 || (d?.target ?? 0) > 0);
}

export function admaDataHasContent(data: ADMAAssessmentData): boolean {
  return Object.values(data.dimensions || {}).some((d) => (d?.current ?? 0) > 0 || (d?.target ?? 0) > 0);
}
