/**
 * InsightNode - Yellow/Amber sticky note for insights
 *
 * Displays AI-generated or user-added insights from discovery.
 * Can be linked to pain points to show relationships.
 */

import { Lightbulb, Link2, Trash2 } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { useTranslation } from 'react-i18next';

import { InsightNodeData } from '@/types/discovery';

export const InsightNode: React.FC<NodeProps<InsightNodeData>> = memo(({ data, selected }) => {
  const { t } = useTranslation('discovery');
  const { text, linkedPainIds, source } = data;

  const hasLinks = linkedPainIds && linkedPainIds.length > 0;

  return (
    <div
      className={`
                group relative
                bg-amber-50 dark:bg-amber-900/20
                border-2 ${selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-300 dark:border-amber-700'}
                rounded-xl p-3
                min-w-[180px] max-w-[240px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
    >
      {/* Input Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-white dark:!border-navy-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Lightbulb size={16} className="text-amber-500" />
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            {t('discovery.nodes.insight.title', 'Insight')}
          </span>
        </div>
        {source === 'ai' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
            AI
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">{text}</p>

      {/* Links indicator */}
      {hasLinks && (
        <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 flex items-center gap-1">
          <Link2 size={12} className="text-amber-500" />
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {t('discovery.nodes.insight.linkedTo', 'Linked to')} {linkedPainIds.length}{' '}
            {linkedPainIds.length === 1 ? 'pain point' : 'pain points'}
          </span>
        </div>
      )}

      {/* Delete button (on hover) */}
      <button
        className="
                    absolute -top-2 -right-2
                    w-5 h-5 rounded-full
                    bg-amber-500 text-white
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100
                    hover:bg-amber-600
                    transition-all duration-200
                    shadow-md
                "
        onClick={(e) => e.stopPropagation()}
        title={t('discovery.tooltips.deleteNode', 'Delete')}
      >
        <Trash2 size={10} />
      </button>

      {/* Output Handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-white dark:!border-navy-900"
      />
    </div>
  );
});

InsightNode.displayName = 'InsightNode';

export default InsightNode;
