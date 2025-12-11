import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { DashboardExecutionSnapshot } from '../components/dashboard/DashboardExecutionSnapshot';
import { OnboardingDashboard } from '../components/dashboard/OnboardingDashboard'; // Keeping for reference if needed, or remove if unused
import { LiveDashboard } from '../components/dashboard/LiveDashboard';
import { LayoutDashboard, LogOut, Map, BarChart3, Activity } from 'lucide-react';

interface UserDashboardViewProps {
    currentUser: any;
    onNavigate: (view: AppView) => void;
}

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({ currentUser, onNavigate }) => {
    const { logout, fullSessionData } = useAppStore();

    // Determine Phase
    const isEarlyPhase = !fullSessionData?.step3Completed; // Phase 1-2 (Step 1, Step 2)

    // Default Tab State
    const [manualTab, setManualTab] = useState<'overview' | 'live'>('live');
    const activeTab = isEarlyPhase ? 'overview' : manualTab;

    const handleStartTransformation = () => {
        onNavigate(AppView.FULL_STEP1_CONTEXT);
    };

    return (
        <div className="flex h-full flex-col bg-slate-50 dark:bg-navy-950">
            {/* Header */}
            <div className="h-12 px-4 lg:px-6 flex items-center justify-between bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 shrink-0 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 text-navy-900 dark:text-white font-semibold text-lg">
                        <LayoutDashboard className="text-purple-600" />
                        Transformation Dashboard
                    </div>

                    {/* Tabs - Defined in Header "Minimalist Overview" */}
                    <div className="hidden md:flex bg-slate-100 dark:bg-navy-950/50 p-1 rounded-lg border border-slate-200 dark:border-white/5">
                        <button
                            onClick={() => setManualTab('overview')}
                            disabled={isEarlyPhase}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'overview'
                                ? 'bg-white dark:bg-navy-800 text-purple-600 dark:text-purple-400 shadow-sm'
                                : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                                } ${isEarlyPhase ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Map size={16} />
                            Overview
                        </button>
                        <button
                            onClick={() => setManualTab('live')}
                            disabled={isEarlyPhase}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'live'
                                ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                                } ${isEarlyPhase ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Activity size={16} />
                            Execution Snapshot
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium text-navy-900 dark:text-white">{currentUser.firstName} {currentUser.lastName}</div>
                        <div className="text-xs text-slate-500">{currentUser.companyName}</div>
                    </div>
                    <button onClick={() => logout()} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
                {activeTab === 'overview' ? (
                    <DashboardOverview onStartModule1={handleStartTransformation} session={fullSessionData} />
                ) : (
                    <DashboardExecutionSnapshot session={fullSessionData} onNavigate={onNavigate} />
                )}
            </div>
        </div>
    );
};
