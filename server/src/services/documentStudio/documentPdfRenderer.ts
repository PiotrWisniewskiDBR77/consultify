/**
 * Consultify Document Studio — PDF renderer.
 *
 * Schema-aware PDF renderer using `pdfkit`. Honors the document's
 * `FormattingSchema` (page size, margins, headers, footers, page numbering,
 * confidentiality label) so the output reads as a real consulting deliverable.
 *
 * The renderer streams `pdfkit` output into an in-memory Buffer so it can be
 * returned through the existing wave5 export pipeline as `contentBase64`.
 *
 * MVP-1 finalization scope: cover, headings, paragraphs, callouts, quotes,
 * lists, basic tables, sources appendix, header/footer with page numbering.
 *
 * Epic E8 (Advanced DOCX) — Slice 8.4 PDF parity:
 *   - structural numbering (body sections + appendix lettering/numbering)
 *     shares the `documentDocxStructure.ts` helpers with the DOCX renderer
 *     so the two outputs stay in sync;
 *   - cover page lives on its own page (real `addPage()` after the cover);
 *   - manual Table of Contents emitted when `formattingSchema.toc` is true;
 *   - tables auto-emit a `Table N — caption` line; images render as
 *     `Figure N — caption` placeholders (asset embedding still deferred);
 *   - source-ref citations follow `formattingSchema.citationStyle`:
 *     `'inline_marker'` appends `[N]` markers; `'footnote'`/`'endnote'`
 *     accumulate a Notes appendix at the end of the document.
 *
 * Still deferred: native bottom-of-page footnote positioning, generic
 * image-asset embedding beyond chart blocks, custom fonts beyond the
 * system stack.
 */

import PDFDocument from 'pdfkit';
import { imageSize } from 'image-size';

import {
  formatAppendixHeading,
  formatBodyHeading,
  partitionSections,
  planSectionHeadings,
} from './documentDocxStructure.js';
import { type FormattingClass, resolveFormattingClass } from './documentDocxStyles.js';
import {
  type DocumentAsset,
  type DocumentBlock,
  documentChartBlockContent,
  type DocumentSchema,
  type DocumentSection,
  type FormattingSchema,
  summarizeDocumentChartBlock,
} from './documentStudioTypes.js';
import { renderChartBlockToPng } from './documentChartRasterizer.js';

/**
 * Mirror of `DocumentRenderOptions` from the DOCX renderer so PDF
 * + DOCX share the same caller-side contract. Slice E15.5.coverPageLogo.
 */
export interface DocumentPdfRenderOptions {
  coverLogoAsset?: Pick<DocumentAsset, 'mimeType' | 'dataBase64'> & {
    widthCm?: number;
  };
}

const POINTS_PER_CM = 28.3464567; // 1cm at 72dpi

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
 * PDF font sizes (in points) per formatting class. Mirrors
 * `documentDocxStyles.ts` SIZING_BY_CLASS but in pdfkit's points
 * convention so the two renderers can be inspected side-by-side
 * without cross-translating units.
 */
interface PdfClassSizing {
  title: number;
  subtitle: number;
  heading1: number;
  heading2: number;
  heading3: number;
  body: number;
  caption: number;
  footnote: number;
}

const PDF_SIZING_BY_CLASS: Record<FormattingClass, PdfClassSizing> = {
  executive: {
    title: 28,
    subtitle: 13,
    heading1: 17,
    heading2: 14,
    heading3: 12,
    body: 11,
    caption: 9,
    footnote: 9,
  },
  professional: {
    title: 24,
    subtitle: 12,
    heading1: 16,
    heading2: 13,
    heading3: 11,
    body: 11,
    caption: 9,
    footnote: 9,
  },
  narrative: {
    title: 24,
    subtitle: 12,
    heading1: 15,
    heading2: 12.5,
    heading3: 11,
    body: 11.5,
    caption: 9,
    footnote: 9,
  },
  legal: {
    title: 20,
    subtitle: 11,
    heading1: 14,
    heading2: 12,
    heading3: 11,
    body: 10,
    caption: 8,
    footnote: 8,
  },
};

