import React, { useState, useEffect } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { useAppStore } from '../store/useAppStore';
import { Task, Initiative, TaskStatus } from '../types';
import { translations } from '../translations';
import { InitiativeCard } from '../components/InitiativeCard';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { Api } from '../services/api';
import { Plus, Filter, Kanban, List as ListIcon, Sparkles, ShieldCheck } from 'lucide-react';
import { sendMessageToAI } from '../services/ai/gemini';

export const PilotExecutionView: React.FC = () => {
    const {
        currentUser, fullSessionData, setFullSessionData,
        addChatMessage: addMessage, setIsBotTyping: setTyping,
        activeChatMessages: messages
    } = useAppStore();

    const language = currentUser?.preferredLanguage || 'EN';
    const t = translations.fullExecution; // Assuming we have or will create this

    const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            if (currentUser?.organizationId) {
                try {
                    const fetchedUsers = await Api.getUsers();
                    setUsers(fetchedUsers);
                } catch (e) {
                    console.error("Failed to load initial data", e);
                }
            }
        };
        loadData();
    }, [currentUser]);

    // Initial Load - Get Initiatives in Step 4 (or 5)
    const activeInitiatives = (fullSessionData.initiatives || []) // .filter(i => i.status === 'step4' || i.status === 'step5');

    // Fetch tasks for selected initiative
    useEffect(() => {
        if (selectedInitiative) {
            // In a real app, we'd fetch from API filtering by initiativeId
            // For now, we might fetch all tasks for the org and filter locally
            fetchTasks();
        }
    }, [selectedInitiative]);

    const fetchTasks = async () => {
        if (!currentUser?.organizationId) return;
        try {
            const allTasks = await Api.getTasks();
            // Filter where initiativeId matches selectedInitiative.id
            // Or use projectId if we mapped them
            // For Demo: Just show all tasks relevant to the scope
            setTasks(allTasks);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        }
    };

    const handleTaskClick = (task: Task) => {
        setEditingTask(task);
        setIsTaskModalOpen(true);
    };

    const handleCreateTask = () => {
        const newTask: Task = {
            id: '', // handle in backend or allow empty for create
            projectId: selectedInitiative?.id || 'default', // Fallback
            organizationId: currentUser!.organizationId!,
            title: '',
            status: 'todo',
            priority: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            taskType: 'execution',
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
            fetchTasks(); // Refresh
        } catch (error) {
            console.error("Failed to save task", error);
        }
    };

    const renderKanbanColumn = (status: TaskStatus, label: string) => {
        const columnTasks = tasks.filter(t => t.status === status);
        return (
            <div className="flex-1 min-w-[280px] bg-navy-950/50 rounded-xl border border-white/5 flex flex-col h-full">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-navy-900/50 rounded-t-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h3>
                    <span className="bg-white/10 text-white text-[10px] px-1.5 py-0.5 rounded-full">{columnTasks.length}</span>
                </div>
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    {columnTasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => handleTaskClick(task)}
                            className="bg-navy-900 border border-white/5 p-3 rounded-lg hover:border-blue-500/50 cursor-pointer shadow-sm group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${task.priority === 'urgent' ? 'border-red-500/30 text-red-500' :
                                    'border-slate-500/20 text-slate-500'
                                    }`}>
                                    {task.priority}
                                </span>
                                {task.assignee && (
                                    <div className="w-5 h-5 rounded-full bg-blue-600 text-[10px] flex items-center justify-center text-white font-bold">
                                        {task.assignee.firstName[0]}
                                    </div>
                                )}
                            </div>
                            <h4 className="text-sm font-medium text-slate-200 group-hover:text-blue-300 transition-colors line-clamp-2 mb-2">
                                {task.title}
                            </h4>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{task.taskType}</span>
                                {task.budgetAllocated && <span>${task.budgetAllocated / 1000}k</span>}
                            </div>
                        </div>
                    ))}
                    {columnTasks.length === 0 && (
                        <div className="h-20 flex items-center justify-center border border-dashed border-white/5 rounded text-xs text-slate-600">
                            Empty
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleAiSuggest = async () => {
        if (!selectedInitiative) return;
        setIsGenerating(true);
        try {
            const suggestions = await Api.suggestInitiativeTasks(selectedInitiative.id);

            // Auto-save suggestions as new tasks
            for (const s of suggestions) {
                await Api.createTask({
                    projectId: selectedInitiative.id || 'default', // Fallback
                    // organizationId handled by backend
                    title: s.title,
                    description: s.description,
                    taskType: s.taskType,
                    priority: s.priority,
                    estimatedHours: s.estimatedHours,
                    status: 'todo',
                    initiativeId: selectedInitiative.id
                });
            }

            fetchTasks();
            addMessage({
                id: Date.now().toString(),
                role: 'ai',
                content: `Created ${suggestions.length} tasks for "${selectedInitiative.name}" based on AI suggestions.`,
                timestamp: new Date()
            });

        } catch (error) {
            console.error("AI Suggest Failed", error);
            addMessage({
                id: Date.now().toString(),
                role: 'ai',
                content: "Failed to generate tasks. Please try again.",
                timestamp: new Date()
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // Chat Handler
    const handleAiChat = async (text: string) => {
        // Standard chat logic (omitted for brevity, similar to others)
        addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    };

    const handleValidate = async () => {
        if (!selectedInitiative) return;
        setIsGenerating(true);
        try {
            const result = await Api.validateInitiative(selectedInitiative.id);

            const message = `**Validation Report for: ${selectedInitiative.name}**\n\n` +
                `Confidence Score: ${result.confidenceScore}%\n\n` +
                `**Risks:**\n${result.risks.map((r: string) => `- ${r}`).join('\n')}\n\n` +
                `**Recommendations:**\n${result.recommendations.map((r: string) => `- ${r}`).join('\n')}`;

            addMessage({
                id: Date.now().toString(),
                role: 'ai',
                content: message,
                timestamp: new Date()
            });

        } catch (error) {
            console.error("Validation Failed", error);
            addMessage({
                id: Date.now().toString(),
                role: 'ai',
                content: "Validation failed. Please ensure the initiative has enough data.",
                timestamp: new Date()
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <SplitLayout title="Pilot Execution Board" onSendMessage={handleAiChat}>
            <div className="w-full h-full bg-navy-900 flex flex-col overflow-hidden">

                {/* Initiative Selector Bar */}
                <div className="h-16 border-b border-white/5 flex items-center px-6 gap-4 bg-navy-800 shrink-0 overflow-x-auto">
                    <span className="text-xs uppercase font-bold text-slate-500 shrink-0">Active Programs:</span>
                    {activeInitiatives.map(init => (
                        <button
                            key={init.id}
                            onClick={() => setSelectedInitiative(init as any)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${selectedInitiative?.id === init.id
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-navy-950 border-white/10 text-slate-400 hover:text-white'
                                }`}
                        >
                            {init.name}
                        </button>
                    ))}
                    {activeInitiatives.length === 0 && (
                        <span className="text-xs text-slate-600 italic">No pilots active. Go to Step 3 to launch one.</span>
                    )}
                </div>

                {/* Main Workspace */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {selectedInitiative ? selectedInitiative.name : 'Select a Pilot Program'}
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                {selectedInitiative?.summary || "Execution Dashboard"}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-navy-950 rounded p-1 flex border border-white/5">
                                <button
                                    onClick={() => setViewMode('kanban')}
                                    className={`p-1.5 rounded ${viewMode === 'kanban' ? 'bg-navy-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Kanban size={16} />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-navy-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ListIcon size={16} />
                                </button>
                            </div>

                            {selectedInitiative && (
                                <>
                                    <button
                                        onClick={handleAiSuggest}
                                        disabled={isGenerating}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-semibold transition-colors disabled:opacity-50"
                                    >
                                        <Sparkles size={16} className={isGenerating ? "animate-spin" : ""} />
                                        {isGenerating ? 'Wait...' : 'AI Plan'}
                                    </button>
                                    <button
                                        onClick={handleValidate}
                                        disabled={isGenerating}
                                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded text-sm font-semibold transition-colors disabled:opacity-50"
                                    >
                                        <ShieldCheck size={16} />
                                        {isGenerating ? 'Wait...' : 'Validate'}
                                    </button>
                                </>
                            )}

                            <button
                                onClick={handleCreateTask}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold transition-colors"
                            >
                                <Plus size={16} /> Add Task
                            </button>
                        </div>
                    </div>

                    {/* Kanban Board */}
                    {selectedInitiative && (
                        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                            {renderKanbanColumn('todo', 'Backlog')}
                            {renderKanbanColumn('in_progress', 'In Progress')}
                            {renderKanbanColumn('review', 'Review / QA')}
                            {renderKanbanColumn('done', 'Completed')}
                        </div>
                    )}

                    {!selectedInitiative && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <Filter size={48} className="mb-4 opacity-20" />
                            <p>Select an initiative above to view its execution board.</p>
                        </div>
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
                        users={users} // Passed real users
                        language={language}
                    />
                )}

            </div>
        </SplitLayout>
    );
};
