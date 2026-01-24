/**
 * DecisionNode - Diamond-shaped decision point
 *
 * Diamond node for yes/no branching decisions.
 * Used in: Flowcharts, decision trees, process diagrams
 */

import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

export interface DecisionData {
  label: string;
  yesLabel?: string;
  noLabel?: string;
}

export const DecisionNode: React.FC<NodeProps<DecisionData>> = memo(
  ({ data, selected, isConnectable }) => {
    const { label, yesLabel = 'Yes', noLabel = 'No' } = data;

    return (
      <div className="relative">
        {/* Input Handle (Top) */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-800"
        />

        {/* Diamond Shape */}
        <div
          className={`
                    w-28 h-28 rotate-45 border-2 border-amber-500 
                    bg-amber-50 dark:bg-slate-800
                    flex items-center justify-center transition-all duration-200
                    ${selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}
                `}
        >
          {/* Content (rotated back) */}
          <div className="-rotate-45 text-center p-2 max-w-[80px]">
            <div className="font-medium text-sm text-slate-800 dark:text-white truncate">
              {label || 'Decision'}
            </div>
          </div>
        </div>

        {/* Yes Output (Right) */}
        <Handle
          type="source"
          position={Position.Right}
          id="yes"
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-slate-800"
          style={{ top: '50%' }}
        />
        <span className="absolute right-[-30px] top-1/2 -translate-y-1/2 text-[10px] text-green-600 dark:text-green-400 font-medium">
          {yesLabel}
        </span>

        {/* No Output (Bottom) */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="no"
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-slate-800"
        />
        <span className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-[10px] text-red-600 dark:text-red-400 font-medium">
          {noLabel}
        </span>
      </div>
    );
  }
);

DecisionNode.displayName = 'DecisionNode';

export default DecisionNode;
