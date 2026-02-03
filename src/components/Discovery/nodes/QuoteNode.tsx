/**
 * QuoteNode - Slate/Gray card for user quotes
 *
 * Displays direct quotes from the user during discovery.
 */

import { MessageSquareQuote, Trash2 } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';

import { QuoteNodeData } from '@/types/discovery';

export const QuoteNode: React.FC<NodeProps<QuoteNodeData>> = memo(({ data, selected }) => {
  const { t } = useTranslation('discovery');
  const { text, sentiment, speaker } = data;

  const sentimentColors = {
    positive: 'border-l-green-500',
    negative: 'border-l-red-500',
    neutral: 'border-l-slate-400',
  };

  const sentimentKey = (sentiment || 'neutral') as keyof typeof sentimentColors;

  return (
    <div
      className={`
                group relative
                bg-slate-50 dark:bg-slate-800/50
                border-2 border-l-4 ${sentimentColors[sentimentKey] || sentimentColors.neutral}
                ${selected ? 'border-slate-500 ring-2 ring-slate-500/30' : 'border-slate-200 dark:border-slate-700'}
                rounded-xl p-3
                min-w-[160px] max-w-[200px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white dark:!border-navy-900"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquareQuote size={14} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {t('discovery.nodes.quote.title', 'Quote')}
        </span>
      </div>

      {/* Quote */}
      <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">"{text}"</p>

      {/* Speaker */}
      {speaker && (
        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">— {speaker}</div>
      )}

      {/* Delete button */}
      <button
        className="
                    absolute -top-2 -right-2
                    w-5 h-5 rounded-full
                    bg-slate-500 text-white
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100
                    hover:bg-slate-600
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
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white dark:!border-navy-900"
      />
    </div>
  );
});

QuoteNode.displayName = 'QuoteNode';

export default QuoteNode;
