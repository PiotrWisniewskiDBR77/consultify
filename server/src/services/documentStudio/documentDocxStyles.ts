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

  return {
    default: {
      document: {
        run: { font: fonts.body, size: sizing.body },
      },
      heading1: {
        run: {
          font: fonts.heading,
          size: sizing.heading1,
          bold: true,
          color: '0F172A',
        },
        paragraph: { spacing: { before: sizing.spacing.h1Before, after: sizing.spacing.h1After } },
      },
      heading2: {
        run: {
          font: fonts.heading,
          size: sizing.heading2,
          bold: true,
          color: '1E293B',
        },
        paragraph: { spacing: { before: sizing.spacing.h2Before, after: sizing.spacing.h2After } },
      },
      heading3: {
        run: {
          font: fonts.heading,
          size: sizing.heading3,
          bold: true,
          color: '334155',
        },
        paragraph: { spacing: { before: sizing.spacing.h3Before, after: sizing.spacing.h3After } },
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
          color: '0F172A',
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
          color: '475569',
        },
        paragraph: { spacing: { after: 80 }, alignment: 'center' },
      },
      {
        id: DOCX_STYLE_IDS.HEADING1,
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.heading, size: sizing.heading1, bold: true, color: '0F172A' },
        paragraph: {
          spacing: { before: sizing.spacing.h1Before, after: sizing.spacing.h1After },
        },
      },
      {
        id: DOCX_STYLE_IDS.HEADING2,
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.heading, size: sizing.heading2, bold: true, color: '1E293B' },
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
        run: { font: fonts.heading, size: sizing.heading3, bold: true, color: '334155' },
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
        run: { font: fonts.body, size: sizing.body, color: '0F172A' },
        paragraph: { spacing: { after: sizing.spacing.bodyAfter } },
      },
      {
        id: DOCX_STYLE_IDS.BLOCK_QUOTE,
        name: 'Block Quote',
        basedOn: 'BodyText',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.body, italics: true, color: '475569' },
        paragraph: { indent: { left: 360 }, spacing: { before: 80, after: 120 } },
      },
      {
        id: DOCX_STYLE_IDS.CAPTION,
        name: 'Caption',
        basedOn: 'Normal',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.caption, italics: true, color: '64748B' },
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
        run: { font: fonts.body, size: sizing.footnote, color: '475569' },
        paragraph: { spacing: { after: 40 } },
      },
      {
        id: DOCX_STYLE_IDS.ASSUMPTION_BODY,
        name: 'Assumption Body',
        basedOn: 'BodyText',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.body, italics: true, color: '92400E' },
        paragraph: { spacing: { after: sizing.spacing.bodyAfter } },
      },
      {
        id: DOCX_STYLE_IDS.CALLOUT,
        name: 'Callout',
        basedOn: 'BodyText',
        next: 'BodyText',
        run: { font: fonts.body, size: sizing.body, color: '0F172A' },
        paragraph: { spacing: { before: 80, after: 120 }, indent: { left: 240 } },
      },
      {
        id: DOCX_STYLE_IDS.SOURCE_LIST,
        name: 'Source List',
        basedOn: 'BodyText',
        next: 'SourceList',
        run: { font: fonts.body, size: sizing.body, color: '0F172A' },
        paragraph: { spacing: { after: 60 } },
      },
      {
        id: DOCX_STYLE_IDS.TOC_HEADING,
        name: 'TOC Heading',
        basedOn: 'Heading1',
        next: 'BodyText',
        quickFormat: true,
        run: { font: fonts.heading, size: sizing.heading1, bold: true, color: '0F172A' },
        paragraph: {
          spacing: { before: sizing.spacing.h1Before, after: sizing.spacing.h1After },
        },
      },
    ],
  };
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
