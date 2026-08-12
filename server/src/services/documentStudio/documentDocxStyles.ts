/**
 * Consultify Document Studio — DOCX styles per formatting class (Epic E8, Slice 8.1).
 *
 * Owns the mapping from `(communicationRegister × languageStyle)` to a real
 * Word styles configuration the `docx` package can serialize into the
 * generated .docx package's `word/styles.xml`. Three goals:
 *
 *   1. Word picks the document's outline / TOC / accessibility tree from
 *      *named* paragraph styles (`Heading1`, `Heading2`, `BodyText`, …).
 *      The MVP-1 finalization renderer used inline runs only, which Word
 *      treats as ad-hoc formatting and ignores for outline / TOC / a11y.
 *      Switching to named styles unlocks the entire MVP-4 advanced DOCX
 *      surface (TOC field, captions, footnotes) without bespoke wiring
 *      per render path.
 *
 *   2. The same schema can render visually distinct deliverables for
 *      different audiences. We collapse the four `CommunicationRegister`
 *      values + the `legal` language style into four formatting classes
 *      (`executive`, `professional`, `narrative`, `legal`) so the
 *      visual contract stays small and reviewable.
 *
 *   3. Style ids are stable strings (`Heading1`, `BodyText`, …). Tests
 *      assert against these ids by unzipping the produced .docx and
 *      reading `word/document.xml` / `word/styles.xml`; renderer changes
 *      that drop a named style would break those assertions immediately.
 *
 * Sizes use the `docx` half-point convention (size: 32 = 16pt).
 */

import type {
  CommunicationRegister,
  DocumentSchema,
  FormattingSchema,
} from './documentStudioTypes.js';

// ---------------------------------------------------------------------------
// Brand palette (Vegas Fala 6 — parity with DeckStyler + WorkbookStyler)
// ---------------------------------------------------------------------------
//
// The DOCX generator was the WEAKEST of the three deliverable stylers: it
// delegated everything to Word's named styles and carried no visual constants
// of its own, so every heading/table/callout drifted toward flat slate greys.
// DeckStyler (navy #0C447C + teal #1D9E75) and WorkbookStyler (navy header
// fills + teal color-scales) already share a consistent chord — this palette
// brings DOCX to the same standard so the three exports read as one brand.
//
// Doctrine (identical to DeckStyler / WorkbookStyler):
//   • Navy (#0C447C) is the dominant chrome color — headings, table headers,
//     cover rule, footer accents.
//   • Teal (#1D9E75) is the accent — callout spines, positive deltas, KPI rule.
//   • Crimson is NEVER chrome. It appears only as a status/danger color, never
//     as a heading/fill/border. There is ZERO crimson in the data path here.
//   • Neutral ink + muted greys carry body text (slate family, unchanged so
//     the existing named-style contract + tests stay stable).
//
// Values are BARE 6-digit hex (no leading '#', no alpha) — the shape the `docx`
// package's `color:` / `shading.fill` fields want. This mirrors DeckStyler's
// `hex()` output (pptxgenjs) and is the DOCX analogue of WorkbookStyler's
// `HEADER_NAVY_HEX` / `ZEBRA_HEX`.
export const DOCX_PALETTE = Object.freeze({
  /** Dominant brand navy — H1, table header fill, cover rule, footer accent. */
  navy: '0C447C',
  /** Softer navy — H2 (one step down the heading hierarchy). */
  navySoft: '1B5FA8',
  /** Deepest navy/ink — Title where max weight is wanted. */
  navyInk: '0A2F57',
  /** Teal accent — callout spine, positive delta, KPI/section rule. */
  teal: '1D9E75',
  /** Deep teal — accent text that must stay readable on a light tint. */
  tealInk: '146A50',
  /** Body ink (unchanged slate — keeps the named-style visual contract). */
  ink: '1F2933',
  /** Heading-3 / tertiary ink. */
  ink3: '334155',
  /** Muted caption / footer / label grey (matches WorkbookStyler muted). */
  muted: '64748B',
  /** Softer muted (subtitle / block-quote / secondary caption). */
  muted2: '475569',
  /** Lightest footer/page-number grey. */
  faint: '94A3B8',
  /** Assumption highlight (amber ink — status, not chrome). */
  amberInk: '92400E',
  /** Zebra / soft row fill (subtle navy-tinted). */
  zebraFill: 'F3F7FB',
  /** Callout background tint (very light navy). */
  calloutFill: 'F5F8FC',
  /** KPI card fill. */
  kpiFill: 'F1F5F9',
  /** Hairline / border grey. */
  gridline: 'E3E7EE',
  white: 'FFFFFF',
} as const);

