import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { DashboardExecutionSnapshot } from '../components/dashboard/DashboardExecutionSnapshot';
import { TaskDetailModal } from '../components/MyWork/TaskDetailModal';
import { GateStatus } from '../components/PMO/GateStatus'; // CRIT-01
import { PMOHealthSection } from '../components/PMO/PMOHealthSection'; // Step A: PMO Health
import { SplitLayout } from '../components/SplitLayout';
import { useTranslation } from 'react-i18next';

interface UserDashboardViewProps {
    currentUser: any;
    onNavigate: (view: AppView) => void;
}

import { useScreenContext } from '../hooks/useScreenContext';

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({ currentUser, onNavigate }) => {
    const { fullSessionData, currentView, addChatMessage: addMessage, activeChatMessages: messages, setIsBotTyping: setTyping, currentProjectId } = useAppStore();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { t } = useTranslation();

    // Simple Render Logic based on currentView
    // Default to Overview if generic dashboard view
    const isSnapshot = currentView === AppView.DASHBOARD_SNAPSHOT;

    // Register Context for AI
    useScreenContext(
        'user_dashboard',
        isSnapshot ? 'Execution Snapshot' : 'Executive Dashboard',
        {
            mode: isSnapshot ? 'Snapshot' : 'Overview',
            projectStatus: fullSessionData?.step5Completed ? 'Execution' : (fullSessionData?.step3Completed ? 'Roadmap' : 'Planning'),
            keyMetrics: fullSessionData?.kpiResults || {}
        },
        "User is reviewing their transformation progress and high-level KPIs."
    );

    const handleStartTransformation = () => {
        onNavigate(AppView.FULL_STEP1_CONTEXT);
    };

    const handleCreateTask = () => {
        setSelectedTaskId(null);
        setIsCreateModalOpen(true);
    };

    const handleEditTask = (taskId: string) => {
        setSelectedTaskId(taskId);
        setIsCreateModalOpen(true);
    };

    const handleAiChat = async (text: string) => {
        addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    };

    // Step C: Handle "Explain This" click from PMO Health section
    const handleExplainPMO = (snapshot: any) => {
        const prompt = `Explain the current PMO situation for project "${snapshot.projectName}":

**Current Phase:** ${snapshot.phase.name} (${snapshot.phase.number}/6)
**Gate Status:** ${snapshot.stageGate.isReady ? 'Ready' : `Not Ready - ${snapshot.stageGate.missingCriteria.length} criteria missing`}
**Blockers:** ${snapshot.blockers.length} items blocking progress
**Overdue Tasks:** ${snapshot.tasks.overdueCount}
**Pending Decisions:** ${snapshot.decisions.pendingCount}

Please explain:
1. What is blocking progress (bullets)
2. What to do next (ordered steps)
3. Who should act on each item`;

        addMessage({ id: Date.now().toString(), role: 'user', content: prompt, timestamp: new Date() });
    };

    return (
        <SplitLayout
            title={t('dashboard.chatTitle', 'Executive Assistant')}
            subtitle={t('dashboard.chatSubtitle', 'Strategic guidance & insights')}
            onSendMessage={handleAiChat}
        >
            <div className="flex h-full flex-col bg-slate-50 dark:bg-navy-950">
                <div className="flex-1 p-2 lg:p-4 overflow-auto">
                    {/* Step A: PMO Health Section - canonical health snapshot */}
                    {currentProjectId && (
                        <div className="mb-4">
                            <PMOHealthSection
                                projectId={currentProjectId}
                                onExplainClick={handleExplainPMO}
                            />
                        </div>
                    )}

                    {/* CRIT-01: Gate Status - shows progression blockers */}
                    {currentProjectId && (
                        <div className="mb-4">
                            <GateStatus
                                projectId={currentProjectId}
                                compact={false}
                                onProceed={() => setRefreshTrigger(prev => prev + 1)}
                            />
                        </div>
                    )}

                    {isSnapshot ? (
                        <DashboardExecutionSnapshot session={fullSessionData} onNavigate={onNavigate} />
                    ) : (
                        <DashboardOverview
                            onStartModule1={handleStartTransformation}
                            session={fullSessionData}
                            onCreateTask={handleCreateTask}
                            onEditTask={handleEditTask}
                            refreshTrigger={refreshTrigger}
                        />
                    )}
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

