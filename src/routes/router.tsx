/**
 * React Router v7 Configuration
 *
 * This file defines the application's routing structure using React Router v7.
 * All routes use lazy loading for optimal code splitting.
 */

import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { AnimationWrapper } from '@/components/shared/AnimationWrapper';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

import { ROUTES } from './routeConfig';

// ============================================================================
// LAZY-LOADED COMPONENTS
// ============================================================================

// Layouts
const MainLayout = React.lazy(() =>
  import('@/layouts/MainLayout').then((m) => ({ default: m.MainLayout }))
);
const AuthLayout = React.lazy(() =>
  import('@/layouts/AuthLayout').then((m) => ({ default: m.AuthLayout }))
);

// System Health
const SystemHealthDashboard = React.lazy(() => import('@/views/SystemHealthDashboard'));

// Main Views
const AIChatWelcomeView = React.lazy(() =>
  import('@/views/AIChatWelcomeView').then((m) => ({ default: m.AIChatWelcomeView }))
);
const MyWorkView = React.lazy(() =>
  import('@/views/MyWorkView').then((m) => ({ default: m.MyWorkView }))
);
const ProjectIntelligenceView = React.lazy(() =>
  import('@/views/ProjectIntelligenceView').then((m) => ({ default: m.ProjectIntelligenceView }))
);

// Assessment
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

