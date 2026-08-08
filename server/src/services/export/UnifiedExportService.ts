/**
 * UnifiedExportService
 *
 * Reusable, domain-agnostic binary document generators (PDF / DOCX / XLSX /
 * PPTX). The binary export mechanics live here so other modules can migrate
 * onto a single implementation; the service knows nothing about the Canvas
 * domain (drafts, blocks, provenance). Callers project their domain model
 * into an `ExportSource` and delegate.
 *
 * Canvas M-4 — markdown structure rendering
 * Prior to this revision, each markdown line was mapped to a single docx
 * `Paragraph` (and the equivalent for PPTX / PDF), so headings, lists, tables
 * and code blocks rendered as literal `##`, `|`, `- [ ]` text in Word /
 * PowerPoint. Consultants would not ship those deliverables. The renderers
 * now project a real markdown AST (via `markdownStructTokenize`) onto each
 * format's native structural primitives: docx Heading1..6, ListParagraph
 * with bullets / numbering, docx.Table; pdfkit headings + native bullet runs
 * + table rules; pptxgenjs addText arrays with paragraph-level bold / italic
 * / bullet markers.
 *
 * Inline emphasis (bold / italic / code / strike / links) is honored per
 * format. Tables are rendered natively where the format supports them; in
 * PPTX they collapse to per-row text lines because pptxgenjs's table API is
 * heavyweight enough to be a regression risk for the common deck case (the
 * Canvas's PPTX path is sectionized, so most callers don't hit a full
 * markdown table in a slide body).
 */

import {
  type InlineRun,
  runsToPlainText,
  type StructToken,
  tokenizeMarkdown,
} from './markdownStructTokenize.js';

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

// ---------------------------------------------------------------------------
// DOCX inline run mapping
// ---------------------------------------------------------------------------

