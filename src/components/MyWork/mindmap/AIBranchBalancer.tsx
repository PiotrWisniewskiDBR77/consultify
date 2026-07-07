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
    <div className="absolute bottom-16 left-3 z-dropdown w-[280px]">
      <div className="rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-info dark:border-c-info shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <Scale size={14} className="text-c-info shrink-0" />
          <span className="text-[11px] font-bold text-c-info dark:text-c-info flex-1">
            {isPl ? 'Mapa niezbalansowana' : 'Unbalanced Map'}
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        <div className="px-3 py-2.5 space-y-1.5">
          {/* Branch bars */}
          {branches.map((b) => (
            <div key={b.branchKey} className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-c-text-secondary dark:text-c-text-muted w-16 truncate">
                {b.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    b.count === 0 ? 'bg-c-danger' : b.count <= 1 ? 'bg-c-warning' : 'bg-c-success'
                  }`}
                  style={{ width: `${Math.max(5, b.percentage)}%` }}
                />
              </div>
              <span className="text-[9px] text-c-text-secondary w-4 text-right">{b.count}</span>
            </div>
          ))}

          {/* Suggestions */}
          {emptyBranches.length > 0 && (
            <div className="pt-1.5 border-t border-c-border-subtle dark:border-c-border-subtle">
              <div className="text-[9px] text-c-text-secondary dark:text-c-text-muted mb-1">
                {isPl ? 'Puste gałęzie:' : 'Empty branches:'}
              </div>
              {emptyBranches.map((b) => (
                <button
                  key={b.branchKey}
                  onClick={() => onFocusBranch(b.branchKey)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium text-c-danger dark:text-c-danger hover:bg-c-surface-raised transition-colors"
                >
                  <BarChart3 size={10} />
                  <span className="flex-1 text-left">{b.label}</span>
                  <ChevronRight size={10} />
                </button>
              ))}
            </div>
          )}

          {weakBranches.length > 0 && (
            <div className="pt-1.5 border-t border-c-border-subtle dark:border-c-border-subtle">
              <div className="text-[9px] text-c-text-secondary dark:text-c-text-muted mb-1">
                {isPl ? 'Słabe gałęzie (1 element):' : 'Weak branches (1 item):'}
              </div>
              {weakBranches.map((b) => (
                <button
                  key={b.branchKey}
                  onClick={() => onFocusBranch(b.branchKey)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium text-c-warning dark:text-c-warning hover:bg-c-surface-raised transition-colors"
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
