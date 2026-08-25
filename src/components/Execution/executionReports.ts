import { AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

export interface ReportHighlight {
  label: string;
  value: string | number;
  variant?: 'default' | 'warn' | 'critical';
}

export interface ReportAiRecommendation {
  id?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  severity?: 'critical' | 'warn' | 'info';
  action?: string;
  owner?: string;
  dueLabel?: string;
  expectedEffect?: string;
}

export interface ReportDataQuality {
  confidence: string;
  completeness?: number;
  freshnessLabel?: string;
  knownLimitations?: string[];
  missingBaselineCount?: number;
  missingEstimateCount?: number;
}

export interface ReportDef {
  id: string;
  title: string;
  audience: string;
  cadence: string;
  scope: string;
  dataSources: string[];
  sections: string[];
  ragLogic: string;
  followUpActions: string[];
  icon: React.ReactNode;
  highlights: ReportHighlight[];
  aiExecutiveReadout: string[];
  aiRecommendedActions: ReportAiRecommendation[];
  dataQuality: ReportDataQuality;
  degradedFlags: string[];
  lastRefreshAt: string | null;
  scenarioNotes: string[];
}

export interface ReportDataContext {
  initiatives: Array<{
    id: string;
    name: string;
    status: string;
    health?: string;
    progress?: number;
    owner?: string;
    targetDate?: string;
    priority?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority?: string;
    dueDate?: string;
    assigneeName?: string;
    initiativeId?: string;
    initiativeName?: string;
  }>;
  decisions: Array<{
    id: string;
    title: string;
    status: string;
    priority?: string;
    dueDate?: string;
    ownerName?: string;
    relatedObjectId?: string;
  }>;
  blocked: Array<{ id: string; name: string; reason?: string }>;
  riskSignals: Array<{
    id?: string;
    title: string;
    initiativeName?: string;
    severity: string;
    description?: string;
    suggestedAction?: string;
  }>;
  delaySignals: Array<{
    entityName: string;
    deviationType: string;
    daysDeviation: number;
    severity: string;
  }>;
  overdueDecisions: Array<{
    id: string;
    title: string;
    ownerName?: string;
    dueDate?: string;
  }>;
  missingDates: Array<{ id: string; name: string }>;
  dueSoonTasks: Array<{
    id: string;
    title: string;
    dueDate?: string;
    assigneeName?: string;
  }>;
  overspendSignals: Array<Record<string, any>>;
  nextMilestones: Array<Record<string, any>>;
  priorityAlerts: Array<Record<string, any>>;
  timelineWarnings: Array<Record<string, any>>;
  capacityAlerts: Array<Record<string, any>>;
  capacityTimeline: Array<Record<string, any>>;
  phaseLabel?: string | null;
  progressPercent: number | null;
  totalInitiatives: number;
  lastRefreshAt?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   RAG helpers
   ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';

type RagLevel = 'green' | 'amber' | 'red';

interface RagConf {
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  /** English text, kept for consumers that haven't switched to i18n yet. */
  label: string;
  /** i18n key -- consumers should render t(labelKey, label). */
  labelKey: string;
}

export const RAG_CONFIG: Record<string, RagConf> = {
  green: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'On Track',
    // `label` above is the English text used by any consumer that hasn't
    // switched to i18n yet (kept for backward compat). New/updated
    // consumers should pass `labelKey` through t(labelKey, label) instead
    // -- night sweep B flagged this literal "AT RISK" showing on an
    // otherwise Polish screen (execution-export-prezentacja).
    labelKey: 'execution.reportPanel.rag.onTrack',
  },
  amber: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Needs Attention',
    labelKey: 'execution.reportPanel.rag.needsAttention',
  },
  red: {
    icon: AlertTriangle,
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-700 dark:text-danger-400',
    border: 'border-danger-200 dark:border-danger-800',
    label: 'At Risk',
    labelKey: 'execution.reportPanel.rag.atRisk',
  },
};

/**
 * Determine RAG level based on report highlight signals.
 */
