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
  label: string;
}

export const RAG_CONFIG: Record<string, RagConf> = {
  green: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'On Track',
  },
  amber: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Needs Attention',
  },
  red: {
    icon: AlertTriangle,
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-700 dark:text-danger-400',
    border: 'border-danger-200 dark:border-danger-800',
    label: 'At Risk',
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
   PDF export (browser-side, simplified)
   ──────────────────────────────────────────────────────────────────────────── */

export function exportReportPDF(report: ReportDef, rag: string): void {
  const md = buildReportMarkdown(report, rag);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
