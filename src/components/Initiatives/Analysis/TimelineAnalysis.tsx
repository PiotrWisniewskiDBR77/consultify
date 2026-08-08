/**
 * TimelineAnalysis — timeline management
 * V3-F02c: Date proposals, conflict detection, timeline optimizer,
 *          delay impact analysis, filterable stat cards, Gantt chart
 *
 * Wszystkie cztery pomocniki to ARYTMETYKA DAT liczona lokalnie — żaden nie
 * woła modelu, więc żaden nie nosi etykiety „AI".
 */

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Timer,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { PortfolioInitiative } from '@/types';

import { getMenu3DeterministicButtonClass } from './menu3ActionButtonStyles';
import type {
  AnalysisIssue,
  DependencyLink,
  OrgUser,
  QuickUpdatePayload,
  RegisterAnalysisWorkspacePanel,
  TimelineBar,
} from './types';

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
  onRegisterActions?: (node: React.ReactNode) => void;
  onRegisterWorkspacePanel?: RegisterAnalysisWorkspacePanel;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BAR_COLORS = {
  'on-schedule': 'bg-blue-500',
  delayed: 'bg-danger-500',
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
  onRegisterActions,
  users: _users = [],
  initiatives = [],
  dependencies = [],
  onRegisterWorkspacePanel,
}) => {
  const { t } = useTranslation();

  // Inline date editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Panele pomocnicze (wszystkie liczone lokalnie)
  const [applyingAllSchedule, setApplyingAllSchedule] = useState(false);
  const [scheduleProposals, setScheduleProposals] = useState<ScheduleProposal[] | null>(null);
  const [applyingScheduleIdx, setApplyingScheduleIdx] = useState<number | null>(null);

  const [showConflicts, setShowConflicts] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [showDelayImpact, setShowDelayImpact] = useState(false);

  const closeWorkspacePanels = useCallback(() => {
    setScheduleProposals(null);
    setShowConflicts(false);
    setShowOptimizer(false);
    setShowDelayImpact(false);
  }, []);

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
  const minDate = dates.length
    ? new Date(Math.min(...dates.map((d) => new Date(d).getTime())))
    : new Date();
  const maxDate = dates.length
    ? new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
    : new Date();
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

  /* ---------- Propozycja terminów (DETERMINISTYCZNA, nie AI) ---------- */
  //
  // 2026-07-23 — wycięta atrapa AI. Do dziś: przycisk „AI Auto-Schedule" z ikoną
  // Sparkles i `setTimeout(700)` udającym myślenie. Model nigdy nie był wołany —
  // to jest ARYTMETYKA DAT: kolejność wg priorytetu, start po zakończeniu
  // zależności i po zwolnieniu właściciela, czas trwania wg priorytetu
  // (CRITICAL 60 / HIGH 90 / reszta 120 dni).
  //
  // Świadomie NIE podłączamy tu modelu: liczenie dat to dokładnie ta klasa
  // zadań, w której model jest gorszy od arytmetyki (myli się w dodawaniu dni,
  // gubi kolejność zależności), a wynik ląduje bezpośrednio w `plannedStartDate`
  // / `plannedEndDate` realnych rekordów. Zostaje rachunek, znika podpis „AI".

  const computeAutoSchedule = useCallback(() => {
    {
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
        const depInit = initiatives.find((i) => i.id === d.fromId);
        if (depInit?.plannedEndDate) {
          const cur = depEndDates.get(d.toId);
          if (!cur || new Date(depInit.plannedEndDate) > new Date(cur)) {
            depEndDates.set(d.toId, depInit.plannedEndDate);
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
          reasons.push(
            t(
              'initiatives.analysis.timeline.reasonAfterDep',
              'after dependency completes ({{d}})',
              {
                d: formatDate(depEnd),
              }
            )
          );
        }
        if (ownerEnd && new Date(ownerEnd) > new Date(suggestedStart)) {
          suggestedStart = addDays(ownerEnd, 1);
          reasons.push(
            t('initiatives.analysis.timeline.reasonOwnerFree', 'owner available after {{d}}', {
              d: formatDate(ownerEnd),
            })
          );
        }
        if (new Date(suggestedStart) < new Date(nextSlot)) {
          suggestedStart = nextSlot;
        }

        const durationDays =
          init.priority === 'CRITICAL' ? 60 : init.priority === 'HIGH' ? 90 : 120;
        const suggestedEnd = addDays(suggestedStart, durationDays);

        if (reasons.length === 0)
          reasons.push(
            t(
              'initiatives.analysis.timeline.reasonNoBlockers',
              'no blockers — can start immediately'
            )
          );

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
    }
  }, [dependencies, initiatives, t]);

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
    setApplyingAllSchedule(true);
    let ok = 0;
    for (const p of scheduleProposals) {
      try {
        await onQuickUpdate(p.initiativeId, {
          plannedStartDate: p.suggestedStart,
          plannedEndDate: p.suggestedEnd,
        });
        ok++;
      } catch {
        /* skip */
      }
    }
    toast.success(`Applied dates to ${ok} initiative(s)`);
    setScheduleProposals(null);
    setApplyingAllSchedule(false);
  }, [onQuickUpdate, scheduleProposals]);

  /* ---------- Wykrywanie konfliktów (nakładanie dat, nie AI) ---------- */

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

  /* ---------- Optymalizator harmonogramu (heurystyki dat, nie AI) ---------- */

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
      group.sort(
        (a, b) => new Date(a.plannedStartDate!).getTime() - new Date(b.plannedStartDate!).getTime()
      );
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
              (d) =>
                (d.fromId === j.id && d.toId === i.id) || (d.fromId === i.id && d.toId === j.id)
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

  /* ---------- Wpływ opóźnień (przejście po grafie zależności, nie AI) ---------- */

  const delayImpacts = useMemo((): DelayImpact[] => {
    const delayed = bars.filter((b) => b.status === 'delayed');
    const idToInit = new Map(initiatives.map((i) => [i.id, i]));

    return delayed
      .map((bar) => {
        const init = idToInit.get(bar.initiativeId);
        const affected: DelayImpact['affected'] = [];

        for (const dep of dependencies) {
          if (dep.fromId === bar.initiativeId) {
            const depInit = idToInit.get(dep.toId);
            if (depInit && init?.plannedEndDate && depInit.plannedStartDate) {
              const diff = daysBetween(depInit.plannedStartDate, init.plannedEndDate);
              if (diff > 0) {
                affected.push({ id: dep.toId, name: dep.toName, delayDays: diff });
              }
            }
          }
        }

        for (const dep of dependencies) {
          if (dep.fromId === bar.initiativeId) {
            for (const dep2 of dependencies) {
              if (dep2.fromId === dep.toId) {
                const init2 = idToInit.get(dep2.toId);
                if (init2 && !affected.find((a) => a.id === dep2.toId)) {
                  affected.push({ id: dep2.toId, name: dep2.toName, delayDays: 0 });
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
      })
      .filter((d) => d.affected.length > 0);
  }, [bars, dependencies, initiatives]);

  /* ---------- portfolio end date ---------- */

  const portfolioEndDate = useMemo(() => {
    const endDates = initiatives.map((i) => i.plannedEndDate).filter(Boolean) as string[];
    if (endDates.length === 0) return null;
    return endDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [initiatives]);

  const schedulePanel =
    scheduleProposals !== null ? (
      <div className="m-4 space-y-3">
        {scheduleProposals.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-6 text-center">
            <Check size={24} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All initiatives already have dates
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-c-info dark:border-c-info/50 bg-c-info/5 dark:bg-c-info/10 overflow-hidden">
            <div className="px-4 py-3 bg-c-info/10 dark:bg-c-info/20 border-b border-c-info dark:border-c-info/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-c-info dark:text-c-info" />
                <h3 className="text-sm font-semibold text-c-info dark:text-c-info">
                  {t('initiatives.analysis.timeline.autoSchedulePanelTitle', 'Proposed dates')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {scheduleProposals.length > 1 && onQuickUpdate && (
                  <button
                    onClick={handleApplyAllSchedule}
                    disabled={applyingAllSchedule}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50 transition-colors"
                  >
                    {applyingAllSchedule ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Apply all
                  </button>
                )}
                <button
                  onClick={closeWorkspacePanels}
                  className="p-1 rounded text-c-info hover:bg-c-info/30 dark:hover:bg-c-info/30"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="divide-y divide-c-info/20 dark:divide-c-info/15">
              {scheduleProposals.map((p, idx) => (
                <div
                  key={`${p.initiativeId}-${idx}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <Clock size={14} className="text-c-info shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {p.initiativeName}
                      </span>
                      <span className="text-xs text-c-info dark:text-c-info">
                        {new Date(p.suggestedStart).toLocaleDateString()} {'->'}{' '}
                        {new Date(p.suggestedEnd).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.reason}</p>
                  </div>
                  {onQuickUpdate && (
                    <button
                      onClick={() => handleApplySchedule(p, idx)}
                      disabled={applyingScheduleIdx === idx}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {applyingScheduleIdx === idx ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : null;

  const conflictsPanel = showConflicts ? (
    <div className="m-4 rounded-xl border border-danger-200 dark:border-danger-900/50 bg-danger-500/5 dark:bg-danger-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-danger-50 dark:bg-danger-900/20 border-b border-danger-200 dark:border-danger-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-danger-600 dark:text-danger-400" />
          <h3 className="text-sm font-semibold text-danger-700 dark:text-danger-300">
            Conflicts ({conflicts.length})
          </h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-danger-500 hover:bg-danger-200/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="divide-y divide-danger-200/40 dark:divide-danger-900/20">
        {conflicts.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
            No owner overlaps detected
          </div>
        ) : (
          conflicts.map((c, idx) => (
            <div key={idx} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => onOpenInitiative(c.initiativeA)}
                  className="font-medium text-slate-900 dark:text-white hover:text-c-info transition-colors truncate max-w-[160px]"
                >
                  {c.nameA}
                </button>
                <span className="text-xs text-danger-500">↔</span>
                <button
                  onClick={() => onOpenInitiative(c.initiativeB)}
                  className="font-medium text-slate-900 dark:text-white hover:text-c-info transition-colors truncate max-w-[160px]"
                >
                  {c.nameB}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Owner: {c.ownerName} — {c.suggestion}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  const optimizerPanel = showOptimizer ? (
    <div className="m-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {t('initiatives.analysis.timeline.optimizerPanelTitle', 'Timeline optimization')}
          </h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-emerald-500 hover:bg-emerald-200/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="divide-y divide-emerald-200/40 dark:divide-emerald-900/20">
        {optimizationTips.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Timeline is already well-optimized
          </div>
        ) : (
          optimizationTips.map((tip, idx) => (
            <div key={idx} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {tip.type}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">{tip.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  const delayImpactPanel = showDelayImpact ? (
    <div className="m-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Delay Impact</h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-amber-500 hover:bg-amber-200/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
        {delayImpacts.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
            No cascading delay impact detected
          </div>
        ) : (
          delayImpacts.map((d) => (
            <div key={d.delayedId} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-danger-500" />
                <button
                  onClick={() => onOpenInitiative(d.delayedId)}
                  className="font-medium text-sm text-slate-900 dark:text-white hover:text-c-info transition-colors"
                >
                  {d.delayedName}
                </button>
              </div>
              <div className="ml-6 space-y-1">
                {d.affected.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs">
                    <ArrowRight size={10} className="text-amber-400" />
                    <button
                      onClick={() => onOpenInitiative(a.id)}
                      className="text-slate-700 dark:text-slate-300 hover:text-c-info transition-colors"
                    >
                      {a.name}
                    </button>
                    {a.delayDays > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        ~{a.delayDays}d cascade delay
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  /* ---------- render ---------- */

  useEffect(() => {
    if (!onRegisterActions) return;
    const toggleAutoSchedulePanel = () => {
      if (scheduleProposals !== null) {
        closeWorkspacePanels();
        return;
      }
      setShowConflicts(false);
      setShowOptimizer(false);
      setShowDelayImpact(false);
      computeAutoSchedule();
    };
    onRegisterActions(
      <>
        {onQuickUpdate && (
          <button
            onClick={toggleAutoSchedulePanel}
            disabled={applyingAllSchedule}
            className={getMenu3DeterministicButtonClass(scheduleProposals !== null)}
          >
            {applyingAllSchedule ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CalendarClock size={12} />
            )}
            {t('initiatives.analysis.timeline.autoScheduleAction', 'Propose dates')}
          </button>
        )}
        <button
          onClick={() => {
            setScheduleProposals(null);
            setShowOptimizer(false);
            setShowDelayImpact(false);
            setShowConflicts((v) => !v);
          }}
          className={getMenu3DeterministicButtonClass(showConflicts)}
        >
          <AlertTriangle size={12} />
          {t('initiatives.analysis.timeline.conflictsAction', 'Conflicts')} ({conflicts.length})
        </button>
        <button
          onClick={() => {
            setScheduleProposals(null);
            setShowConflicts(false);
            setShowDelayImpact(false);
            setShowOptimizer((v) => !v);
          }}
          className={getMenu3DeterministicButtonClass(showOptimizer)}
        >
          <TrendingUp size={12} />
          {t('initiatives.analysis.timeline.optimizerAction', 'Optimizer')}
        </button>
        <button
          onClick={() => {
            setScheduleProposals(null);
            setShowConflicts(false);
            setShowOptimizer(false);
            setShowDelayImpact((v) => !v);
          }}
          className={getMenu3DeterministicButtonClass(showDelayImpact)}
        >
          <Zap size={12} />
          {t('initiatives.analysis.timeline.delayImpactAction', 'Delay Impact')}
        </button>
      </>
    );
  }, [
    onRegisterActions,
    onQuickUpdate,
    computeAutoSchedule,
    scheduleProposals,
    applyingAllSchedule,
    showConflicts,
    conflicts.length,
    showOptimizer,
    showDelayImpact,
    closeWorkspacePanels,
    t,
  ]);

  useEffect(() => {
    if (!onRegisterWorkspacePanel) return;
    if (schedulePanel) {
      onRegisterWorkspacePanel({
        title: t('initiatives.analysis.timeline.autoScheduleAction', 'Propose dates'),
        subtitle: t(
          'initiatives.analysis.timeline.autoScheduleSubtitle',
          'Dates computed from priority, dependencies and owner availability — review before applying.'
        ),
        icon: <CalendarClock size={16} />,
        content: schedulePanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (conflictsPanel) {
      onRegisterWorkspacePanel({
        title: 'Conflicts',
        subtitle: 'Review owner overlap conflicts and rescheduling suggestions.',
        icon: <AlertTriangle size={16} />,
        content: conflictsPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (optimizerPanel) {
      onRegisterWorkspacePanel({
        title: t('initiatives.analysis.timeline.optimizerAction', 'Optimizer'),
        subtitle: 'Compress gaps, parallelize work, and improve the portfolio timeline.',
        icon: <TrendingUp size={16} />,
        content: optimizerPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (delayImpactPanel) {
      onRegisterWorkspacePanel({
        title: 'Delay Impact',
        subtitle: 'See which initiatives are affected by delayed work.',
        icon: <Zap size={16} />,
        content: delayImpactPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    onRegisterWorkspacePanel(null);
    return undefined;
  }, [schedulePanel, conflictsPanel, optimizerPanel, delayImpactPanel, onRegisterWorkspacePanel]);

  return (
    <div className="space-y-6">
      {/* Stat cards — clickable filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 grid grid-cols-4 gap-3">
          {(
            [
              {
                key: 'on-schedule' as StatusFilter,
                label: 'On schedule',
                count: counts.onSchedule,
                color: 'blue',
                border: 'border-blue-200 dark:border-blue-900/50',
                bg: 'bg-blue-500/5 dark:bg-blue-500/10',
              },
              {
                key: 'at-risk' as StatusFilter,
                label: 'At risk',
                count: counts.atRisk,
                color: 'amber',
                border: 'border-amber-200 dark:border-amber-900/50',
                bg: 'bg-amber-500/5 dark:bg-amber-500/10',
              },
              {
                key: 'delayed' as StatusFilter,
                label: 'Delayed',
                count: counts.delayed,
                color: 'red',
                border: 'border-danger-200 dark:border-danger-900/50',
                bg: 'bg-danger-500/5 dark:bg-danger-500/10',
              },
              {
                key: 'no-dates' as StatusFilter,
                label: 'No dates',
                count: counts.noDates,
                color: 'slate',
                border: 'border-slate-200 dark:border-navy-700',
                bg: 'bg-white dark:bg-navy-900',
              },
            ] as const
          ).map((card) => (
            <button
              key={card.key}
              onClick={() => setStatusFilter((f) => (f === card.key ? 'all' : card.key))}
              className={`rounded-xl border p-3 text-left transition-all
                ${
                  statusFilter === card.key
                    ? `${card.border} ${card.bg} ring-2 ring-${card.color}-400/40 ring-offset-1 ring-offset-white dark:ring-offset-navy-950`
                    : `${card.border} ${card.bg} hover:shadow-sm`
                }`}
            >
              <div
                className={`text-xl font-semibold text-${card.color}-600 dark:text-${card.color}-400`}
              >
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
          Portfolio estimated completion:{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {new Date(portfolioEndDate).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Active filter chip */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Filtered:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
          >
            {statusFilter.replace('-', ' ')}
            <X size={10} />
          </button>
        </div>
      )}

      {/* Proposed dates */}
      {!onRegisterWorkspacePanel && scheduleProposals !== null && (
        <div className="rounded-xl border border-c-info dark:border-c-info/50 bg-c-info/5 dark:bg-c-info/10 overflow-hidden">
          <div className="px-4 py-3 bg-c-info/10 dark:bg-c-info/20 border-b border-c-info dark:border-c-info/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-c-info dark:text-c-info" />
              <h3 className="text-sm font-semibold text-c-info dark:text-c-info">
                {t('initiatives.analysis.timeline.autoSchedulePanelTitle', 'Proposed dates')}
              </h3>
              <span className="text-xs text-c-info">({scheduleProposals.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {scheduleProposals.length > 1 && onQuickUpdate && (
                <button
                  onClick={handleApplyAllSchedule}
                  disabled={applyingAllSchedule}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50 transition-colors"
                >
                  {applyingAllSchedule ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Apply all
                </button>
              )}
              <button
                onClick={() => setScheduleProposals(null)}
                className="p-1 rounded text-c-info hover:bg-c-info/30 dark:hover:bg-c-info/30"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {scheduleProposals.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                All initiatives already have dates
              </p>
            </div>
          ) : (
            <div className="divide-y divide-c-info/20 dark:divide-c-info/15">
              {scheduleProposals.map((p, idx) => (
                <div
                  key={`${p.initiativeId}-${idx}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <Clock size={14} className="text-c-info shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {p.initiativeName}
                      </span>
                      <span className="text-xs text-c-info dark:text-c-info">
                        {new Date(p.suggestedStart).toLocaleDateString()} →{' '}
                        {new Date(p.suggestedEnd).toLocaleDateString()}
                        <span className="ml-1 text-slate-600">({p.durationDays}d)</span>
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
                      {applyingScheduleIdx === idx ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
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
      {!onRegisterWorkspacePanel && showConflicts && (
        <div
          className={`rounded-xl border overflow-hidden ${
            conflicts.length > 0
              ? 'border-danger-200 dark:border-danger-900/50 bg-danger-500/5 dark:bg-danger-500/10'
              : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10'
          }`}
        >
          <div
            className={`px-4 py-3 border-b flex items-center justify-between ${
              conflicts.length > 0
                ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-900/50'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={16}
                className={
                  conflicts.length > 0
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }
              />
              <h3
                className={`text-sm font-semibold ${conflicts.length > 0 ? 'text-danger-700 dark:text-danger-300' : 'text-emerald-700 dark:text-emerald-300'}`}
              >
                {conflicts.length > 0
                  ? `${conflicts.length} owner overlap conflict(s)`
                  : 'No owner overlaps detected'}
              </h3>
            </div>
            <button
              onClick={() => setShowConflicts(false)}
              className="p-1 rounded text-slate-500 hover:bg-slate-200/30"
            >
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-danger-200/40 dark:divide-danger-900/20">
            {conflicts.map((c, idx) => (
              <div key={idx} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => onOpenInitiative(c.initiativeA)}
                    className="font-medium text-slate-900 dark:text-white hover:text-c-info transition-colors truncate max-w-[180px]"
                  >
                    {c.nameA}
                  </button>
                  <span className="text-xs text-danger-500">↔</span>
                  <button
                    onClick={() => onOpenInitiative(c.initiativeB)}
                    className="font-medium text-slate-900 dark:text-white hover:text-c-info transition-colors truncate max-w-[180px]"
                  >
                    {c.nameB}
                  </button>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-danger-500/15 text-danger-600 dark:text-danger-400 font-medium">
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

      {/* Optimizer tips */}
      {!onRegisterWorkspacePanel && showOptimizer && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {t('initiatives.analysis.timeline.optimizerPanelTitle', 'Timeline optimization')}
              </h3>
            </div>
            <button
              onClick={() => setShowOptimizer(false)}
              className="p-1 rounded text-emerald-500 hover:bg-emerald-200/30"
            >
              <X size={14} />
            </button>
          </div>
          {optimizationTips.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Timeline is already well-optimized
              </p>
            </div>
          ) : (
            <div className="divide-y divide-emerald-200/40 dark:divide-emerald-900/20">
              {optimizationTips.map((tip, idx) => (
                <div key={idx} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        tip.type === 'compress'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : tip.type === 'parallelize'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-c-info/15 text-c-info dark:text-c-info'
                      }`}
                    >
                      {tip.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{tip.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delay Impact panel */}
      {!onRegisterWorkspacePanel && showDelayImpact && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Delay Impact Analysis
              </h3>
            </div>
            <button
              onClick={() => setShowDelayImpact(false)}
              className="p-1 rounded text-amber-500 hover:bg-amber-200/30"
            >
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
            {delayImpacts.map((d) => (
              <div key={d.delayedId} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-danger-500" />
                  <button
                    onClick={() => onOpenInitiative(d.delayedId)}
                    className="font-medium text-sm text-slate-900 dark:text-white hover:text-c-info transition-colors"
                  >
                    {d.delayedName}
                  </button>
                  <span className="text-xs text-danger-500 font-medium">DELAYED</span>
                </div>
                <div className="ml-6 space-y-1">
                  {d.affected.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <ArrowRight size={10} className="text-amber-400" />
                      <button
                        onClick={() => onOpenInitiative(a.id)}
                        className="text-slate-700 dark:text-slate-300 hover:text-c-info transition-colors"
                      >
                        {a.name}
                      </button>
                      {a.delayDays > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          ~{a.delayDays}d cascade delay
                        </span>
                      )}
                      {a.delayDays === 0 && <span className="text-slate-600">indirect impact</span>}
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
                <span className="ml-2 text-xs font-normal text-slate-600">
                  ({filteredBars.length} of {bars.length})
                </span>
              )}
            </h3>
            {onQuickUpdate && (
              <span className="text-xs text-slate-600 dark:text-slate-500">
                Click dates to edit
              </span>
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
                        <span className="text-xs text-slate-600 dark:text-slate-500 truncate block">
                          {bar.ownerName}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="date"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          aria-label={t(
                            'initiatives.analysis.timeline.startDateFor',
                            'Start date for {{name}}',
                            {
                              name: bar.initiativeName,
                            }
                          )}
                          className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                        />
                        <span className="text-xs text-slate-600" aria-hidden="true">
                          →
                        </span>
                        <input
                          type="date"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          aria-label={t(
                            'initiatives.analysis.timeline.endDateFor',
                            'End date for {{name}}',
                            {
                              name: bar.initiativeName,
                            }
                          )}
                          className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveDates(bar.initiativeId)}
                          disabled={saving}
                          aria-label={t(
                            'initiatives.analysis.timeline.saveDatesFor',
                            'Save dates for {{name}}',
                            {
                              name: bar.initiativeName,
                            }
                          )}
                          className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          <Check size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label={t(
                            'initiatives.analysis.timeline.cancelEditingDatesFor',
                            'Cancel editing dates for {{name}}',
                            { name: bar.initiativeName }
                          )}
                          className="p-1 rounded text-slate-600 hover:bg-slate-200 dark:hover:bg-navy-700"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 h-8 relative bg-slate-100 dark:bg-navy-800 rounded-lg overflow-hidden">
                          {bar.startDate && bar.endDate ? (
                            <div
                              className={`absolute top-1 bottom-1 rounded-lg ${BAR_COLORS[bar.status]} min-w-[4px]`}
                              style={{
                                left: `${getLeftPercent(bar.startDate)}%`,
                                width: `${getWidthPercent(bar.startDate, bar.endDate)}%`,
                              }}
                            />
                          ) : (
                            <div
                              className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-2 rounded-lg ${BAR_COLORS['no-dates']}`}
                            />
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(bar.startDate)} – {formatDate(bar.endDate)}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                              bar.status === 'delayed'
                                ? 'bg-danger-500/20 text-danger-700 dark:text-danger-300'
                                : bar.status === 'at-risk'
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : bar.status === 'no-dates'
                                    ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                                    : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {bar.status === 'delayed'
                              ? t('initiatives.analysis.timeline.statusDelayed', 'Delayed')
                              : bar.status === 'at-risk'
                                ? t('initiatives.analysis.timeline.statusAtRisk', 'At risk')
                                : bar.status === 'no-dates'
                                  ? t('initiatives.analysis.timeline.statusNoDates', 'No dates')
                                  : t(
                                      'initiatives.analysis.timeline.statusOnSchedule',
                                      'On schedule'
                                    )}
                          </span>
                          {onQuickUpdate && (
                            <button
                              type="button"
                              onClick={() => startEditing(bar)}
                              aria-label={t(
                                'initiatives.analysis.timeline.editDatesFor',
                                'Edit dates for {{name}}',
                                {
                                  name: bar.initiativeName,
                                }
                              )}
                              className="p-1 rounded text-slate-600 hover:text-c-info hover:bg-c-info/10 transition-colors"
                            >
                              <Calendar size={14} aria-hidden="true" />
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
