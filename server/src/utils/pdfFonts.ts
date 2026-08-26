/**
 * Consultify — server-side pdfkit font registration (DEC-132/133).
 *
 * PROBLEM (DEC-132, empirically confirmed): every `pdfkit` PDF Consultify
 * generates on the server relies on pdfkit's built-in "Standard 14" fonts
 * (Helvetica/Helvetica-Bold/…). Those are shipped with WinAnsi (cp1252)
 * encoding baked into pdfkit's `AFMFont`, which has NO Polish diacritics
 * (ą ę ł ń ó ś ź ż / Ą Ę Ł Ń Ó Ś Ź Ż). A Polish word like "Zażółć gęślą
 * jaźń" renders as garbage bytes ("ZaÏ1Brq¶Á ja¡D" and similar) in every
 * one of the 7+ pdfkit call sites in this server. No .ttf ever shipped in
 * this repo and no `registerFont` call existed anywhere before this file —
 * grep confirmed both were literally zero.
 *
 * FIX (DEC-133): embed a real TrueType font directly into the PDF byte
 * stream. pdfkit's `registerFont(name, path | Buffer)` + `.font(name)`
 * switches the active font to a `TrueTypeFont`/`sfnt` backend that pulls
 * glyphs from the font's own `cmap`/`glyf` tables — no dependency on the
 * viewer's OS having any given font installed (this is a *server-side
 * pdfkit* bug, not a "does the client have Aptos" bug like Word/PowerPoint
 * exports — see docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md §11
 * D1, which is about Office-native fonts for docx/pptx and does not apply
 * here). Font: **Lato** — OFL-licensed (freely embeddable), Polish-designed
 * (Łukasz Dziedzic), full Polish/Latin-Plus glyph coverage, and already one
 * of the 10 curated fonts in docs/product/DELIVERABLE_FORMATTING_SPEC.md
 * §1 (pairing #3, the "Clean" theme) — so this is the existing brand font
 * library, not a new one. See server/src/assets/fonts/LICENSE for exact
 * provenance.
 *
 * USAGE — call once per pdfkit document, right after `new PDFDocument(...)`:
 *
 *   import { registerPdfFonts, PDF_FONT } from '../utils/pdfFonts.js';
 *   const doc = new PDFDocument({ margin: 48 });
 *   registerPdfFonts(doc);
 *   doc.font(PDF_FONT.regular).text('Zażółć gęślą jaźń');
 *   doc.font(PDF_FONT.bold).text('ŁÓDŹ ŚĆŃ ąęłńóśźż');
 *
 * `registerPdfFonts` also sets the document's active font to `PDF_FONT.regular`
 * immediately, so call sites that never call `.font()` at all (several of the
 * 7 routes rely on pdfkit's implicit default) get the fix for free.
 *
 * PATH RESOLUTION — dev vs. dist:
 * This module lives at `server/src/utils/pdfFonts.ts`. In dev (`tsx`, runs
 * .ts directly from `src/`) `import.meta.url` resolves to
 * `server/src/utils/pdfFonts.ts`, so `../assets/fonts` is
 * `server/src/assets/fonts`. In production the backend is compiled with
 * `tsc` into `server/dist/src/utils/pdfFonts.js` (rootDir "." / outDir
 * "./dist" — see server/tsconfig.json — preserves the `src/` prefix), so
 * `../assets/fonts` from THAT location is `server/dist/src/assets/fonts`.
 * `tsc` only compiles `.ts` — it does not copy `.ttf` files — so the build
 * (`server/package.json` "build" script) and `Dockerfile.api` both gained an
 * explicit `cp -R src/assets/fonts dist/src/assets/fonts` step after the
 * `tsc --build` invocation to keep the two directory layouts symmetric. If
 * that copy step is ever removed, `registerPdfFonts` throws loudly (rather
 * than silently falling back to Helvetica) so the regression cannot ship
 * unnoticed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Directory holding the vendored Lato .ttf files (see module doc for dev/dist resolution). */
