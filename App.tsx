import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { translations } from './translations';
import { WelcomeView } from './views/WelcomeView';
import { AuthView } from './views/AuthView';
import { FreeAssessmentView } from './views/FreeAssessmentView';
import { FullAssessmentView } from './views/FullAssessmentView';
import { FullInitiativesView } from './views/FullInitiativesView';
import { FullRoadmapView } from './views/FullRoadmapView';
import { FullROIView } from './views/FullROIView';

import { FullExecutionView } from './views/FullExecutionView';
import { FullPilotView } from './views/FullPilotView';
import { FullRolloutView } from './views/FullRolloutView';
import { FullReportsView } from './views/FullReportsView';
import { AdminView } from './views/admin/AdminView';
import { SettingsView } from './views/SettingsView';
import { SuperAdminView } from './views/superadmin/SuperAdminView';
import { UserDashboardView } from './views/UserDashboardView';
import { Module1ContextView } from './views/Module1ContextView';
import { AppView, SessionMode, AuthStep, User, UserRole } from './types';
import { Menu, UserCircle, ChevronRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Api } from './services/api';
import { LLMSelector } from './components/LLMSelector';
import { NotificationDropdown } from './components/NotificationDropdown';
import { AutoSaveProvider, useAutoSave } from './src/context/AutoSaveContext';

