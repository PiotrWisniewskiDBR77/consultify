/**
 * Consultify Document Studio — DOCX renderer (MVP-1 finalization).
 *
 * Pure schema-aware renderer: consumes a `DocumentSchema` and produces a real
 * editable .docx buffer using the `docx` package. Honors the document's
 * `FormattingSchema` (page size, margins, headers, footers, page numbering,
 * confidentiality label) so the output looks like a consulting deliverable
 * rather than markdown pasted into Word.
 *
 * Scope (per CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md, MVP-1
 * finalization slice):
 *   - cover-style title block, document metadata strip
 *   - sections with H1/H2/H3 numbered headings, paragraphs, lists, callouts,
 *     quotes, basic tables
 *   - assumption highlighting (italic + amber-coded marker)
 *   - sources appendix (or "no sources attached" notice)
 *   - confidentiality footer + page numbering
 *
 * Out of scope for MVP-1 finalization (deferred to MVP-4 advanced DOCX export):
 *   - automatic Word TOC field instructions, track changes, comments
 *   - custom heading numbering schemes beyond "1.", "1.1", "1.1.1"
 *   - chart embedding, image embedding, custom theme colors
 */

// `docx@9.5.1` ships a single bundled `.d.ts` whose classes (Table, TableCell,
// TableRow) and the `WidthType` const are not picked up cleanly under our
// `module: "NodeNext"` server tsconfig (the runtime exports work; this is a
// known type-resolution quirk also worked around in
// `routes/report-builder.routes.ts`). We use the same namespace + cast pattern
// so the renderer stays type-safe at call sites without forking the `docx`
// types.
import * as docxModule from 'docx';

import type {
  DocumentBlock,
  DocumentSchema,
  DocumentSection,
  FormattingSchema,
} from './documentStudioTypes.js';

interface DocxRuntime {
  AlignmentType: { CENTER: unknown; LEFT: unknown; RIGHT: unknown };
  Document: new (options: Record<string, unknown>) => unknown;
  Footer: new (options: Record<string, unknown>) => unknown;
  Header: new (options: Record<string, unknown>) => unknown;
  HeadingLevel: { HEADING_1: unknown; HEADING_2: unknown; HEADING_3: unknown };
  PageNumber: { CURRENT: unknown; TOTAL_PAGES: unknown };
  Packer: { toBuffer: (doc: unknown) => Promise<Buffer> };
  Paragraph: new (options: Record<string, unknown>) => DocxParagraph;
  Table: new (options: Record<string, unknown>) => DocxTable;
  TableCell: new (options: Record<string, unknown>) => unknown;
  TableRow: new (options: Record<string, unknown>) => unknown;
  TextRun: new (options: Record<string, unknown>) => DocxTextRun;
  WidthType: { PERCENTAGE: unknown };
}

interface DocxParagraph {
  readonly __brand?: 'paragraph';
}
interface DocxTable {
  readonly __brand?: 'table';
}
interface DocxTextRun {
  readonly __brand?: 'textrun';
}

