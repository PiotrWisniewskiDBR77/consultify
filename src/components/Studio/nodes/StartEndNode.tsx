/**
 * StartEndNode - Rounded start/end point
 *
 * Rounded rectangular node for flow start and end points.
 */

import { Flag, Play } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

interface StartEndData {
  label: string;
  isStart?: boolean;
}

export const StartEndNode: React.FC<NodeProps<StartEndData>> = memo(
  ({ data, selected, isConnectable }: any) => {
    const { label, isStart = true } = data;

    return (
      <div
        className={`
                min-w-[120px] px-4 py-2 rounded-full border-2 transition-all duration-200
                ${isStart ? 'border-green-500 bg-green-500/10' : 'border-danger-500 bg-danger-500/10'}
                ${selected ? 'ring-2 ring-offset-2 ring-offset-slate-900' : ''}
                ${selected && isStart ? 'ring-green-400' : ''}
                ${selected && !isStart ? 'ring-danger-400' : ''}
            `}
      >
        {/* Input Handle (only for End nodes) */}
        {!isStart && (
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            className="!w-3 !h-3 !bg-danger-500 !border-2 !border-slate-800"
          />
        )}

        {/* Content */}
        <div className="flex items-center justify-center gap-2">
          {isStart ? (
            <Play size={14} className="text-green-400" />
          ) : (
            <Flag size={14} className="text-danger-400" />
          )}
          <span className={`font-medium text-sm ${isStart ? 'text-green-400' : 'text-danger-400'}`}>
            {label || (isStart ? 'Start' : 'End')}
          </span>
        </div>

        {/* Output Handle (only for Start nodes) */}
        {isStart && (
          <Handle
            type="source"
            position={Position.Right}
            isConnectable={isConnectable}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-slate-800"
          />
        )}
      </div>
    );
  }
);

StartEndNode.displayName = 'StartEndNode';

export default StartEndNode;
