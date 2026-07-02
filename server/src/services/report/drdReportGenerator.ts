/**
 * DRD Report — top-level generator.
 *
 * One call: engine scores + org meta → publishing-grade standalone HTML string.
 * Usable client-side (open in a window and print to PDF) and server-side (export).
 *
 * See:
 *   - drdReportModel.ts   — deterministic, engine-grounded data model
 *   - drdReportSvg.ts     — inline SVG radar / matrix / bars (blue/teal, no crimson)
 *   - drdReportHtml.ts    — print-CSS A4 HTML document
 *   - drdConclusionContract.ts — narrative layer (deterministic stub; LLM = TODO)
 */

import { buildDrdReportHtml } from './drdReportHtml.js';
import {
  makeLlmNarrator,
  type DrdLlmNarratorOptions,
  type LlmLike,
} from './drdLlmNarrator.js';
import {
  buildDrdReportModel,
  type AreaScores,
  type DrdReportMeta,
  type DrdReportModel,
  type DrdReportOptions,
} from './drdReportModel.js';

export interface GenerateDrdReportResult {
  html: string;
  model: DrdReportModel;
}

export interface GenerateDrdReportOptions extends DrdReportOptions {
  /**
   * Optional LLM client. When supplied (server-side), the report narrative is
   * authored by a validated, fail-safe LLM narrator (numbers-from-engine +
   * factRefs, retry-once-then-stub). When omitted, the deterministic stub is
   * used. Explicit `narrator` in DrdReportOptions still wins over this.
   */
  llm?: LlmLike;
  /** Extra LLM narrator tuning (model tier, timeout, temperature, logger). */
  llmOptions?: Omit<DrdLlmNarratorOptions, 'llm'>;
}

/** Build the full DRD report (model + HTML) from engine scores and meta. */
export async function generateDrdReport(
  areaScores: AreaScores,
  meta: DrdReportMeta,
  options: GenerateDrdReportOptions = {}
): Promise<GenerateDrdReportResult> {
  // Prefer an explicit narrator; otherwise build the LLM narrator when an llm
  // client is provided; otherwise fall back to the deterministic stub (default
  // inside buildDrdReportModel). LLM failures never break generation — the
  // narrator itself is fail-safe.
  const narrator =
    options.narrator ??
    (options.llm ? makeLlmNarrator({ llm: options.llm, ...(options.llmOptions || {}) }) : undefined);

  const model = await buildDrdReportModel(areaScores, meta, { narrator });
  const html = buildDrdReportHtml(model);
  return { html, model };
}

export * from './drdReportModel.js';
export * from './drdReportSvg.js';
export * from './drdReportHtml.js';
export * from './drdConclusionContract.js';
export * from './drdLlmNarrator.js';
