import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

import { ConversationRouteSync } from '@/components/AIChat/ConversationRouteSync';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { AnimationWrapper } from '@/components/shared/AnimationWrapper';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { AppView, AuthStep, SessionMode, User } from '@/types';
import { AuthView } from '@/views/AuthView';
import { ProductEntryPage } from '@/views/ProductEntryPage';

import { LegacyAssessmentReportRedirect } from './LegacyAssessmentReportRedirect';
import { ROUTES } from './routeConfig';

// Lazy load views for new routes
const StudioView = React.lazy(() =>
  import('@/views/StudioView').then((m) => ({ default: m.StudioView }))
);
const MyWorkView = React.lazy(() =>
  import('@/views/MyWorkView').then((m) => ({ default: m.MyWorkView }))
);
const ContextBuilderView = React.lazy(() =>
  import('@/views/ContextBuilder/ContextBuilderView').then((m) => ({
    default: m.ContextBuilderView,
  }))
);
const AssessmentModuleHub = React.lazy(() =>
  import('@/components/assessment/AssessmentModuleHub').then((m) => ({
    default: m.AssessmentModuleHub,
  }))
);
const AssessmentHubDashboard = React.lazy(() =>
  import('@/components/assessment/AssessmentHubDashboard').then((m) => ({
    default: m.AssessmentHubDashboard,
  }))
);

// Discovery Tools Module - New Hub
const DiscoveryToolsHub = React.lazy(() =>
  import('@/components/Discovery/DiscoveryToolsHub').then((m) => ({ default: m.DiscoveryToolsHub }))
);
// Legacy Discovery Tools Views (keeping for backward compatibility)
const DiscoveryToolsView = React.lazy(() =>
  import('@/views/discovery-tools/DiscoveryToolsView').then((m) => ({
    default: m.DiscoveryToolsView,
  }))
);
const StrategicToolsView = React.lazy(() =>
  import('@/views/discovery-tools/StrategicToolsView').then((m) => ({
    default: m.StrategicToolsView,
  }))
);
const OperationalToolsView = React.lazy(() =>
  import('@/views/discovery-tools/OperationalToolsView').then((m) => ({
    default: m.OperationalToolsView,
  }))
);
const DigitalToolsView = React.lazy(() =>
  import('@/views/discovery-tools/DigitalToolsView').then((m) => ({ default: m.DigitalToolsView }))
);
const ProcessAutomationView = React.lazy(() =>
  import('@/views/discovery-tools/ProcessAutomationView').then((m) => ({
    default: m.ProcessAutomationView,
  }))
);

// Assessment Module - New Hub
const AssessmentHub = React.lazy(() =>
  import('@/components/assessment/AssessmentHub').then((m) => ({ default: m.AssessmentHub }))
);
const AssessmentSessionEditorView = React.lazy(() =>
  import('@/views/AssessmentSessionEditorView').then((m) => ({
    default: m.AssessmentSessionEditorView,
  }))
);

// Transformation Modules - New Hubs (ModuleHub pattern)
const InitiativesHub = React.lazy(() =>
  import('@/components/Initiatives/InitiativesHub').then((m) => ({ default: m.InitiativesHub }))
);
const ExecutionHub = React.lazy(() =>
  import('@/components/Execution/ExecutionHub').then((m) => ({ default: m.ExecutionHub }))
);
const BenefitsHub = React.lazy(() =>
  import('@/components/Benefits/BenefitsHub').then((m) => ({ default: m.BenefitsHub }))
);

