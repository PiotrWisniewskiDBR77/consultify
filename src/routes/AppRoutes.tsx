import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AnimationWrapper } from '@/components/shared/AnimationWrapper';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { AppView, AuthStep, SessionMode, User } from '@/types';
import { AuthView } from '@/views/AuthView';
import { ProductEntryPage } from '@/views/ProductEntryPage';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { ROUTES } from './routeConfig';

// Lazy load views for new routes
const StudioView = React.lazy(() => import('@/views/StudioView').then((m) => ({ default: m.StudioView })));
const MyWorkView = React.lazy(() => import('@/views/MyWorkView').then((m) => ({ default: m.MyWorkView })));
const ContextBuilderView = React.lazy(() =>
    import('@/views/ContextBuilder/ContextBuilderView').then((m) => ({ default: m.ContextBuilderView }))
);
const AssessmentModuleHub = React.lazy(() =>
    import('@/components/assessment/AssessmentModuleHub').then((m) => ({ default: m.AssessmentModuleHub }))
);
const AssessmentHubDashboard = React.lazy(() =>
    import('@/components/assessment/AssessmentHubDashboard').then((m) => ({ default: m.AssessmentHubDashboard }))
);

// Transformation Modules
const FullInitiativesView = React.lazy(() =>
    import('@/views/FullInitiativesView').then((m) => ({ default: m.FullInitiativesView }))
);
const FullRoadmapView = React.lazy(() => import('@/views/FullRoadmapView').then((m) => ({ default: m.FullRoadmapView })));
const PortfolioView = React.lazy(() => import('@/views/PortfolioView'));
const FullROIView = React.lazy(() => import('@/views/FullROIView').then((m) => ({ default: m.FullROIView })));
const EconomicsView = React.lazy(() => import('@/views/EconomicsView').then((m) => ({ default: m.EconomicsView })));
const FullExecutionView = React.lazy(() =>
    import('@/views/FullExecutionView').then((m) => ({ default: m.FullExecutionView }))
);
const ImplementationView = React.lazy(() =>
    import('@/views/ImplementationView').then((m) => ({ default: m.ImplementationView }))
);
const FullRolloutView = React.lazy(() => import('@/views/FullRolloutView').then((m) => ({ default: m.FullRolloutView })));
const FullReportsView = React.lazy(() => import('@/views/FullReportsView').then((m) => ({ default: m.FullReportsView })));
const KpiOkrView = React.lazy(() => import('@/views/KpiOkrView').then((m) => ({ default: m.KpiOkrView })));
const BenefitsRealizationView = React.lazy(() =>
    import('@/views/BenefitsRealizationView').then((m) => ({ default: m.BenefitsRealizationView }))
);

// Settings
const SettingsView = React.lazy(() => import('@/views/SettingsView').then((m) => ({ default: m.SettingsView })));

// Admin
const AdminView = React.lazy(() => import('@/views/admin/AdminView').then((m) => ({ default: m.AdminView })));

