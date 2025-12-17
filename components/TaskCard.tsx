import React from 'react';
import { User, AlertCircle, Calendar } from 'lucide-react';
import { Task, TaskStatus } from '../types';

interface TaskCardProps {
    task: Task;
    onClick: () => void;
}

const getStatusColor = (status: TaskStatus) => {
    switch (status) {
        case 'not_started': return 'border-slate-500 text-slate-500';
        case 'in_progress': return 'border-blue-500 text-blue-500';
        case 'waiting_data':
        case 'waiting_decision': return 'border-amber-500 text-amber-500';
        case 'blocked': return 'border-red-500 text-red-500';
        case 'completed': return 'border-green-500 text-green-500';
        case 'rejected': return 'border-slate-700 text-slate-700 opacity-50';
        default: return 'border-slate-500';
    }
};

const getStatusLabel = (status: TaskStatus) => {
    return status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
    const completedChecks = task.checklist?.filter(c => c.completed).length || 0;
    const totalChecks = task.checklist?.length || 0;

    return (
        <div
            onClick={onClick}
            className={`
        bg-white dark:bg-navy-900 border rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all group shadow-sm dark:shadow-none
        ${getStatusColor(task.status).split(' ')[0]} border-opacity-30 hover:border-opacity-100
      `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getStatusColor(task.status)} bg-opacity-10`}>
                        {getStatusLabel(task.status)}
                    </span>
                    {/* Priority Badge */}
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${task.priority === 'urgent' ? 'border-red-500 text-red-500 bg-red-500/10' :
                        task.priority === 'high' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                            task.priority === 'medium' ? 'border-blue-500 text-blue-500 bg-blue-500/10' :
                                'border-slate-500 text-slate-500 bg-slate-500/10'
                        }`}>
                        {task.priority || 'Normal'}
                    </span>
                    {/* Scope Badge */}
                    {task.scope && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                            {task.scope}
                        </span>
                    )}
                </div>
                {task.priority === 'urgent' && <AlertCircle size={14} className="text-red-500" />}
            </div>

            <h4 className="text-navy-900 dark:text-white text-sm font-medium mb-1 line-clamp-2">{task.title}</h4>

            {task.why && (
                <p className="text-xs text-slate-500 italic mb-3 line-clamp-2">
                    "{task.why}"
                </p>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
                <div className="flex items-center gap-2">
                    {task.assignee ? (
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-300" title={`${task.assignee.firstName} ${task.assignee.lastName}`}>
                            {task.assignee.avatarUrl ? (
                                <img src={task.assignee.avatarUrl} alt="Avatar" className="w-4 h-4 rounded-full" />
                            ) : (
                                <User size={12} />
                            )}
                            <span className="max-w-[60px] truncate">{task.assignee.lastName}</span>
                        </div>
                    ) : (
                        <span className="text-slate-600 dark:text-slate-500 flex items-center gap-1"><User size={12} /> Unassigned</span>
                    )}
                </div>

                {task.dueDate && (
                    <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-500 dark:text-red-400' : ''}`}>
                        <Calendar size={12} />
                        <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                    </div>
                )}
            </div>

            {totalChecks > 0 && (
                <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(completedChecks / totalChecks) * 100}%` }}
                        ></div>
                    </div>
                    <span className="text-[10px] text-slate-500">{completedChecks}/{totalChecks}</span>
                </div>
            )}
        </div>
    );
};
