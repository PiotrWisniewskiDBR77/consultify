import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, AlertCircle, Clock, CheckCircle, ArrowRight, Loader2, Calendar } from 'lucide-react';
import { Api } from '../services/api';
import { AppView, Task, TaskStatus, TaskPriority } from '../types';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';

export const TaskDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, overdue: 0 });
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { setCurrentView } = useAppStore();

    const fetchTasks = async () => {
        try {
            setLoading(true);
            // Fetch tasks - ideally we want "my tasks" or "pending tasks"
            // For now, fetch all and filter client side for the dropdown preview
            const allTasks = await Api.getTasks({});

            // Sort by due date (closest first)
            const sorted = allTasks.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });

            const pending = sorted.filter(t => t.status !== 'done');
            const overdue = pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date());

            setTasks(sorted.slice(0, 10)); // Show top 10 relevant
            setStats({
                total: allTasks.length,
                pending: pending.length,
                overdue: overdue.length
            });

        } catch (error) {
            console.error('Failed to fetch tasks', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
        // Poll every 60s
        const interval = setInterval(fetchTasks, 60000);
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleNavigateToTasks = () => {
        setIsOpen(false);
        setCurrentView(AppView.MY_WORK);
    };

    const getPriorityColor = (priority: TaskPriority) => {
        switch (priority) {
            case 'high': return 'text-red-500 bg-red-50 dark:bg-red-500/10';
            case 'medium': return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10';
            case 'low': return 'text-blue-500 bg-blue-50 dark:bg-blue-500/10';
            default: return 'text-slate-500 bg-slate-50 dark:bg-slate-500/10';
        }
    };

    const isOverdue = (date?: string) => {
        if (!date) return false;
        return new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();
    };

    const formatDueDate = (date?: string) => {
        if (!date) return 'No date';
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        return d.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 outline-none focus:ring-2 focus:ring-purple-500/20"
                title="Tasks"
            >
                <CheckSquare size={20} />
                {stats.pending > 0 && (
                    <span
                        className={`absolute top-0.5 right-0.5 min-w-[16px] h-4 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 border-2 border-white dark:border-navy-950 shadow-sm
                        ${stats.overdue > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                    >
                        {stats.pending > 99 ? '99+' : stats.pending}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden z-[100] transform transition-all duration-200 origin-top-right animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-black/20 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-navy-900 dark:text-white text-sm">My Action Plan</h3>
                            {stats.pending > 0 && (
                                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {stats.pending} Pending
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleNavigateToTasks}
                            className="text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors flex items-center gap-1"
                        >
                            View all <ArrowRight size={12} />
                        </button>
                    </div>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-2 text-center py-2 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                        <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Overdue</div>
                            <div className={`text-sm font-bold ${stats.overdue > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {stats.overdue}
                            </div>
                        </div>
                        <div className="border-l border-slate-200 dark:border-white/10">
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Active</div>
                            <div className="text-sm font-bold text-navy-900 dark:text-white">
                                {stats.pending}
                            </div>
                        </div>
                    </div>

                    {/* Task List */}
                    <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                <Loader2 className="animate-spin w-5 h-5 mx-auto mb-2 text-purple-500" />
                                Loading tasks...
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                    <CheckSquare size={20} className="text-slate-300" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No tasks found</p>
                                <button onClick={handleNavigateToTasks} className="text-xs text-purple-600 font-medium mt-2">Create new task</button>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-white/5">
                                {tasks.slice(0, 5).map(task => ( // Just show top 5 in dropdown
                                    <div
                                        key={task.id}
                                        className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                                        onClick={handleNavigateToTasks} // Or open detail modal if implemented
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-0.5">
                                                {task.status === TaskStatus.DONE ? (
                                                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded textxs font-bold uppercase">
                                                        <CheckCircle size={10} /> Done
                                                    </div>
                                                ) : (
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-opacity-10 ${task.status === TaskStatus.IN_PROGRESS ? 'border-blue-500 text-blue-500 bg-blue-500' :
                                                        task.status === TaskStatus.BLOCKED ? 'border-red-500 text-red-500 bg-red-500' :
                                                            'border-slate-500 text-slate-500 bg-slate-500'
                                                        }`}>
                                                        {task.status.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className={`text-sm font-medium truncate ${task.status === TaskStatus.DONE ? 'text-slate-500 line-through' : 'text-navy-900 dark:text-white'}`}>
                                                        {task.title}
                                                    </p>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${getPriorityColor(task.priority)}`}>
                                                        {task.priority || 'medium'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {task.dueDate && (
                                                        <div className={`flex items-center gap-1 ${isOverdue(task.dueDate) && task.status !== TaskStatus.DONE ? 'text-red-500 font-medium' : ''}`}>
                                                            <Calendar size={12} />
                                                            {formatDueDate(task.dueDate)}
                                                        </div>
                                                    )}
                                                    {task.assigneeId && (
                                                        <div className="flex items-center gap-1 truncate">
                                                            <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[8px] font-bold">
                                                                {/* Initials - simplified for now */}
                                                                U
                                                            </div>
                                                            {/* We don't have user name easily here without join, so skip or show generic */}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {tasks.length > 5 && (
                                    <div className="p-2 text-center bg-slate-50/50 dark:bg-white/5">
                                        <button
                                            onClick={handleNavigateToTasks}
                                            className="text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors"
                                        >
                                            View {tasks.length - 5} more tasks
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
