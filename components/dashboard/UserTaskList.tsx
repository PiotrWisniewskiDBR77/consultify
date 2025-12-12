import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ArrowRight, Play, FileText, BarChart, MoveRight, Lock } from 'lucide-react';
import { FullSession, AppView } from '../../types';

interface UserTaskListProps {
    session?: FullSession;
    onNavigate?: (view: AppView) => void;
}

interface Task {
    id: string;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'completed' | 'blocked';
    stepPhase: string;
    taskType: string;
    dueDate?: string;
}

export const UserTaskList: React.FC<UserTaskListProps> = ({ session, onNavigate }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3005/api/tasks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Failed to fetch tasks', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleNavigate = (task: Task) => {
        if (onNavigate) {
            if (task.stepPhase === 'design') onNavigate(AppView.FULL_STEP1_CONTEXT);
            else if (task.stepPhase === 'pilot') onNavigate(AppView.FULL_STEP4_PILOT); // Assumed fallback if ROI not available
            else onNavigate(AppView.FULL_STEP1_CONTEXT);
        }
    };

    const getIcon = (task: Task) => {
        if (task.taskType === 'analytical') return <BarChart size={20} />;
        if (task.taskType === 'execution') return <Play size={20} />;
        return <FileText size={20} />;
    };

    const getTimeEstimate = (task: Task) => {
        return '45 min';
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-navy-900 dark:text-white">My Action Plan</h2>
                <p className="text-slate-500 dark:text-slate-400">Complete these steps to advance your transformation journey.</p>
            </div>

            <div className="space-y-4">
                {loading && <div className="text-center p-8 text-slate-400">Loading tasks...</div>}
                {!loading && tasks.length === 0 && <div className="text-center p-8 text-slate-500">No pending tasks. Great job!</div>}

                {tasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    const isActive = task.status === 'in_progress' || task.status === 'todo';

                    return (
                        <div
                            key={task.id}
                            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${isActive
                                ? 'bg-white dark:bg-navy-800 border-blue-500 shadow-lg shadow-blue-500/10 scale-[1.01]'
                                : 'bg-slate-50 dark:bg-navy-900/50 border-slate-200 dark:border-white/5 opacity-80'
                                }`}
                        >
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>}

                            <div className="p-6 flex items-start gap-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isActive
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                    }`}>
                                    {isCompleted ? <CheckCircle2 size={24} /> : getIcon(task)}
                                </div>

                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className={`text-lg font-bold ${isActive ? 'text-navy-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {task.title}
                                        </h3>
                                        {isActive && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/20 text-xs font-semibold text-blue-600 dark:text-blue-300">
                                                <Clock size={12} /> {getTimeEstimate(task)}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm leading-relaxed max-w-2xl">
                                        {task.description}
                                    </p>

                                    <div className="flex items-center gap-4">
                                        {isActive ? (
                                            <button
                                                onClick={() => handleNavigate(task)}
                                                className="flex items-center gap-2 bg-navy-900 dark:bg-blue-600 hover:bg-navy-800 dark:hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                            >
                                                Start Task
                                                <ArrowRight size={16} />
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                                                <CheckCircle2 size={16} />
                                                <span>Completed</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/10 flex gap-4 mt-8">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <Play size={20} className="fill-current" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-1">How it works</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Follow the active tasks above to systematically unlock new modules.
                            Each step is designed to build upon the previous one, ensuring a comprehensive
                            transformation strategy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Local Clock component since it might be missing in older lucide versions or causing issues
const Clock = ({ size, className }: { size: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);
