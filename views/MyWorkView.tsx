import React, { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Target, 
    Inbox, 
    CheckSquare, 
    FileQuestion, 
    BarChart2, 
    Settings, 
    Plus, 
    Brain,
    Loader2
} from 'lucide-react';
import { SplitLayout } from '../components/SplitLayout';
// New PMO components
import { FocusBoard } from '../components/MyWork/Focus/FocusBoard';
import { InboxTriage } from '../components/MyWork/Inbox/InboxTriage';
// Legacy components (kept for backward compatibility)
import { TodayDashboard } from '../components/MyWork/TodayDashboard';
import { TaskInbox } from '../components/MyWork/TaskInbox';
import { WorkloadView } from '../components/MyWork/WorkloadView';
import { NotificationSettings } from '../components/MyWork/NotificationSettings';
import { ProgressView } from '../components/MyWork/ProgressView';
import { TaskDetailModal } from '../components/MyWork/TaskDetailModal';
import { DecisionsPanel } from '../components/MyWork/DecisionsPanel';
import { LocationFilter } from '../components/MyWork/LocationFilter';
import { usePMOContext } from '../hooks/usePMOContext';
import { useInbox } from '../hooks/useInbox';

// Tab types - new PMO structure
type Tab = 'focus' | 'inbox' | 'tasks' | 'decisions' | 'dashboard' | 'preferences';

export const MyWorkView: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('focus');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [locationFilter, setLocationFilter] = useState<string[]>([]);

    // Initialize PMO context
    usePMOContext();
    
    // Get inbox counts for badge
    const { totalCount: inboxCount, criticalCount } = useInbox({ autoLoad: true });

    // New PMO tab structure
    const tabs = [
        { id: 'focus', label: t('myWork.tabs.focus', 'Focus'), icon: Target },
        { id: 'inbox', label: t('myWork.tabs.inbox', 'Inbox'), icon: Inbox, badge: inboxCount > 0 ? inboxCount : undefined, critical: criticalCount > 0 },
        { id: 'tasks', label: t('myWork.tabs.tasks', 'All Tasks'), icon: CheckSquare },
        { id: 'decisions', label: t('myWork.tabs.decisions', 'Decisions'), icon: FileQuestion },
        { id: 'dashboard', label: t('myWork.tabs.dashboard', 'Dashboard'), icon: BarChart2 },
        { id: 'preferences', label: t('myWork.tabs.preferences', 'Preferences'), icon: Settings },
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

                {/* Tabs with badges */}
                <div className="flex px-6 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 shrink-0 overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`
                                relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                ${activeTab === tab.id
                                    ? 'border-brand text-brand dark:text-brand'
                                    : 'border-transparent text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white'}
                            `}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {/* Badge for inbox */}
                            {'badge' in tab && tab.badge && (
                                <span className={`
                                    ml-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center
                                    ${tab.critical 
                                        ? 'bg-red-500 text-white' 
                                        : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'}
                                `}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="mx-auto max-w-7xl h-full">
                        {/* New PMO Focus Board */}
                        {activeTab === 'focus' && (
                            <FocusBoard
                                onTaskClick={handleEditTask}
                                onTaskComplete={() => setRefreshTrigger(prev => prev + 1)}
                            />
                        )}
                        
                        {/* New Inbox Triage */}
                        {activeTab === 'inbox' && (
                            <InboxTriage
                                onItemClick={(item) => {
                                    if (item.linkedTaskId) {
                                        handleEditTask(item.linkedTaskId);
                                    }
                                }}
                            />
                        )}
                        
                        {/* Legacy Tasks View (enhanced with filters) */}
                        {activeTab === 'tasks' && (
                            <TaskInbox 
                                onEditTask={handleEditTask} 
                                onCreateTask={handleCreateTask} 
                            />
                        )}
                        
                        {/* Decisions Panel */}
                        {activeTab === 'decisions' && <DecisionsPanel />}
                        
                        {/* Dashboard - combines Progress and Workload */}
                        {activeTab === 'dashboard' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ProgressView />
                                <WorkloadView />
                            </div>
                        )}
                        
                        {/* Preferences / Notification Settings */}
                        {activeTab === 'preferences' && <NotificationSettings />}
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