/**
 * Tone → accent hex for callout labels + KPI deltas. Consistent with the
 * DeckStyler / WorkbookStyler doctrine: teal for success/positive, navy for
 * info, amber for warning, crimson ONLY for danger (status, never chrome).
 * Shared with the renderer so both files reference a single source of truth.
 */
export const DOCX_TONE_COLOR: Record<string, string> = Object.freeze({
  info: DOCX_PALETTE.navy,
  success: DOCX_PALETTE.teal,
  warning: 'D97706',
  danger: 'C0392B',
});

/** Soft background tint per callout tone (paired with {@link DOCX_TONE_COLOR}). */
export const DOCX_TONE_FILL: Record<string, string> = Object.freeze({
  info: 'EEF3FA',
  success: 'EAF6F1',
  warning: 'FDF6EC',
  danger: 'FBECEC',
});

/**
 * Visual presentation tier resolved from the schema. Drives Word style
 * sizes / colors / spacing without changing which style ids are emitted
 * (every class produces the same id set, so the renderer never branches
 * on class).
 */
export type FormattingClass = 'executive' | 'professional' | 'narrative' | 'legal';

const FORMATTING_CLASS_FROM_REGISTER: Record<CommunicationRegister, FormattingClass> = {
  executive: 'executive',
  professional: 'professional',
  technical: 'professional',
  narrative: 'narrative',
};

/**
 * Resolve the formatting class for a schema. The `legal` language style
 * always wins over the register because the legal tone has its own
 * visual contract (smaller body, tighter spacing, serif voice).
 */
export function resolveFormattingClass(schema: DocumentSchema): FormattingClass {
  if (schema.languageStyle === 'legal') return 'legal';
  return FORMATTING_CLASS_FROM_REGISTER[schema.communicationRegister] ?? 'professional';
}

/**
 * Default font names. The Aptos pair is intentional — it matches Word
 * 365's default body / display pair so the generated document blends in
 * with native Word documents on modern installs.
 */
const DEFAULT_BODY_FONT = 'Aptos';
const DEFAULT_HEADING_FONT = 'Aptos Display';
const LEGAL_BODY_FONT = 'Calibri';
const LEGAL_HEADING_FONT = 'Calibri';

/**
 * Strip the trailing size hint stored on `FormattingSchema.fonts.body`
 * (the schema field carries strings like "Aptos 11" — the trailing
 * number is just a hint for the legacy markdown renderer).
 */
function fontFromSchema(schema: FormattingSchema, kind: 'body' | 'heading'): string | null {
  const raw = kind === 'body' ? schema.fonts.body : schema.fonts.heading;
  const stripped = String(raw || '')
    .replace(/\s+\d+(\.\d+)?\s*$/, '')
    .trim();
  return stripped.length > 0 ? stripped : null;
}

export interface ResolvedDocxFonts {
  body: string;
  heading: string;
}

export function resolveDocxFonts(
  schema: DocumentSchema,
  formattingClass: FormattingClass
): ResolvedDocxFonts {
  const body = fontFromSchema(schema.formattingSchema, 'body');
  const heading = fontFromSchema(schema.formattingSchema, 'heading');
  if (formattingClass === 'legal') {
    return {
      body: body ?? LEGAL_BODY_FONT,
      heading: heading ?? LEGAL_HEADING_FONT,
    };
  }
  return {
    body: body ?? DEFAULT_BODY_FONT,
    heading: heading ?? DEFAULT_HEADING_FONT,
  };
}

/**
 * Stable style ids consumed by the renderer. Renderer code references
 * these constants — never the literal strings — so a style id rename
 * is a single-file edit + test refresh.
 *
 * Note on reserved names: Word + the `docx` package treat `Title` and
 * `FootnoteText` as built-in styles whose run properties are merged
 * with internal defaults (dropping our font/color/bold). We use
 * `DocStudio…` namespaced ids for those two so our visual contract
 * survives the round-trip. `Heading1`/`Subtitle`/`Caption`/`BodyText`
 * do NOT have this problem in `docx@9.5.1` and stay unprefixed so the
 * generated XML is friendly to Word's outline / TOC tooling.
 */
