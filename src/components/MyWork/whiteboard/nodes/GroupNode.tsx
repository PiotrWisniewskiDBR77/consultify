import React from 'react';
import { type NodeProps } from 'reactflow';

export const GroupNode: React.FC<NodeProps> = ({ data, selected }) => (
  <div
    className={`relative w-[300px] min-h-[200px] p-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-primary-500/30 bg-slate-50/50 dark:bg-primary-950/20 dark:shadow-[0_0_18px_rgba(99,102,241,0.12)] transition-shadow ${selected ? 'ring-2 ring-primary-500/60' : ''}`}
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-primary-300/70 px-1">
      {data?.label || 'Group'}
    </div>
  </div>
);
