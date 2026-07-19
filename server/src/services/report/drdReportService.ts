/**
 * DRD Report — server-side orchestration.
 *
 * Server entrypoint for the publishing-grade DRD client report. Mirrors the FE
 * client helper (`src/services/report/drdReportClient.ts`) but runs on the server
 * so the LLM narrator can be wired to the real `llmService` (the browser bundle
 * must never import server-only AI code).
 *
 * The generator core (model / html / svg / narrator) is a server-local copy of the
 * DOM-free FE modules in `src/services/report/*`. It is duplicated intentionally:
 * the production server runs `node dist/src/index.js`, whose `dist/` contains only
 * `server/src/**` — a cross-tree import of the FE `.ts` sources would resolve in
 * dev (tsx) but be absent in the compiled prod bundle. Keep the two copies in sync
 * (see the sibling files in this directory and the FE originals).
 */

import DRD_STRUCTURE, { DRD_KEY_TO_AXIS_MAP } from '../../data/drdStructure.js';
import logger from '../../utils/Logger.js';
import type { LlmLike } from './drdLlmNarrator.js';
import { generateDrdReport } from './drdReportGenerator.js';
import type { DrdGroundingProvider } from './drdReportGrounding.js';
import type { AreaScores, DrdReportMeta, DrdReportModel } from './drdReportModel.js';

/**
 * CONTRACT (finding O1 W7 — client-report absurdity guard): `axis_data` on
 * `assessment_reports` stores DRD MATURITY LEVELS (0..axis.levelCount, i.e.
 * 0..5 or 0..7 depending on the axis), NEVER 0-100 percentages. A stray
 * percentage here (e.g. from a bad seed/fixture/import) would blow past
 * `axis.levelCount` and — once divided into a percent downstream — render as
 * nonsense like "Cybersecurity 600%" in a client-facing report. Clamp at the
 * DB→engine-scores boundary so corrupt values can never propagate, and log
 * loudly (this should never legitimately happen) so the bad write gets fixed
 * at the source.
 */
function clampAxisLevel(
  raw: number,
  max: number,
  axisLabel: string,
  field: 'actual' | 'target'
): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0 || raw > max) {
    logger.error(
      `[AxisDataGuard] axis_data out of range — clamped ${field}=${raw} to [0,${max}] for axis "${axisLabel}". ` +
        `axis_data must hold DRD levels (0..maxLevel), never 0-100 percentages. Check the write path (seed/import/generator).`
    );
    return Math.max(0, Math.min(max, raw));
  }
  return raw;
}

/**
 * Derive area-level scores from per-AXIS aggregates (the report editor's
 * `axisData`, keyed by internal axis key, numeric axis id, or axis name). Each
 * area in an axis inherits that axis's actual/target so the report is fully
 * renderable from axis-level data. Server port of `areaScoresFromAxisData`.
 *
 * DEFENSE-IN-DEPTH (finding O1 W7): clamps actual/target into [0, axis.levelCount]
 * — this is the single choke point between stored `axis_data` (any source: live
 * generation, demo seed, future import) and the report engine, so bad data
 * already sitting in the DB can never produce an impossible (>100%) report.
 */
export function areaScoresFromAxisData(
  axisData: Record<string, { actual?: number; target?: number }>
): AreaScores {
  const scores: AreaScores = {};
  for (const axis of DRD_STRUCTURE) {
    const byKey = Object.entries(DRD_KEY_TO_AXIS_MAP).find(([, id]) => id === axis.id)?.[0];
    const entry =
      (byKey && axisData[byKey]) || axisData[String(axis.id)] || axisData[axis.name] || {};
    const actual = clampAxisLevel(Number(entry.actual ?? 0), axis.levelCount, axis.name, 'actual');
    const target = clampAxisLevel(Number(entry.target ?? 0), axis.levelCount, axis.name, 'target');
    for (const area of axis.areas) {
      scores[area.id] = { actual, target };
    }
  }
  return scores;
}

export interface BuildDrdReportServerParams {
  /** Per-axis aggregates as stored on the assessment report (`axis_data`). */
  axisData: Record<string, { actual?: number; target?: number }>;
  meta: DrdReportMeta;
  /**
   * Injected LLM client (`llmService`). When present, the executive summary and
   * chapter/gap narratives are authored by the fail-safe LLM narrator; when
   * omitted (or the LLM fails validation twice / errors), the deterministic stub
   * is used — the report is always produced.
   */
  llm?: LlmLike;
  /** Optional per-area scores; overrides the axis-derived ones when supplied. */
  areaScores?: AreaScores;
  logger?: { warn?: (msg: string, meta?: unknown) => void };
  /**
   * Optional per-axis RAG grounding (book "Digital Pathfinder" methodology KB) —
   * see `drdReportGrounding.ts` / `buildDrdGroundingProvider`. Omitted → report
   * still generates, just without KB citations (fail-open by design).
   */
  grounding?: DrdGroundingProvider;
}

/**
 * Build the standalone DRD report HTML on the server, with the real LLM narrator
 * wired in when an `llm` client is provided. Never throws on LLM failure — the
 * narrator falls back to the deterministic stub.
 */
export async function buildDrdReportHtmlServer(
  params: BuildDrdReportServerParams
): Promise<{ html: string; narrative: 'llm' | 'deterministic'; model: DrdReportModel }> {
  const areaScores = params.areaScores ?? areaScoresFromAxisData(params.axisData || {});
  const { html, model } = await generateDrdReport(areaScores, params.meta, {
    llm: params.llm,
    llmOptions: params.logger ? { logger: params.logger } : undefined,
    grounding: params.grounding,
  });
  return { html, narrative: model.executiveSummary.narrative, model };
}
