import { AlertCircle, CheckCircle, Lock } from 'lucide-react';
import React from 'react';

import { Task, TaskStatus } from '../../types'; // Adjust legacy import path if needed

interface Props {
  tasks: Task[];
  teamName?: string;
}

export const TeamHealthBar: React.FC<Props> = ({ tasks, teamName = 'Team' }) => {
  const total = tasks.length;
  const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
  const overdue = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.DONE
  ).length;

  // Health logic
  let healthStatus: 'Healthy' | 'At Risk' | 'Critical' = 'Healthy';
  let color = 'bg-green-500';

  const blockedRatio = total > 0 ? blocked / total : 0;
  const overdueRatio = total > 0 ? overdue / total : 0;

  if (blockedRatio > 0.1 || overdueRatio > 0.15) {
    healthStatus = 'Critical';
    color = 'bg-rose-500';
  } else if (blockedRatio > 0.05 || overdueRatio > 0.05) {
    healthStatus = 'At Risk';
    color = 'bg-amber-500';
  }

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
          {teamName} Health
          <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${color}`}>
            {healthStatus}
          </span>
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-rose-50 dark:bg-rose-900/10 p-2 rounded border border-rose-100 dark:border-rose-500/10 flex items-center gap-3">
          <div className="p-1.5 bg-rose-100 dark:bg-rose-500/20 rounded text-rose-600 dark:text-rose-400">
            <AlertCircle size={16} />
          </div>
          <div>
            <div className="text-lg font-bold text-rose-700 dark:text-rose-400">{overdue}</div>
            <div className="text-[10px] text-rose-500 dark:text-rose-400/70 uppercase font-medium">
              Overdue
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 p-2 rounded border border-amber-100 dark:border-amber-500/10 flex items-center gap-3">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-500/20 rounded text-amber-600 dark:text-amber-400">
            <Lock size={16} />
          </div>
          <div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{blocked}</div>
            <div className="text-[10px] text-amber-500 dark:text-amber-400/70 uppercase font-medium">
              Blocked
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
