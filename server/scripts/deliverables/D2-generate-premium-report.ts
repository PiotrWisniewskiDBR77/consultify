/**
 * D2 head-to-head — generate a REAL premium consulting report (Apator ICT / AI audit)
 * headlessly, straight from the schema builder + renderers. No wave5 DB persistence,
 * so NOTHING is written to trolley (probe leaves zero records on the product's face).
 *
 * Pipeline: buildDocumentSchemaPremium (PREMIUM tier, LLM keys from trolley DB) →
 *           renderDocumentSchemaToDocxBuffer / ...ToPdfBuffer / renderSchemaToMarkdown.
 *
 * ENV required at launch (exported in the invoking command):
 *   DATABASE_URL=<trolley>  ENABLE_DELIVERABLES_PREMIUM=true
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { planDocumentOutline } from '../../src/services/documentStudio/documentNarrativePlanner.js';
import { buildDocumentSchemaPremium } from '../../src/services/documentStudio/documentContentGenerator.js';
import { renderDocumentSchemaToDocxBuffer } from '../../src/services/documentStudio/documentDocxRenderer.js';
import { renderDocumentSchemaToPdfBuffer } from '../../src/services/documentStudio/documentPdfRenderer.js';
import { renderSchemaToMarkdown } from '../../src/services/documentStudio/documentSchemaRenderer.js';
import { createDocumentGenerationWarningCollector } from '../../src/services/documentStudio/documentGenerationWarnings.js';
import type { DocumentIntake, DocumentSourceRef } from '../../src/services/documentStudio/documentStudioTypes.js';

async function main() {
  const OUT_DIR = resolve(
    process.cwd(),
    '..',
    'docs/qa/deliverables/runs/2026-07-05-word-premium-D2'
  );
  const ORG = 'atelier';
  const USER = 'd2-probe-user';

  // Real DBR77 topic: ICT process audit / AI-readiness for Apator (energy-metering manufacturer).
  const intake: DocumentIntake = {
    title: 'Raport z audytu procesów ICT i gotowości AI — Apator SA',
    description:
      'Kompleksowy audyt procesów ICT oraz ocena gotowości do wdrożenia AI w Apator SA — ' +
      'producencie aparatury pomiarowej i systemów dla energetyki. Zakres: architektura ' +
      'systemów (ERP SAP, MES, PLM), przepływy danych produkcyjnych, dojrzałość danych, ' +
      'bezpieczeństwo, oraz identyfikacja 6-8 inicjatyw AI o najwyższym zwrocie (predykcyjne ' +
      'utrzymanie ruchu, kontrola jakości wizyjna, prognozowanie popytu, automatyzacja ofertowania). ' +
      'Odbiorca: Zarząd i Dyrektor IT. Cel: decyzja o priorytetyzacji i budżecie transformacji AI.',
    documentType: 'ai_audit_report',
    language: 'pl',
    audience: ['Zarząd Apator SA', 'Dyrektor IT', 'Komitet Sterujący Transformacji'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'confidential',
  };

  // A few concrete source refs so citations attach and the "sources" section is real.
  const sourceRefs: DocumentSourceRef[] = [
    { sourceType: 'document', sourceId: 'apator-raport-2024', sourceTitle: 'Apator SA — Raport roczny 2024' },
    { sourceType: 'interview', sourceId: 'warsztaty-it-ot-2026', sourceTitle: 'Warsztaty diagnostyczne IT/OT (marzec 2026)' },
    { sourceType: 'dataset', sourceId: 'inwentaryzacja-ict', sourceTitle: 'Inwentaryzacja systemów ICT — SAP/MES/PLM' },
  ];

  console.log('[D2] planning outline…');
  const outline = planDocumentOutline(intake);
  console.log(`[D2] outline: ${outline.documentType} — ${outline.sections.length} sekcji`);

  console.log('[D2] building PREMIUM schema (LLM via trolley DB keys)…');
  const t0 = Date.now();
  const schema = await buildDocumentSchemaPremium(
    { artifactId: `d2-${Date.now()}`, intake, outline, sourceRefs },
    { orgId: ORG, userId: USER, preferPremium: true, premiumEnabled: true }
  );
  schema.title = intake.title!;
  console.log(`[D2] schema built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // --- PLACEHOLDER-vs-REAL diagnostic on the schema itself ---
  const blockTypes = new Map<string, number>();
  let totalBlocks = 0;
  let chartBlocks = 0;
  let tableBlocks = 0;
  let kpiBlocks = 0;
  let proseChars = 0;
  const placeholderSentinels = [
    'awaiting content',
    'awaiting_content',
    'Add sources or use AI generation',
    'Treść sekcji.',
  ];
  let placeholderHits = 0;
  for (const sec of schema.sections) {
    for (const b of sec.blocks) {
      totalBlocks++;
      blockTypes.set(b.type, (blockTypes.get(b.type) ?? 0) + 1);
      if (b.type === 'chart') chartBlocks++;
      if (b.type === 'table') tableBlocks++;
      if (b.type === 'kpi_strip') kpiBlocks++;
      const txt = JSON.stringify(b.content ?? {});
      proseChars += txt.length;
      for (const s of placeholderSentinels) if (txt.includes(s)) placeholderHits++;
    }
  }

  console.log('[D2] schema stats:', {
    sections: schema.sections.length,
    totalBlocks,
    charts: chartBlocks,
    tables: tableBlocks,
    kpi: kpiBlocks,
    contentChars: proseChars,
    placeholderHits,
    blockTypes: Object.fromEntries(blockTypes),
  });

  // --- RENDER (charts rasterize to PNG here) ---
  const docxWarnings = createDocumentGenerationWarningCollector();
  console.log('[D2] rendering DOCX…');
  const docxBuf = await renderDocumentSchemaToDocxBuffer(schema, { warnings: docxWarnings });
  console.log('[D2] rendering PDF…');
  const pdfWarnings = createDocumentGenerationWarningCollector();
  const pdfBuf = await renderDocumentSchemaToPdfBuffer(schema, { warnings: pdfWarnings });
  console.log('[D2] rendering Markdown…');
  const md = renderSchemaToMarkdown(schema);

  const base = 'apator-ict-ai-audit-D2';
  writeFileSync(resolve(OUT_DIR, `${base}.docx`), docxBuf);
  writeFileSync(resolve(OUT_DIR, `${base}.pdf`), pdfBuf);
  writeFileSync(resolve(OUT_DIR, `${base}.md`), md, 'utf8');
  writeFileSync(resolve(OUT_DIR, `${base}.schema.json`), JSON.stringify(schema, null, 2), 'utf8');

  const report = {
    generatedAt: new Date().toISOString(),
    topic: intake.title,
    documentType: schema.documentType,
    sections: schema.sections.length,
    totalBlocks,
    charts: chartBlocks,
    tables: tableBlocks,
    kpiStrips: kpiBlocks,
    contentChars: proseChars,
    placeholderHits,
    docxBytes: docxBuf.length,
    pdfBytes: pdfBuf.length,
    docxWarnings: docxWarnings.list(),
    pdfWarnings: pdfWarnings.list(),
  };
  writeFileSync(resolve(OUT_DIR, `${base}.genreport.json`), JSON.stringify(report, null, 2), 'utf8');
  console.log('[D2] DONE', report);
  // Give any open pg pool a beat, then hard-exit (no records were written to trolley).
  setTimeout(() => process.exit(0), 500);
}

main().catch((err) => {
  console.error('[D2] FAILED', err);
  process.exit(1);
});
