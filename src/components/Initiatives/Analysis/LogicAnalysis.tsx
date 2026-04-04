/**
 * LogicAnalysis — AI-powered dependency discovery, conflict detection,
 * cycle detection, critical path analysis, and sequencing optimizer.
 * V3-F02c: Full dependency management with AI intelligence.
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Loader2,
  Network,
  Route,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { PortfolioInitiative } from '@/types';

import type { AnalysisIssue, DependencyLink, OrgUser, QuickUpdatePayload } from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DiscoveredDep {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface CycleInfo {
  path: string[];
  pathNames: string[];
  suggestion: string;
  removeFromId: string;
  removeToId: string;
}

interface BlockerInfo {
  initiativeId: string;
  initiativeName: string;
  dependentCount: number;
  dependentNames: string[];
  isOnCriticalPath: boolean;
}

interface CriticalPathInfo {
  path: { id: string; name: string; startDate: string | null; endDate: string | null }[];
  totalDays: number;
}

interface SequenceStep {
  phase: number;
  initiatives: { id: string; name: string; reason: string }[];
}

type SortCol = 'from' | 'to' | 'type' | 'status';
type SortDir = 'asc' | 'desc';

interface LogicAnalysisProps {
  dependencies: DependencyLink[];
  issues: AnalysisIssue[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  initiatives?: PortfolioInitiative[];
  users?: OrgUser[];
  onRegisterActions?: (node: React.ReactNode) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SortIcon: React.FC<{ col: SortCol; cur: SortCol; dir: SortDir }> = ({ col, cur, dir }) => {
  if (col !== cur) return <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600" />;
  return dir === 'asc' ? (
    <ArrowUp size={11} className="text-primary-500" />
  ) : (
    <ArrowDown size={11} className="text-primary-500" />
  );
};

const KEYWORD_GROUPS: Record<string, string[]> = {
  crm: ['crm', 'customer', 'sales', 'lead', 'pipeline', 'klient'],
  digital: ['digital', 'online', 'website', 'web', 'ecommerce', 'cyfrowy'],
  data: ['data', 'analytics', 'bi', 'report', 'dashboard', 'dane', 'raport'],
  hr: ['hr', 'talent', 'hiring', 'onboarding', 'people', 'recruitment', 'rekrutacja'],
  ops: ['operations', 'process', 'automation', 'workflow', 'lean', 'proces', 'automatyzacja'],
  finance: ['finance', 'budget', 'cost', 'revenue', 'pricing', 'finanse', 'koszty'],
  infra: ['infrastructure', 'cloud', 'migration', 'security', 'devops', 'infrastruktura'],
  product: ['product', 'feature', 'launch', 'mvp', 'roadmap', 'produkt'],
  strategy: ['strategy', 'transformation', 'vision', 'okr', 'strategia', 'transformacja'],
};

function getKeywordGroups(text: string): string[] {
  const lower = text.toLowerCase();
  const groups: string[] = [];
  for (const [group, keywords] of Object.entries(KEYWORD_GROUPS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      groups.push(group);
    }
  }
  return groups;
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const LogicAnalysis: React.FC<LogicAnalysisProps> = ({
  dependencies,
  issues,
  onOpenInitiative,
  onQuickUpdate,
  initiatives = [],
  users: _users = [],
  onRegisterActions,
}) => {
  const { t } = useTranslation();

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('status');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedDep, setExpandedDep] = useState<string | null>(null);

  // AI panels
  const [discoverRunning, setDiscoverRunning] = useState(false);
  const [discoveredDeps, setDiscoveredDeps] = useState<DiscoveredDep[] | null>(null);
  const [acceptedDiscovered, setAcceptedDiscovered] = useState<Set<string>>(new Set());

  const [cycles, setCycles] = useState<CycleInfo[] | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showSequencer, setShowSequencer] = useState(false);

  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  /* ---------- sort ---------- */

  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortCol(col); setSortDir('asc'); }
    },
    [sortCol]
  );

  const sortedDeps = useMemo(() => {
    const list = [...dependencies];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'from': cmp = a.fromName.localeCompare(b.fromName); break;
        case 'to': cmp = a.toName.localeCompare(b.toName); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'status':
          cmp = (a.hasTimingConflict ? 0 : 1) - (b.hasTimingConflict ? 0 : 1);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [dependencies, sortCol, sortDir]);

  /* ---------- stats ---------- */

  const conflictCount = dependencies.filter((d) => d.hasTimingConflict).length;
  const criticalIssues = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;

  /* ---------- AI Discover Dependencies ---------- */

  const computeDiscoverDeps = useCallback(() => {
    if (initiatives.length < 2) {
      toast.error(t('initiatives.analysis.logic.needMore', 'Need at least 2 initiatives'));
      return;
    }
    setDiscoverRunning(true);
    setAcceptedDiscovered(new Set());

    setTimeout(() => {
      const existingPairs = new Set(dependencies.map((d) => `${d.fromId}::${d.toId}`));
      const proposals: DiscoveredDep[] = [];

      for (let i = 0; i < initiatives.length; i++) {
        for (let j = 0; j < initiatives.length; j++) {
          if (i === j) continue;
          const a = initiatives[i];
          const b = initiatives[j];
          const pairKey = `${a.id}::${b.id}`;
          const reversePairKey = `${b.id}::${a.id}`;
          if (existingPairs.has(pairKey) || existingPairs.has(reversePairKey)) continue;
          if (proposals.some((p) => p.fromId === a.id && p.toId === b.id)) continue;
          if (proposals.some((p) => p.fromId === b.id && p.toId === a.id)) continue;

          const textA = `${a.name} ${a.description ?? ''} ${a.summary ?? ''} ${a.axis ?? ''}`;
          const textB = `${b.name} ${b.description ?? ''} ${b.summary ?? ''} ${b.axis ?? ''}`;
          const groupsA = getKeywordGroups(textA);
          const groupsB = getKeywordGroups(textB);
          const overlap = groupsA.filter((g) => groupsB.includes(g));

          if (overlap.length === 0) continue;

          const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          const aPrio = priorityOrder[a.priority] ?? 2;
          const bPrio = priorityOrder[b.priority] ?? 2;

          let fromInit = a;
          let toInit = b;
          let reason = '';

          if (a.plannedEndDate && b.plannedStartDate && new Date(a.plannedEndDate) <= new Date(b.plannedStartDate)) {
            reason = `"${a.name}" ends before "${b.name}" starts — natural sequence in ${overlap.join(', ')} domain`;
          } else if (b.plannedEndDate && a.plannedStartDate && new Date(b.plannedEndDate) <= new Date(a.plannedStartDate)) {
            fromInit = b;
            toInit = a;
            reason = `"${b.name}" ends before "${a.name}" starts — natural sequence in ${overlap.join(', ')} domain`;
          } else if (aPrio < bPrio) {
            reason = `"${a.name}" is higher priority (${a.priority}) and shares ${overlap.join(', ')} domain with "${b.name}"`;
          } else if (bPrio < aPrio) {
            fromInit = b;
            toInit = a;
            reason = `"${b.name}" is higher priority (${b.priority}) and shares ${overlap.join(', ')} domain with "${a.name}"`;
          } else {
            reason = `Both share ${overlap.join(', ')} domain — "${a.name}" may need to precede "${b.name}"`;
          }

          const confidence: DiscoveredDep['confidence'] =
            overlap.length >= 2 ? 'high' : (reason.includes('natural sequence') ? 'high' : 'medium');

          proposals.push({
            fromId: fromInit.id,
            fromName: fromInit.name,
            toId: toInit.id,
            toName: toInit.name,
            reason,
            confidence,
          });
        }
      }

      proposals.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.confidence] - order[b.confidence];
      });

      setDiscoveredDeps(proposals.slice(0, 20));
      setDiscoverRunning(false);
    }, 800);
  }, [dependencies, initiatives, t]);

  const handleAcceptDiscovered = useCallback(
    (dep: DiscoveredDep) => {
      setAcceptedDiscovered((prev) => new Set([...prev, `${dep.fromId}::${dep.toId}`]));
      toast.success(
        t('initiatives.analysis.logic.depAccepted', 'Dependency noted: {{from}} → {{to}}', {
          from: dep.fromName,
          to: dep.toName,
        })
      );
    },
    [t]
  );

  /* ---------- AI Detect Cycles ---------- */

  const detectCycles = useCallback(() => {
    const adj = new Map<string, string[]>();
    for (const d of dependencies) {
      if (!adj.has(d.fromId)) adj.set(d.fromId, []);
      adj.get(d.fromId)!.push(d.toId);
    }

    const idToName = new Map(initiatives.map((i) => [i.id, i.name]));
    const found: CycleInfo[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const parent = new Map<string, string>();

    function dfs(node: string): boolean {
      visited.add(node);
      stack.add(node);
      for (const next of adj.get(node) ?? []) {
        if (stack.has(next)) {
          const path = [next];
          let cur = node;
          while (cur !== next) {
            path.unshift(cur);
            cur = parent.get(cur)!;
          }
          path.unshift(next);
          found.push({
            path,
            pathNames: path.map((id) => idToName.get(id) ?? id),
            suggestion: `Remove dependency "${idToName.get(path[path.length - 2]) ?? path[path.length - 2]}" → "${idToName.get(next) ?? next}" to break the cycle`,
            removeFromId: path[path.length - 2],
            removeToId: next,
          });
          return true;
        }
        if (!visited.has(next)) {
          parent.set(next, node);
          if (dfs(next)) return true;
        }
      }
      stack.delete(node);
      return false;
    }

    for (const [id] of adj) {
      if (!visited.has(id)) dfs(id);
    }

    setCycles(found);
    if (found.length === 0) {
      toast.success(t('initiatives.analysis.logic.noCycles', 'No cycles detected'));
    }
  }, [dependencies, initiatives, t]);

  /* ---------- AI Critical Path + Blockers ---------- */

  const { blockers, criticalPath } = useMemo(() => {
    const idToInit = new Map(initiatives.map((i) => [i.id, i]));
    const dependentCount = new Map<string, Set<string>>();

    for (const d of dependencies) {
      if (!dependentCount.has(d.toId)) dependentCount.set(d.toId, new Set());
      dependentCount.get(d.toId)!.add(d.fromId);
    }

    const blockersResult: BlockerInfo[] = Array.from(dependentCount.entries())
      .filter(([, deps]) => deps.size >= 1)
      .map(([id, deps]) => ({
        initiativeId: id,
        initiativeName: idToInit.get(id)?.name ?? id,
        dependentCount: deps.size,
        dependentNames: Array.from(deps).map((did) => idToInit.get(did)?.name ?? did),
        isOnCriticalPath: idToInit.get(id)?.isCriticalPath ?? false,
      }))
      .sort((a, b) => b.dependentCount - a.dependentCount);

    const adj = new Map<string, string[]>();
    for (const d of dependencies) {
      if (!adj.has(d.fromId)) adj.set(d.fromId, []);
      adj.get(d.fromId)!.push(d.toId);
    }
    const allNodes = new Set([...adj.keys(), ...dependencies.map((d) => d.toId)]);
    const inDegree = new Map<string, number>();
    for (const n of allNodes) inDegree.set(n, 0);
    for (const d of dependencies) inDegree.set(d.toId, (inDegree.get(d.toId) ?? 0) + 1);

    const roots = Array.from(allNodes).filter((n) => (inDegree.get(n) ?? 0) === 0);

    let longestPath: string[] = [];
    let longestDays = 0;

    function findLongest(node: string, path: string[], days: number) {
      const init = idToInit.get(node);
      const nodeDays = init ? daysBetween(init.plannedStartDate, init.plannedEndDate) : 30;
      const newDays = days + nodeDays;
      const newPath = [...path, node];

      const children = adj.get(node) ?? [];
      if (children.length === 0) {
        if (newDays > longestDays) {
          longestDays = newDays;
          longestPath = newPath;
        }
        return;
      }
      for (const child of children) {
        findLongest(child, newPath, newDays);
      }
    }

    if (roots.length > 0) {
      for (const root of roots) findLongest(root, [], 0);
    } else if (allNodes.size > 0) {
      for (const node of allNodes) findLongest(node, [], 0);
    }

    const cpResult: CriticalPathInfo = {
      path: longestPath.map((id) => {
        const init = idToInit.get(id);
        return {
          id,
          name: init?.name ?? id,
          startDate: init?.plannedStartDate ?? null,
          endDate: init?.plannedEndDate ?? null,
        };
      }),
      totalDays: longestDays,
    };

    return { blockers: blockersResult, criticalPath: cpResult };
  }, [dependencies, initiatives]);

  /* ---------- AI Sequencing Optimizer ---------- */

  const sequenceSteps = useMemo((): SequenceStep[] => {
    if (initiatives.length === 0) return [];

    const adj = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    const allIds = new Set(initiatives.map((i) => i.id));

    for (const id of allIds) {
      adj.set(id, []);
      inDeg.set(id, 0);
    }

    for (const d of dependencies) {
      if (allIds.has(d.fromId) && allIds.has(d.toId)) {
        adj.get(d.fromId)!.push(d.toId);
        inDeg.set(d.toId, (inDeg.get(d.toId) ?? 0) + 1);
      }
    }

    const idToInit = new Map(initiatives.map((i) => [i.id, i]));
    const steps: SequenceStep[] = [];
    const remaining = new Set(allIds);
    let phase = 1;

    while (remaining.size > 0) {
      const ready = Array.from(remaining).filter((id) => {
        for (const d of dependencies) {
          if (d.toId === id && remaining.has(d.fromId) && d.fromId !== id) {
            return false;
          }
        }
        return true;
      });

      if (ready.length === 0) {
        const leftover = Array.from(remaining).map((id) => ({
          id,
          name: idToInit.get(id)?.name ?? id,
          reason: 'Circular dependency — resolve manually',
        }));
        steps.push({ phase, initiatives: leftover });
        break;
      }

      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      ready.sort((a, b) => {
        const ai = idToInit.get(a);
        const bi = idToInit.get(b);
        const pa = priorityOrder[ai?.priority ?? 'MEDIUM'];
        const pb = priorityOrder[bi?.priority ?? 'MEDIUM'];
        return pa - pb;
      });

      const stepInits = ready.map((id) => {
        const init = idToInit.get(id);
        const depNames = dependencies
          .filter((d) => d.toId === id && !remaining.has(d.fromId))
          .map((d) => d.fromName);
        let reason = '';
        if (depNames.length > 0) {
          reason = `After: ${depNames.join(', ')}`;
        } else if (phase === 1) {
          reason = 'No blockers — can start immediately';
        } else {
          reason = 'Previous dependencies completed';
        }
        if (init?.priority === 'CRITICAL') reason += ' (Critical priority)';
        return { id, name: init?.name ?? id, reason };
      });

      steps.push({ phase, initiatives: stepInits });
      for (const id of ready) remaining.delete(id);
      phase++;
    }

    return steps;
  }, [dependencies, initiatives]);

  /* ---------- Apply AI fix ---------- */

  const handleApplyAiFix = useCallback(
    async (issue: AnalysisIssue) => {
      if (!onQuickUpdate || !issue.initiativeId || !issue.autoFixPayload) return;
      setApplyingFix(issue.id);
      try {
        await onQuickUpdate(issue.initiativeId, issue.autoFixPayload as QuickUpdatePayload);
        toast.success(t('initiatives.analysis.fixApplied', 'AI suggestion applied'));
      } catch {
        toast.error(t('initiatives.analysis.fixFailed', 'Failed to apply fix'));
      } finally {
        setApplyingFix(null);
      }
    },
    [onQuickUpdate, t]
  );

  useEffect(() => {
    if (!onRegisterActions) return;
    onRegisterActions(
      <>
        <button
          onClick={computeDiscoverDeps}
          disabled={discoverRunning}
          className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-white bg-gradient-to-r from-violet-600 to-cyan-600 shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-40"
        >
          {discoverRunning ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          AI Discover Dependencies
        </button>
        <button
          onClick={detectCycles}
          className="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50 transition-colors"
        >
          <Shuffle size={12} />
          Detect Cycles
        </button>
        <button
          onClick={() => setShowCriticalPath((v) => !v)}
          className={`h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border transition-colors ${
            showCriticalPath
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
        >
          <Route size={12} />
          Critical Path
        </button>
        <button
          onClick={() => setShowSequencer((v) => !v)}
          className={`h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border transition-colors ${
            showSequencer
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
        >
          <Network size={12} />
          AI Sequencer
        </button>
      </>
    );
  }, [onRegisterActions, computeDiscoverDeps, discoverRunning, showCriticalPath, showSequencer]);

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header: stats + AI buttons */}
      <div className="flex items-center gap-4">
        <div className="flex-1 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {dependencies.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.logic.totalDeps', 'Total dependencies')}
            </div>
          </div>
          <div className={`rounded-xl border p-3 ${
            conflictCount > 0
              ? 'border-red-200 dark:border-red-900/50 bg-red-500/5 dark:bg-red-500/10'
              : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
          }`}>
            <div className={`text-xl font-semibold ${conflictCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
              {conflictCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.logic.timingConflicts', 'Timing conflicts')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {blockers.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.logic.blockers', 'Blockers')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {criticalPath.path.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.logic.criticalPathLen', 'Critical path length')}
            </div>
          </div>
        </div>
      </div>

      {/* AI Discover Dependencies panel */}
      {discoveredDeps !== null && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-500/5 dark:bg-purple-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                {t('initiatives.analysis.logic.discoveredDeps', 'AI discovered potential dependencies')}
              </h3>
              <span className="text-xs text-purple-500 dark:text-purple-400">
                ({discoveredDeps.length})
              </span>
            </div>
            <button onClick={() => setDiscoveredDeps(null)}
              className="p-1 rounded text-purple-500 hover:bg-purple-200/30 dark:hover:bg-purple-800/30">
              <X size={14} />
            </button>
          </div>
          {discoveredDeps.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('initiatives.analysis.logic.noNewDeps', 'No additional dependencies discovered')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-purple-200/50 dark:divide-purple-900/30">
              {discoveredDeps.map((dep, idx) => {
                const key = `${dep.fromId}::${dep.toId}`;
                const isAccepted = acceptedDiscovered.has(key);
                return (
                  <div key={`${key}-${idx}`} className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
                    ${isAccepted ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                    <span className={`shrink-0 w-2 h-2 rounded-full ${
                      dep.confidence === 'high' ? 'bg-emerald-500' :
                      dep.confidence === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                    }`} title={`Confidence: ${dep.confidence}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                          {dep.fromName}
                        </span>
                        <ArrowRight size={14} className="text-purple-400 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                          {dep.toName}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          dep.confidence === 'high'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : dep.confidence === 'medium'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-200 dark:bg-navy-700 text-slate-500'
                        }`}>
                          {dep.confidence}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{dep.reason}</p>
                    </div>
                    {isAccepted ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Check size={12} /> Accepted
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleAcceptDiscovered(dep)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                            bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
                            hover:bg-emerald-500/20 transition-colors"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          onClick={() => setDiscoveredDeps((prev) => prev?.filter((_, i) => i !== idx) ?? null)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium
                            text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cycle detection results */}
      {cycles !== null && (
        <div className={`rounded-xl border overflow-hidden ${
          cycles.length > 0
            ? 'border-red-200 dark:border-red-900/50 bg-red-500/5 dark:bg-red-500/10'
            : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10'
        }`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            cycles.length > 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
          }`}>
            <div className="flex items-center gap-2">
              <Shuffle size={16} className={cycles.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
              <h3 className={`text-sm font-semibold ${cycles.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {cycles.length > 0
                  ? t('initiatives.analysis.logic.cyclesFound', '{{count}} cycle(s) detected', { count: cycles.length })
                  : t('initiatives.analysis.logic.noCycles', 'No cycles detected')}
              </h3>
            </div>
            <button onClick={() => setCycles(null)}
              className="p-1 rounded text-slate-500 hover:bg-slate-200/30 dark:hover:bg-navy-700/50">
              <X size={14} />
            </button>
          </div>
          {cycles.map((c, idx) => (
            <div key={idx} className="px-4 py-3 border-b border-red-200/50 dark:border-red-900/30">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {c.pathNames.map((name, ni) => (
                  <React.Fragment key={ni}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      ni === 0 || ni === c.pathNames.length - 1
                        ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                        : 'bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {name}
                    </span>
                    {ni < c.pathNames.length - 1 && (
                      <ArrowRight size={12} className="text-red-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <Sparkles size={10} className="inline mr-1" />{c.suggestion}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Critical Path panel */}
      {showCriticalPath && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {t('initiatives.analysis.logic.criticalPathTitle', 'Critical Path')}
                {criticalPath.totalDays > 0 && (
                  <span className="ml-2 text-xs font-normal text-amber-600/70 dark:text-amber-400/70">
                    ({criticalPath.totalDays} days)
                  </span>
                )}
              </h3>
            </div>
            <button onClick={() => setShowCriticalPath(false)}
              className="p-1 rounded text-amber-500 hover:bg-amber-200/30 dark:hover:bg-amber-800/30">
              <X size={14} />
            </button>
          </div>
          {criticalPath.path.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('initiatives.analysis.logic.noCriticalPath', 'No dependency chain found — add dependencies first')}
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-1 flex-wrap">
                {criticalPath.path.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => onOpenInitiative(step.id)}
                      className="group relative px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-amber-200 dark:border-amber-800/50
                        hover:border-primary-400 dark:hover:border-primary-600 transition-colors shadow-sm"
                    >
                      <div className="text-xs font-medium text-slate-900 dark:text-white">
                        {step.name}
                      </div>
                      {step.startDate && step.endDate && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {new Date(step.startDate).toLocaleDateString()} — {new Date(step.endDate).toLocaleDateString()}
                          <span className="ml-1 text-amber-500">
                            ({daysBetween(step.startDate, step.endDate)}d)
                          </span>
                        </div>
                      )}
                    </button>
                    {idx < criticalPath.path.length - 1 && (
                      <ArrowRight size={16} className="text-amber-400 shrink-0 mx-1" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Blockers */}
          {blockers.length > 0 && (
            <div className="border-t border-amber-200/50 dark:border-amber-900/30">
              <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10">
                <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                  {t('initiatives.analysis.logic.blockersTitle', 'Blockers')}
                </h4>
              </div>
              <div className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
                {blockers.map((b) => (
                  <div key={b.initiativeId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Zap size={14} className="text-amber-500 shrink-0" />
                    <button
                      onClick={() => onOpenInitiative(b.initiativeId)}
                      className="font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
                    >
                      {b.initiativeName}
                    </button>
                    <span className="ml-auto shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                      {t('initiatives.analysis.logic.blockerBadge', '{{count}} dependent(s)', { count: b.dependentCount })}
                    </span>
                    <div className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px] truncate">
                      {b.dependentNames.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Sequencer */}
      {showSequencer && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-500/5 dark:bg-indigo-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                {t('initiatives.analysis.logic.sequencerTitle', 'AI Recommended Execution Sequence')}
              </h3>
            </div>
            <button onClick={() => setShowSequencer(false)}
              className="p-1 rounded text-indigo-500 hover:bg-indigo-200/30 dark:hover:bg-indigo-800/30">
              <X size={14} />
            </button>
          </div>
          {sequenceSteps.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('initiatives.analysis.logic.noInitiatives', 'No initiatives to sequence')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-indigo-200/50 dark:divide-indigo-900/30">
              {sequenceSteps.map((step) => (
                <div key={step.phase} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
                      {step.phase}
                    </span>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Phase {step.phase}
                      {step.initiatives.length > 1 && (
                        <span className="ml-1.5 normal-case font-normal text-slate-500 dark:text-slate-400">
                          ({step.initiatives.length} in parallel)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="space-y-1 ml-9">
                    {step.initiatives.map((init) => (
                      <div key={init.id} className="flex items-center gap-2 text-sm">
                        <button
                          onClick={() => onOpenInitiative(init.id)}
                          className="font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[250px]"
                        >
                          {init.name}
                        </button>
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {init.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dependencies table */}
      {dependencies.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
                <th className="w-8 px-4 py-2.5" />
                <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button onClick={() => handleSort('from')} className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
                    {t('initiatives.analysis.logic.from', 'From')}
                    <SortIcon col="from" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="w-8" />
                <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button onClick={() => handleSort('to')} className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
                    {t('initiatives.analysis.logic.to', 'Depends on')}
                    <SortIcon col="to" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button onClick={() => handleSort('type')} className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
                    {t('initiatives.analysis.logic.type', 'Type')}
                    <SortIcon col="type" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  <button onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400">
                    {t('initiatives.analysis.logic.status', 'Status')}
                    <SortIcon col="status" cur={sortCol} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedDeps.map((d) => {
                const depKey = `${d.fromId}::${d.toId}`;
                const isExpanded = expandedDep === depKey;
                const relatedIssue = issues.find(
                  (i) => i.issueType === 'dependency_timing' && i.initiativeId === d.fromId
                );

                return (
                  <React.Fragment key={depKey}>
                    <tr
                      className={`border-b border-slate-100 dark:border-navy-800/50 cursor-pointer
                        hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors
                        ${d.hasTimingConflict ? 'bg-red-500/5 dark:bg-red-500/10' : ''}`}
                      onClick={() => setExpandedDep(isExpanded ? null : depKey)}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenInitiative(d.fromId); }}
                          className="font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[200px] block"
                        >
                          {d.fromName}
                        </button>
                      </td>
                      <td className="text-center">
                        <ArrowRight size={14} className={d.hasTimingConflict ? 'text-red-400' : 'text-slate-400'} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenInitiative(d.toId); }}
                          className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[200px] block"
                        >
                          {d.toName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                          {d.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.hasTimingConflict ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                            Conflict
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-0 py-0">
                          <div className="bg-slate-50/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700 px-8 py-4">
                            <div className="flex items-center gap-4">
                              {relatedIssue && (
                                <div className="flex-1">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                    <AlertTriangle size={12} className="inline mr-1 text-red-500" />
                                    {relatedIssue.description}
                                  </p>
                                  {relatedIssue.fixSuggestion && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                      <Sparkles size={10} className="inline mr-1 text-purple-500" />
                                      {relatedIssue.fixSuggestion}
                                    </p>
                                  )}
                                  {relatedIssue.autoFixPayload && onQuickUpdate && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleApplyAiFix(relatedIssue); }}
                                      disabled={applyingFix === relatedIssue.id}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                                        bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20
                                        disabled:opacity-50 transition-colors"
                                    >
                                      {applyingFix === relatedIssue.id
                                        ? <Loader2 size={12} className="animate-spin" />
                                        : <Sparkles size={12} />}
                                      Apply fix
                                    </button>
                                  )}
                                </div>
                              )}
                              {!relatedIssue && (
                                <p className="flex-1 text-xs text-emerald-600 dark:text-emerald-400">
                                  <Check size={12} className="inline mr-1" />
                                  Dependency is healthy — no timing conflicts
                                </p>
                              )}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); onOpenInitiative(d.fromId); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                                    bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                                >
                                  <ExternalLink size={12} />
                                  {d.fromName}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onOpenInitiative(d.toId); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                                    bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                                >
                                  <ExternalLink size={12} />
                                  {d.toName}
                                </button>
                              </div>
                            </div>
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
      {dependencies.length === 0 && discoveredDeps === null && !showCriticalPath && !showSequencer && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
          <GitBranch size={40} className="mb-4 opacity-40" />
          <p className="text-sm font-medium mb-1">
            {t('initiatives.analysis.logic.noData', 'No dependency data available.')}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
            {t('initiatives.analysis.logic.emptyHint', 'Click "AI Discover Dependencies" to let AI analyze your initiatives and suggest connections.')}
          </p>
          {initiatives.length >= 2 && (
            <button
              onClick={computeDiscoverDeps}
              disabled={discoverRunning}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-purple-600 to-indigo-600 text-white
                hover:from-purple-700 hover:to-indigo-700
                disabled:opacity-60 shadow-lg shadow-purple-500/20 transition-all"
            >
              {discoverRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t('initiatives.analysis.logic.aiDiscover', 'AI Discover Dependencies')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
