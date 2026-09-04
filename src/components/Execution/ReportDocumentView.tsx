import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { type NavigateFunction, useNavigate } from 'react-router-dom';

import { type ArtifactType, getArtifactPath } from '../../utils/artifactLinks';
import {
  buildReportMarkdown,
  computeRAG,
  exportReportPDF,
  RAG_CONFIG,
  type ReportAiRecommendation,
  type ReportDataContext,
  type ReportDef,
} from './executionReports';

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

interface ReportDocumentViewProps {
  report: ReportDef;
  data: ReportDataContext;
  onBack: () => void;
  onGenerateAI: (report: ReportDef) => void;
}

type Renderer = (
  data: ReportDataContext,
  report: ReportDef,
  nav: NavigateFunction
) => React.ReactNode;

type InitiativeRow = {
  id: string;
  name: string;
  status: string;
  health?: string;
  owner?: string;
  targetDate?: string;
  priority?: string;
  progress?: number;
  blocked: boolean;
  blockedReason?: string;
  missingDates: boolean;
  taskCount: number;
  openTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  pendingDecisions: number;
  overdueDecisions: number;
  riskCount: number;
  highRiskCount: number;
  delayCount: number;
  overspendCount: number;
  timelineWarnings: number;
  confidence: number;
};

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const daysPastDue = (value?: string | null) => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
};

const isDoneLike = (status?: string) =>
  ['DONE', 'APPROVED', 'REJECTED', 'ARCHIVED'].includes(String(status ?? '').toUpperCase());

/* ────────────────────────────────────────────────────────────────────────────
   Design system primitives — DBR77 Tech Sexy
   Glass surfaces · navy stack · backdrop-blur · Inter typography
   ──────────────────────────────────────────────────────────────────────────── */

const RAG_BAR: Record<string, string> = {
  green: 'from-emerald-500 to-emerald-400',
  amber: 'from-amber-500 to-amber-400',
  red: 'from-danger-500 to-danger-400',
};

const RAG_DOT: Record<string, string> = {
  green: 'bg-emerald-500 shadow-emerald-500/40',
  amber: 'bg-amber-500 shadow-amber-500/40',
  red: 'bg-danger-500 shadow-danger-500/40',
};

// Kanon czerwieni (CLAUDE.md UI#3) + PRIORITY_STYLES (src/constants/statusColors.ts):
// czerwony TYLKO najwyzszy stopien. `high` dzielilo klase z `critical`, wiec
// skala czterostopniowa czytala sie jak dwustopniowa.
const SEVERITY_TEXT: Record<string, string> = {
  critical: 'text-danger-400',
  high: 'text-amber-400',
  warning: 'text-amber-400',
  warn: 'text-amber-400',
  medium: 'text-amber-400',
  low: 'text-slate-600',
};

const severityText = (v?: string) =>
  SEVERITY_TEXT[String(v ?? '').toLowerCase()] ?? 'text-slate-600';

const confidenceTone = (score: number): 'critical' | 'warn' | 'default' =>
  score < 45 ? 'critical' : score < 70 ? 'warn' : 'default';

const TONE_RING: Record<string, string> = {
  critical: 'ring-danger-500/20',
  warn: 'ring-amber-500/20',
  default: 'ring-white/[0.04]',
};

/* ── Glass card ─────────────────────────────────────────────────────────── */

