/**
 * ReportDocumentView
 *
 * Full-screen execution report opened as a dynamic tab.
 * Each of the 11 report types has a dedicated formatka that fits
 * on a single screen and shows real, live data with RAG status.
 */

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { buildReportMarkdown, computeRAG, exportReportPDF, RAG_CONFIG, type ReportDef } from './ReportCompactPanel';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

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
    severity?: string;
    description?: string;
    suggestedAction?: string;
  }>;
  delaySignals: Array<{
    entityName?: string;
    deviationType?: string;
    daysDeviation?: number;
    severity?: string;
  }>;
  overdueDecisions: Array<{ id: string; title: string; ownerName?: string; dueDate?: string }>;
  missingDates: Array<{ id: string; name: string }>;
  dueSoonTasks: Array<{ id: string; title: string; dueDate?: string; assigneeName?: string }>;
  progressPercent: number | null;
  totalInitiatives: number;
}

interface ReportDocumentViewProps {
  report: ReportDef;
  data: ReportDataContext;
  onBack: () => void;
  onGenerateAI: (report: ReportDef) => void;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const RagBadge: React.FC<{ rag: 'green' | 'amber' | 'red' }> = ({ rag }) => {
  const conf = RAG_CONFIG[rag];
  const Icon = conf.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide ${conf.bg} ${conf.text} ${conf.border} border`}>
      <Icon size={14} />
      {conf.label}
    </div>
  );
};

const SectionHeader: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
  <div className="flex items-center gap-2 mb-2">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
    {count !== undefined && (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 tabular-nums">{count}</span>
    )}
  </div>
);

const MetricCard: React.FC<{ label: string; value: string | number; variant?: 'default' | 'warn' | 'critical' }> = ({ label, value, variant = 'default' }) => (
  <div className={`rounded-lg border px-3 py-2.5 ${
    variant === 'critical' ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30' :
    variant === 'warn' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30' :
    'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
  }`}>
    <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
    <div className={`text-lg font-bold tabular-nums ${
      variant === 'critical' ? 'text-rose-600 dark:text-rose-400' :
      variant === 'warn' ? 'text-amber-600 dark:text-amber-400' :
      'text-slate-900 dark:text-white'
    }`}>{value}</div>
  </div>
);

const MiniTable: React.FC<{
  headers: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
}> = ({ headers, rows, emptyText = 'No data' }) => (
  <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-slate-50 dark:bg-navy-800/50">
          {headers.map((h) => (
            <th key={h} className="text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={headers.length} className="px-3 py-4 text-center text-slate-400 dark:text-slate-500 text-xs">{emptyText}</td></tr>
        )}
        {rows.map((cells, i) => (
          <tr key={i} className="border-t border-slate-100 dark:border-navy-800">
            {cells.map((c, j) => (
              <td key={j} className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const s = String(status).toUpperCase();
  const color = s === 'BLOCKED' ? 'bg-rose-500' : s === 'DONE' ? 'bg-emerald-500' : s === 'IN_PROGRESS' || s === 'EXECUTING' ? 'bg-blue-500' : 'bg-slate-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
};

const HealthDot: React.FC<{ health?: string }> = ({ health }) => {
  const h = String(health || '').toLowerCase();
  const color = h === 'on track' || h === 'on_track' || h === 'green' ? 'text-emerald-500' :
    h === 'at risk' || h === 'at_risk' || h === 'amber' ? 'text-amber-500' :
    h === 'critical' || h === 'red' ? 'text-rose-500' : 'text-slate-400';
  return <span className={`text-xs font-medium ${color}`}>{health || '—'}</span>;
};

// ---------------------------------------------------------------------------
// REPORT FORMATKAS
// ---------------------------------------------------------------------------

function renderWeeklyExec(data: ReportDataContext) {
  const executing = data.initiatives.filter((i) => ['EXECUTING', 'IN_PROGRESS'].includes(String(i.status).toUpperCase()));
  const blocked = data.blocked;
  const overdue = data.overdueDecisions;
  const dueSoon = data.dueSoonTasks.slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Progress" value={data.progressPercent !== null ? `${data.progressPercent}%` : '—'} />
        <MetricCard label="Executing" value={executing.length} />
        <MetricCard label="Blocked" value={blocked.length} variant={blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Overdue Decisions" value={overdue.length} variant={overdue.length > 0 ? 'warn' : 'default'} />
      </div>
      {blocked.length > 0 && (
        <>
          <SectionHeader title="Blockers & Escalations" count={blocked.length} />
          <MiniTable
            headers={['Initiative', 'Reason']}
            rows={blocked.map((b) => [<span className="font-medium">{b.name}</span>, <span className="text-slate-500 dark:text-slate-400">{b.reason || 'No reason specified'}</span>])}
          />
        </>
      )}
      {dueSoon.length > 0 && (
        <>
          <SectionHeader title="Upcoming Due" count={dueSoon.length} />
          <MiniTable
            headers={['Task', 'Due', 'Assignee']}
            rows={dueSoon.map((t) => [t.title, t.dueDate || '—', t.assigneeName || '—'])}
          />
        </>
      )}
      {overdue.length > 0 && (
        <>
          <SectionHeader title="Overdue Decisions" count={overdue.length} />
          <MiniTable
            headers={['Decision', 'Owner', 'Due']}
            rows={overdue.map((d) => [d.title, d.ownerName || '—', d.dueDate || '—'])}
          />
        </>
      )}
    </div>
  );
}

function renderMonthlyPMO(data: ReportDataContext) {
  const byStatus: Record<string, number> = {};
  data.initiatives.forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
  const missing = data.missingDates;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total Initiatives" value={data.totalInitiatives} />
        <MetricCard label="Progress" value={data.progressPercent !== null ? `${data.progressPercent}%` : '—'} />
        <MetricCard label="Missing Dates" value={missing.length} variant={missing.length > 0 ? 'warn' : 'default'} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
      </div>
      <SectionHeader title="Portfolio by Status" />
      <div className="flex flex-wrap gap-2">
        {Object.entries(byStatus).sort(([,a],[,b]) => b - a).map(([st, cnt]) => (
          <div key={st} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800">
            <StatusDot status={st} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{st}</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">{cnt}</span>
          </div>
        ))}
      </div>
      <SectionHeader title="All Initiatives" count={data.totalInitiatives} />
      <MiniTable
        headers={['Initiative', 'Status', 'Health', 'Progress', 'Owner']}
        rows={data.initiatives.slice(0, 15).map((i) => [
          <span className="font-medium">{i.name}</span>,
          <div className="flex items-center gap-1"><StatusDot status={i.status} /><span>{i.status}</span></div>,
          <HealthDot health={i.health} />,
          <span className="tabular-nums">{i.progress != null ? `${i.progress}%` : '—'}</span>,
          <span className="text-slate-500">{i.owner || '—'}</span>,
        ])}
      />
    </div>
  );
}

function renderProgramHealth(data: ReportDataContext) {
  const risks = data.riskSignals.slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Progress" value={data.progressPercent !== null ? `${data.progressPercent}%` : '—'} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Risk Signals" value={data.riskSignals.length} variant={data.riskSignals.length > 3 ? 'warn' : 'default'} />
        <MetricCard label="Delay Signals" value={data.delaySignals.length} variant={data.delaySignals.length > 2 ? 'warn' : 'default'} />
      </div>
      <SectionHeader title="RAG per Initiative" count={data.totalInitiatives} />
      <MiniTable
        headers={['Initiative', 'Status', 'Health', 'Priority']}
        rows={data.initiatives.slice(0, 15).map((i) => [
          <span className="font-medium">{i.name}</span>,
          <div className="flex items-center gap-1"><StatusDot status={i.status} /><span>{i.status}</span></div>,
          <HealthDot health={i.health} />,
          <span className={`text-[10px] font-semibold uppercase ${i.priority === 'CRITICAL' ? 'text-rose-500' : i.priority === 'HIGH' ? 'text-amber-500' : 'text-slate-400'}`}>{i.priority || '—'}</span>,
        ])}
      />
      {risks.length > 0 && (
        <>
          <SectionHeader title="Active Risk Signals" count={risks.length} />
          <MiniTable
            headers={['Risk', 'Initiative', 'Severity', 'Action']}
            rows={risks.map((r) => [
              <span className="font-medium">{r.title}</span>,
              r.initiativeName || '—',
              <span className={`text-[10px] font-semibold uppercase ${r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'text-rose-500' : 'text-amber-500'}`}>{r.severity || '—'}</span>,
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px] inline-block">{r.suggestedAction || '—'}</span>,
            ])}
          />
        </>
      )}
    </div>
  );
}

function renderBlockersRecovery(data: ReportDataContext) {
  const blocked = data.blocked;
  const risks = data.riskSignals.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Active Blockers" value={blocked.length} variant={blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="High/Critical Risks" value={risks.length} variant={risks.length > 0 ? 'warn' : 'default'} />
        <MetricCard label="Due Soon Tasks" value={data.dueSoonTasks.length} />
      </div>
      <SectionHeader title="Blocked Initiatives" count={blocked.length} />
      <MiniTable
        headers={['Initiative', 'Reason']}
        rows={blocked.length > 0
          ? blocked.map((b) => [<span className="font-medium text-rose-600 dark:text-rose-400">{b.name}</span>, b.reason || 'Not specified'])
          : []
        }
        emptyText="No blockers — all clear"
      />
      {risks.length > 0 && (
        <>
          <SectionHeader title="Critical Risk Signals" count={risks.length} />
          <MiniTable
            headers={['Signal', 'Initiative', 'Action']}
            rows={risks.slice(0, 8).map((r) => [<span className="font-medium">{r.title}</span>, r.initiativeName || '—', r.suggestedAction || '—'])}
          />
        </>
      )}
    </div>
  );
}

function renderMilestoneSlippage(data: ReportDataContext) {
  const delays = data.delaySignals.slice(0, 10);
  const missing = data.missingDates;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Delay Signals" value={data.delaySignals.length} variant={data.delaySignals.length > 0 ? 'warn' : 'default'} />
        <MetricCard label="Missing Dates" value={missing.length} variant={missing.length > 0 ? 'warn' : 'default'} />
        <MetricCard label="Total Initiatives" value={data.totalInitiatives} />
      </div>
      <SectionHeader title="Detected Delays" count={delays.length} />
      <MiniTable
        headers={['Entity', 'Type', 'Days Deviation', 'Severity']}
        rows={delays.length > 0
          ? delays.map((d) => [
              d.entityName || '—',
              d.deviationType || '—',
              <span className="tabular-nums font-medium">{d.daysDeviation != null ? `${d.daysDeviation}d` : '—'}</span>,
              <span className={`text-[10px] font-semibold uppercase ${d.severity === 'HIGH' || d.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>{d.severity || '—'}</span>,
            ])
          : []
        }
        emptyText="No delays detected"
      />
      {missing.length > 0 && (
        <>
          <SectionHeader title="Initiatives Missing Dates" count={missing.length} />
          <MiniTable
            headers={['Initiative']}
            rows={missing.slice(0, 10).map((m) => [<span className="text-amber-600 dark:text-amber-400">{m.name}</span>])}
          />
        </>
      )}
    </div>
  );
}

