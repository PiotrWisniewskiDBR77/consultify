import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RouterSync } from './components/RouterSync';
const PublicReportView = React.lazy(() => import('./views/reports/PublicReportView'));
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { useTranslation } from 'react-i18next';
// FAZA 5: Frontend Metrics
import { frontendMetrics } from './utils/frontendMetrics';
import { PublicLandingPage } from './views/PublicLandingPage';
import { WelcomeView } from './views/WelcomeView';
import { ProductEntryPage } from './views/ProductEntryPage';
import { AuthView } from './views/AuthView';
import TrialEntryView from './views/TrialEntryView.tsx';
import AffiliateDashboardView from './views/AffiliateDashboardView.tsx';
import { FreeAssessmentView } from './views/FreeAssessmentView';
// OPTIMIZED: Lazy load large views for code splitting
const FullAssessmentView = React.lazy(() => import('./views/FullAssessmentView').then(m => ({ default: m.FullAssessmentView })));
const FullInitiativesView = React.lazy(() => import('./views/FullInitiativesView').then(m => ({ default: m.FullInitiativesView })));
const FullRoadmapView = React.lazy(() => import('./views/FullRoadmapView').then(m => ({ default: m.FullRoadmapView })));
const FullROIView = React.lazy(() => import('./views/FullROIView').then(m => ({ default: m.FullROIView })));
const FullExecutionView = React.lazy(() => import('./views/FullExecutionView').then(m => ({ default: m.FullExecutionView })));
const FullPilotView = React.lazy(() => import('./views/FullPilotView').then(m => ({ default: m.FullPilotView })));
const FullRolloutView = React.lazy(() => import('./views/FullRolloutView').then(m => ({ default: m.FullRolloutView })));
const FullReportsView = React.lazy(() => import('./views/FullReportsView').then(m => ({ default: m.FullReportsView })));
const AdminView = React.lazy(() => import('./views/admin/AdminView').then(m => ({ default: m.AdminView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const SuperAdminView = React.lazy(() => import('./views/superadmin/SuperAdminView').then(m => ({ default: m.SuperAdminView })));
const UserDashboardView = React.lazy(() => import('./views/UserDashboardView').then(m => ({ default: m.UserDashboardView })));
const Module1ContextView = React.lazy(() => import('./views/Module1ContextView').then(m => ({ default: m.Module1ContextView })));
const ContextBuilderView = React.lazy(() => import('./views/ContextBuilder/ContextBuilderView').then(m => ({ default: m.ContextBuilderView })));
const MyWorkView = React.lazy(() => import('./views/MyWorkView').then(m => ({ default: m.MyWorkView })));
const ActionProposalView = React.lazy(() => import('./views/ActionProposalView').then(m => ({ default: m.ActionProposalView })));
import { AppView, SessionMode, AuthStep, User, UserRole } from './types';
import { Menu, UserCircle, ChevronRight, CheckCircle, CheckSquare, Loader2, AlertCircle, LogOut, Settings, CreditCard, Cpu, Sun, Moon, Monitor, Languages } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Api } from './services/api';
import { LLMSelector } from './components/LLMSelector';
import { NotificationDropdown } from './components/NotificationDropdown';
import { TaskDropdown } from './components/TaskDropdown';
import { AutoSaveProvider, useAutoSave } from './src/context/AutoSaveContext';
import { SystemHealth } from './components/SystemHealth';
import { ChatOverlay } from './components/AIChat/ChatOverlay';
import { AIProvider } from './contexts/AIContext';
import { PMOStatusBar } from './components/PMO';
import { usePMOContext } from './hooks/usePMOContext';
import { HelpProvider, useHelpPanel } from './contexts/HelpContext';
import HelpButton from './components/HelpButton';
import HelpPanel from './components/HelpPanel';
import { TrialProvider } from './contexts/TrialContext';
import { TrialBanner } from './components/Trial/TrialBanner';
import { TrialExpiredGate } from './components/Trial/TrialExpiredGate';
import { AccessPolicyProvider } from './contexts/AccessPolicyContext';
import { TourProvider } from './components/Onboarding/TourProvider';
import { AIFreezeBanner } from './components/AIFreezeBanner';


// Help system wrapper component
const HelpButtonWrapper = () => {
    const { isPanelOpen, openPanel, closePanel } = useHelpPanel();
    return (
        <>
            <HelpButton onClick={openPanel} />
            <HelpPanel isOpen={isPanelOpen} onClose={closePanel} />
        </>
    );
};

// Lazy load views
const OnboardingWizard = React.lazy(() => import('./views/OnboardingWizard').then(module => ({ default: module.OnboardingWizard }))); // NEW
const OrgSetupWizard = React.lazy(() => import('./views/OrgSetupWizard').then(module => ({ default: module.OrgSetupWizard }))); // Phase D
const ConsultantPanelView = React.lazy(() => import('./src/views/consultant/ConsultantPanelView').then(module => ({ default: module.ConsultantPanelView })));
const ConsultantInviteView = React.lazy(() => import('./src/views/consultant/ConsultantInviteView').then(module => ({ default: module.ConsultantInviteView })));

const PageTransition: React.FC<{ children: React.ReactNode, id: string }> = ({ children, id }) => (
    <motion.div
        key={id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="h-full w-full"
    >
        {children}
    </motion.div>
);

const AppContent: React.FC = () => {
    const {
        currentView, setCurrentView,
        sessionMode, setSessionMode,
        currentUser, setCurrentUser,
        authInitialStep, setAuthInitialStep,
        setIsSidebarOpen,
        isSidebarCollapsed,
        // setFreeSessionData,
        fullSessionData, setFullSessionData,
        logout,
        theme, toggleTheme
    } = useAppStore();

    // ... (rest of hook calls)



    // Initialize PMO context for session views
    const pmoContext = usePMOContext();

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const { t, i18n } = useTranslation();
    const { status } = useAutoSave();

    // Handle RTL
    useEffect(() => {
        document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    }, [i18n.language]);

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

    // FAZA 5: Initialize frontend metrics tracking
    useEffect(() => {
        // Web Vitals are auto-initialized, but we can track component renders here
        if (process.env.NODE_ENV === 'development') {
            console.log('[Metrics] Frontend metrics initialized');
        }
    }, []);

    // FIX: Reset to WELCOME if user is not authenticated but current view requires auth
    useEffect(() => {
        const publicViews = [AppView.WELCOME, AppView.AUTH, AppView.FREE_ASSESSMENT_CHAT, AppView.QUICK_STEP1_PROFILE, AppView.QUICK_STEP2_USER_CONTEXT, AppView.QUICK_STEP3_EXPECTATIONS];
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
            window.history.pushState({}, '', '/demo');
            setAuthInitialStep(AuthStep.REGISTER);
            setCurrentView(AppView.AUTH);
        } else {
            window.history.pushState({}, '', '/trial/start');
            setAuthInitialStep(AuthStep.CODE_ENTRY);
            setCurrentView(AppView.AUTH);
        }
    };

    const handleLoginRequest = () => {
        setSessionMode(SessionMode.FREE);
        setAuthInitialStep(AuthStep.LOGIN);
        setCurrentView(AppView.AUTH);
        // Update URL to /login so RouterSync doesn't override it back to WELCOME
        window.history.pushState({}, '', '/login');
    };

    const handleAuthSuccess = (user: User) => {
        setCurrentUser({ ...user });

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

    const isSessionView = currentView !== AppView.WELCOME &&
        currentView !== AppView.AUTH &&
        currentUser?.role !== 'SUPERADMIN';

    const getBreadcrumbs = () => {
        const sidebarT = t('sidebar', { returnObjects: true }) as any;
        const step1T = t('step1', { returnObjects: true }) as any;
        const dashboardSubT = t('sidebar.dashboardSub', { returnObjects: true }) as any;

        const viewParts = currentView.split('_');

        let section = sidebarT.dashboard || 'Dashboard';
        let sub = '';

        if (viewParts.includes('QUICK')) {
            section = sidebarT.quickAssessment;
            const stepNum = viewParts[1]?.replace('STEP', '') || '1';
            sub = `${step1T.subtitle} ${stepNum}`;
        } else if (viewParts.includes('FULL')) {
            section = sidebarT.fullProject;
            const stepNum = viewParts[1]?.replace('STEP', '') || '1';
            // Maybe map step names?
            if (viewParts.includes('STEP1')) sub = sidebarT.fullStep1;
            else if (viewParts.includes('STEP2')) sub = sidebarT.module3_1; // Initiatives List match
            else if (viewParts.includes('STEP3')) sub = sidebarT.module3_2; // Roadmap Builder match
            else if (viewParts.includes('STEP4')) sub = sidebarT.module6;
            else if (viewParts.includes('STEP5')) sub = sidebarT.module5; // Adjust as needed
            else if (viewParts.includes('STEP6')) sub = sidebarT.module7;
            else sub = `${sidebarT.fullProject} ${stepNum}`;
        } else if (viewParts.includes('ADMIN')) {
            section = sidebarT.adminPanel;
            sub = viewParts[1] || 'Dashboard';
        } else if (viewParts.includes('SETTINGS')) {
            section = sidebarT.settings;
            sub = viewParts[1] || 'Profile';
        } else if (currentView === AppView.USER_DASHBOARD) {
            section = sidebarT.dashboard;
        } else if (currentView === AppView.DASHBOARD_OVERVIEW) {
            section = sidebarT.dashboard;
            sub = dashboardSubT.overview || 'Overview';
        } else if (currentView === AppView.DASHBOARD_SNAPSHOT) {
            section = sidebarT.dashboard;
            sub = dashboardSubT.snapshot || 'Execution Snapshot';
        }

        return [section, sub];
    };

    const breadcrumbs = getBreadcrumbs();

    const renderContent = () => {
        if (!currentUser) return null;

        // --- SUPER ADMIN INTERCEPT ---
        if (currentUser.role === 'SUPERADMIN') {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SuperAdminView
                        currentUser={currentUser}
                        onNavigate={(view: AppView) => {
                            if (view === AppView.WELCOME) {
                                logout();
                                setCurrentView(AppView.WELCOME);
                            } else {
                                setCurrentView(view);
                            }
                        }}
                    />
                </React.Suspense>
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

        // Trial Entry View (Phase C)
        if (currentView === AppView.TRIAL_ENTRY) {
            return (
                <TrialEntryView onStartTrial={() => setCurrentView(AppView.AUTH)} />
            );
        }

        // Full Transformation Views
        if (currentView === AppView.FULL_STEP1_CONTEXT) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <Module1ContextView currentUser={currentUser} fullSession={fullSessionData} setFullSession={setFullSessionData} onNavigate={setCurrentView} />
                </React.Suspense>
            );
        }
        if (
            currentView === AppView.CONTEXT_BUILDER ||
            currentView === AppView.CONTEXT_BUILDER_PROFILE ||
            currentView === AppView.CONTEXT_BUILDER_GOALS ||
            currentView === AppView.CONTEXT_BUILDER_CHALLENGES ||
            currentView === AppView.CONTEXT_BUILDER_MEGATRENDS ||
            currentView === AppView.CONTEXT_BUILDER_STRATEGY
        ) {
            let initialTab = 1;
            switch (currentView) {
                case AppView.CONTEXT_BUILDER_PROFILE: initialTab = 1; break;
                case AppView.CONTEXT_BUILDER_GOALS: initialTab = 2; break;
                case AppView.CONTEXT_BUILDER_CHALLENGES: initialTab = 3; break;
                case AppView.CONTEXT_BUILDER_MEGATRENDS: initialTab = 4; break;
                case AppView.CONTEXT_BUILDER_STRATEGY: initialTab = 5; break;
                default: initialTab = 1; break;
            }
            return <ContextBuilderView initialTab={initialTab} />;
        }
        if (currentView === AppView.FULL_STEP1_ASSESSMENT || currentView.startsWith('FULL_STEP1_')) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullAssessmentView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_STEP2_INITIATIVES) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullInitiativesView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_STEP3_ROADMAP) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullRoadmapView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_STEP4_ROI) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullROIView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_STEP5_EXECUTION) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullExecutionView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_PILOT_EXECUTION) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullPilotView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_ROLLOUT) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullRolloutView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.FULL_STEP6_REPORTS) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <FullReportsView />
                </React.Suspense>
            );
        }

        if (currentView === AppView.MY_WORK) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <MyWorkView />
                </React.Suspense>
            );
        }

        // Consultant Views
        if (currentView === AppView.CONSULTANT_PANEL) {
            return (
                <React.Suspense fallback={<div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" />Loading Consultant Panel...</div>}>
                    <ConsultantPanelView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.CONSULTANT_INVITES) {
            return (
                <React.Suspense fallback={<div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" />Loading Invite Tool...</div>}>
                    <ConsultantInviteView />
                </React.Suspense>
            );
        }

        // Phase D: Organization Setup Wizard
        if (currentView === AppView.ORG_SETUP_WIZARD) {
            return (
                <React.Suspense fallback={<div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" />Loading Organization Setup...</div>}>
                    <OrgSetupWizard />
                </React.Suspense>
            );
        }

        // Affiliate Dashboard (Phase G)
        if (currentView === AppView.AFFILIATE_DASHBOARD) {
            return (
                <AffiliateDashboardView />
            );
        }

        // Phase E: Onboarding Wizard
        if (currentView === AppView.ONBOARDING_WIZARD) {
            return (
                <React.Suspense fallback={<div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" />Loading Onboarding...</div>}>
                    <OnboardingWizard />
                </React.Suspense>
            );
        }

        if (currentView === AppView.AI_ACTION_PROPOSALS) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <ActionProposalView />
                </React.Suspense>
            );
        }

        // Admin Views
        if (currentView.startsWith('ADMIN')) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <AdminView currentUser={currentUser} onNavigate={setCurrentView} />
                </React.Suspense>
            );
        }

        // Settings Views
        if (currentView.startsWith('SETTINGS')) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SettingsView
                        currentUser={currentUser}
                        onUpdateUser={(updates: Partial<User>) => setCurrentUser(currentUser ? { ...currentUser, ...updates } : null)}
                        theme={theme}
                        toggleTheme={toggleTheme}
                    />
                </React.Suspense>
            );
        }

        return (
            <div className="w-full p-8 flex items-center justify-center text-slate-500 flex-col gap-4">
                <div className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{currentView}</div>
                <div>{t('common.underConstruction', 'Component Under Construction')}</div>
            </div>
        );
    };

    // --- DEMO MODE LOGIC ---
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
    const [demoTriggerReason, setDemoTriggerReason] = useState<'time_limit' | 'action_blocked' | 'manual'>('manual');
    const [demoBlockMessage, setDemoBlockMessage] = useState<string | undefined>(undefined);

    // Listen for Demo Blocks from API
    useEffect(() => {
        const handleDemoBlock = (event: CustomEvent) => {
            setDemoTriggerReason('action_blocked');
            setDemoBlockMessage(event.detail?.message);
            setIsDemoModalOpen(true);
        };

        window.addEventListener('DEMO_ACTION_BLOCKED' as any, handleDemoBlock);
        return () => window.removeEventListener('DEMO_ACTION_BLOCKED' as any, handleDemoBlock);
    }, []);

    // Demo Timer (e.g., 10 minutes)
    useEffect(() => {
        if (currentUser?.isDemo) {
            const timer = setTimeout(() => {
                setDemoTriggerReason('time_limit');
                setIsDemoModalOpen(true);
            }, 10 * 60 * 1000); // 10 minutes

            return () => clearTimeout(timer);
        }
    }, [currentUser]);

    return (
        <ErrorBoundary>
            <div className="flex h-screen w-full bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white font-sans overflow-hidden">
                <Toaster position="bottom-right" />
                <ChatOverlay />

                {/* Demo Conversion Modal */}
                {currentUser?.isDemo && (
                    <React.Suspense fallback={null}>
                        {import('./components/ConversionModal').then(mod => ({ default: mod.default })).then(Component => (
                            <Component.default
                                isOpen={isDemoModalOpen}
                                onClose={() => setIsDemoModalOpen(false)}
                                triggerReason={demoTriggerReason}
                                message={demoBlockMessage}
                            />
                        )) as any}
                    </React.Suspense>
                )}

                {/* Lazy load to avoid circular deps if any, though standard import is fine usually. 
                   Using standard import at top is better. Let's assume standard import.
                */}

                {/* Help System - Global floating button + panel */}
                {isSessionView && (
                    <>
                        <HelpButtonWrapper />
                    </>
                )}

                {/* Demo Banner */}
                {currentUser?.isDemo && (
                    <div className="fixed top-0 left-0 right-0 z-[60]">
                        <React.Suspense fallback={null}>
                            {import('./components/DemoBanner').then(mod => ({ default: mod.default })).then(Component => (
                                <Component.default />
                            )) as any}
                        </React.Suspense>
                    </div>
                )}

                {/* Impersonation Banner */}
                {currentUser?.impersonatorId && (
                    <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white z-50 flex items-center justify-center gap-4 text-sm font-medium shadow-md">
                        <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            {t('common.impersonation.banner', { email: currentUser.email, defaultValue: `IMPERSONATING: ${currentUser.email}` })}
                        </span>
                        <button
                            onClick={handleStopImpersonation}
                            className="bg-white text-red-600 px-3 py-0.5 rounded text-xs font-bold hover:bg-red-50 transition-colors uppercase"
                        >
                            {t('common.impersonation.stop', 'Stop Impersonating')}
                        </button>
                    </div>
                )}

                {isSessionView && (
                    <div className={currentUser?.isDemo ? "pt-10" : ""}>
                        <Sidebar />
                    </div>
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
                        ${isSessionView ? (isSidebarCollapsed ? 'lg:ltr:pl-16 lg:rtl:pr-16' : 'lg:ltr:pl-64 lg:rtl:pr-64') : ''}
                        ${currentUser?.isDemo ? 'mt-10' : ''} 
                    `}
                >
                    {/* Top Bar for Session Views */}
                    {isSessionView && (
                        <div className="flex flex-col z-50 shrink-0">
                            {/* AI Freeze Banner */}
                            <AIFreezeBanner />

                            {/* Trial Banner */}
                            <TrialBanner />


                            <div className="h-12 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex items-center justify-between px-3 transition-colors duration-300">
                                {/* ... existing top bar content ... */}
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-navy-700 dark:text-white mr-2">
                                        <Menu />
                                    </button>
                                    <div className="flex items-center text-sm font-medium text-slate-400">
                                        <span className="hover:text-navy-900 dark:hover:text-white cursor-pointer transition-colors">{breadcrumbs[0]}</span>
                                        <ChevronRight size={14} className="mx-2 rtl:rotate-180" />
                                        <span className="text-navy-900 dark:text-white">{breadcrumbs[1]}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Auto-save status removed */}
                                    <SystemHealth />
                                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                                    <LLMSelector />
                                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                                    <TaskDropdown />
                                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                                    <NotificationDropdown />

                                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

                                    <div className="relative" ref={profileRef}>
                                        <button
                                            onClick={() => setIsProfileOpen(!isProfileOpen)}
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

                                        {/* Profile Dropdown */}
                                        {isProfileOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                                {/* ... existing profile dropdown ... */}
                                                {/* Header with User Info */}
                                                <div className="px-4 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-slate-500 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                                                            {currentUser?.avatarUrl ? (
                                                                <img src={currentUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <UserCircle size={24} />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-navy-900 dark:text-white truncate">
                                                                {currentUser?.firstName} {currentUser?.lastName}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">
                                                                {currentUser?.email}
                                                            </div>
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 capitalize border border-purple-200 dark:border-purple-500/20">
                                                                {currentUser?.role?.toLowerCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Settings Section */}
                                                <div className="p-2 border-b border-slate-100 dark:border-white/5">
                                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                        Preferences
                                                    </div>

                                                    {/* Theme Toggle */}
                                                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <Sun size={16} className="hidden dark:block" />
                                                            <Moon size={16} className="dark:hidden" />
                                                            <span>Theme</span>
                                                        </div>
                                                        <div className="flex bg-slate-100 dark:bg-navy-950 rounded-lg p-1 border border-slate-200 dark:border-white/10">
                                                            {(['light', 'system', 'dark'] as const).map((tMode) => (
                                                                <button
                                                                    key={tMode}
                                                                    onClick={(e) => { e.stopPropagation(); toggleTheme(tMode); }}
                                                                    className={`p-1.5 rounded-md transition-all ${theme === tMode
                                                                        ? 'bg-white dark:bg-navy-800 shadow-sm text-purple-600 dark:text-purple-400'
                                                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                                                    title={tMode.charAt(0).toUpperCase() + tMode.slice(1)}
                                                                >
                                                                    {tMode === 'light' && <Sun size={14} />}
                                                                    {tMode === 'dark' && <Moon size={14} />}
                                                                    {tMode === 'system' && <Monitor size={14} />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Language Toggle */}
                                                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <Languages size={16} />
                                                            <span>Language</span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {['en', 'pl'].map((lang) => (
                                                                <button
                                                                    key={lang}
                                                                    onClick={(e) => { e.stopPropagation(); i18n.changeLanguage(lang); }}
                                                                    className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium uppercase min-w-[32px] ${i18n.language?.startsWith(lang)
                                                                        ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500/30 dark:text-purple-300'
                                                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 dark:text-slate-400'}`}
                                                                >
                                                                    {lang}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Navigation Links */}
                                                <div className="p-2 space-y-0.5">
                                                    <button
                                                        onClick={() => {
                                                            setCurrentView(AppView.SETTINGS_PROFILE);
                                                            setIsProfileOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
                                                    >
                                                        <UserCircle size={16} />
                                                        My Profile
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setCurrentView(AppView.SETTINGS_BILLING);
                                                            setIsProfileOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
                                                    >
                                                        <CreditCard size={16} />
                                                        Billing & Plans
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setCurrentView(AppView.SETTINGS_AI);
                                                            setIsProfileOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
                                                    >
                                                        <Cpu size={16} />
                                                        AI Configuration
                                                    </button>

                                                    <div className="my-1 border-t border-slate-100 dark:border-white/5 opacity-50"></div>

                                                    <button
                                                        onClick={() => {
                                                            logout();
                                                            setIsProfileOpen(false);
                                                            setCurrentView(AppView.WELCOME);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 rounded-lg transition-colors"
                                                    >
                                                        <LogOut size={16} />
                                                        Log Out
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <TrialExpiredGate>
                        {/* PMO Status Bar - Shows phase, gate status, blocking issues */}
                        {isSessionView && (
                            <PMOStatusBar />
                        )}

                        {/* If SuperAdmin, simple full screen container logic is handled inside SuperAdminView which expects full height */}
                        <AnimatePresence mode="wait" initial={false}>
                            {currentUser?.role === 'SUPERADMIN' ? (
                                <PageTransition id="superadmin">
                                    {renderContent()}
                                </PageTransition>
                            ) : (
                                <div className="flex-1 overflow-hidden relative flex flex-col">
                                    {currentView === AppView.WELCOME && (
                                        <PageTransition id="welcome">
                                            <ProductEntryPage
                                                onStartSession={handleStartSession}
                                                onLoginClick={handleLoginRequest}
                                            />
                                        </PageTransition>
                                    )}

                                    {currentView === AppView.AUTH && (
                                        <PageTransition id="auth">
                                            <AuthView
                                                initialStep={authInitialStep}
                                                targetMode={sessionMode}
                                                onAuthSuccess={handleAuthSuccess}
                                                onBack={() => setCurrentView(AppView.WELCOME)}
                                            />
                                        </PageTransition>
                                    )}

                                    {(currentView !== AppView.WELCOME && currentView !== AppView.AUTH) && (
                                        <PageTransition id={currentView}>
                                            {renderContent()}
                                        </PageTransition>
                                    )}
                                </div>
                            )}
                        </AnimatePresence>
                    </TrialExpiredGate>
                </main>
            </div >
        </ErrorBoundary >
    );
};

export const App = () => (
    <BrowserRouter>
        <Routes>
            {/* Public share route - no auth required, minimal shell */}
            <Route
                path="/share/:token"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                        <PublicReportView />
                    </React.Suspense>
                }
            />
            {/* OAuth Callback route - handles Google/LinkedIn redirects */}
            <Route
                path="/auth/callback"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/OAuthCallback')))}
                    </React.Suspense>
                }
            />
            {/* Email Verification Route */}
            <Route
                path="/auth/verify-email"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/auth/VerifyEmail')))}
                    </React.Suspense>
                }
            />
            {/* All other routes go through main app */}
            <Route path="*" element={
                <AutoSaveProvider>
                    <AIProvider>
                        <HelpProvider>
                            <AccessPolicyProvider>
                                <TrialProvider>
                                    <TourProvider>
                                        <RouterSync />
                                        <AppContent />
                                    </TourProvider>
                                </TrialProvider>
                            </AccessPolicyProvider>
                        </HelpProvider>
                    </AIProvider>
                </AutoSaveProvider>
            } />
        </Routes>
    </BrowserRouter>
);
