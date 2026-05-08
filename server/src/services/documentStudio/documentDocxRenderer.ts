/**
 * Consultify Document Studio — DOCX renderer.
 *
 * Pure schema-aware renderer: consumes a `DocumentSchema` and produces a real
 * editable .docx buffer using the `docx` package. Honors the document's
 * `FormattingSchema` (page size, margins, headers, footers, page numbering,
 * confidentiality label) so the output looks like a consulting deliverable
 * rather than markdown pasted into Word.
 *
 * MVP-1 finalization scope:
 *   - cover-style title block, document metadata strip
 *   - sections with H1/H2/H3 numbered headings, paragraphs, lists, callouts,
 *     quotes, basic tables
 *   - assumption highlighting (italic + amber-coded marker)
 *   - sources appendix (or "no sources attached" notice)
 *   - confidentiality footer + page numbering
 *
 * Epic E8 (Advanced DOCX) — Slice 8.1:
 *   - real Word styles per formatting class via {@link buildDocxStyleConfig}
 *   - paragraph runs use *named* paragraph styles (`Heading1`, `BodyText`,
 *     `BlockQuote`, …) so Word's outline / TOC / a11y trees pick the
 *     document up the way they would for a hand-authored deliverable.
 *
 * Still deferred to later E8 slices: automatic TOC field, captions,
 * footnotes, citation styles, lettered/numbered appendices.
 */

// `docx@9.5.1` ships a single bundled `.d.ts` whose classes (Table, TableCell,
// TableRow) and the `WidthType` const are not picked up cleanly under our
// `module: "NodeNext"` server tsconfig (the runtime exports work; this is a
// known type-resolution quirk also worked around in
// `routes/report-builder.routes.ts`). We use the same namespace + cast pattern
// so the renderer stays type-safe at call sites without forking the `docx`
// types.
import * as docxModule from 'docx';

import {
  formatAppendixHeading,
  formatBodyHeading,
  partitionSections,
} from './documentDocxStructure.js';
import {
  buildDocxStyleConfig,
  DOCX_STYLE_IDS,
  resolveDocxFonts,
  resolveFormattingClass,
} from './documentDocxStyles.js';
import type { DocumentBlock, DocumentSchema, DocumentSection } from './documentStudioTypes.js';

