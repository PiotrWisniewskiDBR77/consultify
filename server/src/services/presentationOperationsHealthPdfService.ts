/**
 * presentationOperationsHealthPdfService
 *
 * Pure HTML rendering for the SuperAdmin "Operations Health" scoreboard.
 *
 * The service is intentionally side-effect free and HTTP-agnostic:
 *
 *   - {@link renderOperationsHealthHtml} returns a self-contained, offline-
 *     friendly HTML document plus a suggested filename and MIME type. The
 *     route layer is responsible for setting `Content-Type` /
 *     `Content-Disposition` headers and writing the body.
 *   - The page is optimized for A4 portrait via `@page` CSS so subscribers
 *     can use the browser's "Print to PDF" / Save-as-PDF flow without any
 *     server-side headless browser. A banner at the very top of the document
 *     reminds the reader to press ⌘P / Ctrl+P.
 *
 * ### HTML and real PDF
 *
 * `renderOperationsHealthHtml` is the side-effect-free HTML producer and
 * stays the safe default. `renderOperationsHealthPdf` is the real
 * HTML-to-PDF entrypoint that is backed by Playwright's chromium runtime
 * (already a dev dependency for E2E tests). The PDF function probes
 * availability via `playwrightPdfRenderer` — when chromium is missing, the
 * function transparently falls back to delivering the same HTML document
 * (`status: 'html_fallback'`) so callers can keep one code path.
 *
 * The renderer is schema-tolerant: nullable observed values, empty job
 * tables, missing alert counters, and absent warnings are all rendered as
 * neutral placeholders. The renderer NEVER throws.
 */

import {
  isPlaywrightPdfRendererAvailable,
  renderHtmlToPdf,
} from './playwrightPdfRenderer.js';
import type { OperationsHealthReport } from './presentationOperationsHealthService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RenderOpsHealthHtmlInput {
  report: OperationsHealthReport;
  organizationName?: string | null;
  generatedBy?: string | null;
  /** e.g. 'CONFIDENTIAL' — rendered as a repeated diagonal background. */
  watermark?: string | null;
}

export interface RenderOpsHealthHtmlResult {
  html: string;
  filename: string;
  mimeType: 'text/html' | 'application/pdf';
}

// ---------------------------------------------------------------------------
// Theme — kept in one place so tests can assert on the tone tokens.
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<
  'pass' | 'at_risk' | 'breach' | 'inconclusive',
  { background: string; color: string; border: string; label: string }
> = {
  pass: {
    background: '#d1fae5', // emerald-100
    color: '#065f46', // emerald-800
    border: '#10b981', // emerald-500
    label: 'Pass',
  },
  at_risk: {
    background: '#fef3c7', // amber-100
    color: '#92400e', // amber-800
    border: '#f59e0b', // amber-500
    label: 'At risk',
  },
  breach: {
    background: '#ffe4e6', // rose-100
    color: '#9f1239', // rose-800
    border: '#f43f5e', // rose-500
    label: 'Breach',
  },
  inconclusive: {
    background: '#f1f5f9', // slate-100
    color: '#334155', // slate-700
    border: '#94a3b8', // slate-400
    label: 'Inconclusive',
  },
};

const JOB_STATUS_TONE: Record<
  'pass' | 'fail' | 'unknown',
  { background: string; color: string; label: string }
> = {
  pass: { background: '#d1fae5', color: '#065f46', label: 'Pass' },
  fail: { background: '#ffe4e6', color: '#9f1239', label: 'Fail' },
  unknown: { background: '#f1f5f9', color: '#334155', label: 'Unknown' },
};

// ---------------------------------------------------------------------------
// HTML escaping & slug helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Letters that NFKD does NOT decompose (e.g. Polish 'ł', German 'ß'). Map them
// explicitly so the filename slug stays meaningful for non-ASCII org names.
const SLUG_TRANSLIT: Record<string, string> = {
  ł: 'l',
  Ł: 'l',
  ø: 'o',
  Ø: 'o',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  ß: 'ss',
  đ: 'd',
  Đ: 'd',
};

