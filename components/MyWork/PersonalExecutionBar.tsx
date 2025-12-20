import React from 'react';
import { Task } from '../../types';
import { Target, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
    stats: {
        total: number;
        completed: number;
        overdue: number;
        blocked: number;
    };
}

export const PersonalExecutionBar: React.FC<Props> = ({ stats }) => {
    const { total, completed, overdue, blocked } = stats;

    // Simple calculation for "Execution Score"
    // Formula: (Completed / Total) * 100 - (Overdue * 5)
    const rawScore = total > 0 ? (completed / total) * 100 : 0;
    const penalty = overdue * 5;
    const score = Math.max(0, Math.round(rawScore - penalty));

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Personal Execution Score</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-navy-900 dark:text-white">{score}</span>
                        <span className="text-sm font-medium text-slate-400">/ 100</span>
                    </div>
                </div>
                <div className="flex gap-4 text-xs font-medium">
                    <div className="flex flex-col items-center">
                        <span className="text-green-500">{completed}</span>
                        <span className="text-slate-400">Done</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-red-500">{overdue}</span>
                        <span className="text-slate-400">Overdue</span>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, (completed / Math.max(1, total)) * 100)}%` }}
                />
                <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (overdue / Math.max(1, total)) * 100)}%` }}
                />
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp size={14} className="text-green-500" />
                <span>Top 10% of team this week</span>
            </div>
        </div>
    );
};