// Context Builder
const ContextBuilderView = React.lazy(() =>
  import('@/views/ContextBuilder/ContextBuilderView').then((m) => ({
    default: m.ContextBuilderView,
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

// Legacy Transformation Modules
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
const KpiOkrView = React.lazy(() =>
  import('@/views/KpiOkrView').then((m) => ({ default: m.KpiOkrView }))
);
const BenefitsRealizationView = React.lazy(() =>
  import('@/views/BenefitsRealizationView').then((m) => ({ default: m.BenefitsRealizationView }))
);

// Studio
const StudioView = React.lazy(() =>
  import('@/views/StudioView').then((m) => ({ default: m.StudioView }))
);

// Admin
const AdminView = React.lazy(() =>
  import('@/views/admin/AdminView').then((m) => ({ default: m.AdminView }))
);

// Settings
const SettingsView = React.lazy(() =>
  import('@/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

// SuperAdmin
const SuperAdminView = React.lazy(() =>
  import('@/views/superadmin/SuperAdminView').then((m) => ({ default: m.SuperAdminView }))
);
const SubscriptionPlansManager = React.lazy(() =>
  import('@/views/superadmin/SubscriptionPlansManager').then((m) => ({ default: m.default }))
);
const OrganizationResourceManager = React.lazy(() =>
  import('@/views/superadmin/OrganizationResourceManager').then((m) => ({ default: m.default }))
);

// Admin
const BudgetDashboard = React.lazy(() =>
  import('@/views/admin/BudgetDashboard').then((m) => ({ default: m.default }))
);

// Partner
const PartnerLandingView = React.lazy(() =>
  import('@/views/PartnerPortalView').then((m) => ({ default: m.default }))
);
const PartnerPricingView = React.lazy(() =>
  import('@/views/partner/PartnerPricingView').then((m) => ({ default: m.default }))
);
const PartnerDashboardView = React.lazy(() =>
  import('@/views/partner/PartnerDashboardView').then((m) => ({ default: m.default }))
);

// Wizards
const EnterpriseOnboardingWizard = React.lazy(() =>
  import('@/components/Onboarding/EnterpriseOnboardingWizard').then((m) => ({
    default: m.EnterpriseOnboardingWizard,
  }))
);
const OrgSetupWizard = React.lazy(() =>
  import('@/views/OrgSetupWizard').then((m) => ({ default: m.OrgSetupWizard }))
);

// ============================================================================
// ROUTE COMPONENTS WITH SUSPENSE
// ============================================================================

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <React.Suspense fallback={<LoadingScreen />}>{children}</React.Suspense>
);

const AnimatedSuspenseWrapper: React.FC<{
  children: React.ReactNode;
  variant?: 'fade' | 'slideUp';
}> = ({ children, variant = 'fade' }) => (
  <React.Suspense fallback={<LoadingScreen />}>
    <AnimationWrapper variant={variant}>{children}</AnimationWrapper>
  </React.Suspense>
);

// ============================================================================
// ROUTER CONFIGURATION
// ============================================================================

export const router = createBrowserRouter([
  {
    path: ROUTES.WELCOME,
    element: <Navigate to={ROUTES.AI_CHAT} replace />,
  },
  {
    path: ROUTES.AUTH,
    element: (
      <SuspenseWrapper>
        <AuthLayout>
          <Outlet />
        </AuthLayout>
      </SuspenseWrapper>
    ),
  },
  {
    path: '/',
    element: (
      <SuspenseWrapper>
        <MainLayout>
          <Outlet />
        </MainLayout>
      </SuspenseWrapper>
    ),
    children: [
      // Main Routes
      {
        path: ROUTES.AI_CHAT,
        element: (
          <AnimatedSuspenseWrapper variant="fade">
            <AIChatWelcomeView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.MY_WORK,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <MyWorkView currentUser={undefined as any} onNavigate={() => {}} />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.DASHBOARD,
        element: <Navigate to={ROUTES.MY_WORK} replace />,
      },
      {
        path: ROUTES.PROJECT_INTELLIGENCE,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <ProjectIntelligenceView />
          </AnimatedSuspenseWrapper>
        ),
      },

      // Assessment Routes
      {
        path: ROUTES.ASSESSMENT.ROOT,
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <AssessmentHubDashboard organizationId="" projectId="default" />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'drd',
            element: (
              <AnimatedSuspenseWrapper variant="fade">
                <AssessmentModuleHub framework="DRD" />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'siri',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <AssessmentModuleHub framework="SIRI" />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'adma',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <AssessmentModuleHub framework="ADMA" />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'cmmi',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <AssessmentModuleHub framework="CMMI" />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'lean',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <AssessmentModuleHub framework="LEAN" />
              </AnimatedSuspenseWrapper>
            ),
          },
        ],
      },

      // Context Builder Routes
      {
        path: ROUTES.CONTEXT_BUILDER.ROOT,
        children: [
          {
            index: true,
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <ContextBuilderView initialTab={1} />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'profile',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <ContextBuilderView initialTab={1} />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'goals',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <ContextBuilderView initialTab={2} />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'challenges',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <ContextBuilderView initialTab={3} />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'megatrends',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <ContextBuilderView initialTab={4} />
              </AnimatedSuspenseWrapper>
            ),
          },
          {
            path: 'strategy',
            element: (
              <AnimatedSuspenseWrapper variant="slideUp">
                <ContextBuilderView initialTab={5} />
              </AnimatedSuspenseWrapper>
            ),
          },
        ],
      },

      // Transformation Routes - New Hubs
      {
        path: ROUTES.INITIATIVES,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <InitiativesHub />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ROADMAP,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <FullRoadmapView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.PORTFOLIO,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <PortfolioView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ROI,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <FullROIView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ECONOMICS,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <EconomicsView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.EXECUTION,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <ExecutionHub />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.IMPLEMENTATION,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <ImplementationView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ROLLOUT,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <FullRolloutView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.REPORTS,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <FullReportsView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.KPI_OKR,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <KpiOkrView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.BENEFITS,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <BenefitsHub />
          </AnimatedSuspenseWrapper>
        ),
      },

      // Studio
      {
        path: ROUTES.STUDIO,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <StudioView />
          </AnimatedSuspenseWrapper>
        ),
      },

      // Admin Routes
      {
        path: ROUTES.ADMIN.ROOT,
        element: (
          <AnimatedSuspenseWrapper variant="fade">
            <AdminView currentUser={undefined as any} onNavigate={() => {}} />
          </AnimatedSuspenseWrapper>
        ),
        children: [
          { index: true, element: <Navigate to={ROUTES.ADMIN.OVERVIEW} replace /> },
          { path: 'overview', element: <div>Admin Overview</div> },
          { path: 'organization', element: <div>Organization Settings</div> },
          { path: 'team', element: <div>Team Management</div> },
          { path: 'workspace', element: <div>Workspace Management</div> },
          { path: 'ai', element: <div>AI Configuration</div> },
          { path: 'billing', element: <div>Billing Management</div> },
          {
            path: 'budget',
            element: (
              <SuspenseWrapper>
                <BudgetDashboard />
              </SuspenseWrapper>
            ),
          },
          { path: 'security', element: <div>Security Settings</div> },
        ],
      },

      // Settings Routes
      {
        path: ROUTES.SETTINGS.ROOT,
        element: (
          <AnimatedSuspenseWrapper variant="fade">
            <SettingsView
              currentUser={undefined as any}
              onUpdateUser={() => {}}
              theme="dark"
              toggleTheme={() => {}}
            />
          </AnimatedSuspenseWrapper>
        ),
        children: [
          { index: true, element: <Navigate to={ROUTES.SETTINGS.PROFILE} replace /> },
          { path: 'profile', element: <div>Profile Settings</div> },
          { path: 'billing', element: <div>Billing Settings</div> },
          { path: 'ai', element: <div>AI Preferences</div> },
          { path: 'notifications', element: <div>Notification Settings</div> },
          { path: 'integrations', element: <div>Integrations</div> },
          { path: 'organization', element: <div>Organization Settings</div> },
          { path: 'security', element: <div>Security & Privacy</div> },
        ],
      },

      // SuperAdmin Routes
      {
        path: ROUTES.SUPERADMIN.ROOT,
        element: (
          <AnimatedSuspenseWrapper variant="fade">
            <SuperAdminView currentUser={undefined as any} onNavigate={() => {}} />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: '/superadmin/subscription-plans',
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <SubscriptionPlansManager />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: '/superadmin/resource-management',
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <OrganizationResourceManager />
          </AnimatedSuspenseWrapper>
        ),
      },

      // Partner Routes
      {
        path: ROUTES.PARTNER.LANDING,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <PartnerLandingView currentSection={'PARTNER_LANDING' as any} onNavigate={() => {}} />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.PARTNER.PRICING,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <PartnerPricingView />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.PARTNER.DASHBOARD,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <PartnerDashboardView />
          </AnimatedSuspenseWrapper>
        ),
      },

      // Wizards
      {
        path: ROUTES.ONBOARDING,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <EnterpriseOnboardingWizard />
          </AnimatedSuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ORG_SETUP,
        element: (
          <AnimatedSuspenseWrapper variant="slideUp">
            <OrgSetupWizard />
          </AnimatedSuspenseWrapper>
        ),
      },
    ],
  },

  // System Health Dashboard (Hidden)
  {
    path: '/system/health',
    element: (
      <SuspenseWrapper>
        <SystemHealthDashboard />
      </SuspenseWrapper>
    ),
  },

  // 404 Fallback
  {
    path: '*',
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },
]);

export default router;
