import type { ReportBlock, ToolReportDocument } from '../../sharedRuntime/toolOutputs/types.js';
import type {
  DocumentBlock,
  DocumentSchema,
  DocumentSourceRef,
} from '../documentStudio/documentStudioTypes.js';

export type ToolReportCompleteness = 'full' | 'partial' | 'empty';

export interface ToolOutputReportSchemaInput {
  document: ToolReportDocument;
  createdAt: string;
  updatedAt: string;
}

const placeholder = (minWords: number, maxWords: number): string =>
  `Sekcja do uzupełnienia — limit ${minWords}–${maxWords} słów.`;

const paragraph = (blockId: string, text: string): DocumentBlock => ({
  blockId,
  type: 'paragraph',
  content: { text },
});

function mapBlock(block: ReportBlock, blockId: string): DocumentBlock {
  switch (block.kind) {
    case 'action-title':
      return { blockId, type: 'heading', content: { text: block.text, level: 2 } };
    case 'paragraph':
      return paragraph(blockId, block.text);
    case 'evidence-list':
      return {
        blockId,
        type: 'bullet_list',
        content: { items: block.items.map((item) => `${item.label} (${item.evidenceKind})`) },
      };
    case 'tension-list':
      return {
        blockId,
        type: 'bullet_list',
        content: {
          items: block.items.map(
            (item) => `${item.title} — postawa: ${item.posture}, priorytet: ${item.priority}`
          ),
        },
      };
    case 'conclusion':
      return {
        blockId,
        type: 'callout',
        content: {
          tone: 'info',
          text: [
            `Fakt: ${block.k1Fact}`,
            `Znaczenie: ${block.k2Meaning}`,
            `Działania: ${block.k3Actions.join('; ')}`,
            `Efekt: ${block.k4Effect}`,
            `Wybór: ${block.tradeoff.chosen}; odrzucono: ${block.tradeoff.rejected}; dlaczego: ${block.tradeoff.why}`,
          ].join('\n'),
        },
      };
    case 'signature-visual':
      return paragraph(
        blockId,
        `Wizualizacja sygnaturowa archetypu ${block.archetype} — nie ma reprezentacji w eksporcie tekstowym.`
      );
  }
}

export function getToolReportCompleteness(document: ToolReportDocument): ToolReportCompleteness {
  const substantive = document.sections
    .flatMap((section) => section.blocks)
    .filter((block) => block.kind !== 'signature-visual' && block.kind !== 'action-title').length;
  if (substantive === 0) return 'empty';
  return document.sections.some((section) => section.blocks.length <= 1) ? 'partial' : 'full';
}

export function buildToolOutputReportSchema(input: ToolOutputReportSchemaInput): DocumentSchema {
  const { document } = input;
  if (document.sourceOutputIds.length === 0) {
    throw new Error('Tool report schema requires at least one source Output.');
  }
  const sourceRefs: DocumentSourceRef[] = document.sourceOutputIds.map((sourceId) => ({
    sourceType: 'tool_output',
    sourceId,
    sourceVersion: document.rendererVersion,
  }));

  return {
    documentId: document.id,
    artifactId: document.sourceOutputIds[0],
    title: document.title,
    documentType: 'client_final_report',
    language: 'pl',
    audience: ['Odbiorca raportu narzędzia'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: {
      fonts: { body: 'Calibri 11', heading: 'Calibri Light' },
      headingStyles: { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3' },
      tableStyles: { default: 'consulting' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2.2, bottom: 2, left: 2.2, right: 2.2 } },
      headers: { enabled: false },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        content: 'Poufne — wynik narzędzia',
        pageNumberingFormat: 'Strona {N} z {M}',
      },
      toc: true,
      coverPage: true,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: document.sections.map((section, sectionIndex) => ({
      sectionId: section.id,
      orderIndex: sectionIndex,
      level: 1,
      title: section.actionTitle,
      purpose: 'WYNIK NARZĘDZIA',
      sourceRefs: sourceRefs.filter((ref) => ref.sourceId === section.sourceOutputId),
      blocks:
        section.blocks.length > 0
          ? section.blocks.map((block, blockIndex) =>
              mapBlock(block, `${section.id}-block-${blockIndex + 1}`)
            )
          : [paragraph(`${section.id}-placeholder`, placeholder(80, 120))],
    })),
    sourceRefs,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
