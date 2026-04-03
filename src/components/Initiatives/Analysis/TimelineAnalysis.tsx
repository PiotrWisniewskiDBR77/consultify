/**
 * TimelineAnalysis — AI-powered timeline management
 * V3-F02c: Auto-schedule, conflict detection, timeline optimizer,
 *          delay impact analysis, filterable stat cards, Gantt chart
 */

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Loader2,
  Sparkles,
  Timer,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { PortfolioInitiative } from '@/types';

import type { AnalysisIssue, DependencyLink, OrgUser, QuickUpdatePayload, TimelineBar } from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type StatusFilter = 'all' | 'on-schedule' | 'delayed' | 'at-risk' | 'no-dates';

interface ScheduleProposal {
  initiativeId: string;
  initiativeName: string;
  suggestedStart: string;
  suggestedEnd: string;
  reason: string;
  durationDays: number;
}

interface ConflictInfo {
  initiativeA: string;
  nameA: string;
  initiativeB: string;
  nameB: string;
  ownerName: string;
  overlapDays: number;
  suggestion: string;
}

interface OptimizationTip {
  type: 'compress' | 'parallelize' | 'reorder';
  description: string;
  initiatives: string[];
  initiativeNames: string[];
}

interface DelayImpact {
  delayedId: string;
  delayedName: string;
  affected: { id: string; name: string; delayDays: number }[];
}

interface TimelineAnalysisProps {
  bars: TimelineBar[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
  initiatives?: PortfolioInitiative[];
  dependencies?: DependencyLink[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BAR_COLORS = {
  'on-schedule': 'bg-blue-500',
  delayed: 'bg-red-500',
  'at-risk': 'bg-amber-500',
  'no-dates': 'bg-slate-400 dark:bg-slate-500',
} as const;

function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const TimelineAnalysis: React.FC<TimelineAnalysisProps> = ({
  bars,
  issues,
  onOpenInitiative,
  onQuickUpdate,
  users: _users = [],
  initiatives = [],
  dependencies = [],
}) => {
  const { t } = useTranslation();

  // Inline date editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // AI panels
  const [scheduleRunning, setScheduleRunning] = useState(false);
  const [scheduleProposals, setScheduleProposals] = useState<ScheduleProposal[] | null>(null);
  const [applyingScheduleIdx, setApplyingScheduleIdx] = useState<number | null>(null);

  const [showConflicts, setShowConflicts] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [showDelayImpact, setShowDelayImpact] = useState(false);

  /* ---------- stats ---------- */

  const counts = useMemo(() => {
    const onSchedule = bars.filter((b) => b.status === 'on-schedule').length;
    const delayed = bars.filter((b) => b.status === 'delayed').length;
    const atRisk = bars.filter((b) => b.status === 'at-risk').length;
    const noDates = bars.filter((b) => b.status === 'no-dates').length;
    return { onSchedule, delayed, atRisk, noDates, total: bars.length };
  }, [bars]);

  /* ---------- filtered bars ---------- */

  const filteredBars = useMemo(() => {
    if (statusFilter === 'all') return bars;
    return bars.filter((b) => b.status === statusFilter);
  }, [bars, statusFilter]);

  /* ---------- Gantt date range ---------- */

  const dates = bars.flatMap((b) => [b.startDate, b.endDate].filter(Boolean) as string[]);
  const minDate = dates.length ? new Date(Math.min(...dates.map((d) => new Date(d).getTime()))) : new Date();
  const maxDate = dates.length ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))) : new Date();
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;

  const getLeftPercent = (dateStr: string | null) => {
    if (!dateStr) return 0;
    return ((new Date(dateStr).getTime() - minDate.getTime()) / totalMs) * 100;
  };