interface DocxRuntime {
  AlignmentType: { CENTER: unknown; LEFT: unknown; RIGHT: unknown };
  Document: new (options: Record<string, unknown>) => unknown;
  Footer: new (options: Record<string, unknown>) => unknown;
  Header: new (options: Record<string, unknown>) => unknown;
  HeadingLevel: { HEADING_1: unknown; HEADING_2: unknown; HEADING_3: unknown };
  PageBreak: new () => DocxTextRun;
  PageNumber: { CURRENT: unknown; TOTAL_PAGES: unknown };
  Packer: { toBuffer: (doc: unknown) => Promise<Buffer> };
  Paragraph: new (options: Record<string, unknown>) => DocxParagraph;
  Table: new (options: Record<string, unknown>) => DocxTable;
  TableCell: new (options: Record<string, unknown>) => unknown;
  TableRow: new (options: Record<string, unknown>) => unknown;
  TableOfContents: new (alias?: string, options?: Record<string, unknown>) => unknown;
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
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TableOfContents,
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

/**
 * Render-context the renderer threads through every block helper. Holds
 * the resolved formatting class + fonts so each helper avoids re-running
 * the resolver for every paragraph (and so future slices, e.g. captions,
 * can pull the body font without re-importing the styles module).
 */
interface RenderContext {
  schema: DocumentSchema;
  bodyFont: string;
  headingFont: string;
}

function buildRenderContext(schema: DocumentSchema): RenderContext {
  const formattingClass = resolveFormattingClass(schema);
  const fonts = resolveDocxFonts(schema, formattingClass);
  return { schema, bodyFont: fonts.body, headingFont: fonts.heading };
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

/**
 * Resolve the named-style id for a heading level so block-level and
 * section-level headings share the same path through the styles map.
 */
function styleIdForHeadingLevel(level: 1 | 2 | 3): string {
  if (level === 1) return DOCX_STYLE_IDS.HEADING1;
  if (level === 2) return DOCX_STYLE_IDS.HEADING2;
  return DOCX_STYLE_IDS.HEADING3;
}

function renderHeadingBlock(block: DocumentBlock, ctx: RenderContext): Paragraph {
  const value = (block.content ?? {}) as { text?: string; level?: 1 | 2 | 3 };
  const text = asString(value.text ?? '');
  const level = value.level ?? 2;
  return new Paragraph({
    style: styleIdForHeadingLevel(level),
    heading: headingLevelForSection(level),
    children: [new TextRun({ text, font: ctx.headingFont })],
  });
}

function renderParagraphBlock(block: DocumentBlock, ctx: RenderContext): Paragraph {
  const value = (block.content ?? {}) as BlockTextContent;
  const text = asString(value.text ?? '');
  const children: TextRun[] = [
    new TextRun({
      text,
      font: ctx.bodyFont,
    }),
  ];
  if (block.isAssumption) children.push(buildAssumptionMarker(ctx.bodyFont));
  return new Paragraph({
    style: block.isAssumption ? DOCX_STYLE_IDS.ASSUMPTION_BODY : DOCX_STYLE_IDS.BODY_TEXT,
    children,
  });
}

function renderListBlocks(block: DocumentBlock, ctx: RenderContext): Paragraph[] {
  const value = (block.content ?? {}) as BlockListContent;
  const items = Array.isArray(value.items) ? value.items : [];
  const numbered = value.style === 'numbered' || block.type === 'numbered_list';
  return items.map((raw, index) => {
    const itemText = asString(raw);
    const prefix = numbered ? `${index + 1}. ` : '• ';
    const children: TextRun[] = [new TextRun({ text: `${prefix}${itemText}`, font: ctx.bodyFont })];
    if (block.isAssumption && index === items.length - 1) {
      children.push(buildAssumptionMarker(ctx.bodyFont));
    }
    return new Paragraph({
      style: DOCX_STYLE_IDS.BODY_TEXT,
      children,
      spacing: { after: 60 },
    });
  });
}

function renderCalloutBlock(block: DocumentBlock, ctx: RenderContext): Paragraph {
  const value = (block.content ?? {}) as BlockCalloutContent;
  const text = asString(value.text ?? '');
  const label = value.variant ? `[${String(value.variant).toUpperCase()}] ` : '[Key message] ';
  return new Paragraph({
    style: DOCX_STYLE_IDS.CALLOUT,
    children: [
      new TextRun({ text: label, bold: true, color: '4338CA', font: ctx.bodyFont }),
      new TextRun({ text, italics: true, font: ctx.bodyFont }),
    ],
  });
}

function renderQuoteBlock(block: DocumentBlock, ctx: RenderContext): Paragraph {
  const value = (block.content ?? {}) as BlockTextContent & { attribution?: string };
  const text = asString(value.text ?? '');
  const attribution = value.attribution ? ` — ${asString(value.attribution)}` : '';
  return new Paragraph({
    style: DOCX_STYLE_IDS.BLOCK_QUOTE,
    children: [
      new TextRun({
        text: `“${text}”${attribution}`,
        font: ctx.bodyFont,
      }),
    ],
  });
}

function renderTableBlock(block: DocumentBlock, ctx: RenderContext): Table | Paragraph {
  const value = (block.content ?? {}) as BlockTableContent;
  const headers = Array.isArray(value.headers) ? value.headers : [];
  const rows = Array.isArray(value.rows) ? value.rows : [];

  if (headers.length === 0 && rows.length === 0) {
    return new Paragraph({
      style: DOCX_STYLE_IDS.CAPTION,
      children: [
        new TextRun({
          text: '[Table placeholder — populate with structured data once sources are attached.]',
          font: ctx.bodyFont,
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
                  style: DOCX_STYLE_IDS.BODY_TEXT,
                  children: [
                    new TextRun({ text: asString(cell), bold: true, font: ctx.bodyFont, size: 20 }),
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
                  style: DOCX_STYLE_IDS.BODY_TEXT,
                  children: [new TextRun({ text: asString(cell), font: ctx.bodyFont, size: 20 })],
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

function renderBlock(block: DocumentBlock, ctx: RenderContext): (Paragraph | Table)[] {
  switch (block.type) {
    case 'heading':
      return [renderHeadingBlock(block, ctx)];
    case 'paragraph':
      return [renderParagraphBlock(block, ctx)];
    case 'bullet_list':
    case 'numbered_list':
      return renderListBlocks(block, ctx);
    case 'callout':
      return [renderCalloutBlock(block, ctx)];
    case 'quote':
      return [renderQuoteBlock(block, ctx)];
    case 'table':
    case 'risk_table':
    case 'kpi_strip':
      return [renderTableBlock(block, ctx)];
    case 'image':
    case 'footnote':
    case 'citation':
    default:
      // Fall back to paragraph text rendering for block types not covered by
      // the MVP-1 finalization renderer.
      return [renderParagraphBlock(block, ctx)];
  }
}

function renderSection(
  section: DocumentSection,
  ctx: RenderContext,
  headingText: string,
  options: { pageBreakBefore?: boolean } = {}
): (Paragraph | Table)[] {
  const level = section.level ?? 1;
  const heading = new Paragraph({
    style: styleIdForHeadingLevel(level),
    heading: headingLevelForSection(level),
    children: [new TextRun({ text: headingText, font: ctx.headingFont })],
    pageBreakBefore: options.pageBreakBefore === true ? true : undefined,
  });
  const purpose = section.purpose
    ? [
        new Paragraph({
          style: DOCX_STYLE_IDS.CAPTION,
          children: [
            new TextRun({
              text: section.purpose,
              font: ctx.bodyFont,
            }),
          ],
        }),
      ]
    : [];

  const blockOutputs: (Paragraph | Table)[] = [];
  for (const block of section.blocks) {
    blockOutputs.push(...renderBlock(block, ctx));
  }
  return [heading, ...purpose, ...blockOutputs];
}

function renderCoverBlock(ctx: RenderContext): Paragraph[] {
  const schema = ctx.schema;
  const subtitle = `${schema.documentType.replace(/_/g, ' ')} · ${schema.language.toUpperCase()} · ${schema.density} · ${schema.confidentiality}`;
  const audience = schema.audience.length > 0 ? schema.audience.join(', ') : 'Internal';
  const generatedAt = new Date(schema.updatedAt || schema.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  return [
    new Paragraph({
      style: DOCX_STYLE_IDS.TITLE,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: schema.title,
          font: ctx.headingFont,
        }),
      ],
    }),
    new Paragraph({
      style: DOCX_STYLE_IDS.SUBTITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: subtitle, font: ctx.bodyFont })],
    }),
    new Paragraph({
      style: DOCX_STYLE_IDS.SUBTITLE,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Audience: ${audience}`,
          font: ctx.bodyFont,
        }),
      ],
    }),
    new Paragraph({
      style: DOCX_STYLE_IDS.SUBTITLE,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Generated: ${generatedAt}`,
          font: ctx.bodyFont,
        }),
        // Hard page break — keeps the cover on its own page so the
        // TOC (or first body section) starts on page 2 just like a
        // hand-authored consulting deliverable would.
        new PageBreak(),
      ],
    }),
  ];
}

/**
 * Insert a real Word TOC field. Word renders the placeholder text on
 * first open and offers "Update field" to populate the field with
 * actual heading entries. The renderer honors `formattingSchema.toc`
 * — when disabled this helper is never called.
 *
 * The TOC pulls levels 1–3 from named heading styles (`Heading1`,
 * `Heading2`, `Heading3`). The terminal page break ensures body
 * content starts on its own page even on documents without a cover.
 */
function renderTocBlock(ctx: RenderContext): unknown[] {
  const heading = new Paragraph({
    style: DOCX_STYLE_IDS.TOC_HEADING,
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'Table of Contents', font: ctx.headingFont })],
  });
  const toc = new TableOfContents('Table of Contents', {
    hyperlink: true,
    headingStyleRange: '1-3',
  });
  const trailingBreak = new Paragraph({
    style: DOCX_STYLE_IDS.BODY_TEXT,
    children: [new PageBreak()],
  });
  return [heading, toc, trailingBreak];
}

