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
import { imageSize } from 'image-size';

import { renderChartBlockToPng } from './documentChartRasterizer.js';
import {
  formatAppendixHeading,
  formatBodyHeading,
  partitionSections,
  pruneUnrenderableBlocks,
} from './documentDocxStructure.js';
import {
  buildDocxStyleConfig,
  clampHeadingText,
  clampTableColumns,
  DOCX_PALETTE,
  DOCX_STYLE_IDS,
  DOCX_TITLE_MAX_CHARS,
  DOCX_TONE_COLOR,
  DOCX_TONE_FILL,
  resolveDocxFonts,
  resolveFormattingClass,
} from './documentDocxStyles.js';
import type { DocumentGenerationWarningCollector } from './documentGenerationWarnings.js';
import {
  type DocumentAsset,
  type DocumentBlock,
  documentChartBlockContent,
  type DocumentSchema,
  type DocumentSection,
  summarizeDocumentChartBlock,
} from './documentStudioTypes.js';

/**
 * Optional render-time inputs that the orchestrator (export pipeline)
 * resolves and passes to the renderer. Pure renderer; no I/O. The
 * orchestrator handles asset resolution + tenant boundaries.
 *
 * Keeping the renderer pure means callers (tests, export pipeline,
 * future preview surfaces) can drive the renderer with hand-crafted
 * inputs without touching the asset registry.
 */
export interface DocumentRenderOptions {
  /**
   * Slice E15.5.coverPageLogo — when present AND the schema enables
   * `formattingSchema.coverPageDetailed.includeLogo`, the renderer
   * embeds this asset above the cover-page title. When absent OR the
   * include flag is false, the cover renders without a logo (legacy
   * behaviour).
   */
  coverLogoAsset?: Pick<DocumentAsset, 'mimeType' | 'dataBase64'> & {
    /** Embed width in centimetres. Default 4cm. */
    widthCm?: number;
  };
  /**
   * A4 — optional generation-warnings collector. When provided, the
   * renderer records `chart_raster_failed` for any chart that fell
   * through to the typographic placeholder, and `logo_unavailable` when
   * the schema asked for a cover-page logo but no asset bytes reached the
   * renderer. Passing `undefined` is the legacy behaviour (no recording).
   * The renderer stays pure and never throws on recording.
   */
  warnings?: DocumentGenerationWarningCollector;
}

interface DocxRuntime {
  AlignmentType: { CENTER: unknown; LEFT: unknown; RIGHT: unknown };
  Document: new (options: Record<string, unknown>) => unknown;
  Footer: new (options: Record<string, unknown>) => unknown;
  FootnoteReferenceRun: new (id: number) => DocxTextRun;
  Header: new (options: Record<string, unknown>) => unknown;
  HeadingLevel: { HEADING_1: unknown; HEADING_2: unknown; HEADING_3: unknown };
  ImageRun: new (options: Record<string, unknown>) => DocxTextRun;
  LevelFormat: { BULLET: unknown; DECIMAL: unknown };
  PageBreak: new () => DocxTextRun;
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
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = docxModule as unknown as DocxRuntime;

/**
 * G7 fix — real Word list outline (not manual `• ` / `1. ` text prefixes).
 *
 * `docx` requires every numbered/bulleted paragraph to reference a
 * `numbering.config[].reference` id declared on the `Document` itself
 * (`Document({ numbering: { config: [...] } })`). We declare exactly two
 * single-level abstract numbering definitions up front — one bullet, one
 * decimal — and every list paragraph in the document (regardless of which
 * section/block emitted it) references the matching one via
 * `numbering: { reference, level: 0 }`. Word then renders these as true
 * "List Paragraph" items: editable numbering, correct outline semantics,
 * `<w:numPr>` in `document.xml`, and a real `numbering.xml` part — exactly
 * what rubric dimension G7 checks for.
 *
 * The content model (`BlockListContent.items: string[]`) is flat — no
 * nested/sub-list levels are authored anywhere upstream — so a single
 * level (0) per reference is sufficient. If nested lists are introduced
 * later, add more `levels` entries to each config and thread a `level`
 * argument through `renderListBlocks`.
 */
const DOCX_NUMBERING_REFERENCE = Object.freeze({
  BULLET: 'docStudioBulletList',
  DECIMAL: 'docStudioNumberedList',
} as const);

/** Passed as `numbering.config` to the `Document` constructor (see above). */
const DOCX_NUMBERING_CONFIG = [
  {
    reference: DOCX_NUMBERING_REFERENCE.BULLET,
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: 720, hanging: 360 } },
        },
      },
    ],
  },
  {
    reference: DOCX_NUMBERING_REFERENCE.DECIMAL,
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: 720, hanging: 360 } },
        },
      },
    ],
  },
];

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

/**
 * Premium content-gen table shape (documentBlockContentGenerator
 * `normalizeTableContent`): `{ rows: [{ cells: { colKey: { value, style?:
 * { bgColor } } } }] }`. Distinct from the legacy `BlockTableContent`
 * (`{ headers: [], rows: [][] }`). The renderer accepts BOTH so a table
 * authored by either path renders with real `<w:tbl>` cells.
 */
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

/**
 * Render-context the renderer threads through every block helper. Holds
 * the resolved formatting class + fonts plus the mutable registries
 * Slice 8.3 needs (caption counters, footnote bodies, source-ref
 * indices). Single-pass rendering accumulates state into these
 * registries; the final {@link Document} constructor consumes the
 * footnote registry once every block has emitted.
 */
interface RenderContext {
  schema: DocumentSchema;
  bodyFont: string;
  headingFont: string;
  citationStyle: 'inline_marker' | 'footnote' | 'endnote';
  /** Auto-incremented per `table` / `risk_table` / `kpi_strip` block. */
  tableCounter: { value: number };
  /** Auto-incremented per `image` block (captions render as "Figure N"). */
  figureCounter: { value: number };
  /** Footnote ids start at 1 and grow monotonically. */
  nextFootnoteId: { value: number };
  /** id → ordered paragraphs that constitute the footnote body. */
  footnotes: Map<number, DocxParagraph[]>;
  /** Stable 1-based marker index per source ref (`{type}::{id}`). */
  sourceRefIndex: Map<string, number>;
  /** Optional chart raster bytes keyed by `blockId`. */
  chartPngByBlockId: Map<string, Buffer>;
  /** A4 — optional generation-warnings collector (chart / logo fallbacks). */
  warnings?: DocumentGenerationWarningCollector;
}