export const DOCX_STYLE_IDS = Object.freeze({
  TITLE: 'DocStudioTitle',
  SUBTITLE: 'Subtitle',
  HEADING1: 'Heading1',
  HEADING2: 'Heading2',
  HEADING3: 'Heading3',
  BODY_TEXT: 'BodyText',
  BLOCK_QUOTE: 'BlockQuote',
  CAPTION: 'Caption',
  FOOTNOTE_TEXT: 'DocStudioFootnote',
  ASSUMPTION_BODY: 'AssumptionBody',
  CALLOUT: 'Callout',
  SOURCE_LIST: 'SourceList',
  TOC_HEADING: 'TOCHeading',
} as const);

export type DocxStyleId = (typeof DOCX_STYLE_IDS)[keyof typeof DOCX_STYLE_IDS];

/**
 * Half-point sizes per formatting class. Stored as a record so the
 * renderer can iterate without duplicating literals.
 */
interface ClassSizing {
  title: number;
  subtitle: number;
  heading1: number;
  heading2: number;
  heading3: number;
  body: number;
  caption: number;
  footnote: number;
  spacing: {
    h1Before: number;
    h1After: number;
    h2Before: number;
    h2After: number;
    h3Before: number;
    h3After: number;
    bodyAfter: number;
  };
}

const SIZING_BY_CLASS: Record<FormattingClass, ClassSizing> = {
  // Boardroom-grade: large title, slightly tighter body, generous heading
  // breathing room so an executive scanning a printed memo finds the
  // structural hooks fast.
  executive: {
    title: 56,
    subtitle: 26,
    heading1: 34,
    heading2: 28,
    heading3: 23,
    body: 22,
    caption: 18,
    footnote: 18,
    spacing: {
      h1Before: 280,
      h1After: 140,
      h2Before: 220,
      h2After: 110,
      h3Before: 180,
      h3After: 90,
      bodyAfter: 120,
    },
  },
  professional: {
    title: 48,
    subtitle: 24,
    heading1: 32,
    heading2: 26,
    heading3: 22,
    body: 22,
    caption: 18,
    footnote: 18,
    spacing: {
      h1Before: 240,
      h1After: 120,
      h2Before: 200,
      h2After: 100,
      h3Before: 160,
      h3After: 80,
      bodyAfter: 120,
    },
  },
  // Narrative: more whitespace, slightly larger body, softer heading
  // size hierarchy. Useful for white-papers and long-form discovery
  // summaries where flow matters more than scannability.
  narrative: {
    title: 48,
    subtitle: 24,
    heading1: 30,
    heading2: 25,
    heading3: 22,
    body: 23,
    caption: 18,
    footnote: 18,
    spacing: {
      h1Before: 280,
      h1After: 160,
      h2Before: 220,
      h2After: 130,
      h3Before: 180,
      h3After: 100,
      bodyAfter: 160,
    },
  },
  // Legal: tight, dense, smaller body. Echoes regulatory / contract
  // typography (every line counts, no extra whitespace, smaller body
  // because pages are dense).
  legal: {
    title: 40,
    subtitle: 22,
    heading1: 28,
    heading2: 24,
    heading3: 22,
    body: 20,
    caption: 16,
    footnote: 16,
    spacing: {
      h1Before: 200,
      h1After: 80,
      h2Before: 160,
      h2After: 60,
      h3Before: 120,
      h3After: 60,
      bodyAfter: 80,
    },
  },
};

export function getSizingForClass(formattingClass: FormattingClass): ClassSizing {
  return SIZING_BY_CLASS[formattingClass];
}

/**
 * Build the `Document({ styles })` config for the `docx` package. Every
 * style is keyed by a stable `id` (see `DOCX_STYLE_IDS`); Word picks the
 * outline / TOC / accessibility tree from these ids so they MUST remain
 * stable across renderer revisions.
 */
