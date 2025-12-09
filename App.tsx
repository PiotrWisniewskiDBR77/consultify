import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { WelcomeView } from './views/WelcomeView';
import { AuthView } from './views/AuthView';
import { FreeAssessmentView } from './views/FreeAssessmentView';
import { FullAssessmentView } from './views/FullAssessmentView';
import { FullInitiativesView } from './views/FullInitiativesView';
import { FullRoadmapView } from './views/FullRoadmapView';
import { FullROIView } from './views/FullROIView';
import { FullExecutionView } from './views/FullExecutionView';
import { FullReportsView } from './views/FullReportsView';
import { AdminView } from './views/AdminView';
import { SettingsView } from './views/SettingsView';
import { AppView, SessionMode, AuthStep, User, UserRole } from './types';
import { Menu, UserCircle, ChevronRight, Save } from 'lucide-react';
import { useAppStore } from './store/useAppStore';


export const App = () => {
    const {
        currentView, setCurrentView,
        sessionMode, setSessionMode,
        currentUser, setCurrentUser,
        authInitialStep, setAuthInitialStep,
        language, setLanguage,
        isSidebarOpen, setIsSidebarOpen,
        freeSessionData, setFreeSessionData,
        fullSessionData, setFullSessionData,
        logout
    } = useAppStore();

    // Init DB on first load (if needed)
    // Api backend used instead of local mock DB
    useEffect(() => {
        // Could check session here
    }, []);

    const handleStartSession = (mode: SessionMode) => {
        setSessionMode(mode);

        if (currentUser?.isAuthenticated) {
            startChat(mode);
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
        if (user.role === UserRole.ADMIN) {
            setCurrentView(AppView.ADMIN_DASHBOARD);
        } else {
            startChat(sessionMode);
        }
    };

    const startChat = (mode: SessionMode) => {
        if (mode === SessionMode.FREE) {
            setCurrentView(AppView.QUICK_STEP1_PROFILE);
        } else {
            setCurrentView(AppView.FULL_STEP1_ASSESSMENT);
        }
    };

    const isSessionView = currentView !== AppView.WELCOME && currentView !== AppView.AUTH;

    const getBreadcrumbs = () => {
        const viewParts = currentView.split('_');
        if (viewParts.includes('QUICK')) return ['Quick Assessment', `Step ${viewParts[1]?.replace('STEP', '') || '1'}`];
        if (viewParts.includes('FULL')) return ['Full Transformation', `Step ${viewParts[1]?.replace('STEP', '') || '1'}`];
        if (viewParts.includes('ADMIN')) return ['Admin Panel', viewParts[1] || 'Dashboard'];
        if (viewParts.includes('SETTINGS')) return ['Settings', viewParts[1] || 'Profile'];
        return ['Dashboard'];
    };

    const breadcrumbs = getBreadcrumbs();

    const renderContent = () => {
        if (!currentUser) return null;

        // Quick Assessment Views
        if (
            currentView === AppView.FREE_ASSESSMENT_CHAT ||
            currentView === AppView.QUICK_STEP1_PROFILE ||
            currentView === AppView.QUICK_STEP2_CHALLENGES ||
            currentView === AppView.QUICK_STEP3_RECOMMENDATIONS
        ) {
            return (
                <FreeAssessmentView
                    currentUser={currentUser}
                    sessionData={freeSessionData}
                    setSessionData={setFreeSessionData}
                    currentAppView={currentView}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Full Transformation Views - STEP 1
        if (currentView === AppView.FULL_STEP1_ASSESSMENT || currentView.startsWith('FULL_STEP1_')) {
            return (
                <FullAssessmentView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    currentAppView={currentView}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Full Transformation - STEP 2
        if (currentView === AppView.FULL_STEP2_INITIATIVES) {
            return (
                <FullInitiativesView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Full Transformation - STEP 3
        if (currentView === AppView.FULL_STEP3_ROADMAP) {
            return (
                <FullRoadmapView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Full Transformation - STEP 4
        if (currentView === AppView.FULL_STEP4_ROI) {
            return (
                <FullROIView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Full Transformation - STEP 5
        if (currentView === AppView.FULL_STEP5_EXECUTION) {
            return (
                <FullExecutionView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Full Transformation - STEP 6
        if (currentView === AppView.FULL_STEP6_REPORTS) {
            return (
                <FullReportsView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    onNavigate={setCurrentView}
                />
            );
        }

        // Admin Views
        if (currentView.startsWith('ADMIN')) {
            return (
                <AdminView
                    currentUser={currentUser}
                    onNavigate={setCurrentView}
                    language={language}
                />
            );
        }

        // Settings Views
        if (currentView.startsWith('SETTINGS')) {
            return (
                <SettingsView
                    currentUser={currentUser}
                    language={language}
                    onUpdateUser={setCurrentUser}
                />
            );
        }

        // Fallback
        return (
            <div className="w-full p-8 flex items-center justify-center text-slate-500 flex-col gap-4">
                <div className="text-2xl font-bold text-white mb-2">{currentView}</div>
                <div>Component Under Construction</div>
            </div>
        );
    };

    return (
        <div className="flex h-screen w-full bg-navy-950 text-white font-sans overflow-hidden" dir={language === 'AR' ? 'rtl' : 'ltr'}>
            {isSessionView && (
                <Sidebar />
            )}

            <main className="flex-1 flex flex-col overflow-hidden relative w-full h-full">
                {/* Top Bar for Session Views */}
                {isSessionView && (
                    <div className="h-16 border-b border-white/5 bg-navy-950 flex items-center justify-between px-6 shrink-0 z-20">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white mr-2">
                                <Menu />
                            </button>
                            <div className="flex items-center text-sm font-medium text-slate-400">
                                <span className="hover:text-white cursor-pointer transition-colors">{breadcrumbs[0]}</span>
                                <ChevronRight size={14} className="mx-2" />
                                <span className="text-white">{breadcrumbs[1]}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Save size={12} className="text-purple-500 animate-pulse" />
                                <span className="hidden sm:inline">Auto-saved</span>
                            </div>
                            <div className="h-4 w-px bg-white/10"></div>
                            <div className="flex items-center gap-2">
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-medium text-white">{currentUser?.firstName} {currentUser?.lastName}</div>
                                    <div className="text-xs text-purple-400">{currentUser?.companyName}</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-navy-800 border border-white/10 flex items-center justify-center">
                                    <UserCircle size={20} className="text-slate-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

                    {isSessionView && renderContent()}
                </div>
            </main>
        </div>
    );
};
