/**
 * [ODMROZENIE 04_ASSESSMENT DEC-510] FALA G1 + K3 / kryterium S1.4 —
 * ANGIELSKI RAPORT BEZ POLSKICH OGONKÓW.
 *
 * ★ POMIAR, KTÓRY TEN PLIK PILNUJE. Na żywym raporcie Northwind
 * (`report.docx`, 127 830 B, org EN, 14.09.2026) w `word/document.xml`
 * było **92 polskie diakrytyki w 8 przebiegach tekstu**:
 *   · 7 × 13 znaków = podpis pod matrycą per oś
 *     („Tabela obejmuje 9 obszarów osi 1. …"),
 *     `assessmentNarrativeComposer.ts` → `matrixCaption`;
 *   · 1 znak = okładkowe „340 osób” (`formatEmployeeCount`).
 * Te same „osób” dawały jedyny polski znak w PPTX (1/4015) i PDF (1/4442).
 *
 * K3/W73 domyka jawny dług pozostawiony przez G1: pozostałe sekcje
 * narracyjne korzystają ze słownika i reguł gramatycznych wybranego locale.
 * Dziewięć rodzin bloków niżej przypina zachowanie raportu z findingami.
 *
 * DOWÓD MUTACYJNY: przywrócenie w kompozytorze zaszytego polskiego literału
 * `matrixCaption` (albo `formatHeadcountPL` w miejscu `formatHeadcount`)
 * robi pierwszy test czerwonym.
 */
import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import { describe, expect, it, vi } from 'vitest';

// Language proof does not depend on the repository's binary font assets.
// Standard PDF fonts keep the real renderer path measurable in source-only clones.
vi.mock('../../../utils/pdfFonts.js', () => ({
  PDF_FONT: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
  },
  registerPdfFonts: (doc: { font(name: string): unknown }) => doc.font('Helvetica'),
}));

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import { buildAssessmentDeckModel } from '../assessmentDeckModel.js';
import { renderAssessmentDeckPdf } from '../assessmentDeckPdfRenderer.js';
import { renderAssessmentDeckPptx } from '../assessmentDeckPptxRenderer.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';
import {
  composeReportContract,
  type ReportContractInput,
} from '../assessmentReportContractComposer.js';
import { formatEmployeeCount } from '../assessmentReportContractService.js';

const POLSKIE_DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu;

const AXIS_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Fixture „Northwind-like" = DOKŁADNY kształt oceny, na której padł pomiar 92.
 *
 * ★ ZWERYFIKOWANE NA DOWODZIE, nie założone: w realnym `report.docx`
 * Northwind (`v2/s14nw/report.docx`) sekcja „Executive Summary" drukuje
 * „No content in this section…", a matryca ma same „—". Ocena NIE MA
 * findingów przeniesionych do kontraktu — dlatego cała proza kompozytora
 * zwraca `null`, a jedynym polskim tekstem w dokumencie zostaje podpis pod
 * matrycą (7 × 13 znaków) i okładkowe „340 osób" (1 znak). 92 razem.
 *
 * Wszystkie dane fixture'u są po angielsku (oceniający, etykieta sesji,
 * okres), więc KAŻDY polski ogonek w wyniku pochodzi z generatora, nie
 * z danych.
 *
 * Fixture z findingami żyje niżej i przypina domknięcie długu przez K3/W73.
 */
function wejscieBezLuk(overrides: Partial<ReportContractInput> = {}): ReportContractInput {
  return {
    sessionId: 'assess-g1-nw',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-14T09:00:00.000Z',
    assessmentUpdatedAt: '2026-09-06T10:42:05.393Z',
    methodVersion: 'DRD assessment (recorded)',
    sourceKind: 'legacy',
    language: 'en',
    sessionLabel: {
      displayName: 'Operational Excellence Programme',
      source: 'project',
      projectId: null,
    },
    businessProfile: 'Manufacturing',
    employment: formatEmployeeCount(340, 'en'),
    assessmentPeriod: '7 August 2026',
    assessor: 'James Whitfield',
    clientSponsor: null,
    findings: [],
    limitations: [],
    skipReasons: [],
    assessorNotes: {},
    ...overrides,
  };
}

