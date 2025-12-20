import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, CheckSquare, Users, BarChart2, Bell, Plus, Filter, Brain, FileQuestion } from 'lucide-react';
import { SplitLayout } from '../components/SplitLayout';
import { TodayDashboard } from '../components/MyWork/TodayDashboard';
import { TaskInbox } from '../components/MyWork/TaskInbox';
import { WorkloadView } from '../components/MyWork/WorkloadView';
import { NotificationSettings } from '../components/MyWork/NotificationSettings';
import { ProgressView } from '../components/MyWork/ProgressView';
import { TaskDetailModal } from '../components/MyWork/TaskDetailModal';
import { DecisionsPanel } from '../components/MyWork/DecisionsPanel';
import { LocationFilter } from '../components/MyWork/LocationFilter'; // CRIT-04
import { usePMOContext } from '../hooks/usePMOContext';

type Tab = 'today' | 'inbox' | 'decisions' | 'workload' | 'progress' | 'settings';

export const MyWorkView: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('today');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [locationFilter, setLocationFilter] = useState<string[]>([]); // CRIT-04

    // Initialize PMO context - auto-fetches when project changes
    usePMOContext();

    const tabs = [
        { id: 'today', label: t('myWork.tabs.today', 'Today'), icon: LayoutDashboard },
        { id: 'inbox', label: t('myWork.tabs.inbox', 'Inbox'), icon: CheckSquare },
        { id: 'decisions', label: t('myWork.tabs.decisions', 'Decisions'), icon: FileQuestion },
        { id: 'workload', label: t('myWork.tabs.workload', 'Workload'), icon: Users },
        { id: 'progress', label: t('myWork.tabs.progress', 'Progress'), icon: BarChart2 },
        { id: 'settings', label: t('myWork.tabs.settings', 'Notifications'), icon: Bell },
    ];

    const handleCreateTask = () => {
        setSelectedTaskId(null);
        setIsCreateModalOpen(true);
    };

    const handleEditTask = (taskId: string) => {
        setSelectedTaskId(taskId);
        setIsCreateModalOpen(true);
    };

    // CRIT-04: Handle location filter change
    const handleLocationChange = (ids: string[]) => {
        setLocationFilter(ids);
        setRefreshTrigger(prev => prev + 1); // Trigger refresh with new filter
    };

    return (
        <SplitLayout
            title={
                <div className="flex items-center gap-2">
                    <Brain className="text-purple-600 dark:text-purple-400" size={20} />
                    <span className="text-purple-600 dark:text-purple-400">AI</span>
                </div>
            }
            subtitle={t('myWork.chatSubtitle', 'Help with tasks & planning')}
        >
            <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            {t('myWork.title', 'My Work')}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('myWork.subtitle', 'Manage your tasks, team workload, and personal progress')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {/* CRIT-04: Location Filter */}
                        <LocationFilter
                            selectedIds={locationFilter}
                            onChange={handleLocationChange}
                        />
                        <button
                            onClick={handleCreateTask}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                        >
                            <Plus size={18} />
                            {t('myWork.newTask', 'New Task')}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-6 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`
                                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                                ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white'}
                            `}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="mx-auto max-w-7xl h-full">
                        {activeTab === 'today' && <TodayDashboard onEditTask={handleEditTask} onCreateTask={handleCreateTask} refreshTrigger={refreshTrigger} />}
                        {activeTab === 'inbox' && <TaskInbox onEditTask={handleEditTask} onCreateTask={handleCreateTask} />}
                        {activeTab === 'decisions' && <DecisionsPanel />}
                        {activeTab === 'workload' && <WorkloadView />}
                        {activeTab === 'progress' && <ProgressView />}
                        {activeTab === 'settings' && <NotificationSettings />}
                    </div>
                </div>

                {/* Task Create/Edit Modal */}
                {isCreateModalOpen && (
                    <TaskDetailModal
                        taskId={selectedTaskId}
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        onTaskSaved={() => {
                            setRefreshTrigger(prev => prev + 1);
                            setIsCreateModalOpen(false);
                        }}
                    />
                )}
            </div>
        </SplitLayout>
    );
};
