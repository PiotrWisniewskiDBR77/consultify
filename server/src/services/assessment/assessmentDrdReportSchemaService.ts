import DRD_STRUCTURE, { type DRDAxis } from '../../data/drdStructure.js';
import type { DocumentBlock, DocumentSchema } from '../documentStudio/documentStudioTypes.js';
import { DRD_DOCX_STYLE_IDS, DRD_REPORT_PALETTE } from '../documentStudio/documentDocxStyles.js';
import type { AssessmentReportContractService } from './assessmentReportContractService.js';

export type AssessmentReportContract = Awaited<
  ReturnType<AssessmentReportContractService['build']>
>;

export const EVIDENCE_STATE_PL = Object.freeze({
  evidenced: 'udokumentowane',
  incomplete: 'niepełne',
  declared: 'zadeklarowane',
  not_assessed: 'nieocenione',
} as const);

export const DRD_REPORT_FIXED_TEXT = Object.freeze({
  title: 'Raport z oceny dojrzałości cyfrowej',
  clientMissing: '[Nazwa klienta do uzupełnienia]',
  executiveSummary: 'Streszczenie zarządcze',
  criticalGaps: 'Luki krytyczne i rekomendacja główna',
  finalConclusions: 'Wnioski końcowe',
  appendix: 'Załącznik A. Rejestr luk',
  confidentiality: 'Dokument poufny. Przeznaczony wyłącznie dla wskazanego odbiorcy.',
  notAssessed: 'Oś nie została oceniona.',
  decisionLine: 'LINIA DECYZYJNA',
} as const);

// Skalibrowane wzorcem c2a91d0258 (RAPORT_DRD_METALPOL_WZORZEC.docx).
// Pomiar: streszczenie 131 słów prozy, wnioski końcowe 276, komórki linii
// decyzyjnej 12–21. Okna dobrane wokół pomiaru — patrz raport dnia 34 §G.
export const CONTRACT_V1_MISSING_SLOT_LIMITS = Object.freeze({
  executiveSummary: { minWords: 120, maxWords: 150 },
  finalConclusions: { minWords: 250, maxWords: 300 },
  decisionLineField: { minWords: 10, maxWords: 30 },
} as const);

const MICROSTRUCTURE_PL = Object.freeze({
  stan_faktyczny: 'stan faktyczny',
  ocena_i_wiarygodnosc: 'ocena i wiarygodność',
  znaczenie_dla_przedsiebiorstwa: 'znaczenie dla przedsiębiorstwa',
  luka_i_sens_targetu: 'luka i sens poziomu docelowego',
  najblizszy_krok: 'najbliższy krok',
} as const);

type ContractChapter = AssessmentReportContract['chapters'][number];
type ContractArea = ContractChapter['matrix']['areas'][number];

function placeholder(minWords: number, maxWords: number): string {
  return `Sekcja do uzupełnienia — limit ${minWords}–${maxWords} słów.`;
}

function slotText(slot: { content: string | null; minWords: number; maxWords: number }): string {
  return slot.content ?? placeholder(slot.minWords, slot.maxWords);
}

export function priorityForGap(gap: number | null): string {
  if (gap === null) return '—';
  if (gap >= 3) return 'Krytyczny';
  if (gap === 2) return 'Wysoki';
  if (gap === 1) return 'Średni';
  return 'Utrzymanie';
}

export function resolveDrdLevelLabelPL(axisId: number, level: number): string {
  const axis = DRD_STRUCTURE.find((candidate) => candidate.id === axisId) as
    | (DRDAxis & { levelLabelsPL?: string[] })
    | undefined;
  if (!axis) return String(level);
  return (
    axis.levelLabelsPL?.[level - 1] ?? axis.areas[0]?.levels[level - 1]?.title ?? String(level)
  );
}

function paragraph(
  blockId: string,
  text: string,
  docxStyleId: string = DRD_DOCX_STYLE_IDS.BODY,
  pageBreakBefore = false
): DocumentBlock {
  return {
    blockId,
    type: 'paragraph',
    content: { text, docxStyleId, pageBreakBefore },
  };
}

function heading(blockId: string, text: string, level: 1 | 2 | 3): DocumentBlock {
  return { blockId, type: 'heading', content: { text, level } };
}

function table(
  blockId: string,
  headers: string[],
  rows: unknown[][],
  caption?: string
): DocumentBlock {
  return { blockId, type: 'table', content: { headers, rows, caption } };
}

function areaAverage(
  areas: ContractArea[],
  field: 'currentLevel' | 'targetLevel',
  maxLevel: number
): number | null {
  const values = areas
    .filter((area) => !area.skipped && area[field] !== null)
    .map((area) => area[field] as number);
  if (values.length === 0) return null;
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length / maxLevel) * 100
  );
}

