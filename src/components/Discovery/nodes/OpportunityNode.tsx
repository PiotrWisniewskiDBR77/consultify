/**
 * OpportunityNode - Green card for opportunities
 *
 * Displays identified opportunities from discovery.
 */

import { TrendingUp, Trash2 } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { useTranslation } from 'react-i18next';

import { OpportunityNodeData } from '@/types/discovery';

export const OpportunityNode: React.FC<NodeProps<OpportunityNodeData>> = memo(
  ({ data, selected }) => {
    const { t } = useTranslation('discovery');
    const { text, potentialValue, linkedPainIds, source } = data;

    const hasLinks = linkedPainIds && linkedPainIds.length > 0;

    return (
      <div
        className={`
                group relative
                bg-green-50 dark:bg-green-900/20
                border-2 ${selected ? 'border-green-500 ring-2 ring-green-500/30' : 'border-green-300 dark:border-green-700'}
                rounded-xl p-3
                min-w-[180px] max-w-[220px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-white dark:!border-navy-900"
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={16} className="text-green-500" />
            <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
              {t('discovery.nodes.opportunity.title', 'Opportunity')}
            </span>
          </div>
          {source === 'ai' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
              AI
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-green-900 dark:text-green-100 leading-relaxed">{text}</p>

        {/* Potential Value */}
        {potentialValue && (
          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            <span className="text-xs text-green-600 dark:text-green-400">
              <strong>{t('discovery.nodes.opportunity.potentialValue', 'Value')}:</strong>{' '}
              {potentialValue}
            </span>
          </div>
        )}

        {/* Delete button */}
        <button
          className="
                    absolute -top-2 -right-2
                    w-5 h-5 rounded-full
                    bg-green-500 text-white
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100
                    hover:bg-green-600
                    transition-all duration-200
                    shadow-md
                "
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 size={10} />
        </button>

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-green-400 !border-2 !border-white dark:!border-navy-900"
        />
      </div>
    );
  }
);

OpportunityNode.displayName = 'OpportunityNode';

export default OpportunityNode;
