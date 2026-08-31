/**
 * DEC-132/133 proof test — server pdfkit PDFs must render Polish diacritics.
 *
 * Before this fix, every pdfkit PDF in this server used pdfkit's built-in
 * Helvetica (WinAnsi/cp1252 encoding), which has no ą ę ł ń ó ś ź ż glyphs.
 * "Zażółć gęślą jaźń" (the standard Polish pangram) rendered as garbage
 * bytes. This test is the empirical proof, not a doc/flag check (Złota
 * Reguła #1, CLAUDE.md): it renders real PDF bytes through `pdf-parse` and
 * asserts the extracted text round-trips exactly.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import PDFDocument from 'pdfkit';
import { describe, expect, it, vi } from 'vitest';

import { PDF_FONT, PDF_FONT_DIR, PDF_FONT_FROM_HELVETICA, registerPdfFonts } from '../pdfFonts.js';

const PANGRAM = 'Zażółć gęślą jaźń';
const UPPERCASE = 'ŁÓDŹ ŚĆŃ ąęłńóśźż';

async function renderToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  build(doc);
  doc.end();
  return done;
}

async function extractText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  // pdf-parse appends a "-- N of M --" page-separator marker after each
  // page's text; strip it so assertions compare only the rendered content.
  return result.text.replace(/\n*--\s*\d+\s*of\s*\d+\s*--\n*/g, '\n').trim();
}

describe('pdfFonts — DEC-132/133 Polish diacritics fix', () => {
  it('vendors exactly the 4 expected Lato weights on disk', () => {
    for (const file of [
      'Lato-Regular.ttf',
      'Lato-Bold.ttf',
      'Lato-Italic.ttf',
      'Lato-BoldItalic.ttf',
    ]) {
      const full = path.join(PDF_FONT_DIR, file);
      expect(fs.existsSync(full), `missing ${full}`).toBe(true);
      expect(fs.statSync(full).size).toBeGreaterThan(10_000);
    }
    expect(fs.existsSync(path.join(PDF_FONT_DIR, 'LICENSE'))).toBe(true);
    expect(fs.existsSync(path.join(PDF_FONT_DIR, 'OFL.txt'))).toBe(true);
  });

  it('BEFORE — pdfkit default Helvetica mangles Polish diacritics (documents the bug)', async () => {
    const buf = await renderToBuffer((doc) => {
      doc.fontSize(18).text(PANGRAM);
    });
    const text = (await extractText(buf)).trim();
    expect(text).not.toContain(PANGRAM);
    // The exact mangled form isn't asserted (encoding-dependent garbage),
    // only that it demonstrably does NOT equal the correct pangram.
  });

  it('AFTER — registerPdfFonts + Lato renders the Polish pangram byte-for-byte', async () => {
    const buf = await renderToBuffer((doc) => {
      registerPdfFonts(doc);
      doc.fontSize(18).text(PANGRAM);
    });
    const text = (await extractText(buf)).trim();
    expect(text).toBe(PANGRAM);
  });

  it('renders uppercase Polish diacritics (Bold + all-caps) correctly', async () => {
    const buf = await renderToBuffer((doc) => {
      registerPdfFonts(doc);
      doc.font(PDF_FONT.bold).fontSize(14).text(UPPERCASE);
    });
    const text = (await extractText(buf)).trim();
    expect(text).toBe(UPPERCASE);
  });

  it('renders Polish diacritics in italic and bold-italic weights correctly', async () => {
    const buf = await renderToBuffer((doc) => {
      registerPdfFonts(doc);
      doc.font(PDF_FONT.italic).fontSize(12).text('kursywa: żółw');
      doc.font(PDF_FONT.boldItalic).fontSize(12).text('pogrubiona kursywa: gęś');
    });
    const text = await extractText(buf);
    expect(text).toContain('kursywa: żółw');
    expect(text).toContain('pogrubiona kursywa: gęś');
  });

  it('embeds real TrueType glyph data (FontFile2 / CIDFontType2), not a Standard-14 reference', async () => {
    const buf = await renderToBuffer((doc) => {
      registerPdfFonts(doc);
      doc.font(PDF_FONT.regular).text(PANGRAM);
    });
    const raw = buf.toString('latin1');
    expect(raw).toContain('/FontFile2');
    expect(raw).toContain('/Subtype /CIDFontType2');
    expect(raw).toContain('/BaseFont');
    expect(raw).toMatch(/Lato-Regular/);
    // Standard-14 Helvetica PDFs never embed a FontFile — they only reference
    // the base font name and rely on the viewer's own Helvetica. Presence of
    // FontFile2 proves the glyphs travel WITH the PDF (DEC-133 requirement).
  });

  it('sets a usable default font even when a call site never calls .font() explicitly', async () => {
    // Several of the 7 routes (assessment-reports, report-builder,
    // report-builder-public, managementReportsService) never call `.font()`
    // at all and relied on pdfkit's implicit default — registerPdfFonts must
    // fix those too, not just call sites that explicitly pick a font.
    const buf = await renderToBuffer((doc) => {
      registerPdfFonts(doc);
      doc.fontSize(16).text(PANGRAM); // no .font() call
    });
    const text = (await extractText(buf)).trim();
    expect(text).toBe(PANGRAM);
  });

  it('PDF_FONT_FROM_HELVETICA maps every Standard-14 name pdfkit call sites used', () => {
    expect(PDF_FONT_FROM_HELVETICA['Helvetica']).toBe(PDF_FONT.regular);
    expect(PDF_FONT_FROM_HELVETICA['Helvetica-Bold']).toBe(PDF_FONT.bold);
    expect(PDF_FONT_FROM_HELVETICA['Helvetica-Oblique']).toBe(PDF_FONT.italic);
    expect(PDF_FONT_FROM_HELVETICA['Helvetica-BoldOblique']).toBe(PDF_FONT.boldItalic);
  });

  it('throws a clear error instead of silently falling back to Helvetica when a font file is missing', async () => {
    // Simulates the "build copy step regressed" failure mode (DEC-133 risk:
    // dist builds need an explicit post-tsc copy of src/assets/fonts, since
    // tsc only compiles .ts — see the Dockerfile.api / package.json build
    // steps and the module doc comment). If that copy is ever dropped, this
    // must fail loudly at PDF-generation time, not silently ship broken
    // Polish text again.
    // Load a FRESH module instance (vi.resetModules) so this test is immune
    // to the module-level buffer cache already being warm from earlier tests
    // in this file — otherwise a missing file on disk would be masked by an
    // in-memory cache populated before the file was deleted.
    const boldPath = path.join(PDF_FONT_DIR, 'Lato-Bold.ttf');
    const backupPath = path.join(os.tmpdir(), `pdfFonts-Lato-Bold-backup-${Date.now()}.ttf`);
    fs.copyFileSync(boldPath, backupPath);
    fs.unlinkSync(boldPath);
    try {
      vi.resetModules();
      const fresh = await import('../pdfFonts.js');
      const doc = new PDFDocument({ margin: 48 });
      expect(() => fresh.registerPdfFonts(doc)).toThrow(/Missing embedded font file/);
    } finally {
      fs.copyFileSync(backupPath, boldPath);
      fs.unlinkSync(backupPath);
      vi.resetModules();
    }
  });
});
