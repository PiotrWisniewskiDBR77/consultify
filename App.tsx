import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RouterSync } from './components/RouterSync';
const PublicReportView = React.lazy(() => import('./views/reports/PublicReportView'));
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { useTranslation } from 'react-i18next';
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
const EconomicsView = React.lazy(() => import('./views/EconomicsView').then(m => ({ default: m.EconomicsView })));
const FullExecutionView = React.lazy(() => import('./views/FullExecutionView').then(m => ({ default: m.FullExecutionView })));
const ImplementationView = React.lazy(() => import('./views/ImplementationView').then(m => ({ default: m.ImplementationView })));
const FullRolloutView = React.lazy(() => import('./views/FullRolloutView').then(m => ({ default: m.FullRolloutView })));
const FullReportsView = React.lazy(() => import('./views/FullReportsView').then(m => ({ default: m.FullReportsView })));
const DRDAuditReportView = React.lazy(() => import('./views/DRDAuditReportView').then(m => ({ default: m.DRDAuditReportView })));
const KpiOkrView = React.lazy(() => import('./views/KpiOkrView').then(m => ({ default: m.KpiOkrView })));
const AdminView = React.lazy(() => import('./views/admin/AdminView').then(m => ({ default: m.AdminView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const SuperAdminView = React.lazy(() => import('./views/superadmin/SuperAdminView').then(m => ({ default: m.SuperAdminView })));
// export const UserDashboardView = React.lazy(() => import('./views/UserDashboardView').then(m => ({ default: m.UserDashboardView })));
const Module1ContextView = React.lazy(() => import('./views/Module1ContextView').then(m => ({ default: m.Module1ContextView })));
const ContextBuilderView = React.lazy(() => import('./views/ContextBuilder/ContextBuilderView').then(m => ({ default: m.ContextBuilderView })));
const MyWorkView = React.lazy(() => import('./views/MyWorkView').then(m => ({ default: m.MyWorkView })));
const ActionProposalView = React.lazy(() => import('./views/ActionProposalView').then(m => ({ default: m.ActionProposalView })));
const StudioView = React.lazy(() => import('./views/StudioView').then(m => ({ default: m.StudioView })));
// export const InitiativeManagementView = React.lazy(() => import('./views/InitiativeManagementView').then(m => ({ default: m.InitiativeManagementView })));
const ProjectIntelligenceView = React.lazy(() => import('./views/ProjectIntelligenceView').then(m => ({ default: m.ProjectIntelligenceView })));
const BenefitsRealizationView = React.lazy(() => import('./views/BenefitsRealizationView').then(m => ({ default: m.BenefitsRealizationView })));
const PortfolioView = React.lazy(() => import('./views/PortfolioView'));
import { AppView, SessionMode, AuthStep, User } from './types';
import { Menu, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Api } from './services/api';
import './services/tokenService'; // Initialize token service for auto-refresh
import { LLMSelector } from './components/LLMSelector';
import { NotificationDropdown } from './components/NotificationDropdown';
import { TaskDropdown } from './components/TaskDropdown';
import { AutoSaveProvider } from './src/context/AutoSaveContext';
import { SystemHealth } from './components/SystemHealth';
// import { ChatOverlay } from './components/AIChat/ChatOverlay';
import { AIProvider } from './contexts/AIContext';
import { PMOStatusBar } from './components/PMO';
// PMO context is available via usePMOContext hook when needed in child components
import { HelpProvider, useHelpPanel } from './contexts/HelpContext';
import HelpButton from './components/HelpButton';
import HelpPanel from './components/HelpPanel';
import { TrialProvider } from './contexts/TrialContext';
import { TrialBanner } from './components/Trial/TrialBanner';
import { TrialExpiredGate } from './components/Trial/TrialExpiredGate';
import { AccessPolicyProvider } from './contexts/AccessPolicyContext';
import { TourProvider } from './components/Onboarding/TourProvider';
import { AIFreezeBanner } from './components/AIFreezeBanner';
import { DemoWelcomeTour, ExitIntentModal, useExitIntent } from './components/demo';
import { DocumentToggleButton } from './components/documents/DocumentToggleButton';
import { DocumentSidePanel } from './components/documents/DocumentSidePanel';
import { BottomNavigation } from './components/navigation';
import { HelpToggleButton } from './components/Help/HelpToggleButton';
import { HelpSidePanel } from './components/Help/HelpSidePanel';
import { FeedbackToggleButton } from './components/Feedback/FeedbackToggleButton';
import { FeedbackSidePanel } from './components/Feedback/FeedbackSidePanel';
import { UserProfileMenu } from './components/UserProfileMenu';
// import { ProfileCompletionOverlay } from './components/shared/ProfileCompletionOverlay'; // REPLACED WITH NON-BLOCKING CHECK
import { toast } from 'react-hot-toast';


// Help system wrapper component - disabled, using direct HelpButton in layouts
// const HelpButtonWrapper = () => {
//     const { isPanelOpen, openPanel, closePanel } = useHelpPanel();
//     return (
//         <>
//             <HelpButton onClick={openPanel} />
//             <HelpPanel isOpen={isPanelOpen} onClose={closePanel} />
//         </>
//     );
// };

// Invitation acceptance wrapper component
const AcceptInvitationView = React.lazy(() => import('./views/AcceptInvitationView'));
const InviteRouteWrapper = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    return (
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
            <AcceptInvitationView
                token={token || ''}
                onAccepted={() => navigate('/login')}
                onError={(error) => console.error('Invitation error:', error)}
            />
        </React.Suspense>
    );
};

// Lazy load views
const AIChatWelcomeView = React.lazy(() => import('./views/AIChatWelcomeView').then(module => ({ default: module.AIChatWelcomeView })));
const OnboardingWizard = React.lazy(() => import('./views/OnboardingWizard').then(module => ({ default: module.OnboardingWizard }))); // NEW
const OrgSetupWizard = React.lazy(() => import('./views/OrgSetupWizard').then(module => ({ default: module.OrgSetupWizard }))); // Phase D
const ConsultantPanelView = React.lazy(() => import('./src/views/consultant/ConsultantPanelView').then(module => ({ default: module.ConsultantPanelView })));
const ConsultantInviteView = React.lazy(() => import('./src/views/consultant/ConsultantInviteView').then(module => ({ default: module.ConsultantInviteView })));

// Assessment Module Components (NEW)
const _RapidLeanWizard = React.lazy(() => import('./components/assessment/RapidLeanWizard').then(module => ({ default: module.RapidLeanWizard })));
const ExternalDigitalWorkspace = React.lazy(() => import('./components/assessment/ExternalDigitalWorkspace').then(module => ({ default: module.ExternalDigitalWorkspace })));
const AssessmentHubDashboard = React.lazy(() => import('./components/assessment/AssessmentHubDashboard').then(module => ({ default: module.AssessmentHubDashboard })));
const GenericReportsWorkspace = React.lazy(() => import('./components/assessment/GenericReportsWorkspace').then(module => ({ default: module.GenericReportsWorkspace })));
const AssessmentModuleHub = React.lazy(() => import('./components/assessment/AssessmentModuleHub').then(module => ({ default: module.AssessmentModuleHub })));
import { SplitLayout } from './components/SplitLayout';

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
        theme, toggleTheme,
        isChatCollapsed, toggleChatCollapse,
        setCurrentOrganization
    } = useAppStore();

    // ... (rest of hook calls)



    // PMO context is available via usePMOContext hook when needed in child components

    // Demo Welcome Tour State
    const [showDemoTour, setShowDemoTour] = useState(false);

    // Exit Intent for demo users - triggers when they try to leave
    const { showExitIntent, dismissExitIntent } = useExitIntent({
        delayMs: 30000, // Wait 30 seconds before allowing trigger
        triggerOnce: true,
        disabled: !currentUser?.isDemo // Only enable for demo users
    });

    // Show tour when demo user logs in for the first time
    useEffect(() => {
        if (currentUser?.isDemo && !localStorage.getItem('demo_tour_completed') && !localStorage.getItem('demo_tour_skipped')) {
            // Small delay to let the UI settle
            const timer = setTimeout(() => setShowDemoTour(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [currentUser?.isDemo]);

    const { t, i18n } = useTranslation();

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

    // Verify authentication token on app load and handle token expiry
    useEffect(() => {
        const verifyAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                // No token - clear user if set
                if (currentUser) {
                    setCurrentUser(null);
                }
                return;
            }

            // If we have a token, restore session and sync with server
            if (token) {
                // 1. Immediate restore from localStorage for UI responsiveness
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    try {
                        const userData = JSON.parse(storedUser);
                        setCurrentUser({ ...userData, isAuthenticated: true });
                    } catch {
                        console.warn('[Auth] Stale user data in localStorage');
                    }
                }

                // 2. Background sync with server to get latest profile (avatar, role changes, etc.)
                try {
                    const user = await Api.getMe();
                    if (user) {
                        const authenticatedUser: User = { ...user, isAuthenticated: true };
                        setCurrentUser(authenticatedUser);
                        localStorage.setItem('user', JSON.stringify(user));
                        console.log('[Auth] User profile synchronized with server');

                        // Set organization context for Admin panels
                        if (user.organizationId) {
                            setCurrentOrganization({
                                id: user.organizationId,
                                name: user.organizationName || 'Organization'
                            });
                        }
                    } else {
                        throw new Error('Invalid response from /me');
                    }
                } catch (error) {
                    console.error('[Auth] Profile sync failed:', error);
                    // If API fails but we have a token, we keep the localStorage version 
                    // unless it's a 401/403 (handled by API interceptors usually)
                }
            }
        };

        verifyAuth();
    }, []); // Run once on mount

    // Listen for token expiry events
    useEffect(() => {
        const handleTokenExpired = () => {
            console.log('[Auth] Token expired event received');
            logout();
            setCurrentView(AppView.AUTH);
            setAuthInitialStep(AuthStep.LOGIN);
        };

        window.addEventListener('auth:token-expired', handleTokenExpired);
        return () => window.removeEventListener('auth:token-expired', handleTokenExpired);
    }, [logout, setCurrentView, setAuthInitialStep]);

    // FIX: Reset to WELCOME if user is not authenticated but current view requires auth
    useEffect(() => {
        const publicViews = [AppView.WELCOME, AppView.AUTH, AppView.FREE_ASSESSMENT_CHAT, AppView.QUICK_STEP1_PROFILE, AppView.QUICK_STEP2_USER_CONTEXT, AppView.QUICK_STEP3_EXPECTATIONS];
        const isPublicView = publicViews.includes(currentView);

        if (!currentUser && !isPublicView) {
            setCurrentView(AppView.WELCOME);
        }
    }, [currentUser, currentView, setCurrentView]);

    // Profile Completion reminder - non-blocking notification for targeted users
    useEffect(() => {
        if (currentUser?.email === 'piotr.wisniewski@dbr77.com') {
            const isMissingInfo = !currentUser?.phone || !currentUser?.linkedinId;
            if (isMissingInfo) {
                const lastReminded = localStorage.getItem('profile_completion_last_reminded');
                const now = Date.now();
                // Remind at most once per 4 hours if missing
                if (!lastReminded || (now - parseInt(lastReminded)) > 1000 * 60 * 60 * 4) {
                    toast.custom((t) => (
                        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-navy-800 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-violet-100 dark:border-violet-500/20`}>
                            <div className="flex-1 w-0 p-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 pt-0.5">
                                        <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold overflow-hidden">
                                            🛡️
                                        </div>
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            Piotr, your profile is incomplete
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Please add your phone and LinkedIn in Settings to ensure full security and networking features.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex border-l border-slate-200 dark:border-white/5">
                                <button
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        setCurrentView(AppView.SETTINGS_PROFILE);
                                    }}
                                    className="w-full border border-transparent rounded-none rounded-r-xl p-4 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    ), { duration: 8000 });
                    localStorage.setItem('profile_completion_last_reminded', now.toString());
                }
            }
        }
    }, [currentUser, setCurrentView]);

    // AI Chat is the primary entry point for authenticated users
    // Redirect from old USER_DASHBOARD to AI Chat on initial load
    // Note: ADMIN_DASHBOARD is intentionally NOT redirected - it's used by Admin menu
    useEffect(() => {
        const oldDashboardViews = [AppView.USER_DASHBOARD];
        if (currentUser?.isAuthenticated && oldDashboardViews.includes(currentView)) {
            setCurrentView(AppView.AI_CHAT);
            window.history.pushState({}, '', '/chat');
        }
    }, [currentUser, currentView, setCurrentView]);

    const handleStartSession = (mode: SessionMode) => {
        setSessionMode(mode);

        if (currentUser?.isAuthenticated) {
            // All users start with AI Chat - the new primary entry point
            setCurrentView(AppView.AI_CHAT);
            window.history.pushState({}, '', '/chat');
            return;
        }

        if (mode === SessionMode.FREE || mode === SessionMode.DEMO) {
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

    const handleRegisterRequest = () => {
        setSessionMode(SessionMode.FREE);
        setAuthInitialStep(AuthStep.REGISTER);
        setCurrentView(AppView.AUTH);
        window.history.pushState({}, '', '/register');
    };

    const handleAuthSuccess = (user: User | { status?: string; message?: string }) => {
        // Check if it's an error response
        if ('status' in user && user.status !== 'success' && 'message' in user) {
            console.error('Auth error:', user.message);
            return;
        }

        // Type guard: ensure it's a User object
        if (!('id' in user) || !('email' in user)) {
            console.error('Invalid user object received');
            return;
        }

        // Verify token was stored
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Authentication succeeded but token was not stored');
            // Try to get user info from API to verify token
            Api.getUsers().catch(() => {
                console.error('Failed to verify authentication - redirecting to login');
                setCurrentView(AppView.AUTH);
                setAuthInitialStep(AuthStep.LOGIN);
            });
            return;
        }

        const validUser = user as User;
        // Mark user as authenticated
        const authenticatedUser: User = {
            ...validUser,
            isAuthenticated: true
        };
        setCurrentUser(authenticatedUser);

        // Set organization context for Admin panels
        if (validUser.organizationId) {
            setCurrentOrganization({
                id: validUser.organizationId,
                name: validUser.organizationName || 'Organization'
            });
        }

        // Redirect logic - ALL users start with AI Chat as primary entry point
        // Admin panel is accessible via sidebar navigation
        setCurrentView(AppView.AI_CHAT);
        window.history.pushState({}, '', '/chat');
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sidebarT = t('sidebar', { returnObjects: true }) as Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const step1T = t('step1', { returnObjects: true }) as Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dashboardSubT = t('sidebar.dashboardSub', { returnObjects: true }) as Record<string, any>;

        const viewParts = currentView.split('_');

        let section = sidebarT.dashboard || 'Dashboard';
        let sub = '';

        // My Work View
        if (currentView === AppView.MY_WORK) {
            section = t('sidebar.dashboard');
            sub = t('myWork.title');
        }
        // Assessment Module Views
        else if (currentView === AppView.ASSESSMENT_DRD) {
            section = t('sidebar.assessment');
            sub = t('sidebar.assessmentDRD');
        } else if (currentView === AppView.ASSESSMENT_SIRI) {
            section = t('sidebar.assessment');
            sub = t('sidebar.assessmentSIRI');
        } else if (currentView === AppView.ASSESSMENT_ADMA) {
            section = t('sidebar.assessment');
            sub = t('sidebar.assessmentADMA');
        } else if (currentView === AppView.ASSESSMENT_CMMI) {
            section = t('sidebar.assessment');
            sub = t('sidebar.assessmentCMMI');
        } else if (currentView === AppView.ASSESSMENT_LEAN || currentView === AppView.ASSESSMENT_LEAN_EXTERNAL) {
            section = t('sidebar.assessment');
            sub = t('sidebar.assessmentLean');
        } else if (currentView === AppView.ASSESSMENT_SUMMARY || currentView === AppView.ASSESSMENT_OVERVIEW) {
            section = t('sidebar.assessment');
            sub = t('assessment.workspace.dashboardHeader');
        } else if (currentView === AppView.ASSESSMENT_AUDITS) {
            section = t('sidebar.assessment');
            sub = t('sidebar.otherAssessments');
        }
        // Context Builder Views
        else if (currentView.startsWith('CONTEXT_BUILDER')) {
            section = t('sidebar.module1');
            if (currentView === AppView.CONTEXT_BUILDER_PROFILE) {
                sub = t('sidebar.context.profile');
            } else if (currentView === AppView.CONTEXT_BUILDER_GOALS) {
                sub = t('sidebar.context.goals');
            } else if (currentView === AppView.CONTEXT_BUILDER_CHALLENGES) {
                sub = t('sidebar.context.challenges');
            } else if (currentView === AppView.CONTEXT_BUILDER_MEGATRENDS) {
                sub = t('sidebar.context.megatrends');
            } else if (currentView === AppView.CONTEXT_BUILDER_STRATEGY) {
                sub = t('sidebar.context.strategy');
            } else {
                sub = t('sidebar.context.profile');
            }
        }
        // Full Transformation Views
        else if (currentView === AppView.FULL_STEP1_CONTEXT) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.module1');
        } else if (currentView === AppView.FULL_STEP1_ASSESSMENT || currentView.startsWith('FULL_STEP1_')) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.fullStep1');
        } else if (currentView === AppView.FULL_STEP2_INITIATIVES) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.fullStep2');
        } else if (currentView === AppView.FULL_STEP3_ROADMAP) {
            // Legacy - redirect to Portfolio
            section = t('sidebar.fullProject');
            sub = t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap');
        } else if (currentView === AppView.PORTFOLIO_ROADMAP) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap');
        } else if (currentView === AppView.FULL_STEP4_ROI) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.fullStep4');
        } else if (currentView === AppView.ECONOMICS) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.economics');
        } else if (currentView === AppView.FULL_STEP5_EXECUTION) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.fullStep5');
        } else if (currentView === AppView.IMPLEMENTATION) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.implementation');
        } else if (currentView === AppView.FULL_ROLLOUT) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.fullImplementation');
        } else if (currentView === AppView.FULL_STEP6_REPORTS) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.fullStep6');
        } else if (currentView === AppView.KPI_OKR_DASHBOARD) {
            section = t('sidebar.fullProject');
            sub = t('sidebar.kpiOkr');
        } else if (currentView === AppView.STUDIO) {
            section = t('sidebar.tools');
            sub = t('sidebar.studio', 'Studio');
        }
        // Quick Assessment Views
        else if (viewParts.includes('QUICK')) {
            section = sidebarT.quickAssessment || 'Szybka Diagnoza';
            const stepNum = viewParts[1]?.replace('STEP', '') || '1';
            sub = `${step1T.subtitle || 'Krok'} ${stepNum}`;
        }
        // Admin Views
        else if (viewParts.includes('ADMIN')) {
            section = t('sidebar.adminPanel');
            if (currentView === AppView.ADMIN_USERS) sub = t('sidebar.adminUsers');
            else if (currentView === AppView.ADMIN_PROJECTS) sub = t('sidebar.adminProjects');
            else if (currentView === AppView.ADMIN_LLM) sub = t('sidebar.adminLLM');
            else if (currentView === AppView.ADMIN_KNOWLEDGE) sub = t('sidebar.adminKnowledge');
            else if (currentView === AppView.ADMIN_FEEDBACK) sub = t('sidebar.adminFeedback');
            else if (currentView === AppView.ADMIN_BILLING) sub = t('admin.billing.title');
            else if (currentView === AppView.ADMIN_ANALYTICS) sub = t('admin.analytics.title');
            else sub = t('sidebar.dashboard');
        }
        // Settings Views
        else if (viewParts.includes('SETTINGS')) {
            section = t('sidebar.settings');
            if (currentView === AppView.SETTINGS_PROFILE) sub = t('settings.menu.myProfile');
            else if (currentView === AppView.SETTINGS_BILLING) sub = t('settings.menu.billing');
            else if (currentView === AppView.SETTINGS_AI) sub = t('settings.menu.aiConfig');
            else if (currentView === AppView.SETTINGS_NOTIFICATIONS) sub = t('settings.menu.notifications');
            else if (currentView === AppView.SETTINGS_INTEGRATIONS) sub = t('settings.menu.integrations');
            else if (currentView === AppView.SETTINGS_ORGANIZATION) sub = t('settings.menu.organization');
            else if (currentView === AppView.SETTINGS_WORK_PREFERENCES) sub = t('settings.menu.workPreferences');
            else if (currentView === AppView.SETTINGS_DASHBOARD_PREFERENCES) sub = t('settings.menu.dashboardPreferences');
            else if (currentView === AppView.SETTINGS_ACCESSIBILITY) sub = t('settings.menu.accessibility');
            else if (currentView === AppView.SETTINGS_PRIVACY) sub = t('settings.menu.privacy');
            else sub = t('settings.menu.myProfile');
        }
        // Consultant Views
        else if (currentView === AppView.CONSULTANT_PANEL) {
            section = t('consultant.section');
            sub = t('consultant.panel');
        } else if (currentView === AppView.CONSULTANT_INVITES) {
            section = t('consultant.section');
            sub = t('consultant.invites');
        }
        // AI Chat View
        else if (currentView === AppView.AI_CHAT) {
            section = 'AI';
            sub = t('sidebar.aiChat', 'Chat');
        }
        // MyWork Views (unified Dashboard + My Work)
        else if (
            currentView === AppView.USER_DASHBOARD ||
            currentView === AppView.DASHBOARD ||
            currentView === AppView.DASHBOARD_OVERVIEW ||
            currentView === AppView.DASHBOARD_SNAPSHOT ||
            (currentView as any) === AppView.MY_WORK
        ) {
            section = t('myWork.title', 'My Work');
            sub = '';
        }
        // Affiliate Dashboard
        else if (currentView === AppView.AFFILIATE_DASHBOARD) {
            section = t('sidebar.dashboard');
            sub = t('sidebar.affiliateDashboard');
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

        // --- AI Chat Welcome Screen ---
        if (currentView === AppView.AI_CHAT) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <AIChatWelcomeView />
                </React.Suspense>
            );
        }

        // --- MyWork (unified Dashboard + My Work) ---
        // All Dashboard views redirect to MyWork as the primary home
        if (
            currentView === AppView.MY_WORK ||
            currentView === AppView.USER_DASHBOARD ||
            currentView === AppView.DASHBOARD ||
            currentView === AppView.DASHBOARD_OVERVIEW ||
            currentView === AppView.DASHBOARD_SNAPSHOT
        ) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <MyWorkView currentUser={currentUser} onNavigate={(view: string) => setCurrentView(view as AppView)} />
                </React.Suspense>
            );
        }

        // Project Intelligence Hub - AI knowledge capture
        if (currentView === AppView.PROJECT_INTELLIGENCE) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <ProjectIntelligenceView />
                </React.Suspense>
            );
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
        // DRD Assessment (AssessmentModuleHub with 4 tabs)
        if (currentView === AppView.ASSESSMENT_DRD) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SplitLayout title="DRD Assessment">
                        <AssessmentModuleHub framework="DRD" />
                    </SplitLayout>
                </React.Suspense>
            );
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
        if (currentView === AppView.ECONOMICS) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <EconomicsView />
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
        if (currentView === AppView.IMPLEMENTATION) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <ImplementationView />
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
        if (currentView === AppView.DRD_AUDIT_REPORT) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <DRDAuditReportView />
                </React.Suspense>
            );
        }
        if (currentView === AppView.KPI_OKR_DASHBOARD) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <KpiOkrView />
                </React.Suspense>
            );
        }

        // Portfolio & Roadmap Module (unified Initiative Management + Roadmap)
        if (currentView === AppView.PORTFOLIO_ROADMAP) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <PortfolioView />
                </React.Suspense>
            );
        }

        // Initiative Management Module (legacy - kept for backward compatibility)
        if (currentView === AppView.INITIATIVE_MANAGEMENT) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <PortfolioView />
                </React.Suspense>
            );
        }

        // Benefits Realization Module
        if (currentView === AppView.BENEFITS_REALIZATION) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <BenefitsRealizationView />
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
                <React.Suspense fallback={<div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" />{t('common.loadingOnboarding')}</div>}>
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

        // Consultify Studio - Visual AI Workspace
        if (currentView === AppView.STUDIO) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <StudioView />
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

        // Assessment Module Views - All frameworks use AssessmentModuleHub with 4 tabs

        // SIRI Assessment
        if (currentView === AppView.ASSESSMENT_SIRI) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SplitLayout title="SIRI Assessment">
                        <AssessmentModuleHub framework="SIRI" />
                    </SplitLayout>
                </React.Suspense>
            );
        }

        // ADMA Assessment
        if (currentView === AppView.ASSESSMENT_ADMA) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SplitLayout title="ADMA Assessment">
                        <AssessmentModuleHub framework="ADMA" />
                    </SplitLayout>
                </React.Suspense>
            );
        }

        // CMMI Assessment
        if (currentView === AppView.ASSESSMENT_CMMI) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SplitLayout title="CMMI Assessment">
                        <AssessmentModuleHub framework="CMMI" />
                    </SplitLayout>
                </React.Suspense>
            );
        }

        // Lean 4.0 Assessment
        if (currentView === AppView.ASSESSMENT_LEAN || currentView === AppView.ASSESSMENT_LEAN_EXTERNAL) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <SplitLayout title="Lean 4.0 Assessment">
                        <AssessmentModuleHub framework="LEAN" />
                    </SplitLayout>
                </React.Suspense>
            );
        }

        // Legacy: ASSESSMENT_DIGITAL_EXTERNAL - redirect to SIRI
        if (currentView === AppView.ASSESSMENT_DIGITAL_EXTERNAL) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <ExternalDigitalWorkspace organizationId={currentUser?.organizationId || ''} />
                </React.Suspense>
            );
        }

        if (currentView === AppView.ASSESSMENT_SUMMARY || currentView === AppView.ASSESSMENT_OVERVIEW) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <AssessmentHubDashboard
                        organizationId={currentUser?.organizationId || ''}
                        projectId={'default'}
                    />
                </React.Suspense>
            );
        }

        if (currentView === AppView.ASSESSMENT_AUDITS) {
            return (
                <React.Suspense fallback={<LoadingScreen />}>
                    <GenericReportsWorkspace organizationId={currentUser?.organizationId || ''} />
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

                {/* Help System - Global floating buttons + panel */}
                {isSessionView && (
                    <>
                        {/* Floating action buttons - positioned together on the right */}
                        <div className="fixed right-0 top-[66%] z-50 flex flex-col gap-3 items-end translate-x-0 pointer-events-none">
                            <div className="pointer-events-auto"><HelpToggleButton /></div>
                            <div className="pointer-events-auto"><DocumentToggleButton /></div>
                            <div className="pointer-events-auto"><FeedbackToggleButton /></div>
                        </div>
                        <HelpSidePanel />
                        <DocumentSidePanel />
                        <FeedbackSidePanel />
                        {/* ChatOverlay is disabled - replaced by new AI Chat in left sidebar */}
                        {/* <ChatOverlay hideTrigger /> */}
                    </>
                )}

                {/* Demo Banner - SmartDemoBanner with timer and upgrade CTA */}
                {currentUser?.isDemo && (
                    <React.Suspense fallback={null}>
                        {React.createElement(
                            React.lazy(() => import('./components/demo').then(mod => ({ default: mod.SmartDemoBanner }))),
                            { demoEmail: currentUser.email }
                        )}
                    </React.Suspense>
                )}

                {/* Demo Welcome Tour */}
                {currentUser?.isDemo && (
                    <DemoWelcomeTour
                        isOpen={showDemoTour}
                        onClose={() => setShowDemoTour(false)}
                        onComplete={() => setShowDemoTour(false)}
                    />
                )}

                {/* Exit Intent Modal for Demo Users */}
                {currentUser?.isDemo && (
                    <ExitIntentModal
                        isOpen={showExitIntent}
                        onClose={dismissExitIntent}
                    />
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
                    <>
                        <div className={currentUser?.isDemo ? "pt-10" : ""}>
                            <Sidebar />
                        </div>
                        {/* Mobile Bottom Navigation */}
                        <BottomNavigation />
                    </>
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
                        ${isSessionView ? 'pb-16 md:pb-0' : ''} 
                    `}
                >
                    {/* Top Bar for Session Views */}
                    {isSessionView && (
                        <div className="flex flex-col z-30 shrink-0">
                            {/* AI Freeze Banner */}
                            <AIFreezeBanner />

                            {/* Trial Banner */}
                            <TrialBanner />


                            <div className="h-12 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 shadow-sm dark:shadow-none flex items-center justify-between px-3 transition-colors duration-300">
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

                                    {/* AI Chat Toggle Button */}
                                    <button
                                        onClick={() => toggleChatCollapse()}
                                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg font-medium text-xs transition-all
                                            ${isChatCollapsed
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
                                                onRegisterClick={handleRegisterRequest}
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
                {/* Profile Completion check is now non-blocking and handled in AppContent useEffect */}
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
            {/* Invitation Acceptance Route */}
            <Route
                path="/invite/:token"
                element={<InviteRouteWrapper />}
            />
            {/* Legal Pages - Public Routes */}
            <Route
                path="/privacy"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/legal/PrivacyPolicyView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/terms"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/legal/TermsOfServiceView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/about"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/legal/AboutView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/cookies"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/legal/CookiePolicyView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/security"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/legal/SecurityView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/contact"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/legal/ContactView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/pricing"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/PricingView')))}
                    </React.Suspense>
                }
            />
            {/* Legal Document Routes (Public) */}
            <Route
                path="/legal"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/LegalIndexView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/legal/:docSlug"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/LegalDocumentView')))}
                    </React.Suspense>
                }
            />
            {/* Help System Routes */}
            <Route
                path="/docs"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/KnowledgeBaseView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/docs/:category/:article"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/KnowledgeBaseView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/status"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/StatusPageView')))}
                    </React.Suspense>
                }
            />
            <Route
                path="/changelog"
                element={
                    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
                        {React.createElement(React.lazy(() => import('./views/ChangelogView')))}
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
