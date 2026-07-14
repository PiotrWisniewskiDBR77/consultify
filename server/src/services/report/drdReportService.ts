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
import type { LlmLike } from './drdLlmNarrator.js';
import { generateDrdReport } from './drdReportGenerator.js';
import type { DrdGroundingProvider } from './drdReportGrounding.js';
import type { AreaScores, DrdReportMeta, DrdReportModel } from './drdReportModel.js';

/**
 * Derive area-level scores from per-AXIS aggregates (the report editor's
 * `axisData`, keyed by internal axis key, numeric axis id, or axis name). Each
 * area in an axis inherits that axis's actual/target so the report is fully
 * renderable from axis-level data. Server port of `areaScoresFromAxisData`.
 */
export function areaScoresFromAxisData(
  axisData: Record<string, { actual?: number; target?: number }>
): AreaScores {
  const scores: AreaScores = {};
  for (const axis of DRD_STRUCTURE) {
    const byKey = Object.entries(DRD_KEY_TO_AXIS_MAP).find(([, id]) => id === axis.id)?.[0];
    const entry =
      (byKey && axisData[byKey]) || axisData[String(axis.id)] || axisData[axis.name] || {};
    const actual = Number(entry.actual ?? 0);
    const target = Number(entry.target ?? 0);
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
