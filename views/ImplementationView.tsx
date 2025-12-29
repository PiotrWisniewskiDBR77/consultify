/**
 * ImplementationView - Implementation Module (Module 4: Wdrożenie)
 * 
 * The heart of PMO - comprehensive view for managing executing initiatives.
 * Includes: Executive Dashboard, Kanban, Tasks, Decisions, RAID, Budget, Resources
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Task, Initiative, InitiativeStatus, TaskStatus } from '../types';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { Api } from '../services/api';
import { 
    Plus, Filter, Kanban, List as ListIcon, Sparkles, ShieldCheck, 
    LayoutDashboard, Target, AlertTriangle, DollarSign, Users, 
    Calendar, FileText, ArrowRight, ChevronDown, Rocket,
    Clock, CheckCircle2, Pause, MoreHorizontal, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Import implementation components
import { ExecutiveDashboard } from '../components/Implementation/ExecutiveDashboard';
import { InitiativeKanban } from '../components/Implementation/InitiativeKanban';
import { DecisionBoard } from '../components/Implementation/DecisionBoard';
import { RAIDLog } from '../components/Implementation/RAIDLog';
import { BudgetTrackingView } from '../components/Implementation/BudgetTrackingView';
import { CapacityView } from '../components/Implementation/CapacityView';
import { StatusReportBuilder } from '../components/Implementation/StatusReportBuilder';

type TabId = 'dashboard' | 'kanban' | 'tasks' | 'decisions' | 'raid' | 'budget' | 'resources' | 'reports';

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactNode;
}

const TABS: Tab[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'kanban', label: 'Initiatives', icon: <Kanban size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <ListIcon size={16} /> },
    { id: 'decisions', label: 'Decisions', icon: <Target size={16} /> },
    { id: 'raid', label: 'RAID Log', icon: <AlertTriangle size={16} /> },
    { id: 'budget', label: 'Budget', icon: <DollarSign size={16} /> },
    { id: 'resources', label: 'Resources', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
];

export const ImplementationView: React.FC = () => {
    const {
        currentUser, fullSessionData, setFullSessionData,
        addChatMessage: addMessage, setIsBotTyping: setTyping,
        activeChatMessages: messages
    } = useAppStore();

    const language = currentUser?.preferredLanguage || 'EN';
    
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);

    // Fetch initiatives
    const fetchInitiatives = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await Api.get('/initiatives');
            const executableInits = (response.initiatives || []).filter(
                (i: Initiative) => i.status === 'EXECUTING' || i.status === 'BLOCKED'
            );
            setInitiatives(executableInits);
        } catch (e) {
            console.error("Failed to load initiatives", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchInitiatives();
        const loadUsers = async () => {
            try {
                const fetchedUsers = await Api.getUsers();
                setUsers(fetchedUsers);
            } catch (e) {
                console.error("Failed to load users", e);
            }
        };
        loadUsers();
    }, [fetchInitiatives]);

    // Fetch tasks for selected initiative
    const fetchTasks = useCallback(async () => {
        if (!currentUser?.organizationId) return;
        try {
            const url = selectedInitiative 
                ? `/tasks?initiativeId=${selectedInitiative.id}`
                : '/tasks';
            const response = await Api.get(url);
            setTasks(response.tasks || []);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        }
    }, [currentUser, selectedInitiative]);

    useEffect(() => {
        if (activeTab === 'tasks') {
            fetchTasks();
        }
    }, [activeTab, selectedInitiative, fetchTasks]);

    const handleInitiativeClick = (init: Initiative) => {
        setSelectedInitiative(init);
        setActiveTab('tasks');
    };

    const handleTaskClick = (task: Task) => {
        setEditingTask(task);
        setIsTaskModalOpen(true);
    };

    const handleCreateTask = () => {
        const newTask: Task = {
            id: '',
            projectId: selectedInitiative?.id || 'default',
            organizationId: currentUser!.organizationId!,
            title: '',
            status: TaskStatus.TODO,
            priority: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            taskType: 'EXECUTION',
            initiativeId: selectedInitiative?.id
        };
        setEditingTask(newTask);
        setIsTaskModalOpen(true);
    };

    const handleSaveTask = async (task: Task) => {
        try {
            if (task.id) {
                await Api.updateTask(task.id, task);
            } else {
                await Api.createTask(task);
            }
            toast.success('Task saved');
            fetchTasks();
        } catch (error) {
            console.error("Failed to save task", error);
            toast.error('Failed to save task');
        }
    };

    const handleStageChange = async (initiativeId: string, newStage: string) => {
        try {
            await Api.put(`/initiatives/${initiativeId}`, { currentStage: newStage });
            fetchInitiatives();
        } catch (err) {
            console.error('Failed to update stage', err);
        }
    };

    // Render Tasks Tab
    const renderTasksTab = () => {
        const tasksByStatus = {
            [TaskStatus.TODO]: tasks.filter(t => t.status === TaskStatus.TODO),
            [TaskStatus.IN_PROGRESS]: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
            [TaskStatus.BLOCKED]: tasks.filter(t => t.status === TaskStatus.BLOCKED),
            [TaskStatus.DONE]: tasks.filter(t => t.status === TaskStatus.DONE),
        };

        const renderColumn = (status: TaskStatus, label: string, color: string) => (
            <div className="flex-1 min-w-[280px] bg-slate-50 dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col h-full">
                <div className={`p-3 border-b border-slate-200 dark:border-white/5 flex justify-between items-center ${color} rounded-t-xl`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-inherit">{label}</h3>
                    <span className="bg-white/20 text-inherit text-[10px] px-1.5 py-0.5 rounded-full">
                        {tasksByStatus[status].length}
                    </span>
                </div>
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    {tasksByStatus[status].map(task => (
                        <div
                            key={task.id}
                            onClick={() => handleTaskClick(task)}
                            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 p-3 rounded-lg hover:border-purple-400 dark:hover:border-purple-500/50 cursor-pointer shadow-sm group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                    task.priority === 'urgent' || task.priority === 'high'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                    {task.priority}
                                </span>
                                {task.assignee && (
                                    <div className="w-5 h-5 rounded-full bg-purple-600 text-[10px] flex items-center justify-center text-white font-bold">
                                        {task.assignee.firstName[0]}
                                    </div>
                                )}
                            </div>
                            <h4 className="text-sm font-medium text-navy-900 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2 mb-2">
                                {task.title}
                            </h4>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>{task.taskType}</span>
                                {task.dueDate && (
                                    <span className="flex items-center gap-1">
                                        <Clock size={10} />
                                        {new Date(task.dueDate).toLocaleDateString('pl-PL')}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    {tasksByStatus[status].length === 0 && (
                        <div className="h-20 flex items-center justify-center border border-dashed border-slate-200 dark:border-white/5 rounded text-xs text-slate-400">
                            Empty
                        </div>
                    )}
                </div>
            </div>
        );

        return (
            <div className="flex-1 flex flex-col">
                {/* Initiative filter */}
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Filter by initiative:</span>
                    <select
                        value={selectedInitiative?.id || ''}
                        onChange={(e) => {
                            const init = initiatives.find(i => i.id === e.target.value);
                            setSelectedInitiative(init || null);
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white text-sm"
                    >
                        <option value="">All Initiatives</option>
                        {initiatives.map(init => (
                            <option key={init.id} value={init.id}>{init.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleCreateTask}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> Add Task
                    </button>
                </div>

                {/* Kanban columns */}
                <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {renderColumn(TaskStatus.TODO, 'Backlog', 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400')}
                    {renderColumn(TaskStatus.IN_PROGRESS, 'In Progress', 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400')}
                    {renderColumn(TaskStatus.BLOCKED, 'Blocked', 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400')}
                    {renderColumn(TaskStatus.DONE, 'Completed', 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400')}
                </div>
            </div>
        );
    };

    // Render Budget Tab
    const renderBudgetTab = () => (
        <BudgetTrackingView
            initiativeId={selectedInitiative?.id}
            initiativeName={selectedInitiative?.name}
        />
    );

    // Render Resources Tab
    const renderResourcesTab = () => (
        <CapacityView
            projectId={selectedInitiative?.projectId}
            initiativeId={selectedInitiative?.id}
        />
    );

    // Render Reports Tab
    const renderReportsTab = () => (
        <StatusReportBuilder
            initiativeId={selectedInitiative?.id}
            initiativeName={selectedInitiative?.name}
        />
    );

    // Render active tab content
    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <ExecutiveDashboard 
                        onInitiativeClick={handleInitiativeClick}
                        onViewAllClick={() => setActiveTab('kanban')}
                    />
                );
            case 'kanban':
                return (
                    <InitiativeKanban
                        initiatives={initiatives}
                        onInitiativeClick={handleInitiativeClick}
                        onStageChange={handleStageChange}
                    />
                );
            case 'tasks':
                return renderTasksTab();
            case 'decisions':
                return (
                    <DecisionBoard 
                        initiativeId={selectedInitiative?.id}
                        onDecisionClick={(decision) => console.log('Decision clicked:', decision)}
                    />
                );
            case 'raid':
                return (
                    <RAIDLog 
                        initiativeId={selectedInitiative?.id}
                        onItemClick={(item) => console.log('RAID item clicked:', item)}
                    />
                );
            case 'budget':
                return renderBudgetTab();
            case 'resources':
                return renderResourcesTab();
            case 'reports':
                return renderReportsTab();
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            <Rocket size={24} className="text-purple-600 dark:text-purple-400" />
                            Implementation Center
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Manage executing initiatives, tasks, decisions, and risks
                        </p>
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-navy-900 dark:text-white">
                                {initiatives.filter(i => i.status === 'EXECUTING').length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Active</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {initiatives.filter(i => i.status === 'BLOCKED').length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Blocked</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {Math.round(
                                    initiatives.reduce((sum, i) => sum + (i.progress || 0), 0) / 
                                    Math.max(initiatives.length, 1)
                                )}%
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Progress</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                    </div>
                ) : (
                    renderTabContent()
                )}
            </div>

            {/* Task Modal */}
            {editingTask && (
                <TaskDetailModal
                    task={editingTask}
                    isOpen={isTaskModalOpen}
                    onClose={() => setIsTaskModalOpen(false)}
                    onSave={handleSaveTask}
                    currentUser={currentUser!}
                    users={users}
                    language={language}
                />
            )}
        </div>
    );
};

