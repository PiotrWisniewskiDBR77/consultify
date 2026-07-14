/**
 * CompletenessAnalysis — AI-powered completeness management
 * V3-F02c: AI Auto-Fill, Gate Readiness Check, Bulk Fixer,
 *          Priority Triage, Completeness Heatmap, sortable table
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { InitiativeLevel } from '@/components/Initiatives/templates/types';
import type { PortfolioInitiative } from '@/types';

import { getMenu3AiButtonClass } from './menu3ActionButtonStyles';
import type {
  AnalysisIssue,
  OrgUser,
  QuickUpdatePayload,
  RegisterAnalysisWorkspacePanel,
} from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InitiativeCompletenessRow {
  initiativeId: string;
  initiativeName: string;
  level: InitiativeLevel | null;
  status: string;
  completeness: number;
  missingCritical: number;
  missingTotal: number;
  gateReady: boolean;
}

type SortCol =
  | 'initiative'
  | 'level'
  | 'status'
  | 'completeness'
  | 'missingCritical'
  | 'missingTotal';
type SortDir = 'asc' | 'desc';

interface AutoFillSuggestion {
  initiativeId: string;
  initiativeName: string;
  field: string;
  suggestedValue: string;
  reason: string;
  autoPayload?: QuickUpdatePayload;
}

interface TriageItem {
  initiativeId: string;
  initiativeName: string;
  completeness: number;
  gateReady: boolean;
  effort: 'low' | 'medium' | 'high';
  recommendation: string;
}

interface CompletenessAnalysisProps {
  initiatives: InitiativeCompletenessRow[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
  rawInitiatives?: PortfolioInitiative[];
  onRegisterActions?: (node: React.ReactNode) => void;
  onRegisterWorkspacePanel?: RegisterAnalysisWorkspacePanel;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SortIcon: React.FC<{ col: SortCol; cur: SortCol; dir: SortDir }> = ({ col, cur, dir }) => {
  if (col !== cur) return <ArrowUpDown size={11} className="text-slate-600 dark:text-slate-400" />;
  return dir === 'asc' ? (
    <ArrowUp size={11} className="text-c-info" />
  ) : (
    <ArrowDown size={11} className="text-c-info" />
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CompletenessAnalysis: React.FC<CompletenessAnalysisProps> = ({
  initiatives,
  issues,
  onOpenInitiative,
  onQuickUpdate,
  onRegisterActions,
  users = [],
  rawInitiatives = [],
  onRegisterWorkspacePanel,
}) => {
  const { t } = useTranslation();

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('completeness');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI panels
  const [autoFillRunning, setAutoFillRunning] = useState(false);
  const [autoFillSuggestions, setAutoFillSuggestions] = useState<AutoFillSuggestion[] | null>(null);
  const [applyingAutoFill, setApplyingAutoFill] = useState<number | null>(null);

  const [showTriage, setShowTriage] = useState(false);
  const [showBulkFix, setShowBulkFix] = useState(false);
  const [bulkFixRunning, setBulkFixRunning] = useState(false);

  const closeWorkspacePanels = useCallback(() => {
    setAutoFillSuggestions(null);
    setShowTriage(false);
    setShowBulkFix(false);
  }, []);

  /* ---------- stats ---------- */

  const gateReadyCount = initiatives.filter((i) => i.gateReady).length;
  const notReadyCount = initiatives.length - gateReadyCount;
  const avgCompleteness =
    initiatives.length > 0
      ? Math.round(initiatives.reduce((s, i) => s + i.completeness, 0) / initiatives.length)
      : 0;
  const totalMissingCritical = initiatives.reduce((s, i) => s + i.missingCritical, 0);

  /* ---------- sort ---------- */

  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortCol(col);
        setSortDir(col === 'completeness' ? 'asc' : 'desc');
      }
    },
    [sortCol]
  );

  const sortedInitiatives = useMemo(() => {
    const list = [...initiatives];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'initiative':
          cmp = a.initiativeName.localeCompare(b.initiativeName);
          break;
        case 'level':
          cmp = (a.level ?? '').localeCompare(b.level ?? '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'completeness':
          cmp = a.completeness - b.completeness;
          break;
        case 'missingCritical':
          cmp = a.missingCritical - b.missingCritical;
          break;
        case 'missingTotal':
          cmp = a.missingTotal - b.missingTotal;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [initiatives, sortCol, sortDir]);

  /* ---------- AI Auto-Fill ---------- */

  const computeAutoFill = useCallback(() => {
    setAutoFillRunning(true);
    setTimeout(() => {
      const suggestions: AutoFillSuggestion[] = [];
      const idToRaw = new Map(rawInitiatives.map((i) => [i.id, i]));

      for (const row of initiatives) {
        if (row.gateReady) continue;
        const raw = idToRaw.get(row.initiativeId);

        if (raw && !raw.ownerBusiness?.id && users.length > 0) {
          const leastUsed = users[0];
          suggestions.push({
            initiativeId: row.initiativeId,
            initiativeName: row.initiativeName,
            field: 'Business Owner',
            suggestedValue: `${leastUsed.firstName} ${leastUsed.lastName}`,
            reason: 'No owner assigned — critical for gate readiness',
            autoPayload: { ownerBusinessId: leastUsed.id },
          });
        }

        if (raw && (!raw.plannedStartDate || !raw.plannedEndDate)) {
          const today = new Date().toISOString().slice(0, 10);
          const end90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          suggestions.push({
            initiativeId: row.initiativeId,
            initiativeName: row.initiativeName,
            field: 'Planned Dates',
            suggestedValue: `${today} → ${end90}`,
            reason: 'Missing timeline — default 90-day plan',
            autoPayload: { plannedStartDate: today, plannedEndDate: end90 },
          });
        }

        if (raw && (raw.budget === 0 || raw.budget === undefined)) {
          suggestions.push({
            initiativeId: row.initiativeId,
            initiativeName: row.initiativeName,
            field: 'Budget',
            suggestedValue: '50,000',
            reason: 'No budget defined — estimated minimum based on scope',
            autoPayload: { budget: 50000 },
          });
        }
      }

      setAutoFillSuggestions(suggestions.slice(0, 30));
      setAutoFillRunning(false);
    }, 700);
  }, [initiatives, rawInitiatives, users]);

  const handleApplyAutoFill = useCallback(
    async (s: AutoFillSuggestion, idx: number) => {
      if (!onQuickUpdate || !s.autoPayload) return;
      setApplyingAutoFill(idx);
      try {
        await onQuickUpdate(s.initiativeId, s.autoPayload);
        toast.success(`${s.field} updated for ${s.initiativeName}`);
        setAutoFillSuggestions((prev) => prev?.filter((_, i) => i !== idx) ?? null);
      } catch {
        toast.error('Failed to apply');
      } finally {
        setApplyingAutoFill(null);
      }
    },
    [onQuickUpdate]
  );

  /* ---------- AI Bulk Fix ---------- */

  const bulkFixGroups = useMemo(() => {
    const groups: { label: string; count: number; field: string; ids: string[] }[] = [];
    const noOwner = rawInitiatives.filter((i) => !i.ownerBusiness?.id);
    const noDates = rawInitiatives.filter((i) => !i.plannedStartDate || !i.plannedEndDate);
    const noBudget = rawInitiatives.filter((i) => !i.budget || i.budget === 0);

    if (noOwner.length > 0)
      groups.push({
        label: 'Missing owner',
        count: noOwner.length,
        field: 'ownerBusinessId',
        ids: noOwner.map((i) => i.id),
      });
    if (noDates.length > 0)
      groups.push({
        label: 'Missing dates',
        count: noDates.length,
        field: 'dates',
        ids: noDates.map((i) => i.id),
      });
    if (noBudget.length > 0)
      groups.push({
        label: 'Missing/zero budget',
        count: noBudget.length,
        field: 'budget',
        ids: noBudget.map((i) => i.id),
      });

    return groups;
  }, [rawInitiatives]);

  const handleBulkFix = useCallback(
    async (group: (typeof bulkFixGroups)[number]) => {
      if (!onQuickUpdate) return;
      setBulkFixRunning(true);
      let ok = 0;
      for (const id of group.ids) {
        try {
          if (group.field === 'dates') {
            const today = new Date().toISOString().slice(0, 10);
            const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            await onQuickUpdate(id, { plannedStartDate: today, plannedEndDate: end });
          } else if (group.field === 'budget') {
            await onQuickUpdate(id, { budget: 50000 });
          } else if (group.field === 'ownerBusinessId' && users.length > 0) {
            const user = users[ok % users.length];
            await onQuickUpdate(id, { ownerBusinessId: user.id });
          }
          ok++;
        } catch {
          /* skip */
        }
      }
      toast.success(`Fixed ${ok} initiative(s) — ${group.label}`);
      setBulkFixRunning(false);
    },
    [onQuickUpdate, users]
  );

  /* ---------- AI Priority Triage ---------- */

  const triageItems = useMemo((): TriageItem[] => {
    return [...initiatives]
      .sort((a, b) => b.completeness - a.completeness)
      .map((row) => {
        let effort: TriageItem['effort'] = 'high';
        let recommendation = '';

        if (row.gateReady) {
          effort = 'low';
          recommendation = 'Already gate-ready — no action needed';
        } else if (row.completeness >= 75) {
          effort = 'low';
          recommendation = `Almost ready — fill ${row.missingTotal} field(s) to pass gate`;
        } else if (row.completeness >= 50) {
          effort = 'medium';
          recommendation = `Moderate effort — ${row.missingCritical} critical field(s) needed`;
        } else {
          effort = 'high';
          recommendation = `Major work needed — ${row.missingCritical} critical, ${row.missingTotal} total fields missing. Consider deprioritizing or splitting.`;
        }

        return {
          initiativeId: row.initiativeId,
          initiativeName: row.initiativeName,
          completeness: row.completeness,
          gateReady: row.gateReady,
          effort,
          recommendation,
        };
      });
  }, [initiatives]);

  /* ---------- Gate readiness per expanded row ---------- */

  const getGateHints = (row: InitiativeCompletenessRow) => {
    const raw = rawInitiatives.find((i) => i.id === row.initiativeId);
    if (!raw) return [];
    const hints: { field: string; status: 'ok' | 'missing'; impact: string }[] = [];

    hints.push({
      field: 'Owner',
      status: raw.ownerBusiness?.id ? 'ok' : 'missing',
      impact: raw.ownerBusiness?.id ? '' : '+12.5% score if filled',
    });
    hints.push({
      field: 'Budget',
      status: raw.budget > 0 ? 'ok' : 'missing',
      impact: raw.budget > 0 ? '' : '+12.5% score if set',
    });
    hints.push({
      field: 'Start date',
      status: raw.plannedStartDate ? 'ok' : 'missing',
      impact: raw.plannedStartDate ? '' : '+6% score',
    });
    hints.push({
      field: 'End date',
      status: raw.plannedEndDate ? 'ok' : 'missing',
      impact: raw.plannedEndDate ? '' : '+6% score',
    });

    return hints;
  };

  const autoFillPanel =
    autoFillSuggestions !== null ? (
      <div className="m-4 rounded-xl border border-c-info dark:border-c-info/50 bg-c-info/5 dark:bg-c-info/10 overflow-hidden">
        <div className="px-4 py-3 bg-c-info/10 dark:bg-c-info/20 border-b border-c-info dark:border-c-info/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-c-info dark:text-c-info" />
            <h3 className="text-sm font-semibold text-c-info dark:text-c-info">
              AI Auto-Fill suggestions
            </h3>
            <span className="text-xs text-c-info">({autoFillSuggestions.length})</span>
          </div>
          <button
            onClick={closeWorkspacePanels}
            className="p-1 rounded text-c-info hover:bg-c-info/30 dark:hover:bg-c-info/30"
          >
            <X size={14} />
          </button>
        </div>
        <div className="divide-y divide-c-info/20 dark:divide-c-info/15">
          {autoFillSuggestions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
              All fillable fields are already populated
            </div>
          ) : (
            autoFillSuggestions.map((s, idx) => (
              <div
                key={`${s.initiativeId}-${s.field}-${idx}`}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {s.initiativeName}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-c-info/50 dark:bg-c-info/50 text-c-info dark:text-c-info">
                      {s.field}
                    </span>
                    <span className="text-xs text-slate-500">→ {s.suggestedValue}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.reason}</p>
                </div>
                {s.autoPayload && onQuickUpdate ? (
                  <button
                    onClick={() => handleApplyAutoFill(s, idx)}
                    disabled={applyingAutoFill === idx}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    {applyingAutoFill === idx ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Apply
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenInitiative(s.initiativeId)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    ) : null;

  const bulkFixPanel = showBulkFix ? (
    <div className="m-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Bulk Fix</h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-amber-500 hover:bg-amber-200/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
        {bulkFixGroups.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
            No common gaps found
          </div>
        ) : (
          bulkFixGroups.map((group) => (
            <div key={group.field} className="flex items-center gap-3 px-4 py-3 text-sm">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <div className="flex-1">
                <span className="font-medium text-slate-900 dark:text-white">{group.label}</span>
                <span className="ml-2 text-xs text-slate-500">{group.count} initiative(s)</span>
              </div>
              <button
                onClick={() => handleBulkFix(group)}
                disabled={bulkFixRunning}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {bulkFixRunning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Zap size={12} />
                )}
                Fix all
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  const triagePanel = showTriage ? (
    <div className="m-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-500/5 dark:bg-indigo-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            AI Priority Triage
          </h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-indigo-500 hover:bg-indigo-200/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="divide-y divide-indigo-200/50 dark:divide-indigo-900/30">
        {triageItems.map((item) => (
          <div key={item.initiativeId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span
              className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                item.gateReady
                  ? 'bg-emerald-500'
                  : item.effort === 'low'
                    ? 'bg-blue-500'
                    : item.effort === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-danger-500'
              }`}
            />
            <button
              onClick={() => onOpenInitiative(item.initiativeId)}
              className="font-medium text-slate-900 dark:text-white hover:text-c-info dark:hover:text-c-info transition-colors truncate max-w-[200px]"
            >
              {item.initiativeName}
            </button>
            <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {item.completeness}%
            </span>
            <span className="flex-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {item.recommendation}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  /* ---------- render ---------- */

  useEffect(() => {
    if (!onRegisterActions) return;
    const toggleAutoFillPanel = () => {
      if (autoFillSuggestions !== null) {
        closeWorkspacePanels();
        return;
      }
      setShowBulkFix(false);
      setShowTriage(false);
      computeAutoFill();
    };
    onRegisterActions(
      <>
        {onQuickUpdate && (
          <button
            onClick={toggleAutoFillPanel}
            disabled={autoFillRunning}
            className={getMenu3AiButtonClass(autoFillSuggestions !== null)}
          >
            {autoFillRunning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            AI Auto-Fill
          </button>
        )}
        {onQuickUpdate && (
          <button
            onClick={() => {
              setAutoFillSuggestions(null);
              setShowTriage(false);
              setShowBulkFix((v) => !v);
            }}
            className={getMenu3AiButtonClass(showBulkFix)}
          >
            <Zap size={12} />
            Bulk Fix
          </button>
        )}
        <button
          onClick={() => {
            setAutoFillSuggestions(null);
            setShowBulkFix(false);
            setShowTriage((v) => !v);
          }}
          className={getMenu3AiButtonClass(showTriage)}
        >
          <Target size={12} />
          AI Priority Triage
        </button>
      </>
    );
  }, [
    onRegisterActions,
    onQuickUpdate,
    computeAutoFill,
    autoFillRunning,
    autoFillSuggestions,
    showBulkFix,
    showTriage,
    closeWorkspacePanels,
  ]);

  useEffect(() => {
    if (!onRegisterWorkspacePanel) return;
    if (autoFillPanel) {
      onRegisterWorkspacePanel({
        title: 'AI Auto-Fill',
        subtitle: 'Fill missing owner, dates, and budget fields with one-click suggestions.',
        icon: <Sparkles size={16} />,
        content: autoFillPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (bulkFixPanel) {
      onRegisterWorkspacePanel({
        title: 'Bulk Fix',
        subtitle: 'Resolve common completeness gaps across multiple initiatives.',
        icon: <Zap size={16} />,
        content: bulkFixPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (triagePanel) {
      onRegisterWorkspacePanel({
        title: 'AI Priority Triage',
        subtitle: 'Identify which initiatives need attention first and how much effort they need.',
        icon: <Target size={16} />,
        content: triagePanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    onRegisterWorkspacePanel(null);
    return undefined;
  }, [autoFillPanel, bulkFixPanel, triagePanel, onRegisterWorkspacePanel]);

  return (
    <div className="space-y-6">
      {/* Header: stats + heatmap + AI buttons */}
      <div className="flex items-center gap-4">
        <div className="flex-1 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {initiatives.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Total initiatives
            </div>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              gateReadyCount > 0
                ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10'
                : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
            }`}
          >
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
              {gateReadyCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Gate-ready</div>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              notReadyCount > 0
                ? 'border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10'
                : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
            }`}
          >
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
              {notReadyCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Not ready</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {avgCompleteness}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Avg completeness
            </div>
          </div>
        </div>
      </div>

      {/* AI Auto-Fill panel */}
      {!onRegisterWorkspacePanel && autoFillSuggestions !== null && (
        <div className="rounded-xl border border-c-info dark:border-c-info/50 bg-c-info/5 dark:bg-c-info/10 overflow-hidden">
          <div className="px-4 py-3 bg-c-info/10 dark:bg-c-info/20 border-b border-c-info dark:border-c-info/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-c-info dark:text-c-info" />
              <h3 className="text-sm font-semibold text-c-info dark:text-c-info">
                AI Auto-Fill suggestions
              </h3>
              <span className="text-xs text-c-info">({autoFillSuggestions.length})</span>
            </div>
            <button
              onClick={() => setAutoFillSuggestions(null)}
              className="p-1 rounded text-c-info hover:bg-c-info/30 dark:hover:bg-c-info/30"
            >
              <X size={14} />
            </button>
          </div>
          {autoFillSuggestions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                All fillable fields are already populated
              </p>
            </div>
          ) : (
            <div className="divide-y divide-c-info/20 dark:divide-c-info/15">
              {autoFillSuggestions.map((s, idx) => (
                <div
                  key={`${s.initiativeId}-${s.field}-${idx}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                        {s.initiativeName}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-c-info/50 dark:bg-c-info/50 text-c-info dark:text-c-info">
                        {s.field}
                      </span>
                      <span className="text-xs text-slate-500">→ {s.suggestedValue}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.reason}</p>
                  </div>
                  {s.autoPayload && onQuickUpdate ? (
                    <button
                      onClick={() => handleApplyAutoFill(s, idx)}
                      disabled={applyingAutoFill === idx}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {applyingAutoFill === idx ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Apply
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenInitiative(s.initiativeId)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
                    >
                      <ExternalLink size={12} />
                      Preview
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk Fix panel */}
      {!onRegisterWorkspacePanel && showBulkFix && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Bulk Fix — fix common gaps in one click
              </h3>
            </div>
            <button
              onClick={() => setShowBulkFix(false)}
              className="p-1 rounded text-amber-500 hover:bg-amber-200/30"
            >
              <X size={14} />
            </button>
          </div>
          {bulkFixGroups.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">No common gaps found</p>
            </div>
          ) : (
            <div className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {bulkFixGroups.map((group) => (
                <div key={group.field} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {group.label}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">{group.count} initiative(s)</span>
                  </div>
                  <button
                    onClick={() => handleBulkFix(group)}
                    disabled={bulkFixRunning}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                  >
                    {bulkFixRunning ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    Fix all
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Priority Triage panel */}
      {!onRegisterWorkspacePanel && showTriage && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-500/5 dark:bg-indigo-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                AI Priority Triage — where to focus effort
              </h3>
            </div>
            <button
              onClick={() => setShowTriage(false)}
              className="p-1 rounded text-indigo-500 hover:bg-indigo-200/30"
            >
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-indigo-200/50 dark:divide-indigo-900/30">
            {triageItems.map((item) => (
              <div key={item.initiativeId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                    item.gateReady
                      ? 'bg-emerald-500'
                      : item.effort === 'low'
                        ? 'bg-blue-500'
                        : item.effort === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-danger-500'
                  }`}
                />
                <button
                  onClick={() => onOpenInitiative(item.initiativeId)}
                  className="font-medium text-slate-900 dark:text-white hover:text-c-info dark:hover:text-c-info transition-colors truncate max-w-[200px]"
                >
                  {item.initiativeName}
                </button>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    item.completeness === 100
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : item.completeness >= 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-danger-600 dark:text-danger-400'
                  }`}
                >
                  {item.completeness}%
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    item.effort === 'low'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : item.effort === 'medium'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-danger-500/15 text-danger-600 dark:text-danger-400'
                  }`}
                >
                  {item.effort} effort
                </span>
                <span className="flex-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {item.recommendation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sortable completeness table with expandable gate check */}
      {initiatives.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <table
            /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-sm"
          >
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
                <th className="w-8 px-4 py-2.5" />
                <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button
                    onClick={() => handleSort('initiative')}
                    className="inline-flex items-center gap-1 hover:text-c-info"
                  >
                    Initiative <SortIcon col="initiative" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button
                    onClick={() => handleSort('level')}
                    className="inline-flex items-center gap-1 hover:text-c-info"
                  >
                    Level <SortIcon col="level" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button
                    onClick={() => handleSort('status')}
                    className="inline-flex items-center gap-1 hover:text-c-info"
                  >
                    Status <SortIcon col="status" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button
                    onClick={() => handleSort('completeness')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-c-info"
                  >
                    Completeness <SortIcon col="completeness" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button
                    onClick={() => handleSort('missingCritical')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-c-info"
                  >
                    Missing critical <SortIcon col="missingCritical" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button
                    onClick={() => handleSort('missingTotal')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-c-info"
                  >
                    Missing total <SortIcon col="missingTotal" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInitiatives.map((row) => {
                const isExpanded = expandedId === row.initiativeId;
                const hints = isExpanded ? getGateHints(row) : [];

                return (
                  <React.Fragment key={row.initiativeId}>
                    <tr
                      className={`border-b border-slate-200 dark:border-navy-800/50 cursor-pointer
                        hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors
                        ${!row.gateReady ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : row.initiativeId)}
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {row.initiativeName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {row.level || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.status}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            row.completeness < 50
                              ? 'font-semibold text-danger-600 dark:text-danger-400'
                              : row.completeness < 100
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {row.completeness}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.missingCritical > 0 ? (
                          <span className="font-medium text-danger-600 dark:text-danger-400">
                            {row.missingCritical}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {row.missingTotal}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInitiative(row.initiativeId);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                            bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
                        >
                          <ExternalLink size={12} />
                          Preview
                        </button>
                      </td>
                    </tr>

                    {/* Expanded: Gate Readiness Check */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-0 py-0">
                          <div className="bg-slate-50/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700 px-8 py-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ClipboardCheck size={14} className="text-indigo-500" />
                              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Gate Readiness Check
                              </h4>
                              {row.gateReady ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                                  READY
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-danger-500/15 text-danger-600 dark:text-danger-400 font-medium">
                                  NOT READY
                                </span>
                              )}
                            </div>
                            {hints.length > 0 ? (
                              <div className="space-y-1.5">
                                {hints.map((h) => (
                                  <div key={h.field} className="flex items-center gap-2 text-xs">
                                    {h.status === 'ok' ? (
                                      <Check size={12} className="text-emerald-500 shrink-0" />
                                    ) : (
                                      <X size={12} className="text-danger-500 shrink-0" />
                                    )}
                                    <span
                                      className={
                                        h.status === 'ok'
                                          ? 'text-slate-600 dark:text-slate-400'
                                          : 'text-slate-900 dark:text-white font-medium'
                                      }
                                    >
                                      {h.field}
                                    </span>
                                    {h.impact && (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        {h.impact}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">No detailed data available</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {initiatives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">No completeness data available.</p>
        </div>
      )}
    </div>
  );
};
