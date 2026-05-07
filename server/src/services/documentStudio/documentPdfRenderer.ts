/**
 * Consultify Document Studio — PDF renderer (MVP-1 finalization).
 *
 * Schema-aware PDF renderer using `pdfkit`. Honors the document's
 * `FormattingSchema` (page size, margins, headers, footers, page numbering,
 * confidentiality label) so the output reads as a real consulting deliverable.
 *
 * The renderer streams `pdfkit` output into an in-memory Buffer so it can be
 * returned through the existing wave5 export pipeline as `contentBase64`.
 *
 * Out of scope for MVP-1 finalization: image embedding, rich charts,
 * watermarking, custom fonts beyond the system stack. These are reserved for
 * MVP-4 advanced export.
 */

import PDFDocument from 'pdfkit';

import type {
  DocumentBlock,
  DocumentSchema,
  DocumentSection,
  FormattingSchema,
} from './documentStudioTypes.js';

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

function drawCover(doc: PDFKit.PDFDocument, schema: DocumentSchema): void {
  const generatedAt = new Date(schema.updatedAt || schema.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  const audience = schema.audience.length > 0 ? schema.audience.join(', ') : 'Internal';
  const subtitle = `${schema.documentType.replace(/_/g, ' ')} · ${schema.language.toUpperCase()} · ${schema.density} · ${schema.confidentiality}`;
  doc.moveDown(4);
  doc.fontSize(28).fillColor('#0F172A').text(schema.title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#475569').text(subtitle, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#64748B').text(`Audience: ${audience}`, { align: 'center' });
  doc.fontSize(10).fillColor('#94A3B8').text(`Generated: ${generatedAt}`, { align: 'center' });
  doc.addPage();
}

function drawHeading(doc: PDFKit.PDFDocument, text: string, level: 1 | 2 | 3): void {
  const sizes: Record<1 | 2 | 3, number> = { 1: 16, 2: 13, 3: 11 };
  const colors: Record<1 | 2 | 3, string> = { 1: '#0F172A', 2: '#1E293B', 3: '#334155' };
  doc.moveDown(level === 1 ? 0.7 : 0.4);
  doc.fontSize(sizes[level]).fillColor(colors[level]).font('Helvetica-Bold').text(text);
  doc.moveDown(0.2);
  doc.font('Helvetica');
}

function drawParagraph(doc: PDFKit.PDFDocument, block: DocumentBlock): void {
  const value = (block.content ?? {}) as BlockTextContent;
  const text = asString(value.text ?? '');
  if (!text) return;
  if (block.isAssumption) {
    doc.fontSize(11).fillColor('#92400E').font('Helvetica-Oblique').text(text, { continued: true });
    doc
      .fontSize(9)
      .fillColor('#B45309')
      .text('  [Assumption — needs source]', { continued: false });
  } else {
    doc.fontSize(11).fillColor('#0F172A').font('Helvetica').text(text);
  }
  doc.moveDown(0.4);
}

function drawList(doc: PDFKit.PDFDocument, block: DocumentBlock): void {
  const value = (block.content ?? {}) as BlockListContent;
  const items = Array.isArray(value.items) ? value.items : [];
  const numbered = value.style === 'numbered' || block.type === 'numbered_list';
  doc.fontSize(11).fillColor('#0F172A').font('Helvetica');
  items.forEach((raw, idx) => {
    const prefix = numbered ? `${idx + 1}. ` : '• ';
    doc.text(`${prefix}${asString(raw)}`, { indent: 12 });
  });
  if (block.isAssumption) {
    doc
      .fontSize(9)
      .fillColor('#B45309')
      .font('Helvetica-Oblique')
      .text('  [Assumption — needs source]', { indent: 12 });
    doc.font('Helvetica');
  }
  doc.moveDown(0.4);
}

function drawCallout(doc: PDFKit.PDFDocument, block: DocumentBlock): void {
  const value = (block.content ?? {}) as BlockCalloutContent;
  const text = asString(value.text ?? '');
  if (!text) return;
  const label = value.variant ? `[${String(value.variant).toUpperCase()}] ` : '[Key message] ';
  doc
    .fontSize(11)
    .fillColor('#4338CA')
    .font('Helvetica-Bold')
    .text(label, { continued: true })
    .font('Helvetica-Oblique')
    .fillColor('#0F172A')
    .text(text, { continued: false });
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawQuote(doc: PDFKit.PDFDocument, block: DocumentBlock): void {
  const value = (block.content ?? {}) as BlockTextContent & { attribution?: string };
  const text = asString(value.text ?? '');
  if (!text) return;
  const attribution = value.attribution ? ` — ${asString(value.attribution)}` : '';
  doc
    .fontSize(11)
    .fillColor('#475569')
    .font('Helvetica-Oblique')
    .text(`“${text}”${attribution}`, { indent: 18 });
  doc.font('Helvetica');
  doc.moveDown(0.4);
}

function drawTable(doc: PDFKit.PDFDocument, block: DocumentBlock): void {
  const value = (block.content ?? {}) as BlockTableContent;
  const headers = Array.isArray(value.headers) ? value.headers : [];
  const rows = Array.isArray(value.rows) ? value.rows : [];
  if (headers.length === 0 && rows.length === 0) {
    doc
      .fontSize(10)
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .text('[Table placeholder — populate with structured data once sources are attached.]');
    doc.font('Helvetica');
    doc.moveDown(0.4);
    return;
  }
  doc.fontSize(10).fillColor('#0F172A').font('Helvetica');
  if (headers.length > 0) {
    doc.font('Helvetica-Bold').text(headers.map((h) => asString(h)).join(' | '));
    doc.font('Helvetica');
  }
  for (const row of rows) {
    const cells = Array.isArray(row) ? row.map((c) => asString(c)) : [];
    doc.text(cells.join(' | '));
  }
  doc.moveDown(0.4);
}

function drawBlock(doc: PDFKit.PDFDocument, block: DocumentBlock): void {
  switch (block.type) {
    case 'heading': {
      const value = (block.content ?? {}) as { text?: string; level?: 1 | 2 | 3 };
      drawHeading(doc, asString(value.text ?? ''), value.level ?? 2);
      return;
    }
    case 'paragraph':
      drawParagraph(doc, block);
      return;
    case 'bullet_list':
    case 'numbered_list':
      drawList(doc, block);
      return;
    case 'callout':
      drawCallout(doc, block);
      return;
    case 'quote':
      drawQuote(doc, block);
      return;
    case 'table':
    case 'risk_table':
    case 'kpi_strip':
      drawTable(doc, block);
      return;
    case 'image':
    case 'footnote':
    case 'citation':
    default:
      drawParagraph(doc, block);
      return;
  }
}

function drawSection(doc: PDFKit.PDFDocument, section: DocumentSection, index: number): void {
  drawHeading(doc, `${index + 1}. ${section.title}`, section.level ?? 1);
  if (section.purpose) {
    doc.fontSize(9).fillColor('#64748B').font('Helvetica-Oblique').text(section.purpose);
    doc.font('Helvetica');
    doc.moveDown(0.3);
  }
  for (const block of section.blocks) drawBlock(doc, block);
}

function drawSources(doc: PDFKit.PDFDocument, schema: DocumentSchema): void {
  drawHeading(doc, 'Sources & traceability', 1);
  if (schema.sourceRefs.length === 0) {
    doc
      .fontSize(11)
      .fillColor('#92400E')
      .font('Helvetica-Oblique')
      .text(
        'No sources attached. Substantive content blocks are flagged as assumptions and require a source pack before client distribution.'
      );
    doc.font('Helvetica');
    return;
  }
  doc.fontSize(11).fillColor('#0F172A').font('Helvetica');
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
    doc
      .save()
      .fontSize(9)
      .fillColor('#64748B')
      .font('Helvetica')
      .text(schema.title, margins.left, 22, {
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
      doc
        .save()
        .fontSize(8)
        .fillColor('#94A3B8')
        .font('Helvetica')
        .text(`${pageNumber} / ${totalPages}`, margins.left, footerY, {
          align: 'right',
          width: doc.page.width - margins.left - margins.right,
        })
        .restore();
    }
  }
}

export async function renderDocumentSchemaToPdfBuffer(schema: DocumentSchema): Promise<Buffer> {
  const formatting = schema.formattingSchema;
  const margins = marginsInPoints(formatting);
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: pageSize(formatting),
        margins,
        bufferPages: true,
        info: {
          Title: schema.title,
          Author: 'Consultify Document Studio',
          Subject: schema.documentType,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      if (formatting.coverPage) drawCover(doc, schema);
      schema.sections.forEach((section, index) => drawSection(doc, section, index));
      drawSources(doc, schema);

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