const {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = docxModule as unknown as DocxRuntime;

// Re-declare the names in the type namespace so call sites can keep using
// `: Paragraph`, `: Table`, `: TextRun` for nominal typing. These coexist with
// the equally-named constructors above (TypeScript keeps value- and
// type-namespace identifiers separate).
type Paragraph = DocxParagraph;
type Table = DocxTable;
type TextRun = DocxTextRun;

const DEFAULT_BODY_FONT = 'Aptos';
const DEFAULT_HEADING_FONT = 'Aptos Display';
const TWIPS_PER_CM = 567; // 1 cm = 567 twips at 1440 dpi

interface BlockTextContent {
  text?: string;
}

interface BlockListContent {
  style?: 'bullet' | 'numbered';
  items?: unknown[];
}

interface BlockTableContent {
  headers?: unknown[];
  rows?: unknown[][];
}

interface BlockCalloutContent {
  variant?: string;
  text?: string;
}

function fontFromSchema(schema: FormattingSchema, kind: 'body' | 'heading'): string {
  // FormattingSchema stores fonts like "Aptos 11" (family + default size). We
  // strip the trailing size hint so docx accepts it as a font family.
  const raw = kind === 'body' ? schema.fonts.body : schema.fonts.heading;
  const stripped = String(raw || '')
    .replace(/\s+\d+(\.\d+)?\s*$/, '')
    .trim();
  if (stripped.length > 0) return stripped;
  return kind === 'body' ? DEFAULT_BODY_FONT : DEFAULT_HEADING_FONT;
}

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function headingLevelForSection(
  level: 1 | 2 | 3
): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function buildAssumptionMarker(font: string): TextRun {
  return new TextRun({
    text: '  [Assumption — needs source]',
    italics: true,
    color: 'B45309',
    size: 18,
    font,
  });
}

function renderHeadingBlock(block: DocumentBlock, schema: DocumentSchema): Paragraph {
  const headingFont = fontFromSchema(schema.formattingSchema, 'heading');
  const value = (block.content ?? {}) as { text?: string; level?: 1 | 2 | 3 };
  const text = asString(value.text ?? '');
  return new Paragraph({
    heading: headingLevelForSection(value.level ?? 2),
    children: [new TextRun({ text, font: headingFont })],
  });
}

function renderParagraphBlock(block: DocumentBlock, schema: DocumentSchema): Paragraph {
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const value = (block.content ?? {}) as BlockTextContent;
  const text = asString(value.text ?? '');
  const children: TextRun[] = [
    new TextRun({
      text,
      font: bodyFont,
      italics: Boolean(block.isAssumption),
      color: block.isAssumption ? '92400E' : undefined,
    }),
  ];
  if (block.isAssumption) children.push(buildAssumptionMarker(bodyFont));
  return new Paragraph({ children, spacing: { after: 120 } });
}

function renderListBlocks(block: DocumentBlock, schema: DocumentSchema): Paragraph[] {
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const value = (block.content ?? {}) as BlockListContent;
  const items = Array.isArray(value.items) ? value.items : [];
  const numbered = value.style === 'numbered' || block.type === 'numbered_list';
  return items.map((raw, index) => {
    const itemText = asString(raw);
    const prefix = numbered ? `${index + 1}. ` : '• ';
    const children: TextRun[] = [new TextRun({ text: `${prefix}${itemText}`, font: bodyFont })];
    if (block.isAssumption && index === items.length - 1) {
      children.push(buildAssumptionMarker(bodyFont));
    }
    return new Paragraph({ children, spacing: { after: 60 } });
  });
}

function renderCalloutBlock(block: DocumentBlock, schema: DocumentSchema): Paragraph {
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const value = (block.content ?? {}) as BlockCalloutContent;
  const text = asString(value.text ?? '');
  const label = value.variant ? `[${String(value.variant).toUpperCase()}] ` : '[Key message] ';
  return new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, color: '4338CA', font: bodyFont }),
      new TextRun({ text, italics: true, font: bodyFont }),
    ],
    spacing: { before: 80, after: 120 },
  });
}

function renderQuoteBlock(block: DocumentBlock, schema: DocumentSchema): Paragraph {
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const value = (block.content ?? {}) as BlockTextContent & { attribution?: string };
  const text = asString(value.text ?? '');
  const attribution = value.attribution ? ` — ${asString(value.attribution)}` : '';
  return new Paragraph({
    indent: { left: 360 },
    children: [
      new TextRun({
        text: `“${text}”${attribution}`,
        italics: true,
        font: bodyFont,
        color: '475569',
      }),
    ],
    spacing: { before: 80, after: 120 },
  });
}

