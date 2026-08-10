/**
 * BranchComparison — Side-by-side comparison of two branches
 * with stats: count, avg priority, status distribution, depth.
 */
import { ArrowLeftRight, ChevronLeft, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface BranchComparisonProps {
  open: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; data: any }>;
  edges: Array<{ source: string; target: string }>;
}

interface BranchStats {
  key: string;
  label: string;
  nodeCount: number;
  avgPriority: number;
  maxDepth: number;
  statusCounts: Record<string, number>;
  nodeLabels: string[];
}

export const BranchComparison: React.FC<BranchComparisonProps> = ({
  open,
  onClose,
  nodes,
  edges,
}) => {
  const { t } = useTranslation();

  const branches = useMemo(() => nodes.filter((n) => n.id.startsWith('branch-')), [nodes]);
  const [leftBranch, setLeftBranch] = useState<string>(branches[0]?.data?.branchKey || '');
  const [rightBranch, setRightBranch] = useState<string>(branches[1]?.data?.branchKey || '');

  const computeStats = useMemo(() => {
    return (branchKey: string): BranchStats | null => {
      const bn = nodes.find((n) => n.id.startsWith('branch-') && n.data?.branchKey === branchKey);
      if (!bn) return null;

      const childIds = new Set<string>();
      function collect(parentId: string) {
        for (const e of edges) {
          if (e.source === parentId && !childIds.has(e.target)) {
            childIds.add(e.target);
            collect(e.target);
          }
        }
      }
      collect(bn.id);

      const childNodes = nodes.filter((n) => childIds.has(n.id));
      const priorities = childNodes.map((n) => n.data?.priority ?? 50);
      const avgPriority =
        priorities.length > 0
          ? Math.round(priorities.reduce((s, p) => s + p, 0) / priorities.length)
          : 0;

      const statusCounts: Record<string, number> = {};
      for (const n of childNodes) {
        const st = n.data?.status || 'idea';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      }

      let maxDepth = 0;
      function measureDepth(nodeId: string, depth: number) {
        maxDepth = Math.max(maxDepth, depth);
        for (const e of edges) {
          if (e.source === nodeId && childIds.has(e.target)) measureDepth(e.target, depth + 1);
        }
      }
      measureDepth(bn.id, 0);

      return {
        key: branchKey,
        label: bn.data?.label || branchKey,
        nodeCount: childNodes.length,
        avgPriority,
        maxDepth,
        statusCounts,
        nodeLabels: childNodes.map((n) => n.data?.label || n.id),
      };
    };
  }, [edges, nodes]);

  const leftStats = useMemo(() => computeStats(leftBranch), [computeStats, leftBranch]);
  const rightStats = useMemo(() => computeStats(rightBranch), [computeStats, rightBranch]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  const STATUS_COLORS: Record<string, string> = {
    idea: 'bg-c-surface-raised',
    exploring: 'bg-c-info',
    validated: 'bg-c-success',
    ready_to_convert: 'bg-c-warning',
    converted: 'bg-c-info',
  };

  const renderColumn = (stats: BranchStats | null) => {
    if (!stats)
      return (
        <div className="flex-1 flex items-center justify-center text-[11px] text-c-text-secondary">
          {t('ideas.mindmap.selectBranch', 'Select a branch')}
        </div>
      );
    return (
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-c-text-secondary dark:text-c-text mb-3 capitalize">
          {stats.label}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-c-surface-raised dark:bg-c-surface text-center">
              <div className="text-[18px] font-bold text-c-text-secondary dark:text-c-text">
                {stats.nodeCount}
              </div>
              <div className="text-[9px] text-c-text-secondary">
                {t('ideas.mindmap.ideas2', 'Ideas')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-c-surface-raised dark:bg-c-surface text-center">
              <div className="text-[18px] font-bold text-c-warning">{stats.avgPriority}</div>
              <div className="text-[9px] text-c-text-secondary">
                {t('ideas.mindmap.avgPriority', 'Avg priority')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-c-surface-raised dark:bg-c-surface text-center">
              <div className="text-[18px] font-bold text-c-info">{stats.maxDepth}</div>
              <div className="text-[9px] text-c-text-secondary">
                {t('ideas.mindmap.depth', 'Depth')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-c-surface-raised dark:bg-c-surface text-center">
              <div className="text-[18px] font-bold text-c-success">
                {stats.statusCounts.converted || 0}
              </div>
              <div className="text-[9px] text-c-text-secondary">
                {t('ideas.mindmap.converted', 'Converted')}
              </div>
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold text-c-text-secondary uppercase tracking-wider mb-1">
              Status
            </div>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-c-surface-raised dark:bg-c-surface">
              {Object.entries(stats.statusCounts).map(([st, count]) => (
                <div
                  key={st}
                  className={`h-full ${STATUS_COLORS[st] || 'bg-c-surface-raised'}`}
                  style={{ width: `${(count / Math.max(stats.nodeCount, 1)) * 100}%` }}
                  title={`${st}: ${count}`}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold text-c-text-secondary uppercase tracking-wider mb-1">
              {t('ideas.mindmap.ideas2', 'Ideas')}
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {stats.nodeLabels.map((label, idx) => (
                <div
                  key={idx}
                  className="text-[10px] text-c-text-secondary dark:text-c-text-muted truncate"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-comparison-view-heading"
        tabIndex={-1}
        className="fixed inset-0 z-modal bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl flex flex-col outline-none"
      >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <ArrowLeftRight size={16} className="text-c-info" />
        <h2 className="text-sm font-bold text-c-text dark:text-c-text" id="branch-comparison-view-heading">
          {t('ideas.mindmap.branchComparison', 'Branch Comparison')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <select
              value={leftBranch}
              onChange={(e) => setLeftBranch(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-[11px] font-bold text-c-text-secondary dark:text-c-text"
            >
              <option value="">{t('ideas.mindmap.select', '-- Select --')}</option>
              {branches.map((b) => (
                <option key={b.data?.branchKey} value={b.data?.branchKey}>
                  {b.data?.label}
                </option>
              ))}
            </select>
            <ArrowLeftRight size={16} className="text-c-text-secondary shrink-0" />
            <select
              value={rightBranch}
              onChange={(e) => setRightBranch(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-[11px] font-bold text-c-text-secondary dark:text-c-text"
            >
              <option value="">{t('ideas.mindmap.select', '-- Select --')}</option>
              {branches.map((b) => (
                <option key={b.data?.branchKey} value={b.data?.branchKey}>
                  {b.data?.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-6">
            {renderColumn(leftStats)}
            <div className="w-px bg-c-surface-raised dark:bg-c-surface shrink-0" />
            {renderColumn(rightStats)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchComparison;
