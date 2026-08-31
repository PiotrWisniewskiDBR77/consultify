#!/usr/bin/env npx tsx
/**
 * Uruchamia REALNY łańcuch generowania raportu z oceny DRD:
 *   assessmentReportContractService.build()
 *     -> buildAssessmentDrdReportSchema()
 *       -> renderDocumentSchemaToDocxBuffer()
 * dokładnie tak, jak robi to trasa
 * GET /api/method/sessions/:sessionId/assessment-report.docx
 * (server/src/routes/method-core.routes.ts:552).
 *
 * Nic tu nie jest składane ręcznie — skrypt tylko woła silnik i zapisuje wynik.
 *
 * Uruchomienie (baza lokalna, dane z scripts/seed-demo-drd-metalpol.ts --apply):
 *   NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgresql://... \
 *     npx tsx scripts/dev/generate-assessment-drd-report.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORG = process.env.DRD_ORG_ID ?? 'demo-metalpol-org';
const SESSION = process.env.DRD_SESSION_ID ?? 'demo-metalpol-session';

async function main() {
  const { assessmentReportContractService } = await import(
    '../../server/src/services/assessment/assessmentReportContractService.js'
  );
  const { buildAssessmentDrdReportSchema } = await import(
    '../../server/src/services/assessment/assessmentDrdReportSchemaService.js'
  );
  const { renderDocumentSchemaToDocxBuffer } = await import(
    '../../server/src/services/documentStudio/documentDocxRenderer.js'
  );

  const contract = await assessmentReportContractService.build(ORG, SESSION);
  const schema = buildAssessmentDrdReportSchema(contract);
  const buffer = await renderDocumentSchemaToDocxBuffer(schema);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, '..', '..', 'evidence', 'raport-oceny');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'raport-oceny-drd.docx'), buffer);
  writeFileSync(
    resolve(outDir, 'raport-oceny-drd.contract.json'),
    JSON.stringify(contract, null, 2),
    'utf8'
  );
  writeFileSync(
    resolve(outDir, 'raport-oceny-drd.schema.json'),
    JSON.stringify(schema, null, 2),
    'utf8'
  );

  console.log(`DOCX: ${buffer.length} bajtów`);
  console.log(`rozdziałów: ${contract.chapters.length}`);
  console.log(
    `poziomy per oś: ${contract.chapters.map((c: { maxLevel: number }) => c.maxLevel).join('/')}`
  );
  console.log(`sekcji w schemacie: ${schema.sections.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
