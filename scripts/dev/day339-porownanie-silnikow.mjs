#!/usr/bin/env npx tsx

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

const repo = resolve(import.meta.dirname, '..', '..');

const option = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const artifacts = resolve(
  option('artifacts-dir') || '/private/tmp/cx-day339-silnik-raportu-wybor-artefakty'
);
const evidence = resolve(
  option('evidence-dir') || resolve(repo, 'evidence', 'silniki-raportu-oceny-20260904')
);
const sessionArtifact = resolve(option('session-artifact') || resolve(artifacts, 'day339-session.json'));
const demoLayoutSessionId = option('demo-label-session');

export const buildDemoLayoutLabel = (sessionId) =>
  `DEMO UKŁADU — treść prototypowa, liczby z sesji ${sessionId}`;

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function writeMeasured(name, data, startedAt) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const artifactPath = resolve(artifacts, name);
  const evidencePath = resolve(evidence, name);
  await writeFile(artifactPath, buffer);
  await writeFile(evidencePath, buffer);
  return {
    name,
    artifactPath,
    evidencePath,
    bytes: buffer.length,
    sha256: sha256(buffer),
    generationMs: Math.round((performance.now() - startedAt) * 100) / 100,
  };
}

function convertToPdf(docxPath) {
  const result = spawnSync(
    'soffice',
    ['--headless', '--convert-to', 'pdf', '--outdir', artifacts, docxPath],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`soffice failed for ${basename(docxPath)}: ${result.stderr || result.stdout}`);
  }
  return resolve(artifacts, basename(docxPath, extname(docxPath)) + '.pdf');
}

function pageCount(pdfPath) {
  const result = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`pdfinfo failed for ${pdfPath}: ${result.stderr}`);
  const match = /^Pages:\s+(\d+)$/m.exec(result.stdout);
  if (!match) throw new Error(`pdfinfo returned no Pages field for ${pdfPath}`);
  return Number(match[1]);
}

