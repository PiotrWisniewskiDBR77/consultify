/**
 * RACICell - RACI Matrix cell
 *
 * Cell node for RACI (Responsible, Accountable, Consulted, Informed) matrices.
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';

interface RACICellData {
  value: 'R' | 'A' | 'C' | 'I' | '';
  task?: string;
  role?: string;
  isHeader?: boolean;
  headerType?: 'task' | 'role';
}

export const RACICell: React.FC<NodeProps<RACICellData>> = memo(({ data, selected }: any) => {
  const { value, task, role, isHeader = false, headerType } = data;

  const valueColors = {
    R: 'bg-blue-500/30 text-blue-400 border-blue-500/50',
    A: 'bg-danger-500/30 text-danger-400 border-danger-500/50',
    C: 'bg-amber-500/30 text-amber-400 border-amber-500/50',
    I: 'bg-green-500/30 text-green-400 border-green-500/50',
    '': 'bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-600/50',
  };

  const valueLabels = {
    R: 'Responsible',
    A: 'Accountable',
    C: 'Consulted',
    I: 'Informed',
    '': '-',
  };

  if (isHeader) {
    return (
      <div
        className={`
                    w-32 h-12 flex items-center justify-center border transition-all duration-200
                    ${
                      headerType === 'task'
                        ? 'bg-slate-700 border-slate-600 text-white font-medium'
                        : 'bg-slate-800 border-slate-700 text-slate-600 font-medium -rotate-45'
                    }
                    ${selected ? 'ring-2 ring-c-border ring-offset-1 ring-offset-slate-900' : ''}
                `}
      >
        <span className="text-xs truncate px-2">{headerType === 'task' ? task : role}</span>
      </div>
    );
  }

  return (
    <div
      className={`
                w-16 h-16 flex items-center justify-center border-2 rounded-md
                transition-all duration-200 ${(valueColors as any)[value]}
                ${selected ? 'ring-2 ring-c-border ring-offset-1 ring-offset-slate-900' : ''}
            `}
      title={(valueLabels as any)[value]}
    >
      <span className="text-2xl font-bold">{value || '-'}</span>
    </div>
  );
});

RACICell.displayName = 'RACICell';

export default RACICell;
