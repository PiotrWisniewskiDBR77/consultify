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
 *   - tables auto-emit a `Table N — caption` line;
 *   - `image` blocks embed real figures when the block content carries
 *     inline bytes (`dataBase64` (+ optional `mimeType` / `widthCm`),
 *     same shape as the cover-logo asset); aspect ratio is preserved and
 *     the figure is constrained to the usable column width. Blocks
 *     without bytes degrade to a `Figure N — caption` placeholder line;
 *   - charts rasterize to PNG via `documentChartRasterizer`;
 *   - cover-page logo embeds via `coverLogoAsset`;
 *   - source-ref citations follow `formattingSchema.citationStyle`:
 *     `'inline_marker'` appends `[N]` markers; `'footnote'`/`'endnote'`
 *     accumulate a Notes appendix at the end of the document.
 *
 * Still deferred: native bottom-of-page footnote positioning, custom
 * fonts beyond the system stack.
 */

import { imageSize } from 'image-size';
import PDFDocument from 'pdfkit';

import { PDF_FONT, registerPdfFonts } from '../../utils/pdfFonts.js';
import { renderChartBlockToPng } from './documentChartRasterizer.js';
import {
  formatAppendixHeading,
  formatBodyHeading,
  partitionSections,
  planSectionHeadings,
  pruneUnrenderableBlocks,
} from './documentDocxStructure.js';
import { type FormattingClass, resolveFormattingClass } from './documentDocxStyles.js';
import type { DocumentGenerationWarningCollector } from './documentGenerationWarnings.js';
import {
  type DocumentAsset,
  type DocumentBlock,
  documentChartBlockContent,
  type DocumentSchema,
  type DocumentSection,
  type FormattingSchema,
  summarizeDocumentChartBlock,
} from './documentStudioTypes.js';

/**
 * Mirror of `DocumentRenderOptions` from the DOCX renderer so PDF
 * + DOCX share the same caller-side contract. Slice E15.5.coverPageLogo.
 */
export interface DocumentPdfRenderOptions {
  coverLogoAsset?: Pick<DocumentAsset, 'mimeType' | 'dataBase64'> & {
    widthCm?: number;
  };
  /**
   * A4 — optional generation-warnings collector. Mirrors the DOCX
   * renderer: records `chart_raster_failed` for chart placeholders and
   * `logo_unavailable` when a requested cover logo could not be embedded.
   * `undefined` is the legacy no-recording behaviour.
   */
  warnings?: DocumentGenerationWarningCollector;
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

/** Premium content-gen keyed table row: `{ cells: { col: { value, style } } }`. */
interface KeyedTableRow {
  cells?: Record<string, { value?: unknown; style?: { bgColor?: string } } | unknown>;
}

/** Premium content-gen KPI shape: `{ items: [{ label, value, delta }] }`. */
interface KpiStripContent {
  items?: Array<{ label?: unknown; value?: unknown; delta?: unknown }>;
}

interface BlockCalloutContent {
  /** Legacy schema field. */
  variant?: string;
  /** Premium content-gen field (info | warning | danger | success). */
  tone?: string;
  text?: string;
}

/** Tone → accent hex for callout labels. */
const PDF_CALLOUT_TONE_COLOR: Record<string, string> = {
  info: '#2563EB',
  warning: '#D97706',
  danger: '#DC2626',
  success: '#16A34A',
};

/** Normalize a CSS hex to `#RRGGBB`, or null when not a valid 6-digit hex. */
function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(clean) ? `#${clean.toUpperCase()}` : null;
}

