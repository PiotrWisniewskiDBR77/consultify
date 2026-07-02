/**
 * Generate the DRD report SAMPLE deliverable.
 *
 * Writes a publishing-grade standalone HTML report to
 *   docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html
 * using deterministic seed scores (numbers-from-engine).
 *
 * NARRATIVE: this sample runs with NO `llm` injected, so the report is authored
 * by the deterministic stub and carries the "narrative: deterministic" flag in
 * the executive summary. In the app, a server caller passes the real narrator:
 *   generateDrdReport(scores, meta, { llm: llmService, llmOptions: { timeoutMs: 120000 } })
 * which produces validated (numbers-from-engine + factRefs) LLM prose and falls
 * back to this same stub on any failure. Wiring is covered by the mocked-llm
 * tests in tests/unit/services/drdLlmNarrator.test.ts.
 *
 * Run:  npx tsx scripts/generate-drd-report-sample.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDrdReport } from '../src/services/report/drdReportGenerator';
import { assertNoCrimson } from '../src/services/report/drdReportSvg';
import { SAMPLE_DRD_META, SAMPLE_DRD_SCORES } from '../src/services/report/drdReportSampleData';

async function main() {
  const { html, model } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META);

  // Enforce the crimson ban on the actual generated artifact.
  assertNoCrimson(html);

  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, '..', 'docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `DRD sample report written: ${out}\n` +
      `  overall: ${model.overall.actualPercent}% → ${model.overall.targetPercent}% (${model.overall.maturityStage})\n` +
      `  areas: ${model.credibility.assessedAreas}/${model.credibility.totalAreas}, dimensions: ${model.dimensions.length}, gapCards: ${model.gapCards.length}, roadmap: ${model.roadmap.length}\n` +
      `  html bytes: ${html.length}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