async function main() {
  await mkdir(artifacts, { recursive: true });
  await mkdir(evidence, { recursive: true });
  const session = JSON.parse(await readFile(sessionArtifact, 'utf8'));
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const { rows: eventRows } = await pg.query(
    `SELECT unit_id,type,level,payload_json FROM method_events
      WHERE session_id=$1 AND organization_id=$2 ORDER BY occurred_at,id`,
    [session.sessionId, session.organizationId]
  );
  const { rows: sessionRows } = await pg.query(
    `SELECT id,organization_id,method_pack_id,method_pack_version,state,version
       FROM method_sessions WHERE id=$1 AND organization_id=$2`,
    [session.sessionId, session.organizationId]
  );
  await pg.end();
  if (sessionRows.length !== 1) throw new Error('R2 session missing from PostgreSQL');

  const DRD_STRUCTURE = (await import('../../server/src/data/drdStructure.js')).default;
  const answerLevel = new Map(
    eventRows
      .filter((row) => row.type === 'ANSWER_CONFIRMED')
      .map((row) => [row.unit_id, Number(row.level)])
  );
  const areaScores = {};
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      const actual = answerLevel.get(area.id) ?? 0;
      areaScores[area.id] = { actual, target: Math.min(axis.levelCount, actual + 2) };
    }
  }

  const manifest = {
    measuredAt: new Date().toISOString(),
    session,
    input: {
      postgresSession: sessionRows[0],
      eventCount: eventRows.length,
      answerCount: eventRows.filter((row) => row.type === 'ANSWER_CONFIRMED').length,
      evidenceEventCount: eventRows.filter((row) => row.type === 'EVIDENCE_ATTACHED').length,
      areaScores,
    },
    engines: [],
    boundary:
      'The HTML route stores assessment_reports and has no method_session_id input. The existing buildDrdReportHtmlServer engine is therefore invoked directly with area scores derived from this same MethodSession; no production caller or route is added.',
  };

  const docxStarted = performance.now();
  const { assessmentReportContractService } =
    await import('../../server/src/services/assessment/assessmentReportContractService.js');
  const { buildAssessmentDrdReportSchema } =
    await import('../../server/src/services/assessment/assessmentDrdReportSchemaService.js');
  const { renderDocumentSchemaToDocxBuffer } =
    await import('../../server/src/services/documentStudio/documentDocxRenderer.js');
  const contract = await assessmentReportContractService.build(
    session.organizationId,
    session.sessionId
  );
  const contractJson = await writeMeasured(
    '01-kontrakt-method-session.json',
    `${JSON.stringify(contract, null, 2)}\n`,
    docxStarted
  );
  const docxBuffer = await renderDocumentSchemaToDocxBuffer(
    buildAssessmentDrdReportSchema(contract)
  );
  const docx = await writeMeasured('01-silnik-method-session.docx', docxBuffer, docxStarted);
  const docxPdfPath = convertToPdf(docx.artifactPath);
  const docxPdfBuffer = await readFile(docxPdfPath);
  const docxPdf = await writeMeasured('01-silnik-method-session.pdf', docxPdfBuffer, docxStarted);
  docxPdf.pages = pageCount(docxPdf.artifactPath);
  manifest.engines.push({
    engine: 'assessmentReportContractService -> buildAssessmentDrdReportSchema -> DOCX',
    narrative: 'deterministic',
    files: [contractJson, docx, docxPdf],
  });

  const htmlStarted = performance.now();
  const { buildDrdReportHtmlServer } =
    await import('../../server/src/services/report/drdReportService.js');
  const htmlResult = await buildDrdReportHtmlServer({
    axisData: {},
    areaScores,
    meta: {
      organizationName: 'Fabryka Pomiarowa 339',
      assessmentName: `Sesja ${session.sessionId}`,
      generatedAt: new Date().toISOString(),
      language: 'pl',
    },
  });
  const html = await writeMeasured('02-silnik-html.html', htmlResult.html, htmlStarted);
  const htmlModel = await writeMeasured(
    '02-silnik-html-model.json',
    `${JSON.stringify(htmlResult.model, null, 2)}\n`,
    htmlStarted
  );
  const htmlPdfPath = convertToPdf(html.artifactPath);
  const htmlPdf = await writeMeasured(
    '02-silnik-html.pdf',
    await readFile(htmlPdfPath),
    htmlStarted
  );
  htmlPdf.pages = pageCount(htmlPdf.artifactPath);
  manifest.engines.push({
    engine: 'buildDrdReportHtmlServer -> generateDrdReport',
    narrative: htmlResult.narrative,
    files: [html, htmlModel, htmlPdf],
  });

  const acceptedStarted = performance.now();
  const prototype = await import('../prototypes/raport-oceny-tresc.mjs');
  const { buildAcceptedDrdReportModel } =
    await import('../../server/src/services/report/acceptedDrdReportModel.js');
  const accepted = buildAcceptedDrdReportModel({
    META: prototype.META,
    WYNIK_OGOLNY: prototype.WYNIK_OGOLNY,
    OSIE: prototype.OSIE,
    WNIOSKI_PRZEKROJOWE: prototype.WNIOSKI_PRZEKROJOWE,
    MAPA_DROGOWA: prototype.MAPA_DROGOWA,
    KOLEJNY_KROK: prototype.KOLEJNY_KROK,
    GRANICE: prototype.GRANICE,
    session: {
      id: sessionRows[0].id,
      organizationId: sessionRows[0].organization_id,
      methodPackId: sessionRows[0].method_pack_id,
      methodPackVersion: sessionRows[0].method_pack_version,
      state: sessionRows[0].state,
      version: sessionRows[0].version,
    },
    areaScores,
  });
  if (demoLayoutSessionId) {
    accepted.META.tytul = buildDemoLayoutLabel(demoLayoutSessionId);
    accepted.META.metodyka = `Raport z Oceny Dojrzałości Cyfrowej · ${accepted.META.metodyka}`;
  }
  const acceptedJson = await writeMeasured(
    '03-silnik-298-model.json',
    `${JSON.stringify(accepted, null, 2)}\n`,
    acceptedStarted
  );
  const acceptedModule = resolve(artifacts, '03-silnik-298-model.mjs');
  await writeFile(acceptedModule, `export default ${JSON.stringify(accepted)};\n`, 'utf8');
  const acceptedDocxPath = resolve(artifacts, '03-silnik-298.docx');
  const built = spawnSync(
    process.execPath,
    [
      resolve(repo, 'scripts/prototypes/build-raport-oceny-prototyp.mjs'),
      acceptedDocxPath,
      acceptedModule,
    ],
    { encoding: 'utf8' }
  );
  if (built.status !== 0) {
    throw new Error(`accepted prototype renderer failed: ${built.stderr || built.stdout}`);
  }
  const acceptedDocx = await writeMeasured(
    '03-silnik-298.docx',
    await readFile(acceptedDocxPath),
    acceptedStarted
  );
  const acceptedPdfPath = convertToPdf(acceptedDocx.artifactPath);
  const acceptedPdf = await writeMeasured(
    '03-silnik-298.pdf',
    await readFile(acceptedPdfPath),
    acceptedStarted
  );
  acceptedPdf.pages = pageCount(acceptedPdf.artifactPath);
  manifest.engines.push({
    engine: 'buildAcceptedDrdReportModel -> accepted prototype DOCX renderer',
    narrative: 'accepted static content with numeric scores recalculated from the R2 session',
    files: [acceptedJson, acceptedDocx, acceptedPdf],
  });

  await writeFile(
    resolve(artifacts, 'day339-engine-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    resolve(evidence, 'day339-engine-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  process.exit(0);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
