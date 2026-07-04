/**
 * ToolNode - Purple card for recommended tools
 *
 * Displays transformation tools recommended based on discovery.
 */

import { Wrench } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';

import { ToolNodeData } from '@/types/discovery';

const EffortImpactBadge: React.FC<{ effort?: string; impact?: string }> = ({ effort, impact }) => {
  if (!effort && !impact) return null;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {effort && (
        <span className="px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300">
          Effort: {effort}
        </span>
      )}
      {impact && (
        <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300">
          Impact: {impact}
        </span>
      )}
    </div>
  );
};

export const ToolNode: React.FC<NodeProps<ToolNodeData>> = memo(({ data, selected }) => {
  const { t } = useTranslation('discovery');
  const { name, category, description } = data;

  return (
    <div
      className={`
                group relative
                bg-primary-50 dark:bg-primary-900/20
                border-2 ${selected ? 'border-slate-600 dark:border-c-border-strong ring-2 ring-slate-400/30 dark:ring-c-border' : 'border-primary-300 dark:border-primary-700'}
                rounded-xl p-3
                min-w-[170px] max-w-[210px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-primary-400 !border-2 !border-white dark:!border-navy-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
          <Wrench size={14} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <span className="text-[9px] text-primary-500 dark:text-primary-400 uppercase tracking-wide">
            {category || t('discovery.nodes.tool.title', 'Tool')}
          </span>
          <h4 className="text-sm font-semibold text-primary-900 dark:text-primary-100">{name}</h4>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-primary-700 dark:text-primary-300 line-clamp-2">{description}</p>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-primary-400 !border-2 !border-white dark:!border-navy-900"
      />
    </div>
  );
});

ToolNode.displayName = 'ToolNode';

export default ToolNode;