function buildRenderContext(
  schema: DocumentSchema,
  chartPngByBlockId: Map<string, Buffer>,
  warnings?: DocumentGenerationWarningCollector
): RenderContext {
  const formattingClass = resolveFormattingClass(schema);
  const fonts = resolveDocxFonts(schema, formattingClass);
  const sourceRefIndex = new Map<string, number>();
  schema.sourceRefs.forEach((ref, idx) => {
    sourceRefIndex.set(`${ref.sourceType}::${ref.sourceId}`, idx + 1);
  });
  return {
    schema,
    bodyFont: fonts.body,
    headingFont: fonts.heading,
    citationStyle: schema.formattingSchema.citationStyle,
    tableCounter: { value: 0 },
    figureCounter: { value: 0 },
    nextFootnoteId: { value: 1 },
    footnotes: new Map(),
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
      // Fail-soft per-blok: błąd rasteryzacji (np. brak natywnej binarki canvas)
      // NIE może położyć całego renderu dokumentu — slajd spada na placeholder.
      try {
        const png = await renderChartBlockToPng(block);
        if (png && png.length > 0) {
          out.set(block.blockId, png);
        }
      } catch {
        /* pomiń wykres — renderChartBlock użyje placeholdera */
      }
    }
  }
  return out;
}

/**
 * Register a footnote body and return the assigned id. Word + the
 * `docx` package treat ids 0 and 1 as reserved for separator runs,
 * so we start at 2 to be safe across docx releases.
 */
function registerFootnote(ctx: RenderContext, paragraphs: DocxParagraph[]): number {
  // Bump past the docx-reserved ids before the first allocation. The
  // bump happens here (not at ctx init) so the test surface stays
  // tolerant if a future docx version stops reserving ids.
  if (ctx.nextFootnoteId.value < 2) ctx.nextFootnoteId.value = 2;
  const id = ctx.nextFootnoteId.value;
  ctx.nextFootnoteId.value += 1;
  ctx.footnotes.set(id, paragraphs);
  return id;
}

/**
 * Build the lookup key for a source ref so duplicate refs across
 * blocks share a single citation index.
 */
function sourceRefKey(ref: { sourceType: string; sourceId: string }): string {
  return `${ref.sourceType}::${ref.sourceId}`;
}

/**
 * Resolve (or assign) the 1-based citation index for a source ref.
 * Refs that were not in `schema.sourceRefs` get appended to the
 * registry on the fly so the rendered marker is still meaningful.
 */
function citationIndexFor(
  ctx: RenderContext,
  ref: { sourceType: string; sourceId: string }
): number {
  const key = sourceRefKey(ref);
  const existing = ctx.sourceRefIndex.get(key);
  if (typeof existing === 'number') return existing;
  const next = ctx.sourceRefIndex.size + 1;
  ctx.sourceRefIndex.set(key, next);
  return next;
}

/**
 * Pretty-print a source ref into the footnote / endnote body text.
 */
function describeSourceRef(ref: {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
}): string {
  const title = ref.sourceTitle ? ` — ${ref.sourceTitle}` : '';
  return `Source: ${ref.sourceType}#${ref.sourceId}${title}`;
}

/**
 * Build a citation marker run for a block whose `sourceRef` is set.
 * Returns either a TextRun (for inline_marker) or a FootnoteReferenceRun
 * (for footnote / endnote — folded into footnote semantics for MVP-4
 * since Word renders them functionally identically).
 */
function buildCitationRuns(
  ctx: RenderContext,
  ref: { sourceType: string; sourceId: string; sourceTitle?: string }
): DocxTextRun[] {
  if (ctx.citationStyle === 'inline_marker') {
    const idx = citationIndexFor(ctx, ref);
    return [new TextRun({ text: ` [${idx}]`, font: ctx.bodyFont })];
  }
  // 'footnote' + 'endnote' both render via Word footnotes; endnotes
  // are folded into footnotes for MVP-4 because the docx package
  // surfaces both with the same FootnoteReferenceRun primitive and
  // Word's print layout collapses the visual difference.
  const id = registerFootnote(ctx, [
    new Paragraph({
      style: DOCX_STYLE_IDS.FOOTNOTE_TEXT,
      children: [new TextRun({ text: describeSourceRef(ref), font: ctx.bodyFont })],
    }),
  ]);
  return [new FootnoteReferenceRun(id)];
}

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const named: Record<string, string> = {
      amp: '&',
      apos: "'",
      gt: '>',
      lt: '<',
      nbsp: '\u00a0',
      quot: '"',
    };
    let decoded = value;
    // A bounded loop also handles upstream strings encoded more than once
    // (`&amp;quot;`) without risking unbounded replacement work.
    for (let pass = 0; pass < 4; pass += 1) {
      const next = decoded.replace(
        /&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]+));/gi,
        (
          entity,
          decimal: string | undefined,
          hex: string | undefined,
          name: string | undefined
        ) => {
          if (name) return named[name.toLowerCase()] ?? entity;
          const codePoint = Number.parseInt(decimal ?? hex ?? '', hex ? 16 : 10);
          if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
          try {
            return String.fromCodePoint(codePoint);
          } catch {
            return entity;
          }
        }
      );
      if (next === decoded) break;
      decoded = next;
    }
    return decoded;
  }
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
    color: DOCX_PALETTE.amberInk,
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
  // Overflow guard — a runaway "heading" (mis-classified paragraph) is
  // truncated at a word boundary so the outline / TOC entry stays one line.
  const text = clampHeadingText(asString(value.text ?? ''));
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
  if (block.sourceRef) children.push(...buildCitationRuns(ctx, block.sourceRef));
  return new Paragraph({
    style: block.isAssumption ? DOCX_STYLE_IDS.ASSUMPTION_BODY : DOCX_STYLE_IDS.BODY_TEXT,
    children,
  });
}

