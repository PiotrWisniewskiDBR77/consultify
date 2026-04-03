/**
 * ManagerModuleView
 *
 * Full-screen view for each manager module opened as a dynamic tab.
 * Six modules: action-queue, decisions, blockers, workload, risk, people-change
 */

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ClipboardList,
  Scale,
  Shield,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { FullInitiative, Task } from '../../types';
import type { DelaySignalItem, RiskSignalItem } from './ExecutionTimelineView';
import { ExecutionWorkloadView } from './ExecutionWorkloadView';
import { PeopleChangeWorkspace } from './PeopleChangeWorkspace';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ManagerModuleDataContext {
  initiatives: FullInitiative[];
  tasks: Task[];
  decisions: Array<{
    id: string;
    title: string;
    status: string;
    priority?: string;
    dueDate?: string;
    ownerName?: string;
    relatedObjectId?: string;
    relatedObjectName?: string;
  }>;
  actionQueueItems: Array<{
    type: string;
    id: string;
    title: string;
    initiativeName?: string;
    dueDate?: string;
    severity?: string;
    impact?: string;
    periodStart?: string;
  }>;
  blocked: Array<{ id: string; name: string; reason?: string }>;
  overdueDecisions: Array<{
    id: string;
    title: string;
    ownerName?: string;
    dueDate?: string;
    relatedObjectId?: string;
    relatedObjectName?: string;
  }>;
  missingDates: Array<{ id: string; name: string }>;
  dueSoonTasks: Array<{ id: string; title: string; dueDate?: string; assigneeName?: string }>;
  riskSignals: RiskSignalItem[];
  delaySignals: DelaySignalItem[];
  interventionSuggestions: Array<{
    id: string;
    action: string;
    reason: string;
    expected: string;
    icon: React.ReactNode;
    severity: string;
  }>;
  kpiAlerts: number;
  projectId?: string;
  onInitiativeClick?: (initiative: FullInitiative) => void;
}

export type ManagerModuleId = 'action-queue' | 'decisions' | 'blockers' | 'workload' | 'risk' | 'people-change';

export interface ManagerModuleDef {
  id: ManagerModuleId;
  title: string;
  icon: React.ReactNode;
  metrics: Array<{ label: string; value: number | string; variant?: 'default' | 'warn' | 'critical' }>;
  description: string;
}

interface ManagerModuleViewProps {
  moduleId: string;
  data: ManagerModuleDataContext;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
  <div className="flex items-center gap-2 mb-3">
    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
    {count !== undefined && (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 tabular-nums">{count}</span>
    )}
  </div>
);

