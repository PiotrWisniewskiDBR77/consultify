/**
 * UnifiedExportService
 *
 * Reusable, domain-agnostic binary document generators (PDF / DOCX / XLSX /
 * PPTX). This is STEP 1 of the system-unification effort: the binary export
 * mechanics were extracted verbatim from work-canvas.routes.ts so that other
 * modules can later migrate onto a single implementation.
 *
 * The service knows nothing about the Canvas domain (drafts, blocks,
 * provenance). Callers project their domain model into an `ExportSource` and
 * delegate. Behaviour is intentionally byte-for-byte identical to the original
 * Canvas exporters.
 */

export interface ExportSlide {
  title: string;
  body: string;
}

export interface ExportSource {
  /** Document title (PDF heading / DOCX title / single-slide title). */
  title: string;
  /** Primary markdown body used by PDF and DOCX. */
  markdown: string;
  /** CSV payload (header + rows) consumed by the XLSX generator. */
  csv?: string;
  /** Footer/metadata label, e.g. `Source Canvas: <id>`. */
  sourceLabel?: string;
  /** Lifecycle state label rendered in PDF/XLSX/DOCX metadata. */
  lifecycle?: string;
  /** ISO timestamp rendered in the PDF metadata block. */
  updatedAt?: string;
  /** Author/creator applied to XLSX/PPTX document metadata. */
  author?: string;
  /**
   * Optional pre-sectioned slides for PPTX. When provided, the service renders
   * these directly (preserving the caller's domain-specific sectionizer). When
   * absent, a single slide is derived from {@link title} + {@link markdown}.
   */
  slides?: ExportSlide[];
}

class UnifiedExportService {
  /**
   * Low-level, layout-agnostic PDF primitive: the pdfkit "create doc → collect
   * chunks → resolve Buffer" plumbing that every PDF exporter repeats. Callers
   * supply only the layout via `build(doc)`, keeping their own formatting.
   * Simple-tier exporters can adopt this without changing their output.
   */
  async renderPdf(
    build: (doc: any) => void,
    options: Record<string, unknown> = { margin: 48 }
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default as any;
    const doc = new PDFDocument(options);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    build(doc);
    doc.end();
    return finished;
  }

  async exportPdf(src: ExportSource): Promise<Buffer> {
    return this.renderPdf((doc) => {
      doc.fontSize(18).text(src.title, { underline: true });
      doc.moveDown();
      doc.fontSize(9).fillColor('#475569').text(src.sourceLabel || '');
      doc.text(`Lifecycle: ${src.lifecycle}`);
      doc.text(`Updated: ${src.updatedAt}`);
      doc.moveDown();
      doc.fillColor('#111827').fontSize(11).text(src.markdown, {
        width: 500,
        lineGap: 3,
      });
    });
  }

  async exportDocx(src: ExportSource): Promise<Buffer> {
    const docx = await import('docx');
    const paragraphs = [
      new docx.Paragraph({
        children: [new docx.TextRun({ text: src.title, bold: true, size: 32 })],
      }),
      new docx.Paragraph(src.sourceLabel || ''),
      new docx.Paragraph(`Lifecycle: ${src.lifecycle}`),
      new docx.Paragraph(''),
      ...src.markdown
        .split('\n')
        .slice(0, 500)
        .map((line) => new docx.Paragraph(line || ' ')),
    ];
    const document = new docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
    return Buffer.from(await docx.Packer.toBuffer(document));
  }

  async exportXlsx(src: ExportSource): Promise<Buffer> {
    const ExcelJS = (await import('exceljs')).default as any;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = src.author || 'Business Work Canvas';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Canvas Export');
    (src.csv || '')
      .split('\n')
      .forEach((line) => {
        sheet.addRow(line.split(',').map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')));
      });
    sheet.addRow([]);
    sheet.addRow(['Source Canvas', src.sourceLabel]);
    sheet.addRow(['Lifecycle', src.lifecycle]);
    // NOTE: XLSX uses a two-cell label/value footer (`['Source Canvas', <value>]`),
    // whereas PDF/DOCX/PPTX render a single prefixed `Source Canvas: <id>` line.
    // Callers therefore pass the raw id (not the prefixed label) as `sourceLabel`
    // when building the XLSX source, to preserve byte-for-byte output.
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Low-level, layout-agnostic PPTX primitive: the pptxgenjs "import → new →
   * write nodebuffer" plumbing. Callers build their own slides via build(pptx)
   * (they may set pptx.layout, use pptx.ShapeType, addSlide, etc.). Simple-tier
   * deck generators can adopt this without changing their layout.
   */
  async renderPptx(build: (pptx: any) => void): Promise<Buffer> {
    const module = await import('pptxgenjs');
    const PptxGenJS = (module.default || module) as any;
    const pptx = new PptxGenJS();
    build(pptx);
    const output = await pptx.write({ outputType: 'nodebuffer' });
    return Buffer.from(output);
  }

  async exportPptx(src: ExportSource): Promise<Buffer> {
    return this.renderPptx((pptx) => {
      pptx.author = src.author || 'Business Work Canvas';
      const slides =
      src.slides && src.slides.length
        ? src.slides
        : [{ title: src.title, body: src.markdown }];
    slides.slice(0, 20).forEach((slide, index) => {
      const page = pptx.addSlide();
      page.addText(slide.title, { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 24, bold: true });
      page.addText(slide.body || 'No slide body available.', {
        x: 0.5,
        y: 1.1,
        w: 9,
        h: 4.5,
        fontSize: 13,
        fit: 'shrink',
      });
      page.addText(`${src.sourceLabel} · Slide ${index + 1}`, {
        x: 0.5,
        y: 6.8,
        w: 9,
        h: 0.3,
        fontSize: 8,
        color: '64748B',
      });
      });
    });
  }
}

export const unifiedExportService = new UnifiedExportService();
export type { UnifiedExportService };