function renderListBlocks(block: DocumentBlock, ctx: RenderContext): Paragraph[] {
  const value = (block.content ?? {}) as BlockListContent;
  const items = Array.isArray(value.items) ? value.items : [];
  const numbered = value.style === 'numbered' || block.type === 'numbered_list';
  const numberingReference = numbered
    ? DOCX_NUMBERING_REFERENCE.DECIMAL
    : DOCX_NUMBERING_REFERENCE.BULLET;
  return items.map((raw, index) => {
    const itemText = asString(raw);
    // G7 fix: no manual "• " / "N. " text prefix — the bullet/number glyph
    // comes from the `numbering` reference below, which Word renders as a
    // real, editable list marker (`<w:numPr>`), not literal characters.
    const children: TextRun[] = [new TextRun({ text: itemText, font: ctx.bodyFont })];
    if (block.isAssumption && index === items.length - 1) {
      children.push(buildAssumptionMarker(ctx.bodyFont));
    }
    return new Paragraph({
      style: DOCX_STYLE_IDS.BODY_TEXT,
      numbering: { reference: numberingReference, level: 0 },
      children,
      spacing: { after: 60 },
    });
  });
}

/** Normalize a CSS hex (`#RRGGBB` / `RRGGBB`) to bare 6-digit uppercase, or null. */
function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(clean) ? clean.toUpperCase() : null;
}

/** Perceived-luminance test so dark status fills get white text. */
function isDarkFill(hex: string): boolean {
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

/**
 * Map a callout marker (premium `tone`, legacy `variant`) to a doctrine tone
 * key. Legacy variants (`key_message`, `insight`, …) fall back to `info` (navy)
 * so an untoned callout still reads as a deliberate navy device rather than the
 * old off-palette indigo.
 */
function calloutToneKey(marker: string | undefined): keyof typeof DOCX_TONE_COLOR {
  const m = String(marker ?? '').toLowerCase();
  if (m === 'success' || m === 'positive') return 'success';
  if (m === 'warning' || m === 'caution') return 'warning';
  if (m === 'danger' || m === 'critical' || m === 'risk') return 'danger';
  return 'info';
}

function renderCalloutBlock(block: DocumentBlock, ctx: RenderContext): Paragraph {
  const value = (block.content ?? {}) as BlockCalloutContent;
  const text = asString(value.text ?? '');
  // Premium content-gen emits `tone`; legacy schema emits `variant`. Resolve to
  // a doctrine tone so the accent spine + soft tint match DeckStyler/WorkbookStyler.
  const toneKey = calloutToneKey(value.tone ?? value.variant);
  const accent = DOCX_TONE_COLOR[toneKey];
  const fill = DOCX_TONE_FILL[toneKey];
  // Callout wyróżnia się STYLEM (akcentowy pasek + tło + kursywa), nie brzydkim
  // tagiem „[INFO]" w środku prozy — tag był nieprofesjonalny w dokumencie
  // konsultanta. Kolor paska/tła nadpisuje domyślny teal ze stylu nazwanego,
  // więc np. callout „danger" dostaje malinowy pasek na różowym tle.
  return new Paragraph({
    style: DOCX_STYLE_IDS.CALLOUT,
    shading: { type: 'clear', fill },
    border: { left: { color: accent, space: 12, style: 'single', size: 24 } },
    children: [new TextRun({ text, italics: true, bold: true, color: accent, font: ctx.bodyFont })],
  });
}

/**
 * KPI strip → a single-row table of metric cells (label / value / delta),
 * each cell lightly shaded so it reads as a metric card rather than plain
 * text. Consumes the premium content-gen shape `{ items: [{label, value,
 * delta}] }`. Empty / malformed items degrade to a caption placeholder.
 */
function renderKpiStripBlock(block: DocumentBlock, ctx: RenderContext): (Table | Paragraph)[] {
  const value = (block.content ?? {}) as KpiStripContent;
  const items = Array.isArray(value.items) ? value.items : [];
  if (items.length === 0) {
    // Legacy schema may have used the table shape for a "kpi_strip" — try that
    // before giving up so older schemas keep rendering.
    const legacy = (block.content ?? {}) as BlockTableContent;
    if ((legacy.headers?.length ?? 0) > 0 || (legacy.rows?.length ?? 0) > 0) {
      return renderTableBlock(block, ctx);
    }
    return [
      new Paragraph({
        style: DOCX_STYLE_IDS.CAPTION,
        children: [
          new TextRun({
            text: '[KPI strip placeholder — no metrics provided.]',
            font: ctx.bodyFont,
          }),
        ],
      }),
    ];
  }
  const cells = items.map((item) => {
    const label = asString(item?.label ?? '');
    const metricValue = asString(item?.value ?? '');
    const delta = asString(item?.delta ?? '').trim();
    // Colour the delta by direction marker (▲ up / ▼ down / + / −) so the
    // strip reads at a glance. Falls back to neutral slate.
    let deltaColor: string = DOCX_PALETTE.muted;
    if (/[▲]|^\+|\bvs\b.*\+|up/i.test(delta)) deltaColor = DOCX_TONE_COLOR.success;
    else if (/[▼]|^−|^-/.test(delta)) deltaColor = DOCX_TONE_COLOR.danger;
    const cellChildren: DocxParagraph[] = [
      new Paragraph({
        style: DOCX_STYLE_IDS.CAPTION,
        children: [
          new TextRun({ text: label, font: ctx.bodyFont, size: 16, color: DOCX_PALETTE.muted }),
        ],
      }),
      new Paragraph({
        style: DOCX_STYLE_IDS.BODY_TEXT,
        children: [
          new TextRun({
            text: metricValue,
            bold: true,
            font: ctx.headingFont,
            size: 28,
            color: DOCX_PALETTE.navy,
          }),
        ],
      }),
    ];
    if (delta.length > 0 && delta !== '0') {
      cellChildren.push(
        new Paragraph({
          style: DOCX_STYLE_IDS.CAPTION,
          children: [new TextRun({ text: delta, font: ctx.bodyFont, size: 16, color: deltaColor })],
        })
      );
    }
    return new TableCell({
      shading: { fill: DOCX_PALETTE.kpiFill },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: cellChildren,
    });
  });
  ctx.tableCounter.value += 1;
  const rows: unknown[] = [];
  // Keep metric cards readable on A4. More than three cards wrap onto the
  // next table row instead of shrinking every card into an unusable sliver.
  for (let offset = 0; offset < cells.length; offset += 3) {
    rows.push(new TableRow({ children: cells.slice(offset, offset + 3) }));
  }
  const table = new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  return [table];
}

function renderQuoteBlock(block: DocumentBlock, ctx: RenderContext): Paragraph {
  const value = (block.content ?? {}) as BlockTextContent & { attribution?: string };
  const text = asString(value.text ?? '');
  const attribution = value.attribution ? ` — ${asString(value.attribution)}` : '';
  const children: TextRun[] = [
    new TextRun({
      text: `“${text}”${attribution}`,
      font: ctx.bodyFont,
    }),
  ];
  if (block.sourceRef) children.push(...buildCitationRuns(ctx, block.sourceRef));
  return new Paragraph({
    style: DOCX_STYLE_IDS.BLOCK_QUOTE,
    children,
  });
}

/**
 * Project a table block's content into a uniform `{ headers, rows }` where
 * each cell carries optional shading. Accepts BOTH the legacy schema shape
 * (`{ headers: [], rows: [][] }`) and the premium content-gen keyed shape
 * (`{ rows: [{ cells: { colKey: { value, style?: { bgColor } } } }] }`).
 */
interface NormalizedCell {
  text: string;
  fill: string | null;
}
function normalizeTableContent(content: unknown): {
  headers: string[];
  rows: NormalizedCell[][];
} {
  const value = (content ?? {}) as BlockTableContent & { rows?: unknown };
  const rawRows = Array.isArray(value.rows) ? (value.rows as unknown[]) : [];
  // Keyed shape: rows are objects carrying a `cells` map (or a flat object).
  const isKeyed = rawRows.some((r) => r != null && typeof r === 'object' && !Array.isArray(r));
  if (isKeyed) {
    // Derive a stable, ordered column key list from the union of all cell keys.
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
    const rows: NormalizedCell[][] = rawRows.map((row) => {
      const keyed = row as KeyedTableRow;
      const cells = (keyed?.cells && typeof keyed.cells === 'object' ? keyed.cells : row) as Record<
        string,
        unknown
      >;
      return columnKeys.map((key) => {
        const cell = cells?.[key];
        if (cell != null && typeof cell === 'object' && 'value' in (cell as object)) {
          const c = cell as { value?: unknown; style?: { bgColor?: string } };
          return { text: asString(c.value ?? ''), fill: normalizeHex(c.style?.bgColor) };
        }
        return { text: asString(cell ?? ''), fill: null };
      });
    });
    // Humanize camelCase / snake_case column keys for the header row.
    const headers = columnKeys.map((k) =>
      k
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^\w/, (m) => m.toUpperCase())
    );
    return { headers, rows };
  }
  // Legacy array-of-arrays shape.
  const headers = Array.isArray(value.headers) ? value.headers.map((h) => asString(h)) : [];
  const rows: NormalizedCell[][] = rawRows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => ({ text: asString(cell), fill: null }))
  );
  return { headers, rows };
}