function kontrakt(overrides: Partial<ReportContractInput> = {}): AssessmentReportContract {
  return composeReportContract(wejscieBezLuk(overrides)) as unknown as AssessmentReportContract;
}

async function tekstDokumentu(contract: AssessmentReportContract, organizationName: string) {
  const zip = await JSZip.loadAsync(
    await renderDocumentSchemaToDocxBuffer(
      buildAssessmentDrdReportSchema(contract, organizationName)
    )
  );
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('word/document.xml missing from rendered DOCX');
  return xml;
}

describe('G1 / S1.4 — DOCX dla organizacji EN nie ma polskich diakrytyk', () => {
  it('fixture Northwind-like (EN): word/document.xml ma 0 polskich diakrytyk', async () => {
    const xml = await tekstDokumentu(kontrakt(), 'Northwind Manufacturing Ltd.');
    const trafienia = xml.match(POLSKIE_DIAKRYTYKI) ?? [];
    // Pomiar sprzed naprawy na tym samym kształcie danych: 92.
    expect(trafienia.join('')).toBe('');
    expect(trafienia).toHaveLength(0);
  });

  it('podpis pod matrycą jest po angielsku i niesie te same liczby co polski', () => {
    const contract = kontrakt();
    const caption = contract.chapters[0].matrix.caption.content!;
    expect(caption).toContain('The table covers');
    expect(caption).toContain('areas of axis 1');
    expect(caption).toContain('recorded assessment');
    expect(caption).toContain('2026-09-14');
    expect(caption).not.toMatch(POLSKIE_DIAKRYTYKI);
    // Okno kontraktu dla tego slotu to 30–60 słów — angielski wariant musi
    // się w nim mieścić, inaczej renderer podmieni go na placeholder.
    const slowa = caption.trim().split(/\s+/u).length;
    expect(slowa).toBeGreaterThanOrEqual(30);
    expect(slowa).toBeLessThanOrEqual(60);
  });

  it('okładka EN: „Employment" = „340 employees", nigdy „340 osób"', async () => {
    expect(formatEmployeeCount(340, 'en')).toBe('340 employees');
    expect(formatEmployeeCount(1, 'en')).toBe('1 employee');
    const xml = await tekstDokumentu(kontrakt(), 'Northwind Manufacturing Ltd.');
    expect(xml).toContain('340 employees');
    expect(xml).not.toContain('340 os');
  });

  it('deck (PPTX/PDF model) EN: kontekst zatrudnienia bez polskiego ogonka', () => {
    const model = buildAssessmentDeckModel(kontrakt(), 'Northwind Manufacturing Ltd.');
    const wszystko = JSON.stringify(model);
    expect(wszystko).toContain('340 employees');
    expect(wszystko).not.toMatch(/340 os/u);
  });
});

describe('G1 / S1.4 — polski raport NIE zmienia się ani o znak', () => {
  it('language: "pl" → podpis pod matrycą jest literalnie tym, co przed naprawą', () => {
    const contract = kontrakt({ language: 'pl' });
    expect(contract.chapters[0].matrix.caption.content).toBe(
      'Tabela obejmuje 9 obszarów osi 1. Kolumny poziomów pokazują skalę od 1 do 7; ' +
        'Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika ' +
        'z wielkości luki. Źródłem są dane zapisanej oceny z dnia 2026-09-14.'
    );
  });

  it('language: "pl" (jądro metodyczne) → źródłem jest „zamrożony Output", jak dotąd', () => {
    const contract = kontrakt({ language: 'pl', sourceKind: 'method-core' });
    expect(contract.chapters[0].matrix.caption.content).toContain('zamrożonego Outputu');
  });

  it('brak `language` w wejściu → zachowanie sprzed naprawy (polski)', () => {
    const contract = kontrakt({ language: undefined });
    expect(contract.chapters[0].matrix.caption.content).toContain('Tabela obejmuje');
  });

  it('odmiana liczebnika PL zostaje nietknięta (1 osoba / 2 osoby / 5 osób / 13 osób)', () => {
    expect(formatEmployeeCount(1, 'pl')).toBe('1 osoba');
    expect(formatEmployeeCount(2, 'pl')).toBe('2 osoby');
    expect(formatEmployeeCount(5, 'pl')).toBe('5 osób');
    expect(formatEmployeeCount(13, 'pl')).toBe('13 osób');
    expect(formatEmployeeCount(340, 'pl')).toBe('340 osób');
    // Domyślny język = 'pl' — wołacz jądra metodycznego nie podaje języka.
    expect(formatEmployeeCount(340)).toBe('340 osób');
  });
});

