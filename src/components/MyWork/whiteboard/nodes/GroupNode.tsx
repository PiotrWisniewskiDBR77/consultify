import React from 'react';
import { type NodeProps } from 'reactflow';

export const GroupNode: React.FC<NodeProps> = ({ data, selected }) => (
  <div
    className={`relative w-[300px] min-h-[200px] p-2 rounded-2xl border-2 border-dashed border-c-border bg-c-surface-raised dark:shadow-[0_0_18px_rgba(0,0,0,0.12)] transition-shadow ${selected ? 'ring-2 ring-c-border-strong' : ''}`}
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted px-1">
      {data?.label || 'Group'}
    </div>
  </div>
);
