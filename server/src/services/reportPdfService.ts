/**
 * Consultify M14 / ExecutionHub — server-side Status Report PDF renderer.
 *
 * Slice F8 (8.4): status reports historically only had a client-side export
 * (`window.print` / Markdown copy). For an audit trail we need a deterministic,
 * server-generated PDF that does not depend on a browser being open.
 *
 * This service is PURE: it maps a status-report object to a PDF `Buffer`. It
 * performs no DB access and has no side effects, so it can be unit-tested and
 * reused from any route (download, scheduled email, audit archive).
 *
 * The PDF is produced with `pdfkit` (already a server dependency — see
 * `documentStudio/documentPdfRenderer.ts`), using the same in-memory streaming
 * pattern (collect `data` chunks → `Buffer.concat`). No new dependency added.
 *
 * Input shape is intentionally tolerant: it accepts the object emitted by
 * `StatusReportService.generateReport` (sections as a `{ NAME: {...} }` map and
 * narrative fields nested under `narrative`) as well as a flattened shape
 * (`executiveSummary` at top level, `sections` as an array). Normalization
 * lives in `normalizeReport` so the drawing code stays simple.
 */

import PDFDocument from 'pdfkit';

/** RAG status accent colors — mirror StatusReportService.RAG_STATUS. */
const RAG_COLOR: Record<string, string> = {
  GREEN: '#16A34A',
  AMBER: '#D97706',
  RED: '#DC2626',
  NA: '#6B7280',
};

const INK = '#111827';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';

/** A single RAG-scored section of the report. */
export interface ReportPdfSection {
  /** Section name/label, e.g. "SCHEDULE", "BUDGET". */
  name: string;
  /** RAG status: GREEN | AMBER | RED | NA (case-insensitive). */
  status?: string;
  /** Narrative body for the section. */
  content?: string;
  /** Positive highlights for the period. */
  highlights?: string[];
  /** Open issues / concerns for the period. */
  issues?: string[];
}

/** Narrative block of a status report. */
export interface ReportPdfNarrative {
  executiveSummary?: string;
  accomplishments?: string[] | string;
  nextSteps?: string[] | string;
  escalations?: string[] | string;
  risksAndIssues?: string;
  recommendations?: string;
}

/**
 * Input contract for {@link renderReportPdf}. Tolerant of both the
 * `StatusReportService.generateReport` output and a flattened caller shape.
 */
export interface ReportPdfInput {
  /** Report title (falls back to initiative name). */
  title?: string;
  initiativeName?: string;
  /** Human period label, e.g. "Q2 2026" / "Week 24, 2026". */
  period?: string;
  periodLabel?: string;
  periodType?: string;
  /** Overall RAG roll-up. */
  overallStatus?: string;
  /** Sections as an array OR as a `{ NAME: {...} }` map. */
  sections?: ReportPdfSection[] | Record<string, Omit<ReportPdfSection, 'name'>>;
  /** Executive summary text (top-level convenience alias for narrative). */
  executiveSummary?: string;
  /** Nested narrative (as produced by StatusReportService). */
  narrative?: ReportPdfNarrative;
  /** Optional generation timestamp; defaults to now. */
  generatedAt?: string | Date;
}

interface NormalizedReport {
  title: string;
  period: string;
  overallStatus: string;
  sections: ReportPdfSection[];
  narrative: ReportPdfNarrative;
  generatedAt: Date;
}

function asLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter((v) => v.length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

/** Coerce the tolerant input into a single deterministic shape for drawing. */
function normalizeReport(input: ReportPdfInput): NormalizedReport {
  const title = (input.title ?? input.initiativeName ?? 'Status Report').toString().trim();
  const period = (input.period ?? input.periodLabel ?? input.periodType ?? '—').toString().trim();

  let sections: ReportPdfSection[] = [];
  if (Array.isArray(input.sections)) {
    sections = input.sections.map((s) => ({ ...s, name: (s.name ?? '').toString() }));
  } else if (input.sections && typeof input.sections === 'object') {
    sections = Object.entries(input.sections).map(([name, value]) => ({
      name,
      ...(value as Omit<ReportPdfSection, 'name'>),
    }));
  }

  const narrative: ReportPdfNarrative = { ...(input.narrative ?? {}) };
  if (input.executiveSummary && !narrative.executiveSummary) {
    narrative.executiveSummary = input.executiveSummary;
  }

  let generatedAt: Date;
  if (input.generatedAt instanceof Date) {
    generatedAt = input.generatedAt;
  } else if (typeof input.generatedAt === 'string' && input.generatedAt.trim()) {
    const parsed = new Date(input.generatedAt);
    generatedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    generatedAt = new Date();
  }

  return {
    title: title || 'Status Report',
    period: period || '—',
    overallStatus: (input.overallStatus ?? 'NA').toString().toUpperCase(),
    sections,
    narrative,
    generatedAt,
  };
}

function ragColor(status: string | undefined): string {
  return RAG_COLOR[(status ?? 'NA').toUpperCase()] ?? RAG_COLOR.NA;
}

/** Draw the colored RAG pill at (x, y); returns the width consumed. */
function drawRagPill(doc: PDFKit.PDFDocument, status: string, x: number, y: number): number {
  const label = (status ?? 'NA').toUpperCase();
  const color = ragColor(label);
  doc.font('Helvetica-Bold').fontSize(9);
  const padX = 6;
  const textWidth = doc.widthOfString(label);
  const pillWidth = textWidth + padX * 2;
  const pillHeight = 14;
  doc.save();
  doc.roundedRect(x, y, pillWidth, pillHeight, 3).fill(color);
  doc.fillColor('#FFFFFF').text(label, x + padX, y + 3, { lineBreak: false });
  doc.restore();
  doc.fillColor(INK);
  return pillWidth;
}

function drawSectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
  doc.moveDown(0.6);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(text);
  const y = doc.y + 2;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke();
  doc.moveDown(0.4);
  doc.fillColor(INK);
}