describe('K3 / W73 — narracja oceny z findingami jest zgodna z językiem raportu', () => {
  const zFindingami = (language: 'pl' | 'en' = 'en'): AssessmentReportContract =>
    kontrakt({
      language,
      findings: AXIS_IDS.map((axisId) => ({
        id: `legacy:assess-g1-nw:${axisId}A`,
        outputId: 'legacy:assess-g1-nw',
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
    });

  const generatedNarrativeBlocks = (contract: AssessmentReportContract): string[] =>
    [
      contract.executiveSummary,
      contract.criticalGaps,
      contract.finalConclusions,
      contract.programDecisionLine.direction,
      contract.programDecisionLine.priority,
      contract.programDecisionLine.successCondition,
      ...contract.chapters.flatMap((chapter) => [
        chapter.introduction.content,
        chapter.conclusion.content,
        chapter.conclusion.decisionLine.direction,
        chapter.conclusion.decisionLine.priority,
        chapter.conclusion.decisionLine.successCondition,
        ...chapter.areaComments.map((area) => area.content),
      ]),
    ].filter((value): value is string => typeof value === 'string');

  it('9 rodzin bloków narracyjnych EN nie zawiera polskich znaków', () => {
    const contract = zFindingami('en');
    const firstChapter = contract.chapters[0];
    const blocks = {
      executiveSummary: contract.executiveSummary,
      criticalGaps: contract.criticalGaps,
      finalConclusions: contract.finalConclusions,
      programDirection: contract.programDecisionLine.direction,
      programPriority: contract.programDecisionLine.priority,
      chapterCaption: firstChapter.matrix.caption.content,
      chapterDirection: firstChapter.conclusion.decisionLine.direction,
      chapterPriority: firstChapter.conclusion.decisionLine.priority,
      areaComment: firstChapter.areaComments[0].content,
    };
    expect(Object.keys(blocks)).toHaveLength(9);
    const contaminated = Object.entries(blocks)
      .filter(
        ([, text]) => typeof text === 'string' && (text.match(POLSKIE_DIAKRYTYKI) ?? []).length > 0
      )
      .map(([name]) => name);
    expect(contaminated).toEqual([]);
    for (const [name, text] of Object.entries(blocks)) {
      expect(text, name).toBeTruthy();
    }
  });

  it('DOCX EN z findingami ma 0 polskich znaków', async () => {
    const xml = await tekstDokumentu(zFindingami('en'), 'Northwind Manufacturing Ltd.');
    expect(xml.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
  });

  it('PPTX i PDF EN z findingami mają 0 polskich znaków w warstwie tekstowej', async () => {
    const model = buildAssessmentDeckModel(zFindingami('en'), 'Northwind Manufacturing Ltd.');
    const pptx = await renderAssessmentDeckPptx(model);
    const zip = await JSZip.loadAsync(pptx);
    const slideNames = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/u.test(name)
    );
    const slideXml = (
      await Promise.all(slideNames.map((name) => zip.file(name)!.async('string')))
    ).join('\n');

    const pdf = await renderAssessmentDeckPdf(model);
    const parser = new PDFParse({ data: pdf });
    const pdfText = String((await parser.getText()).text ?? '');
    await parser.destroy();

    expect(slideXml.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
    expect(pdfText.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
  });

  it('PL jest snapshotem exact base: 26 bloków, PRZED=PO bajtowo', () => {
    const blocks = generatedNarrativeBlocks(zFindingami('pl'));
    expect(blocks).toHaveLength(26);
    expect(createHash('sha256').update(JSON.stringify(blocks)).digest('hex')).toBe(
      'dd2ed604dc34e2ae3b9f2c78646e00506ba2dcfdba90e061a641f918ad762074'
    );
  });
});
