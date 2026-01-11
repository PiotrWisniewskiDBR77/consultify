/**
 * ToolNode - Purple card for recommended tools
 *
 * Displays transformation tools recommended based on discovery.
 */

import { Wrench } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { useTranslation } from 'react-i18next';

import { ToolNodeData } from '@/types/discovery';

const EffortImpactBadge: React.FC<{ effort?: string; impact?: string }> = ({ effort, impact }) => {
  if (!effort && !impact) return null;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {effort && (
        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
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
                bg-purple-50 dark:bg-purple-900/20
                border-2 ${selected ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-purple-300 dark:border-purple-700'}
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
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-white dark:!border-navy-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
          <Wrench size={14} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <span className="text-[9px] text-purple-500 dark:text-purple-400 uppercase tracking-wide">
            {category || t('discovery.nodes.tool.title', 'Tool')}
          </span>
          <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">{name}</h4>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-purple-700 dark:text-purple-300 line-clamp-2">{description}</p>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-white dark:!border-navy-900"
      />
    </div>
  );
});

ToolNode.displayName = 'ToolNode';

export default ToolNode;