export function computeRAG(report: ReportDef): RagLevel {
  const highlights = report.highlights ?? [];
  const criticals = highlights.filter((h) => h.variant === 'critical');
  const warns = highlights.filter((h) => h.variant === 'warn');

  if (criticals.some((h) => Number(h.value) > 0)) return 'red';
  if (warns.some((h) => Number(h.value) > 0)) return 'amber';
  return 'green';
}

/* ────────────────────────────────────────────────────────────────────────────
   Enrichment — turns a "catalog" report into a full ReportDef
   ──────────────────────────────────────────────────────────────────────────── */

function buildReadout(
  report: Omit<
    ReportDef,
    | 'aiExecutiveReadout'
    | 'aiRecommendedActions'
    | 'dataQuality'
    | 'degradedFlags'
    | 'lastRefreshAt'
    | 'scenarioNotes'
  >,
  ctx: ReportDataContext
): string[] {
  const lines: string[] = [];
  const total = ctx.totalInitiatives;
  const blocked = ctx.blocked.length;
  const overdue = ctx.overdueDecisions.length;
  const tasks = ctx.tasks.length;

  lines.push(
    `${report.title} covers ${total} initiative(s) with ${blocked} blocker(s), ${overdue} overdue decision(s), and ${tasks} overdue task(s) in the live execution set.`
  );

  if (ctx.progressPercent !== null) {
    const baseline = ctx.progressPercent < 30 ? 'incomplete' : 'directional';
    lines.push(
      `Progress baseline is ${baseline}, so leadership should treat the current readout as ${baseline} until missing progress fields are restored.`
    );
  }

  if (blocked > 0) {
    const names = ctx.blocked
      .slice(0, 3)
      .map((b) => b.name)
      .join(', ');
    lines.push(
      `Blocked work is the main drag on delivery confidence; ${blocked} initiative(s) are already stalled (${names}) and need owner-level recovery decisions.`
    );
  }

  const noDateInitiatives = ctx.missingDates.length;
  const noDateTasks = ctx.tasks.filter((t) => !t.dueDate).length;
  if (noDateInitiatives > 0 || noDateTasks > 0) {
    lines.push(
      `Forecast quality is degraded because ${noDateInitiatives} initiative(s) or ${noDateTasks} task(s) lack dates, so some timing conclusions should be read as best-effort only.`
    );
  }

  const overspend = (ctx.overspendSignals || []).length;
  lines.push(
    `Budget posture is approximated from ${overspend} overspend signal(s), blocked work, and progress drag, so finance should validate any severe exception before external communication.`
  );

  return lines;
}

function buildDegradedFlags(ctx: ReportDataContext): string[] {
  const flags: string[] = [];
  if (ctx.missingDates.length > 0)
    flags.push(`${ctx.missingDates.length} initiative(s) missing dates`);
  const noDueTasks = ctx.tasks.filter((t) => !t.dueDate).length;
  if (noDueTasks > 0) flags.push(`${noDueTasks} task(s) without due date`);
  if (ctx.blocked.length > 0) flags.push(`${ctx.blocked.length} blocked initiative(s)`);
  return flags;
}

function buildDataQuality(ctx: ReportDataContext): ReportDataQuality {
  const total = ctx.totalInitiatives || 1;
  const withProgress = ctx.initiatives.filter(
    (i) => i.progress != null && Number(i.progress) > 0
  ).length;
  const completeness = Math.round((withProgress / total) * 100);
  const missingBaselineCount = ctx.initiatives.filter((i) => i.progress == null).length;
  const missingEstimateCount = ctx.tasks.filter((t) => !t.dueDate).length;
  let confidence = 'high';
  if (completeness < 50) confidence = 'low';
  else if (completeness < 80) confidence = 'medium';
  return {
    confidence,
    completeness,
    freshnessLabel: ctx.lastRefreshAt ? 'Live' : 'Snapshot',
    knownLimitations: buildDegradedFlags(ctx),
    missingBaselineCount,
    missingEstimateCount,
  };
}

