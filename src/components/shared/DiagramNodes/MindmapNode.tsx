/**
 * MindmapNode - Circular mindmap node
 *
 * Circular node for mind mapping and brainstorming.
 * Used in: Mind maps, strategy diagrams, brainstorming
 */

import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

export interface MindmapNodeData {
  label: string;
  level?: 0 | 1 | 2 | 3;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
}

export const MindmapNode: React.FC<NodeProps<MindmapNodeData>> = memo(
  ({ data, selected, isConnectable }) => {
    const { label, level = 1, color = 'blue' } = data;

    // Size based on level
    const sizeClasses: Record<number, string> = {
      0: 'w-28 h-28 text-base font-bold', // Central topic
      1: 'w-24 h-24 text-sm font-semibold', // Main branches
      2: 'w-20 h-20 text-xs font-medium', // Sub-branches
      3: 'w-16 h-16 text-[10px]', // Leaves
    };

    const colorClasses: Record<string, string> = {
      blue: 'border-blue-500 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200',
      green:
        'border-green-500 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-200',
      amber:
        'border-amber-500 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200',
      red: 'border-danger-500 bg-danger-100 dark:bg-danger-500/20 text-danger-700 dark:text-danger-200',
      purple:
        'border-primary-500 bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-200',
      cyan: 'border-blue-500 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200',
    };

    return (
      <div
        className={`
                rounded-full border-2 flex items-center justify-center text-center p-2
                transition-all duration-200 ${sizeClasses[level] || sizeClasses[1]} ${colorClasses[color] || colorClasses.blue}
                ${selected ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-current' : ''}
            `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="!w-2 !h-2 !bg-current !border-2 !border-white dark:!border-slate-800"
        />

        {/* Content */}
        <span className="line-clamp-3 overflow-hidden px-1">{label || 'Topic'}</span>

        {/* Output Handles for radial connections */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          isConnectable={isConnectable}
          className="!w-2 !h-2 !bg-current !border-2 !border-white dark:!border-slate-800"
        />
        <Handle
          type="source"
          position={Position.Top}
          id="top"
          isConnectable={isConnectable}
          className="!w-2 !h-2 !bg-current !border-2 !border-white dark:!border-slate-800"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={isConnectable}
          className="!w-2 !h-2 !bg-current !border-2 !border-white dark:!border-slate-800"
        />
      </div>
    );
  }
);

MindmapNode.displayName = 'MindmapNode';

export default MindmapNode;