export function buildDocxStyleConfig(
  schema: DocumentSchema,
  formattingClass: FormattingClass
): Record<string, unknown> {
  const fonts = resolveDocxFonts(schema, formattingClass);
  const sizing = getSizingForClass(formattingClass);
  // Word does not infer the proofing / assistive-technology language from
  // visible content. Put the schema language on the default run so every
  // paragraph inherits a real `w:lang` value unless a future inline run
  // deliberately overrides it.
  const documentLanguage = schema.language.toLowerCase().startsWith('pl') ? 'pl-PL' : 'en-US';

  // Slice E15.5.formatting.render — when the schema carries a
  // `headingStylesDetailed` override (E15.5 substrate), apply it on
  // top of the class-derived sizing so author-supplied heading specs
  // are honored. Conversion conventions:
  //   - `fontSizePt` is in points; docx wants half-points → ×2.
  //   - `spacingBeforePt` / `spacingAfterPt` are in points; docx
  //     wants TWIPs (1pt = 20 TWIPs) → ×20.
  //   - `bold` overrides the renderer default of `true`.
  // Only fields present on the override are applied; missing fields
  // fall back to the class-derived `sizing` defaults.
  const detailedHeadings = schema.formattingSchema.headingStylesDetailed;
  const h1Size = detailedHeadings ? detailedHeadings.h1.fontSizePt * 2 : sizing.heading1;
  const h2Size = detailedHeadings ? detailedHeadings.h2.fontSizePt * 2 : sizing.heading2;
  const h3Size = detailedHeadings ? detailedHeadings.h3.fontSizePt * 2 : sizing.heading3;
  const h1Bold = detailedHeadings ? detailedHeadings.h1.bold : true;
  const h2Bold = detailedHeadings ? detailedHeadings.h2.bold : true;
  const h3Bold = detailedHeadings ? detailedHeadings.h3.bold : true;
  const h1Before = detailedHeadings
    ? detailedHeadings.h1.spacingBeforePt * 20
    : sizing.spacing.h1Before;
  const h1After = detailedHeadings
    ? detailedHeadings.h1.spacingAfterPt * 20
    : sizing.spacing.h1After;
  const h2Before = detailedHeadings
    ? detailedHeadings.h2.spacingBeforePt * 20
    : sizing.spacing.h2Before;
  const h2After = detailedHeadings
    ? detailedHeadings.h2.spacingAfterPt * 20
    : sizing.spacing.h2After;
  const h3Before = detailedHeadings
    ? detailedHeadings.h3.spacingBeforePt * 20
    : sizing.spacing.h3Before;
  const h3After = detailedHeadings
    ? detailedHeadings.h3.spacingAfterPt * 20
    : sizing.spacing.h3After;

  return {
    default: {
      document: {
        run: {
          font: fonts.body,
          size: sizing.body,
          language: {
            value: documentLanguage,
            eastAsia: documentLanguage,
            bidirectional: documentLanguage,
          },
        },
      },
      heading1: {
        run: {
          font: fonts.heading,
          size: h1Size,
          bold: h1Bold,
          color: DOCX_PALETTE.navy,
        },
        paragraph: { spacing: { before: h1Before, after: h1After } },
      },
      heading2: {
        run: {
          font: fonts.heading,
          size: h2Size,
          bold: h2Bold,
          color: DOCX_PALETTE.navySoft,
        },
        paragraph: { spacing: { before: h2Before, after: h2After } },
      },
      heading3: {
        run: {
          font: fonts.heading,
          size: h3Size,
          bold: h3Bold,
          color: DOCX_PALETTE.ink3,
        },
        paragraph: { spacing: { before: h3Before, after: h3After } },
      },
    },
    paragraphStyles: [
      {
        id: DOCX_STYLE_IDS.TITLE,
        // The display name intentionally avoids the reserved "Title"
        // value so Word does not merge our run properties with the
        // built-in Title style (which would drop font/bold/color).
        name: 'Doc Studio Title',
        basedOn: 'Normal',
        next: 'Subtitle',
        quickFormat: true,
        run: {
          font: fonts.heading,
          size: sizing.title,
          bold: true,
          color: DOCX_PALETTE.navyInk,
        },
        paragraph: { spacing: { before: 600, after: 200 }, alignment: 'center' },
      },
      {
        id: DOCX_STYLE_IDS.SUBTITLE,
        name: 'Subtitle',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: {
          font: fonts.body,
          size: sizing.subtitle,
          italics: true,
          color: DOCX_PALETTE.muted2,
        },
        paragraph: { spacing: { after: 80 }, alignment: 'center' },
      },
      {
        id: DOCX_STYLE_IDS.HEADING1,
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.heading, size: sizing.heading1, bold: true, color: DOCX_PALETTE.navy },
        paragraph: {
          spacing: { before: sizing.spacing.h1Before, after: sizing.spacing.h1After },
          // Teal hairline UNDER every H1 — the DOCX analogue of DeckStyler's
          // accent rule beneath a section title. Gives the document rhythm.
          border: {
            bottom: { color: DOCX_PALETTE.teal, space: 6, style: 'single', size: 8 },
          },
        },
      },
      {
        id: DOCX_STYLE_IDS.HEADING2,
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: {
          font: fonts.heading,
          size: sizing.heading2,
          bold: true,
          color: DOCX_PALETTE.navySoft,
        },
        paragraph: {
          spacing: { before: sizing.spacing.h2Before, after: sizing.spacing.h2After },
        },
      },
      {
        id: DOCX_STYLE_IDS.HEADING3,
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.heading, size: sizing.heading3, bold: true, color: DOCX_PALETTE.ink3 },
        paragraph: {
          spacing: { before: sizing.spacing.h3Before, after: sizing.spacing.h3After },
        },
      },
      {
        id: DOCX_STYLE_IDS.BODY_TEXT,
        name: 'Body Text',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.body, size: sizing.body, color: DOCX_PALETTE.ink },
        paragraph: { spacing: { after: sizing.spacing.bodyAfter } },
      },
      {
        id: DOCX_STYLE_IDS.BLOCK_QUOTE,
        name: 'Block Quote',
        basedOn: 'BodyText',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.body, italics: true, color: DOCX_PALETTE.muted2 },
        paragraph: {
          indent: { left: 360 },
          spacing: { before: 80, after: 120 },
          // Navy left rule — a pull-quote reads as a deliberate device, not
          // just italic body text.
          border: {
            left: { color: DOCX_PALETTE.navy, space: 12, style: 'single', size: 18 },
          },
        },
      },
      {
        id: DOCX_STYLE_IDS.CAPTION,
        name: 'Caption',
        basedOn: 'Normal',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.caption, italics: true, color: DOCX_PALETTE.muted },
        paragraph: { spacing: { before: 60, after: 120 } },
      },
      {
        id: DOCX_STYLE_IDS.FOOTNOTE_TEXT,
        // Avoid the built-in `FootnoteText` id/name so docx does not
        // attach the semiHidden/Char-link metadata that strips our run
        // properties. Slice 8.3 will emit real Word footnote markers
        // and we want full control of the visual presentation.
        name: 'Doc Studio Footnote',
        basedOn: 'Normal',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.footnote, color: DOCX_PALETTE.muted2 },
        paragraph: { spacing: { after: 40 } },
      },
      {
        id: DOCX_STYLE_IDS.ASSUMPTION_BODY,
        name: 'Assumption Body',
        basedOn: 'BodyText',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.body, italics: true, color: DOCX_PALETTE.amberInk },
        paragraph: { spacing: { after: sizing.spacing.bodyAfter } },
      },
      {
        id: DOCX_STYLE_IDS.CALLOUT,
        name: 'Callout',
        basedOn: 'BodyText',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.body, color: DOCX_PALETTE.ink },
        paragraph: {
          spacing: { before: 80, after: 120 },
          indent: { left: 240 },
          // Teal accent spine + soft navy tint — a callout is a boxed device,
          // mirroring DeckStyler's accent-header panels. The renderer overrides
          // the spine color per tone (danger→crimson) at emit time.
          shading: { type: 'clear', fill: DOCX_PALETTE.calloutFill },
          border: {
            left: { color: DOCX_PALETTE.teal, space: 12, style: 'single', size: 24 },
          },
        },
      },
      {
        id: DOCX_STYLE_IDS.SOURCE_LIST,
        name: 'Source List',
        basedOn: 'BodyText',
        next: 'SourceList',
        run: { font: fonts.body, size: sizing.body, color: DOCX_PALETTE.ink },
        paragraph: { spacing: { after: 60 } },
      },
      {
        id: DOCX_STYLE_IDS.TOC_HEADING,
        name: 'TOC Heading',
        basedOn: 'Heading1',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.heading, size: sizing.heading1, bold: true, color: DOCX_PALETTE.navy },
        paragraph: {
          spacing: { before: sizing.spacing.h1Before, after: sizing.spacing.h1After },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Overflow guards (parity with DeckStyler `fitProse` / WorkbookStyler width clamp)
// ---------------------------------------------------------------------------
//
// A Word doc reflows, so it cannot "overflow a frame" the way a slide can — but
// it CAN produce ugly runaway output: a 400-char "title" that wraps across five
// lines, or a 30-column table squeezed into A4 so every cell is one letter wide.
// These deterministic guards are the DOCX analogue of DeckStyler's `fitProse`
// (shrink-then-truncate) and WorkbookStyler's `computeColumnWidth` clamp.

/**
 * Hard ceiling on a rendered title / heading length. A "title" longer than this
 * is almost always a mis-classified paragraph; we truncate at a word boundary
 * and append an ellipsis so the cover / heading stays one clean line-cluster.
 */
export const DOCX_TITLE_MAX_CHARS = 140;

/** Hard ceiling on a heading (H1–H3) length before word-boundary truncation. */
export const DOCX_HEADING_MAX_CHARS = 120;

/**
 * Truncate `text` to at most `maxChars` characters at a word boundary, adding
 * an ellipsis when cut. Never returns an empty string for non-empty input, and
 * never cuts mid-word when a nearby space exists. Deterministic — no LLM.
 */
export function clampHeadingText(text: string, maxChars = DOCX_HEADING_MAX_CHARS): string {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxChars) return clean;
  let cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.6) cut = cut.slice(0, lastSpace);
  return cut.trimEnd() + '…';
}

