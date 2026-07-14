/**
 * FeasibilityAnalysis — Initiative feasibility matrix with full management
 * V3-F02b: Sortable columns, clickable dimension filters, AI Optimizer,
 *          AI Score Explainer, AI Priority Ranking, inline editing
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  ListOrdered,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { getMenu3AiButtonClass } from './menu3ActionButtonStyles';
import type {
  AnalysisIssue,
  InitiativeFeasibility,
  OrgUser,
  QuickUpdatePayload,
  RegisterAnalysisWorkspacePanel,
} from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DimColor = 'green' | 'amber' | 'red';
type SortCol = 'initiative' | 'budget' | 'skills' | 'time' | 'risk' | 'score';
type SortDir = 'asc' | 'desc';
type DimKey = 'budget' | 'skills' | 'time' | 'risk';

interface AiOptProposal {
  initiativeId: string;
  initiativeName: string;
  dimension: DimKey;
  problem: string;
  suggestion: string;
  autoPayload?: QuickUpdatePayload;
}

interface FeasibilityAnalysisProps {
  feasibilities: InitiativeFeasibility[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
  onRegisterActions?: (node: React.ReactNode) => void;
  onRegisterWorkspacePanel?: RegisterAnalysisWorkspacePanel;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DIM_BG: Record<DimColor, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-danger-500',
};

const DIM_RING: Record<DimColor, string> = {
  green: 'ring-emerald-400/60',
  amber: 'ring-amber-400/60',
  red: 'ring-danger-400/60',
};

const DIM_ORDER: Record<DimColor, number> = { red: 0, amber: 1, green: 2 };

/* ------------------------------------------------------------------ */
/*  Sort helpers                                                       */
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