// Legacy views (kept for backward compatibility)
const FullInitiativesView = React.lazy(() =>
  import('@/views/FullInitiativesView').then((m) => ({ default: m.FullInitiativesView }))
);
const FullRoadmapView = React.lazy(() =>
  import('@/views/FullRoadmapView').then((m) => ({ default: m.FullRoadmapView }))
);
const PortfolioView = React.lazy(() => import('@/views/PortfolioView'));
const FullROIView = React.lazy(() =>
  import('@/views/FullROIView').then((m) => ({ default: m.FullROIView }))
);
const EconomicsView = React.lazy(() =>
  import('@/views/EconomicsView').then((m) => ({ default: m.EconomicsView }))
);
const FullExecutionView = React.lazy(() =>
  import('@/views/FullExecutionView').then((m) => ({ default: m.FullExecutionView }))
);
const ImplementationView = React.lazy(() =>
  import('@/views/ImplementationView').then((m) => ({ default: m.ImplementationView }))
);
const FullRolloutView = React.lazy(() =>
  import('@/views/FullRolloutView').then((m) => ({ default: m.FullRolloutView }))
);
const FullReportsView = React.lazy(() =>
  import('@/views/FullReportsView').then((m) => ({ default: m.FullReportsView }))
);
const ReportBuilderView = React.lazy(() =>
  import('@/views/ReportBuilderView').then((m) => ({ default: m.ReportBuilderView }))
);
const AssessmentReportBuilderView = React.lazy(() =>
  import('@/views/AssessmentReportBuilderView').then((m) => ({
    default: m.AssessmentReportBuilderView,
  }))
);
const KpiOkrView = React.lazy(() =>
  import('@/views/KpiOkrView').then((m) => ({ default: m.KpiOkrView }))
);
const BenefitsRealizationView = React.lazy(() =>
  import('@/views/BenefitsRealizationView').then((m) => ({ default: m.BenefitsRealizationView }))
);

