/**
 * TimelineView — Displays mind map nodes on a horizontal timeline.
 * Nodes are ordered by creation time or status progression.
 */
import { ArrowRight, Calendar, ChevronLeft, Lightbulb, Rocket, Star, Target } from 'lucide-react';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface TimelineNode {
  id: string;
  label: string;
  branchKey: string;
  status: string;
  createdAt?: number;
}

interface TimelineViewProps {
  open: boolean;
  onClose: () => void;
  nodes: TimelineNode[];
  onSelectNode: (nodeId: string) => void;
}

const STATUS_ORDER = ['idea', 'exploring', 'validated', 'ready_to_convert', 'converted'];
const STATUS_ICONS: Record<string, React.ComponentType<any>> = {
  idea: Lightbulb,
  exploring: Target,
  validated: Star,
  ready_to_convert: Rocket,
  converted: ArrowRight,
};

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-c-surface-raised border-c-border-subtle',
  exploring: 'bg-c-surface-raised border-c-info',
  validated: 'bg-c-surface-raised border-c-success',
  ready_to_convert: 'bg-c-surface-raised border-c-warning',
  converted: 'bg-c-tag-2 border-c-tag-2',
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  open,
  onClose,
  nodes,
  onSelectNode,
}) => {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const groups: Record<string, TimelineNode[]> = {};
    for (const s of STATUS_ORDER) groups[s] = [];
    for (const n of nodes) {
      const status = n.status || 'idea';
      if (!groups[status]) groups[status] = [];
      groups[status].push(n);
    }
    return groups;
  }, [nodes]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-view-view-heading"
        tabIndex={-1}
        className="fixed inset-0 z-modal bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl flex flex-col outline-none"
      >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <Calendar size={16} className="text-c-warning" />
        <h2 className="text-sm font-bold text-c-text dark:text-c-text" id="timeline-view-view-heading">
          {t('ideas.mindmap.timelineView', 'Timeline View')}
        </h2>
        <span className="text-[10px] text-c-text-secondary ml-auto">
          {nodes.length} {t('ideas.mindmap.items', 'items')}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-8">
        <div className="flex items-start gap-0 min-w-max">
          {STATUS_ORDER.map((status, idx) => {
            const items = grouped[status] || [];
            const Icon = STATUS_ICONS[status] || Lightbulb;
            const colorClass =
              STATUS_COLORS[status] || 'bg-c-surface-raised border-c-border-subtle';

            return (
              <React.Fragment key={status}>
                <div className="flex flex-col items-center min-w-[200px]">
                  {/* Status header */}
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${colorClass} mb-4`}
                  >
                    <Icon size={14} />
                    <span className="text-[11px] font-bold text-c-text-secondary dark:text-c-text capitalize">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-c-text-secondary font-medium">
                      ({items.length})
                    </span>
                  </div>

                  {/* Nodes */}
                  <div className="space-y-2 w-full px-2">
                    {items.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node.id)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle hover:bg-c-surface-raised dark:hover:bg-c-surface hover:shadow-md transition-all"
                      >
                        <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text truncate">
                          {node.label}
                        </div>
                        <div className="text-[9px] text-c-text-secondary mt-0.5">
                          {node.branchKey}
                        </div>
                      </button>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-4 text-[10px] text-c-text-secondary">
                        {t('ideas.mindmap.noItems', 'No items')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector arrow */}
                {idx < STATUS_ORDER.length - 1 && (
                  <div className="flex items-center pt-3 px-2">
                    <div className="w-8 h-0.5 bg-c-surface-raised dark:bg-c-surface-raised" />
                    <ArrowRight size={12} className="text-c-text-secondary -ml-1" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