function matrixRows(chapter: ContractChapter): unknown[][] {
  return chapter.matrix.areas.map((area) => {
    const cells: unknown[] = [area.unitNamePL ?? area.unitName];
    for (let level = 1; level <= chapter.maxLevel; level += 1) {
      let value = '';
      let fill: string | undefined;
      if (!area.skipped && area.currentLevel !== null && area.targetLevel !== null) {
        if (level < area.currentLevel) fill = DRD_REPORT_PALETTE.fillBelow;
        if (level === area.currentLevel) {
          value = String(level);
          fill = DRD_REPORT_PALETTE.navy;
        }
        if (level > area.currentLevel && level < area.targetLevel)
          fill = DRD_REPORT_PALETTE.fillToGo;
        if (level === area.targetLevel) {
          value = String(level);
          fill = DRD_REPORT_PALETTE.fillTarget;
        }
      }
      cells.push(fill ? { value, style: { bgColor: fill } } : value);
    }
    cells.push(
      area.gap ?? '—',
      area.gap !== null && area.gap >= 3
        ? { value: priorityForGap(area.gap), style: { bgColor: DRD_REPORT_PALETTE.crimson } }
        : priorityForGap(area.gap)
    );
    return cells;
  });
}

function skipNotice(area: ContractArea): string | null {
  if (area.skipped) return `Obszar pominięty w ocenie — kod: ${area.skipCode ?? 'wiele kodów'}.`;
  if (area.skips.length > 0) {
    return `Pominięte pytania: ${area.skips
      .map((skip) => `${skip.questionId} — ${skip.skipCode}`)
      .join('; ')}.`;
  }
  return null;
}

function chapterBlocks(chapter: ContractChapter): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const assessed = chapter.matrix.areas.some(
    (area) => !area.skipped && area.currentLevel !== null && area.targetLevel !== null
  );
  blocks.push(
    paragraph(
      `${chapter.axisId}-intro`,
      assessed
        ? slotText(
            chapter.introduction as { content: string | null; minWords: number; maxWords: number }
          )
        : `${DRD_REPORT_FIXED_TEXT.notAssessed} ${slotText(chapter.introduction as { content: string | null; minWords: number; maxWords: number })}`,
      DRD_DOCX_STYLE_IDS.CAPTION
    ),
    heading(`${chapter.axisId}-matrix-heading`, 'Matryca poziomów dojrzałości', 2),
    table(
      `${chapter.axisId}-matrix`,
      [
        'Obszar',
        ...Array.from({ length: chapter.maxLevel }, (_, index) => String(index + 1)),
        'Luka',
        'Priorytet',
      ],
      matrixRows(chapter),
      slotText(
        chapter.matrix.caption as { content: string | null; minWords: number; maxWords: number }
      )
    ),
    heading(`${chapter.axisId}-areas-heading`, 'Ocena obszarów', 2)
  );

  chapter.matrix.areas.forEach((area) => {
    const comment = chapter.areaComments.find((candidate) => candidate.unitId === area.unitId);
    blocks.push(
      heading(`${area.unitId}-heading`, `${area.unitId}  ${area.unitNamePL ?? area.unitName}`, 3),
      paragraph(
        `${area.unitId}-signature`,
        `Poziom obecny: ${area.currentLevel ?? '—'} (${area.currentLevel ? resolveDrdLevelLabelPL(chapter.axisId, area.currentLevel) : '—'}) · Poziom docelowy: ${area.targetLevel ?? '—'} (${area.targetLevel ? resolveDrdLevelLabelPL(chapter.axisId, area.targetLevel) : '—'}) · Luka: ${area.gap ?? '—'} · Priorytet: ${priorityForGap(area.gap)} · Dowody: ${EVIDENCE_STATE_PL[area.evidenceState]}`,
        DRD_DOCX_STYLE_IDS.SIGNATURE
      )
    );
    const notice = skipNotice(area);
    if (notice) blocks.push(paragraph(`${area.unitId}-skip`, notice, DRD_DOCX_STYLE_IDS.CAPTION));
    if (comment) {
      const commentText = comment.content
        ? comment.content
        : `${placeholder(comment.minWords, comment.maxWords).replace(/\.$/, '')}; wymagane: ${comment.microstructure
            .map((item) => MICROSTRUCTURE_PL[item as keyof typeof MICROSTRUCTURE_PL] ?? item)
            .join(', ')}.`;
      blocks.push(paragraph(`${area.unitId}-comment`, commentText, DRD_DOCX_STYLE_IDS.CAPTION));
    }
  });

  const conclusionPlaceholder = slotText(
    chapter.conclusion as { content: string | null; minWords: number; maxWords: number }
  );
  blocks.push(
    heading(`${chapter.axisId}-conclusion-heading`, 'Wnioski rozdziału', 2),
    paragraph(`${chapter.axisId}-conclusion`, conclusionPlaceholder, DRD_DOCX_STYLE_IDS.CAPTION),
    paragraph(
      `${chapter.axisId}-decision-label`,
      DRD_REPORT_FIXED_TEXT.decisionLine,
      DRD_DOCX_STYLE_IDS.KICKER
    ),
    table(
      `${chapter.axisId}-decision`,
      ['Pole', 'Treść'],
      [
        ['Kierunek', chapter.conclusion.decisionLine.direction ?? conclusionPlaceholder],
        ['Priorytet', chapter.conclusion.decisionLine.priority ?? conclusionPlaceholder],
        ['Horyzont', chapter.conclusion.decisionLine.horizon ?? conclusionPlaceholder],
        [
          'Warunek sukcesu',
          chapter.conclusion.decisionLine.successCondition ?? conclusionPlaceholder,
        ],
      ]
    )
  );
  return blocks;
}

