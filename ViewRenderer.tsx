import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingScreen } from './components/LoadingScreen';
import { AnimationWrapper } from './components/shared/AnimationWrapper';
import { SplitLayout } from './components/SplitLayout';
import { AppView } from './types';

// View Imports - These will match the ones in App.tsx
const SuperAdminView = React.lazy(() =>
    import('./views/superadmin/SuperAdminView').then((m) => ({ default: m.SuperAdminView })),
);
const AIChatWelcomeView = React.lazy(() =>
    import('./views/AIChatWelcomeView').then((module) => ({ default: module.AIChatWelcomeView })),
);
const MyWorkView = React.lazy(() => import('./views/MyWorkView').then((m) => ({ default: m.MyWorkView })));
const ProjectIntelligenceView = React.lazy(() =>
    import('./views/ProjectIntelligenceView').then((m) => ({ default: m.ProjectIntelligenceView })),
);
const FreeAssessmentView = React.lazy(() =>
    import('./views/FreeAssessmentView').then((m) => ({ default: m.FreeAssessmentView })),
);
const TrialEntryView = React.lazy(() => import('./views/TrialEntryView.tsx').then((m) => ({ default: m.default })));
const Module1ContextView = React.lazy(() =>
    import('./views/Module1ContextView').then((m) => ({ default: m.Module1ContextView })),
);
const ContextBuilderView = React.lazy(() =>
    import('./views/ContextBuilder/ContextBuilderView').then((m) => ({ default: m.ContextBuilderView })),
);
const AssessmentModuleHub = React.lazy(() =>
    import('./components/assessment/AssessmentModuleHub').then((module) => ({ default: module.AssessmentModuleHub })),
);
const FullAssessmentView = React.lazy(() =>
    import('./views/FullAssessmentView').then((m) => ({ default: m.FullAssessmentView })),
);
const FullInitiativesView = React.lazy(() =>
    import('./views/FullInitiativesView').then((m) => ({ default: m.FullInitiativesView })),
);
const FullRoadmapView = React.lazy(() =>
    import('./views/FullRoadmapView').then((m) => ({ default: m.FullRoadmapView })),
);
const FullROIView = React.lazy(() => import('./views/FullROIView').then((m) => ({ default: m.FullROIView })));
const EconomicsView = React.lazy(() => import('./views/EconomicsView').then((m) => ({ default: m.EconomicsView })));
const FullExecutionView = React.lazy(() =>
    import('./views/FullExecutionView').then((m) => ({ default: m.FullExecutionView })),
);
const ImplementationView = React.lazy(() =>
    import('./views/ImplementationView').then((m) => ({ default: m.ImplementationView })),
);
const FullRolloutView = React.lazy(() =>
    import('./views/FullRolloutView').then((m) => ({ default: m.FullRolloutView })),
);
const FullReportsView = React.lazy(() =>
    import('./views/FullReportsView').then((m) => ({ default: m.FullReportsView })),
);
const DRDAuditReportView = React.lazy(() =>
    import('./views/DRDAuditReportView').then((m) => ({ default: m.DRDAuditReportView })),
);
const KpiOkrView = React.lazy(() => import('./views/KpiOkrView').then((m) => ({ default: m.KpiOkrView })));
const PortfolioView = React.lazy(() => import('./views/PortfolioView'));
const BenefitsRealizationView = React.lazy(() =>
    import('./views/BenefitsRealizationView').then((m) => ({ default: m.BenefitsRealizationView })),
);
const ConsultantPanelView = React.lazy(() =>
    import('./src/views/consultant/ConsultantPanelView').then((module) => ({ default: module.ConsultantPanelView })),
);
const ConsultantInviteView = React.lazy(() =>
    import('./src/views/consultant/ConsultantInviteView').then((module) => ({ default: module.ConsultantInviteView })),
);
const OrgSetupWizard = React.lazy(() =>
    import('./views/OrgSetupWizard').then((module) => ({ default: module.OrgSetupWizard })),
);
const AffiliateDashboardView = React.lazy(() =>
    import('./views/AffiliateDashboardView.tsx').then((m) => ({ default: m.default })),
);
const OnboardingWizard = React.lazy(() =>
    import('./views/OnboardingWizard').then((module) => ({ default: module.OnboardingWizard })),
);
const ActionProposalView = React.lazy(() =>
    import('./views/ActionProposalView').then((m) => ({ default: m.ActionProposalView })),
);
const StudioView = React.lazy(() => import('./views/StudioView').then((m) => ({ default: m.StudioView })));
const AdminView = React.lazy(() => import('./views/admin/AdminView').then((m) => ({ default: m.AdminView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const ExternalDigitalWorkspace = React.lazy(() =>
    import('./components/assessment/ExternalDigitalWorkspace').then((module) => ({
        default: module.ExternalDigitalWorkspace,
    })),
);
const AssessmentHubDashboard = React.lazy(() =>
    import('./components/assessment/AssessmentHubDashboard').then((module) => ({
        default: module.AssessmentHubDashboard,
    })),
);
const GenericReportsWorkspace = React.lazy(() =>
    import('./components/assessment/GenericReportsWorkspace').then((module) => ({
        default: module.GenericReportsWorkspace,
    })),
);

interface ViewRendererProps {
    currentView: AppView;
    currentUser: any;
    setCurrentView: (view: AppView) => void;
    setCurrentUser: (user: any) => void;
    logout: () => void;
    fullSessionData: any;
    setFullSessionData: (data: any) => void;
    theme: string;
    toggleTheme: () => void;
}

export const ViewRenderer: React.FC<ViewRendererProps> = ({
    currentView,
    currentUser,
    setCurrentView,
    setCurrentUser,
    logout,
    fullSessionData,
    setFullSessionData,
    theme,
    toggleTheme,
}) => {
    const { t } = useTranslation();

    if (!currentUser) return null;

    // --- SUPER ADMIN INTERCEPT ---
    if (currentUser.role === 'SUPERADMIN') {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="fade">
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
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    // --- AI Chat Welcome Screen ---
    if (currentView === AppView.AI_CHAT) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="fade">
                    <AIChatWelcomeView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    // --- MyWork (unified Dashboard + My Work) ---
    if (
        currentView === AppView.MY_WORK ||
        currentView === AppView.USER_DASHBOARD ||
        currentView === AppView.DASHBOARD ||
        currentView === AppView.DASHBOARD_OVERVIEW ||
        currentView === AppView.DASHBOARD_SNAPSHOT
    ) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <MyWorkView
                        currentUser={currentUser}
                        onNavigate={(view: string) => setCurrentView(view as AppView)}
                    />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    // Project Intelligence Hub
    if (currentView === AppView.PROJECT_INTELLIGENCE) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <ProjectIntelligenceView />
                </AnimationWrapper>
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
            <React.Suspense fallback={<LoadingScreen />}>
                <FreeAssessmentView />
            </React.Suspense>
        );
    }

    // Trial Entry View
    if (currentView === AppView.TRIAL_ENTRY) {
        return <TrialEntryView onStartTrial={() => setCurrentView(AppView.AUTH as any)} />;
    }

    // Full Transformation Views
    if (currentView === AppView.FULL_STEP1_CONTEXT) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <Module1ContextView
                    currentUser={currentUser}
                    fullSession={fullSessionData}
                    setFullSession={setFullSessionData}
                    onNavigate={setCurrentView}
                />
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
            case AppView.CONTEXT_BUILDER_PROFILE:
                initialTab = 1;
                break;
            case AppView.CONTEXT_BUILDER_GOALS:
                initialTab = 2;
                break;
            case AppView.CONTEXT_BUILDER_CHALLENGES:
                initialTab = 3;
                break;
            case AppView.CONTEXT_BUILDER_MEGATRENDS:
                initialTab = 4;
                break;
            case AppView.CONTEXT_BUILDER_STRATEGY:
                initialTab = 5;
                break;
            default:
                initialTab = 1;
                break;
        }
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <ContextBuilderView initialTab={initialTab} />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    // DRD Assessment
    if (currentView === AppView.ASSESSMENT_DRD) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="fade">
                    <SplitLayout title="DRD Assessment">
                        <AssessmentModuleHub framework="DRD" />
                    </SplitLayout>
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_STEP1_ASSESSMENT || currentView.startsWith('FULL_STEP1_')) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullAssessmentView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_STEP2_INITIATIVES) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullInitiativesView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_STEP3_ROADMAP) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullRoadmapView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_STEP4_ROI) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullROIView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.ECONOMICS) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <EconomicsView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_STEP5_EXECUTION) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullExecutionView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.IMPLEMENTATION) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <ImplementationView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_ROLLOUT) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullRolloutView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.FULL_STEP6_REPORTS) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <FullReportsView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.DRD_AUDIT_REPORT) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <DRDAuditReportView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.KPI_OKR_DASHBOARD) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <KpiOkrView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.PORTFOLIO_ROADMAP) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <PortfolioView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.INITIATIVE_MANAGEMENT) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <PortfolioView />
            </React.Suspense>
        );
    }

    if (currentView === AppView.BENEFITS_REALIZATION) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <BenefitsRealizationView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.CONSULTANT_PANEL) {
        return (
            <React.Suspense
                fallback={
                    <div className="p-8 text-center text-slate-500">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Loading Consultant Panel...
                    </div>
                }
            >
                <AnimationWrapper variant="fade">
                    <ConsultantPanelView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.CONSULTANT_INVITES) {
        return (
            <React.Suspense
                fallback={
                    <div className="p-8 text-center text-slate-500">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Loading Invite Tool...
                    </div>
                }
            >
                <AnimationWrapper variant="fade">
                    <ConsultantInviteView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.ORG_SETUP_WIZARD) {
        return (
            <React.Suspense
                fallback={
                    <div className="p-8 text-center text-slate-500">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Loading Organization Setup...
                    </div>
                }
            >
                <AnimationWrapper variant="slideUp">
                    <OrgSetupWizard />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.AFFILIATE_DASHBOARD) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AffiliateDashboardView />
            </React.Suspense>
        );
    }

    if (currentView === AppView.ONBOARDING_WIZARD) {
        return (
            <React.Suspense
                fallback={
                    <div className="p-8 text-center text-slate-500">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        {t('common.loadingOnboarding')}
                    </div>
                }
            >
                <AnimationWrapper variant="slideUp">
                    <OnboardingWizard />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.AI_ACTION_PROPOSALS) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <ActionProposalView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.STUDIO) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <StudioView />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView.startsWith('ADMIN')) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="fade">
                    <AdminView currentUser={currentUser} onNavigate={setCurrentView as any} />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView.startsWith('SETTINGS')) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="fade">
                    <SettingsView
                        currentUser={currentUser}
                        onUpdateUser={(updates: Partial<any>) =>
                            setCurrentUser(currentUser ? { ...currentUser, ...updates } : null)
                        }
                        theme={theme as 'light' | 'dark' | 'system'}
                        toggleTheme={toggleTheme}
                    />
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.ASSESSMENT_SIRI) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <SplitLayout title="SIRI Assessment">
                        <AssessmentModuleHub framework="SIRI" />
                    </SplitLayout>
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.ASSESSMENT_ADMA) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <SplitLayout title="ADMA Assessment">
                        <AssessmentModuleHub framework="ADMA" />
                    </SplitLayout>
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.ASSESSMENT_CMMI) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <SplitLayout title="CMMI Assessment">
                        <AssessmentModuleHub framework="CMMI" />
                    </SplitLayout>
                </AnimationWrapper>
            </React.Suspense>
        );
    }

    if (currentView === AppView.ASSESSMENT_LEAN || currentView === AppView.ASSESSMENT_LEAN_EXTERNAL) {
        return (
            <React.Suspense fallback={<LoadingScreen />}>
                <AnimationWrapper variant="slideUp">
                    <SplitLayout title="Lean 4.0 Assessment">
                        <AssessmentModuleHub framework="LEAN" />
                    </SplitLayout>
                </AnimationWrapper>
            </React.Suspense>
        );
    }

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
                <AssessmentHubDashboard organizationId={currentUser?.organizationId || ''} projectId={'default'} />
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