const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'warn' | 'critical';
}> = ({ children, className = '', tone = 'default' }) => (
  <div
    className={[
      'rounded-xl border backdrop-blur-sm',
      'bg-white/70 dark:bg-navy-900/70',
      'border-slate-200/70 dark:border-white/[0.06]',
      tone !== 'default' ? `ring-1 ${TONE_RING[tone]}` : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);

/* ── Metric pill ────────────────────────────────────────────────────────── */

const MetricPill: React.FC<{
  label: string;
  value: string | number;
  tone?: 'default' | 'warn' | 'critical';
  icon?: React.ReactNode;
}> = ({ label, value, tone = 'default', icon }) => (
  <GlassCard tone={tone} className="flex items-center gap-3 px-4 py-3">
    {icon && <span className="text-slate-600 dark:text-slate-500">{icon}</span>}
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
        {label}
      </div>
      <div
        className={[
          'mt-0.5 text-xl font-semibold tabular-nums',
          tone === 'critical'
            ? 'text-danger-500'
            : tone === 'warn'
              ? 'text-amber-500'
              : 'text-slate-900 dark:text-white',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  </GlassCard>
);

/* ── Section ────────────────────────────────────────────────────────────── */

const Section: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald';
}> = ({ title, subtitle, children, accent = 'violet' }) => {
  const accentBar: Record<string, string> = {
    violet: 'bg-sky-500',
    cyan: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-danger-500',
    emerald: 'bg-emerald-500',
  };
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-stretch">
        <div className={`w-1 shrink-0 ${accentBar[accent]}`} />
        <div className="flex-1 p-4">
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-500">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </GlassCard>
  );
};

/* ── Data table (glass) ─────────────────────────────────────────────────── */

// §27-exempt: document-layout — report renderer accepts JSX node arrays (ALink, IssueTag, etc.)
const DataTable: React.FC<{
  headers: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
}> = ({ headers, rows, emptyText = 'No data' }) => (
  <div className="overflow-hidden rounded-lg border border-slate-200/60 dark:border-white/[0.05]">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-white/60 dark:bg-navy-900/60">
          {headers.map((h) => (
            <th
              key={h}
              className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.04]">
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={headers.length}
              className="px-3 py-6 text-center text-[11px] text-slate-600 dark:text-slate-500"
            >
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((cells, idx) => (
            <tr
              key={idx}
              className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03]"
            >
              {cells.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

/* ── AI insight strip ───────────────────────────────────────────────────── */

const AiInsightStrip: React.FC<{ items: string[]; emptyText?: string }> = ({
  items,
  emptyText = 'No insights generated.',
}) => (
  <div className="space-y-1.5">
    {items.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-300/60 px-3 py-3 text-[11px] text-slate-600 dark:border-white/[0.06] dark:text-slate-500">
        {emptyText}
      </div>
    ) : (
      items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-slate-200/60 bg-white/40 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-slate-300"
        >
          {item}
        </div>
      ))
    )}
  </div>
);

/* ── Action cards ───────────────────────────────────────────────────────── */

const ActionCards: React.FC<{ actions: ReportAiRecommendation[] }> = ({ actions }) =>
  actions.length === 0 ? null : (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((a) => (
        <div
          key={a.id}
          className={[
            'rounded-xl border p-3 transition-colors',
            'border-slate-200/60 bg-white/50 dark:border-white/[0.05] dark:bg-white/[0.02]',
            a.severity === 'critical' ? 'ring-1 ring-danger-500/20' : '',
            a.severity === 'warn' ? 'ring-1 ring-amber-500/20' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="text-[12px] font-semibold text-slate-900 dark:text-white">{a.action}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-500">
            <span>{a.owner}</span>
            <span className="text-slate-600 dark:text-slate-400">·</span>
            <span>{a.dueLabel}</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {a.expectedEffect}
          </div>
        </div>
      ))}
    </div>
  );

/* ── Data quality footer ────────────────────────────────────────────────── */

const QualityFooter: React.FC<{ report: ReportDef }> = ({ report }) => {
  const dq = report.dataQuality ?? ({} as Partial<ReportDef['dataQuality']>);
  const flags = report.degradedFlags ?? [];
  const limitations = dq.knownLimitations ?? [];

  return (
    <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-4 backdrop-blur-sm dark:border-white/[0.04] dark:bg-navy-900/40">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
        Data quality posture
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          `Freshness: ${dq.freshnessLabel ?? '—'}`,
          `Confidence: ${dq.confidence ?? '—'}`,
          `Missing baseline: ${dq.missingBaselineCount ?? 0}`,
          `Missing estimate: ${dq.missingEstimateCount ?? 0}`,
        ].map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-navy-800/60 dark:text-slate-400"
          >
            {tag}
          </span>
        ))}
        {flags.map((flag) => (
          <span
            key={flag}
            className="rounded-full bg-amber-50/80 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
          >
            {flag}
          </span>
        ))}
      </div>
      {limitations.length > 0 && (
        <div className="mt-2 space-y-1">
          {limitations.map((lim) => (
            <div key={lim} className="text-[10px] text-slate-600 dark:text-slate-500">
              ⚠ {lim}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
   Data builders (initiative / task / decision aggregation)
   ──────────────────────────────────────────────────────────────────────────── */

const buildInitiativeRows = (data: ReportDataContext): InitiativeRow[] => {
  const blockedMap = new Map(data.blocked.map((i) => [i.id, i]));
  const missingDates = new Set(data.missingDates.map((i) => i.id));
  const taskStats = new Map<
    string,
    { total: number; open: number; overdue: number; dueSoon: number }
  >();
  const decisionStats = new Map<string, { pending: number; overdue: number }>();
  const riskStats = new Map<string, { total: number; high: number }>();
  const delayStats = new Map<string, number>();
  const overspendStats = new Map<string, number>();
  const timelineStats = new Map<string, number>();

  for (const task of data.tasks) {
    if (!task.initiativeId) continue;
    const cur = taskStats.get(task.initiativeId) ?? { total: 0, open: 0, overdue: 0, dueSoon: 0 };
    cur.total += 1;
    if (!isDoneLike(task.status)) {
      cur.open += 1;
      if (task.dueDate) {
        const due = new Date(task.dueDate).getTime();
        if (due < Date.now()) cur.overdue += 1;
        if (due >= Date.now() && due <= Date.now() + 604_800_000) cur.dueSoon += 1;
      }
    }
    taskStats.set(task.initiativeId, cur);
  }

  for (const d of data.decisions) {
    if (!d.relatedObjectId) continue;
    const cur = decisionStats.get(d.relatedObjectId) ?? { pending: 0, overdue: 0 };
    if (String(d.status).toUpperCase() === 'PENDING') {
      cur.pending += 1;
      const dp = daysPastDue(d.dueDate);
      if (dp !== null && dp > 0) cur.overdue += 1;
    }
    decisionStats.set(d.relatedObjectId, cur);
  }

  for (const r of data.riskSignals) {
    const ini = data.initiatives.find((i) => i.name === r.initiativeName);
    if (!ini) continue;
    const cur = riskStats.get(ini.id) ?? { total: 0, high: 0 };
    cur.total += 1;
    if (['CRITICAL', 'HIGH'].includes(String(r.severity ?? '').toUpperCase())) cur.high += 1;
    riskStats.set(ini.id, cur);
  }

  for (const d of data.delaySignals) {
    const ini = data.initiatives.find((i) => i.name === d.entityName);
    if (!ini) continue;
    delayStats.set(ini.id, (delayStats.get(ini.id) ?? 0) + 1);
  }

  for (const s of data.overspendSignals) {
    if (!s.initiativeId) continue;
    overspendStats.set(s.initiativeId, (overspendStats.get(s.initiativeId) ?? 0) + 1);
  }

  for (const w of data.timelineWarnings) {
    timelineStats.set(w.initiativeId, (timelineStats.get(w.initiativeId) ?? 0) + 1);
  }

  return data.initiatives.map((ini) => {
    const t = taskStats.get(ini.id) ?? { total: 0, open: 0, overdue: 0, dueSoon: 0 };
    const dc = decisionStats.get(ini.id) ?? { pending: 0, overdue: 0 };
    const rs = riskStats.get(ini.id) ?? { total: 0, high: 0 };
    const dl = delayStats.get(ini.id) ?? 0;
    const os = overspendStats.get(ini.id) ?? 0;
    const tw = timelineStats.get(ini.id) ?? 0;
    const blocked = blockedMap.has(ini.id);
    const missing = missingDates.has(ini.id);
    const confidence = Math.max(
      0,
      100 -
        (blocked ? 35 : 0) -
        (missing ? 20 : 0) -
        Math.min(25, rs.high * 10) -
        Math.min(20, dc.overdue * 10) -
        Math.min(15, t.overdue * 5) -
        Math.min(15, dl * 7) -
        Math.min(10, os * 5) -
        Math.min(10, tw * 5)
    );

    return {
      id: ini.id,
      name: ini.name,
      status: ini.status,
      health: ini.health,
      owner: ini.owner,
      targetDate: ini.targetDate,
      priority: ini.priority,
      progress: ini.progress,
      blocked,
      blockedReason: blockedMap.get(ini.id)?.reason,
      missingDates: missing,
      taskCount: t.total,
      openTasks: t.open,
      overdueTasks: t.overdue,
      dueSoonTasks: t.dueSoon,
      pendingDecisions: dc.pending,
      overdueDecisions: dc.overdue,
      riskCount: rs.total,
      highRiskCount: rs.high,
      delayCount: dl,
      overspendCount: os,
      timelineWarnings: tw,
      confidence,
    };
  });
};

const buildTaskRows = (data: ReportDataContext) =>
  data.tasks
    .map((t) => ({
      ...t,
      overdue: Boolean(
        t.dueDate && !isDoneLike(t.status) && new Date(t.dueDate).getTime() < Date.now()
      ),
    }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue));

const buildDecisionRows = (data: ReportDataContext) =>
  data.decisions
    .map((d) => ({
      ...d,
      initiativeName: data.initiatives.find((i) => i.id === d.relatedObjectId)?.name || '—',
      ageDays: Math.max(0, daysPastDue(d.dueDate) ?? 0),
    }))
    .filter((d) => String(d.status).toUpperCase() === 'PENDING')
    .sort((a, b) => b.ageDays - a.ageDays);

/* ── Confidence badge ───────────────────────────────────────────────────── */

const ConfBadge: React.FC<{ score: number }> = ({ score }) => {
  const tone = confidenceTone(score);
  const cls =
    tone === 'critical'
      ? 'bg-danger-500/10 text-danger-400'
      : tone === 'warn'
        ? 'bg-amber-500/10 text-amber-400'
        : 'bg-emerald-500/10 text-emerald-400';
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}>
      {score}
    </span>
  );
};

/* ── Status dot ─────────────────────────────────────────────────────────── */

const StatusDot: React.FC<{ status?: string }> = ({ status }) => {
  const n = String(status ?? '').toUpperCase();
  const bg =
    n === 'BLOCKED'
      ? 'bg-danger-500'
      : n === 'DONE' || n === 'APPROVED'
        ? 'bg-emerald-500'
        : n === 'EXECUTING' || n === 'IN_PROGRESS' || n === 'PENDING'
          ? 'bg-blue-500'
          : 'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${bg}`} />
      <span className="text-[11px]">{status || '—'}</span>
    </span>
  );
};

/* ── Issue tag ──────────────────────────────────────────────────────────── */

const IssueTag: React.FC<{ row: InitiativeRow }> = ({ row }) => {
  if (row.blocked)
    return (
      <span className="rounded-full bg-danger-500/10 px-2 py-0.5 text-[10px] font-medium text-danger-400">
        {row.blockedReason || 'Blocked'}
      </span>
    );
  if (row.missingDates)
    return (
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
        Missing dates
      </span>
    );
  if (row.overdueTasks > 0)
    return (
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
        Overdue tasks
      </span>
    );
  if (row.overdueDecisions > 0)
    return (
      <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium text-primary-400">
        Decision debt
      </span>
    );
  return (
    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
      On track
    </span>
  );
};

/* ── Artifact link — clickable navigation to initiative / task / decision ── */

const ALink: React.FC<{
  id: string;
  type: ArtifactType;
  children: React.ReactNode;
  nav: NavigateFunction;
  className?: string;
}> = ({ id, type, children, nav, className = '' }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      nav(getArtifactPath(type, id));
    }}
    className={[
      'group/alink inline-flex items-center gap-1 text-left font-medium transition-colors',
      'text-slate-900 hover:text-primary-500 dark:text-white dark:hover:text-primary-400',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-c-focus rounded-sm',
      className,
    ].join(' ')}
    title={`Open ${type}`}
  >
    <span className="underline decoration-slate-300/0 underline-offset-2 transition-all group-hover/alink:decoration-primary-400/60 dark:decoration-white/0">
      {children}
    </span>
    <ExternalLink
      size={10}
      className="shrink-0 opacity-0 transition-opacity group-hover/alink:opacity-60"
    />
  </button>
);

/* ────────────────────────────────────────────────────────────────────────────
   11 Report renderers
   ──────────────────────────────────────────────────────────────────────────── */

const weeklyRenderer: Renderer = (data, _report, nav) => {
  const iniRows = buildInitiativeRows(data)
    .sort(
      (a, b) =>
        Number(b.blocked) - Number(a.blocked) ||
        b.overdueDecisions - a.overdueDecisions ||
        b.overdueTasks - a.overdueTasks
    )
    .slice(0, 10);
  const taskRows = buildTaskRows(data)
    .filter((t) => t.overdue || data.dueSoonTasks.some((d) => d.id === t.id))
    .slice(0, 12);
  const decRows = buildDecisionRows(data).slice(0, 10);
  const unassigned = data.tasks.filter((t) => !t.assigneeName && !isDoneLike(t.status));
  const noDue = data.tasks.filter((t) => !t.dueDate && !isDoneLike(t.status));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="This week at a glance"
        subtitle="Initiatives requiring immediate operational reaction."
        accent="cyan"
      >
        <DataTable
          headers={['Initiative', 'Owner', 'Tasks ⚠/open', 'Decisions', 'Issue']}
          rows={iniRows.map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            r.owner ?? '—',
            <span className={r.overdueTasks > 0 ? 'text-danger-400' : ''}>
              {r.overdueTasks}/{r.openTasks}
            </span>,
            <span className={r.overdueDecisions > 0 ? 'text-amber-400' : ''}>
              {r.overdueDecisions}/{r.pendingDecisions}
            </span>,
            <IssueTag row={r} />,
          ])}
        />
      </Section>

      <Section
        title="Next 7 days focus"
        subtitle="Tasks and milestones that can silently slip this week."
        accent="violet"
      >
        <DataTable
          headers={['Task / Milestone', 'Initiative', 'Owner', 'Due']}
          rows={[
            ...taskRows.map((t) => [
              <ALink id={t.id} type="task" nav={nav}>
                {t.title}
              </ALink>,
              t.initiativeName ?? '—',
              t.assigneeName ?? '—',
              <span className={t.overdue ? 'text-danger-400 font-medium' : ''}>
                {formatDate(t.dueDate)}
              </span>,
            ]),
            ...data.nextMilestones
              .slice(0, 4)
              .map((m) => [
                <span className="font-medium text-primary-400">{m.name}</span>,
                m.initiativeName,
                'Workstream owner',
                formatDate(m.targetDate),
              ]),
          ]}
        />
      </Section>

      <Section
        title="Decision queue"
        subtitle="Decisions blocking tasks or shifting milestones."
        accent="amber"
      >
        <DataTable
          headers={['Decision', 'Initiative', 'Owner', 'Age']}
          rows={decRows.map((d) => [
            <ALink id={d.id} type="decision" nav={nav}>
              {d.title}
            </ALink>,
            d.initiativeName,
            d.ownerName ?? '—',
            <span
              className={
                d.ageDays > 7
                  ? 'text-danger-400 font-medium'
                  : d.ageDays > 0
                    ? 'text-amber-400'
                    : ''
              }
            >
              {d.ageDays > 0 ? `${d.ageDays}d overdue` : 'Due now'}
            </span>,
          ])}
        />
      </Section>

      <Section
        title="Execution hygiene gaps"
        subtitle="Data weaknesses that degrade operational control."
        accent="rose"
      >
        <DataTable
          headers={['Gap', 'Count', 'Examples']}
          rows={[
            [
              'Initiatives without dates',
              data.missingDates.length,
              data.missingDates
                .slice(0, 3)
                .map((i) => i.name)
                .join(', ') || '—',
            ],
            [
              'Unassigned open tasks',
              unassigned.length,
              unassigned
                .slice(0, 3)
                .map((t) => t.title)
                .join(', ') || '—',
            ],
            [
              'Tasks without due date',
              noDue.length,
              noDue
                .slice(0, 3)
                .map((t) => t.title)
                .join(', ') || '—',
            ],
          ]}
        />
      </Section>
    </div>
  );
};

