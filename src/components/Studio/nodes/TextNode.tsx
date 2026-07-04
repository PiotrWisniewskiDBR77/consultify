/**
 * TextNode - Simple text annotation
 *
 * Basic text node for annotations and notes.
 */

import { StickyNote } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

interface TextNodeData {
  label: string;
  color?: 'yellow' | 'blue' | 'green' | 'red' | 'purple';
}

export const TextNode: React.FC<NodeProps<TextNodeData>> = memo(
  ({ data, selected, isConnectable }: any) => {
    const { label, color = 'yellow' } = data;

    const colorClasses = {
      yellow: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
      blue: 'border-blue-500/50 bg-blue-500/10 text-blue-200',
      green: 'border-green-500/50 bg-green-500/10 text-green-200',
      red: 'border-danger-500/50 bg-danger-500/10 text-danger-200',
      purple: 'border-primary-500/50 bg-primary-500/10 text-primary-200',
    };

    return (
      <div
        className={`
                min-w-[100px] max-w-[200px] p-3 rounded-lg border transition-all duration-200
                ${(colorClasses as any)[color]}
                ${selected ? 'ring-2 ring-c-border ring-offset-2 ring-offset-slate-900' : ''}
            `}
      >
        {/* Optional connection handles */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="!w-2 !h-2 !bg-slate-50 dark:bg-navy-800/300 !border-slate-700 !opacity-50"
        />

        {/* Content */}
        <div className="flex items-start gap-2">
          <StickyNote size={14} className="shrink-0 mt-0.5 opacity-60" />
          <div className="text-xs whitespace-pre-wrap break-words">{label || 'Note'}</div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="!w-2 !h-2 !bg-slate-50 dark:bg-navy-800/300 !border-slate-700 !opacity-50"
        />
      </div>
    );
  }
);

TextNode.displayName = 'TextNode';

export default TextNode;