export const PDF_FONT_DIR = path.resolve(__dirname, '../assets/fonts');

/**
 * Registered pdfkit font names. Pass these (not literal strings, not
 * 'Helvetica*') to `doc.font(...)`. Mirrors pdfkit's own Bold/Italic/
 * BoldItalic naming convention so call sites that already branch on
 * bold/italic flags only need to swap the string table, not the logic.
 */
export const PDF_FONT = {
  regular: 'Lato',
  bold: 'Lato-Bold',
  italic: 'Lato-Italic',
  boldItalic: 'Lato-BoldItalic',
} as const;

export type PdfFontName = (typeof PDF_FONT)[keyof typeof PDF_FONT];

const FONT_FILES: Record<PdfFontName, string> = {
  [PDF_FONT.regular]: 'Lato-Regular.ttf',
  [PDF_FONT.bold]: 'Lato-Bold.ttf',
  [PDF_FONT.italic]: 'Lato-Italic.ttf',
  [PDF_FONT.boldItalic]: 'Lato-BoldItalic.ttf',
};

/**
 * Maps the pdfkit Standard-14 name a call site used to pass into `.font()`
 * to the equivalent registered Lato name. Lets existing call sites do a
 * mechanical find/replace (`'Helvetica-Bold'` → `PDF_FONT_FROM_HELVETICA['Helvetica-Bold']`)
 * without hand-reasoning about which of the 4 weights each string meant.
 */
export const PDF_FONT_FROM_HELVETICA: Record<string, PdfFontName> = {
  Helvetica: PDF_FONT.regular,
  'Helvetica-Bold': PDF_FONT.bold,
  'Helvetica-Oblique': PDF_FONT.italic,
  'Helvetica-BoldOblique': PDF_FONT.boldItalic,
};

let cachedBuffers: Record<PdfFontName, Buffer> | null = null;

function loadFontBuffers(): Record<PdfFontName, Buffer> {
  if (cachedBuffers) return cachedBuffers;
  const entries = (Object.keys(FONT_FILES) as PdfFontName[]).map((name) => {
    const filePath = path.join(PDF_FONT_DIR, FONT_FILES[name]);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `[pdfFonts] Missing embedded font file "${FONT_FILES[name]}" at ${filePath}. ` +
          'Polish-language PDFs cannot render without it (see DEC-132/133) — ' +
          'check that server/src/assets/fonts/*.ttf is present in this build ' +
          '(dist builds require the post-tsc copy step; see module doc comment).'
      );
    }
    return [name, fs.readFileSync(filePath)] as const;
  });
  cachedBuffers = Object.fromEntries(entries) as Record<PdfFontName, Buffer>;
  return cachedBuffers;
}

/**
 * Registers all 4 Lato weights on a pdfkit document as 'Lato' / 'Lato-Bold' /
 * 'Lato-Italic' / 'Lato-BoldItalic', and sets the document's active font to
 * 'Lato' so text drawn before any explicit `.font()` call is still correct.
 *
 * Idempotent-safe to call multiple times on the same doc (pdfkit's
 * `registerFont` simply overwrites the prior registration under that name).
 *
 * @param doc Any pdfkit `PDFDocument` instance (typed `any` to avoid a hard
 *   dependency on pdfkit's type export shape across the several ways this
 *   codebase constructs documents — e.g. `UnifiedExportService.renderPdf`'s
 *   dynamic `import('pdfkit')`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPdfFonts(doc: any): void {
  const buffers = loadFontBuffers();
  doc.registerFont(PDF_FONT.regular, buffers[PDF_FONT.regular]);
  doc.registerFont(PDF_FONT.bold, buffers[PDF_FONT.bold]);
  doc.registerFont(PDF_FONT.italic, buffers[PDF_FONT.italic]);
  doc.registerFont(PDF_FONT.boldItalic, buffers[PDF_FONT.boldItalic]);
  doc.font(PDF_FONT.regular);
}
