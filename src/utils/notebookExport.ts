/**
 * M04 Living Notebook — Agent 5: portable export of a notebook page.
 *
 * Formats:
 *   - Markdown: reuses `notebookContentToMarkdown` (single source of truth for
 *     TipTap-JSON → markdown, shared with the "expand to document" pipeline).
 *   - PDF: jsPDF text rendering (no html2canvas / DOM dependency) when jsPDF is
 *     available; falls back to an HTML print window otherwise.
 *   - DOCX: best-effort via the `docx` package (dynamic import); if unavailable
 *     it degrades to a Markdown download with a `.md` extension.
 *
 * All public functions are pure where possible (string builders) so they can be
 * unit-tested, with the browser-only download glue isolated behind guards.
 */

import { notebookContentToMarkdown } from '@/components/MyWork/notebook/notebookExpandToDocument';

/**
 * Brand-consistent export palette (navy / teal). Exports render outside the app
 * (standalone HTML window / jsPDF), so CSS vars are unavailable — these fixed
 * values mirror the DBR77 navy ink used across pdfExport.ts. NEVER var() here.
 */
const EXPORT_COLORS = {
  htmlInk: '#0f172a', // navy-900 — body text in standalone HTML export
  ink: [15, 23, 42] as [number, number, number], // navy-900 — PDF body/headings
  navy: [15, 23, 42] as [number, number, number], // brand navy — title
  inkMuted: [100, 116, 128] as [number, number, number], // slate-500 — captions
  hairline: [203, 210, 218] as [number, number, number], // separators
};

export interface NotebookExportPage {
  id?: string;
  title?: string | null;
  contentJson?: unknown;
  contentText?: string | null;
}

export type NotebookExportFormat = 'markdown' | 'pdf' | 'docx';

const sanitizeFilename = (name: string): string =>
  String(name || 'note')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'note';

/** Build the full Markdown document (front-matter title + body). */
export function buildNotebookMarkdown(page: NotebookExportPage): string {
  const title = String(page.title || '').trim() || 'Untitled note';
  const body = notebookContentToMarkdown(page.contentJson, page.contentText);
  return `# ${title}\n\n${body}`.trim() + '\n';
}

/** Build a printable HTML document (used by the print-fallback path). */
export function buildNotebookPrintHtml(page: NotebookExportPage): string {
  const title = String(page.title || '').trim() || 'Untitled note';
  const md = notebookContentToMarkdown(page.contentJson, page.contentText);
  // Minimal markdown → HTML for print: headings, lists, paragraphs.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const htmlParts: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      htmlParts.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
    } else if (bullet) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${escapeHtml(bullet[1])}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      htmlParts.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:${EXPORT_COLORS.htmlInk};line-height:1.6}
    h1{font-size:1.875rem}h2{font-size:1.5rem}h3{font-size:1.25rem}
    ul{padding-left:1.25rem}
  </style></head><body><h1>${escapeHtml(title)}</h1>${htmlParts.join('')}</body></html>`;
}

/** Trigger a browser download of a Blob. No-op outside the browser. */
function triggerDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the page as a Markdown file. */
export function exportNotebookAsMarkdown(page: NotebookExportPage): void {
  const md = buildNotebookMarkdown(page);
  const filename = `${sanitizeFilename(String(page.title || 'note'))}.md`;
  triggerDownload(new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename);
}

/**
 * Export the page as a PDF. Uses jsPDF text rendering when available; otherwise
 * opens a print window with the HTML rendering (browser "Save as PDF").
 */
export async function exportNotebookAsPdf(page: NotebookExportPage): Promise<void> {
  const title = String(page.title || '').trim() || 'Untitled note';
  const md = notebookContentToMarkdown(page.contentJson, page.contentText);

  try {
    const mod = await import('jspdf');
    const JsPDF = (mod as any).default || (mod as any).jsPDF;
    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const addPageIfNeeded = (need: number) => {
      if (y + need > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    pdf.setFontSize(20);
    pdf.setTextColor(...EXPORT_COLORS.navy);
    pdf.text(title, margin, y + 6);
    y += 14;
    pdf.setFontSize(9);
    pdf.setTextColor(...EXPORT_COLORS.inkMuted);
    pdf.text(`Exported ${new Date().toLocaleString()} • Consultify`, margin, y);
    y += 6;
    pdf.setDrawColor(...EXPORT_COLORS.hairline);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;

    for (const raw of md.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (line.trim() === '') {
        y += 3;
        continue;
      }
      if (heading) {
        const level = heading[1].length;
        const size = Math.max(11, 18 - (level - 1) * 2);
        addPageIfNeeded(size * 0.6);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(size);
        pdf.setTextColor(...EXPORT_COLORS.ink);
        const wrapped = pdf.splitTextToSize(heading[2], maxWidth);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * (size * 0.42) + 2;
        continue;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...EXPORT_COLORS.ink);
      const wrapped = pdf.splitTextToSize(line, maxWidth);
      addPageIfNeeded(wrapped.length * 5);
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 5 + 1;
    }

    pdf.save(`${sanitizeFilename(title)}.pdf`);
    return;
  } catch {
    // jsPDF unavailable / failed — fall back to print window.
    if (typeof window !== 'undefined') {
      const html = buildNotebookPrintHtml(page);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
        return;
      }
    }
    // Last resort: download HTML the user can print.
    triggerDownload(
      new Blob([buildNotebookPrintHtml(page)], { type: 'text/html;charset=utf-8' }),
      `${sanitizeFilename(title)}.html`
    );
  }
}

/**
 * Export the page as a DOCX (best-effort). Uses the `docx` package via dynamic
 * import; if it is unavailable, degrades to a Markdown download.
 */
export async function exportNotebookAsDocx(page: NotebookExportPage): Promise<void> {
  const title = String(page.title || '').trim() || 'Untitled note';
  const md = notebookContentToMarkdown(page.contentJson, page.contentText);

  try {
    const docx: any = await import('docx');
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx;
    const headingForLevel = (lvl: number) =>
      [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ][Math.min(Math.max(lvl, 1), 6) - 1];

    const children: any[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
    for (const raw of md.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      const bullet = /^[-*]\s+(.*)$/.exec(line);
      if (line.trim() === '') {
        continue;
      }
      if (heading) {
        children.push(
          new Paragraph({ text: heading[2], heading: headingForLevel(heading[1].length) })
        );
      } else if (bullet) {
        children.push(new Paragraph({ text: bullet[1], bullet: { level: 0 } }));
      } else {
        children.push(new Paragraph({ children: [new TextRun(line)] }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const blob: Blob = await Packer.toBlob(doc);
    triggerDownload(blob, `${sanitizeFilename(title)}.docx`);
    return;
  } catch {
    // docx unavailable — degrade to markdown so the user still gets a file.
    exportNotebookAsMarkdown(page);
  }
}

/** Dispatch by format. */
export async function exportNotebookPage(
  page: NotebookExportPage,
  format: NotebookExportFormat
): Promise<void> {
  switch (format) {
    case 'markdown':
      exportNotebookAsMarkdown(page);
      return;
    case 'pdf':
      await exportNotebookAsPdf(page);
      return;
    case 'docx':
      await exportNotebookAsDocx(page);
      return;
    default:
      exportNotebookAsMarkdown(page);
  }
}