const monthlyPmoRenderer: Renderer = (data, _report, nav) => {
  const iniRows = buildInitiativeRows(data).sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Portfolio control list"
        subtitle="Initiatives for PMO review with real operational exceptions."
        accent="violet"
      >
        <DataTable
          headers={['Initiative', 'Health', 'Progress', 'Owner', 'Target', 'Conf.']}
          rows={iniRows.slice(0, 12).map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            <StatusDot status={r.health} />,
            r.progress != null ? `${r.progress}%` : '—',
            r.owner ?? '—',
            formatDate(r.targetDate),
            <ConfBadge score={r.confidence} />,
          ])}
        />
      </Section>

      <Section
        title="Milestone & schedule exceptions"
        subtitle="What is actually drifting on the timeline."
        accent="amber"
      >
        <DataTable
          headers={['Initiative', 'Type', 'Issue', 'Drift']}
          rows={[
            ...data.timelineWarnings
              .slice(0, 8)
              .map((w) => [
                w.initiativeName,
                <span className={severityText(w.severity)}>{w.type}</span>,
                w.message,
                w.daysOverdue ? `${w.daysOverdue}d` : '—',
              ]),
            ...data.nextMilestones
              .slice(0, 4)
              .map((m) => [
                m.initiativeName,
                <span className="text-primary-400">milestone</span>,
                m.name,
                formatDate(m.targetDate),
              ]),
          ]}
          emptyText="No schedule exceptions."
        />
      </Section>

      <Section
        title="Budget & staffing exceptions"
        subtitle="Exceptions already touching budget or capacity."
        accent="rose"
      >
        <DataTable
          headers={['Initiative / Person', 'Signal', 'Value', 'Action']}
          rows={[
            ...data.overspendSignals
              .slice(0, 6)
              .map((s) => [
                s.initiativeName,
                s.signalType,
                <span className="text-danger-400 font-medium">
                  {Math.round(s.variancePercent)}%
                </span>,
                s.message,
              ]),
            ...data.capacityAlerts
              .slice(0, 6)
              .map((a) => [
                a.name,
                <span className="text-amber-400">capacity</span>,
                `${a.allocatedHours}/${a.capacityHours}h`,
                a.suggestion,
              ]),
          ]}
          emptyText="No budget or staffing exceptions."
        />
      </Section>

      <Section
        title="Governance exceptions"
        subtitle="Items that should enter PMO review or steering."
        accent="cyan"
      >
        <DataTable
          headers={['Category', 'Count', 'Examples']}
          rows={[
            [
              'Blocked initiatives',
              data.blocked.length,
              data.blocked
                .slice(0, 3)
                .map((i) => i.name)
                .join(', ') || '—',
            ],
            [
              'Overdue decisions',
              data.overdueDecisions.length,
              data.overdueDecisions
                .slice(0, 3)
                .map((d) => d.title)
                .join(', ') || '—',
            ],
            [
              'Missing dates',
              data.missingDates.length,
              data.missingDates
                .slice(0, 3)
                .map((i) => i.name)
                .join(', ') || '—',
            ],
          ]}
        />
      </Section>
    </div>
  );
};

const programHealthRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data).sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Program health register"
        subtitle="One line per initiative: what erodes delivery confidence."
        accent="cyan"
      >
        <DataTable
          headers={['Initiative', 'Status', 'Health', 'Conf.', 'Main issue']}
          rows={iniRows.slice(0, 12).map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            <StatusDot status={r.status} />,
            r.health ?? '—',
            <ConfBadge score={r.confidence} />,
            <IssueTag row={r} />,
          ])}
        />
      </Section>

      <Section
        title="Risk & delay drivers"
        subtitle="Strongest signals degrading program health."
        accent="rose"
      >
        <DataTable
          headers={['Signal', 'Initiative', 'Severity']}
          rows={[
            ...data.riskSignals
              .slice(0, 6)
              .map((r) => [
                r.title,
                r.initiativeName ?? '—',
                <span className={severityText(r.severity)}>{r.severity ?? '—'}</span>,
              ]),
            ...data.delaySignals
              .slice(0, 6)
              .map((d) => [
                d.entityName ?? '—',
                d.deviationType ?? 'delay',
                <span className={severityText(d.severity)}>{d.severity ?? '—'}</span>,
              ]),
          ]}
          emptyText="No risk or delay signals."
        />
      </Section>

      <Section
        title="What is turning red"
        subtitle="Initiatives that need rescue now, not monitoring."
        accent="amber"
      >
        <DataTable
          headers={['Initiative', 'Tasks overdue', 'Decisions overdue', 'Target']}
          rows={iniRows
            .filter((r) => r.confidence < 70)
            .slice(0, 8)
            .map((r) => [
              <ALink id={r.id} type="initiative" nav={nav}>
                {r.name}
              </ALink>,
              <span className={r.overdueTasks > 0 ? 'text-danger-400' : ''}>{r.overdueTasks}</span>,
              <span className={r.overdueDecisions > 0 ? 'text-amber-400' : ''}>
                {r.overdueDecisions}
              </span>,
              formatDate(r.targetDate),
            ])}
          emptyText="No initiatives in red/amber zone."
        />
      </Section>

      <Section
        title="Steering implications"
        subtitle="Decisions the steering committee should take."
        accent="violet"
      >
        <ActionCards actions={report.aiRecommendedActions} />
      </Section>
    </div>
  );
};

const blockersRecoveryRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data).filter((r) => r.blocked);
  const blockedIds = new Set(iniRows.map((r) => r.id));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Blocked initiatives recovery board"
        subtitle="What is stuck, why, and what work sits behind it."
        accent="rose"
      >
        <DataTable
          headers={['Initiative', 'Owner', 'Reason', 'Tasks', 'Decisions']}
          rows={iniRows.map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            r.owner ?? '—',
            <span className="text-danger-400">{r.blockedReason || 'Blocked'}</span>,
            `${r.overdueTasks}/${r.openTasks}`,
            `${r.overdueDecisions}/${r.pendingDecisions}`,
          ])}
          emptyText="No blocked initiatives."
        />
      </Section>

      <Section
        title="Tasks stalled behind blockers"
        subtitle="Tasks that cannot move until the initiative is unblocked."
        accent="amber"
      >
        <DataTable
          headers={['Task', 'Initiative', 'Owner', 'Due']}
          rows={buildTaskRows(data)
            .filter(
              (t) => t.initiativeId && blockedIds.has(t.initiativeId) && !isDoneLike(t.status)
            )
            .slice(0, 12)
            .map((t) => [
              <ALink id={t.id} type="task" nav={nav}>
                {t.title}
              </ALink>,
              t.initiativeName ?? '—',
              t.assigneeName ?? '—',
              formatDate(t.dueDate),
            ])}
          emptyText="No stalled tasks."
        />
      </Section>

      <Section
        title="Escalation path"
        subtitle="Decisions and alerts that should be escalated."
        accent="violet"
      >
        <DataTable
          headers={['Decision / Alert', 'Initiative', 'Age / Severity']}
          rows={[
            ...buildDecisionRows(data)
              .filter((d) => d.relatedObjectId && blockedIds.has(d.relatedObjectId))
              .slice(0, 6)
              .map((d) => [
                <ALink id={d.id} type="decision" nav={nav}>
                  {d.title}
                </ALink>,
                d.initiativeName,
                <span className="text-amber-400">{d.ageDays}d</span>,
              ]),
            ...data.priorityAlerts
              .slice(0, 4)
              .map((a) => [
                a.message,
                'Portfolio',
                <span className={severityText(a.severity)}>{a.severity}</span>,
              ]),
          ]}
          emptyText="No escalation items."
        />
      </Section>

      <Section title="Recovery options" subtitle="Actions to unblock delivery." accent="emerald">
        <ActionCards actions={report.aiRecommendedActions} />
      </Section>
    </div>
  );
};

const milestoneSlippageRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data).filter(
    (r) => r.delayCount > 0 || r.timelineWarnings > 0 || r.missingDates
  );
  const overdueTargets = iniRows.filter((r) => {
    const d = daysPastDue(r.targetDate);
    return d !== null && d > 0;
  });

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Slippage register"
        subtitle="Initiatives with real drift against the committed plan."
        accent="amber"
      >
        <DataTable
          headers={['Initiative', 'Target', 'Delay signals', 'Warnings']}
          rows={iniRows.slice(0, 10).map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            formatDate(r.targetDate),
            <span className={r.delayCount > 0 ? 'text-danger-400 font-medium' : ''}>
              {r.delayCount}
            </span>,
            <span className={r.timelineWarnings > 0 ? 'text-amber-400' : ''}>
              {r.timelineWarnings}
            </span>,
          ])}
          emptyText="No slippage signals."
        />
      </Section>

      <Section
        title="Baseline vs forecast gaps"
        subtitle="Missing dates or plan weaknesses that corrupt forecast."
        accent="rose"
      >
        <DataTable
          headers={['Gap', 'Count', 'Examples']}
          rows={[
            [
              'Overdue target dates',
              overdueTargets.length,
              overdueTargets
                .slice(0, 3)
                .map((r) => r.name)
                .join(', ') || '—',
            ],
            [
              'Missing dates',
              data.missingDates.length,
              data.missingDates
                .slice(0, 3)
                .map((r) => r.name)
                .join(', ') || '—',
            ],
            [
              'Timeline warnings',
              data.timelineWarnings.length,
              data.timelineWarnings
                .slice(0, 3)
                .map((w) => w.initiativeName)
                .join(', ') || '—',
            ],
          ]}
        />
      </Section>

      <Section
        title="Next milestones at risk"
        subtitle="Milestones to track day by day."
        accent="violet"
      >
        <DataTable
          headers={['Milestone', 'Initiative', 'Target', 'Issue']}
          rows={data.nextMilestones
            .slice(0, 8)
            .map((m) => [
              <span className="font-medium text-primary-400">{m.name}</span>,
              m.initiativeName,
              formatDate(m.targetDate),
              data.timelineWarnings.find((w) => w.initiativeId === m.initiativeId)?.message ??
                'Monitor',
            ])}
          emptyText="No upcoming milestones."
        />
      </Section>

      <Section
        title="Recovery timeline"
        subtitle="How to restore delivery predictability."
        accent="emerald"
      >
        <AiInsightStrip
          items={[...report.aiExecutiveReadout.slice(0, 2), ...(report.scenarioNotes ?? [])]}
        />
      </Section>
    </div>
  );
};

const capacityUtilizationRenderer: Renderer = (data, _report, nav) => {
  const loadByAssignee = Object.entries(
    data.tasks.reduce<Record<string, { open: number; overdue: number; dueSoon: number }>>(
      (acc, t) => {
        const key = t.assigneeName || 'Unassigned';
        if (!acc[key]) acc[key] = { open: 0, overdue: 0, dueSoon: 0 };
        if (!isDoneLike(t.status)) {
          acc[key].open += 1;
          if (t.dueDate) {
            const due = new Date(t.dueDate).getTime();
            if (due < Date.now()) acc[key].overdue += 1;
            if (due >= Date.now() && due <= Date.now() + 2_419_200_000) acc[key].dueSoon += 1;
          }
        }
        return acc;
      },
      {}
    )
  ).sort(([, a], [, b]) => b.open - a.open);
  const overloaded = new Set(data.capacityAlerts.map((a) => a.name));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Governed capacity alerts"
        subtitle="People already overloaded per control tower."
        accent="rose"
      >
        <DataTable
          headers={['Person', 'Allocated', 'Capacity', 'Overload', 'Action']}
          rows={data.capacityAlerts.map((a) => [
            <span className="font-medium text-slate-900 dark:text-white">{a.name}</span>,
            a.allocatedHours,
            a.capacityHours,
            <span className="text-danger-400 font-medium">{a.overloadHours}h</span>,
            a.suggestion,
          ])}
          emptyText="No governed capacity alerts."
        />
      </Section>

      <Section
        title="Task load by assignee"
        subtitle="Where the work actually sits."
        accent="violet"
      >
        <DataTable
          headers={['Person', 'Open tasks', 'Overdue', 'Due ≤ 4w']}
          rows={loadByAssignee
            .slice(0, 12)
            .map(([name, s]) => [
              <span
                className={
                  overloaded.has(name)
                    ? 'font-semibold text-danger-400'
                    : 'text-slate-900 dark:text-white'
                }
              >
                {name}
              </span>,
              s.open,
              <span className={s.overdue > 0 ? 'text-danger-400' : ''}>{s.overdue}</span>,
              s.dueSoon,
            ])}
        />
      </Section>

      <Section
        title="4-week horizon"
        subtitle="Is capacity enough for the upcoming weeks."
        accent="cyan"
      >
        <DataTable
          headers={['Week', 'Allocated', 'Capacity', 'Free']}
          rows={data.capacityTimeline
            .slice(0, 6)
            .map((w) => [
              formatDate(w.weekStart),
              w.allocatedHours,
              w.capacityHours,
              <span
                className={
                  w.availableHours < 0 ? 'text-danger-400 font-medium' : 'text-emerald-400'
                }
              >
                {w.availableHours}
              </span>,
            ])}
          emptyText="No capacity timeline."
        />
      </Section>

      <Section
        title="Tasks to reassign"
        subtitle="Highest-risk tasks sitting on overloaded people."
        accent="amber"
      >
        <DataTable
          headers={['Task', 'Owner', 'Initiative', 'Due']}
          rows={buildTaskRows(data)
            .filter(
              (t) => t.assigneeName && overloaded.has(t.assigneeName) && !isDoneLike(t.status)
            )
            .slice(0, 10)
            .map((t) => [
              <ALink id={t.id} type="task" nav={nav}>
                {t.title}
              </ALink>,
              t.assigneeName ?? '—',
              t.initiativeName ?? '—',
              formatDate(t.dueDate),
            ])}
          emptyText="No tasks need reassignment."
        />
      </Section>
    </div>
  );
};

const budgetVarianceRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data).filter((r) => r.overspendCount > 0 || r.blocked);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Overspend register"
        subtitle="Initiatives showing dangerous variance."
        accent="rose"
      >
        <DataTable
          headers={['Initiative', 'Signal', 'Planned', 'Actual', 'Variance']}
          rows={data.overspendSignals.slice(0, 10).map((s) => [
            s.initiativeId ? (
              <ALink id={s.initiativeId} type="initiative" nav={nav}>
                {s.initiativeName}
              </ALink>
            ) : (
              s.initiativeName
            ),
            s.signalType,
            s.plannedAmount.toLocaleString(),
            s.actualAmount.toLocaleString(),
            <span className="text-danger-400 font-medium">{Math.round(s.variancePercent)}%</span>,
          ])}
          emptyText="No overspend signals."
        />
      </Section>

      <Section
        title="Execution impact of spend variance"
        subtitle="Is variance already translating into delivery risk."
        accent="amber"
      >
        <DataTable
          headers={['Initiative', 'Blocked', 'Overdue tasks', 'Decisions', 'Progress']}
          rows={iniRows.slice(0, 10).map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            r.blocked ? <span className="text-danger-400">Yes</span> : 'No',
            <span className={r.overdueTasks > 0 ? 'text-danger-400' : ''}>{r.overdueTasks}</span>,
            <span className={r.overdueDecisions > 0 ? 'text-amber-400' : ''}>
              {r.overdueDecisions}
            </span>,
            r.progress != null ? `${r.progress}%` : '—',
          ])}
          emptyText="No execution impact visible."
        />
      </Section>

      <Section
        title="Work items inside overspending initiatives"
        subtitle="What to inspect before a finance decision."
        accent="violet"
      >
        <DataTable
          headers={['Task', 'Initiative', 'Owner', 'Due']}
          rows={buildTaskRows(data)
            .filter((t) =>
              data.overspendSignals.some((s) => s.initiativeId && s.initiativeId === t.initiativeId)
            )
            .slice(0, 10)
            .map((t) => [
              <ALink id={t.id} type="task" nav={nav}>
                {t.title}
              </ALink>,
              t.initiativeName ?? '—',
              t.assigneeName ?? '—',
              formatDate(t.dueDate),
            ])}
          emptyText="No work items linked to overspend."
        />
      </Section>

      <Section
        title="Finance actions"
        subtitle="What to do before variance becomes a sponsor-level problem."
        accent="emerald"
      >
        <ActionCards actions={report.aiRecommendedActions} />
      </Section>
    </div>
  );
};

const decisionBacklogRenderer: Renderer = (data, report, nav) => {
  const decRows = buildDecisionRows(data);
  const iniRows = buildInitiativeRows(data).filter((r) => r.pendingDecisions > 0);
  const buckets = {
    '0–7d': decRows.filter((d) => d.ageDays <= 7).length,
    '8–14d': decRows.filter((d) => d.ageDays > 7 && d.ageDays <= 14).length,
    '15d+': decRows.filter((d) => d.ageDays > 14).length,
  };

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Pending decisions queue"
        subtitle="Full approvals queue still not resolved."
        accent="amber"
      >
        <DataTable
          headers={['Decision', 'Initiative', 'Owner', 'Age', 'Priority']}
          rows={decRows.slice(0, 12).map((d) => [
            <ALink id={d.id} type="decision" nav={nav}>
              {d.title}
            </ALink>,
            d.initiativeName,
            d.ownerName ?? '—',
            <span
              className={
                d.ageDays > 14
                  ? 'text-danger-400 font-medium'
                  : d.ageDays > 7
                    ? 'text-amber-400'
                    : ''
              }
            >
              {d.ageDays > 0 ? `${d.ageDays}d` : 'Due now'}
            </span>,
            <span className={severityText(d.priority)}>{d.priority ?? '—'}</span>,
          ])}
          emptyText="No pending decisions."
        />
      </Section>

      <Section title="Aging buckets" subtitle="How fast decision debt is growing." accent="rose">
        <DataTable
          headers={['Bucket', 'Count']}
          rows={Object.entries(buckets).map(([bucket, count]) => [
            bucket,
            <span className={count > 0 && bucket === '15d+' ? 'text-danger-400 font-medium' : ''}>
              {count}
            </span>,
          ])}
        />
      </Section>

      <Section
        title="Initiatives waiting on decisions"
        subtitle="Initiatives that cannot move without a decision."
        accent="violet"
      >
        <DataTable
          headers={['Initiative', 'Pending', 'Overdue', 'Blocked']}
          rows={iniRows.slice(0, 10).map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            r.pendingDecisions,
            <span className={r.overdueDecisions > 0 ? 'text-danger-400' : ''}>
              {r.overdueDecisions}
            </span>,
            r.blocked ? <span className="text-danger-400">Yes</span> : 'No',
          ])}
          emptyText="No initiatives waiting on decisions."
        />
      </Section>

      <Section
        title="Escalation candidates"
        subtitle="What to escalate rather than continue monitoring."
        accent="cyan"
      >
        <ActionCards actions={report.aiRecommendedActions} />
      </Section>
    </div>
  );
};

const crossDependencyRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data)
    .sort(
      (a, b) =>
        b.pendingDecisions +
        b.dueSoonTasks +
        b.timelineWarnings -
        (a.pendingDecisions + a.dueSoonTasks + a.timelineWarnings)
    )
    .slice(0, 10);
  const depWarnings = data.timelineWarnings.filter((w) => w.type === 'dependency_conflict');

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Dependency conflict register"
        subtitle="Explicit dependency conflicts from control tower."
        accent="rose"
      >
        <DataTable
          headers={['Initiative', 'Severity', 'Issue']}
          rows={depWarnings.map((w) => [
            w.initiativeName,
            <span className={severityText(w.severity)}>{w.severity}</span>,
            w.message,
          ])}
          emptyText="No explicit dependency conflicts."
        />
      </Section>

      <Section
        title="Critical chains"
        subtitle="Initiatives with the highest combination of decisions, tasks and warnings."
        accent="amber"
      >
        <DataTable
          headers={['Initiative', 'Tasks due soon', 'Pending decisions', 'Warnings']}
          rows={iniRows.map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            r.dueSoonTasks,
            r.pendingDecisions,
            <span className={r.timelineWarnings > 0 ? 'text-amber-400' : ''}>
              {r.timelineWarnings}
            </span>,
          ])}
        />
      </Section>

      <Section
        title="Broken links"
        subtitle="Where one initiative's problem is already spreading."
        accent="violet"
      >
        <DataTable
          headers={['Initiative', 'Blocked', 'Overdue tasks', 'Milestone']}
          rows={iniRows
            .filter((r) => r.blocked || r.overdueTasks > 0)
            .slice(0, 8)
            .map((r) => [
              r.name,
              r.blocked ? <span className="text-danger-400">Yes</span> : 'No',
              <span className={r.overdueTasks > 0 ? 'text-danger-400' : ''}>{r.overdueTasks}</span>,
              formatDate(data.nextMilestones.find((m) => m.initiativeId === r.id)?.targetDate),
            ])}
        />
      </Section>

      <Section
        title="Upstream / downstream impact"
        subtitle="What will be hit next if nothing is done."
        accent="cyan"
      >
        <AiInsightStrip
          items={report.aiExecutiveReadout.concat(report.scenarioNotes ?? []).slice(0, 4)}
        />
      </Section>
    </div>
  );
};

const deliveryConfidenceRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data).sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Confidence register"
        subtitle="The most practical view: will we deliver and why not."
        accent="cyan"
      >
        <DataTable
          headers={['Initiative', 'Conf.', 'Blocked', 'High risks', 'Decision debt']}
          rows={iniRows.slice(0, 12).map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            <ConfBadge score={r.confidence} />,
            r.blocked ? <span className="text-danger-400">Yes</span> : 'No',
            <span className={r.highRiskCount > 0 ? 'text-danger-400' : ''}>{r.highRiskCount}</span>,
            <span className={r.overdueDecisions > 0 ? 'text-amber-400' : ''}>
              {r.overdueDecisions}
            </span>,
          ])}
        />
      </Section>

      <Section
        title="Drivers of erosion"
        subtitle="What is destroying confidence in practice."
        accent="rose"
      >
        <DataTable
          headers={['Signal', 'Initiative', 'Severity']}
          rows={[
            ...data.priorityAlerts
              .slice(0, 4)
              .map((a) => [
                a.message,
                'Portfolio',
                <span className={severityText(a.severity)}>{a.severity}</span>,
              ]),
            ...data.riskSignals
              .slice(0, 4)
              .map((r) => [
                r.title,
                r.initiativeName ?? '—',
                <span className={severityText(r.severity)}>{r.severity ?? '—'}</span>,
              ]),
            ...data.delaySignals
              .slice(0, 4)
              .map((d) => [
                d.deviationType ?? 'delay',
                d.entityName ?? '—',
                <span className={severityText(d.severity)}>{d.severity ?? '—'}</span>,
              ]),
          ]}
          emptyText="No confidence erosion drivers."
        />
      </Section>

      <Section
        title="Scenario outlook"
        subtitle="What happens if current exceptions go without reaction."
        accent="amber"
      >
        <AiInsightStrip
          items={report.scenarioNotes ?? []}
          emptyText="No scenario notes generated."
        />
      </Section>
    </div>
  );
};

const sponsorOnePagerRenderer: Renderer = (data, report, nav) => {
  const iniRows = buildInitiativeRows(data);
  const attention = iniRows
    .filter((r) => r.blocked || r.overdueDecisions > 0 || r.overspendCount > 0)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 6);
  const achievements = iniRows
    .filter((r) => (r.progress ?? 0) >= 70 || String(r.status).toUpperCase() === 'DONE')
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    .slice(0, 6);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Section
        title="Sponsor summary"
        subtitle="What the sponsor should understand in 60 seconds."
        accent="violet"
      >
        <AiInsightStrip items={report.aiExecutiveReadout.slice(0, 3)} />
      </Section>

      <Section
        title="Initiatives needing sponsor attention"
        subtitle="Where the sponsor can actually help unblock delivery."
        accent="rose"
      >
        <DataTable
          headers={['Initiative', 'Why now', 'Owner', 'Target']}
          rows={attention.map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            <IssueTag row={r} />,
            r.owner ?? '—',
            formatDate(r.targetDate),
          ])}
          emptyText="No sponsor-level issues."
        />
      </Section>

      <Section
        title="Top achievements"
        subtitle="Proof of progress worth showing the sponsor."
        accent="emerald"
      >
        <DataTable
          headers={['Initiative', 'Progress', 'Owner', 'Next milestone']}
          rows={achievements.map((r) => [
            <ALink id={r.id} type="initiative" nav={nav}>
              {r.name}
            </ALink>,
            <span className="text-emerald-400 font-medium">
              {r.progress != null ? `${r.progress}%` : '—'}
            </span>,
            r.owner ?? '—',
            formatDate(data.nextMilestones.find((m) => m.initiativeId === r.id)?.targetDate),
          ])}
          emptyText="No notable achievements yet."
        />
      </Section>

      <Section
        title="Sponsor asks"
        subtitle="Decisions and support needed from the sponsor."
        accent="cyan"
      >
        <ActionCards actions={report.aiRecommendedActions} />
      </Section>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
   Renderer registry
   ──────────────────────────────────────────────────────────────────────────── */

