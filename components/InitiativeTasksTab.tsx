import React, { useState, useEffect, useCallback } from 'react';
import { Task, User } from '../types';
import { Button } from './Button';
import { Plus, CheckCircle, Clock } from 'lucide-react';
import { TaskDetailModal } from './TaskDetailModal';
import { FullInitiative } from '../types'; // Assuming FullInitiative is defined here or needs to be imported

interface Props {
    initiativeId: string;
    users: User[];
    currentUser: User;
    initiative?: FullInitiative; // Added initiative context
}

import { Api } from '../services/api';

export const InitiativeTasksTab: React.FC<Props> = ({ initiativeId, users, currentUser, initiative }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const data = await Api.getTasks({ initiativeId });
            setTasks(data);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        } finally {
            setLoading(false);
        }
    }, [initiativeId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const handleCreateTask = async (newTask: Task) => {
        try {
            // Ensure initiativeId is set
            const taskPayload = {
                ...newTask,
                projectId: '', // Backend handles empty projectId if initiativeId is present
                initiativeId,
                title: newTask.title,
                status: newTask.status,
                priority: newTask.priority,
            };

            await Api.createTask(taskPayload);
            fetchTasks(); // Reload
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error("Failed to create task", error);
        }
    };

    const handleUpdateTask = async (updatedTask: Task) => {
        try {
            await Api.updateTask(updatedTask.id, updatedTask);
            fetchTasks(); // Reload
            setSelectedTask(null);
        } catch (error) {
            console.error("Failed to update task", error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'in_progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'blocked': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const filteredTasks = tasks.filter(t => filterStatus === 'all' || t.status === filterStatus);

    // Initial empty task for creation
    const emptyTask: Partial<Task> = {
        title: '',
        status: 'todo',
        priority: 'medium',
        taskType: 'ANALYSIS', // Default to Analysis
        initiativeId: initiativeId
    };

    const handleGenerateTasks = async () => {
        if (!initiative) return;
        setIsGenerating(true);
        try {
            const suggestedTasks = await Api.suggestTasks(initiative);
            if (Array.isArray(suggestedTasks) && suggestedTasks.length > 0) {
                for (const t of suggestedTasks) {
                    await Api.createTask({
                        title: t.title,
                        description: t.description,
                        status: 'todo',
                        priority: t.priority || 'medium',
                        projectId: '',
                        initiativeId: initiative.id,
                        taskType: t.taskType || 'ANALYSIS',
                        expectedOutcome: t.expectedOutcome || '',
                        why: t.why,
                        stepPhase: t.stepPhase
                    });
                }
                fetchTasks();
            } else {
                alert("No tasks generated");
            }
        } catch (error) {
            console.error("Failed to generate tasks", error);
            alert("AI Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-bold text-lg">Strategic Execution</h3>
                    <span className="bg-navy-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-white/5">
                        {tasks.length}
                    </span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleGenerateTasks}
                        disabled={isGenerating || !initiative}
                        className={`px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-xs font-medium flex items-center gap-2 transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isGenerating ? (
                            <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-purple-400 animate-spin" />
                        ) : (
                            <span className="text-lg">✨</span>
                        )}
                        {isGenerating ? 'Generating Plan...' : 'Generate with AI'}
                    </button>
                    <div className="flex bg-navy-950 rounded border border-white/10 p-1">
                        {['all', 'todo', 'in_progress', 'completed'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1 text-xs rounded transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                {s.replace('_', ' ').toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)} size="sm" icon={<Plus size={16} />}>
                        Add Task
                    </Button>
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {loading ? (
                    <div className="text-center py-10 text-slate-500">Loading tasks...</div>
                ) : filteredTasks.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-xl bg-navy-950/30">
                        <CheckCircle size={32} className="mx-auto mb-2 text-slate-600" />
                        <p className="text-slate-500">No tasks found. Create one to get started.</p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="bg-navy-950 border border-white/5 rounded-lg p-3 hover:border-blue-500/30 transition-colors cursor-pointer group flex items-center gap-4"
                        >
                            {/* Status Indicator */}
                            <div className={`w-2 h-full self-stretch rounded-full ${(task.status === 'completed' ? 'bg-green-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-600')}`}></div>

                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-slate-200 font-medium group-hover:text-blue-400 transition-colors">{task.title}</h4>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getStatusColor(task.status)}`}>
                                        {task.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white overflow-hidden">
                                            {task.assignee?.avatarUrl ? <img src={task.assignee.avatarUrl} className="w-full h-full object-cover" /> : (task.assignee?.firstName?.[0] || '?')}
                                        </div>
                                        {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned'}
                                    </span>
                                    {task.dueDate && (
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} /> {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                    )}
                                    <span className={`uppercase ${task.priority === 'urgent' ? 'text-red-400' : task.priority === 'high' ? 'text-orange-400' : 'text-slate-500'}`}>
                                        {task.priority}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for Edit */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    isOpen={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onSave={handleUpdateTask}
                    currentUser={currentUser}
                    users={users}
                />
            )}

            {/* Modal for Create */}
            {isCreateModalOpen && (
                <TaskDetailModal
                    task={emptyTask as Task}
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        fetchTasks();
                    }}
                    currentUser={currentUser}
                    users={users}
                    initiative={initiative} // Pass context
                />
            )}
        </div>
    );
};