function renderSources(ctx: RenderContext): (Paragraph | Table)[] {
  const schema = ctx.schema;
  const heading = new Paragraph({
    style: DOCX_STYLE_IDS.HEADING1,
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'Sources & traceability', font: ctx.headingFont })],
  });
  if (schema.sourceRefs.length === 0) {
    return [
      heading,
      new Paragraph({
        style: DOCX_STYLE_IDS.ASSUMPTION_BODY,
        children: [
          new TextRun({
            text: 'No sources attached. Substantive content blocks are flagged as assumptions and require a source pack before client distribution.',
            font: ctx.bodyFont,
          }),
        ],
      }),
    ];
  }
  const items = schema.sourceRefs.map((ref, i) => {
    const title = ref.sourceTitle ? ` — ${ref.sourceTitle}` : '';
    return new Paragraph({
      style: DOCX_STYLE_IDS.SOURCE_LIST,
      children: [
        new TextRun({ text: `${i + 1}. `, bold: true, font: ctx.bodyFont }),
        new TextRun({ text: `${ref.sourceType}#${ref.sourceId}${title}`, font: ctx.bodyFont }),
      ],
    });
  });
  return [heading, ...items];
}

export async function renderDocumentSchemaToDocxBuffer(schema: DocumentSchema): Promise<Buffer> {
  const formatting = schema.formattingSchema;
  const ctx = buildRenderContext(schema);
  const formattingClass = resolveFormattingClass(schema);
  const styles = buildDocxStyleConfig(schema, formattingClass);
  const margins = formatting.page.marginsCm;

  const sectionChildren: unknown[] = [];
  if (formatting.coverPage) sectionChildren.push(...renderCoverBlock(ctx));
  if (formatting.toc) sectionChildren.push(...renderTocBlock(ctx));

  // Partition into body + appendix groups so appendices always land
  // at the end of the document under the configured numbering scheme,
  // regardless of where the schema author placed them.
  const partitioned = partitionSections(schema.sections);
  partitioned.body.forEach((section, index) => {
    sectionChildren.push(...renderSection(section, ctx, formatBodyHeading(section, index)));
  });
  partitioned.appendix.forEach((section, index) => {
    sectionChildren.push(
      ...renderSection(section, ctx, formatAppendixHeading(section, index, formatting), {
        // Only the FIRST appendix forces a page break, so the appendix
        // block visually opens on a fresh page. Subsequent appendices
        // flow naturally so two short appendices do not waste a page
        // each on otherwise dense reports.
        pageBreakBefore: index === 0,
      })
    );
  });

  sectionChildren.push(...renderSources(ctx));

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
              font: ctx.bodyFont,
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
        font: ctx.bodyFont,
      })
    );
  }
  if (formatting.footers.pageNumbering) {
    footerRuns.push(
      new TextRun({ text: '   |   ', size: 16, color: '94A3B8', font: ctx.bodyFont }),
      new TextRun({ text: 'Page ', size: 16, color: '94A3B8', font: ctx.bodyFont }),
      new TextRun({
        children: [PageNumber.CURRENT],
        size: 16,
        color: '94A3B8',
        font: ctx.bodyFont,
      }),
      new TextRun({ text: ' / ', size: 16, color: '94A3B8', font: ctx.bodyFont }),
      new TextRun({
        children: [PageNumber.TOTAL_PAGES],
        size: 16,
        color: '94A3B8',
        font: ctx.bodyFont,
      })
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
    description: `Consultify Document Studio · ${schema.documentType} · ${formattingClass}`,
    styles,
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