// Settings
const SettingsView = React.lazy(() =>
  import('@/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

// Organization
const OrganizationView = React.lazy(() =>
  import('@/views/OrganizationView').then((m) => ({ default: m.OrganizationView }))
);

// Admin
const AdminView = React.lazy(() =>
  import('@/views/admin/AdminView').then((m) => ({ default: m.AdminView }))
);

// SuperAdmin
const SuperAdminView = React.lazy(() =>
  import('@/views/superadmin/SuperAdminView').then((m) => ({ default: m.SuperAdminView }))
);

// AI Chat (Full Screen Chat View)
const AIChatWelcomeView = React.lazy(() => import('@/views/AIChatWelcomeView'));

// Discovery Consultant (AI Discovery with Canvas)
const DiscoveryConsultantView = React.lazy(() =>
  import('@/components/Discovery/DiscoveryConsultantView').then((m) => ({
    default: m.DiscoveryConsultantView,
  }))
);

// Become Partner (Public Partner Recruitment Page)
const BecomePartnerView = React.lazy(() => import('@/views/BecomePartnerView'));

// Dashboard - DEPRECATED: Removed, redirects to Chat

// Project Intelligence (legacy)
const ProjectIntelligenceView = React.lazy(() =>
  import('@/views/ProjectIntelligenceView').then((m) => ({ default: m.ProjectIntelligenceView }))
);

// Interview Module - New Hub (ModuleHub pattern) - BCG Enterprise Level
const InterviewHub = React.lazy(() =>
  import('@/components/Interview/InterviewHub').then((m) => ({ default: m.InterviewHub }))
);

// AI Actions
const ActionProposalView = React.lazy(() =>
  import('@/views/ActionProposalView').then((m) => ({ default: m.ActionProposalView }))
);

// Partner Portal - New DBR77 Consultinity Partner Portal
const PartnerPortalViewNew = React.lazy(() =>
  import('@/views/partner/PartnerPortalView').then((m) => ({ default: m.PartnerPortalViewNew }))
);

// Partner Portal - Legacy (to be removed)
const PartnerPortalView = React.lazy(() =>
  import('@/views/PartnerPortalView').then((m) => ({ default: m.PartnerPortalView }))
);
const PartnerPricingView = React.lazy(() =>
  import('@/views/partner/PartnerPricingView').then((m) => ({ default: m.PartnerPricingView }))
);
const PartnerDashboardView = React.lazy(() =>
  import('@/views/partner/PartnerDashboardView').then((m) => ({ default: m.PartnerDashboardView }))
);
const ClientAccessView = React.lazy(() =>
  import('@/views/partner/ClientAccessView').then((m) => ({ default: m.ClientAccessView }))
);
const CommissionView = React.lazy(() =>
  import('@/views/partner/CommissionView').then((m) => ({ default: m.CommissionView }))
);
const DirectoryView = React.lazy(() =>
  import('@/views/partner/DirectoryView').then((m) => ({ default: m.DirectoryView }))
);
const ResourcesView = React.lazy(() =>
  import('@/views/partner/ResourcesView').then((m) => ({ default: m.ResourcesView }))
);
const ProviderHomeView = React.lazy(() =>
  import('@/views/partner/ProviderHomeView').then((m) => ({ default: m.ProviderHomeView }))
);

// Consultant
const ConsultantPanelView = React.lazy(() =>
  import('@/views/consultant/ConsultantPanelView').then((m) => ({ default: m.ConsultantPanelView }))
);
const ConsultantInviteView = React.lazy(() =>
  import('@/views/consultant/ConsultantInviteView').then((m) => ({
    default: m.ConsultantInviteView,
  }))
);

// Wizards
const OrgSetupWizard = React.lazy(() =>
  import('@/views/OrgSetupWizard').then((m) => ({ default: m.OrgSetupWizard }))
);
const OnboardingWizard = React.lazy(() =>
  import('@/views/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard }))
);
const TrialEntryView = React.lazy(() =>
  import('@/views/TrialEntryView').then((m) => ({ default: m.TrialEntryView }))
);

// Affiliate
const AffiliateDashboardView = React.lazy(() =>
  import('@/views/AffiliateDashboardView').then((m) => ({ default: m.AffiliateDashboardView }))
);

// Legal Pages
const AboutView = React.lazy(() =>
  import('@/views/legal/AboutView').then((m) => ({ default: m.AboutView }))
);
const ContactView = React.lazy(() =>
  import('@/views/legal/ContactView').then((m) => ({ default: m.ContactView }))
);
const TermsOfServiceView = React.lazy(() =>
  import('@/views/legal/TermsOfServiceView').then((m) => ({ default: m.TermsOfServiceView }))
);
const PrivacyPolicyView = React.lazy(() =>
  import('@/views/legal/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView }))
);
const CookiePolicyView = React.lazy(() =>
  import('@/views/legal/CookiePolicyView').then((m) => ({ default: m.CookiePolicyView }))
);
const SecurityView = React.lazy(() =>
  import('@/views/legal/SecurityView').then((m) => ({ default: m.SecurityView }))
);

// Status & Changelog
const StatusPageView = React.lazy(() =>
  import('@/views/StatusPageView').then((m) => ({ default: m.StatusPageView }))
);
const ChangelogView = React.lazy(() =>
  import('@/views/ChangelogView').then((m) => ({ default: m.ChangelogView }))
);

// Knowledge Base & Pricing
const KnowledgeBaseView = React.lazy(() =>
  import('@/views/KnowledgeBaseView').then((m) => ({ default: m.KnowledgeBaseView }))
);
const AppPricingView = React.lazy(() =>
  import('@/views/AppPricingView').then((m) => ({ default: m.AppPricingView }))
);
const ExecutiveView = React.lazy(() =>
  import('@/views/ExecutiveView').then((m) => ({ default: m.ExecutiveView }))
);

// Documentation Portal (Public)
const DocsLayout = React.lazy(() =>
  import('@/layouts/DocsLayout').then((m) => ({ default: m.DocsLayout }))
);
const DocsHomeView = React.lazy(() =>
  import('@/views/docs/DocsHomeView').then((m) => ({ default: m.DocsHomeView }))
);
const DocsCategoryView = React.lazy(() =>
  import('@/views/docs/DocsCategoryView').then((m) => ({ default: m.DocsCategoryView }))
);
const DocsArticleView = React.lazy(() =>
  import('@/views/docs/DocsArticleView').then((m) => ({ default: m.DocsArticleView }))
);
const DocsSearchView = React.lazy(() =>
  import('@/views/docs/DocsSearchView').then((m) => ({ default: m.DocsSearchView }))
);
const DocsApiReferenceView = React.lazy(() =>
  import('@/views/docs/DocsApiReferenceView').then((m) => ({ default: m.DocsApiReferenceView }))
);
const DocsChangelogView = React.lazy(() =>
  import('@/views/docs/DocsChangelogView').then((m) => ({ default: m.DocsChangelogView }))
);
const DocsSecurityView = React.lazy(() =>
  import('@/views/docs/DocsSecurityView').then((m) => ({ default: m.DocsSecurityView }))
);

// Education Hub (Public)
const ToolsShowcasePage = React.lazy(() =>
  import('@/views/ToolsShowcasePage').then((m) => ({ default: m.ToolsShowcasePage }))
);
const AuditsShowcasePage = React.lazy(() =>
  import('@/views/AuditsShowcasePage').then((m) => ({ default: m.AuditsShowcasePage }))
);

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
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
    setNavigateFn,
    isAuthInitializing,
    // Demo slice
    setDemoMode,
    resetDemoState,
  } = useAppStore();

  const breadcrumbs = useBreadcrumbs();

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

  // Set navigate function in store so setCurrentView can use React Router
  React.useEffect(() => {
    setNavigateFn(navigate);
  }, [navigate, setNavigateFn]);

  // --- HANDLERS (Moved from App.tsx) ---

  const handleStartSession = (mode: SessionMode) => {
    setSessionMode(mode);

    if (currentUser?.isAuthenticated) {
      setCurrentView(AppView.AI_CHAT);
      navigate('/chat');
      return;
    }

    if (mode === SessionMode.FREE || mode === SessionMode.DEMO) {
      navigate('/demo');
      setAuthInitialStep(AuthStep.REGISTER);
      setCurrentView(AppView.AUTH);
    } else {
      navigate('/trial/start');
      setAuthInitialStep(AuthStep.CODE_ENTRY);
      setCurrentView(AppView.AUTH);
    }
  };

  const handleLoginRequest = () => {
    console.log('[AppRoutes] handleLoginRequest called!');
    setSessionMode(SessionMode.FREE);
    setAuthInitialStep(AuthStep.LOGIN);
    console.log('[AppRoutes] Navigating to /login...');
    navigate('/login');
    console.log('[AppRoutes] navigate called');
  };

  const handleRegisterRequest = () => {
    setSessionMode(SessionMode.FREE);
    setAuthInitialStep(AuthStep.REGISTER);
    navigate('/register');
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
    // Demo sessions should only be enabled for demo accounts and demo-button entry.
    // If a regular user logs in after previously starting a demo session, we must clear stale flags.
    const DEMO_EMAILS = new Set(['piotr.wisniewski@demo.com']);
    const FORCE_DEMO_OFF_EMAIL = 'piotr.wisniewski@dbr77.com';
    const isDemoUser = (validUser as any).isDemo === true || DEMO_EMAILS.has(validUser.email);

    try {
      if (isDemoUser) {
        sessionStorage.setItem('isDemo', 'true');
      } else {
        sessionStorage.removeItem('isDemo');
        localStorage.removeItem('consultinity_demo_session');
        localStorage.removeItem('demo_events');
        // Ensure "demo org overlay" mode is OFF for normal users
        setDemoMode(false);
        resetDemoState();
      }
    } catch {
      // ignore storage errors
    }

    // Hard override: this account should never have demo mode enabled.
    if (validUser.email === FORCE_DEMO_OFF_EMAIL) {
      try {
        sessionStorage.removeItem('isDemo');
        localStorage.removeItem('consultinity_demo_session');
        localStorage.removeItem('demo_events');
      } catch {
        // ignore
      }
      setDemoMode(false);
      resetDemoState();
      (validUser as any).isDemo = false;
    }

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

    // Navigate based on user role - SUPERADMIN goes to SuperAdmin panel
    if (validUser.role === 'SUPERADMIN') {
      console.log('[AppRoutes] SUPERADMIN user detected, redirecting to /superadmin');
      navigate('/superadmin');
    } else {
      // Regular users go to chat
      navigate('/chat');
    }
  };

  // --- RENDER ---
  // All routing now goes through React Router - removed blocking if/else conditions

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <Routes>
        {/* ============================================ */}
        {/* PUBLIC ROUTES - No MainLayout wrapper        */}
        {/* ============================================ */}

        {/* Welcome / Landing Page */}
        <Route
          path={ROUTES.WELCOME}
          element={
            currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <ProductEntryPage
                  onStartSession={handleStartSession}
                  onLoginClick={handleLoginRequest}
                  onRegisterClick={handleRegisterRequest}
                />
              </AuthLayout>
            )
          }
        />

        {/* Become Partner - Public Partner Recruitment Page */}
        <Route
          path={ROUTES.BECOME_PARTNER}
          element={
            <AuthLayout>
              <AnimationWrapper variant="fade">
                <BecomePartnerView />
              </AnimationWrapper>
            </AuthLayout>
          }
        />

        {/* Documentation Portal - Public Routes */}
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsHomeView />} />
          <Route path="search" element={<DocsSearchView />} />
          <Route path="api" element={<DocsApiReferenceView />} />
          <Route path="changelog" element={<DocsChangelogView />} />
          <Route path="security" element={<DocsSecurityView />} />
          <Route path=":categorySlug" element={<DocsCategoryView />} />
          <Route path=":categorySlug/:articleSlug" element={<DocsArticleView />} />
        </Route>

        {/* Tools Showcase - Education Hub (Public) */}
        <Route
          path="/tools"
          element={
            <AuthLayout>
              <Suspense fallback={<LoadingScreen message="Loading tools..." />}>
                <ToolsShowcasePage />
              </Suspense>
            </AuthLayout>
          }
        />

        {/* Audits Showcase - Industrial Excellence (Public) */}
        <Route
          path="/audits"
          element={
            <AuthLayout>
              <Suspense fallback={<LoadingScreen message="Loading audits..." />}>
                <AuditsShowcasePage />
              </Suspense>
            </AuthLayout>
          }
        />

        {/* Login - stable key prevents remount during auth initialization */}
        <Route
          path="/login"
          element={
            !isAuthInitializing && currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <AuthView
                  key="login-form-stable"
                  initialStep={AuthStep.LOGIN}
                  targetMode={sessionMode || SessionMode.FREE}
                  onAuthSuccess={handleAuthSuccess}
                  onBack={() => navigate('/')}
                />
              </AuthLayout>
            )
          }
        />

        {/* Register - stable key prevents remount during auth initialization */}
        <Route
          path="/register"
          element={
            !isAuthInitializing && currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <AuthView
                  key="register-form-stable"
                  initialStep={AuthStep.REGISTER}
                  targetMode={sessionMode || SessionMode.FREE}
                  onAuthSuccess={handleAuthSuccess}
                  onBack={() => navigate('/')}
                />
              </AuthLayout>
            )
          }
        />

        {/* Demo - stable key prevents remount during auth initialization */}
        <Route
          path="/demo"
          element={
            !isAuthInitializing && currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <AuthView
                  key="demo-form-stable"
                  initialStep={AuthStep.REGISTER}
                  targetMode={SessionMode.DEMO}
                  onAuthSuccess={handleAuthSuccess}
                  onBack={() => navigate('/')}
                />
              </AuthLayout>
            )
          }
        />

        {/* Trial Start - stable key prevents remount during auth initialization */}
        <Route
          path="/trial/start"
          element={
            !isAuthInitializing && currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <AuthView
                  key="trial-form-stable"
                  initialStep={AuthStep.CODE_ENTRY}
                  targetMode={SessionMode.FULL}
                  onAuthSuccess={handleAuthSuccess}
                  onBack={() => navigate('/')}
                />
              </AuthLayout>
            )
          }
        />

        {/* Legacy /auth route */}
        <Route
          path={ROUTES.AUTH}
          element={
            currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <AuthView
                  initialStep={authInitialStep}
                  targetMode={sessionMode || SessionMode.FREE}
                  onAuthSuccess={handleAuthSuccess}
                  onBack={() => navigate('/')}
                />
              </AuthLayout>
            )
          }
        />

        {/* ============================================ */}
        {/* PROTECTED ROUTES - With MainLayout wrapper   */}
        {/* ============================================ */}

        {/* Studio */}
        <Route
          path={ROUTES.STUDIO}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Studio']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <StudioView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* My Work */}
        <Route
          path={ROUTES.MY_WORK}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['My Work']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <MyWorkView
                    currentUser={currentUser as any}
                    onNavigate={(view) => setCurrentView(view as AppView)}
                  />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* AI Chat - Full Screen Chat View */}
        <Route
          path={ROUTES.AI_CHAT}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['AI Chat']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="fade">
                  <ConversationRouteSync />
                  <AIChatWelcomeView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* AI Chat with Conversation ID - deep link to specific conversation */}
        <Route
          path={ROUTES.AI_CHAT_CONVERSATION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['AI Chat']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="fade">
                  <ConversationRouteSync />
                  <AIChatWelcomeView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* Discovery Consultant - Redirects to Interview Hub */}
        <Route
          path={ROUTES.DISCOVERY_CONSULTANT}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Interview']} noPadding>
              <RouteErrorBoundary>
                <InterviewHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* Dashboard - DEPRECATED: Redirect to Chat */}
        <Route path="/dashboard" element={<Navigate to={ROUTES.AI_CHAT} replace />} />

        {/* Interview Module - New Hub (ModuleHub pattern) */}
        <Route
          path={ROUTES.INTERVIEW}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Interview']} noPadding>
              <RouteErrorBoundary>
                <InterviewHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        {/* Project Intelligence (legacy - redirects to Interview) */}
        <Route
          path={ROUTES.PROJECT_INTELLIGENCE}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Interview']} noPadding>
              <RouteErrorBoundary>
                <InterviewHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* Discovery Tools Module - New Hub */}
        <Route
          path={ROUTES.DISCOVERY_TOOLS.ROOT}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Discovery Tools']} noPadding>
              <RouteErrorBoundary>
                <DiscoveryToolsHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        {/* Discovery Tools - Strategic Tools with ToolWorkspace */}
        <Route
          path={ROUTES.DISCOVERY_TOOLS.STRATEGIC}
          element={
            <MainLayout
              breadcrumbs={breadcrumbs || ['Discovery Tools', 'Strategic Analysis']}
              noPadding
            >
              <RouteErrorBoundary>
                <StrategicToolsView />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.DISCOVERY_TOOLS.OPERATIONAL}
          element={
            <MainLayout
              breadcrumbs={breadcrumbs || ['Discovery Tools', 'Operational Tools']}
              noPadding
            >
              <RouteErrorBoundary>
                <DiscoveryToolsHub initialTab="list" />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.DISCOVERY_TOOLS.DIGITAL}
          element={
            <MainLayout
              breadcrumbs={breadcrumbs || ['Discovery Tools', 'Digital Transformation']}
              noPadding
            >
              <RouteErrorBoundary>
                <DiscoveryToolsHub initialTab="list" />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.DISCOVERY_TOOLS.PROCESS_AUTOMATION}
          element={
            <MainLayout
              breadcrumbs={breadcrumbs || ['Discovery Tools', 'Process Automation']}
              noPadding
            >
              <RouteErrorBoundary>
                <DiscoveryToolsHub initialTab="list" />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* AI Actions */}
        <Route
          path={ROUTES.AI_ACTIONS}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['AI Actions']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <ActionProposalView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* Context Builder with nested routes */}
        <Route
          path={`${ROUTES.CONTEXT_BUILDER.ROOT}/*`}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Context Builder']}>
              <RouteErrorBoundary>
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
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* Assessment Module - New Hub */}
        <Route
          path={`${ROUTES.ASSESSMENT.ROOT}/*`}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || ['Assessment']} noPadding>
                <RouteErrorBoundary>
                  <Routes>
                    {/* Assessment Session Editor (Workflow v2) */}
                    <Route
                      path=":framework/:assessmentId"
                      element={<AssessmentSessionEditorView />}
                    />
                    {/* Main Assessment Hub - unified view */}
                    <Route index element={<AssessmentHub />} />
                    <Route path="overview" element={<AssessmentHub />} />
                    <Route path="summary" element={<AssessmentHub />} />
                    {/* Framework-specific routes (backward compatibility) */}
                    <Route path="drd" element={<AssessmentHub />} />
                    <Route path="siri" element={<AssessmentHub />} />
                    <Route path="adma" element={<AssessmentHub />} />
                    <Route path="cmmi" element={<AssessmentHub />} />
                    <Route path="lean" element={<AssessmentHub />} />
                  </Routes>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Transformation Modules - with MainLayout wrappers */}
        <Route
          path={ROUTES.INITIATIVES}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Initiatives']} noPadding>
              <RouteErrorBoundary>
                <InitiativesHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ROADMAP}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Roadmap']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <FullRoadmapView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.PORTFOLIO}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Initiatives']} noPadding>
              <RouteErrorBoundary>
                <PortfolioView />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ROI}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['ROI']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <FullROIView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ECONOMICS}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Economics']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <EconomicsView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.EXECUTION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Execution']} noPadding>
              <RouteErrorBoundary>
                <ExecutionHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.IMPLEMENTATION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Implementation']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <ImplementationView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ROLLOUT}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Rollout']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <FullRolloutView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        {/* Legacy /reports redirects to Report Builder */}
        <Route path="/reports" element={<Navigate to="/reports/builder" replace />} />
        {/* Report Builder Module (ROUTES.REPORTS now points to /reports/builder) */}
        <Route path="/assessment-reports/:reportId" element={<LegacyAssessmentReportRedirect />} />
        <Route
          path="/reports/builder"
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Reports', 'Builder']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <ReportBuilderView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path="/reports/builder/:reportId"
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Reports', 'Builder', 'Edit']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <ReportBuilderView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.KPI_OKR}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['KPI & OKR']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <KpiOkrView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.BENEFITS}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Benefits']} noPadding>
              <RouteErrorBoundary>
                <BenefitsHub />
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* Settings with nested routes - Protected & Error Boundary */}
        <Route
          path={`${ROUTES.SETTINGS.ROOT}/*`}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || ['Settings']}>
                <RouteErrorBoundary>
                  <AnimationWrapper variant="fade">
                    <SettingsView
                      currentUser={currentUser as any}
                      onUpdateUser={(updates) =>
                        setCurrentUser(currentUser ? { ...currentUser, ...updates } : null)
                      }
                      theme={theme as 'light' | 'dark' | 'system'}
                      toggleTheme={toggleTheme}
                    />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Organization with nested routes - Protected & Error Boundary */}
        <Route
          path={`${ROUTES.ORGANIZATION.ROOT}/*`}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || ['Organization']} noPadding>
                <RouteErrorBoundary>
                  <AnimationWrapper variant="fade">
                    <OrganizationView />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin with nested routes - Protected (ADMIN role) & Error Boundary */}
        <Route
          path={`${ROUTES.ADMIN.ROOT}/*`}
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <MainLayout breadcrumbs={breadcrumbs || ['Admin']}>
                <RouteErrorBoundary>
                  <AnimationWrapper variant="fade">
                    <AdminView
                      currentUser={currentUser as any}
                      onNavigate={(view) => setCurrentView(view as AppView)}
                    />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin with nested routes - Protected (SUPERADMIN role) & Error Boundary */}
        {/* NOTE: SuperAdmin has its own dedicated layout - no MainLayout wrapper */}
        <Route
          path={`${ROUTES.SUPERADMIN.ROOT}/*`}
          element={
            <ProtectedRoute requiredRole="SUPERADMIN">
              <RouteErrorBoundary>
                <AnimationWrapper variant="fade">
                  <SuperAdminView
                    currentUser={currentUser as any}
                    onNavigate={(view) => setCurrentView(view as AppView)}
                  />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Partner Portal - New DBR77 Consultinity Partner Portal */}
        <Route
          path={`${ROUTES.PARTNER.LANDING}/*`}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={['Partner Portal']}>
                <RouteErrorBoundary>
                  <AnimationWrapper variant="fade">
                    <PartnerPortalViewNew
                      currentUser={currentUser as any}
                      onNavigate={(view) => setCurrentView(view as AppView)}
                    />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Consultant routes */}
        <Route
          path={`${ROUTES.CONSULTANT.PANEL}/*`}
          element={
            <ProtectedRoute requireAuth={true}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <Routes>
                    <Route index element={<ConsultantPanelView />} />
                    <Route path="invites" element={<ConsultantInviteView />} />
                  </Routes>
                </AnimationWrapper>
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CONSULTANT.INVITES}
          element={
            <AnimationWrapper variant="slideUp">
              <ConsultantInviteView />
            </AnimationWrapper>
          }
        />

        {/* Wizards */}
        <Route
          path={ROUTES.ORG_SETUP}
          element={
            <ProtectedRoute requireAuth={true}>
              <AnimationWrapper variant="slideUp">
                <OrgSetupWizard />
              </AnimationWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ONBOARDING}
          element={
            <AnimationWrapper variant="slideUp">
              <OnboardingWizard />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.TRIAL_ENTRY}
          element={
            <AnimationWrapper variant="slideUp">
              <TrialEntryView
                onStartTrial={() => {
                  setCurrentView(AppView.AI_CHAT);
                  navigate('/chat');
                }}
              />
            </AnimationWrapper>
          }
        />

        {/* Affiliate */}
        <Route
          path={ROUTES.AFFILIATE}
          element={
            <ProtectedRoute requireAuth={true}>
              <AnimationWrapper variant="slideUp">
                <AffiliateDashboardView />
              </AnimationWrapper>
            </ProtectedRoute>
          }
        />

        {/* Legal Pages - Public */}
        <Route
          path={ROUTES.LEGAL.ABOUT}
          element={
            <AnimationWrapper variant="fade">
              <AboutView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.LEGAL.CONTACT}
          element={
            <AnimationWrapper variant="fade">
              <ContactView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.LEGAL.TERMS}
          element={
            <AnimationWrapper variant="fade">
              <TermsOfServiceView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.LEGAL.PRIVACY}
          element={
            <AnimationWrapper variant="fade">
              <PrivacyPolicyView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.LEGAL.COOKIES}
          element={
            <AnimationWrapper variant="fade">
              <CookiePolicyView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.LEGAL.SECURITY}
          element={
            <AnimationWrapper variant="fade">
              <SecurityView />
            </AnimationWrapper>
          }
        />

        {/* Status & Changelog - Public */}
        <Route
          path={ROUTES.STATUS}
          element={
            <AnimationWrapper variant="fade">
              <StatusPageView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.CHANGELOG}
          element={
            <AnimationWrapper variant="fade">
              <ChangelogView onBack={() => navigate(-1)} />
            </AnimationWrapper>
          }
        />

        {/* Knowledge Base, Pricing & Executive */}
        <Route
          path={ROUTES.KNOWLEDGE_BASE}
          element={
            <AnimationWrapper variant="slideUp">
              <KnowledgeBaseView onBack={() => navigate(-1)} />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.PRICING}
          element={
            <AnimationWrapper variant="slideUp">
              <AppPricingView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.EXECUTIVE}
          element={
            <AnimationWrapper variant="slideUp">
              <ExecutiveView />
            </AnimationWrapper>
          }
        />

        {/* 404 - Redirect based on auth status */}
        <Route
          path="*"
          element={
            currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <Navigate to={ROUTES.WELCOME} replace />
            )
          }
        />
      </Routes>
    </Suspense>
  );
};
