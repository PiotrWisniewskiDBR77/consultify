import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { DashboardExecutionSnapshot } from '../components/dashboard/DashboardExecutionSnapshot';

interface UserDashboardViewProps {
    currentUser: any;
    onNavigate: (view: AppView) => void;
}

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({ currentUser, onNavigate }) => {
    const { fullSessionData, currentView } = useAppStore();

    // Simple Render Logic based on currentView
    // Default to Overview if generic dashboard view
    const isSnapshot = currentView === AppView.DASHBOARD_SNAPSHOT;

    const handleStartTransformation = () => {
        onNavigate(AppView.FULL_STEP1_CONTEXT);
    };

    return (
        <div className="flex h-full flex-col bg-slate-50 dark:bg-navy-950">
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
                {isSnapshot ? (
                    <DashboardExecutionSnapshot session={fullSessionData} onNavigate={onNavigate} />
                ) : (
                    <DashboardOverview onStartModule1={handleStartTransformation} session={fullSessionData} />
                )}
            </div>
        </div>
    );
};