const REPORT_RENDERERS: Record<string, Renderer> = {
  'weekly-exec': weeklyRenderer,
  'monthly-pmo': monthlyPmoRenderer,
  'program-health': programHealthRenderer,
  'blockers-recovery': blockersRecoveryRenderer,
  'milestone-slippage': milestoneSlippageRenderer,
  'capacity-utilization': capacityUtilizationRenderer,
  'budget-variance': budgetVarianceRenderer,
  'decision-backlog': decisionBacklogRenderer,
  'cross-dependency': crossDependencyRenderer,
  'delivery-confidence': deliveryConfidenceRenderer,
  'sponsor-onepager': sponsorOnePagerRenderer,
};

/* ────────────────────────────────────────────────────────────────────────────
   Main component — Report document full view
   ──────────────────────────────────────────────────────────────────────────── */

export const ReportDocumentView: React.FC<ReportDocumentViewProps> = ({
  report,
  data,
  onBack,
  onGenerateAI,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const safeReport = useMemo(
    (): ReportDef => ({
      ...report,
      highlights: report.highlights ?? [],
      aiExecutiveReadout: report.aiExecutiveReadout ?? [],
      aiRecommendedActions: report.aiRecommendedActions ?? [],
      degradedFlags: report.degradedFlags ?? [],
      scenarioNotes: report.scenarioNotes ?? [],
      dataQuality: report.dataQuality ?? {
        freshnessLabel: 'Live workspace snapshot',
        confidence: '—',
        missingBaselineCount: 0,
        missingEstimateCount: 0,
        knownLimitations: [],
      },
    }),
    [report]
  );

  const rag = useMemo(() => computeRAG(safeReport), [safeReport]);
  const ragConf = RAG_CONFIG[rag];
  const renderer = REPORT_RENDERERS[safeReport.id];

  const handleExportPDF = useCallback(() => {
    try {
      exportReportPDF(safeReport, rag);
      toast.success(t('execution.reportPanel.pdfExported', 'PDF downloaded'));
    } catch {
      toast.error(t('execution.reportPanel.pdfFailed', 'PDF export failed'));
    }
  }, [safeReport, rag, t]);

  const handleCopy = useCallback(() => {
    const md = buildReportMarkdown(safeReport, rag);
    navigator.clipboard.writeText(md).then(
      () => toast.success(t('execution.reportPanel.copied', 'Copied')),
      () => toast.error(t('execution.reportPanel.copyFailed', 'Copy failed'))
    );
  }, [safeReport, rag, t]);

  const handlePresentation = useCallback(() => {
    const md = buildReportMarkdown(safeReport, rag);
    const encoded = encodeURIComponent(md);
    const title = encodeURIComponent(safeReport.title);
    window.open(
      `/prezentacje?sourceType=execution_report&sourceName=${title}&content=${encoded}`,
      '_blank'
    );
  }, [safeReport, rag]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* RAG bar */}
      <div className={`h-1 w-full shrink-0 bg-gradient-to-r ${RAG_BAR[rag]}`} />

      {/* Header */}
      <div className="shrink-0 border-b border-slate-200/60 px-6 pt-4 pb-3 backdrop-blur-sm dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-600 dark:hover:bg-white/[0.06]"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-navy-800/80">
              {safeReport.icon}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {safeReport.title}
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full shadow-sm ${RAG_DOT[rag]}`} />
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${ragConf.text}`}
                  >
                    {ragConf.label}
                  </span>
                </div>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-500">
                <span>{safeReport.audience}</span>
                <span className="text-slate-600 dark:text-slate-400">·</span>
                <span>{safeReport.cadence}</span>
                <span className="text-slate-600 dark:text-slate-400">·</span>
                <span>{safeReport.dataQuality.freshnessLabel}</span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onGenerateAI(safeReport)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-c-text px-3 text-[11px] font-medium text-c-bg shadow-sm transition-colors hover:bg-c-text-secondary active:scale-[0.98]"
            >
              <Sparkles size={12} />
              {t('execution.reportPanel.generateAI', 'Generate with AI')}
            </button>
            {[
              { icon: Download, label: 'PDF', onClick: handleExportPDF },
              { icon: FileText, label: 'PPTX', onClick: handlePresentation },
              { icon: Copy, label: '', onClick: handleCopy },
            ].map(({ icon: Icon, label, onClick }) => (
              <button
                key={label || 'copy'}
                type="button"
                onClick={onClick}
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-200/70 px-2.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50/80 active:scale-[0.98] dark:border-white/[0.08] dark:text-slate-400 dark:hover:bg-white/[0.04]"
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Highlights strip */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {safeReport.highlights.map((h) => (
            <span
              key={h.label}
              className={[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                h.variant === 'critical'
                  ? 'bg-danger-500/10 text-danger-400'
                  : h.variant === 'warn'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-slate-100/80 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400',
              ].join(' ')}
            >
              {h.label}: {h.value}
            </span>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* AI Executive Readout */}
          <GlassCard className="overflow-hidden">
            <div className="flex items-stretch">
              <div className="w-1 shrink-0 bg-gradient-to-b from-primary-500 to-blue-500" />
              <div className="flex-1 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={14} className="text-primary-400" />
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    AI Executive Readout
                  </h3>
                </div>
                <AiInsightStrip items={safeReport.aiExecutiveReadout} />
              </div>
            </div>
          </GlassCard>

          {/* Metric pills */}
          {safeReport.highlights.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {safeReport.highlights.slice(0, 4).map((h) => (
                <MetricPill
                  key={h.label}
                  label={h.label}
                  value={h.value}
                  tone={
                    h.variant === 'critical'
                      ? 'critical'
                      : h.variant === 'warn'
                        ? 'warn'
                        : 'default'
                  }
                  icon={
                    h.variant === 'critical' ? (
                      <AlertTriangle size={16} />
                    ) : h.variant === 'warn' ? (
                      <TrendingDown size={16} />
                    ) : (
                      <TrendingUp size={16} />
                    )
                  }
                />
              ))}
            </div>
          )}

          {/* Report-specific content */}
          {renderer ? (
            renderer(data, safeReport, navigate)
          ) : (
            <Section title="Report Template" subtitle="This report type is not configured yet.">
              <AiInsightStrip items={['No renderer found for this report type.']} />
            </Section>
          )}

          {/* AI Recommended Actions */}
          {safeReport.aiRecommendedActions.length > 0 && (
            <GlassCard className="overflow-hidden">
              <div className="flex items-stretch">
                <div className="w-1 shrink-0 bg-gradient-to-b from-blue-500 to-emerald-500" />
                <div className="flex-1 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-400" />
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      AI Recommended Actions
                    </h3>
                  </div>
                  <ActionCards actions={safeReport.aiRecommendedActions} />
                </div>
              </div>
            </GlassCard>
          )}

          {/* Data quality footer */}
          <QualityFooter report={safeReport} />
        </div>
      </div>
    </div>
  );
};
