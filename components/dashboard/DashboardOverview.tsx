import React from 'react';
import { FullSession, AppView } from '../../types';
import { UserTaskList } from './UserTaskList';
import { NotificationCenter } from './NotificationCenter';
import { useAppStore } from '../../store/useAppStore';

interface DashboardOverviewProps {
    onStartModule1: () => void;
    session?: FullSession;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartModule1, session }) => {
    // We can use the global navigation from store if not passed, but UserDashboardView passes it or handles it.
    // Ideally UserTaskList needs a way to navigate.
    // Let's grab setCurrentView from store to pass down if needed, or assume the parent handles it.
    const { setCurrentView } = useAppStore();

    return (
        <div className="max-w-7xl mx-auto animate-fade-in relative z-10 w-full h-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">

                {/* Left Panel: User Tasks (Action Plan) - Spans 8 columns */}
                <div className="lg:col-span-8">
                    <UserTaskList session={session} onNavigate={setCurrentView} />
                </div>

                {/* Right Panel: Notification Center - Spans 4 columns */}
                <div className="lg:col-span-4 h-full">
                    <div className="sticky top-6 h-[calc(100vh-8rem)]">
                        <NotificationCenter />
                    </div>
                </div>

            </div>
        </div>
    );
};
