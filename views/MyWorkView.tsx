/**
 * MyWorkView - Unified Dashboard + My Work module
 * 65/35 layout: WorkCenter (left) + NotificationsHub (right)
 */

import { Brain } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NotificationsHub } from '../components/MyWork/NotificationsHub';
import { TaskDetailModal } from '../components/MyWork/TaskDetailModal';
import { WorkCenter } from '../components/MyWork/WorkCenter';
import { SplitLayout } from '../components/SplitLayout';
import { AppView } from '../types';

interface MyWorkViewProps {
    currentUser?: {
        id: string;
        name?: string;
        email?: string;
    };
    onNavigate?: (view: string) => void;
}

export const MyWorkView: React.FC<MyWorkViewProps> = ({ currentUser, onNavigate }) => {
    const { t } = useTranslation();

    // Task modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Handlers
    const handleCreateTask = useCallback(() => {
        setSelectedTaskId(null);
        setIsCreateModalOpen(true);
    }, []);

    const handleTaskClick = useCallback((taskId: string) => {
        setSelectedTaskId(taskId);
        setIsCreateModalOpen(true);
    }, []);

    const handleDecisionClick = useCallback((decisionId: string) => {
        // Could open decision detail modal or navigate
        console.log('Decision clicked:', decisionId);
    }, []);

    const handleCreateDecision = useCallback(() => {
        // Could open decision creation modal
        console.log('Create decision');
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsCreateModalOpen(false);
        setSelectedTaskId(null);
    }, []);

    const handleTaskSaved = useCallback(() => {
        setIsCreateModalOpen(false);
        setSelectedTaskId(null);
        // TasksList will auto-refresh via its own useEffect
    }, []);

    return (
        <>
            <SplitLayout
                title={
                    <div className="flex items-center gap-2">
                        <Brain className="text-purple-600 dark:text-purple-400" size={20} />
                        <span className="text-purple-600 dark:text-purple-400">AI</span>
                    </div>
                }
                subtitle={t('myWork.chatSubtitle', 'Help with tasks & planning')}
            >
                <div className="flex h-full bg-slate-50 dark:bg-navy-950 overflow-hidden">
                    {/* Work Center - 65% */}
                    <div className="w-[65%] flex flex-col border-r border-slate-200 dark:border-white/10">
                        <WorkCenter
                            onTaskClick={handleTaskClick}
                            onDecisionClick={handleDecisionClick}
                            onCreateTask={handleCreateTask}
                            onCreateDecision={handleCreateDecision}
                        />
                    </div>

                    {/* Notifications Hub - 35% */}
                    <div className="w-[35%] flex flex-col">
                        <NotificationsHub onOpenTask={handleTaskClick} onOpenDecision={handleDecisionClick} />
                    </div>
                </div>

                {/* Task Create/Edit Modal */}
                {isCreateModalOpen && (
                    <TaskDetailModal
                        taskId={selectedTaskId}
                        isOpen={isCreateModalOpen}
                        onClose={handleCloseModal}
                        onTaskSaved={handleTaskSaved}
                    />
                )}
            </SplitLayout>

            <div className="mt-8 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/5 dark:bg-navy-900/60">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                                Partner Program
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-navy-900 dark:text-white">Partner Portal</h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Zainspiruj partnerów firm szkoleniowych, software house’ów i konsultantów. Wszystkie
                                zasoby w jednym miejscu, wzorowanym na HubSpot.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => onNavigate?.(AppView.PARTNER_PROVIDER_HOME)}
                            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/40 transition hover:bg-brand-dark"
                        >
                            Otwórz portal partnerów
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MyWorkView;
