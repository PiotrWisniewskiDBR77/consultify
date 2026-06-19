import React from 'react';
import { type NodeProps } from 'reactflow';

export const GroupNode: React.FC<NodeProps> = ({ data, selected }) => (
  <div
    className={`relative w-[300px] min-h-[200px] p-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600/40 bg-slate-50/50 dark:bg-navy-900/20 dark:shadow-[0_0_18px_rgba(0,0,0,0.12)] transition-shadow ${selected ? 'ring-2 ring-slate-500/60' : ''}`}
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
      {data?.label || 'Group'}
    </div>
  </div>
);
