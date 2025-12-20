import React from 'react';
import { Task, TaskStatus } from '../../types'; // Adjust legacy import path if needed
import { AlertCircle, CheckCircle, Lock } from 'lucide-react';

interface Props {
    tasks: Task[];
    teamName?: string;
}

export const TeamHealthBar: React.FC<Props> = ({ tasks, teamName = "Team" }) => {
    const total = tasks.length;
    const blocked = tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.DONE).length;

    // Health logic
    let healthStatus: 'Healthy' | 'At Risk' | 'Critical' = 'Healthy';
    let color = 'bg-green-500';

    const blockedRatio = total > 0 ? blocked / total : 0;
    const overdueRatio = total > 0 ? overdue / total : 0;

    if (blockedRatio > 0.1 || overdueRatio > 0.15) {
        healthStatus = 'Critical';
        color = 'bg-red-500';
    } else if (blockedRatio > 0.05 || overdueRatio > 0.05) {
        healthStatus = 'At Risk';
        color = 'bg-orange-500';
    }

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
                    {teamName} Health
                    <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${color}`}>
                        {healthStatus}
                    </span>
                </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-500/10 flex items-center gap-3">
                    <div className="p-1.5 bg-red-100 dark:bg-red-500/20 rounded text-red-600 dark:text-red-400">
                        <AlertCircle size={16} />
                    </div>
                    <div>
                        <div className="text-lg font-bold text-red-700 dark:text-red-400">{overdue}</div>
                        <div className="text-[10px] text-red-500 dark:text-red-400/70 uppercase font-medium">Overdue</div>
                    </div>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-100 dark:border-orange-500/10 flex items-center gap-3">
                    <div className="p-1.5 bg-orange-100 dark:bg-orange-500/20 rounded text-orange-600 dark:text-orange-400">
                        <Lock size={16} />
                    </div>
                    <div>
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-400">{blocked}</div>
                        <div className="text-[10px] text-orange-500 dark:text-orange-400/70 uppercase font-medium">Blocked</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