/**
 * Per-render mutable state — caption counters, footnote registry,
 * source-ref registry. Mirrors the DOCX renderer's RenderContext so
 * captions and citations behave identically across formats.
 */
interface PdfRenderContext {
  schema: DocumentSchema;
  formattingClass: FormattingClass;
  sizing: PdfClassSizing;
  citationStyle: 'inline_marker' | 'footnote' | 'endnote';
  tableCounter: { value: number };
  figureCounter: { value: number };
  /** Footnote bodies in append order (notes appendix renders them all). */
  footnoteBodies: { id: number; body: string }[];
  nextFootnoteId: { value: number };
  /** 1-based citation index per `${type}::${id}` source ref. */
  sourceRefIndex: Map<string, number>;
  /** Optional chart raster bytes keyed by `blockId`. */
  chartPngByBlockId: Map<string, Buffer>;
}

function buildPdfRenderContext(
  schema: DocumentSchema,
  chartPngByBlockId: Map<string, Buffer>
): PdfRenderContext {
  const formattingClass = resolveFormattingClass(schema);
  const baseSizing = PDF_SIZING_BY_CLASS[formattingClass];
  // Slice E15.5.formatting.render — when the schema carries
  // `headingStylesDetailed` (E15.5 substrate), apply the override on
  // top of the class-derived sizing so author-supplied heading specs
  // are honored. PDFKit consumes font sizes in **points** directly,
  // so no half-point conversion is needed (unlike DOCX). Default
  // (no override) keeps the legacy class-derived sizing.
  const detailedHeadings = schema.formattingSchema.headingStylesDetailed;
  const sizing: PdfClassSizing = detailedHeadings
    ? {
        ...baseSizing,
        heading1: detailedHeadings.h1.fontSizePt,
        heading2: detailedHeadings.h2.fontSizePt,
        heading3: detailedHeadings.h3.fontSizePt,
      }
    : baseSizing;
  const sourceRefIndex = new Map<string, number>();
  schema.sourceRefs.forEach((ref, idx) => {
    sourceRefIndex.set(`${ref.sourceType}::${ref.sourceId}`, idx + 1);
  });
  return {
    schema,
    formattingClass,
    sizing,
    citationStyle: schema.formattingSchema.citationStyle,
    tableCounter: { value: 0 },
    figureCounter: { value: 0 },
    footnoteBodies: [],
    nextFootnoteId: { value: 1 },
    sourceRefIndex,
    chartPngByBlockId,
  };
}

async function buildChartPngByBlockId(schema: DocumentSchema): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (block.type !== 'chart') continue;
      const png = await renderChartBlockToPng(block);
      if (png && png.length > 0) {
        out.set(block.blockId, png);
      }
    }
  }
  return out;
}

function registerFootnoteBody(ctx: PdfRenderContext, body: string): number {
  const id = ctx.nextFootnoteId.value;
  ctx.nextFootnoteId.value += 1;
  ctx.footnoteBodies.push({ id, body });
  return id;
}

function citationIndexFor(
  ctx: PdfRenderContext,
  ref: { sourceType: string; sourceId: string }
): number {
  const key = `${ref.sourceType}::${ref.sourceId}`;
  const existing = ctx.sourceRefIndex.get(key);
  if (typeof existing === 'number') return existing;
  const next = ctx.sourceRefIndex.size + 1;
  ctx.sourceRefIndex.set(key, next);
  return next;
}

function describeSourceRef(ref: {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
}): string {
  const title = ref.sourceTitle ? ` — ${ref.sourceTitle}` : '';
  return `Source: ${ref.sourceType}#${ref.sourceId}${title}`;
}

/**
 * Build the inline citation suffix string for a block whose
 * `sourceRef` is set, side-effecting `ctx` so footnote-style
 * citations land in the notes appendix.
 *
 * Returns an empty string when no marker should be emitted (defensive
 * branch covering future citation styles).
 */