function renderTableBlock(block: DocumentBlock, ctx: RenderContext): (Table | Paragraph)[] {
  const value = (block.content ?? {}) as { caption?: string };
  const normalized = normalizeTableContent(block.content);
  let { headers, rows } = normalized;

  if (headers.length === 0 && rows.length === 0) {
    return [
      new Paragraph({
        style: DOCX_STYLE_IDS.CAPTION,
        children: [
          new TextRun({
            text: '[Table placeholder — populate with structured data once sources are attached.]',
            font: ctx.bodyFont,
          }),
        ],
      }),
    ];
  }

  // Overflow guard — a table wider than A4 can legibly show collapses every
  // cell to a sliver. Keep the leading columns and fold the remainder into a
  // single "+N more" column (DeckStyler/WorkbookStyler width-clamp analogue).
  const columnCount = Math.max(headers.length, ...rows.map((r) => r.length), 0);
  const clamp = clampTableColumns(columnCount);
  if (clamp.overflowed) {
    const foldLabel = `+${clamp.folded.length} more`;
    const pick = <T>(arr: T[], fallback: T): T[] => clamp.keep.map((i) => arr[i] ?? fallback);
    if (headers.length > 0) {
      headers = [...pick(headers, ''), foldLabel];
    }
    rows = rows.map((row) => {
      const kept = pick(row, { text: '', fill: null });
      const foldedText = clamp.folded
        .map((i) => row[i]?.text ?? '')
        .filter((t) => t.length > 0)
        .join(' · ');
      return [...kept, { text: foldedText, fill: null }];
    });
  }

  const tableRows: unknown[] = [];
  if (headers.length > 0) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (cell) =>
            // Navy header band + white bold text — the DOCX analogue of
            // WorkbookStyler's navy header fill and DeckStyler's dominant band.
            new TableCell({
              shading: { fill: DOCX_PALETTE.navy },
              children: [
                new Paragraph({
                  style: DOCX_STYLE_IDS.BODY_TEXT,
                  children: [
                    new TextRun({
                      text: cell,
                      bold: true,
                      font: ctx.bodyFont,
                      size: 20,
                      color: DOCX_PALETTE.white,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    );
  }
  rows.forEach((row, rowIndex) => {
    // Subtle zebra striping on odd body rows (WorkbookStyler zebra analogue).
    // An explicit per-cell fill (status semaphore etc.) always wins.
    const zebra = rowIndex % 2 === 1;
    tableRows.push(
      new TableRow({
        children: row.map((cell) => {
          const fill = cell.fill ?? (zebra ? DOCX_PALETTE.zebraFill : null);
          return new TableCell({
            ...(fill ? { shading: { fill } } : {}),
            children: [
              new Paragraph({
                style: DOCX_STYLE_IDS.BODY_TEXT,
                children: [
                  new TextRun({
                    text: cell.text,
                    font: ctx.bodyFont,
                    size: 20,
                    // White text on dark status fills keeps it legible.
                    ...(cell.fill && isDarkFill(cell.fill)
                      ? { color: DOCX_PALETTE.white, bold: true }
                      : {}),
                  }),
                ],
              }),
            ],
          });
        }),
      })
    );
  });

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Auto-numbered caption — emitted after the table so Word's "Update
  // captions" command and screen-reader navigation pick it up. The
  // counter increments per renderer invocation so two tables in the
  // same document end up "Table 1" / "Table 2" regardless of section.
  ctx.tableCounter.value += 1;
  const captionLabel = `Table ${ctx.tableCounter.value}`;
  const captionText = value.caption ? `${captionLabel} — ${asString(value.caption)}` : captionLabel;
  const captionChildren: TextRun[] = [new TextRun({ text: captionText, font: ctx.bodyFont })];
  if (block.sourceRef) captionChildren.push(...buildCitationRuns(ctx, block.sourceRef));
  const caption = new Paragraph({
    style: DOCX_STYLE_IDS.CAPTION,
    children: captionChildren,
  });

  return [table, caption];
}

function renderImageBlock(block: DocumentBlock, ctx: RenderContext): Paragraph[] {
  const value = (block.content ?? {}) as {
    caption?: string;
    alt?: string;
    dataBase64?: string;
    mimeType?: string;
    widthCm?: number;
  };
  ctx.figureCounter.value += 1;
  const captionLabel = `Figure ${ctx.figureCounter.value}`;
  const description = value.caption ? asString(value.caption) : (value.alt ?? 'Image');
  const captionText = `${captionLabel} — ${description}`;
  const raw = typeof value.dataBase64 === 'string' ? value.dataBase64 : '';
  const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  let buffer: Buffer | null = null;
  try {
    if (base64) buffer = Buffer.from(base64, 'base64');
  } catch {
    buffer = null;
  }
  let visual: Paragraph;
  if (buffer?.length && (value.mimeType === 'image/png' || value.mimeType === 'image/jpeg')) {
    const widthPx = Math.round(Math.min(Math.max(value.widthCm ?? 15, 2), 16) * 37.7953);
    let heightPx = Math.round(widthPx * 0.625);
    try {
      const size = imageSize(buffer);
      if (size.width && size.height) heightPx = Math.round((widthPx * size.height) / size.width);
    } catch {
      // Preserve the safe 16:10 fallback when dimensions cannot be decoded.
    }
    visual = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: buffer,
          transformation: { width: widthPx, height: Math.min(heightPx, 520) },
          type: value.mimeType === 'image/png' ? 'png' : 'jpg',
        }),
      ],
    });
  } else {
    visual = new Paragraph({
      style: DOCX_STYLE_IDS.CAPTION,
      children: [
        new TextRun({
          text: `[${captionLabel} placeholder — image bytes unavailable]`,
          font: ctx.bodyFont,
        }),
      ],
    });
  }
  const captionChildren: TextRun[] = [new TextRun({ text: captionText, font: ctx.bodyFont })];
  if (block.sourceRef) captionChildren.push(...buildCitationRuns(ctx, block.sourceRef));
  const caption = new Paragraph({
    style: DOCX_STYLE_IDS.CAPTION,
    children: captionChildren,
  });
  return [visual, caption];
}

function renderChartBlock(block: DocumentBlock, ctx: RenderContext): Paragraph[] {
  ctx.figureCounter.value += 1;
  const captionLabel = `Figure ${ctx.figureCounter.value}`;
  const summary = summarizeDocumentChartBlock(block);
  const titleText = summary.title ?? '(untitled chart)';
  const chartImage = ctx.chartPngByBlockId.get(block.blockId);
  const visualParagraph = chartImage
    ? new Paragraph({
        style: DOCX_STYLE_IDS.CAPTION,
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: chartImage,
            transformation: { width: 640, height: 360 },
            type: 'png',
          }),
        ],
      })
    : (() => {
        const kindText = summary.kind ?? 'unknown';
        const seriesText = summary.seriesCount === 1 ? '1 series' : `${summary.seriesCount} series`;
        const valuesText =
          summary.totalValueCount === 1 ? '1 value' : `${summary.totalValueCount} values`;
        // A4 — the chart fell through to a typographic placeholder because
        // rasterization produced no PNG. Record it so the export surfaces a
        // "generated with limitations" warning. Rendering behaviour is
        // unchanged: the placeholder paragraph is still returned.
        ctx.warnings?.record({
          code: 'chart_raster_failed',
          scope: 'block',
          blockId: block.blockId,
          message: `Chart "${titleText}" could not be rasterized; a text placeholder was inserted (${kindText} chart, ${seriesText}, ${valuesText}).`,
        });
        return new Paragraph({
          style: DOCX_STYLE_IDS.CAPTION,
          children: [
            new TextRun({
              text: `[${captionLabel} chart placeholder — ${kindText} chart, ${seriesText}, ${valuesText}; rasterization fallback]`,
              font: ctx.bodyFont,
            }),
          ],
        });
      })();
  const captionText = `${captionLabel} — ${titleText}`;
  const captionChildren: TextRun[] = [new TextRun({ text: captionText, font: ctx.bodyFont })];
  if (block.sourceRef) captionChildren.push(...buildCitationRuns(ctx, block.sourceRef));
  const caption = new Paragraph({
    style: DOCX_STYLE_IDS.CAPTION,
    children: captionChildren,
  });
  // Optional descriptive caption from the schema gets its own
  // paragraph so it is visually distinct from the figure caption.
  const out: Paragraph[] = [visualParagraph, caption];
  const content = documentChartBlockContent(block);
  if (content?.caption && content.caption.trim().length > 0) {
    out.push(
      new Paragraph({
        style: DOCX_STYLE_IDS.CAPTION,
        children: [
          new TextRun({
            text: content.caption.trim(),
            font: ctx.bodyFont,
            italics: true,
          }),
        ],
      })
    );
  }
  return out;
}