export function buildAssessmentDrdReportSchema(contract: AssessmentReportContract): DocumentSchema {
  const clientName = contract.sessionLabel.displayName ?? DRD_REPORT_FIXED_TEXT.clientMissing;
  const executiveLimit = CONTRACT_V1_MISSING_SLOT_LIMITS.executiveSummary;
  const finalLimit = CONTRACT_V1_MISSING_SLOT_LIMITS.finalConclusions;
  const decisionLineLimit = CONTRACT_V1_MISSING_SLOT_LIMITS.decisionLineField;
  const axisRows = contract.chapters.map((chapter) => {
    const current = areaAverage(chapter.matrix.areas, 'currentLevel', chapter.maxLevel);
    const target = areaAverage(chapter.matrix.areas, 'targetLevel', chapter.maxLevel);
    const critical = chapter.matrix.areas.filter((area) => (area.gap ?? 0) >= 3).length;
    return [
      chapter.axisNamePL ?? chapter.axisName,
      current === null ? '—' : `${current}%`,
      target === null ? '—' : `${target}%`,
      critical,
    ];
  });
  const radar: DocumentBlock = {
    blockId: 'executive-radar',
    type: 'chart',
    content: {
      kind: 'radar',
      title: 'Profil dojrzałości DRD',
      categories: contract.chapters.map((chapter) => {
        const current = areaAverage(chapter.matrix.areas, 'currentLevel', chapter.maxLevel);
        const target = areaAverage(chapter.matrix.areas, 'targetLevel', chapter.maxLevel);
        return current === null || target === null
          ? `${chapter.axisNamePL ?? chapter.axisName} · ${DRD_REPORT_FIXED_TEXT.notAssessed}`
          : `${chapter.axisNamePL ?? chapter.axisName} · ${current}% → ${target}%`;
      }),
      series: [
        {
          label: 'Poziom obecny · stan oceny',
          values: contract.chapters.map((chapter) =>
            areaAverage(chapter.matrix.areas, 'currentLevel', chapter.maxLevel)
          ),
          color: `#${DRD_REPORT_PALETTE.navy}`,
        },
        {
          label: 'Poziom docelowy · horyzont docelowy',
          values: contract.chapters.map((chapter) =>
            areaAverage(chapter.matrix.areas, 'targetLevel', chapter.maxLevel)
          ),
          color: `#${DRD_REPORT_PALETTE.teal}`,
        },
      ],
      caption: 'Profil dojrzałości cyfrowej według siedmiu osi DRD.',
    },
  };

  const sections: DocumentSchema['sections'] = [
    {
      sectionId: 'executive-summary',
      orderIndex: 0,
      level: 1,
      title: DRD_REPORT_FIXED_TEXT.executiveSummary,
      purpose: 'STRESZCZENIE',
      sourceRefs: [],
      blocks: [
        paragraph(
          'executive-placeholder',
          placeholder(executiveLimit.minWords, executiveLimit.maxWords),
          DRD_DOCX_STYLE_IDS.CAPTION
        ),
        radar,
        table(
          'axis-summary',
          ['Oś', 'Obecny', 'Docelowy', 'Luki krytyczne'],
          axisRows,
          'Zestawienie siedmiu osi DRD.'
        ),
        heading('critical-gaps-heading', DRD_REPORT_FIXED_TEXT.criticalGaps, 2),
        paragraph(
          'critical-gaps-placeholder',
          placeholder(executiveLimit.minWords, executiveLimit.maxWords),
          DRD_DOCX_STYLE_IDS.CAPTION
        ),
      ],
    },
    ...contract.chapters.map((chapter, index) => ({
      sectionId: `axis-${chapter.axisId}`,
      orderIndex: index + 1,
      level: 1 as const,
      title: `${chapter.axisId}. ${chapter.axisNamePL ?? chapter.axisName}`,
      purpose: `Rozdział ${index + 1} z 7 · oś ${chapter.axisId} struktury DRD`,
      sourceRefs: [],
      blocks: chapterBlocks(chapter),
    })),
    {
      sectionId: 'final-conclusions',
      orderIndex: 8,
      level: 1,
      title: `8. ${DRD_REPORT_FIXED_TEXT.finalConclusions}`,
      purpose: 'SYNTEZA',
      sourceRefs: [],
      blocks: [
        paragraph(
          'final-placeholder',
          placeholder(finalLimit.minWords, finalLimit.maxWords),
          DRD_DOCX_STYLE_IDS.CAPTION
        ),
        heading('program-decision-heading', 'Linia decyzyjna programu', 2),
        table(
          'program-decision',
          ['Pole', 'Treść'],
          [
            ['Kierunek', placeholder(decisionLineLimit.minWords, decisionLineLimit.maxWords)],
            ['Priorytet', placeholder(decisionLineLimit.minWords, decisionLineLimit.maxWords)],
            ['Horyzont', placeholder(decisionLineLimit.minWords, decisionLineLimit.maxWords)],
            [
              'Warunek sukcesu',
              placeholder(decisionLineLimit.minWords, decisionLineLimit.maxWords),
            ],
          ]
        ),
      ],
    },
    {
      sectionId: 'gap-register',
      orderIndex: 9,
      level: 1,
      title: DRD_REPORT_FIXED_TEXT.appendix,
      purpose: 'ZAŁĄCZNIK',
      kind: 'appendix',
      sourceRefs: [],
      blocks: [
        table(
          'gap-register-table',
          ['Obszar', 'Oś', 'Priorytet', 'Luka', 'Poziom docelowy'],
          contract.chapters
            .flatMap((chapter) =>
              chapter.matrix.areas
                .filter((area) => area.gap !== null)
                .map((area) => ({ chapter, area }))
            )
            .sort(
              (left, right) =>
                (right.area.gap ?? 0) - (left.area.gap ?? 0) ||
                left.chapter.axisId - right.chapter.axisId ||
                (left.area.unitNamePL ?? left.area.unitName).localeCompare(
                  right.area.unitNamePL ?? right.area.unitName,
                  'pl'
                )
            )
            .map(({ chapter, area }) => [
              `${area.unitId} ${area.unitNamePL ?? area.unitName}`,
              chapter.axisNamePL ?? chapter.axisName,
              priorityForGap(area.gap),
              area.gap,
              area.targetLevel === null
                ? '—'
                : `${area.targetLevel} — ${resolveDrdLevelLabelPL(chapter.axisId, area.targetLevel)}`,
            ]),
          'Rejestr luk posortowany malejąco według wielkości luki.'
        ),
      ],
    },
  ];

  return {
    documentId: `assessment-drd-${contract.sessionId}-${contract.outputId ?? 'current'}`,
    artifactId: contract.outputId ?? contract.sessionId,
    title: DRD_REPORT_FIXED_TEXT.title,
    documentType: 'client_final_report',
    language: 'pl',
    audience: [clientName],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'comprehensive',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: {
      fonts: { body: 'Calibri 11', heading: 'Calibri Light' },
      headingStyles: { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3' },
      tableStyles: { default: 'drd-report' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2.2, bottom: 2, left: 2.2, right: 2.2 } },
      headers: { enabled: false },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        content: `Poufne — ${clientName}`,
        pageNumberingFormat: 'Strona {N} z {M}',
      },
      toc: true,
      tocConfig: { enabled: true, maxDepth: 2, nativeField: true },
      coverPage: true,
      coverPageDetailed: { enabled: true, includeStatus: true, includeConfidentiality: true },
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
      colorTemplateId: 'drd-report',
    },
    sections,
    sourceRefs: [],
    createdAt: contract.generatedAt,
    updatedAt: contract.generatedAt,
    drdReportMetadata: {
      clientName,
      businessProfile: null,
      employment: null,
      assessmentPeriod: null,
      assessor: null,
      clientSponsor: null,
      methodology: 'Digital Pathfinder — metodyka oceny dojrzałości cyfrowej DRD',
      sessionSignature: contract.sessionId,
      issuedAt: contract.generatedAt,
    },
  };
}

export const assessmentDrdReportSchemaService = Object.freeze({
  build: buildAssessmentDrdReportSchema,
});
