/**
 * MyWorkView - Unified Dashboard + My Work module
 * 65/35 layout: WorkCenter (left) + NotificationsHub (right)
 */

import { Brain } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SplitLayout } from '../components/layout/SplitLayout';
import { DecisionDetailModal } from '../components/MyWork/DecisionDetailModal';
import { NotificationsHub } from '../components/MyWork/NotificationsHub';
import { TaskDetailModal } from '../components/MyWork/TaskDetailModal';
import { WorkCenter } from '../components/MyWork/WorkCenter';
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
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Handlers
  const handleCreateTask = useCallback(() => {
    setSelectedTaskId(null);
    setIsCreateModalOpen(true);
  }, []);

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setIsCreateModalOpen(true);
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

  const handleDecisionClick = useCallback((decisionId: string) => {
    setSelectedDecisionId(decisionId);
  }, []);

  const handleDecisionClose = useCallback(() => {
    setSelectedDecisionId(null);
  }, []);

  return (
    <div data-testid="mywork-view">
      <SplitLayout
        title={
          <div className="flex items-center gap-2">
            <Brain className="text-purple-600 dark:text-purple-400" size={20} />
            <span className="text-purple-600 dark:text-purple-400">AI</span>
          </div>
        }
        subtitle={t('myWork.chatSubtitle', 'Help with tasks & planning')}
      >
        <div className="flex h-full bg-slate-100 dark:bg-navy-950 gap-0.5 overflow-hidden">
          {/* Work Center - 65% */}
          <div className="w-[65%] flex flex-col bg-white dark:bg-navy-900 shadow-sm">
            <WorkCenter
              onTaskClick={handleTaskClick}
              onCreateTask={handleCreateTask}
            />
          </div>

          {/* Notifications Hub - 35% */}
          <div className="w-[35%] flex flex-col bg-white dark:bg-navy-900 shadow-sm">
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

        {selectedDecisionId && (
          <DecisionDetailModal decisionId={selectedDecisionId} onClose={handleDecisionClose} />
        )}
      </SplitLayout>
    </div>
  );
};

export default MyWorkView;