function renderFootnoteBlock(block: DocumentBlock, ctx: RenderContext): Paragraph[] {
  const value = (block.content ?? {}) as BlockTextContent;
  const bodyText = asString(value.text ?? '').trim();
  if (bodyText.length === 0) return [];
  const id = registerFootnote(ctx, [
    new Paragraph({
      style: DOCX_STYLE_IDS.FOOTNOTE_TEXT,
      children: [new TextRun({ text: bodyText, font: ctx.bodyFont })],
    }),
  ]);
  // Anchor paragraph: emits the superscript reference so Word's
  // footnote pane links back to a specific spot in the body. We keep
  // a tiny "Note" marker preceding the reference so users skimming
  // the body still see *something* even if Word's footnote pane is
  // collapsed.
  return [
    new Paragraph({
      style: DOCX_STYLE_IDS.BODY_TEXT,
      children: [
        new TextRun({
          text: 'Note ',
          italics: true,
          font: ctx.bodyFont,
          color: DOCX_PALETTE.muted,
        }),
        new FootnoteReferenceRun(id),
      ],
    }),
  ];
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
      return renderTableBlock(block, ctx);
    case 'kpi_strip':
      return renderKpiStripBlock(block, ctx);
    case 'image':
      return renderImageBlock(block, ctx);
    case 'chart':
      return renderChartBlock(block, ctx);
    case 'footnote':
      return renderFootnoteBlock(block, ctx);
    case 'citation':
    default:
      // Fall back to paragraph text rendering for block types not covered by
      // a dedicated renderer (citations are usually attached via
      // `block.sourceRef` on a body block, so a standalone `citation`
      // block degrades gracefully into a paragraph).
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
    // A section heading must travel with at least the first paragraph/table.
    // Without this explicit pagination hint Word/LibreOffice may leave a
    // heading as the last line on a page while its body starts on the next.
    keepNext: true,
  });
  const normalizedPurpose = asString(section.purpose ?? '').trim();
  const normalizedTitle = asString(section.title ?? '').trim();
  // Generated outlines often use the section title verbatim as `purpose`.
  // Rendering both produces an accidental duplicate immediately below the
  // heading (for example "Executive decision" twice). Keep a genuinely
  // descriptive purpose, but suppress title-equivalent metadata.
  const purpose =
    normalizedPurpose &&
    normalizedPurpose.localeCompare(normalizedTitle, undefined, { sensitivity: 'base' }) !== 0
      ? [
          new Paragraph({
            style: DOCX_STYLE_IDS.CAPTION,
            // Chain heading -> purpose -> first body element. Keeping only
            // the heading was insufficient when a purpose line followed it:
            // LibreOffice could still leave both metadata lines at the foot
            // of a page and move the substantive paragraph to the next one.
            keepNext: true,
            children: [
              new TextRun({
                text: normalizedPurpose,
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

function renderCoverBlock(ctx: RenderContext, options: DocumentRenderOptions = {}): Paragraph[] {
  const schema = ctx.schema;
  const isPolish = schema.language.toLowerCase().startsWith('pl');
  const documentTypeLabels: Record<string, string> = {
    steering_committee_report: 'raport komitetu sterującego',
  };
  const densityLabels: Record<string, string> = { detailed: 'szczegółowy', concise: 'zwięzły' };
  const confidentialityLabels: Record<string, string> = {
    client_confidential: 'poufne dla klienta',
    confidential: 'poufne',
    internal: 'wewnętrzne',
    public: 'publiczne',
  };
  const documentTypeLabel = isPolish
    ? (documentTypeLabels[schema.documentType] ?? schema.documentType.replace(/_/g, ' '))
    : schema.documentType.replace(/_/g, ' ');
  const densityLabel = isPolish
    ? (densityLabels[schema.density] ?? schema.density)
    : schema.density;
  const confidentialityLabel = isPolish
    ? (confidentialityLabels[schema.confidentiality] ?? schema.confidentiality)
    : schema.confidentiality;
  // Slice E15.5.formatting.render — when the schema carries the
  // `coverPageDetailed` E15.5 substrate, only render the lines whose
  // `include*` flag is true. Default (no override) keeps the legacy
  // full cover page so existing schemas render unchanged.
  const coverDetailed = schema.formattingSchema.coverPageDetailed;
  const includeStatus = coverDetailed?.includeStatus ?? true;
  const includeConfidentiality = coverDetailed?.includeConfidentiality ?? true;
  // Slice E15.5.coverPageLogo — when both the schema asks for a logo
  // AND the orchestrator hydrated a `coverLogoAsset`, embed an
  // `ImageRun` paragraph above the title. Asset resolution is the
  // export pipeline's concern; the renderer just consumes the bytes.
  const includeLogo = coverDetailed?.includeLogo ?? false;
  const logoParagraph =
    includeLogo && options.coverLogoAsset ? buildCoverLogoParagraph(options.coverLogoAsset) : null;
  // A4 — the schema asked for a cover-page logo but no logo paragraph was
  // produced (asset bytes never reached the renderer, or decoding the
  // bytes failed). Record it so the export flags the missing logo instead
  // of silently rendering a logo-less cover. Behaviour unchanged.
  if (includeLogo && !logoParagraph) {
    ctx.warnings?.record({
      code: 'logo_unavailable',
      scope: 'export',
      message:
        'Cover-page logo was requested but no usable logo asset was available; the cover was rendered without it.',
    });
  }

  // Subtitle composition — strip out parts that the override
  // explicitly disables. Status = `<density> · <type-language>` line;
  // confidentiality = the `· internal/restricted/...` tail.
  const subtitleParts: string[] = [];
  subtitleParts.push(documentTypeLabel);
  subtitleParts.push(schema.language.toUpperCase());
  if (includeStatus) {
    subtitleParts.push(densityLabel);
  }
  if (includeConfidentiality) {
    subtitleParts.push(confidentialityLabel);
  }
  const subtitle = subtitleParts.join(' · ');
  const audience =
    schema.audience.length > 0
      ? schema.audience
          .map((item) => (isPolish && item === 'steering_committee' ? 'komitet sterujący' : item))
          .join(', ')
      : isPolish
        ? 'Wewnętrzne'
        : 'Internal';
  const generatedAt = new Date(schema.updatedAt || schema.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  const out: Paragraph[] = [];
  if (logoParagraph) out.push(logoParagraph);
  out.push(
    ...[
      new Paragraph({
        style: DOCX_STYLE_IDS.TITLE,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            // Overflow guard — a pathologically long title is truncated at a
            // word boundary so the cover stays a clean title block.
            text: clampHeadingText(schema.title, DOCX_TITLE_MAX_CHARS),
            font: ctx.headingFont,
          }),
        ],
      }),
      // Teal accent rule under the title — the DOCX analogue of DeckStyler's
      // cover accent rule. A short centred bottom-bordered paragraph reads as a
      // deliberate rule rather than a line of text.
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        border: { bottom: { color: DOCX_PALETTE.teal, space: 1, style: 'single', size: 18 } },
        children: [new TextRun({ text: '', font: ctx.bodyFont })],
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
            text: `${isPolish ? 'Odbiorcy' : 'Audience'}: ${audience}`,
            font: ctx.bodyFont,
          }),
        ],
      }),
      new Paragraph({
        style: DOCX_STYLE_IDS.SUBTITLE,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${isPolish ? 'Wygenerowano' : 'Generated'}: ${generatedAt}`,
            font: ctx.bodyFont,
          }),
          // Hard page break — keeps the cover on its own page so the
          // TOC (or first body section) starts on page 2 just like a
          // hand-authored consulting deliverable would.
          new PageBreak(),
        ],
      }),
    ]
  );
  return out;
}

/**
 * Slice E15.5.coverPageLogo — DOCX logo paragraph builder. Decodes
 * the base64 asset bytes once, sizes the embed to ~4cm wide (safe
 * default for an A4 cover) preserving the asset's natural aspect
 * ratio when known, and returns a centred paragraph that lives
 * above the title block.
 *
 * Defensive: any decode failure falls back to `null` so a corrupted
 * registry row never crashes the export pipeline. The orchestrator
 * is expected to keep the registry clean; this is a belt-and-braces
 * layer for production safety.
 */
function buildCoverLogoParagraph(
  asset: NonNullable<DocumentRenderOptions['coverLogoAsset']>
): Paragraph | null {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(asset.dataBase64, 'base64');
  } catch {
    return null;
  }
  if (!buffer || buffer.length === 0) return null;
  const widthCm = typeof asset.widthCm === 'number' && asset.widthCm > 0 ? asset.widthCm : 4;
  // 96 dpi conversion: 1cm ≈ 37.7953 px.
  const widthPx = Math.round(widthCm * 37.7953);
  let heightPx = widthPx;
  try {
    const size = imageSize(buffer);
    if (typeof size.width === 'number' && size.width > 0 && typeof size.height === 'number') {
      heightPx = Math.max(1, Math.round((widthPx * size.height) / size.width));
    }
  } catch {
    // Keep width=height fallback when metadata probe fails.
    heightPx = widthPx;
  }
  // Keep cover layout stable for unusually tall logos.
  const clampedHeightPx = Math.min(heightPx, 260);
  return new Paragraph({
    style: DOCX_STYLE_IDS.SUBTITLE,
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        data: buffer,
        transformation: { width: widthPx, height: clampedHeightPx },
        type: asset.mimeType === 'image/png' ? 'png' : 'jpg',
      }),
    ],
  });
}

/**
 * Insert a deterministic static TOC. A Word TOC field is empty until the
 * desktop application updates fields; LibreOffice and server-side PDF
 * conversion commonly leave that field empty, producing a blank TOC page.
 * Static entries keep the export useful on first open and in rendered PDFs.
 * The terminal page break keeps body content on its own page.
 */
function renderTocBlock(ctx: RenderContext): unknown[] {
  const isPolish = ctx.schema.language.toLowerCase().startsWith('pl');
  const heading = new Paragraph({
    style: DOCX_STYLE_IDS.TOC_HEADING,
    children: [
      new TextRun({ text: isPolish ? 'Spis treści' : 'Table of Contents', font: ctx.headingFont }),
    ],
  });
  // Slice E15.5.formatting.render — honor `tocConfig.maxDepth` when
  // the schema carries the E15.5 substrate. Default stays `1-3`
  // (current behavior) so legacy schemas render unchanged.
  const tocMaxDepth = ctx.schema.formattingSchema.tocConfig?.maxDepth ?? 3;
  const partitioned = partitionSections(ctx.schema.sections);
  const entries = [
    ...partitioned.body.map((section, index) => ({
      section,
      text: formatBodyHeading(section, index),
    })),
    ...partitioned.appendix.map((section, index) => ({
      section,
      text: formatAppendixHeading(section, index, ctx.schema.formattingSchema),
    })),
  ]
    .filter(({ section }) => section.level <= tocMaxDepth)
    .map(
      ({ section, text }) =>
        new Paragraph({
          style: DOCX_STYLE_IDS.BODY_TEXT,
          indent: { left: Math.max(0, section.level - 1) * 360 },
          spacing: { after: 80 },
          keepNext: true,
          children: [new TextRun({ text, font: ctx.bodyFont })],
        })
    );
  // A static TOC cannot reliably know page numbers until Word updates fields.
  // Let the first body section follow the concise navigation list instead of
  // forcing a mostly-empty standalone TOC page in server-rendered PDFs.
  const trailingSpacer = new Paragraph({
    style: DOCX_STYLE_IDS.BODY_TEXT,
    spacing: { after: 160 },
    border: { bottom: { color: DOCX_PALETTE.faint, space: 1, style: 'single', size: 4 } },
    children: [new TextRun({ text: '', font: ctx.bodyFont })],
  });
  return [heading, ...entries, trailingSpacer];
}

function renderSources(ctx: RenderContext): (Paragraph | Table)[] {
  const schema = ctx.schema;
  const isPolish = schema.language.toLowerCase().startsWith('pl');
  const heading = new Paragraph({
    style: DOCX_STYLE_IDS.HEADING1,
    heading: HeadingLevel.HEADING_1,
    children: [
      new TextRun({
        text: isPolish ? 'Źródła i identyfikowalność' : 'Sources & traceability',
        font: ctx.headingFont,
      }),
    ],
  });
  if (schema.sourceRefs.length === 0) {
    return [
      heading,
      new Paragraph({
        style: DOCX_STYLE_IDS.ASSUMPTION_BODY,
        children: [
          new TextRun({
            text: isPolish
              ? 'Nie dołączono źródeł. Merytoryczne bloki treści oznaczono jako założenia i przed dystrybucją do klienta wymagają pakietu źródłowego.'
              : 'No sources attached. Substantive content blocks are flagged as assumptions and require a source pack before client distribution.',
            font: ctx.bodyFont,
          }),
        ],
      }),
    ];
  }
  const items = schema.sourceRefs.map((ref, i) => {
    const title = ref.sourceTitle ? ` — ${ref.sourceTitle}` : '';
    const version = ref.sourceVersion ? ` · ${ref.sourceVersion}` : '';
    const snapshot = ref.sourceSnapshotId ? ` · snapshot ${ref.sourceSnapshotId}` : '';
    const excerpt = asString(ref.sourceExcerpt ?? '').trim();
    return new Paragraph({
      style: DOCX_STYLE_IDS.SOURCE_LIST,
      children: [
        new TextRun({ text: `${i + 1}. `, bold: true, font: ctx.bodyFont }),
        new TextRun({
          text: `${ref.sourceType}#${ref.sourceId}${title}${version}${snapshot}`,
          font: ctx.bodyFont,
        }),
        ...(excerpt
          ? [
              new TextRun({
                text: ` — ${excerpt.length > 280 ? `${excerpt.slice(0, 277).trimEnd()}…` : excerpt}`,
                color: DOCX_PALETTE.muted,
                font: ctx.bodyFont,
              }),
            ]
          : []),
      ],
    });
  });
  return [heading, ...items];
}