export const AppRoutes: React.FC = () => {
    const {
        currentView,
        currentUser,
        setCurrentView,
        setCurrentUser,
        setCurrentOrganization,
        setSessionMode,
        setAuthInitialStep,
        authInitialStep,
        sessionMode,
        logout,
        fullSessionData,
        setFullSessionData,
        theme,
        toggleTheme,
    } = useAppStore();

    const breadcrumbs = useBreadcrumbs();

    const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

    // --- HANDLERS (Moved from App.tsx) ---

    const handleStartSession = (mode: SessionMode) => {
        setSessionMode(mode);

        if (currentUser?.isAuthenticated) {
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
        window.history.pushState({}, '', '/login');
    };

    const handleRegisterRequest = () => {
        setSessionMode(SessionMode.FREE);
        setAuthInitialStep(AuthStep.REGISTER);
        setCurrentView(AppView.AUTH);
        window.history.pushState({}, '', '/register');
    };

    const handleAuthSuccess = (user: User | { status?: string; message?: string }) => {
        if ('status' in user && user.status !== 'success' && 'message' in user) {
            console.error('Auth error:', user.message);
            return;
        }

        if (!('id' in user) || !('email' in user)) {
            console.error('Invalid user object received');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Authentication succeeded but token was not stored');
            Api.getUsers().catch(() => {
                console.error('Failed to verify authentication - redirecting to login');
                setCurrentView(AppView.AUTH);
                setAuthInitialStep(AuthStep.LOGIN);
            });
            return;
        }

        const validUser = user as User;
        const authenticatedUser: User = {
            ...validUser,
            isAuthenticated: true,
        };
        setCurrentUser(authenticatedUser);

        if (validUser.organizationId) {
            setCurrentOrganization({
                id: validUser.organizationId,
                name: validUser.organizationName || 'Organization',
            });
        }

        setCurrentView(AppView.AI_CHAT);
        window.history.pushState({}, '', '/chat');
    };

    // --- RENDER ---


    if (currentView === AppView.WELCOME) {
        return (
            <AuthLayout>
                <ProductEntryPage
                    onStartSession={handleStartSession}
                    onLoginClick={handleLoginRequest}
                    onRegisterClick={handleRegisterRequest}
                />
            </AuthLayout>
        );
    }

    if (currentView === AppView.AUTH) {
        return (
            <AuthLayout>
                <AuthView
                    initialStep={authInitialStep}
                    targetMode={sessionMode || SessionMode.FREE}
                    onAuthSuccess={handleAuthSuccess}
                    onBack={() => setCurrentView(AppView.WELCOME)}
                />
            </AuthLayout>
        );
    }

    return (
        <MainLayout breadcrumbs={breadcrumbs || ['Dashboard', 'Home']}>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                }
            >
                <Routes>
                    {/* New React Router routes - gradually add more here */}
                    <Route
                        path={ROUTES.STUDIO}
                        element={
                            <AnimationWrapper variant="slideUp">
                                <StudioView />
                            </AnimationWrapper>
                        }
                    />
                    <Route
                        path={ROUTES.MY_WORK}
                        element={
                            <AnimationWrapper variant="slideUp">
                                <MyWorkView currentUser={currentUser} onNavigate={(view) => setCurrentView(view as AppView)} />
                            </AnimationWrapper>
                        }
                    />

                    {/* Context Builder with nested routes */}
                    <Route
                        path={`${ROUTES.CONTEXT_BUILDER.ROOT}/*`}
                        element={
                            <AnimationWrapper variant="slideUp">
                                <Routes>
                                    <Route index element={<ContextBuilderView initialTab={1} />} />
                                    <Route path="profile" element={<ContextBuilderView initialTab={1} />} />
                                    <Route path="goals" element={<ContextBuilderView initialTab={2} />} />
                                    <Route path="challenges" element={<ContextBuilderView initialTab={3} />} />
                                    <Route path="megatrends" element={<ContextBuilderView initialTab={4} />} />
                                    <Route path="strategy" element={<ContextBuilderView initialTab={5} />} />
                                </Routes>
                            </AnimationWrapper>
                        }
                    />

                    {/* Assessment with nested framework routes */}
                    <Route
                        path={`${ROUTES.ASSESSMENT.ROOT}/*`}
                        element={
                            <AnimationWrapper variant="fade">
                                <Routes>
                                    <Route index element={<AssessmentHubDashboard organizationId={currentUser?.organizationId || ''} projectId="default" />} />
                                    <Route path="drd" element={<AssessmentModuleHub framework="DRD" />} />
                                    <Route path="siri" element={<AssessmentModuleHub framework="SIRI" />} />
                                    <Route path="adma" element={<AssessmentModuleHub framework="ADMA" />} />
                                    <Route path="cmmi" element={<AssessmentModuleHub framework="CMMI" />} />
                                    <Route path="lean" element={<AssessmentModuleHub framework="LEAN" />} />
                                    <Route path="overview" element={<AssessmentHubDashboard organizationId={currentUser?.organizationId || ''} projectId="default" />} />
                                    <Route path="summary" element={<AssessmentHubDashboard organizationId={currentUser?.organizationId || ''} projectId="default" />} />
                                </Routes>
                            </AnimationWrapper>
                        }
                    />

                    {/* Transformation Modules */}
                    <Route path={ROUTES.INITIATIVES} element={<AnimationWrapper variant="slideUp"><FullInitiativesView /></AnimationWrapper>} />
                    <Route path={ROUTES.ROADMAP} element={<AnimationWrapper variant="slideUp"><FullRoadmapView /></AnimationWrapper>} />
                    <Route path={ROUTES.PORTFOLIO} element={<AnimationWrapper variant="slideUp"><PortfolioView /></AnimationWrapper>} />
                    <Route path={ROUTES.ROI} element={<AnimationWrapper variant="slideUp"><FullROIView /></AnimationWrapper>} />
                    <Route path={ROUTES.ECONOMICS} element={<AnimationWrapper variant="slideUp"><EconomicsView /></AnimationWrapper>} />
                    <Route path={ROUTES.EXECUTION} element={<AnimationWrapper variant="slideUp"><FullExecutionView /></AnimationWrapper>} />
                    <Route path={ROUTES.IMPLEMENTATION} element={<AnimationWrapper variant="slideUp"><ImplementationView /></AnimationWrapper>} />
                    <Route path={ROUTES.ROLLOUT} element={<AnimationWrapper variant="slideUp"><FullRolloutView /></AnimationWrapper>} />
                    <Route path={ROUTES.REPORTS} element={<AnimationWrapper variant="slideUp"><FullReportsView /></AnimationWrapper>} />
                    <Route path={ROUTES.KPI_OKR} element={<AnimationWrapper variant="slideUp"><KpiOkrView /></AnimationWrapper>} />
                    <Route path={ROUTES.BENEFITS} element={<AnimationWrapper variant="slideUp"><BenefitsRealizationView /></AnimationWrapper>} />

                    {/* Settings with nested routes */}
                    <Route
                        path={`${ROUTES.SETTINGS.ROOT}/*`}
                        element={
                            <AnimationWrapper variant="fade">
                                <SettingsView
                                    currentUser={currentUser}
                                    onUpdateUser={(updates) => setCurrentUser(currentUser ? { ...currentUser, ...updates } : null)}
                                    theme={theme as 'light' | 'dark' | 'system'}
                                    toggleTheme={toggleTheme}
                                />
                            </AnimationWrapper>
                        }
                    />

                    {/* Admin with nested routes */}
                    <Route
                        path={`${ROUTES.ADMIN.ROOT}/*`}
                        element={
                            <AnimationWrapper variant="fade">
                                <AdminView
                                    currentUser={currentUser}
                                    onNavigate={(view) => setCurrentView(view as AppView)}
                                />
                            </AnimationWrapper>
                        }
                    />

                    {/* 404 - Redirect to dashboard */}
                    <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                </Routes>
            </Suspense>
        </MainLayout>
    );
};
