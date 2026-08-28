/**
 * Direct coverage for the shared UnifiedExportService (system-unification #5).
 * Previously exercised only transitively via the work-canvas integration suite;
 * these lock the binary generators before other modules migrate onto them.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/pdfFonts.js', () => {
  const PDF_FONT = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
  } as const;
  return {
    PDF_FONT,
    registerPdfFonts: (doc: any) => doc.font(PDF_FONT.regular),
  };
});

import { unifiedExportService } from '../../../../server/src/services/export/UnifiedExportService.js';

const baseSource = {
  title: 'Quarterly Plan',
  markdown: '# Quarterly Plan\n\n## Context\n\nShip the operating workspace.',
  sourceLabel: 'Source Canvas: draft-123',
  lifecycle: 'draft',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

// ZIP-based OpenXML formats (docx/xlsx/pptx) start with the local file header "PK".
function isZip(buf: Buffer): boolean {
  return buf.length > 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

describe('UnifiedExportService', () => {
  it('exportPdf produces a valid PDF buffer', async () => {
    const buf = await unifiedExportService.exportPdf(baseSource);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('exportDocx produces a valid (zip) DOCX buffer', async () => {
    const buf = await unifiedExportService.exportDocx(baseSource);
    expect(isZip(buf)).toBe(true);
  });

  it('exportXlsx produces a valid (zip) XLSX buffer from csv', async () => {
    const buf = await unifiedExportService.exportXlsx({
      ...baseSource,
      csv: 'Topic,Detail,Source\nContext,Ship it,Canvas',
    });
    expect(isZip(buf)).toBe(true);
  });

  it('exportPptx renders provided slides', async () => {
    const buf = await unifiedExportService.exportPptx({
      ...baseSource,
      slides: [
        { title: 'Intro', body: 'First slide' },
        { title: 'Plan', body: 'Second slide' },
      ],
    });
    expect(isZip(buf)).toBe(true);
  });

  it('exportPptx falls back to a single slide when none are provided', async () => {
    const buf = await unifiedExportService.exportPptx(baseSource);
    expect(isZip(buf)).toBe(true);
  });

  it('renderPdf primitive runs the build callback and yields a PDF buffer', async () => {
    let received: any = null;
    const buf = await unifiedExportService.renderPdf((doc) => {
      received = doc;
      doc.fontSize(12).text('Hello from a custom layout');
    });
    expect(received).not.toBeNull();
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renderPptx primitive runs the build callback and yields a PPTX buffer', async () => {
    let received: any = null;
    const buf = await unifiedExportService.renderPptx((pptx) => {
      received = pptx;
      pptx.layout = 'LAYOUT_WIDE';
      const slide = pptx.addSlide();
      slide.addText('Custom deck slide', { x: 0.5, y: 0.5, w: 9, h: 1 });
    });
    expect(received).not.toBeNull();
    expect(isZip(buf)).toBe(true);
  });

  it('caps PPTX at 20 slides without throwing', async () => {
    const slides = Array.from({ length: 50 }, (_, i) => ({
      title: `Slide ${i + 1}`,
      body: `Body ${i + 1}`,
    }));
    const buf = await unifiedExportService.exportPptx({ ...baseSource, slides });
    expect(isZip(buf)).toBe(true);
  });
});