export const FeasibilityAnalysis: React.FC<FeasibilityAnalysisProps> = ({
  feasibilities,
  issues,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
  onRegisterActions,
  onRegisterWorkspacePanel,
}) => {
  const { t } = useTranslation();

  // Expand / inline edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Sort & dimension filter
  const [sortCol, setSortCol] = useState<SortCol>('score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [dimFilter, setDimFilter] = useState<{ dim: DimKey; color: DimColor } | null>(null);

  // AI panels
  const [aiOptRunning, setAiOptRunning] = useState(false);
  const [aiOptProposals, setAiOptProposals] = useState<AiOptProposal[] | null>(null);
  const [applyingOptIdx, setApplyingOptIdx] = useState<number | null>(null);
  const [explainerId, setExplainerId] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);

  /* ---------- sort / filter ---------- */

  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(col);
        setSortDir(col === 'score' ? 'asc' : 'desc');
      }
    },
    [sortCol]
  );

  const handleDimClick = useCallback(
    (dim: DimKey, color: DimColor, e: React.MouseEvent) => {
      e.stopPropagation();
      if (dimFilter?.dim === dim && dimFilter?.color === color) {
        setDimFilter(null);
      } else {
        setDimFilter({ dim, color });
      }
    },
    [dimFilter]
  );

  const filteredSorted = useMemo(() => {
    let list = [...feasibilities];

    if (dimFilter) {
      list = list.filter((f) => f.dimensions[dimFilter.dim] === dimFilter.color);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'initiative':
          cmp = a.initiativeName.localeCompare(b.initiativeName);
          break;
        case 'budget':
          cmp = DIM_ORDER[a.dimensions.budget] - DIM_ORDER[b.dimensions.budget];
          break;
        case 'skills':
          cmp = DIM_ORDER[a.dimensions.skills] - DIM_ORDER[b.dimensions.skills];
          break;
        case 'time':
          cmp = DIM_ORDER[a.dimensions.time] - DIM_ORDER[b.dimensions.time];
          break;
        case 'risk':
          cmp = DIM_ORDER[a.dimensions.risk] - DIM_ORDER[b.dimensions.risk];
          break;
        case 'score':
          cmp = a.overallScore - b.overallScore;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [feasibilities, dimFilter, sortCol, sortDir]);

  /* ---------- inline edit ---------- */

  const toggleExpand = (f: InitiativeFeasibility) => {
    if (expandedId === f.initiativeId) {
      setExpandedId(null);
    } else {
      setExpandedId(f.initiativeId);
      setEditBudget(f.budget != null ? String(f.budget) : '');
      setEditOwner('');
      setEditStartDate(f.plannedStartDate ? f.plannedStartDate.slice(0, 10) : '');
      setEditEndDate(f.plannedEndDate ? f.plannedEndDate.slice(0, 10) : '');
    }
  };

  const handleSaveChanges = useCallback(
    async (initiativeId: string) => {
      if (!onQuickUpdate) return;
      setSaving(true);
      try {
        const updates: QuickUpdatePayload = {};
        if (editBudget !== '') updates.budget = Number(editBudget);
        if (editOwner) updates.ownerBusinessId = editOwner;
        if (editStartDate) updates.plannedStartDate = editStartDate;
        if (editEndDate) updates.plannedEndDate = editEndDate;
        if (Object.keys(updates).length === 0) {
          setExpandedId(null);
          return;
        }
        await onQuickUpdate(initiativeId, updates);
        toast.success(t('initiatives.analysis.feasibility.updated', 'Initiative updated'));
        setExpandedId(null);
      } catch {
        toast.error(t('initiatives.analysis.feasibility.updateFailed', 'Failed to update'));
      } finally {
        setSaving(false);
      }
    },
    [editBudget, editEndDate, editOwner, editStartDate, onQuickUpdate, t]
  );

  /* ---------- AI Optimizer ---------- */

  const computeAiOptimizer = useCallback(() => {
    setAiOptRunning(true);
    setTimeout(() => {
      const proposals: AiOptProposal[] = [];

      for (const f of feasibilities) {
        if (f.dimensions.budget === 'red') {
          proposals.push({
            initiativeId: f.initiativeId,
            initiativeName: f.initiativeName,
            dimension: 'budget',
            problem: 'Budget is 0 or negative',
            suggestion: 'Set minimum budget based on initiative scope',
            autoPayload: { budget: 50000 },
          });
        }
        if (f.dimensions.skills === 'amber' || f.dimensions.skills === 'red') {
          proposals.push({
            initiativeId: f.initiativeId,
            initiativeName: f.initiativeName,
            dimension: 'skills',
            problem: 'No business owner assigned',
            suggestion: 'Assign an available owner to improve skills coverage',
          });
        }
        if (f.dimensions.time === 'amber') {
          const today = new Date();
          const start = today.toISOString().slice(0, 10);
          const end = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          proposals.push({
            initiativeId: f.initiativeId,
            initiativeName: f.initiativeName,
            dimension: 'time',
            problem: 'Missing planned dates',
            suggestion: `Set dates: ${start} → ${end} (90-day default)`,
            autoPayload: { plannedStartDate: start, plannedEndDate: end },
          });
        }
        if (f.dimensions.risk === 'red') {
          proposals.push({
            initiativeId: f.initiativeId,
            initiativeName: f.initiativeName,
            dimension: 'risk',
            problem: `Risk score very high (${f.overallScore}%)`,
            suggestion: 'Consider splitting into phases or reducing scope',
          });
        }
      }

      setAiOptProposals(proposals);
      setAiOptRunning(false);
    }, 600);
  }, [feasibilities]);

  const handleApplyOptProposal = useCallback(
    async (p: AiOptProposal, idx: number) => {
      if (!onQuickUpdate || !p.autoPayload) return;
      setApplyingOptIdx(idx);
      try {
        await onQuickUpdate(p.initiativeId, p.autoPayload);
        toast.success(t('initiatives.analysis.fixApplied', 'Fix applied'));
        setAiOptProposals((prev) => prev?.filter((_, i) => i !== idx) ?? null);
      } catch {
        toast.error(t('initiatives.analysis.fixFailed', 'Failed'));
      } finally {
        setApplyingOptIdx(null);
      }
    },
    [onQuickUpdate, t]
  );

  /* ---------- AI Score Explainer ---------- */

  const getExplanation = (f: InitiativeFeasibility) => {
    const parts: string[] = [];
    const dimLabels: Record<DimKey, string> = {
      budget: 'Budget',
      skills: 'Skills/Owner',
      time: 'Timeline',
      risk: 'Risk',
    };
    const colorLabels: Record<DimColor, string> = {
      green: 'good',
      amber: 'needs attention',
      red: 'critical',
    };

    for (const key of ['budget', 'skills', 'time', 'risk'] as DimKey[]) {
      const color = f.dimensions[key];
      if (color !== 'green') {
        parts.push(`${dimLabels[key]}: ${colorLabels[color]}`);
      }
    }

    if (parts.length === 0) return 'All dimensions are healthy.';

    const suggestions: string[] = [];
    if (f.dimensions.budget !== 'green') suggestions.push('set a realistic budget');
    if (f.dimensions.skills !== 'green') suggestions.push('assign an owner');
    if (f.dimensions.time !== 'green') suggestions.push('add planned dates');
    if (f.dimensions.risk !== 'green') suggestions.push('review risk mitigation');

    return `Score ${f.overallScore}% because: ${parts.join(', ')}. Suggestion: ${suggestions.join(', ')}.`;
  };

  /* ---------- AI Priority Ranking ---------- */

  const priorityRanking = useMemo(() => {
    return [...feasibilities]
      .sort((a, b) => b.overallScore - a.overallScore)
      .map((f, idx) => ({ ...f, rank: idx + 1 }));
  }, [feasibilities]);

  /* ---------- stats ---------- */

  const highRiskCount = feasibilities.filter((f) => f.overallScore < 50).length;
  const redDimCount = feasibilities.filter(
    (f) =>
      f.dimensions.budget === 'red' ||
      f.dimensions.skills === 'red' ||
      f.dimensions.time === 'red' ||
      f.dimensions.risk === 'red'
  ).length;

  const DIM_LABELS: Record<DimKey, string> = {
    budget: 'Budget',
    skills: 'Skills',
    time: 'Time',
    risk: 'Risk',
  };

  const explainedInitiative =
    explainerId != null
      ? (feasibilities.find((item) => item.initiativeId === explainerId) ?? null)
      : null;

  const closeWorkspacePanels = useCallback(() => {
    setAiOptProposals(null);
    setShowRanking(false);
    setExplainerId(null);
  }, []);

  const aiOptimizerPanel =
    aiOptProposals !== null ? (
      <div className="m-4 rounded-xl border border-c-info dark:border-c-info/50 bg-c-info/5 dark:bg-c-info/10 overflow-hidden">
        <div className="px-4 py-3 bg-c-info/10 dark:bg-c-info/20 border-b border-c-info dark:border-c-info/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-c-info dark:text-c-info" />
            <h3 className="text-sm font-semibold text-c-info dark:text-c-info">
              {t('initiatives.analysis.feasibility.aiProposals', 'AI optimization proposals')}
            </h3>
            <span className="text-xs text-c-info dark:text-c-info">({aiOptProposals.length})</span>
          </div>
          <button
            onClick={closeWorkspacePanels}
            className="p-1 rounded text-c-info hover:bg-c-info/30 dark:hover:bg-c-info/30"
          >
            <X size={14} />
          </button>
        </div>
        {aiOptProposals.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Check size={24} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                'initiatives.analysis.feasibility.allGood',
                'All initiatives have healthy feasibility'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-c-info/20 dark:divide-c-info/15">
            {aiOptProposals.map((p, idx) => (
              <div
                key={`${p.initiativeId}-${p.dimension}-${idx}`}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${DIM_BG.red}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {p.initiativeName}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
                      {DIM_LABELS[p.dimension]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {p.problem} — {p.suggestion}
                  </p>
                </div>
                {p.autoPayload && onQuickUpdate ? (
                  <button
                    onClick={() => handleApplyOptProposal(p, idx)}
                    disabled={applyingOptIdx === idx}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    {applyingOptIdx === idx ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    {t('initiatives.analysis.resources.accept', 'Apply')}
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenInitiative(p.initiativeId)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
                  >
                    <ExternalLink size={12} />
                    {t('initiatives.analysis.previewInitiative', 'Preview')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null;

  const rankingPanel = showRanking ? (
    <div className="m-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-500/5 dark:bg-indigo-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered size={16} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            {t(
              'initiatives.analysis.feasibility.priorityRanking',
              'AI Priority Ranking — recommended execution order'
            )}
          </h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-indigo-500 hover:bg-indigo-200/30 dark:hover:bg-indigo-800/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="divide-y divide-indigo-200/50 dark:divide-indigo-900/30">
        {priorityRanking.map((f) => (
          <div key={f.initiativeId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                f.rank <= 3
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : f.overallScore < 50
                    ? 'bg-danger-500/20 text-danger-700 dark:text-danger-300'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {f.rank}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-slate-900 dark:text-white truncate block">
                {f.initiativeName}
              </span>
              {f.ownerName && (
                <span className="text-xs text-slate-600 dark:text-slate-500">{f.ownerName}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {(['budget', 'skills', 'time', 'risk'] as DimKey[]).map((dim) => (
                <span
                  key={dim}
                  className={`w-2.5 h-2.5 rounded-full ${DIM_BG[f.dimensions[dim]]}`}
                  title={`${DIM_LABELS[dim]}: ${f.dimensions[dim]}`}
                />
              ))}
            </div>
            <span
              className={`text-xs font-semibold tabular-nums w-10 text-right ${
                f.overallScore < 50
                  ? 'text-danger-600 dark:text-danger-400'
                  : f.overallScore < 75
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {f.overallScore}%
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const explainerPanel = explainedInitiative ? (
    <div className="m-4 rounded-xl border border-c-info dark:border-c-info/50 bg-c-info/5 dark:bg-c-info/10 overflow-hidden">
      <div className="px-4 py-3 bg-c-info/10 dark:bg-c-info/20 border-b border-c-info dark:border-c-info/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-c-info dark:text-c-info" />
          <h3 className="text-sm font-semibold text-c-info dark:text-c-info">AI Score Explainer</h3>
        </div>
        <button
          onClick={closeWorkspacePanels}
          className="p-1 rounded text-c-info hover:bg-c-info/30 dark:hover:bg-c-info/30"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {explainedInitiative.initiativeName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Score {explainedInitiative.overallScore}%
          </p>
        </div>
        <div className="rounded-lg bg-white/70 dark:bg-navy-950/60 border border-c-info/50 dark:border-c-info/40 px-3 py-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {getExplanation(explainedInitiative)}
          </p>
        </div>
        <button
          onClick={() => onOpenInitiative(explainedInitiative.initiativeId)}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
        >
          <ExternalLink size={12} />
          {t('initiatives.analysis.previewInitiative', 'Preview')}
        </button>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!onRegisterActions) return;
    const toggleAiOptimizerPanel = () => {
      if (aiOptProposals !== null) {
        closeWorkspacePanels();
        return;
      }
      setShowRanking(false);
      setExplainerId(null);
      computeAiOptimizer();
    };
    onRegisterActions(
      <>
        {onQuickUpdate && (
          <button
            onClick={toggleAiOptimizerPanel}
            disabled={aiOptRunning}
            className={getMenu3AiButtonClass(aiOptProposals !== null)}
          >
            {aiOptRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Optimize
          </button>
        )}
        <button
          onClick={() => {
            setAiOptProposals(null);
            setExplainerId(null);
            setShowRanking((v) => !v);
          }}
          className={getMenu3AiButtonClass(showRanking)}
        >
          <ListOrdered size={12} />
          AI Ranking
        </button>
      </>
    );
  }, [
    onRegisterActions,
    onQuickUpdate,
    computeAiOptimizer,
    aiOptProposals,
    aiOptRunning,
    showRanking,
    closeWorkspacePanels,
  ]);

  useEffect(() => {
    if (!onRegisterWorkspacePanel) return;
    if (aiOptimizerPanel) {
      onRegisterWorkspacePanel({
        title: 'AI Optimize',
        subtitle: 'Apply targeted fixes for weak feasibility dimensions.',
        icon: <Sparkles size={16} />,
        content: aiOptimizerPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (rankingPanel) {
      onRegisterWorkspacePanel({
        title: 'AI Ranking',
        subtitle: 'Recommended execution order based on feasibility score.',
        icon: <ListOrdered size={16} />,
        content: rankingPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    if (explainerPanel) {
      onRegisterWorkspacePanel({
        title: 'Score Explainer',
        subtitle: 'Why this initiative scored the way it did and what to improve.',
        icon: <HelpCircle size={16} />,
        content: explainerPanel,
      });
      return () => onRegisterWorkspacePanel(null);
    }
    onRegisterWorkspacePanel(null);
    return undefined;
  }, [aiOptimizerPanel, rankingPanel, explainerPanel, onRegisterWorkspacePanel]);

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header: stats */}
      <div className="flex items-center gap-4">
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {feasibilities.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.feasibility.total', 'Initiatives')}
            </div>
          </div>
          <div className="rounded-xl border border-danger-200 dark:border-danger-900/50 bg-danger-500/5 dark:bg-danger-500/10 p-3">
            <div className="text-xl font-semibold text-danger-600 dark:text-danger-400">
              {highRiskCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.feasibility.highRisk', 'High risk (<50%)')}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 p-3">
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
              {redDimCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.feasibility.criticalDims', 'With critical dimension')}
            </div>
          </div>
        </div>
      </div>

      {/* Active dimension filter chip */}
      {dimFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('initiatives.analysis.feasibility.filterBy', 'Filtered by:')}
          </span>
          <button
            onClick={() => setDimFilter(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${DIM_BG[dimFilter.color]}`} />
            {DIM_LABELS[dimFilter.dim]}
            <X size={10} />
          </button>
        </div>
      )}

      {/* AI Optimizer proposals */}
      {!onRegisterWorkspacePanel && aiOptimizerPanel}

      {/* AI Priority Ranking */}
      {!onRegisterWorkspacePanel && rankingPanel}

      {/* Feasibility matrix — sortable, filterable, with explainer */}
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
                  className="inline-flex items-center gap-1 hover:text-c-info dark:hover:text-c-info transition-colors"
                >
                  {t('initiatives.analysis.feasibility.initiative', 'Initiative')}
                  <SortIcon col="initiative" cur={sortCol} dir={sortDir} />
                </button>
              </th>
              {(['budget', 'skills', 'time', 'risk'] as SortCol[]).map((col) => (
                <th
                  key={col}
                  className="text-center px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300"
                >
                  <button
                    onClick={() => handleSort(col)}
                    className="inline-flex items-center gap-1 mx-auto hover:text-c-info dark:hover:text-c-info transition-colors"
                  >
                    {t(
                      `initiatives.analysis.feasibility.${col}`,
                      col.charAt(0).toUpperCase() + col.slice(1)
                    )}
                    <SortIcon col={col} cur={sortCol} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="text-right px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 w-20">
                <button
                  onClick={() => handleSort('score')}
                  className="inline-flex items-center gap-1 ml-auto hover:text-c-info dark:hover:text-c-info transition-colors"
                >
                  {t('initiatives.analysis.feasibility.score', 'Score')}
                  <SortIcon col="score" cur={sortCol} dir={sortDir} />
                </button>
              </th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((f) => {
              const isExpanded = expandedId === f.initiativeId;
              const isExplaining = explainerId === f.initiativeId;

              return (
                <React.Fragment key={f.initiativeId}>
                  <tr
                    className={`border-b border-slate-200 dark:border-navy-800/50 cursor-pointer
                      hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors
                      ${f.overallScore < 50 ? 'bg-danger-500/5 dark:bg-danger-500/10' : ''}`}
                    onClick={() => toggleExpand(f)}
                  >
                    <td className="px-4 py-3 text-slate-600">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {f.initiativeName}
                      </div>
                      {f.ownerName && (
                        <div className="text-xs text-slate-600 dark:text-slate-500">
                          {f.ownerName}
                        </div>
                      )}
                    </td>
                    {(['budget', 'skills', 'time', 'risk'] as DimKey[]).map((dim) => (
                      <td key={dim} className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => handleDimClick(dim, f.dimensions[dim], e)}
                          className={`inline-block w-3.5 h-3.5 rounded-full ${DIM_BG[f.dimensions[dim]]}
                            hover:ring-2 ${DIM_RING[f.dimensions[dim]]} transition-all
                            ${dimFilter?.dim === dim && dimFilter?.color === f.dimensions[dim] ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-navy-900' : ''}`}
                          title={`${DIM_LABELS[dim]}: ${f.dimensions[dim]} — click to filter`}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          f.overallScore < 50
                            ? 'text-danger-600 dark:text-danger-400'
                            : f.overallScore < 75
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {f.overallScore}%
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isExplaining) {
                            setAiOptProposals(null);
                            setShowRanking(false);
                          }
                          setExplainerId(isExplaining ? null : f.initiativeId);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isExplaining
                            ? 'text-c-info dark:text-c-info bg-c-info/10'
                            : 'text-slate-600 hover:text-c-info hover:bg-c-info/10'
                        }`}
                        title="AI Score Explainer"
                      >
                        <HelpCircle size={14} />
                      </button>
                    </td>
                  </tr>

                  {/* AI Score Explainer tooltip row */}
                  {isExplaining && !isExpanded && !onRegisterWorkspacePanel && (
                    <tr>
                      <td colSpan={8} className="px-0 py-0">
                        <div className="px-12 py-2.5 bg-c-info/5 dark:bg-c-info/10 border-b border-c-info/50 dark:border-c-info/30">
                          <div className="flex items-start gap-2">
                            <Sparkles size={12} className="text-c-info mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-700 dark:text-slate-300">
                              {getExplanation(f)}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Expanded inline edit */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="px-0 py-0">
                        <div className="bg-slate-50/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700 px-8 py-4">
                          {/* Explainer inside expanded row */}
                          {!onRegisterWorkspacePanel && (
                            <div className="mb-3 px-1 py-2 rounded-lg bg-c-info/5 dark:bg-c-info/10">
                              <div className="flex items-start gap-2 px-2">
                                <Sparkles size={12} className="text-c-info mt-0.5 shrink-0" />
                                <p className="text-xs text-slate-700 dark:text-slate-300">
                                  {getExplanation(f)}
                                </p>
                              </div>
                            </div>
                          )}
                          {onQuickUpdate ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    Budget
                                  </label>
                                  <input
                                    type="number"
                                    value={editBudget}
                                    onChange={(e) => setEditBudget(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    Business Owner
                                  </label>
                                  <select
                                    value={editOwner}
                                    onChange={(e) => setEditOwner(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                  >
                                    <option value="">{f.ownerName || 'No change'}</option>
                                    {users.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.firstName} {u.lastName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    Start date
                                  </label>
                                  <input
                                    type="date"
                                    value={editStartDate}
                                    onChange={(e) => setEditStartDate(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    End date
                                  </label>
                                  <input
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveChanges(f.initiativeId);
                                  }}
                                  disabled={saving}
                                  className="px-4 py-2 text-xs font-medium rounded-lg bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 transition-colors"
                                >
                                  {saving ? 'Saving...' : 'Save changes'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedId(null);
                                  }}
                                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                                >
                                  Cancel
                                </button>
                                <div className="ml-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenInitiative(f.initiativeId);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
                                  >
                                    <ExternalLink size={12} />
                                    {t('initiatives.analysis.previewInitiative', 'Preview')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {f.ownerName && `Owner: ${f.ownerName}`}
                                {f.budget != null && ` · Budget: ${f.budget.toLocaleString()}`}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenInitiative(f.initiativeId);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 transition-colors"
                              >
                                <ExternalLink size={12} />
                                {t('initiatives.analysis.previewInitiative', 'Preview')}
                              </button>
                            </div>
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

      {/* Empty state */}
      {feasibilities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">
            {t('initiatives.analysis.feasibility.noData', 'No feasibility data available.')}
          </p>
        </div>
      )}
    </div>
  );
};
