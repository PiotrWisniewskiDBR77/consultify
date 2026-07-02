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

import { buildDrdReportHtml } from './drdReportHtml';
import {
  buildDrdReportModel,
  type AreaScores,
  type DrdReportMeta,
  type DrdReportModel,
  type DrdReportOptions,
} from './drdReportModel';

export interface GenerateDrdReportResult {
  html: string;
  model: DrdReportModel;
}

/** Build the full DRD report (model + HTML) from engine scores and meta. */
export async function generateDrdReport(
  areaScores: AreaScores,
  meta: DrdReportMeta,
  options: DrdReportOptions = {}
): Promise<GenerateDrdReportResult> {
  const model = await buildDrdReportModel(areaScores, meta, options);
  const html = buildDrdReportHtml(model);
  return { html, model };
}

export * from './drdReportModel';
export * from './drdReportSvg';
export * from './drdReportHtml';
export * from './drdConclusionContract';