function slugify(value: string | null | undefined): string {
  if (!value) return 'org';
  const transliterated = String(value)
    .split('')
    .map((ch) => SLUG_TRANSLIT[ch] ?? ch)
    .join('');
  const slug = transliterated
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'org';
}

function isoDate(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return new Date().toISOString().slice(0, 10);
  return new Date(ms).toISOString().slice(0, 10);
}

function safeFormatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toUTCString();
  } catch {
    return new Date(ms).toISOString();
  }
}

function safeNumber(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// Section renderers — each one tolerates missing/empty input.
// ---------------------------------------------------------------------------

function renderHeader(input: RenderOpsHealthHtmlInput, dateLabel: string): string {
  const orgName = escapeHtml(input.organizationName || 'Organization');
  const generatedBy = input.generatedBy
    ? `<div class="meta">Generated by ${escapeHtml(input.generatedBy)}</div>`
    : '';
  const generatedAt = escapeHtml(safeFormatDate(input.report?.generatedAt));
  const windowDays = Number.isFinite(input.report?.windowDays)
    ? Number(input.report?.windowDays)
    : 7;
  return `
    <header class="doc-header">
      <div class="doc-title">
        <div class="brand">Consultify Presentation Studio</div>
        <h1>Operations Health Report</h1>
        <div class="meta"><strong>${orgName}</strong></div>
        <div class="meta">Window: last ${escapeHtml(String(windowDays))} day${windowDays === 1 ? '' : 's'}</div>
        <div class="meta">Report date: ${escapeHtml(dateLabel)}</div>
        <div class="meta">Generated at ${generatedAt}</div>
        ${generatedBy}
      </div>
      <div class="print-banner" role="note">
        Press <kbd>⌘P</kbd> / <kbd>Ctrl+P</kbd> to save as PDF.
      </div>
    </header>
  `;
}

function renderSloGrid(report: OperationsHealthReport): string {
  const slos = Array.isArray(report?.slos) ? report.slos : [];
  if (slos.length === 0) {
    return `
      <section class="section">
        <h2>SLO indicators</h2>
        <div class="empty">No SLO indicators reported.</div>
      </section>
    `;
  }
  const cards = slos
    .map((slo) => {
      const tone = STATUS_TONE[slo?.status as keyof typeof STATUS_TONE] || STATUS_TONE.inconclusive;
      const observed = escapeHtml(slo?.observed || '—');
      const target = escapeHtml(slo?.target || '—');
      const label = escapeHtml(slo?.label || slo?.id || 'SLO');
      return `
        <div class="slo-card" style="border-color: ${tone.border};">
          <div class="slo-card-head">
            <span class="slo-label">${label}</span>
            <span
              class="status-pill"
              style="background: ${tone.background}; color: ${tone.color}; border: 1px solid ${tone.border};"
            >${escapeHtml(tone.label)}</span>
          </div>
          <div class="slo-observed">${observed}</div>
          <div class="slo-target">Target ${target}</div>
        </div>
      `;
    })
    .join('');
  return `
    <section class="section">
      <h2>SLO indicators</h2>
      <div class="slo-grid">${cards}</div>
    </section>
  `;
}

function renderJobsTable(report: OperationsHealthReport): string {
  const jobs = Array.isArray(report?.jobs) ? report.jobs : [];
  if (jobs.length === 0) {
    return `
      <section class="section">
        <h2>Scheduled jobs</h2>
        <div class="empty">No scheduled jobs reported.</div>
      </section>
    `;
  }
  const rows = jobs
    .map((job) => {
      const tone =
        JOB_STATUS_TONE[job?.lastRunStatus as keyof typeof JOB_STATUS_TONE] ||
        JOB_STATUS_TONE.unknown;
      const stalePill = job?.isStale
        ? `<span class="stale-pill">Stale</span>`
        : '';
      const summary = job?.lastRunSummary
        ? `<div class="job-summary">${escapeHtml(job.lastRunSummary)}</div>`
        : '';
      const lastRunDisplay = job?.lastRunAt
        ? safeFormatDate(job.lastRunAt)
        : 'never';
      return `
        <tr>
          <td>
            <div class="job-label">${escapeHtml(job?.label || job?.jobId || 'job')}</div>
            ${summary}
          </td>
          <td>${escapeHtml(lastRunDisplay)}</td>
          <td>
            <span
              class="status-pill"
              style="background: ${tone.background}; color: ${tone.color};"
            >${escapeHtml(tone.label)}</span>
            ${stalePill}
          </td>
        </tr>
      `;
    })
    .join('');
  return `
    <section class="section">
      <h2>Scheduled jobs</h2>
      <table class="jobs-table">
        <thead>
          <tr>
            <th style="width: 55%;">Job</th>
            <th style="width: 25%;">Last run</th>
            <th style="width: 20%;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderAlertsPanel(report: OperationsHealthReport): string {
  const a = report?.alerts || {
    windowDays: report?.windowDays ?? 7,
    attempted: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    dryRun: 0,
    uniqueDecks: 0,
    pausedSubscriptions: 0,
  };
  return `
    <section class="section">
      <h2>Alert dispatch volume</h2>
      <div class="alerts-grid">
        <div class="alert-cell"><div class="alert-num emerald">${escapeHtml(safeNumber(a.sent))}</div><div class="alert-label">Sent</div></div>
        <div class="alert-cell"><div class="alert-num rose">${escapeHtml(safeNumber(a.failed))}</div><div class="alert-label">Failed</div></div>
        <div class="alert-cell"><div class="alert-num amber">${escapeHtml(safeNumber(a.suppressed))}</div><div class="alert-label">Suppressed</div></div>
        <div class="alert-cell"><div class="alert-num slate">${escapeHtml(safeNumber(a.dryRun))}</div><div class="alert-label">Dry-run</div></div>
        <div class="alert-cell"><div class="alert-num slate">${escapeHtml(safeNumber(a.uniqueDecks))}</div><div class="alert-label">Unique decks</div></div>
        <div class="alert-cell"><div class="alert-num slate">${escapeHtml(safeNumber(a.pausedSubscriptions))}</div><div class="alert-label">Paused subs</div></div>
      </div>
      <p class="alerts-note">
        Counters cover the last ${escapeHtml(String(a.windowDays))} day${a.windowDays === 1 ? '' : 's'} of governance alert
        dispatches. Suppressed and dry-run rows reflect intentional throttling, not failures.
      </p>
    </section>
  `;
}

function renderWarnings(report: OperationsHealthReport): string {
  const warnings = Array.isArray(report?.warnings) ? report.warnings : [];
  if (warnings.length === 0) {
    // Hidden when empty (per test 8). We still emit a marker comment for
    // diagnostics but no visible block.
    return `<!-- no-warnings -->`;
  }
  const items = warnings
    .map((w) => `<li>${escapeHtml(String(w))}</li>`)
    .join('');
  return `
    <section class="section warnings">
      <h2>Warnings</h2>
      <ul class="warnings-list">${items}</ul>
    </section>
  `;
}

function renderFooter(): string {
  const year = new Date().getUTCFullYear();
  return `
    <footer class="doc-footer">
      <span>Consultify Presentation Studio</span>
      <span>© ${year}</span>
      <span class="page-num">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </footer>
  `;
}

function renderWatermark(watermark: string | null | undefined): string {
  if (!watermark) return '';
  const text = escapeHtml(watermark);
  // Repeated diagonal text using flex of pre-rendered tiles. Inline styles
  // keep the document fully self-contained.
  const tiles = Array.from({ length: 24 })
    .map(
      () =>
        `<span class="wm-tile">${text}</span>`
    )
    .join('');
  return `<div class="watermark" aria-hidden="true">${tiles}</div>`;
}

// ---------------------------------------------------------------------------
// Style block
// ---------------------------------------------------------------------------

function renderStyles(): string {
  return `
    <style>
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
      }
      body {
        position: relative;
        padding: 24px 32px 48px 32px;
      }
      .watermark {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        display: flex;
        flex-wrap: wrap;
        align-content: space-around;
        justify-content: space-around;
        transform: rotate(-30deg);
        transform-origin: center;
        opacity: 0.06;
        overflow: hidden;
      }
      .wm-tile {
        font-size: 36pt;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.15em;
        margin: 24px 32px;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .doc-header,
      .section,
      .doc-footer {
        position: relative;
        z-index: 1;
      }
      .print-banner {
        margin-top: 12px;
        padding: 8px 12px;
        background: #eef2ff;
        color: #3730a3;
        border: 1px solid #c7d2fe;
        border-radius: 6px;
        font-size: 10pt;
      }
      .print-banner kbd {
        background: #ffffff;
        border: 1px solid #c7d2fe;
        border-radius: 4px;
        padding: 1px 4px;
        font-size: 9pt;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .doc-header {
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 16px;
        margin-bottom: 18px;
      }
      .doc-header .brand {
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #6366f1;
        font-weight: 700;
      }
      .doc-header h1 {
        margin: 4px 0 8px 0;
        font-size: 20pt;
        font-weight: 700;
        color: #0f172a;
      }
      .doc-header .meta {
        font-size: 10pt;
        color: #475569;
      }
      .section {
        margin: 18px 0;
        page-break-inside: avoid;
      }
      .section h2 {
        font-size: 12pt;
        margin: 0 0 10px 0;
        color: #1e293b;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 4px;
      }
      .empty {
        font-size: 10pt;
        color: #64748b;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        padding: 12px;
      }
      .slo-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 640px) {
        .slo-grid { grid-template-columns: 1fr; }
      }
      .slo-card {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
        background: #ffffff;
      }
      .slo-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .slo-label {
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #475569;
        font-weight: 600;
      }
      .slo-observed {
        font-size: 16pt;
        font-weight: 700;
        margin-top: 8px;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
      }
      .slo-target {
        font-size: 9pt;
        color: #64748b;
        margin-top: 2px;
      }
      .status-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 9pt;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .stale-pill {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 9pt;
        font-weight: 600;
        background: #ffe4e6;
        color: #9f1239;
      }
      .jobs-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
      }
      .jobs-table th,
      .jobs-table td {
        text-align: left;
        padding: 8px 10px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .jobs-table th {
        background: #f8fafc;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #475569;
      }
      .job-label {
        font-weight: 600;
        color: #0f172a;
      }
      .job-summary {
        font-size: 9pt;
        color: #64748b;
        margin-top: 2px;
      }
      .alerts-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .alert-cell {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 10px;
        background: #ffffff;
      }
      .alert-num {
        font-size: 14pt;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .alert-num.emerald { color: #047857; }
      .alert-num.rose    { color: #be123c; }
      .alert-num.amber   { color: #b45309; }
      .alert-num.slate   { color: #334155; }
      .alert-label {
        font-size: 9pt;
        color: #64748b;
        margin-top: 2px;
      }
      .alerts-note {
        font-size: 9pt;
        color: #64748b;
        margin: 8px 0 0 0;
      }
      .warnings-list {
        margin: 0;
        padding-left: 18px;
        font-size: 10pt;
        color: #92400e;
      }
      .warnings-list li {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 9pt;
      }
      .doc-footer {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        font-size: 9pt;
        color: #64748b;
      }
      @media print {
        .print-banner { display: none; }
        body { padding: 0; }
      }
    </style>
  `;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function renderOperationsHealthHtml(
  input: RenderOpsHealthHtmlInput
): RenderOpsHealthHtmlResult {
  const safeInput: RenderOpsHealthHtmlInput = {
    report: input?.report || ({
      generatedAt: new Date().toISOString(),
      windowDays: 7,
      slos: [],
      jobs: [],
      alerts: {
        windowDays: 7,
        attempted: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
        dryRun: 0,
        uniqueDecks: 0,
        pausedSubscriptions: 0,
      },
      warnings: [],
    } as OperationsHealthReport),
    organizationName: input?.organizationName ?? null,
    generatedBy: input?.generatedBy ?? null,
    watermark: input?.watermark ?? null,
  };

  const datePart = isoDate(safeInput.report?.generatedAt);
  const slug = slugify(safeInput.organizationName || 'org');
  const filename = `operations-health-${slug}-${datePart}.html`;
  const orgNameForTitle = escapeHtml(safeInput.organizationName || 'Organization');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Operations Health — ${orgNameForTitle} — ${escapeHtml(datePart)}</title>
  ${renderStyles()}
</head>
<body>
  ${renderWatermark(safeInput.watermark)}
  ${renderHeader(safeInput, datePart)}
  ${renderSloGrid(safeInput.report)}
  ${renderJobsTable(safeInput.report)}
  ${renderAlertsPanel(safeInput.report)}
  ${renderWarnings(safeInput.report)}
  ${renderFooter()}
</body>
</html>
`;

  return {
    html,
    filename,
    mimeType: 'text/html',
  };
}

// ---------------------------------------------------------------------------
// Real PDF rendering (Playwright-backed) with HTML fallback
// ---------------------------------------------------------------------------

export interface RenderOpsHealthPdfResult {
  status: 'pdf' | 'html_fallback';
  buffer?: Buffer;
  html?: string;
  filename: string;
  mimeType: 'application/pdf' | 'text/html';
  fallbackReason?: string;
  bytes?: number;
}

/**
 * Render the Operations Health report as a real PDF when the Playwright
 * runtime is available, otherwise fall back to the HTML-only document so the
 * endpoint stays useful in environments without chromium installed.
 *
 * This function NEVER throws — every failure path resolves to a typed result.
 */
export async function renderOperationsHealthPdf(
  input: RenderOpsHealthHtmlInput
): Promise<RenderOpsHealthPdfResult> {
  const htmlResult = renderOperationsHealthHtml(input);
  const htmlFilename = htmlResult.filename;
  const pdfFilename = htmlFilename.replace(/\.html$/i, '.pdf');

  let availability;
  try {
    availability = await isPlaywrightPdfRendererAvailable();
  } catch {
    return {
      status: 'html_fallback',
      html: htmlResult.html,
      filename: htmlFilename,
      mimeType: 'text/html',
      fallbackReason: 'availability_probe_failed',
    };
  }

  if (!availability.available) {
    return {
      status: 'html_fallback',
      html: htmlResult.html,
      filename: htmlFilename,
      mimeType: 'text/html',
      fallbackReason: availability.reason ?? 'unavailable',
    };
  }

  let rendered;
  try {
    rendered = await renderHtmlToPdf({
      html: htmlResult.html,
      pdfOptions: {
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      },
    });
  } catch {
    return {
      status: 'html_fallback',
      html: htmlResult.html,
      filename: htmlFilename,
      mimeType: 'text/html',
      fallbackReason: 'renderer_threw',
    };
  }

  if (rendered.status === 'ok') {
    return {
      status: 'pdf',
      buffer: rendered.buffer,
      filename: pdfFilename,
      mimeType: 'application/pdf',
      bytes: rendered.bytes,
    };
  }

  return {
    status: 'html_fallback',
    html: htmlResult.html,
    filename: htmlFilename,
    mimeType: 'text/html',
    fallbackReason: rendered.reason || rendered.status,
  };
}