  const getWidthPercent = (start: string | null, end: string | null) => {
    if (!start || !end) return 8;
    return Math.max(8, ((new Date(end).getTime() - new Date(start).getTime()) / totalMs) * 100);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  /* ---------- inline edit ---------- */

  const startEditing = (bar: TimelineBar) => {
    setEditingId(bar.initiativeId);
    setEditStart(bar.startDate ? bar.startDate.slice(0, 10) : '');
    setEditEnd(bar.endDate ? bar.endDate.slice(0, 10) : '');
  };

  const handleSaveDates = useCallback(
    async (initiativeId: string) => {
      if (!onQuickUpdate) return;
      if (editStart && editEnd && new Date(editStart) > new Date(editEnd)) {
        toast.error(t('initiatives.analysis.timeline.invalidDates', 'Start must be before end'));
        return;
      }
      setSaving(true);
      try {
        const updates: QuickUpdatePayload = {};
        if (editStart) updates.plannedStartDate = editStart;
        if (editEnd) updates.plannedEndDate = editEnd;
        await onQuickUpdate(initiativeId, updates);
        toast.success(t('initiatives.analysis.timeline.datesUpdated', 'Dates updated'));
        setEditingId(null);
      } catch {
        toast.error(t('initiatives.analysis.timeline.updateFailed', 'Failed'));
      } finally {
        setSaving(false);
      }
    },
    [editEnd, editStart, onQuickUpdate, t]
  );

  /* ---------- AI Auto-Schedule ---------- */

  const computeAutoSchedule = useCallback(() => {
    setScheduleRunning(true);
    setTimeout(() => {
      const noDates = initiatives.filter((i) => !i.plannedStartDate || !i.plannedEndDate);
      const withDates = initiatives.filter((i) => i.plannedStartDate && i.plannedEndDate);

      const ownerEndDates = new Map<string, string>();
      for (const i of withDates) {
        const ownerId = i.ownerBusiness?.id;
        if (ownerId && i.plannedEndDate) {
          const cur = ownerEndDates.get(ownerId);
          if (!cur || new Date(i.plannedEndDate) > new Date(cur)) {
            ownerEndDates.set(ownerId, i.plannedEndDate);
          }
        }
      }

      const depEndDates = new Map<string, string>();
      for (const d of dependencies) {
        const depInit = initiatives.find((i) => i.id === d.toId);
        if (depInit?.plannedEndDate) {
          const cur = depEndDates.get(d.fromId);
          if (!cur || new Date(depInit.plannedEndDate) > new Date(cur)) {
            depEndDates.set(d.fromId, depInit.plannedEndDate);
          }
        }
      }

      const proposals: ScheduleProposal[] = [];
      const today = new Date().toISOString().slice(0, 10);
      let nextSlot = today;

      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const sorted = [...noDates].sort(
        (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );

      for (const init of sorted) {
        const ownerId = init.ownerBusiness?.id;
        const ownerEnd = ownerId ? ownerEndDates.get(ownerId) : undefined;
        const depEnd = depEndDates.get(init.id);

        let suggestedStart = today;
        const reasons: string[] = [];

        if (depEnd && new Date(depEnd) > new Date(suggestedStart)) {
          suggestedStart = addDays(depEnd, 1);
          reasons.push(`after dependency completes (${formatDate(depEnd)})`);
        }
        if (ownerEnd && new Date(ownerEnd) > new Date(suggestedStart)) {
          suggestedStart = addDays(ownerEnd, 1);
          reasons.push(`owner available after ${formatDate(ownerEnd)}`);
        }
        if (new Date(suggestedStart) < new Date(nextSlot)) {
          suggestedStart = nextSlot;
        }

        const durationDays = init.priority === 'CRITICAL' ? 60 : init.priority === 'HIGH' ? 90 : 120;
        const suggestedEnd = addDays(suggestedStart, durationDays);

        if (reasons.length === 0) reasons.push('no blockers — can start immediately');

        proposals.push({
          initiativeId: init.id,
          initiativeName: init.name,
          suggestedStart,
          suggestedEnd,
          reason: reasons.join('; '),
          durationDays,
        });

        if (ownerId) {
          ownerEndDates.set(ownerId, suggestedEnd);
        }
        if (new Date(suggestedEnd) > new Date(nextSlot)) {
          nextSlot = suggestedEnd;
        }
      }

      setScheduleProposals(proposals);
      setScheduleRunning(false);
    }, 700);
  }, [dependencies, initiatives]);

  const handleApplySchedule = useCallback(
    async (p: ScheduleProposal, idx: number) => {
      if (!onQuickUpdate) return;
      setApplyingScheduleIdx(idx);
      try {
        await onQuickUpdate(p.initiativeId, {
          plannedStartDate: p.suggestedStart,
          plannedEndDate: p.suggestedEnd,
        });
        toast.success(t('initiatives.analysis.fixApplied', 'Dates applied'));
        setScheduleProposals((prev) => prev?.filter((_, i) => i !== idx) ?? null);
      } catch {
        toast.error(t('initiatives.analysis.fixFailed', 'Failed'));
      } finally {
        setApplyingScheduleIdx(null);
      }
    },
    [onQuickUpdate, t]
  );

  const handleApplyAllSchedule = useCallback(async () => {
    if (!onQuickUpdate || !scheduleProposals) return;
    setScheduleRunning(true);
    let ok = 0;
    for (const p of scheduleProposals) {
      try {
        await onQuickUpdate(p.initiativeId, {
          plannedStartDate: p.suggestedStart,
          plannedEndDate: p.suggestedEnd,
        });
        ok++;
      } catch { /* skip */ }
    }
    toast.success(`Applied dates to ${ok} initiative(s)`);
    setScheduleProposals(null);
    setScheduleRunning(false);
  }, [onQuickUpdate, scheduleProposals]);

  /* ---------- AI Conflict Detector ---------- */

  const conflicts = useMemo((): ConflictInfo[] => {
    const result: ConflictInfo[] = [];
    const withDates = initiatives.filter((i) => i.plannedStartDate && i.plannedEndDate);

    for (let i = 0; i < withDates.length; i++) {
      for (let j = i + 1; j < withDates.length; j++) {
        const a = withDates[i];
        const b = withDates[j];
        const aOwnerId = a.ownerBusiness?.id;
        const bOwnerId = b.ownerBusiness?.id;
        if (!aOwnerId || !bOwnerId || aOwnerId !== bOwnerId) continue;

        const aStart = new Date(a.plannedStartDate!).getTime();
        const aEnd = new Date(a.plannedEndDate!).getTime();
        const bStart = new Date(b.plannedStartDate!).getTime();
        const bEnd = new Date(b.plannedEndDate!).getTime();

        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        if (overlapStart < overlapEnd) {
          const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
          const ownerName = a.ownerBusiness
            ? `${a.ownerBusiness.firstName} ${a.ownerBusiness.lastName}`
            : aOwnerId;
          result.push({
            initiativeA: a.id,
            nameA: a.name,
            initiativeB: b.id,
            nameB: b.name,
            ownerName,
            overlapDays,
            suggestion: `Shift "${b.name}" to start after "${a.name}" ends (${formatDate(a.plannedEndDate!)})`,
          });
        }
      }
    }

    return result.sort((a, b) => b.overlapDays - a.overlapDays);
  }, [initiatives]);

  /* ---------- AI Timeline Optimizer ---------- */

  const optimizationTips = useMemo((): OptimizationTip[] => {
    const tips: OptimizationTip[] = [];
    const withDates = initiatives.filter((i) => i.plannedStartDate && i.plannedEndDate);

    const ownerGroups = new Map<string, PortfolioInitiative[]>();
    for (const i of withDates) {
      const oid = i.ownerBusiness?.id;
      if (!oid) continue;
      if (!ownerGroups.has(oid)) ownerGroups.set(oid, []);
      ownerGroups.get(oid)!.push(i);
    }

    for (const [, group] of ownerGroups) {
      if (group.length < 2) continue;
      group.sort((a, b) => new Date(a.plannedStartDate!).getTime() - new Date(b.plannedStartDate!).getTime());
      for (let i = 0; i < group.length - 1; i++) {
        const gap = daysBetween(group[i].plannedEndDate!, group[i + 1].plannedStartDate!);
        if (gap > 14) {
          tips.push({
            type: 'compress',
            description: `${gap}-day gap between "${group[i].name}" and "${group[i + 1].name}" — move earlier to compress timeline`,
            initiatives: [group[i].id, group[i + 1].id],
            initiativeNames: [group[i].name, group[i + 1].name],
          });
        }
      }
    }

    const differentOwnerPairs: PortfolioInitiative[][] = [];
    for (const i of withDates) {
      for (const j of withDates) {
        if (i.id >= j.id) continue;
        const iOwner = i.ownerBusiness?.id;
        const jOwner = j.ownerBusiness?.id;
        if (iOwner && jOwner && iOwner !== jOwner) {
          const iEnd = new Date(i.plannedEndDate!).getTime();
          const jStart = new Date(j.plannedStartDate!).getTime();
          if (jStart > iEnd) {
            const hasDep = dependencies.some(
              (d) => (d.fromId === j.id && d.toId === i.id) || (d.fromId === i.id && d.toId === j.id)
            );
            if (!hasDep) {
              differentOwnerPairs.push([i, j]);
            }
          }
        }
      }
    }

    if (differentOwnerPairs.length > 0) {
      const first3 = differentOwnerPairs.slice(0, 3);
      for (const [a, b] of first3) {
        tips.push({
          type: 'parallelize',
          description: `"${a.name}" and "${b.name}" have different owners and no dependency — can run in parallel`,
          initiatives: [a.id, b.id],
          initiativeNames: [a.name, b.name],
        });
      }
    }

    return tips;
  }, [dependencies, initiatives]);

  /* ---------- AI Delay Impact ---------- */

  const delayImpacts = useMemo((): DelayImpact[] => {
    const delayed = bars.filter((b) => b.status === 'delayed');
    const idToInit = new Map(initiatives.map((i) => [i.id, i]));

    return delayed.map((bar) => {
      const init = idToInit.get(bar.initiativeId);
      const affected: DelayImpact['affected'] = [];

      for (const dep of dependencies) {
        if (dep.toId === bar.initiativeId) {
          const depInit = idToInit.get(dep.fromId);
          if (depInit && init?.plannedEndDate && depInit.plannedStartDate) {
            const diff = daysBetween(depInit.plannedStartDate, init.plannedEndDate);
            if (diff > 0) {
              affected.push({ id: dep.fromId, name: dep.fromName, delayDays: diff });
            }
          }
        }
      }

      for (const dep of dependencies) {
        if (dep.toId === bar.initiativeId) {
          for (const dep2 of dependencies) {
            if (dep2.toId === dep.fromId) {
              const init2 = idToInit.get(dep2.fromId);
              if (init2 && !affected.find((a) => a.id === dep2.fromId)) {
                affected.push({ id: dep2.fromId, name: dep2.fromName, delayDays: 0 });
              }
            }
          }
        }
      }

      return {
        delayedId: bar.initiativeId,
        delayedName: bar.initiativeName,
        affected,
      };
    }).filter((d) => d.affected.length > 0);
  }, [bars, dependencies, initiatives]);

  /* ---------- portfolio end date ---------- */

  const portfolioEndDate = useMemo(() => {
    const endDates = initiatives
      .map((i) => i.plannedEndDate)
      .filter(Boolean) as string[];
    if (endDates.length === 0) return null;
    return endDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [initiatives]);

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Stat cards — clickable filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 grid grid-cols-4 gap-3">
          {([
            { key: 'on-schedule' as StatusFilter, label: 'On schedule', count: counts.onSchedule, color: 'blue', border: 'border-blue-200 dark:border-blue-900/50', bg: 'bg-blue-500/5 dark:bg-blue-500/10' },
            { key: 'at-risk' as StatusFilter, label: 'At risk', count: counts.atRisk, color: 'amber', border: 'border-amber-200 dark:border-amber-900/50', bg: 'bg-amber-500/5 dark:bg-amber-500/10' },
            { key: 'delayed' as StatusFilter, label: 'Delayed', count: counts.delayed, color: 'red', border: 'border-red-200 dark:border-red-900/50', bg: 'bg-red-500/5 dark:bg-red-500/10' },
            { key: 'no-dates' as StatusFilter, label: 'No dates', count: counts.noDates, color: 'slate', border: 'border-slate-200 dark:border-navy-700', bg: 'bg-white dark:bg-navy-900' },
          ] as const).map((card) => (
            <button
              key={card.key}
              onClick={() => setStatusFilter((f) => (f === card.key ? 'all' : card.key))}
              className={`rounded-xl border p-3 text-left transition-all
                ${statusFilter === card.key
                  ? `${card.border} ${card.bg} ring-2 ring-${card.color}-400/40 ring-offset-1 ring-offset-white dark:ring-offset-navy-950`
                  : `${card.border} ${card.bg} hover:shadow-sm`
                }`}
            >
              <div className={`text-xl font-semibold text-${card.color}-600 dark:text-${card.color}-400`}>
                {card.count}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio end date */}
      {portfolioEndDate && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Timer size={12} />
          Portfolio estimated completion: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(portfolioEndDate).toLocaleDateString()}</span>
        </div>
      )}

      {/* AI action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {onQuickUpdate && (
          <button
            onClick={computeAutoSchedule}
            disabled={scheduleRunning}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold
              bg-gradient-to-r from-purple-600 to-indigo-600 text-white
              hover:from-purple-700 hover:to-indigo-700
              disabled:opacity-60 shadow-lg shadow-purple-500/20 transition-all"
          >
            {scheduleRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Auto-Schedule
          </button>
        )}
        <button
          onClick={() => setShowConflicts((v) => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all
            ${showConflicts
              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-400/40'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
            }`}
        >
          <AlertTriangle size={14} />
          Conflicts ({conflicts.length})
        </button>
        <button
          onClick={() => setShowOptimizer((v) => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all
            ${showOptimizer
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-400/40'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
            }`}
        >
          <TrendingUp size={14} />
          AI Optimizer
        </button>
        {delayImpacts.length > 0 && (
          <button
            onClick={() => setShowDelayImpact((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all
              ${showDelayImpact
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
          >
            <Zap size={14} />
            Delay Impact ({delayImpacts.length})
          </button>
        )}
      </div>

      {/* Active filter chip */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Filtered:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
          >
            {statusFilter.replace('-', ' ')}
            <X size={10} />
          </button>
        </div>
      )}

      {/* AI Auto-Schedule proposals */}
      {scheduleProposals !== null && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-500/5 dark:bg-purple-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                AI Auto-Schedule proposals
              </h3>
              <span className="text-xs text-purple-500">({scheduleProposals.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {scheduleProposals.length > 1 && onQuickUpdate && (
                <button
                  onClick={handleApplyAllSchedule}
                  disabled={scheduleRunning}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {scheduleRunning ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Apply all
                </button>
              )}
              <button onClick={() => setScheduleProposals(null)}
                className="p-1 rounded text-purple-500 hover:bg-purple-200/30 dark:hover:bg-purple-800/30">
                <X size={14} />
              </button>
            </div>
          </div>
          {scheduleProposals.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">All initiatives already have dates</p>
            </div>
          ) : (
            <div className="divide-y divide-purple-200/50 dark:divide-purple-900/30">
              {scheduleProposals.map((p, idx) => (
                <div key={`${p.initiativeId}-${idx}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Clock size={14} className="text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {p.initiativeName}
                      </span>
                      <span className="text-xs text-purple-500 dark:text-purple-400">
                        {new Date(p.suggestedStart).toLocaleDateString()} → {new Date(p.suggestedEnd).toLocaleDateString()}
                        <span className="ml-1 text-slate-400">({p.durationDays}d)</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.reason}</p>
                  </div>
                  {onQuickUpdate && (
                    <button
                      onClick={() => handleApplySchedule(p, idx)}
                      disabled={applyingScheduleIdx === idx}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
                        hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {applyingScheduleIdx === idx ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conflict detector panel */}
      {showConflicts && (
        <div className={`rounded-xl border overflow-hidden ${
          conflicts.length > 0
            ? 'border-red-200 dark:border-red-900/50 bg-red-500/5 dark:bg-red-500/10'
            : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10'
        }`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            conflicts.length > 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={conflicts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
              <h3 className={`text-sm font-semibold ${conflicts.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {conflicts.length > 0
                  ? `${conflicts.length} owner overlap conflict(s)`
                  : 'No owner overlaps detected'}
              </h3>
            </div>
            <button onClick={() => setShowConflicts(false)} className="p-1 rounded text-slate-500 hover:bg-slate-200/30">
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-red-200/40 dark:divide-red-900/20">
            {conflicts.map((c, idx) => (
              <div key={idx} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => onOpenInitiative(c.initiativeA)} className="font-medium text-slate-900 dark:text-white hover:text-primary-600 transition-colors truncate max-w-[180px]">
                    {c.nameA}
                  </button>
                  <span className="text-xs text-red-500">↔</span>
                  <button onClick={() => onOpenInitiative(c.initiativeB)} className="font-medium text-slate-900 dark:text-white hover:text-primary-600 transition-colors truncate max-w-[180px]">
                    {c.nameB}
                  </button>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-medium">
                    {c.overlapDays}d overlap
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Owner: {c.ownerName} — {c.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Optimizer tips */}
      {showOptimizer && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                AI Timeline Optimization
              </h3>
            </div>
            <button onClick={() => setShowOptimizer(false)} className="p-1 rounded text-emerald-500 hover:bg-emerald-200/30">
              <X size={14} />
            </button>
          </div>
          {optimizationTips.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Timeline is already well-optimized</p>
            </div>
          ) : (
            <div className="divide-y divide-emerald-200/40 dark:divide-emerald-900/20">
              {optimizationTips.map((tip, idx) => (
                <div key={idx} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      tip.type === 'compress'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : tip.type === 'parallelize'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                    }`}>
                      {tip.type}
                    </span>
                    <Sparkles size={10} className="text-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{tip.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delay Impact panel */}
      {showDelayImpact && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Delay Impact Analysis
              </h3>
            </div>
            <button onClick={() => setShowDelayImpact(false)} className="p-1 rounded text-amber-500 hover:bg-amber-200/30">
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
            {delayImpacts.map((d) => (
              <div key={d.delayedId} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <button onClick={() => onOpenInitiative(d.delayedId)}
                    className="font-medium text-sm text-slate-900 dark:text-white hover:text-primary-600 transition-colors">
                    {d.delayedName}
                  </button>
                  <span className="text-xs text-red-500 font-medium">DELAYED</span>
                </div>
                <div className="ml-6 space-y-1">
                  {d.affected.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <ArrowRight size={10} className="text-amber-400" />
                      <button onClick={() => onOpenInitiative(a.id)}
                        className="text-slate-700 dark:text-slate-300 hover:text-primary-600 transition-colors">
                        {a.name}
                      </button>
                      {a.delayDays > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          ~{a.delayDays}d cascade delay
                        </span>
                      )}
                      {a.delayDays === 0 && (
                        <span className="text-slate-400">indirect impact</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gantt-lite bars */}
      {filteredBars.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Initiative timelines
              {statusFilter !== 'all' && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({filteredBars.length} of {bars.length})
                </span>
              )}
            </h3>
            {onQuickUpdate && (
              <span className="text-xs text-slate-400 dark:text-slate-500">Click dates to edit</span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {filteredBars.map((bar) => {
              const isEditing = editingId === bar.initiativeId;
              return (
                <div key={bar.initiativeId} className="space-y-1">
                  <div className="flex items-center gap-4">
                    <div className="w-44 shrink-0">
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                        {bar.initiativeName}
                      </span>
                      {bar.ownerName && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate block">
                          {bar.ownerName}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white" />
                        <span className="text-xs text-slate-400">→</span>
                        <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white" />
                        <button onClick={() => handleSaveDates(bar.initiativeId)} disabled={saving}
                          className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 h-8 relative bg-slate-100 dark:bg-navy-800 rounded-lg overflow-hidden">
                          {bar.startDate && bar.endDate ? (
                            <div
                              className={`absolute top-1 bottom-1 rounded-lg ${BAR_COLORS[bar.status]} min-w-[4px]`}
                              style={{ left: `${getLeftPercent(bar.startDate)}%`, width: `${getWidthPercent(bar.startDate, bar.endDate)}%` }}
                            />
                          ) : (
                            <div className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-2 rounded-lg ${BAR_COLORS['no-dates']}`} />
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(bar.startDate)} – {formatDate(bar.endDate)}
                          </span>
                          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                            bar.status === 'delayed' ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                              : bar.status === 'at-risk' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : bar.status === 'no-dates' ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                              : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                          }`}>
                            {bar.status === 'delayed' ? 'Delayed'
                              : bar.status === 'at-risk' ? 'At risk'
                              : bar.status === 'no-dates' ? 'No dates'
                              : 'On schedule'}
                          </span>
                          {onQuickUpdate && (
                            <button onClick={() => startEditing(bar)}
                              className="p-1 rounded text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors">
                              <Calendar size={14} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {bars.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">No timeline data available.</p>
        </div>
      )}
    </div>
  );
};