/** Convert an InlineRun to a docx.TextRun with the right styling flags. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runToDocxRun(docx: any, run: InlineRun): any {
  // Hyperlinks need an ExternalHyperlink wrapper to be clickable in Word —
  // a bare TextRun with `style='Hyperlink'` styles the text but doesn't link.
  if (run.href) {
    return new docx.ExternalHyperlink({
      link: run.href,
      children: [
        new docx.TextRun({
          text: run.text,
          style: 'Hyperlink',
          bold: run.bold,
          italics: run.italic,
          strike: run.strike,
        }),
      ],
    });
  }
  return new docx.TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    strike: run.strike,
    font: run.code ? 'Consolas' : undefined,
  });
}

/** Compose runs into a docx Paragraph with the given paragraph-level options. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paragraphFromRuns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docx: any,
  runs: InlineRun[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: Record<string, any> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // An empty paragraph (no runs) is the spacer between blocks. We render it
  // with a single space so Word doesn't collapse it.
  const children =
    runs.length === 0 ? [new docx.TextRun(' ')] : runs.map((r) => runToDocxRun(docx, r));
  return new docx.Paragraph({ ...options, children });
}

const DOCX_HEADING_LEVELS = [
  'HEADING_1',
  'HEADING_2',
  'HEADING_3',
  'HEADING_4',
  'HEADING_5',
  'HEADING_6',
] as const;

class UnifiedExportService {
  // -------------------------------------------------------------------------
  // PDF
  // -------------------------------------------------------------------------
  /**
   * Low-level, layout-agnostic PDF primitive: the pdfkit "create doc → collect
   * chunks → resolve Buffer" plumbing that every PDF exporter repeats. Callers
   * supply only the layout via `build(doc)`, keeping their own formatting.
   * Simple-tier exporters can adopt this without changing their output.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async renderPdf(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    build: (doc: any) => void,
    options: Record<string, unknown> = { margin: 48 }
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const tokens = tokenizeMarkdown(src.markdown);
    return this.renderPdf((doc) => {
      // Title block + lightweight metadata.
      doc
        .fontSize(20)
        .fillColor('#0f172a')
        .text(src.title || 'Untitled', { underline: true });
      doc.moveDown(0.4);
      if (src.sourceLabel) {
        doc.fontSize(9).fillColor('#475569').text(src.sourceLabel);
      }
      if (src.lifecycle) doc.fontSize(9).fillColor('#475569').text(`Lifecycle: ${src.lifecycle}`);
      if (src.updatedAt) doc.fontSize(9).fillColor('#475569').text(`Updated: ${src.updatedAt}`);
      doc.moveDown(0.6);

      // Body renderer — walks struct tokens and projects onto pdfkit primitives.
      this.renderPdfTokens(doc, tokens);
    });
  }

  /** Write a runs sequence into pdfkit, mapping emphasis to pdfkit font ops. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private writePdfRuns(doc: any, runs: InlineRun[], opts: Record<string, unknown> = {}): void {
    if (runs.length === 0) {
      doc.text(' ', opts);
      return;
    }
    runs.forEach((run, i) => {
      // pdfkit's `continued` flag chains runs onto the same line until the
      // last one (which we close with continued:false to flush).
      const continued = i < runs.length - 1;
      const fontName = run.code
        ? 'Courier'
        : run.bold && run.italic
          ? 'Helvetica-BoldOblique'
          : run.bold
            ? 'Helvetica-Bold'
            : run.italic
              ? 'Helvetica-Oblique'
              : 'Helvetica';
      doc.font(fontName).fillColor(run.href ? '#1d4ed8' : '#111827');
      doc.text(run.text || '', { ...opts, continued });
    });
    // Reset font + colour after the line so subsequent paragraphs aren't
    // styled by the last run's flags.
    doc.font('Helvetica').fillColor('#111827');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderPdfTokens(doc: any, tokens: StructToken[]): void {
    const HEADING_SIZES = [22, 18, 15, 13, 12, 11];
    for (const tok of tokens) {
      switch (tok.kind) {
        case 'heading':
          doc.moveDown(0.3);
          doc.fontSize(HEADING_SIZES[tok.depth - 1] ?? 11);
          this.writePdfRuns(doc, tok.runs);
          doc.fontSize(11);
          doc.moveDown(0.2);
          break;
        case 'paragraph':
          doc.fontSize(11);
          this.writePdfRuns(doc, tok.runs);
          doc.moveDown(0.4);
          break;
        case 'list_item': {
          const indent = tok.depth * 16;
          const bullet = tok.task ? (tok.checked ? '[x]' : '[ ]') : tok.ordered ? '•' : '•';
          doc.fontSize(11).fillColor('#111827').text(`${bullet} `, {
            indent,
            continued: true,
          });
          this.writePdfRuns(doc, tok.runs, { indent });
          break;
        }
        case 'code':
          doc.moveDown(0.2);
          doc.font('Courier').fontSize(10).fillColor('#1e293b');
          doc.text(tok.text, { width: 500 });
          doc.font('Helvetica').fontSize(11).fillColor('#111827');
          doc.moveDown(0.3);
          break;
        case 'blockquote':
          doc.fontSize(11).fillColor('#475569');
          this.writePdfRuns(doc, tok.runs, { indent: 12 });
          doc.fillColor('#111827');
          doc.moveDown(0.3);
          break;
        case 'hr':
          doc.moveDown(0.2);
          doc.strokeColor('#e2e8f0').lineWidth(0.6).moveTo(48, doc.y).lineTo(540, doc.y).stroke();
          doc.moveDown(0.4);
          break;
        case 'table': {
          // Render table as plain rows — pdfkit has no native table primitive,
          // and a hand-rolled grid is heavyweight. A pipe-separated layout
          // with bold header preserves structure for a consultant scan.
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text(tok.header.map((cell) => runsToPlainText(cell)).join('  |  '));
          doc.font('Helvetica');
          for (const row of tok.rows) {
            doc.text(row.map((cell) => runsToPlainText(cell)).join('  |  '));
          }
          doc.moveDown(0.3);
          break;
        }
        case 'space':
          doc.moveDown(0.2);
          break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // DOCX
  // -------------------------------------------------------------------------
  async exportDocx(src: ExportSource): Promise<Buffer> {
    const docx = await import('docx');
    const tokens = tokenizeMarkdown(src.markdown);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [];

    // Title block + metadata stripe.
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.TITLE,
        children: [new docx.TextRun({ text: src.title || 'Untitled', bold: true, size: 36 })],
      })
    );
    if (src.sourceLabel) {
      children.push(
        new docx.Paragraph({
          children: [new docx.TextRun({ text: src.sourceLabel, color: '475569', size: 18 })],
        })
      );
    }
    if (src.lifecycle) {
      children.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({ text: `Lifecycle: ${src.lifecycle}`, color: '475569', size: 18 }),
          ],
        })
      );
    }
    if (src.updatedAt) {
      children.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({ text: `Updated: ${src.updatedAt}`, color: '475569', size: 18 }),
          ],
        })
      );
    }
    children.push(new docx.Paragraph(''));

    // Body — walk tokens and project onto docx primitives.
    for (const tok of tokens) {
      switch (tok.kind) {
        case 'heading':
          children.push(
            new docx.Paragraph({
              heading: docx.HeadingLevel[DOCX_HEADING_LEVELS[tok.depth - 1]],
              children: tok.runs.map((r) => runToDocxRun(docx, r)),
            })
          );
          break;
        case 'paragraph':
          children.push(paragraphFromRuns(docx, tok.runs));
          break;
        case 'list_item': {
          // Word numbering / bullets need an abstract numbering reference at
          // the document level for ordered lists. For simplicity we use a
          // single reusable reference; nested levels use docx's `level` option.
          if (tok.task) {
            // Render task items inline so they look like Word checkboxes —
            // `[x] text` / `[ ] text`. A real `w:sdt` checkbox needs a content
            // control which docx 9.x doesn't expose without raw XML.
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: tok.checked ? '☑  ' : '☐  ',
                    size: 22,
                  }),
                  ...tok.runs.map((r) => runToDocxRun(docx, r)),
                ],
                indent: { left: 360 + tok.depth * 360 },
              })
            );
          } else if (tok.ordered) {
            children.push(
              new docx.Paragraph({
                numbering: { reference: 'canvas-numbered', level: Math.min(tok.depth, 3) },
                children: tok.runs.map((r) => runToDocxRun(docx, r)),
              })
            );
          } else {
            children.push(
              new docx.Paragraph({
                bullet: { level: Math.min(tok.depth, 3) },
                children: tok.runs.map((r) => runToDocxRun(docx, r)),
              })
            );
          }
          break;
        }
        case 'code': {
          // Code block: monospace font, light grey shading, preserve newlines.
          const lines = tok.text.split('\n');
          for (const line of lines) {
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: line || ' ',
                    font: 'Consolas',
                    size: 18,
                  }),
                ],
                shading: { type: docx.ShadingType.SOLID, color: 'F1F5F9', fill: 'F1F5F9' },
              })
            );
          }
          children.push(new docx.Paragraph(''));
          break;
        }
        case 'blockquote':
          children.push(
            new docx.Paragraph({
              style: 'IntenseQuote',
              children: tok.runs.map((r) => runToDocxRun(docx, r)),
            })
          );
          break;
        case 'hr':
          children.push(
            new docx.Paragraph({
              border: { bottom: { color: 'CBD5E1', space: 1, style: 'single', size: 6 } },
            })
          );
          break;
        case 'table': {
          // Real docx.Table with header row bolded + light fill. Column count
          // = header length; ragged rows are padded with empty cells.
          const cols = tok.header.length || (tok.rows[0]?.length ?? 1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const headerCells = tok.header.map(
            (cell) =>
              new docx.TableCell({
                shading: { type: docx.ShadingType.SOLID, color: 'E2E8F0', fill: 'E2E8F0' },
                children: [
                  new docx.Paragraph({
                    children: cell.map(
                      (r) => new docx.TextRun({ ...{ ...r, italics: r.italic }, bold: true })
                    ),
                  }),
                ],
              })
          );
          const headerRow = new docx.TableRow({ children: headerCells });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bodyRows = tok.rows.map((row) => {
            const padded = [...row];
            while (padded.length < cols) padded.push([]);
            return new docx.TableRow({
              children: padded.map(
                (cell) =>
                  new docx.TableCell({
                    children: [
                      new docx.Paragraph({
                        children: cell.map((r) => runToDocxRun(docx, r)),
                      }),
                    ],
                  })
              ),
            });
          });
          children.push(
            new docx.Table({
              rows: [headerRow, ...bodyRows],
              width: { size: 100, type: docx.WidthType.PERCENTAGE },
            })
          );
          children.push(new docx.Paragraph(''));
          break;
        }
        case 'space':
          children.push(new docx.Paragraph(''));
          break;
      }
    }

    // Numbering definitions for ordered lists. Provide four levels for the
    // common nested-list case. Without a numbering config, docx's `numbering`
    // reference silently no-ops and the items render as plain paragraphs.
    const numbering: import('docx').INumberingOptions = {
      config: [
        {
          reference: 'canvas-numbered',
          levels: [
            {
              level: 0,
              format: docx.LevelFormat.DECIMAL,
              text: '%1.',
              alignment: docx.AlignmentType.START,
            },
            {
              level: 1,
              format: docx.LevelFormat.LOWER_LETTER,
              text: '%2.',
              alignment: docx.AlignmentType.START,
            },
            {
              level: 2,
              format: docx.LevelFormat.LOWER_ROMAN,
              text: '%3.',
              alignment: docx.AlignmentType.START,
            },
            {
              level: 3,
              format: docx.LevelFormat.DECIMAL,
              text: '%4.',
              alignment: docx.AlignmentType.START,
            },
          ],
        },
      ],
    };

    const document = new docx.Document({
      creator: src.author || 'Consultify Work Canvas',
      title: src.title || 'Canvas Export',
      numbering,
      styles: {
        default: {
          document: { run: { font: 'Calibri', size: 22 } },
        },
      },
      sections: [{ properties: {}, children }],
    });
    return Buffer.from(await docx.Packer.toBuffer(document));
  }

  // -------------------------------------------------------------------------
  // XLSX
  // -------------------------------------------------------------------------
  /**
   * Quote-aware CSV row parser — the prior naive `line.split(',')` fragmented
   * cells containing escaped commas inside quoted fields. RFC 4180-ish.
   */
  private parseCsvRow(line: string): string[] {
    const out: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += ch;
        }
      } else if (ch === '"' && cell.length === 0) {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cell);
        cell = '';
      } else {
        cell += ch;
      }
    }
    out.push(cell);
    return out;
  }

  async exportXlsx(src: ExportSource): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExcelJS = (await import('exceljs')).default as any;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = src.author || 'Business Work Canvas';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Canvas Export');
    (src.csv || '').split('\n').forEach((line) => {
      sheet.addRow(this.parseCsvRow(line));
    });
    sheet.addRow([]);
    sheet.addRow(['Source Canvas', src.sourceLabel]);
    sheet.addRow(['Lifecycle', src.lifecycle]);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // -------------------------------------------------------------------------
  // PPTX
  // -------------------------------------------------------------------------
  /**
   * Low-level, layout-agnostic PPTX primitive: the pptxgenjs "import → new →
   * write nodebuffer" plumbing. Callers build their own slides via build(pptx)
   * (they may set pptx.layout, use pptx.ShapeType, addSlide, etc.). Simple-tier
   * deck generators can adopt this without changing their layout.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async renderPptx(build: (pptx: any) => void): Promise<Buffer> {
    const module = await import('pptxgenjs');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PptxGenJS = (module.default || module) as any;
    const pptx = new PptxGenJS();
    build(pptx);
    const output = await pptx.write({ outputType: 'nodebuffer' });
    return Buffer.from(output);
  }

  /**
   * Convert a markdown body into the array-of-paragraph shape pptxgenjs's
   * addText accepts (each entry can have text, bold, italic, bullet, etc.).
   * Headings inside a slide body become a bold sub-paragraph; list items
   * become bulleted paragraphs at the right indent level; paragraphs stay
   * as plain text with inline emphasis.
   */
  private slideBodyParagraphs(
    markdown: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Array<Record<string, any>> {
    const tokens = tokenizeMarkdown(markdown || '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paragraphs: Array<Record<string, any>> = [];

    const runOptions = (run: InlineRun) => ({
      bold: run.bold || undefined,
      italic: run.italic || undefined,
      fontFace: run.code ? 'Consolas' : undefined,
      strike: run.strike || undefined,
      color: run.href ? '1D4ED8' : undefined,
      underline: run.href ? { style: 'sng' } : undefined,
    });

    const flushRuns = (
      runs: InlineRun[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: Record<string, any> = {}
    ) => {
      if (runs.length === 0) {
        paragraphs.push({ text: ' ', options: { ...extra, breakLine: true } });
        return;
      }
      runs.forEach((run, i) => {
        paragraphs.push({
          text: run.text || '',
          options: {
            ...runOptions(run),
            ...extra,
            // Only the last run in a paragraph carries the line break so all
            // emphasis runs concatenate onto the same line.
            breakLine: i === runs.length - 1,
          },
        });
      });
    };

    for (const tok of tokens) {
      switch (tok.kind) {
        case 'heading':
          flushRuns(tok.runs, {
            bold: true,
            fontSize: tok.depth === 1 ? 18 : tok.depth === 2 ? 16 : 14,
          });
          break;
        case 'paragraph':
          flushRuns(tok.runs, { fontSize: 13 });
          break;
        case 'list_item':
          flushRuns(tok.runs, {
            bullet: tok.ordered
              ? { type: 'number', indent: 18 + tok.depth * 18 }
              : { indent: 18 + tok.depth * 18 },
            fontSize: 13,
          });
          break;
        case 'code': {
          const lines = tok.text.split('\n');
          for (const line of lines) {
            paragraphs.push({
              text: line || ' ',
              options: { fontFace: 'Consolas', fontSize: 11, color: '1E293B', breakLine: true },
            });
          }
          break;
        }
        case 'blockquote':
          flushRuns(tok.runs, { italic: true, color: '475569', fontSize: 13 });
          break;
        case 'table': {
          // Tables-in-slide-body: collapse to per-row text. A real pptxgenjs
          // table would need a separate `slide.addTable` placement and would
          // overflow the body region the caller laid out.
          flushRuns(([] as InlineRun[]).concat(...tok.header), { bold: true, fontSize: 11 });
          for (const row of tok.rows) {
            const rowRuns: InlineRun[] = ([] as InlineRun[]).concat(...row);
            flushRuns(rowRuns, { fontSize: 11 });
          }
          break;
        }
        case 'hr':
        case 'space':
          paragraphs.push({ text: ' ', options: { fontSize: 8, breakLine: true } });
          break;
      }
    }

    return paragraphs;
  }

  async exportPptx(src: ExportSource): Promise<Buffer> {
    return this.renderPptx((pptx) => {
      pptx.author = src.author || 'Business Work Canvas';
      const slides =
        src.slides && src.slides.length ? src.slides : [{ title: src.title, body: src.markdown }];
      slides.slice(0, 20).forEach((slide, index) => {
        const page = pptx.addSlide();
        page.addText(slide.title, { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 24, bold: true });
        const bodyParagraphs = this.slideBodyParagraphs(slide.body || '');
        page.addText(bodyParagraphs.length ? bodyParagraphs : 'No slide body available.', {
          x: 0.5,
          y: 1.1,
          w: 9,
          h: 5.4,
          fontSize: 13,
          valign: 'top',
          fit: 'shrink',
        });
        if (src.sourceLabel) {
          page.addText(`${src.sourceLabel} · Slide ${index + 1}`, {
            x: 0.5,
            y: 6.8,
            w: 9,
            h: 0.3,
            fontSize: 8,
            color: '64748B',
          });
        }
      });
    });
  }
}

export const unifiedExportService = new UnifiedExportService();
export type { UnifiedExportService };