function isDarkHex(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = Number.parseInt(c.slice(0, 2), 16);
  const g = Number.parseInt(c.slice(2, 4), 16);
  const b = Number.parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

interface PdfNormalizedCell {
  text: string;
  fill: string | null;
}
function normalizePdfTableContent(content: unknown): {
  headers: string[];
  rows: PdfNormalizedCell[][];
} {
  const value = (content ?? {}) as BlockTableContent & { rows?: unknown };
  const rawRows = Array.isArray(value.rows) ? (value.rows as unknown[]) : [];
  const isKeyed = rawRows.some((r) => r != null && typeof r === 'object' && !Array.isArray(r));
  if (isKeyed) {
    const columnKeys: string[] = [];
    const seen = new Set<string>();
    for (const row of rawRows) {
      const keyed = row as KeyedTableRow;
      const cells = (keyed?.cells && typeof keyed.cells === 'object' ? keyed.cells : row) as Record<
        string,
        unknown
      >;
      for (const k of Object.keys(cells ?? {})) {
        if (!seen.has(k)) {
          seen.add(k);
          columnKeys.push(k);
        }
      }
    }
    const rows: PdfNormalizedCell[][] = rawRows.map((row) => {
      const keyed = row as KeyedTableRow;
      const cells = (keyed?.cells && typeof keyed.cells === 'object' ? keyed.cells : row) as Record<
        string,
        unknown
      >;
      return columnKeys.map((key) => {
        const cell = cells?.[key];
        if (cell != null && typeof cell === 'object' && 'value' in (cell as object)) {
          const c = cell as { value?: unknown; style?: { bgColor?: string } };
          return { text: asString(c.value ?? ''), fill: normalizeHexColor(c.style?.bgColor) };
        }
        return { text: asString(cell ?? ''), fill: null };
      });
    });
    const headers = columnKeys.map((k) =>
      k
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^\w/, (m) => m.toUpperCase())
    );
    return { headers, rows };
  }
  const headers = Array.isArray(value.headers) ? value.headers.map((h) => asString(h)) : [];
  const rows: PdfNormalizedCell[][] = rawRows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => ({ text: asString(cell), fill: null }))
  );
  return { headers, rows };
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
  /** A4 — optional generation-warnings collector (chart / logo fallbacks). */
  warnings?: DocumentGenerationWarningCollector;
}

function buildPdfRenderContext(
  schema: DocumentSchema,
  chartPngByBlockId: Map<string, Buffer>,
  warnings?: DocumentGenerationWarningCollector
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
    warnings,
  };
}

async function buildChartPngByBlockId(schema: DocumentSchema): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (block.type !== 'chart') continue;
      // Fail-soft per-blok: błąd rasteryzacji NIE kładzie całego renderu PDF.
      try {
        const png = await renderChartBlockToPng(block);
        if (png && png.length > 0) {
          out.set(block.blockId, png);
        }
      } catch {
        /* pomiń wykres — placeholder */
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
  // A4 — track whether a requested logo actually made it onto the cover.
  const logoEmbedded =
    includeLogo && options.coverLogoAsset ? drawCoverLogo(doc, options.coverLogoAsset) : false;
  if (includeLogo && !logoEmbedded) {
    ctx.warnings?.record({
      code: 'logo_unavailable',
      scope: 'export',
      message:
        'Cover-page logo was requested but no usable logo asset was available; the cover was rendered without it.',
    });
  }
  const generatedAt = new Date(schema.updatedAt || schema.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  const audience = schema.audience.length > 0 ? schema.audience.join(', ') : 'Internal';
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
): boolean {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(asset.dataBase64, 'base64');
  } catch {
    return false;
  }
  if (!buffer || buffer.length === 0) return false;
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
    return false;
  }
  doc.moveDown(0.5);
  return true;
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
  doc.fontSize(ctx.sizing.body).fillColor('#0F172A').font(PDF_FONT.regular);
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
  doc.fontSize(sizes[level]).fillColor(colors[level]).font(PDF_FONT.bold).text(text);
  doc.moveDown(0.2);
  doc.font(PDF_FONT.regular);
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
      .font(PDF_FONT.italic)
      .text(`${text}${citationSuffix}`, { continued: true });
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#B45309')
      .text('  [Assumption — needs source]', { continued: false });
  } else {
    doc
      .fontSize(ctx.sizing.body)
      .fillColor('#0F172A')
      .font(PDF_FONT.regular)
      .text(`${text}${citationSuffix}`);
  }
  doc.moveDown(0.4);
}

function drawList(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockListContent;
  const items = Array.isArray(value.items) ? value.items : [];
  const numbered = value.style === 'numbered' || block.type === 'numbered_list';
  doc.fontSize(ctx.sizing.body).fillColor('#0F172A').font(PDF_FONT.regular);
  items.forEach((raw, idx) => {
    const prefix = numbered ? `${idx + 1}. ` : '• ';
    doc.text(`${prefix}${asString(raw)}`, { indent: 12 });
  });
  if (block.isAssumption) {
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#B45309')
      .font(PDF_FONT.italic)
      .text('  [Assumption — needs source]', { indent: 12 });
    doc.font(PDF_FONT.regular);
  }
  doc.moveDown(0.4);
}

