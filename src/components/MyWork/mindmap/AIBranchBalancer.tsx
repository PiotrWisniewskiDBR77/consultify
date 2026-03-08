/**
 * AIBranchBalancer — Floating suggestion when the map is unbalanced
 * (some branches have many nodes, others have few or none).
 */
import { BarChart3, ChevronRight, Scale, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BranchBalance {
  branchKey: string;
  label: string;
  count: number;
  percentage: number;
}

interface AIBranchBalancerProps {
  nodes: Array<{ id: string; data: any; type?: string }>;
  edges: Array<{ id: string; source: string; target: string }>;
  locked: boolean;
  onFocusBranch: (branchKey: string) => void;
}

export const AIBranchBalancer: React.FC<AIBranchBalancerProps> = ({
  nodes,
  edges,
  locked,
  onFocusBranch,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [dismissed, setDismissed] = useState(false);

  const branches = useMemo((): BranchBalance[] => {
    const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
    const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
    const total = ideaNodes.length || 1;

    return branchNodes
      .map((bn) => {
        const childCount = edges.filter((e) => e.source === bn.id).length;
        // Also count grandchildren
        const directChildIds = edges.filter((e) => e.source === bn.id).map((e) => e.target);
        const grandChildCount = edges.filter((e) => directChildIds.includes(e.source)).length;
        const totalCount = childCount + grandChildCount;
        return {
          branchKey: bn.data?.branchKey || bn.id,
          label: bn.data?.label || bn.data?.branchKey || bn.id,
          count: totalCount,
          percentage: Math.round((totalCount / total) * 100),
        };
      })
      .sort((a, b) => a.count - b.count);
  }, [edges, nodes]);

  const isUnbalanced = useMemo(() => {
    if (branches.length < 2) return false;
    const max = Math.max(...branches.map((b) => b.count));
    const min = Math.min(...branches.map((b) => b.count));
    const total = branches.reduce((s, b) => s + b.count, 0);
    if (total < 6) return false;
    return max > 0 && max - min >= 3 && max / Math.max(1, min) >= 3;
  }, [branches]);

  const emptyBranches = useMemo(() => branches.filter((b) => b.count === 0), [branches]);
  const weakBranches = useMemo(
    () => branches.filter((b) => b.count > 0 && b.count <= 1),
    [branches]
  );

  useEffect(() => {
    setDismissed(false);
  }, [nodes.length]);

  if (!isUnbalanced || dismissed || locked) return null;

  return (
    <div className="absolute bottom-16 left-3 z-[88] w-[280px]">
      <div className="rounded-2xl bg-white/90 dark:bg-navy-900/90 backdrop-blur-xl border border-blue-400/30 dark:border-blue-500/20 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/30 dark:border-navy-700/30">
          <Scale size={14} className="text-blue-500 shrink-0" />
          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex-1">
            {isPl ? 'Mapa niezbalansowana' : 'Unbalanced Map'}
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        <div className="px-3 py-2.5 space-y-1.5">
          {/* Branch bars */}
          {branches.map((b) => (
            <div key={b.branchKey} className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 w-16 truncate">
                {b.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    b.count === 0 ? 'bg-red-400' : b.count <= 1 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(5, b.percentage)}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 w-4 text-right">{b.count}</span>
            </div>
          ))}

          {/* Suggestions */}
          {emptyBranches.length > 0 && (
            <div className="pt-1.5 border-t border-slate-200/30 dark:border-navy-700/30">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                {isPl ? 'Puste gałęzie:' : 'Empty branches:'}
              </div>
              {emptyBranches.map((b) => (
                <button
                  key={b.branchKey}
                  onClick={() => onFocusBranch(b.branchKey)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <BarChart3 size={10} />
                  <span className="flex-1 text-left">{b.label}</span>
                  <ChevronRight size={10} />
                </button>
              ))}
            </div>
          )}

          {weakBranches.length > 0 && (
            <div className="pt-1.5 border-t border-slate-200/30 dark:border-navy-700/30">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                {isPl ? 'Słabe gałęzie (1 element):' : 'Weak branches (1 item):'}
              </div>
              {weakBranches.map((b) => (
                <button
                  key={b.branchKey}
                  onClick={() => onFocusBranch(b.branchKey)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <BarChart3 size={10} />
                  <span className="flex-1 text-left">{b.label}</span>
                  <ChevronRight size={10} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIBranchBalancer;