function renderCapacityUtilization(data: ReportDataContext) {
  const assignees: Record<string, { total: number; done: number; blocked: number }> = {};
  data.tasks.forEach((t) => {
    const a = t.assigneeName || 'Unassigned';
    if (!assignees[a]) assignees[a] = { total: 0, done: 0, blocked: 0 };
    assignees[a].total++;
    if (String(t.status).toUpperCase() === 'DONE') assignees[a].done++;
    if (String(t.status).toUpperCase() === 'BLOCKED') assignees[a].blocked++;
  });
  const sorted = Object.entries(assignees).sort(([,a],[,b]) => b.total - a.total);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Total Tasks" value={data.tasks.length} />
        <MetricCard label="People Assigned" value={sorted.filter(([n]) => n !== 'Unassigned').length} />
        <MetricCard label="Unassigned Tasks" value={assignees['Unassigned']?.total || 0} variant={(assignees['Unassigned']?.total || 0) > 5 ? 'warn' : 'default'} />
      </div>
      <SectionHeader title="Workload by Person" count={sorted.length} />
      <MiniTable
        headers={['Person', 'Total', 'Done', 'Blocked', 'Load']}
        rows={sorted.slice(0, 15).map(([name, s]) => {
          const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
          return [
            <span className="font-medium">{name}</span>,
            <span className="tabular-nums">{s.total}</span>,
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{s.done}</span>,
            <span className={`tabular-nums ${s.blocked > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{s.blocked}</span>,
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-slate-400">{pct}%</span>
            </div>,
          ];
        })}
      />
    </div>
  );
}

function renderBudgetVariance(data: ReportDataContext) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Total Initiatives" value={data.totalInitiatives} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Progress" value={data.progressPercent !== null ? `${data.progressPercent}%` : '—'} />
      </div>
      <SectionHeader title="Initiative Budget Overview" count={data.totalInitiatives} />
      <MiniTable
        headers={['Initiative', 'Status', 'Health', 'Owner', 'Target Date']}
        rows={data.initiatives.slice(0, 15).map((i) => [
          <span className="font-medium">{i.name}</span>,
          <div className="flex items-center gap-1"><StatusDot status={i.status} /><span>{i.status}</span></div>,
          <HealthDot health={i.health} />,
          <span className="text-slate-500">{i.owner || '—'}</span>,
          <span className="tabular-nums text-slate-500">{i.targetDate || '—'}</span>,
        ])}
      />
    </div>
  );
}

function renderDecisionBacklog(data: ReportDataContext) {
  const overdue = data.overdueDecisions;
  const pending = data.decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Overdue Decisions" value={overdue.length} variant={overdue.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Pending" value={pending.length} variant={pending.length > 5 ? 'warn' : 'default'} />
        <MetricCard label="Total Decisions" value={data.decisions.length} />
      </div>
      {overdue.length > 0 && (
        <>
          <SectionHeader title="Overdue — Immediate Action Required" count={overdue.length} />
          <MiniTable
            headers={['Decision', 'Owner', 'Due Date']}
            rows={overdue.map((d) => [
              <span className="font-medium text-rose-600 dark:text-rose-400">{d.title}</span>,
              d.ownerName || '—',
              <span className="tabular-nums">{d.dueDate || '—'}</span>,
            ])}
          />
        </>
      )}
      <SectionHeader title="All Pending Decisions" count={pending.length} />
      <MiniTable
        headers={['Decision', 'Priority', 'Owner', 'Due']}
        rows={pending.slice(0, 12).map((d) => [
          <span className="font-medium">{d.title}</span>,
          <span className={`text-[10px] font-semibold uppercase ${d.priority === 'HIGH' || d.priority === 'CRITICAL' ? 'text-amber-500' : 'text-slate-400'}`}>{d.priority || '—'}</span>,
          d.ownerName || '—',
          <span className="tabular-nums">{d.dueDate || '—'}</span>,
        ])}
        emptyText="No pending decisions"
      />
    </div>
  );
}

function renderCrossDependency(data: ReportDataContext) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Total Initiatives" value={data.totalInitiatives} />
        <MetricCard label="Risk Signals" value={data.riskSignals.length} variant={data.riskSignals.length > 3 ? 'warn' : 'default'} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
      </div>
      <SectionHeader title="Initiative Dependency Matrix" count={data.totalInitiatives} />
      <MiniTable
        headers={['Initiative', 'Status', 'Health', 'Priority', 'Tasks']}
        rows={data.initiatives.slice(0, 15).map((i) => {
          const taskCount = data.tasks.filter((t) => t.initiativeId === i.id).length;
          return [
            <span className="font-medium">{i.name}</span>,
            <div className="flex items-center gap-1"><StatusDot status={i.status} /><span>{i.status}</span></div>,
            <HealthDot health={i.health} />,
            <span className={`text-[10px] font-semibold uppercase ${i.priority === 'CRITICAL' ? 'text-rose-500' : i.priority === 'HIGH' ? 'text-amber-500' : 'text-slate-400'}`}>{i.priority || '—'}</span>,
            <span className="tabular-nums">{taskCount}</span>,
          ];
        })}
      />
    </div>
  );
}

function renderDeliveryConfidence(data: ReportDataContext) {
  const risks = data.riskSignals;
  const delays = data.delaySignals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Progress" value={data.progressPercent !== null ? `${data.progressPercent}%` : '—'} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Risk Signals" value={risks.length} variant={risks.length > 3 ? 'warn' : 'default'} />
        <MetricCard label="Delay Signals" value={delays.length} variant={delays.length > 2 ? 'warn' : 'default'} />
      </div>
      <SectionHeader title="Confidence per Initiative" count={data.totalInitiatives} />
      <MiniTable
        headers={['Initiative', 'Status', 'Health', 'Progress', 'Owner']}
        rows={data.initiatives.slice(0, 15).map((i) => [
          <span className="font-medium">{i.name}</span>,
          <div className="flex items-center gap-1"><StatusDot status={i.status} /><span>{i.status}</span></div>,
          <HealthDot health={i.health} />,
          <span className="tabular-nums">{i.progress != null ? `${i.progress}%` : '—'}</span>,
          <span className="text-slate-500">{i.owner || '—'}</span>,
        ])}
      />
      {risks.length > 0 && (
        <>
          <SectionHeader title="Risk Signals Affecting Confidence" count={risks.length} />
          <MiniTable
            headers={['Signal', 'Initiative', 'Severity']}
            rows={risks.slice(0, 6).map((r) => [
              <span className="font-medium">{r.title}</span>,
              r.initiativeName || '—',
              <span className={`text-[10px] font-semibold uppercase ${r.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>{r.severity || '—'}</span>,
            ])}
          />
        </>
      )}
    </div>
  );
}

