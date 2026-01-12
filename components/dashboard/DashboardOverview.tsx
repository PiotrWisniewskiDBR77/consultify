import React, { useCallback } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { FullSession } from '../../types';
import { NotificationCenter } from '../MyWork/Notifications/NotificationCenter';
// import { UserTaskList } from './UserTaskList';
import { TaskInbox } from '../MyWork/TaskInbox';

interface DashboardOverviewProps {
    onStartModule1: () => void;
    session?: FullSession;
    onCreateTask?: () => void;
    onEditTask?: (id: string) => void;
    refreshTrigger?: number;
}

export const DashboardOverview = React.memo<DashboardOverviewProps>(
    ({ onStartModule1, session, onCreateTask, onEditTask }) => {
        // We can use the global navigation from store if not passed, but UserDashboardView passes it or handles it.
        // Ideally UserTaskList needs a way to navigate.
        // Let's grab setCurrentView from store to pass down if needed, or assume the parent handles it.
        const { setCurrentView } = useAppStore();

        // Handler for opening task modal from notification
        const handleOpenTaskFromNotification = useCallback(
            (taskId: string) => {
                if (onEditTask) {
                    onEditTask(taskId);
                }
            },
            [onEditTask],
        );

        return (
            <div className="max-w-7xl mx-auto animate-fade-in relative z-10 w-full h-full flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
                    {/* Left Panel: User Tasks (Action Plan) - Spans 7 columns (lepszy balans) */}
                    <div className="lg:col-span-7 flex flex-col min-h-0">
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <TaskInbox onCreateTask={onCreateTask} onEditTask={onEditTask || (() => {})} />
                        </div>
                    </div>

                    {/* Right Panel: Notification Center - Spans 5 columns (lepszy balans) */}
                    <div className="lg:col-span-5 flex flex-col min-h-0">
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <NotificationCenter onOpenTaskModal={handleOpenTaskFromNotification} />
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);