const AppContent = () => {
    const {
        currentView, setCurrentView,
        sessionMode, setSessionMode,
        currentUser, setCurrentUser,
        authInitialStep, setAuthInitialStep,
        language, setLanguage,
        isSidebarOpen, setIsSidebarOpen,
        isSidebarCollapsed, // Added for layout adjustment
        // setFreeSessionData,
        fullSessionData, setFullSessionData,
        logout,
        theme, toggleTheme
    } = useAppStore();

    const { status } = useAutoSave();

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    useEffect(() => {
        // Auto-redirect SuperAdmin on load/change
        if (currentUser?.role === 'SUPERADMIN') {
            // Force rendering SuperAdminView
        }
    }, [currentUser]);

    // FIX: Reset to WELCOME if user is not authenticated but current view requires auth
    useEffect(() => {
        const publicViews = [AppView.WELCOME, AppView.AUTH];
        const isPublicView = publicViews.includes(currentView);

        if (!currentUser && !isPublicView) {
            setCurrentView(AppView.WELCOME);
        }
    }, [currentUser, currentView, setCurrentView]);

    const handleStartSession = (mode: SessionMode) => {
        setSessionMode(mode);

        if (currentUser?.isAuthenticated) {
            // If user is already logged in, go to dashboard logic
            if (currentUser.role === 'SUPERADMIN') setCurrentView(AppView.ADMIN_DASHBOARD);
            else if (currentUser.role === UserRole.ADMIN) setCurrentView(AppView.ADMIN_DASHBOARD);
            else setCurrentView(AppView.USER_DASHBOARD);
            return;
        }

        if (mode === SessionMode.FREE) {
            setAuthInitialStep(AuthStep.REGISTER);
            setCurrentView(AppView.AUTH);
        } else {
            setAuthInitialStep(AuthStep.CODE_ENTRY);
            setCurrentView(AppView.AUTH);
        }
    };

    const handleLoginRequest = () => {
        setSessionMode(SessionMode.FREE);
        setAuthInitialStep(AuthStep.LOGIN);
        setCurrentView(AppView.AUTH);
    };

    const handleAuthSuccess = (user: User) => {
        setCurrentUser({ ...user, preferredLanguage: language });

        // Redirect logic
        if (user.role === 'SUPERADMIN') {
            setCurrentView(AppView.ADMIN_DASHBOARD);
        } else if (user.role === UserRole.ADMIN) {
            setCurrentView(AppView.ADMIN_DASHBOARD);
        } else {
            // Regular User -> Dashboard to select project
            setCurrentView(AppView.USER_DASHBOARD);
        }
    };

    const handleStopImpersonation = async () => {
        try {
            const { token } = await Api.revertImpersonation();
            localStorage.setItem('token', token);
            // Force reload to pick up pure admin context
            window.location.href = '/';
        } catch (err) {
            console.error(err);
            // Fallback to logout
            logout();
            setCurrentView(AppView.WELCOME);
        }
    };

    // const startChat = (mode: SessionMode) => {
    //     if (mode === SessionMode.FREE) {
    //         setCurrentView(AppView.QUICK_STEP1_PROFILE);
    //     } else {
    //         setCurrentView(AppView.FULL_STEP1_ASSESSMENT);
    //     }
    // };

    const isSessionView = currentView !== AppView.WELCOME &&
        currentView !== AppView.AUTH &&
        currentView !== AppView.USER_DASHBOARD &&
        currentUser?.role !== 'SUPERADMIN';

    const getBreadcrumbs = () => {
        const t = translations.sidebar;
        const lang = language;

        const viewParts = currentView.split('_');

        let section = 'Dashboard';
        let sub = '';

        if (viewParts.includes('QUICK')) {
            section = t.quickAssessment[lang];
            const stepNum = viewParts[1]?.replace('STEP', '') || '1';
            sub = `${translations.step1.subtitle[lang]} ${stepNum}`;
        } else if (viewParts.includes('FULL')) {
            section = t.fullProject[lang];
            const stepNum = viewParts[1]?.replace('STEP', '') || '1';
            // Maybe map step names?
            if (viewParts.includes('STEP1')) sub = t.fullStep1[lang];
            else if (viewParts.includes('STEP2')) sub = t.fullStep2[lang];
            else if (viewParts.includes('STEP3')) sub = t.fullStep3[lang];
            else if (viewParts.includes('STEP4')) sub = t.fullStep4[lang];
            else if (viewParts.includes('STEP5')) sub = t.fullStep5[lang];
            else if (viewParts.includes('STEP6')) sub = t.fullStep6[lang];
            else sub = `${t.fullProject[lang]} ${stepNum}`;
        } else if (viewParts.includes('ADMIN')) {
            section = 'Admin Panel'; // TODO: add to translations
            sub = viewParts[1] || 'Dashboard';
        } else if (viewParts.includes('SETTINGS')) {
            section = t.settings[lang];
            sub = viewParts[1] || 'Profile';
        } else if (currentView === AppView.USER_DASHBOARD) {
            section = t.dashboard[lang];
        } else if (currentView === AppView.DASHBOARD_OVERVIEW) {
            section = t.dashboard[lang];
            sub = 'Overview';
        } else if (currentView === AppView.DASHBOARD_SNAPSHOT) {
            section = t.dashboard[lang];
            sub = 'Execution Snapshot';
        }

        return [section, sub];
    };

    const breadcrumbs = getBreadcrumbs();

    const renderContent = () => {
        if (!currentUser) return null;

        // --- SUPER ADMIN INTERCEPT ---
        if (currentUser.role === 'SUPERADMIN') {
            return (
                <SuperAdminView
                    currentUser={currentUser}
                    onNavigate={(view) => {
                        if (view === AppView.WELCOME) {
                            logout();
                            setCurrentView(AppView.WELCOME);
                        } else {
                            setCurrentView(view);
                        }
                    }}
                />
            );
        }

        // --- USER Dashboard ---
        if (
            currentView === AppView.USER_DASHBOARD ||
            currentView === AppView.DASHBOARD ||
            currentView === AppView.DASHBOARD_OVERVIEW ||
            currentView === AppView.DASHBOARD_SNAPSHOT
        ) {
            return <UserDashboardView currentUser={currentUser} onNavigate={setCurrentView} />;
        }

        // Quick Assessment Views
        if (
            currentView === AppView.FREE_ASSESSMENT_CHAT ||
            currentView === AppView.QUICK_STEP1_PROFILE ||
            currentView === AppView.QUICK_STEP2_USER_CONTEXT ||
            currentView === AppView.QUICK_STEP3_EXPECTATIONS
        ) {
            return (
                <FreeAssessmentView />
            );
        }

        // ... (Removing misplaced import)

        // ... existing code

        // Full Transformation Views
        if (currentView === AppView.FULL_STEP1_CONTEXT) {
            return <Module1ContextView currentUser={currentUser} fullSession={fullSessionData} setFullSession={setFullSessionData} onNavigate={setCurrentView} />;
        }
        if (currentView === AppView.FULL_STEP1_ASSESSMENT || currentView.startsWith('FULL_STEP1_')) {
            return <FullAssessmentView />;
        }
        if (currentView === AppView.FULL_STEP2_INITIATIVES) {
            return <FullInitiativesView />;
        }
        if (currentView === AppView.FULL_STEP3_ROADMAP) {
            return <FullRoadmapView />;
        }
        if (currentView === AppView.FULL_STEP4_ROI) {
            return <FullROIView />;
        }
        if (currentView === AppView.FULL_STEP5_EXECUTION) {
            return <FullExecutionView />;
        }
        if (currentView === AppView.FULL_PILOT_EXECUTION) {
            return <FullPilotView />;
        }
        if (currentView === AppView.FULL_ROLLOUT) {
            return <FullRolloutView />;
        }
        if (currentView === AppView.FULL_STEP6_REPORTS) {
            return <FullReportsView />;
        }

        // Admin Views
        if (currentView.startsWith('ADMIN')) {
            return <AdminView currentUser={currentUser} onNavigate={setCurrentView} language={language} />;
        }

        // Settings Views
        if (currentView.startsWith('SETTINGS')) {
            return (
                <SettingsView
                    currentUser={currentUser}
                    language={language}
                    onUpdateUser={(updates) => setCurrentUser(currentUser ? { ...currentUser, ...updates } : null)}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    setLanguage={setLanguage}
                />
            );
        }

        return (
            <div className="w-full p-8 flex items-center justify-center text-slate-500 flex-col gap-4">
                <div className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{currentView}</div>
                <div>Component Under Construction</div>
            </div>
        );
    };

    return (
        <ErrorBoundary>
            <div className="flex h-screen w-full bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white font-sans overflow-hidden" dir={language === 'AR' ? 'rtl' : 'ltr'}>
                <Toaster position="bottom-right" />

                {/* Impersonation Banner */}
                {currentUser?.impersonatorId && (
                    <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white z-50 flex items-center justify-center gap-4 text-sm font-medium shadow-md">
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            IMPERSONATING: {currentUser.email}
                        </span>
                        <button
                            onClick={handleStopImpersonation}
                            className="bg-white text-red-600 px-3 py-0.5 rounded text-xs font-bold hover:bg-red-50 transition-colors uppercase"
                        >
                            Stop Impersonating
                        </button>
                    </div>
                )}

                {isSessionView && (
                    <Sidebar />
                )}

                {/* 
                    Main Content Area
                    - We use conditional left padding (ltr) or right padding (rtl) to make room for fixed sidebar
                    - w-16 (64px) when UNPINNED (Mini)
                    - w-64 (256px) when PINNED (Full)
                    - lg:pl-xx handles desktop only. Mobile uses overlay so pl-0 usually.
                 */}
                <main
                    className={`
                        flex-1 flex flex-col overflow-hidden relative w-full h-full transition-all duration-300
                        ${isSessionView ? (isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64') : ''}
                    `}
                >
                    {/* Top Bar for Session Views */}
                    {isSessionView && (
                        <div className="h-12 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex items-center justify-between px-3 shrink-0 z-20 transition-colors duration-300">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-navy-700 dark:text-white mr-2">
                                    <Menu />
                                </button>
                                <div className="flex items-center text-sm font-medium text-slate-400">
                                    <span className="hover:text-navy-900 dark:hover:text-white cursor-pointer transition-colors">{breadcrumbs[0]}</span>
                                    <ChevronRight size={14} className="mx-2" />
                                    <span className="text-navy-900 dark:text-white">{breadcrumbs[1]}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500 min-w-[100px] justify-end">
                                    {status === 'saved' && (
                                        <>
                                            <CheckCircle size={12} className="text-green-500" />
                                            <span className="hidden sm:inline text-green-600 dark:text-green-400">Auto-saved</span>
                                        </>
                                    )}
                                    {status === 'saving' && (
                                        <>
                                            <Loader2 size={12} className="text-purple-500 animate-spin" />
                                            <span className="hidden sm:inline text-purple-500">Saving...</span>
                                        </>
                                    )}
                                    {status === 'unsaved' && (
                                        <>
                                            <AlertCircle size={12} className="text-amber-500" />
                                            <span className="hidden sm:inline text-amber-500">Unsaved changes</span>
                                        </>
                                    )}
                                    {status === 'error' && (
                                        <>
                                            <AlertCircle size={12} className="text-red-500" />
                                            <span className="hidden sm:inline text-red-500">Save failed</span>
                                        </>
                                    )}
                                </div>

                                <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                                <LLMSelector />
                                <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

                                <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                                <NotificationDropdown />

                                <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

                                <button
                                    onClick={() => setCurrentView(AppView.SETTINGS_PROFILE as AppView)}
                                    className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg p-1 transition-colors cursor-pointer text-left"
                                >
                                    <div className="text-right hidden md:block">
                                        <div className="text-xs font-semibold text-navy-900 dark:text-white">{currentUser?.firstName} {currentUser?.lastName}</div>
                                        <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider">{currentUser?.companyName}</div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                                        {currentUser?.avatarUrl ? (
                                            <img src={currentUser.avatarUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <UserCircle size={20} className="text-slate-400" />
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* If SuperAdmin, simple full screen container logic is handled inside SuperAdminView which expects full height */}
                    {currentUser?.role === 'SUPERADMIN' ? (
                        renderContent()
                    ) : (
                        <div className="flex-1 overflow-hidden relative flex flex-col">
                            {currentView === AppView.WELCOME && (
                                <WelcomeView
                                    onStartSession={handleStartSession}
                                    onLoginClick={handleLoginRequest}
                                    language={language}
                                    onLanguageChange={setLanguage}
                                />
                            )}

                            {currentView === AppView.AUTH && (
                                <AuthView
                                    initialStep={authInitialStep}
                                    targetMode={sessionMode}
                                    onAuthSuccess={handleAuthSuccess}
                                    onBack={() => setCurrentView(AppView.WELCOME)}
                                    language={language}
                                />
                            )}

                            {(currentView !== AppView.WELCOME && currentView !== AppView.AUTH) && renderContent()}
                        </div>
                    )}
                </main>
            </div>
        </ErrorBoundary>
    );
};

export const App = () => (
    <AutoSaveProvider>
        <AppContent />
    </AutoSaveProvider>
);