function renderSponsorOnePager(data: ReportDataContext) {
  const topRisks = data.riskSignals.slice(0, 3);
  const topDecisions = data.overdueDecisions.slice(0, 3);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Progress" value={data.progressPercent !== null ? `${data.progressPercent}%` : '—'} />
        <MetricCard label="Initiatives" value={data.totalInitiatives} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Overdue Decisions" value={data.overdueDecisions.length} variant={data.overdueDecisions.length > 0 ? 'warn' : 'default'} />
      </div>
      {topRisks.length > 0 && (
        <>
          <SectionHeader title="Top 3 Risks" />
          <div className="space-y-2">
            {topRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-slate-900 dark:text-white">{r.title}</div>
                  {r.initiativeName && <div className="text-[10px] text-slate-400 dark:text-slate-500">{r.initiativeName}</div>}
                  {r.suggestedAction && <div className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-0.5">{r.suggestedAction}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {topDecisions.length > 0 && (
        <>
          <SectionHeader title="Decisions Required from Sponsor" />
          <MiniTable
            headers={['Decision', 'Owner', 'Due']}
            rows={topDecisions.map((d) => [<span className="font-medium">{d.title}</span>, d.ownerName || '—', d.dueDate || '—'])}
          />
        </>
      )}
      <SectionHeader title="Portfolio Snapshot" />
      <MiniTable
        headers={['Initiative', 'Status', 'Health']}
        rows={data.initiatives.slice(0, 10).map((i) => [
          <span className="font-medium">{i.name}</span>,
          <div className="flex items-center gap-1"><StatusDot status={i.status} /><span>{i.status}</span></div>,
          <HealthDot health={i.health} />,
        ])}
      />
    </div>
  );
}

const REPORT_RENDERERS: Record<string, (data: ReportDataContext) => React.ReactNode> = {
  'weekly-exec': renderWeeklyExec,
  'monthly-pmo': renderMonthlyPMO,
  'program-health': renderProgramHealth,
  'blockers-recovery': renderBlockersRecovery,
  'milestone-slippage': renderMilestoneSlippage,
  'capacity-utilization': renderCapacityUtilization,
  'budget-variance': renderBudgetVariance,
  'decision-backlog': renderDecisionBacklog,
  'cross-dependency': renderCrossDependency,
  'delivery-confidence': renderDeliveryConfidence,
  'sponsor-onepager': renderSponsorOnePager,
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export const ReportDocumentView: React.FC<ReportDocumentViewProps> = ({
  report,
  data,
  onBack,
  onGenerateAI,
}) => {
  const { t } = useTranslation();
  const rag = useMemo(() => computeRAG(report as any), [report]);

  const handleExportPDF = useCallback(() => {
    try {
      exportReportPDF(report as any, rag);
      toast.success(t('execution.reportPanel.pdfExported', 'PDF downloaded'));
    } catch {
      toast.error(t('execution.reportPanel.pdfFailed', 'PDF export failed'));
    }
  }, [report, rag, t]);

  const handleCopy = useCallback(() => {
    const md = buildReportMarkdown(report as any, rag);
    navigator.clipboard.writeText(md).then(
      () => toast.success(t('execution.reportPanel.copied', 'Copied')),
      () => toast.error(t('execution.reportPanel.copyFailed', 'Copy failed'))
    );
  }, [report, rag, t]);

  const handlePresentation = useCallback(() => {
    const md = buildReportMarkdown(report as any, rag);
    const encoded = encodeURIComponent(md);
    const title = encodeURIComponent(report.title);
    window.open(`/prezentacje?sourceType=execution_report&sourceName=${title}&content=${encoded}`, '_blank');
  }, [report, rag]);

  const renderer = REPORT_RENDERERS[report.id];
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-950 overflow-hidden">
      {/* RAG bar */}
      <div className={`h-1 w-full shrink-0 ${rag === 'green' ? 'bg-emerald-500' : rag === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`} />

      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800">
              {report.icon}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 dark:text-white truncate">{report.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{report.audience}</span>
                <span className="text-[11px] text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{report.cadence}</span>
                <span className="text-[11px] text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{now}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RagBadge rag={rag} />
            <button type="button" onClick={() => onGenerateAI(report)} className="h-8 px-3 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors flex items-center gap-1.5">
              <Sparkles size={12} />
              {t('execution.reportPanel.generateAI', 'Generate with AI')}
            </button>
            <button type="button" onClick={handleExportPDF} className="h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-1.5">
              <Download size={12} />
              PDF
            </button>
            <button type="button" onClick={handlePresentation} className="h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-1.5">
              <FileText size={12} />
              PPTX
            </button>
            <button type="button" onClick={handleCopy} className="h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-1.5">
              <Copy size={12} />
            </button>
          </div>
        </div>

        {/* Live highlights strip */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {report.highlights.map((h) => (
            <span
              key={h.label}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                h.variant === 'critical'
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                  : h.variant === 'warn'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {h.label}: {h.value}
            </span>
          ))}
        </div>
      </div>

      {/* Body — scrollable report content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {renderer ? renderer(data) : (
          <div className="text-center text-slate-400 dark:text-slate-500 py-12">
            <FileText size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Report template not yet configured</p>
          </div>
        )}
      </div>
    </div>
  );
};
