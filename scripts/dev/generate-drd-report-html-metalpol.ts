/**
 * Generator 2 (HTML) uruchomiony na TYCH SAMYCH danych, co generator 1 (DOCX):
 * zestaw Metalpol (`scripts/demo-seed/metalpolDrdDataset.ts`, 23 ocenione obszary
 * z 39, 7 osi).
 *
 * Cel: uczciwe porównanie treści trzech generatorów raportu z oceny DRD.
 * Wejściem generatora 2 jest WYŁĄCZNIE `AreaScores` (Record<areaId,{actual,target}>)
 * — ten generator nie czyta bazy i nie widzi narracji z seeda. To samo w sobie
 * jest wynikiem pomiaru.
 *
 * Wariant A (domyślny): bez LLM → narrator deterministyczny (stub w kodzie).
 * Wariant B (--llm): wymaga klucza API; bez klucza kończy się jawnym błędem,
 * nie po cichu.
 *
 * Run: npx tsx scripts/dev/generate-drd-report-html-metalpol.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { METALPOL_CLIENT, METALPOL_DRD_AREAS } from '../demo-seed/metalpolDrdDataset';
import { generateDrdReport } from '../../src/services/report/drdReportGenerator';
import type { AreaScores } from '../../src/services/report/drdReportModel';

const useLlm = process.argv.includes('--llm');

function buildAreaScores(): AreaScores {
  const scores: AreaScores = {};
  for (const area of METALPOL_DRD_AREAS) {
    scores[area.unitId] = { actual: area.currentLevel, target: area.targetLevel };
  }
  return scores;
}

async function main() {
  const areaScores = buildAreaScores();

  let llm: unknown;
  if (useLlm) {
    const mod = await import('../../server/src/services/ai/llmService.js');
    llm = (mod as any).llmService || (mod as any).default;
    if (!llm) throw new Error('llmService niedostępny — wariant LLM nie może ruszyć');
  }

  const { html, model } = await generateDrdReport(
    areaScores,
    {
      organizationName: METALPOL_CLIENT.name,
      language: 'pl',
      assessmentName: `Ocena dojrzałości cyfrowej DRD · ${METALPOL_CLIENT.sessionRef}`,
      reportDate: METALPOL_CLIENT.issued,
    },
    useLlm ? ({ llm } as any) : {}
  );

  const here = dirname(fileURLToPath(import.meta.url));
  const suffix = useLlm ? 'llm' : 'deterministyczny';
  const out = resolve(here, '..', '..', `evidence/raport-oceny/raport-oceny-2-html-${suffix}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, 'utf8');

  const narrativeFlags = new Set<string>();
  narrativeFlags.add(String((model.executiveSummary as any)?.narrative ?? '?'));
  for (const card of model.gapCards) narrativeFlags.add(String((card.narrative as any)?.narrative ?? '?'));

  // eslint-disable-next-line no-console
  console.log(
    `Raport HTML (generator 2, ${suffix}): ${out}\n` +
      `  wejście: ${Object.keys(areaScores).length} obszarów z zestawu Metalpol\n` +
      `  overall: ${model.overall.actualPercent}% → ${model.overall.targetPercent}% (${model.overall.maturityStage})\n` +
      `  pokrycie (credibility): ${model.credibility.assessedAreas}/${model.credibility.totalAreas}\n` +
      `  osie: ${model.dimensions.length}, karty luk: ${model.gapCards.length}, roadmapa: ${model.roadmap.length}\n` +
      `  flaga narracji: ${[...narrativeFlags].join(', ')}\n` +
      `  bajtów HTML: ${html.length}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