export function enrichExecutionReport(
  report: Omit<
    ReportDef,
    | 'aiExecutiveReadout'
    | 'aiRecommendedActions'
    | 'dataQuality'
    | 'degradedFlags'
    | 'lastRefreshAt'
    | 'scenarioNotes'
  >,
  ctx: ReportDataContext
): ReportDef {
  return {
    ...report,
    aiExecutiveReadout: buildReadout(report, ctx),
    aiRecommendedActions: [],
    dataQuality: buildDataQuality(ctx),
    degradedFlags: buildDegradedFlags(ctx),
    lastRefreshAt: ctx.lastRefreshAt || null,
    scenarioNotes: [],
  } as ReportDef;
}

/* ────────────────────────────────────────────────────────────────────────────
   Markdown export
   ──────────────────────────────────────────────────────────────────────────── */

export function buildReportMarkdown(report: ReportDef, rag: string): string {
  const ragLabel = RAG_CONFIG[rag]?.label ?? rag;
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`**Status:** ${ragLabel.toUpperCase()}  `);
  lines.push(`**Audience:** ${report.audience}  `);
  lines.push(`**Cadence:** ${report.cadence}  `);
  lines.push(`**Scope:** ${report.scope}`);
  lines.push('');

  if ((report.aiExecutiveReadout ?? []).length > 0) {
    lines.push('## AI Executive Readout');
    lines.push('');
    report.aiExecutiveReadout.forEach((l) => lines.push(`- ${l}`));
    lines.push('');
  }

  if ((report.highlights ?? []).length > 0) {
    lines.push('## Key Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    report.highlights.forEach((h) => lines.push(`| ${h.label} | ${h.value} |`));
    lines.push('');
  }

  lines.push('## Sections');
  lines.push('');
  report.sections.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');

  lines.push('## Data Sources');
  lines.push('');
  report.dataSources.forEach((ds) => lines.push(`- ${ds}`));
  lines.push('');

  lines.push('## RAG / Confidence Logic');
  lines.push('');
  lines.push(report.ragLogic);
  lines.push('');

  if ((report.followUpActions ?? []).length > 0) {
    lines.push('## Follow-Up Actions');
    lines.push('');
    report.followUpActions.forEach((a) => lines.push(`- [ ] ${a}`));
    lines.push('');
  }

  if ((report.degradedFlags ?? []).length > 0) {
    lines.push('## Data Quality Flags');
    lines.push('');
    report.degradedFlags.forEach((f) => lines.push(`⚠ ${f}`));
    lines.push('');
  }

  return lines.join('\n');
}

/* ────────────────────────────────────────────────────────────────────────────
   PDF export (browser-side, print-CSS)

   Real PDF output via the same technique as the DRD report
   (src/services/report/drdReportHtml.ts): render a publishing-grade HTML
   document with an A4 print stylesheet, open it in a new window, and let the
   browser's native "Save as PDF" print target produce the file. No external
   library is required and the output is a true paginated PDF — not Markdown.
   ──────────────────────────────────────────────────────────────────────────── */

/** HTML-escape a value for safe interpolation into the report document. */
function escHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a complete, self-contained HTML document for the execution report,
 * styled for A4 print-to-PDF. Content mirrors {@link buildReportMarkdown} so
 * the PDF and the copyable Markdown stay in lock-step.
 */