function renderTableBlock(block: DocumentBlock, schema: DocumentSchema): Table | Paragraph {
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const value = (block.content ?? {}) as BlockTableContent;
  const headers = Array.isArray(value.headers) ? value.headers : [];
  const rows = Array.isArray(value.rows) ? value.rows : [];

  if (headers.length === 0 && rows.length === 0) {
    return new Paragraph({
      children: [
        new TextRun({
          text: '[Table placeholder — populate with structured data once sources are attached.]',
          italics: true,
          color: '64748B',
          font: bodyFont,
        }),
      ],
    });
  }

  const tableRows: unknown[] = [];
  if (headers.length > 0) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: asString(cell), bold: true, font: bodyFont, size: 20 }),
                  ],
                }),
              ],
            })
        ),
      })
    );
  }
  for (const row of rows) {
    const cells = Array.isArray(row) ? row : [];
    tableRows.push(
      new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: asString(cell), font: bodyFont, size: 20 })],
                }),
              ],
            })
        ),
      })
    );
  }

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function renderBlock(block: DocumentBlock, schema: DocumentSchema): (Paragraph | Table)[] {
  switch (block.type) {
    case 'heading':
      return [renderHeadingBlock(block, schema)];
    case 'paragraph':
      return [renderParagraphBlock(block, schema)];
    case 'bullet_list':
    case 'numbered_list':
      return renderListBlocks(block, schema);
    case 'callout':
      return [renderCalloutBlock(block, schema)];
    case 'quote':
      return [renderQuoteBlock(block, schema)];
    case 'table':
    case 'risk_table':
    case 'kpi_strip':
      return [renderTableBlock(block, schema)];
    case 'image':
    case 'footnote':
    case 'citation':
    default:
      // Fall back to paragraph text rendering for block types not covered by
      // the MVP-1 finalization renderer.
      return [renderParagraphBlock(block, schema)];
  }
}

function renderSection(
  section: DocumentSection,
  schema: DocumentSchema,
  index: number
): (Paragraph | Table)[] {
  const headingFont = fontFromSchema(schema.formattingSchema, 'heading');
  const headingText = `${index + 1}. ${section.title}`;
  const heading = new Paragraph({
    heading: headingLevelForSection(section.level ?? 1),
    children: [new TextRun({ text: headingText, font: headingFont })],
    spacing: { before: 240, after: 120 },
  });
  const purpose = section.purpose
    ? [
        new Paragraph({
          children: [
            new TextRun({
              text: section.purpose,
              italics: true,
              color: '64748B',
              size: 18,
              font: fontFromSchema(schema.formattingSchema, 'body'),
            }),
          ],
          spacing: { after: 120 },
        }),
      ]
    : [];

  const blockOutputs: (Paragraph | Table)[] = [];
  for (const block of section.blocks) {
    blockOutputs.push(...renderBlock(block, schema));
  }
  return [heading, ...purpose, ...blockOutputs];
}

function renderCoverBlock(schema: DocumentSchema): Paragraph[] {
  const headingFont = fontFromSchema(schema.formattingSchema, 'heading');
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const subtitle = `${schema.documentType.replace(/_/g, ' ')} · ${schema.language.toUpperCase()} · ${schema.density} · ${schema.confidentiality}`;
  const audience = schema.audience.length > 0 ? schema.audience.join(', ') : 'Internal';
  const generatedAt = new Date(schema.updatedAt || schema.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: schema.title,
          bold: true,
          size: 48,
          font: headingFont,
          color: '0F172A',
        }),
      ],
      spacing: { before: 600, after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: subtitle, italics: true, color: '475569', font: bodyFont, size: 22 }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Audience: ${audience}`,
          color: '64748B',
          font: bodyFont,
          size: 20,
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Generated: ${generatedAt}`,
          color: '94A3B8',
          font: bodyFont,
          size: 18,
        }),
      ],
      spacing: { after: 600 },
    }),
  ];
}