function buildCitationSuffix(
  ctx: PdfRenderContext,
  ref: { sourceType: string; sourceId: string; sourceTitle?: string }
): string {
  if (ctx.citationStyle === 'inline_marker') {
    return ` [${citationIndexFor(ctx, ref)}]`;
  }
  if (ctx.citationStyle === 'footnote' || ctx.citationStyle === 'endnote') {
    const id = registerFootnoteBody(ctx, describeSourceRef(ref));
    // PDF has no native footnote anchor; we render a superscript-like
    // marker `^N` that the Notes appendix at the end of the document
    // resolves. Word users still see real footnotes via the DOCX
    // renderer; the PDF parity surface is intentionally simpler.
    return ` ^${id}`;
  }
  return '';
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

function pageSize(formatting: FormattingSchema): 'A4' | 'LETTER' {
  return formatting.page.size === 'Letter' ? 'LETTER' : 'A4';
}

function marginsInPoints(formatting: FormattingSchema): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return {
    top: Math.round(formatting.page.marginsCm.top * POINTS_PER_CM),
    bottom: Math.round(formatting.page.marginsCm.bottom * POINTS_PER_CM),
    left: Math.round(formatting.page.marginsCm.left * POINTS_PER_CM),
    right: Math.round(formatting.page.marginsCm.right * POINTS_PER_CM),
  };
}

