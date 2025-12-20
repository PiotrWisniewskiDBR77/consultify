import React, { useEffect, useState } from 'react';
import {
    CheckCircle2, Circle, AlertTriangle, ArrowRight,
    Filter, Trash2, Plus, Calendar, User, Clock, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';
import { Task } from '../../types';

interface TaskInboxProps {
    onEditTask: (id: string) => void;
    onCreateTask?: () => void;
}

export const TaskInbox: React.FC<TaskInboxProps> = ({ onEditTask, onCreateTask }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePriority, setActivePriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
    const [openFilter, setOpenFilter] = useState<'priority' | 'status' | null>(null);

    const toggleFilter = (filter: 'priority' | 'status') => {
        setOpenFilter(prev => prev === filter ? null : filter);
    };

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const data = await Api.getTasks();
            // Sort by priority/date? For now just date desc if available or created at
            setTasks(data || []);
        } catch (error) {
            console.error('Failed to fetch tasks', error);
            // toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleStatusChange = async (task: Task, newStatus: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        try {
            await Api.updateTask(task.id, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as any } : t));
            toast.success('Task updated');
        } catch (error) {
            console.error('Failed to update task', error);
            toast.error('Failed to update task');
        }
    };

    const handleDelete = async (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await Api.deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            toast.success('Task deleted');
        } catch (error) {
            console.error('Failed to delete task', error);
            toast.error('Failed to delete task');
        }
    };

    const getPriorityColor = (priority?: string) => {
        switch (priority?.toLowerCase()) {
            case 'urgent':
            case 'high': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
            case 'medium': return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
            case 'low': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
            default: return 'text-slate-500 bg-slate-50 dark:bg-slate-800';
        }
    };

    const filteredTasks = tasks.filter(t => {
        // Priority Filter
        if (activePriority !== 'all' && (t.priority || 'medium').toLowerCase() !== activePriority) return false;

        // Status Filter
        if (activeStatus !== 'all') {
            const isDone = ['done', 'completed', 'validated'].includes(t.status?.toLowerCase() || '');
            if (activeStatus === 'done' && !isDone) return false;

            const isInProgress = ['in_progress', 'validating'].includes(t.status?.toLowerCase() || '');
            if (activeStatus === 'in_progress' && !isInProgress) return false;

            const isTodo = ['todo', 'ready', 'open', 'not_started'].includes(t.status?.toLowerCase() || '');
            if (activeStatus === 'todo' && !isTodo) return false;
        }

        return true;
    });

    const getCardStyle = (task: Task) => {
        const priority = task.priority?.toLowerCase() || 'medium';
        const isDone = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');

        let borderClass = 'border-slate-100';

        if (priority === 'urgent' && !isDone) {
            borderClass = 'border-l-4 border-l-red-500 border-slate-200 dark:border-white/10 bg-red-50/20 dark:bg-red-900/10';
        } else if (isDone) {
            borderClass = 'border-transparent bg-transparent opacity-75 hover:bg-slate-50 dark:hover:bg-white/5';
        } else {
            borderClass = 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-purple-200 dark:hover:border-purple-500/30 shadow-sm dark:shadow-[0_0_15px_rgba(168,85,247,0.05)]';
        }

        return `group p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${borderClass}`;
    };

    return (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg shadow-sm">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-navy-900 dark:text-white">My Tasks</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Manage your action plan</p>
                        </div>
                    </div>
                    <button
                        onClick={onCreateTask}
                        className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                        <Plus size={14} />
                        New Task
                    </button>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2">
                    {/* Priority Filter */}
                    <div className="relative">
                        <button
                            onClick={() => toggleFilter('priority')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activePriority !== 'all'
                                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-white/10 dark:text-slate-300'
                                }`}
                        >
                            <span className="opacity-70">Priority:</span>
                            <span className="capitalize">{activePriority}</span>
                            <Filter size={12} className="opacity-50" />
                        </button>

                        {openFilter === 'priority' && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>
                                <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'high', label: 'High', color: 'text-red-600' },
                                        { id: 'medium', label: 'Medium', color: 'text-orange-600' },
                                        { id: 'low', label: 'Low', color: 'text-blue-600' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setActivePriority(opt.id as any);
                                                setOpenFilter(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 ${activePriority === opt.id ? 'font-semibold bg-slate-50 dark:bg-white/5' : ''
                                                } ${opt.color || 'text-slate-700 dark:text-slate-200'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${opt.id === 'all' ? 'bg-slate-400' : opt.id === 'high' ? 'bg-red-500' : opt.id === 'medium' ? 'bg-orange-500' : 'bg-blue-500'} `}></div>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <button
                            onClick={() => toggleFilter('status')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeStatus !== 'all'
                                ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-300'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-white/10 dark:text-slate-300'
                                }`}
                        >
                            <span className="opacity-70">Status:</span>
                            <span className="capitalize">{activeStatus.replace('_', ' ')}</span>
                            <Filter size={12} className="opacity-50" />
                        </button>

                        {openFilter === 'status' && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>
                                <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    {[
                                        { id: 'all', label: 'Any Status' },
                                        { id: 'todo', label: 'To Do' },
                                        { id: 'in_progress', label: 'In Progress' },
                                        { id: 'done', label: 'Done' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setActiveStatus(opt.id as any);
                                                setOpenFilter(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${activeStatus === opt.id ? 'font-semibold bg-slate-50 dark:bg-white/5 text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-200'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {loading && (
                    <div className="text-center p-8">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-xs text-slate-400">Syncing tasks...</p>
                    </div>
                )}

                {!loading && filteredTasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 opacity-50">
                        <CheckCircle2 size={32} className="mb-3" />
                        <p className="text-sm">No tasks found</p>
                        <button onClick={onCreateTask} className="mt-2 text-xs text-blue-500 hover:underline">Create one?</button>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {filteredTasks.map((task) => {
                        const isDone = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
                        return (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                onClick={() => onEditTask(task.id)}
                                className={getCardStyle(task)}
                            >
                                <div className="flex gap-4">
                                    {/* Checkbox / Status Icon */}
                                    <div className="shrink-0 mt-1">
                                        <button
                                            onClick={(e) => handleStatusChange(task, isDone ? 'todo' : 'completed', e)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDone
                                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-500 dark:bg-navy-800 dark:border-white/10'
                                                }`}
                                        >
                                            {isDone ? <CheckCircle size={18} /> : <Circle size={18} />}
                                        </button>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <div className="flex flex-col gap-0.5">
                                                {task.initiativeName && (
                                                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded w-fit font-medium">
                                                        {task.initiativeName}
                                                    </span>
                                                )}
                                                <h4 className={`text-sm font-semibold truncate ${isDone ? 'text-slate-400 line-through' : 'text-navy-900 dark:text-white'}`}>
                                                    {task.title}
                                                </h4>
                                            </div>
                                            {task.dueDate && (
                                                <div className={`flex items-center gap-1 text-[10px] whitespace-nowrap ${new Date(task.dueDate) < new Date() && !isDone ? 'text-red-500' : 'text-slate-400'
                                                    }`}>
                                                    <Calendar size={10} />
                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2 line-clamp-1">
                                            {task.why || task.description || 'No description'}
                                        </p>

                                        {/* Metadata Row */}
                                        <div className="flex items-center gap-3">
                                            {/* Priority Badge */}
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
                                                <AlertTriangle size={8} />
                                                <span className="capitalize">{task.priority || 'Normal'}</span>
                                            </span>

                                            {/* Assignee */}
                                            {task.assignee && (
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                    <User size={10} />
                                                    <span className="truncate max-w-[80px]">{task.assignee.lastName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hover Actions */}
                                    <div className="shrink-0 flex flex-col justify-center items-end opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                                        <button
                                            onClick={(e) => handleDelete(task.id, e)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="Delete Task"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};