/**
 * Maximum number of columns a table can carry before A4 legibility collapses.
 * Beyond this the renderer keeps the first `DOCX_TABLE_MAX_COLS - 1` columns and
 * folds the remainder into a single trailing "+N more" column so the table
 * stays readable instead of shrinking every cell to a sliver. Mirrors the
 * WorkbookStyler philosophy of a width clamp — here it is a column-count clamp
 * because Word has no horizontal scroll.
 */
export const DOCX_TABLE_MAX_COLS = 8;

export interface TableColumnClamp {
  /** 0-based indices of the columns to KEEP (in order). */
  keep: number[];
  /** Column indices folded away (empty when nothing overflowed). */
  folded: number[];
  /** True when a "+N more" summary column should be appended. */
  overflowed: boolean;
}

/**
 * Decide which columns of a `columnCount`-wide table survive on an A4 page.
 * Keeps the first `DOCX_TABLE_MAX_COLS - 1` and marks the rest as folded (the
 * renderer appends one "+N more columns" cell). Returns every column when the
 * table already fits. Deterministic, index-based — the renderer owns the actual
 * cell rewrite so this stays a pure decision.
 */
export function clampTableColumns(
  columnCount: number,
  maxCols = DOCX_TABLE_MAX_COLS
): TableColumnClamp {
  if (columnCount <= maxCols) {
    return {
      keep: Array.from({ length: columnCount }, (_, i) => i),
      folded: [],
      overflowed: false,
    };
  }
  const keepCount = Math.max(1, maxCols - 1);
  const keep = Array.from({ length: keepCount }, (_, i) => i);
  const folded = Array.from({ length: columnCount - keepCount }, (_, i) => keepCount + i);
  return { keep, folded, overflowed: true };
}

/**
 * Pure inspection helper used by tests + audit panels to surface which
 * formatting class a schema would render under without invoking the
 * docx packer. Keeps the resolver logic discoverable from outside the
 * renderer.
 */
export function describeFormattingDecision(schema: DocumentSchema): {
  formattingClass: FormattingClass;
  fonts: ResolvedDocxFonts;
  reason: string;
} {
  const formattingClass = resolveFormattingClass(schema);
  const fonts = resolveDocxFonts(schema, formattingClass);
  const reason =
    schema.languageStyle === 'legal'
      ? 'languageStyle === "legal" overrides the register-based class.'
      : `register === "${schema.communicationRegister}" maps to formatting class "${formattingClass}".`;
  return { formattingClass, fonts, reason };
}