function renderSources(schema: DocumentSchema): (Paragraph | Table)[] {
  const headingFont = fontFromSchema(schema.formattingSchema, 'heading');
  const bodyFont = fontFromSchema(schema.formattingSchema, 'body');
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'Sources & traceability', font: headingFont })],
    spacing: { before: 240, after: 120 },
  });
  if (schema.sourceRefs.length === 0) {
    return [
      heading,
      new Paragraph({
        children: [
          new TextRun({
            text: 'No sources attached. Substantive content blocks are flagged as assumptions and require a source pack before client distribution.',
            italics: true,
            color: '92400E',
            font: bodyFont,
          }),
        ],
      }),
    ];
  }
  const items = schema.sourceRefs.map((ref, i) => {
    const title = ref.sourceTitle ? ` — ${ref.sourceTitle}` : '';
    return new Paragraph({
      children: [
        new TextRun({ text: `${i + 1}. `, bold: true, font: bodyFont }),
        new TextRun({ text: `${ref.sourceType}#${ref.sourceId}${title}`, font: bodyFont }),
      ],
      spacing: { after: 60 },
    });
  });
  return [heading, ...items];
}

export async function renderDocumentSchemaToDocxBuffer(schema: DocumentSchema): Promise<Buffer> {
  const formatting = schema.formattingSchema;
  const headingFont = fontFromSchema(formatting, 'heading');
  const bodyFont = fontFromSchema(formatting, 'body');
  const margins = formatting.page.marginsCm;

  const sectionChildren: (Paragraph | Table)[] = [];
  if (formatting.coverPage) sectionChildren.push(...renderCoverBlock(schema));
  schema.sections.forEach((section, index) => {
    sectionChildren.push(...renderSection(section, schema, index));
  });
  sectionChildren.push(...renderSources(schema));

  const headerEnabled = formatting.headers.enabled;
  const footerEnabled = formatting.footers.enabled;

  const headerChildren = headerEnabled
    ? [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: schema.title,
              size: 18,
              color: '64748B',
              font: bodyFont,
            }),
          ],
        }),
      ]
    : [];
  const footerRuns: TextRun[] = [];
  if (formatting.footers.confidentialityLabel) {
    footerRuns.push(
      new TextRun({
        text: schema.confidentiality.replace(/_/g, ' '),
        size: 16,
        color: '94A3B8',
        font: bodyFont,
      })
    );
  }
  if (formatting.footers.pageNumbering) {
    footerRuns.push(
      new TextRun({ text: '   |   ', size: 16, color: '94A3B8', font: bodyFont }),
      new TextRun({ text: 'Page ', size: 16, color: '94A3B8', font: bodyFont }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8', font: bodyFont }),
      new TextRun({ text: ' / ', size: 16, color: '94A3B8', font: bodyFont }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '94A3B8', font: bodyFont })
    );
  }
  const footerChildren =
    footerEnabled && footerRuns.length > 0
      ? [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: footerRuns,
          }),
        ]
      : [];

  const doc = new Document({
    creator: 'Consultify Document Studio',
    title: schema.title,
    description: `Consultify Document Studio · ${schema.documentType}`,
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: 22 },
        },
        heading1: {
          run: { font: headingFont, size: 32, bold: true, color: '0F172A' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
          run: { font: headingFont, size: 26, bold: true, color: '1E293B' },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
          run: { font: headingFont, size: 22, bold: true, color: '334155' },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: {
              top: Math.round(margins.top * TWIPS_PER_CM),
              bottom: Math.round(margins.bottom * TWIPS_PER_CM),
              left: Math.round(margins.left * TWIPS_PER_CM),
              right: Math.round(margins.right * TWIPS_PER_CM),
            },
          },
        },
        headers: headerEnabled ? { default: new Header({ children: headerChildren }) } : undefined,
        footers:
          footerEnabled && footerChildren.length > 0
            ? { default: new Footer({ children: footerChildren }) }
            : undefined,
        children: sectionChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