const StatusBadge: React.FC<{ type: string }> = ({ type }) => {
  const colors: Record<string, string> = {
    decision_overdue: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    risk_high: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    comm_overdue: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    kpi_deviation_no_plan: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
  };
  const labels: Record<string, string> = {
    decision_overdue: 'Decision',
    risk_high: 'Risk',
    comm_overdue: 'Communication',
    kpi_deviation_no_plan: 'KPI',
  };
  return (
    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${colors[type] || 'bg-slate-200 dark:bg-navy-600 text-slate-700 dark:text-slate-300'}`}>
      {labels[type] || 'Task'}
    </span>
  );
};

// ---------------------------------------------------------------------------
// MODULE RENDERERS
// ---------------------------------------------------------------------------

function renderActionQueue(data: ManagerModuleDataContext) {
  const items = data.actionQueueItems;
  const byType: Record<string, number> = {};
  items.forEach((i) => { byType[i.type] = (byType[i.type] || 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total Items" value={items.length} />
        <MetricCard label="Decisions" value={byType['decision_overdue'] || 0} variant={(byType['decision_overdue'] || 0) > 0 ? 'warn' : 'default'} />
        <MetricCard label="Risks" value={byType['risk_high'] || 0} variant={(byType['risk_high'] || 0) > 0 ? 'critical' : 'default'} />
        <MetricCard label="KPI Deviations" value={byType['kpi_deviation_no_plan'] || 0} variant={(byType['kpi_deviation_no_plan'] || 0) > 0 ? 'warn' : 'default'} />
      </div>
      {items.length === 0 ? (
        <EmptyState text="No action items — everything is on track." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {item.initiativeName || '—'}
                  {item.dueDate ? ` · Due ${new Date(item.dueDate).toLocaleDateString()}` : ''}
                  {item.severity ? ` · ${item.severity}` : ''}
                </p>
              </div>
              <StatusBadge type={item.type} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderDecisions(data: ManagerModuleDataContext) {
  const overdue = data.overdueDecisions;
  const pending = data.decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING');
  const approved = data.decisions.filter((d) => String(d.status).toUpperCase() === 'APPROVED');
  const rejected = data.decisions.filter((d) => String(d.status).toUpperCase() === 'REJECTED');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Overdue" value={overdue.length} variant={overdue.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Pending" value={pending.length} variant={pending.length > 5 ? 'warn' : 'default'} />
        <MetricCard label="Approved" value={approved.length} />
        <MetricCard label="Rejected" value={rejected.length} />
      </div>
      {overdue.length > 0 && (
        <>
          <SectionHeader title="Overdue — Immediate Action" count={overdue.length} />
          <div className="space-y-2">
            {overdue.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-rose-50/60 dark:bg-rose-900/10 border border-rose-200/60 dark:border-rose-800/30">
                <Scale size={14} className="text-rose-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{d.ownerName || '—'} · {d.relatedObjectName || '—'} · Due {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <SectionHeader title="All Pending Decisions" count={pending.length} />
      {pending.length === 0 ? (
        <EmptyState text="No pending decisions." />
      ) : (
        <div className="space-y-2">
          {pending.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
              <Scale size={14} className="text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{d.ownerName || '—'} · {d.priority || '—'} · {d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderBlockers(data: ManagerModuleDataContext) {
  const blocked = data.blocked;
  const highRisks = data.riskSignals.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH');
  const suggestions = data.interventionSuggestions.filter((s) => s.severity === 'high');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Blocked Initiatives" value={blocked.length} variant={blocked.length > 0 ? 'critical' : 'default'} />
        <MetricCard label="Critical/High Risks" value={highRisks.length} variant={highRisks.length > 0 ? 'warn' : 'default'} />
        <MetricCard label="Due Soon Tasks" value={data.dueSoonTasks.length} />
      </div>
      {blocked.length > 0 && (
        <>
          <SectionHeader title="Blocked Initiatives" count={blocked.length} />
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-start gap-3 py-3 px-4 rounded-lg bg-rose-50/60 dark:bg-rose-900/10 border border-rose-200/60 dark:border-rose-800/30">
                <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{b.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{b.reason || 'No reason specified'}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {blocked.length === 0 && <EmptyState text="No blockers — all initiatives are running." icon={<CheckCircle2 size={24} className="text-emerald-500" />} />}
      {suggestions.length > 0 && (
        <>
          <SectionHeader title="Recovery Suggestions" count={suggestions.length} />
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-start gap-3 py-3 px-4 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50/40 dark:bg-rose-900/10">
                <div className="shrink-0 mt-0.5">{s.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.reason}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">→ {s.expected}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RenderWorkload({ data }: { data: ManagerModuleDataContext }) {
  const assignees: Record<string, { total: number; done: number; blocked: number; inProgress: number }> = {};
  data.tasks.forEach((t: any) => {
    const a = t.assigneeName || t.assignee?.name || 'Unassigned';
    if (!assignees[a]) assignees[a] = { total: 0, done: 0, blocked: 0, inProgress: 0 };
    assignees[a].total++;
    const s = String(t.status).toUpperCase();
    if (s === 'DONE') assignees[a].done++;
    if (s === 'BLOCKED') assignees[a].blocked++;
    if (s === 'IN_PROGRESS') assignees[a].inProgress++;
  });
  const sorted = Object.entries(assignees).sort(([,a],[,b]) => b.total - a.total);
  const overloaded = sorted.filter(([,s]) => s.total > 10).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total Tasks" value={data.tasks.length} />
        <MetricCard label="People" value={sorted.filter(([n]) => n !== 'Unassigned').length} />
        <MetricCard label="Overloaded" value={overloaded} variant={overloaded > 0 ? 'warn' : 'default'} />
        <MetricCard label="Unassigned" value={assignees['Unassigned']?.total || 0} variant={(assignees['Unassigned']?.total || 0) > 5 ? 'warn' : 'default'} />
      </div>
      <SectionHeader title="Workload per Person" count={sorted.length} />
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-800/50">
              {['Person', 'Total', 'In Progress', 'Done', 'Blocked', 'Completion'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 20).map(([name, s]) => {
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <tr key={name} className="border-t border-slate-100 dark:border-navy-800">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{name}</td>
                  <td className="px-3 py-2 tabular-nums">{s.total}</td>
                  <td className="px-3 py-2 tabular-nums text-blue-600 dark:text-blue-400">{s.inProgress}</td>
                  <td className="px-3 py-2 tabular-nums text-emerald-600 dark:text-emerald-400">{s.done}</td>
                  <td className="px-3 py-2 tabular-nums text-rose-600 dark:text-rose-400">{s.blocked}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-slate-400">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.dueSoonTasks.length > 0 && (
        <>
          <SectionHeader title="Due Soon" count={data.dueSoonTasks.length} />
          <div className="space-y-2">
            {data.dueSoonTasks.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 px-4 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                <Clock size={12} className="text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900 dark:text-white truncate">{t.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.assigneeName || '—'} · {t.dueDate || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function renderRisk(data: ManagerModuleDataContext) {
  const risks = data.riskSignals;
  const delays = data.delaySignals;
  const critical = risks.filter((r) => r.severity === 'CRITICAL').length;
  const high = risks.filter((r) => r.severity === 'HIGH').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Risk Signals" value={risks.length} variant={risks.length > 3 ? 'warn' : 'default'} />
        <MetricCard label="Critical" value={critical} variant={critical > 0 ? 'critical' : 'default'} />
        <MetricCard label="Delay Signals" value={delays.length} variant={delays.length > 2 ? 'warn' : 'default'} />
        <MetricCard label="Blocked" value={data.blocked.length} variant={data.blocked.length > 0 ? 'critical' : 'default'} />
      </div>
      {risks.length === 0 && delays.length === 0 ? (
        <EmptyState text="No risk signals detected. Delivery is on track." icon={<CheckCircle2 size={24} className="text-emerald-500" />} />
      ) : (
        <>
          {risks.length > 0 && (
            <>
              <SectionHeader title="Risk Signals" count={risks.length} />
              <div className="space-y-2">
                {risks.map((rs) => (
                  <div key={rs.id} className="flex items-start gap-3 py-3 px-4 rounded-lg bg-rose-50/60 dark:bg-rose-900/10 border border-rose-200/50 dark:border-rose-800/30">
                    <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {rs.title} <span className="text-slate-400 font-normal">· {rs.initiativeName}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rs.description}</p>
                      {rs.suggestedAction && (
                        <p className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-1">→ {rs.suggestedAction}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      rs.severity === 'CRITICAL' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' :
                      rs.severity === 'HIGH' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                      'bg-slate-100 dark:bg-navy-800 text-slate-500'
                    }`}>{rs.severity}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {delays.length > 0 && (
            <>
              <SectionHeader title="Delay Signals" count={delays.length} />
              <div className="space-y-2">
                {delays.map((ds, idx) => (
                  <div key={`delay-${idx}`} className="flex items-start gap-3 py-3 px-4 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                    <Clock size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ds.entityName || `Delay #${idx + 1}`}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {ds.deviationType.replace(/_/g, ' ')} · {ds.daysDeviation}d
                        {ds.whySlipReasons?.length > 0 && ` — ${ds.whySlipReasons[0].reason}`}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      ds.severity === 'CRITICAL' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                    }`}>{ds.severity}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {data.interventionSuggestions.length > 0 && (
        <>
          <SectionHeader title="Intervention Suggestions" count={data.interventionSuggestions.length} />
          <div className="space-y-2">
            {data.interventionSuggestions.map((s) => (
              <div key={s.id} className={`flex items-start gap-3 py-3 px-4 rounded-xl border ${
                s.severity === 'high' ? 'border-rose-200 dark:border-rose-800/40 bg-rose-50/40 dark:bg-rose-900/10' :
                s.severity === 'medium' ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10' :
                'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
              }`}>
                <div className="shrink-0 mt-0.5">{s.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.reason}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">→ {s.expected}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RenderPeopleChange({ data }: { data: ManagerModuleDataContext }) {
  const withoutOwner = data.initiatives.filter((i: any) => !i.ownerId && !i.assigneeId);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Initiatives" value={data.initiatives.length} />
        <MetricCard label="Missing Owners" value={withoutOwner.length} variant={withoutOwner.length > 0 ? 'warn' : 'default'} />
        <MetricCard label="Missing Dates" value={data.missingDates.length} variant={data.missingDates.length > 0 ? 'warn' : 'default'} />
      </div>
      {withoutOwner.length > 0 && (
        <>
          <SectionHeader title="Initiatives Without Owner" count={withoutOwner.length} />
          <div className="space-y-2">
            {withoutOwner.slice(0, 15).map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2 px-4 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                <Users size={12} className="text-amber-500 shrink-0" />
                <span className="text-sm text-slate-900 dark:text-white truncate">{i.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <SectionHeader title="Stakeholder & Change Management" />
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <PeopleChangeWorkspace
          initiativeId={undefined}
          projectId={data.projectId}
        />
      </div>
    </div>
  );
}

const MODULE_RENDERERS: Record<string, (data: ManagerModuleDataContext) => React.ReactNode> = {
  'action-queue': renderActionQueue,
  'decisions': renderDecisions,
  'blockers': renderBlockers,
  'risk': renderRisk,
};

const MODULE_COMPONENT_RENDERERS: Record<string, React.FC<{ data: ManagerModuleDataContext }>> = {
  'workload': RenderWorkload,
  'people-change': RenderPeopleChange,
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  'action-queue': <ClipboardList size={18} className="text-cyan-500" />,
  'decisions': <Scale size={18} className="text-amber-500" />,
  'blockers': <AlertTriangle size={18} className="text-rose-500" />,
  'workload': <Users size={18} className="text-violet-500" />,
  'risk': <Shield size={18} className="text-rose-500" />,
  'people-change': <Users size={18} className="text-emerald-500" />,
};

const MODULE_TITLES: Record<string, string> = {
  'action-queue': 'Action Queue',
  'decisions': 'Decisions & Approvals',
  'blockers': 'Blockers & Escalations',
  'workload': 'Resource & Workload',
  'risk': 'Execution Risk',
  'people-change': 'People & Change',
};

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

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

const EmptyState: React.FC<{ text: string; icon?: React.ReactNode }> = ({ text, icon }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    {icon || <CheckCircle2 size={24} className="text-emerald-500 mb-2" />}
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{text}</p>
  </div>
);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export const ManagerModuleView: React.FC<ManagerModuleViewProps> = ({
  moduleId,
  data,
  onBack,
}) => {
  const { t } = useTranslation();
  const icon = MODULE_ICONS[moduleId];
  const title = MODULE_TITLES[moduleId] || moduleId;

  const renderer = MODULE_RENDERERS[moduleId];
  const ComponentRenderer = MODULE_COMPONENT_RENDERERS[moduleId];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800">
            {icon}
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {t('execution.manager.moduleSubtitle', 'Execution Management · {{date}}', { date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {renderer ? renderer(data) : ComponentRenderer ? <ComponentRenderer data={data} /> : (
          <EmptyState text="Module not configured" />
        )}
      </div>
    </div>
  );
};
