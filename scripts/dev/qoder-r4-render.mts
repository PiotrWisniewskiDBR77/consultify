/**
 * R4 dowód pliku dla DEC-461 (raport EN nie ma polskich diakrytyków, PL bajtowo
 * nietknięty). Ten skrypt REKONSTRUUJE ten sam kształt fixture'u co blok R1 w
 * `g1.reportLanguage.test.ts` (findingi z gap=3, `limitations` = pełne zdanie z
 * `reportI18n(language).legacyLimitation`) i renderuje pliki dokładnie tym
 * samym silnikiem, którym eksportuje `assessment-reports.routes.ts`. Wynik idzie
 * do `evidence/qoder-narracja-en-20260916/`.
 *
 * Dlaczego tsx a nie vitest: pipeline renderer'ów (pdfkit + pptxgenjs + jszip)
 * segfaultuje w vitest workerach ZASTANE na tym stanowisku (EXIT=139/138),
 * ale w plain node przez tsx działa niezawodnie. Ten sam test-fixture; tylko
 * warstwa uruchomienia inna.
 */
import { writeFileSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

import { renderDocumentSchemaToDocxBuffer } from '../../server/src/services/documentStudio/documentDocxRenderer.js';
import { buildAssessmentDeckModel } from '../../server/src/services/assessment/assessmentDeckModel.js';
import { renderAssessmentDeckPdf } from '../../server/src/services/assessment/assessmentDeckPdfRenderer.js';
import { renderAssessmentDeckPptx } from '../../server/src/services/assessment/assessmentDeckPptxRenderer.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../../server/src/services/assessment/assessmentDrdReportSchemaService.js';
import {
  composeReportContract,
  type ReportContractInput,
} from '../../server/src/services/assessment/assessmentReportContractComposer.js';
import { formatEmployeeCount } from '../../server/src/services/assessment/assessmentReportContractService.js';
import { reportI18n } from '../../server/src/services/assessment/assessmentReportI18n.js';

const POLSKIE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu;
const AXIS_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

// Bajt w bajt to, co baza (przed DEC-461/R1) wstawiała na sztywno w
// `assessmentLegacyReportContractService.ts` i co dziś niesie
// `reportI18n('pl').legacyLimitation` (przypięte testem w g1.reportLanguage.
// test.ts). Dzięki temu render PL „przed" i „po" dostaje IDENTYCZNE wejście.
const LIMITATION_PL_HISTORYCZNY =
  'Wynik pochodzi z oceny prowadzonej w warsztacie DRD (magazyn zastany), nie z ' +
  'zamrożonego Outputu jądra metodycznego — poziomy są zadeklarowane, bez załączonych dowodów.';

// Ścieżka dowodów liczona od lokalizacji SKRYPTU (scripts/dev/ → korzeń repo),
// żeby wynik nie zależał od cwd wywołania.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE_DIR = resolve(REPO_ROOT, 'evidence/qoder-narracja-en-20260916');
mkdirSync(EVIDENCE_DIR, { recursive: true });

function baseInput(language: 'pl' | 'en'): ReportContractInput {
  return {
    sessionId: 'assess-r4-dec461',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-16T09:00:00.000Z',
    assessmentUpdatedAt: '2026-09-06T10:42:05.393Z',
    methodVersion: reportI18n(language).legacyMethodVersionLabel,
    sourceKind: 'legacy',
    language,
    sessionLabel: {
      displayName: 'Operational Excellence Programme',
      source: 'project',
      projectId: null,
    },
    businessProfile: 'Manufacturing',
    employment: formatEmployeeCount(340, language),
    assessmentPeriod: language === 'en' ? '7 August 2026' : '7 sierpnia 2026',
    assessor: 'James Whitfield',
    clientSponsor: null,
    findings: AXIS_IDS.map((axisId) => ({
      id: `legacy:assess-r4-dec461:${axisId}A`,
      outputId: 'legacy:assess-r4-dec461',
      unitId: `${axisId}A`,
      unitName: `Area ${axisId}A`,
      currentLevel: 2,
      targetLevel: 5,
      gap: 3,
      supportingEvidence: [],
      contradictingEvidence: [],
      businessMeaning: '',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: '',
      prerequisite: null,
      expectedOutcome: null,
      kpiProposal: null,
      confidence: 'medium' as const,
      priorityRationale: null,
      sourceLocators: [],
      createdAt: '2026-09-06T06:29:09.104Z',
    })),
    limitations: [
      language === 'pl' ? LIMITATION_PL_HISTORYCZNY : reportI18n(language).legacyLimitation,
    ],
    skipReasons: [],
    assessorNotes: {},
  };
}

function build(language: 'pl' | 'en'): AssessmentReportContract {
  return composeReportContract(baseInput(language)) as unknown as AssessmentReportContract;
}

async function renderAll(language: 'pl' | 'en', outputSuffix = '') {
  const contract = build(language);
  const organizationName = 'Northwind Manufacturing Ltd.';

  const docx = await renderDocumentSchemaToDocxBuffer(
    buildAssessmentDrdReportSchema(contract, organizationName)
  );
  const zip = await JSZip.loadAsync(docx);
  const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const docxDiacritics = (documentXml.match(POLSKIE) ?? []).length;

  const model = buildAssessmentDeckModel(contract, organizationName);
  const pptx = await renderAssessmentDeckPptx(model);
  const pptxZip = await JSZip.loadAsync(pptx);
  const slideNames = Object.keys(pptxZip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/u.test(name)
  );
  const slideXml = (
    await Promise.all(slideNames.map((name) => pptxZip.file(name)!.async('string')))
  ).join('\n');
  const pptxDiacritics = (slideXml.match(POLSKIE) ?? []).length;

  const pdf = await renderAssessmentDeckPdf(model);
  const parser = new PDFParse({ data: pdf });
  const pdfText = String((await parser.getText()).text ?? '');
  await parser.destroy();
  const pdfDiacritics = (pdfText.match(POLSKIE) ?? []).length;

  const docxPath = resolve(EVIDENCE_DIR, `report-${language}${outputSuffix}.docx`);
  const pptxPath = resolve(EVIDENCE_DIR, `deck-${language}${outputSuffix}.pptx`);
  const pdfPath = resolve(EVIDENCE_DIR, `deck-${language}${outputSuffix}.pdf`);
  writeFileSync(docxPath, docx);
  writeFileSync(pptxPath, Buffer.from(pptx));
  writeFileSync(pdfPath, pdf);

  return {
    language,
    docx: {
      path: docxPath,
      bytes: statSync(docxPath).size,
      sha256: createHash('sha256').update(docx).digest('hex'),
      contentSha256: createHash('sha256').update(documentXml).digest('hex'),
      diakrytyki: docxDiacritics,
    },
    pptx: {
      path: pptxPath,
      bytes: statSync(pptxPath).size,
      sha256: createHash('sha256').update(Buffer.from(pptx)).digest('hex'),
      contentSha256: createHash('sha256').update(slideXml).digest('hex'),
      diakrytyki: pptxDiacritics,
    },
    pdf: {
      path: pdfPath,
      bytes: statSync(pdfPath).size,
      sha256: createHash('sha256').update(pdf).digest('hex'),
      diakrytyki: pdfDiacritics,
    },
    finalConclusions: contract.finalConclusions ?? null,
  };
}

const requestedLanguage = process.argv[2];
if (requestedLanguage !== 'pl' && requestedLanguage !== 'en') {
  throw new Error(`Expected one of: pl, en. Received: ${String(requestedLanguage)}`);
}
const outputSuffix = process.argv[3] ?? '';

const result = await renderAll(requestedLanguage, outputSuffix);
const summaryPath = resolve(EVIDENCE_DIR, `summary-${requestedLanguage}${outputSuffix}.json`);
writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        'DEC-461 R4 — jeden proces na jeden język, fixture identyczny z g1.reportLanguage.test.ts',
      result,
    },
    null,
    2
  )
);

console.log(JSON.stringify(result, null, 2));