function drawCallout(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as BlockCalloutContent;
  const text = asString(value.text ?? '');
  if (!text) return;
  const marker = value.tone ?? value.variant;
  const label = marker ? `[${String(marker).toUpperCase()}] ` : '[Key message] ';
  const accent = (marker && PDF_CALLOUT_TONE_COLOR[String(marker).toLowerCase()]) || '#4338CA';
  doc
    .fontSize(ctx.sizing.body)
    .fillColor(accent)
    .font(PDF_FONT.bold)
    .text(label, { continued: true })
    .font(PDF_FONT.italic)
    .fillColor('#0F172A')
    .text(text, { continued: false });
  doc.font(PDF_FONT.regular);
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
    .font(PDF_FONT.italic)
    .text(`“${text}”${attribution}${citationSuffix}`, { indent: 18 });
  doc.font(PDF_FONT.regular);
  doc.moveDown(0.4);
}

/** Draw one grid row of cells (with optional per-cell fills) at the current y. */
function drawGridRow(
  doc: PDFKit.PDFDocument,
  cells: PdfNormalizedCell[],
  colX: number[],
  colW: number[],
  fontSize: number,
  opts: { headerRow?: boolean } = {}
): void {
  const pad = 4;
  const lineHeight = fontSize * 1.25;
  // Pre-measure the tallest cell so all cells in the row share a height.
  doc.fontSize(fontSize).font(opts.headerRow ? PDF_FONT.bold : PDF_FONT.regular);
  let maxLines = 1;
  cells.forEach((cell, i) => {
    const h = doc.heightOfString(cell.text || ' ', { width: colW[i] - 2 * pad });
    maxLines = Math.max(maxLines, Math.ceil(h / lineHeight));
  });
  const rowH = maxLines * lineHeight + 2 * pad;
  const y = doc.y;
  // Page-break guard: if the row would overflow, start a fresh page.
  if (y + rowH > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  const top = doc.y;
  cells.forEach((cell, i) => {
    const x = colX[i];
    const w = colW[i];
    const fill = cell.fill ?? (opts.headerRow ? '#E2E8F0' : null);
    if (fill) {
      doc.save().rect(x, top, w, rowH).fill(fill).restore();
    }
    const textColor =
      cell.fill && isDarkHex(cell.fill) ? '#FFFFFF' : opts.headerRow ? '#0F172A' : '#0F172A';
    doc
      .fontSize(fontSize)
      .font(opts.headerRow ? PDF_FONT.bold : PDF_FONT.regular)
      .fillColor(textColor)
      .text(cell.text, x + pad, top + pad, { width: w - 2 * pad });
    // Cell border.
    doc.save().rect(x, top, w, rowH).lineWidth(0.5).strokeColor('#CBD5E1').stroke().restore();
  });
  doc.y = top + rowH;
  doc.x = doc.page.margins.left;
  doc.fillColor('#0F172A').font(PDF_FONT.regular);
}

function drawTable(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as { caption?: string };
  const { headers, rows } = normalizePdfTableContent(block.content);
  if (headers.length === 0 && rows.length === 0) {
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#64748B')
      .font(PDF_FONT.italic)
      .text('[Table placeholder — populate with structured data once sources are attached.]');
    doc.font(PDF_FONT.regular);
    doc.moveDown(0.4);
    return;
  }

  // Real bordered grid (PDFKit has no native table primitive). Equal column
  // widths across the usable content width.
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = Array.from({ length: colCount }, () => usableWidth / colCount);
  const colX = colW.map((_, i) => doc.page.margins.left + i * colW[0]);
  doc.x = doc.page.margins.left;

  const pad = (arr: PdfNormalizedCell[]): PdfNormalizedCell[] => {
    const out = arr.slice(0, colCount);
    while (out.length < colCount) out.push({ text: '', fill: null });
    return out;
  };

  if (headers.length > 0) {
    drawGridRow(
      doc,
      pad(headers.map((h) => ({ text: h, fill: null }))),
      colX,
      colW,
      ctx.sizing.caption,
      { headerRow: true }
    );
  }
  for (const row of rows) {
    drawGridRow(doc, pad(row), colX, colW, ctx.sizing.caption);
  }
  doc.moveDown(0.3);

  // Auto-numbered caption — mirrors the DOCX renderer so two tables
  // across formats agree on "Table 1" / "Table 2".
  ctx.tableCounter.value += 1;
  const captionLabel = `Table ${ctx.tableCounter.value}`;
  const captionText = value.caption ? `${captionLabel} — ${asString(value.caption)}` : captionLabel;
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';
  doc
    .fontSize(ctx.sizing.caption)
    .fillColor('#64748B')
    .font(PDF_FONT.italic)
    .text(`${captionText}${citationSuffix}`);
  doc.font(PDF_FONT.regular);
  doc.moveDown(0.4);
}

/**
 * Decode an `image` block's inline bytes when present. The block content
 * may carry `dataBase64` (+ optional `mimeType` / `widthCm`) in the same
 * shape as the cover-logo asset. Returns `null` when there are no bytes
 * or the base64 is invalid, so the caller falls back to the placeholder.
 */
function decodeImageBlockBytes(content: unknown): Buffer | null {
  if (!content || typeof content !== 'object') return null;
  const raw = (content as { dataBase64?: unknown }).dataBase64;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  // Tolerate a `data:` URI prefix (`data:image/png;base64,...`).
  const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  try {
    const buffer = Buffer.from(base64, 'base64');
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

function drawImage(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as { caption?: string; alt?: string; widthCm?: number };
  ctx.figureCounter.value += 1;
  const captionLabel = `Figure ${ctx.figureCounter.value}`;
  const description = value.caption ? asString(value.caption) : (value.alt ?? 'Image');
  const captionText = `${captionLabel} — ${description}`;
  const citationSuffix = block.sourceRef ? buildCitationSuffix(ctx, block.sourceRef) : '';

  // Real figure embedding: when the image block carries inline bytes,
  // embed the figure (constrained to the usable column width) so the PDF
  // reads as a client-grade deliverable instead of a placeholder line.
  const imageBytes = decodeImageBlockBytes(block.content);
  if (imageBytes) {
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let targetWidth = Math.min(usableWidth, 480);
    if (typeof value.widthCm === 'number' && value.widthCm > 0) {
      targetWidth = Math.min(value.widthCm * POINTS_PER_CM, usableWidth);
    }
    // Preserve aspect ratio; cap the figure height so a tall image never
    // overruns a page in a single shot.
    let targetHeight = targetWidth;
    try {
      const size = imageSize(imageBytes);
      if (typeof size.width === 'number' && size.width > 0 && typeof size.height === 'number') {
        targetHeight = (targetWidth * size.height) / size.width;
      }
    } catch {
      targetHeight = targetWidth;
    }
    targetHeight = Math.min(targetHeight, 360);
    try {
      doc.image(imageBytes, {
        fit: [targetWidth, targetHeight],
        align: 'center',
        valign: 'center',
      });
      doc.moveDown(0.2);
      doc
        .fontSize(ctx.sizing.caption)
        .fillColor('#64748B')
        .font(PDF_FONT.italic)
        .text(`${captionText}${citationSuffix}`, { align: 'center' });
      doc.font(PDF_FONT.regular).fillColor('#0F172A');
      doc.moveDown(0.4);
      return;
    } catch {
      // Bad PNG/JPEG byte sequence → fall through to the placeholder so
      // the document keeps rendering.
    }
  }

  doc
    .fontSize(ctx.sizing.caption)
    .fillColor('#64748B')
    .font(PDF_FONT.italic)
    .text(`[${captionLabel} placeholder — no image asset attached]`);
  doc.text(`${captionText}${citationSuffix}`);
  doc.font(PDF_FONT.regular).fillColor('#0F172A');
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
    // A4 — chart fell through to a text placeholder (no PNG). Record the
    // degradation; rendering is unchanged.
    ctx.warnings?.record({
      code: 'chart_raster_failed',
      scope: 'block',
      blockId: block.blockId,
      message: `Chart "${titleText}" could not be rasterized; a text placeholder was inserted (${kindText} chart, ${seriesText}, ${valuesText}).`,
    });
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#64748B')
      .font(PDF_FONT.italic)
      .text(
        `[${captionLabel} chart placeholder — ${kindText} chart, ${seriesText}, ${valuesText}; rasterization fallback]`
      );
  }
  doc.text(`${captionLabel} — ${titleText}${citationSuffix}`);
  const content = documentChartBlockContent(block);
  if (content?.caption && content.caption.trim().length > 0) {
    doc.text(content.caption.trim());
  }
  doc.font(PDF_FONT.regular);
  doc.moveDown(0.4);
}

/**
 * KPI strip → a row of shaded metric cards (label / value / delta).
 * Consumes the premium content-gen shape `{ items: [{label, value, delta}] }`.
 * Falls back to a table render for legacy schema shapes, or a placeholder line.
 */
function drawKpiStrip(doc: PDFKit.PDFDocument, block: DocumentBlock, ctx: PdfRenderContext): void {
  const value = (block.content ?? {}) as KpiStripContent;
  const items = Array.isArray(value.items) ? value.items : [];
  if (items.length === 0) {
    const legacy = (block.content ?? {}) as BlockTableContent;
    if ((legacy.headers?.length ?? 0) > 0 || (legacy.rows?.length ?? 0) > 0) {
      drawTable(doc, block, ctx);
      return;
    }
    doc
      .fontSize(ctx.sizing.caption)
      .fillColor('#64748B')
      .font(PDF_FONT.italic)
      .text('[KPI strip placeholder — no metrics provided.]');
    doc.font(PDF_FONT.regular).fillColor('#0F172A');
    doc.moveDown(0.4);
    return;
  }
  const count = items.length;
  const gap = 8;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardW = (usableWidth - gap * (count - 1)) / count;
  const cardH = 56;
  const top = doc.y;
  if (top + cardH > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  const cardTop = doc.y;
  items.forEach((item, i) => {
    const x = doc.page.margins.left + i * (cardW + gap);
    doc.save().roundedRect(x, cardTop, cardW, cardH, 4).fill('#F1F5F9').restore();
    const label = asString(item?.label ?? '');
    const metricValue = asString(item?.value ?? '');
    const delta = asString(item?.delta ?? '').trim();
    doc
      .fontSize(ctx.sizing.footnote)
      .fillColor('#64748B')
      .font(PDF_FONT.regular)
      .text(label, x + 6, cardTop + 6, { width: cardW - 12, height: 14, ellipsis: true });
    doc
      .fontSize(ctx.sizing.heading2)
      .fillColor('#0F172A')
      .font(PDF_FONT.bold)
      .text(metricValue, x + 6, cardTop + 20, { width: cardW - 12 });
    if (delta && delta !== '0') {
      let deltaColor = '#64748B';
      if (/[▲]|^\+|up/i.test(delta)) deltaColor = '#16A34A';
      else if (/[▼]|^−|^-/.test(delta)) deltaColor = '#DC2626';
      doc
        .fontSize(ctx.sizing.footnote)
        .fillColor(deltaColor)
        .font(PDF_FONT.regular)
        .text(delta, x + 6, cardTop + 40, { width: cardW - 12, ellipsis: true });
    }
  });
  doc.y = cardTop + cardH;
  doc.x = doc.page.margins.left;
  doc.fillColor('#0F172A').font(PDF_FONT.regular);
  doc.moveDown(0.5);
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
  doc.fontSize(ctx.sizing.body).fillColor('#64748B').font(PDF_FONT.italic).text(`Note ^${id}`);
  doc.font(PDF_FONT.regular);
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
      drawTable(doc, block, ctx);
      return;
    case 'kpi_strip':
      drawKpiStrip(doc, block, ctx);
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
      .font(PDF_FONT.italic)
      .text(section.purpose);
    doc.font(PDF_FONT.regular);
    doc.moveDown(0.3);
  }
  for (const block of section.blocks) drawBlock(doc, block, ctx);
}

function drawNotesAppendix(doc: PDFKit.PDFDocument, ctx: PdfRenderContext): void {
  if (ctx.footnoteBodies.length === 0) return;
  drawHeading(doc, 'Notes', 1, ctx);
  doc.fontSize(ctx.sizing.footnote).fillColor('#475569').font(PDF_FONT.regular);
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
      .font(PDF_FONT.italic)
      .text(
        'No sources attached. Substantive content blocks are flagged as assumptions and require a source pack before client distribution.'
      );
    doc.font(PDF_FONT.regular);
    return;
  }
  doc.fontSize(ctx.sizing.body).fillColor('#0F172A').font(PDF_FONT.regular);
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
      .font(PDF_FONT.regular)
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
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    try {
      if (formatting.footers.confidentialityLabel) {
        doc
          .save()
          .fontSize(8)
          .fillColor('#94A3B8')
          .font(PDF_FONT.regular)
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
          .font(PDF_FONT.regular)
          .text(numberingText, margins.left, footerY, {
            align: 'right',
            width: doc.page.width - margins.left - margins.right,
          })
          .restore();
      }
    } finally {
      doc.page.margins.bottom = originalBottomMargin;
    }
  }
}

export async function renderDocumentSchemaToPdfBuffer(
  schemaInput: DocumentSchema,
  options: DocumentPdfRenderOptions = {}
): Promise<Buffer> {
  // Render-time prune of data-less visual shells (empty tables / charts) so a
  // generated export never carries a "[… placeholder …]" line. Mirrors the DOCX
  // renderer so both formats stay structurally identical.
  const schema = pruneUnrenderableBlocks(schemaInput);
  const formatting = schema.formattingSchema;
  const margins = marginsInPoints(formatting);
  const chartPngByBlockId = await buildChartPngByBlockId(schema);
  const ctx = buildPdfRenderContext(schema, chartPngByBlockId, options.warnings);
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
      // DEC-132/133: default pdfkit Helvetica has no Polish diacritics.
      registerPdfFonts(doc);
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