function drawParagraph(doc: PDFKit.PDFDocument, text: string): void {
  doc.fillColor(INK).font('Helvetica').fontSize(10).text(text, { align: 'left' });
  doc.moveDown(0.3);
}

function drawBulletList(doc: PDFKit.PDFDocument, items: string[]): void {
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  for (const item of items) {
    doc.text(`•  ${item}`, { indent: 8, align: 'left' });
  }
  doc.moveDown(0.3);
}

/**
 * Render a status report into a PDF document and return it as a `Buffer`.
 *
 * Pure function: data in → bytes out. The returned Buffer begins with the
 * `%PDF` magic header.
 */
export async function renderReportPdf(input: ReportPdfInput): Promise<Buffer> {
  const report = normalizeReport(input);

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 56, bottom: 56, left: 56, right: 56 },
        bufferPages: true,
        info: {
          Title: report.title,
          Author: 'Consultify ExecutionHub',
          Subject: `Status Report · ${report.period}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // ---- Header block -------------------------------------------------
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('STATUS REPORT');
      doc.moveDown(0.2);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(report.title);
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(10).fillColor(MUTED);
      doc.text(`Period: ${report.period}`, { continued: false });
      doc.text(`Generated: ${report.generatedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC`);
      doc.moveDown(0.4);

      // Overall RAG roll-up.
      const overallY = doc.y;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Overall status: ', {
        continued: true,
      });
      const pillX = doc.x;
      // text(continued) left the cursor inline; place pill on same baseline.
      doc.text(' ', { continued: false });
      drawRagPill(doc, report.overallStatus, pillX + 2, overallY - 2);
      doc.moveDown(0.6);

      // Header rule.
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .lineWidth(1)
        .strokeColor(INK)
        .stroke();
      doc.moveDown(0.4);

      // ---- Executive summary -------------------------------------------
      if (report.narrative.executiveSummary) {
        drawSectionHeading(doc, 'Executive Summary');
        drawParagraph(doc, report.narrative.executiveSummary);
      }

      // ---- RAG sections -------------------------------------------------
      if (report.sections.length > 0) {
        drawSectionHeading(doc, 'Section Status');
        for (const section of report.sections) {
          if (doc.y > doc.page.height - doc.page.margins.bottom - 50) doc.addPage();
          const rowY = doc.y;
          // Draw the RAG pill first (absolute placement on the right) so the
          // following heading text-flow is not width-constrained into a narrow
          // column (which would wrap the label mid-word). The pill uses
          // save()/restore() and does not move the layout cursor permanently.
          drawRagPill(
            doc,
            section.status ?? 'NA',
            doc.page.width - doc.page.margins.right - 56,
            rowY
          );
          doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
          doc.text(section.name || 'Section', doc.page.margins.left, rowY, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 64,
            lineBreak: false,
          });
          if (section.content) drawParagraph(doc, section.content);
          const highlights = asLines(section.highlights);
          const issues = asLines(section.issues);
          if (highlights.length > 0) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('Highlights');
            drawBulletList(doc, highlights);
          }
          if (issues.length > 0) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('Issues');
            drawBulletList(doc, issues);
          }
          doc.moveDown(0.2);
        }
      }

      // ---- Narrative sub-blocks ----------------------------------------
      const accomplishments = asLines(report.narrative.accomplishments);
      if (accomplishments.length > 0) {
        drawSectionHeading(doc, 'Accomplishments');
        drawBulletList(doc, accomplishments);
      }

      const nextSteps = asLines(report.narrative.nextSteps);
      if (nextSteps.length > 0) {
        drawSectionHeading(doc, 'Next Steps');
        drawBulletList(doc, nextSteps);
      }

      const escalations = asLines(report.narrative.escalations);
      if (escalations.length > 0) {
        drawSectionHeading(doc, 'Escalations');
        drawBulletList(doc, escalations);
      }

      if (report.narrative.risksAndIssues) {
        drawSectionHeading(doc, 'Risks & Issues');
        drawParagraph(doc, report.narrative.risksAndIssues);
      }

      if (report.narrative.recommendations) {
        drawSectionHeading(doc, 'Recommendations');
        drawParagraph(doc, report.narrative.recommendations);
      }

      // ---- Footer (audit trail) on every page --------------------------
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - doc.page.margins.bottom + 18;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(
            `Consultify ExecutionHub · ${report.title} · ${report.period}`,
            doc.page.margins.left,
            footerY,
            { lineBreak: false }
          );
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          doc.page.width - doc.page.margins.right - 80,
          footerY,
          { width: 80, align: 'right', lineBreak: false }
        );
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export default { renderReportPdf };
