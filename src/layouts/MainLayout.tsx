import { ChevronRight, Menu, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AIFreezeBanner } from '../components/AIFreezeBanner';
import { DocumentSidePanel } from '../components/documents/DocumentSidePanel';
import { DocumentToggleButton } from '../components/documents/DocumentToggleButton';
import { FeedbackSidePanel } from '../components/Feedback/FeedbackSidePanel';
import { FeedbackToggleButton } from '../components/Feedback/FeedbackToggleButton';
import { HelpSidePanel } from '../components/Help/HelpSidePanel';
import { HelpToggleButton } from '../components/Help/HelpToggleButton';
import { NotificationDropdown } from '../components/layout/NotificationDropdown';
import { Sidebar } from '../components/navigation/Sidebar';
import { UserProfileMenu } from '../components/layout/UserProfileMenu';
import { LLMSelector } from '../components/LLMSelector';
import { BottomNavigation } from '../components/navigation/BottomNavigation';
import { PMOStatusBar } from '../components/PMO/PMOStatusBar';
import { SystemHealth } from '../components/SystemHealth';
import { TaskDropdown } from '../components/TaskDropdown';
import { TrialBanner } from '../components/Trial/TrialBanner';
import { TrialExpiredGate } from '../components/Trial/TrialExpiredGate';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

interface MainLayoutProps {
    children: React.ReactNode;
    breadcrumbs: string[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, breadcrumbs }) => {
    const { isSidebarCollapsed, setIsSidebarOpen, isChatCollapsed, toggleChatCollapse, currentUser } = useAppStore();

    // Only show sidebar/header for actual app views, not Welcome/Auth
    const isSessionView = true; // MainLayout is only used for session views

    return (
        <div className="flex h-screen w-full bg-slate-100 dark:bg-navy-950 text-navy-900 dark:text-white font-sans overflow-hidden">
            {/* Global Floating Help Buttons */}
            <div className="fixed right-0 top-[66%] z-50 flex flex-col gap-3 items-end translate-x-0 pointer-events-none">
                <div className="pointer-events-auto">
                    <HelpToggleButton />
                </div>
                <div className="pointer-events-auto">
                    <DocumentToggleButton />
                </div>
                <div className="pointer-events-auto">
                    <FeedbackToggleButton />
                </div>
            </div>
            <HelpSidePanel />
            <DocumentSidePanel />
            <FeedbackSidePanel />

            {/* Impersonation Banner */}
            {currentUser?.impersonatorId && (
                <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white z-50 flex items-center justify-center gap-4 text-sm font-medium shadow-md">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        Impersonating Mode
                    </span>
                </div>
            )}

            <div className={currentUser?.isDemo ? 'pt-10' : ''}>
                <Sidebar />
            </div>

            <BottomNavigation />

            <main
                className={`
                    flex-1 flex flex-col overflow-hidden relative w-full h-full transition-all duration-300
                    ${isSidebarCollapsed ? 'lg:ltr:pl-16 lg:rtl:pr-16' : 'lg:ltr:pl-64 lg:rtl:pr-64'}
                    ${currentUser?.isDemo ? 'mt-10' : ''}
                    pb-16 md:pb-0
                `}
            >
                {/* Header */}
                <div className="flex flex-col z-30 shrink-0">
                    <AIFreezeBanner />
                    <TrialBanner />

                    <div className="h-12 border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm dark:shadow-none flex items-center justify-between px-3 transition-colors duration-300">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="lg:hidden text-navy-700 dark:text-white mr-2"
                            >
                                <Menu />
                            </button>
                            <div className="flex items-center text-sm font-medium text-slate-400">
                                <span className="hover:text-navy-900 dark:hover:text-white cursor-pointer transition-colors">
                                    {breadcrumbs[0]}
                                </span>
                                <ChevronRight size={14} className="mx-2 rtl:rotate-180" />
                                <span className="text-navy-900 dark:text-white">{breadcrumbs[1]}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <SystemHealth />
                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                            <LLMSelector />
                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

                            <button
                                onClick={() => toggleChatCollapse()}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg font-medium text-xs transition-all
                                    ${
                                        isChatCollapsed
                                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30'
                                            : 'text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                                title={isChatCollapsed ? 'Show AI Chat' : 'Hide AI Chat'}
                            >
                                <Sparkles size={16} />
                                <span>AI</span>
                            </button>
                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

                            <TaskDropdown />
                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                            <NotificationDropdown />

                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

                            <UserProfileMenu />
                        </div>
                    </div>
                </div>

                <TrialExpiredGate>
                    <PMOStatusBar />
                    <div className="flex-1 overflow-hidden relative flex flex-col">{children}</div>
                </TrialExpiredGate>
            </main>
        </div>
    );
};