function drawCover(
  doc: PDFKit.PDFDocument,
  ctx: PdfRenderContext,
  options: DocumentPdfRenderOptions = {}
): void {
  const schema = ctx.schema;
  // Slice E15.5.formatting.render — `coverPageDetailed` lets the
  // template suppress the density / confidentiality lines per
  // template policy. Default (no override) keeps the legacy full
  // cover so existing schemas render byte-stable.
  const coverDetailed = schema.formattingSchema.coverPageDetailed;
  const includeStatus = coverDetailed?.includeStatus ?? true;
  const includeConfidentiality = coverDetailed?.includeConfidentiality ?? true;
  // Slice E15.5.coverPageLogo — embed when both schema asks for it
  // AND orchestrator hydrated the asset bytes. Defensive: any decode
  // failure silently skips the logo so the cover still renders.
  const includeLogo = coverDetailed?.includeLogo ?? false;
  if (includeLogo && options.coverLogoAsset) {
    drawCoverLogo(doc, options.coverLogoAsset);
  }
  const generatedAt = new Date(schema.updatedAt || schema.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  const audienceRaw = (schema as { audience?: unknown }).audience;
  const audienceList = Array.isArray(audienceRaw)
    ? audienceRaw
        .map((entry) => String(entry || '').trim())
        .filter((entry) => entry.length > 0)
    : typeof audienceRaw === 'string'
      ? audienceRaw
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];
  const audience = audienceList.length > 0 ? audienceList.join(', ') : 'Internal';
  const subtitleParts: string[] = [];
  subtitleParts.push(schema.documentType.replace(/_/g, ' '));
  subtitleParts.push(schema.language.toUpperCase());
  if (includeStatus) {
    subtitleParts.push(schema.density);
  }
  if (includeConfidentiality) {
    subtitleParts.push(schema.confidentiality);
  }
  const subtitle = subtitleParts.join(' · ');
  if (!options.coverLogoAsset) doc.moveDown(4);
  doc.fontSize(ctx.sizing.title).fillColor('#0F172A').text(schema.title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(ctx.sizing.subtitle).fillColor('#475569').text(subtitle, { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(ctx.sizing.subtitle)
    .fillColor('#64748B')
    .text(`Audience: ${audience}`, { align: 'center' });
  doc
    .fontSize(ctx.sizing.caption)
    .fillColor('#94A3B8')
    .text(`Generated: ${generatedAt}`, { align: 'center' });
  doc.addPage();
}

/**
 * Slice E15.5.coverPageLogo — PDF logo embed. Decodes the base64
 * asset bytes once and hands them to PDFKit's `image()` API. We
 * centre the image by computing the page's content width and
 * passing `align: 'center'`. Any decode/embed failure is swallowed
 * so the cover still renders.
 */
function drawCoverLogo(
  doc: PDFKit.PDFDocument,
  asset: NonNullable<DocumentPdfRenderOptions['coverLogoAsset']>
): void {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(asset.dataBase64, 'base64');
  } catch {
    return;
  }
  if (!buffer || buffer.length === 0) return;
  const widthCm = typeof asset.widthCm === 'number' && asset.widthCm > 0 ? asset.widthCm : 4;
  // 72 dpi: 1cm ≈ 28.35 points (PDFKit measures in points).
  const widthPt = widthCm * 28.346456;
  let maxHeightPt = widthPt;
  try {
    const size = imageSize(buffer);
    if (typeof size.width === 'number' && size.width > 0 && typeof size.height === 'number') {
      maxHeightPt = (widthPt * size.height) / size.width;
    }
  } catch {
    maxHeightPt = widthPt;
  }
  maxHeightPt = Math.min(maxHeightPt, 200);
  doc.moveDown(2);
  try {
    doc.image(buffer, {
      fit: [widthPt, maxHeightPt],
      align: 'center',
      valign: 'center',
    });
  } catch {
    // Defensive: bad PNG/JPEG byte sequence → silently skip embed so
    // the cover keeps rendering. Production registry write-side
    // validates the bytes; this is a belt-and-braces safety net.
    return;
  }
  doc.moveDown(0.5);
}

function drawTableOfContents(doc: PDFKit.PDFDocument, ctx: PdfRenderContext): void {
  const plan = planSectionHeadings(ctx.schema.sections, ctx.schema.formattingSchema);
  if (plan.length === 0) return;
  // Slice E15.5.formatting.render — when `tocConfig.maxDepth` is set,
  // filter the heading plan to only include levels ≤ maxDepth. Default
  // (no override) renders all levels (current behavior). Defensive:
  // entries without a numeric `level` are kept (caller's plan is the
  // source of truth — never drop entries we can't classify).
  const tocMaxDepth = ctx.schema.formattingSchema.tocConfig?.maxDepth ?? 3;
  const filtered = plan.filter((entry) => {
    const level = (entry as { level?: number }).level;
    if (typeof level !== 'number') return true;
    return level <= tocMaxDepth;
  });
  if (filtered.length === 0) return;
  drawHeading(doc, 'Table of Contents', 1, ctx);
  doc.fontSize(ctx.sizing.body).fillColor('#0F172A').font('Helvetica');
  for (const entry of filtered) {
    doc.text(entry.heading, { indent: 8 });
  }
  doc.moveDown(0.4);
  doc.addPage();
}

function drawHeading(
  doc: PDFKit.PDFDocument,
  text: string,
  level: 1 | 2 | 3,
  ctx: PdfRenderContext,
  options: { pageBreakBefore?: boolean } = {}
): void {
  const sizes: Record<1 | 2 | 3, number> = {
    1: ctx.sizing.heading1,
    2: ctx.sizing.heading2,
    3: ctx.sizing.heading3,
  };
  const colors: Record<1 | 2 | 3, string> = { 1: '#0F172A', 2: '#1E293B', 3: '#334155' };
  if (options.pageBreakBefore === true) doc.addPage();
  doc.moveDown(level === 1 ? 0.7 : 0.4);
  doc.fontSize(sizes[level]).fillColor(colors[level]).font('Helvetica-Bold').text(text);
  doc.moveDown(0.2);
  doc.font('Helvetica');
}

function drawParagraph(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockTextContent;
  const text = asString(value.text ?? '');
  if (!text) return;
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';
  if (block.isAssumption) {
    doc
      .fontSize(ctx.sizing.body)
      .fillColor('#92400E')
      .font('Helvetica-Oblique')
      .text(`${text}${citationSuffix}`, { continued: true });
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#B45309')
      .text('  [Assumption — needs source]', { continued: false });
  } else {
    doc
      .fontSize(ctx.sizing.body)
      .fillColor('#0F172A')
      .font('Helvetica')
      .text(`${text}${citationSuffix}`);
  }
  doc.moveDown(0.4);
}

function drawList(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockListContent;
  const items = Array.isArray(value.items) ? value.items : [];
  const numbered = value.style === 'numbered' || block.type === 'numbered_list';
  doc.fontSize(ctx.sizing.body).fillColor('#0F172A').font('Helvetica');
  items.forEach((raw, idx) => {
    const prefix = numbered ? `${idx + 1}. ` : '• ';
    doc.text(`${prefix}${asString(raw)}`, { indent: 12 });
  });
  if (block.isAssumption) {
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#B45309')
      .font('Helvetica-Oblique')
      .text('  [Assumption — needs source]', { indent: 12 });
    doc.font('Helvetica');
  }
  doc.moveDown(0.4);
}

function drawCallout(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockCalloutContent;
  const text = asString(value.text ?? '');
  if (!text) return;
  const label = value.variant ? `[${String(value.variant).toUpperCase()}] ` : '[Key message] ';
  doc
    .fontSize(ctx.sizing.body)
    .fillColor('#4338CA')
    .font('Helvetica-Bold')
    .text(label, { continued: true })
    .font('Helvetica-Oblique')
    .fillColor('#0F172A')
    .text(text, { continued: false });
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawQuote(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockTextContent & { attribution?: string };
  const text = asString(value.text ?? '');
  if (!text) return;
  const attribution = value.attribution ? ` — ${asString(value.attribution)}` : '';
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';
  doc
    .fontSize(ctx.sizing.body)
    .fillColor('#475569')
    .font('Helvetica-Oblique')
    .text(`“${text}”${attribution}${citationSuffix}`, { indent: 18 });
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawTable(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockTableContent & { caption?: string };
  const headers = Array.isArray(value.headers) ? value.headers : [];
  const rows = Array.isArray(value.rows) ? value.rows : [];
  if (headers.length === 0 && rows.length === 0) {
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .text('[Table placeholder — populate with structured data once sources are attached.]');
    doc.font('Helvetica');
    doc.moveDown(0.4);
    return;
  }
  doc.fontSize(ctx.sizing.caption).fillColor('#0F172A').font('Helvetica');
  if (headers.length > 0) {
    doc.font('Helvetica-Bold').text(headers.map((h) => asString(h)).join(' | '));
    doc.font('Helvetica');
  }
  for (const row of rows) {
    const cells = Array.isArray(row) ? row.map((c) => asString(c)) : [];
    doc.text(cells.join(' | '));
  }

  // Auto-numbered caption — mirrors the DOCX renderer so two tables
  // across formats agree on "Table 1" / "Table 2".
  ctx.tableCounter.value += 1;
  const captionLabel = `Table ${ctx.tableCounter.value}`;
  const captionText = value.caption ? `${captionLabel} — ${asString(value.caption)}` : captionLabel;
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';
  doc
    .fontSize(ctx.sizing.caption)
    .fillColor('#64748B')
    .font('Helvetica-Oblique')
    .text(`${captionText}${citationSuffix}`);
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawImage(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as { caption?: string; alt?: string };
  ctx.figureCounter.value += 1;
  const captionLabel = `Figure ${ctx.figureCounter.value}`;
  const description = value.caption ? asString(value.caption) : (value.alt ?? 'Image');
  const captionText = `${captionLabel} — ${description}`;
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';
  doc
    .fontSize(ctx.sizing.caption)
    .fillColor('#64748B')
    .font('Helvetica-Oblique')
    .text(`[${captionLabel} placeholder — image asset not yet embedded]`);
  doc.text(`${captionText}${citationSuffix}`);
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawChart(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  ctx.figureCounter.value += 1;
  const captionLabel = `Figure ${ctx.figureCounter.value}`;
  const summary = summarizeDocumentChartBlock(block);
  const titleText = summary.title ?? '(untitled chart)';
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';
  const chartImage = ctx.chartPngByBlockId.get(block.blockId);
  if (chartImage) {
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const maxWidth = Math.min(usableWidth, 480);
    doc.image(chartImage, {
      fit: [maxWidth, 280],
      align: 'center',
      valign: 'center',
    });
    doc.moveDown(0.2);
  } else {
    const kindText = summary.kind ?? 'unknown';
    const seriesText = summary.seriesCount === 1 ? '1 series' : `${summary.seriesCount} series`;
    const valuesText =
      summary.totalValueCount === 1 ? '1 value' : `${summary.totalValueCount} values`;
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .text(
        `[${captionLabel} chart placeholder — ${kindText} chart, ${seriesText}, ${valuesText}; rasterization fallback]`
      );
  }
  doc.text(`${captionLabel} — ${titleText}${citationSuffix}`);
  const content = documentChartBlockContent(block);
  if (content?.caption && content.caption.trim().length > 0) {
    doc.text(content.caption.trim());
  }
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawInlineFootnote(
  doc: PDFKit.PDFDocument,
  block: DocumentBlock,
  ctx: PdfRenderContext
): void {
  const value = (block.content ?? {}) as BlockTextContent;
  const bodyText = asString(value.text ?? '').trim();
  if (bodyText.length === 0) return;
  const id = registerFootnoteBody(ctx, bodyText);
  doc.fontSize(ctx.sizing.body).fillColor('#64748B').font('Helvetica-Oblique').text(`Note ^${id}`);
  doc.font('Helvetica');
  doc.moveDown(0.2);
}

function drawBlock(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  switch (block.type) {
    case 'heading': {
      const value = (block.content ?? {}) as { text?: string; level?: 1 | 2 | 3 };
      drawHeading(doc, asString(value.text ?? ''), value.level ?? 2, ctx);
      return;
    }
    case 'paragraph':
      drawParagraph(doc, block, ctx);
      return;
    case 'bullet_list':
    case 'numbered_list':
      drawList(doc, block, ctx);
      return;
    case 'callout':
      drawCallout(doc, block, ctx);
      return;
    case 'quote':
      drawQuote(doc, block, ctx);
      return;
    case 'table':
    case 'risk_table':
    case 'kpi_strip':
      drawTable(doc, block, ctx);
      return;
    case 'image':
      drawImage(doc, block, ctx);
      return;
    case 'chart':
      drawChart(doc, block, ctx);
      return;
    case 'footnote':
      drawInlineFootnote(doc, block, ctx);
      return;
    case 'citation':
    default:
      drawParagraph(doc, block, ctx);
      return;
  }
}

function drawSection(
  doc: PDFKit.PDFDocument,
  section: DocumentSection,
  ctx: PdfRenderContext,
  headingText: string,
  options: { pageBreakBefore?: boolean } = {}
): void {
  drawHeading(doc, headingText, section.level ?? 1, ctx, options);
  if (section.purpose) {
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .text(section.purpose);
    doc.font('Helvetica');
    doc.moveDown(0.3);
  }
  for (const block of section.blocks) drawBlock(doc, block, ctx);
}

function drawNotesAppendix(doc: PDFKit.PDFDocument, ctx: PdfRenderContext): void {
  if (ctx.footnoteBodies.length === 0) return;
  drawHeading(doc, 'Notes', 1, ctx);
  doc.fontSize(ctx.sizing.footnote).fillColor('#475569').font('Helvetica');
  for (const note of ctx.footnoteBodies) {
    doc.text(`^${note.id} — ${note.body}`);
  }
  doc.moveDown(0.4);
}

function drawSources(doc: PDFKit.PDFDocument, ctx: PdfRenderContext): void {
  const schema = ctx.schema;
  drawHeading(doc, 'Sources & traceability', 1, ctx);
  if (schema.sourceRefs.length === 0) {
    doc
      .fontSize(ctx.sizing.body)
      .fillColor('#92400E')
      .font('Helvetica-Oblique')
      .text(
        'No sources attached. Substantive content blocks are flagged as assumptions and require a source pack before client distribution.'
      );
    doc.font('Helvetica');
    return;
  }
  doc.fontSize(ctx.sizing.body).fillColor('#0F172A').font('Helvetica');
  schema.sourceRefs.forEach((ref, idx) => {
    const title = ref.sourceTitle ? ` — ${ref.sourceTitle}` : '';
    doc.text(`${idx + 1}. ${ref.sourceType}#${ref.sourceId}${title}`);
  });
}

function drawHeaderFooter(
  doc: PDFKit.PDFDocument,
  schema: DocumentSchema,
  pageNumber: number,
  totalPages: number
): void {
  const formatting = schema.formattingSchema;
  const margins = marginsInPoints(formatting);
  if (formatting.headers.enabled) {
    // Slice E15.5.formatting.render — `headers.content` overrides
    // `schema.title` when set. Trimmed before use so accidental
    // whitespace-only overrides don't render an empty header band.
    const headerOverride = formatting.headers.content?.trim();
    const headerText = headerOverride && headerOverride.length > 0 ? headerOverride : schema.title;
    doc
      .save()
      .fontSize(9)
      .fillColor('#64748B')
      .font('Helvetica')
      .text(headerText, margins.left, 22, {
        align: 'left',
        width: doc.page.width - margins.left - margins.right,
      })
      .restore();
    doc
      .save()
      .moveTo(margins.left, 36)
      .lineTo(doc.page.width - margins.right, 36)
      .lineWidth(0.5)
      .strokeColor('#E2E8F0')
      .stroke()
      .restore();
  }
  if (formatting.footers.enabled) {
    const footerY = doc.page.height - 34;
    doc
      .save()
      .moveTo(margins.left, footerY - 6)
      .lineTo(doc.page.width - margins.right, footerY - 6)
      .lineWidth(0.5)
      .strokeColor('#E2E8F0')
      .stroke()
      .restore();
    if (formatting.footers.confidentialityLabel) {
      doc
        .save()
        .fontSize(8)
        .fillColor('#94A3B8')
        .font('Helvetica')
        .text(schema.confidentiality.replace(/_/g, ' '), margins.left, footerY, {
          align: 'left',
          width: doc.page.width - margins.left - margins.right,
        })
        .restore();
    }
    if (formatting.footers.pageNumbering) {
      // Slice E15.5.formatting.render — `pageNumberingFormat` honors
      // a template like `"Strona {N} z {M}"` (PL) or `"Page {N} of {M}"`
      // (custom EN). `{N}` → pageNumber, `{M}` → totalPages. Default
      // (no override) keeps the legacy `N / M` shape so existing
      // schemas render byte-stable.
      const formatTemplate = formatting.footers.pageNumberingFormat?.trim();
      const numberingText =
        formatTemplate && formatTemplate.length > 0
          ? formatTemplate
              .replace(/\{N\}/g, String(pageNumber))
              .replace(/\{M\}/g, String(totalPages))
          : `${pageNumber} / ${totalPages}`;
      doc
        .save()
        .fontSize(8)
        .fillColor('#94A3B8')
        .font('Helvetica')
        .text(numberingText, margins.left, footerY, {
          align: 'right',
          width: doc.page.width - margins.left - margins.right,
        })
        .restore();
    }
  }
}

export async function renderDocumentSchemaToPdfBuffer(
  schema: DocumentSchema,
  options: DocumentPdfRenderOptions = {}
): Promise<Buffer> {
  const formatting = schema.formattingSchema;
  const margins = marginsInPoints(formatting);
  const chartPngByBlockId = await buildChartPngByBlockId(schema);
  const ctx = buildPdfRenderContext(schema, chartPngByBlockId);
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: pageSize(formatting),
        margins,
        bufferPages: true,
        info: {
          Title: schema.title,
          Author: 'Consultify Document Studio',
          Subject: `${schema.documentType} · ${ctx.formattingClass}`,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      if (formatting.coverPage) drawCover(doc, ctx, options);
      if (formatting.toc) drawTableOfContents(doc, ctx);

      // Partition into body + appendix groups so the PDF renderer
      // matches the DOCX renderer's structural contract (appendices
      // always trail, with lettered/numbered/none labelling driven
      // by `formattingSchema.appendixStyle`). The first appendix
      // forces a fresh page; subsequent appendices flow naturally.
      const partitioned = partitionSections(schema.sections);
      partitioned.body.forEach((section, index) => {
        drawSection(doc, section, ctx, formatBodyHeading(section, index));
      });
      partitioned.appendix.forEach((section, index) => {
        drawSection(doc, section, ctx, formatAppendixHeading(section, index, formatting), {
          pageBreakBefore: index === 0,
        });
      });

      drawNotesAppendix(doc, ctx);
      drawSources(doc, ctx);

      // Stamp header/footer onto every page after content has flowed.
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = 0; i < totalPages; i += 1) {
        doc.switchToPage(range.start + i);
        drawHeaderFooter(doc, schema, i + 1, totalPages);
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