export function buildReportHtml(report: ReportDef, rag: string): string {
  const ragLabel = RAG_CONFIG[rag]?.label ?? rag;
  const generatedAt = new Date().toISOString().slice(0, 10);

  const section = (title: string, body: string): string =>
    body ? `<section class="block"><h2>${escHtml(title)}</h2>${body}</section>` : '';

  const readout =
    (report.aiExecutiveReadout ?? []).length > 0
      ? section(
          'AI Executive Readout',
          `<ul>${report.aiExecutiveReadout.map((l) => `<li>${escHtml(l)}</li>`).join('')}</ul>`
        )
      : '';

  const metrics =
    (report.highlights ?? []).length > 0
      ? section(
          'Key Metrics',
          `<table class="tbl"><thead><tr><th>Metric</th><th class="num">Value</th></tr></thead><tbody>${report.highlights
            .map(
              (h) => `<tr><td>${escHtml(h.label)}</td><td class="num">${escHtml(h.value)}</td></tr>`
            )
            .join('')}</tbody></table>`
        )
      : '';

  const sections = section(
    'Sections',
    `<ol>${report.sections.map((s) => `<li>${escHtml(s)}</li>`).join('')}</ol>`
  );

  const dataSources = section(
    'Data Sources',
    `<ul>${report.dataSources.map((ds) => `<li>${escHtml(ds)}</li>`).join('')}</ul>`
  );

  const ragLogic = section('RAG / Confidence Logic', `<p>${escHtml(report.ragLogic)}</p>`);

  const followUps =
    (report.followUpActions ?? []).length > 0
      ? section(
          'Follow-Up Actions',
          `<ul class="checks">${report.followUpActions
            .map((a) => `<li>${escHtml(a)}</li>`)
            .join('')}</ul>`
        )
      : '';

  const flags =
    (report.degradedFlags ?? []).length > 0
      ? section(
          'Data Quality Flags',
          `<ul class="flags">${report.degradedFlags
            .map((f) => `<li>${escHtml(f)}</li>`)
            .join('')}</ul>`
        )
      : '';

  const css = `
    :root { --ink:#0f172a; --muted:#64748b; --accent:#1d4ed8; --grid:#e2e8f0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, "Segoe UI", Inter, Roboto, Arial, sans-serif; color: var(--ink); font-size: 13px; line-height: 1.55; background: #f8fafc; }
    .page { background:#fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 22mm 20mm; box-shadow: 0 1px 6px rgba(15,23,42,.08); }
    h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -.02em; }
    h2 { font-size: 18px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); }
    .meta { color: var(--muted); margin: 0 0 4px; }
    .status { display:inline-block; margin: 4px 0 18px; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background:#eff6ff; color: var(--accent); }
    .block { break-inside: avoid; margin-bottom: 20px; }
    ul, ol { margin: 0 0 6px; padding-left: 20px; }
    li { margin: 2px 0; }
    ul.checks li::marker { content: '\\2610  '; }
    ul.flags li { color:#92400e; }
    p { margin: 0 0 10px; }
    .tbl { width:100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 12px; }
    .tbl th { text-align:left; background:#f1f5f9; padding: 7px 9px; border-bottom: 1px solid var(--grid); font-weight:600; }
    .tbl td { padding: 6px 9px; border-bottom: 1px solid #eef2f7; }
    .tbl .num { text-align:right; font-variant-numeric: tabular-nums; }
    .foot { margin-top: 28px; padding-top: 8px; border-top:1px solid var(--grid); font-size: 10px; color: var(--muted); display:flex; justify-content: space-between; }
    @page { size: A4; margin: 16mm; @bottom-center { content: counter(page); } }
    @media print {
      body { background:#fff; }
      .page { box-shadow:none; margin: 0; width: auto; min-height: auto; padding: 0; }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(report.title)}</title>
<style>${css}</style>
</head>
<body>
<div class="page">
  <h1>${escHtml(report.title)}</h1>
  <div class="status">${escHtml(String(ragLabel).toUpperCase())}</div>
  <p class="meta"><strong>Audience:</strong> ${escHtml(report.audience)}</p>
  <p class="meta"><strong>Cadence:</strong> ${escHtml(report.cadence)}</p>
  <p class="meta"><strong>Scope:</strong> ${escHtml(report.scope)}</p>
  ${readout}
  ${metrics}
  ${sections}
  ${dataSources}
  ${ragLogic}
  ${followUps}
  ${flags}
  <div class="foot"><span>${escHtml(report.title)}</span><span>${escHtml(generatedAt)}</span></div>
</div>
</body>
</html>`;
}

/**
 * Export the execution report as a real PDF.
 *
 * Opens the print-CSS HTML document in a new window and triggers the browser's
 * print dialog (whose "Save as PDF" target yields a true PDF). Returns the
 * generated HTML so callers/tests can assert on the output without relying on a
 * live browser print pipeline.
 */
export function exportReportPDF(report: ReportDef, rag: string): string {
  const html = buildReportHtml(report, rag);
  const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Give the browser a tick to lay out before invoking the print dialog.
    win.setTimeout(() => win.print(), 400);
  }
  return html;
}
