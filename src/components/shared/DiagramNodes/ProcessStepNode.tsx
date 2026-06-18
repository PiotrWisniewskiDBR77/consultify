/**
 * ProcessStepNode - Rectangular process step
 *
 * Standard rectangular node for process steps/actions.
 * Used in: Process flows, workflows, strategic diagrams
 */

import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

export interface ProcessStepData {
  label: string;
  description?: string;
  status?: 'pending' | 'active' | 'completed' | 'error';
  icon?: React.ReactNode;
}

export const ProcessStepNode: React.FC<NodeProps<ProcessStepData>> = memo(
  ({ data, selected, isConnectable }) => {
    const { label, description, status = 'pending', icon } = data;

    const statusColors = {
      pending: 'border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-slate-800',
      active: 'border-blue-500 bg-blue-50 dark:bg-blue-500/10',
      completed: 'border-green-500 bg-green-50 dark:bg-green-500/10',
      error: 'border-danger-500 bg-danger-50 dark:bg-danger-500/10',
    };

    const statusIndicator = {
      pending: 'bg-slate-400 dark:bg-slate-500',
      active: 'bg-blue-500 animate-pulse',
      completed: 'bg-green-500',
      error: 'bg-danger-500',
    };

    return (
      <div
        className={`
                min-w-[160px] max-w-[240px] rounded-lg border-2 transition-all duration-200
                ${statusColors[status as keyof typeof statusColors]}
                ${selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}
            `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-slate-800"
        />

        {/* Content */}
        <div className="p-3">
          <div className="flex items-start gap-2">
            {/* Status Indicator */}
            <div
              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                statusIndicator[status as keyof typeof statusIndicator]
              }`}
            />

            <div className="flex-1 min-w-0">
              {/* Icon */}
              {icon && <div className="text-slate-600 dark:text-slate-500 mb-1">{icon}</div>}

              {/* Label */}
              <div className="font-medium text-sm text-slate-800 dark:text-white truncate">
                {label || 'Process Step'}
              </div>

              {/* Description */}
              {description && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-slate-800"
        />
      </div>
    );
  }
);

ProcessStepNode.displayName = 'ProcessStepNode';

export default ProcessStepNode;
