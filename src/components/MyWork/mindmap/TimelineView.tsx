/**
 * TimelineView — Displays mind map nodes on a horizontal timeline.
 * Nodes are ordered by creation time or status progression.
 */
import { ArrowRight, Calendar, ChevronLeft, Lightbulb, Rocket, Star, Target } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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
  idea: 'bg-slate-200 border-slate-400',
  exploring: 'bg-blue-100 border-blue-400',
  validated: 'bg-emerald-100 border-emerald-400',
  ready_to_convert: 'bg-amber-100 border-amber-400',
  converted: 'bg-primary-100 border-primary-400',
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  open,
  onClose,
  nodes,
  onSelectNode,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[92] bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <Calendar size={16} className="text-amber-500" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">
          {isPl ? 'Widok osi czasu' : 'Timeline View'}
        </h2>
        <span className="text-[10px] text-slate-600 ml-auto">
          {nodes.length} {isPl ? 'elementów' : 'items'}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-8">
        <div className="flex items-start gap-0 min-w-max">
          {STATUS_ORDER.map((status, idx) => {
            const items = grouped[status] || [];
            const Icon = STATUS_ICONS[status] || Lightbulb;
            const colorClass = STATUS_COLORS[status] || 'bg-slate-100 border-slate-300';

            return (
              <React.Fragment key={status}>
                <div className="flex flex-col items-center min-w-[200px]">
                  {/* Status header */}
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${colorClass} mb-4`}
                  >
                    <Icon size={14} />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 capitalize">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-slate-600 font-medium">({items.length})</span>
                  </div>

                  {/* Nodes */}
                  <div className="space-y-2 w-full px-2">
                    {items.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node.id)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 hover:bg-white dark:hover:bg-navy-900/60 hover:shadow-md transition-all"
                      >
                        <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                          {node.label}
                        </div>
                        <div className="text-[9px] text-slate-600 mt-0.5">{node.branchKey}</div>
                      </button>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-4 text-[10px] text-slate-600">
                        {isPl ? 'Brak elementów' : 'No items'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector arrow */}
                {idx < STATUS_ORDER.length - 1 && (
                  <div className="flex items-center pt-3 px-2">
                    <div className="w-8 h-0.5 bg-slate-300 dark:bg-navy-600" />
                    <ArrowRight size={12} className="text-slate-600 -ml-1" />
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