export async function renderDocumentSchemaToDocxBuffer(
  schemaInput: DocumentSchema,
  options: DocumentRenderOptions = {}
): Promise<Buffer> {
  // Render-time prune of data-less visual shells (empty tables / charts) so a
  // generated export never carries a "[… placeholder …]" line. Does not mutate
  // the stored schema — the editor still shows empty blocks as affordances.
  const schema = pruneUnrenderableBlocks(schemaInput);
  const formatting = schema.formattingSchema;
  const chartPngByBlockId = await buildChartPngByBlockId(schema);
  const ctx = buildRenderContext(schema, chartPngByBlockId, options.warnings);
  const formattingClass = resolveFormattingClass(schema);
  const styles = buildDocxStyleConfig(schema, formattingClass);
  const margins = formatting.page.marginsCm;

  const sectionChildren: unknown[] = [];
  if (formatting.coverPage) sectionChildren.push(...renderCoverBlock(ctx, options));
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

  // Slice E15.5.formatting.render — when `headers.content` is set,
  // it overrides the default `schema.title` header text. Empty / null
  // / undefined falls back to the legacy default. Trimmed before use
  // so accidental whitespace-only overrides don't render an empty
  // header strip.
  const headerOverride = formatting.headers.content?.trim();
  const headerText = headerOverride && headerOverride.length > 0 ? headerOverride : schema.title;
  const headerChildren = headerEnabled
    ? [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: headerText,
              size: 18,
              color: DOCX_PALETTE.muted,
              font: ctx.bodyFont,
            }),
          ],
        }),
      ]
    : [];
  const footerRuns: TextRun[] = [];
  const footerOverride = formatting.footers.content?.trim();
  if (footerOverride) {
    footerRuns.push(
      new TextRun({
        text: footerOverride,
        size: 16,
        color: DOCX_PALETTE.faint,
        font: ctx.bodyFont,
      })
    );
  }
  if (formatting.footers.confidentialityLabel) {
    if (footerRuns.length > 0) {
      footerRuns.push(
        new TextRun({ text: '   |   ', size: 16, color: DOCX_PALETTE.faint, font: ctx.bodyFont })
      );
    }
    const confidentialityLabel = schema.language.toLowerCase().startsWith('pl')
      ? ({
          public: 'publiczne',
          internal: 'wewnętrzne',
          confidential: 'poufne',
          client_confidential: 'poufne — tylko dla klienta',
          restricted: 'zastrzeżone',
        }[schema.confidentiality] ?? schema.confidentiality.replace(/_/g, ' '))
      : schema.confidentiality.replace(/_/g, ' ');
    footerRuns.push(
      new TextRun({
        text: confidentialityLabel,
        size: 16,
        color: DOCX_PALETTE.faint,
        font: ctx.bodyFont,
      })
    );
  }
  if (formatting.footers.pageNumbering) {
    // Slice E15.5.formatting.render — `pageNumberingFormat` honors a
    // template like `"Strona {N} z {M}"` (PL) or `"Page {N} of {M}"`
    // (custom EN). When the template is set, `{N}` and `{M}` are
    // replaced with the current page number and total page count
    // fields respectively. Default (no override) keeps the legacy
    // `Page N / M` runs so existing schemas render byte-stable.
    const formatTemplate = formatting.footers.pageNumberingFormat?.trim();
    if (formatTemplate && formatTemplate.length > 0) {
      footerRuns.push(
        new TextRun({ text: '   |   ', size: 16, color: DOCX_PALETTE.faint, font: ctx.bodyFont })
      );
      // Split the template around the `{N}` and `{M}` placeholders so
      // the replacement runs become real Word `PageNumber` fields
      // (which Word recalculates on print) rather than literal text.
      // Tokenize via a regex that captures the placeholders alongside
      // the text fragments.
      const pieces = formatTemplate.split(/(\{N\}|\{M\})/);
      for (const piece of pieces) {
        if (piece === '{N}') {
          footerRuns.push(
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 16,
              color: DOCX_PALETTE.faint,
              font: ctx.bodyFont,
            })
          );
        } else if (piece === '{M}') {
          footerRuns.push(
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              size: 16,
              color: DOCX_PALETTE.faint,
              font: ctx.bodyFont,
            })
          );
        } else if (piece.length > 0) {
          footerRuns.push(
            new TextRun({ text: piece, size: 16, color: DOCX_PALETTE.faint, font: ctx.bodyFont })
          );
        }
      }
    } else {
      const defaultPageLabel = schema.language.toLowerCase().startsWith('pl') ? 'Strona ' : 'Page ';
      footerRuns.push(
        new TextRun({ text: '   |   ', size: 16, color: DOCX_PALETTE.faint, font: ctx.bodyFont }),
        new TextRun({
          text: defaultPageLabel,
          size: 16,
          color: DOCX_PALETTE.faint,
          font: ctx.bodyFont,
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 16,
          color: DOCX_PALETTE.faint,
          font: ctx.bodyFont,
        }),
        new TextRun({ text: ' / ', size: 16, color: DOCX_PALETTE.faint, font: ctx.bodyFont }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          size: 16,
          color: DOCX_PALETTE.faint,
          font: ctx.bodyFont,
        })
      );
    }
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

  // Materialise the accumulated footnote registry into the
  // string-keyed shape `Document({ footnotes })` expects. Empty when
  // no footnote / footnote-style citation block was emitted, in which
  // case we omit the property so docx does not write an empty
  // `word/footnotes.xml` part.
  const footnotesPayload =
    ctx.footnotes.size > 0
      ? Object.fromEntries(
          Array.from(ctx.footnotes.entries()).map(([id, paragraphs]) => [
            String(id),
            { children: paragraphs },
          ])
        )
      : undefined;

  const doc = new Document({
    creator: 'Consultify Document Studio',
    title: schema.title,
    description: `Consultify Document Studio · ${schema.documentType} · ${formattingClass}`,
    styles,
    numbering: { config: DOCX_NUMBERING_CONFIG },
    ...(footnotesPayload ? { footnotes: footnotesPayload } : {}),
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
