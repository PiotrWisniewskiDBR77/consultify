import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { ConversationRouteSync } from '@/components/AIChat/ConversationRouteSync';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { AnimationWrapper } from '@/components/shared/AnimationWrapper';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { Api } from '@/services/api';
import { apiGet } from '@/services/api/baseClient';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { AppView, AuthStep, SessionMode, User } from '@/types';
import { canUseInternalTools } from '@/utils/internalToolsAccess';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { shouldHideNonCoreModulesInPublicProduction } from '@/utils/publicProduction';
import { isSuperAdminRole } from '@/utils/roleGuards';
import { AuthView } from '@/views/AuthView';
import { ProductEntryPage } from '@/views/ProductEntryPage';

import { LegacyAssessmentReportRedirect } from './LegacyAssessmentReportRedirect';
import { LicensedToolsRedirect } from './LicensedToolsRedirect';
import { ROUTES } from './routeConfig';
import { WorkCanvasRedirect } from './WorkCanvasRedirect';

// Lazy load views for new routes
const StudioView = React.lazy(() =>
  import('@/views/StudioView').then((m) => ({ default: m.StudioView }))
);
const MyWorkView = lazyWithRetry(() =>
  import('@/views/MyWorkView').then((m) => ({ default: m.MyWorkView }))
);
// M16 P0-4: ContextBuilderView is no longer routed standalone — /context/* now
// redirects to the canonical /organization/* workspace. The view file is retained
// because quick-step entry paths still resolve through these (redirected) routes.
// Discovery Tools Module - New Hub
const DiscoveryToolsHub = React.lazy(() =>
  import('@/components/Discovery/DiscoveryToolsHub').then((m) => ({ default: m.DiscoveryToolsHub }))
);

// T064 — Megatrends canonical workspace
const MegatrendsWorkspace = React.lazy(() =>
  import('@/components/Megatrend/MegatrendsWorkspace').then((m) => ({
    default: m.MegatrendsWorkspace,
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
const ResultsHub = React.lazy(() =>
  import('@/components/Results/ResultsHub').then((m) => ({ default: m.default }))
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
const V4ComingSoonView = React.lazy(() =>
  import('@/views/V4ComingSoonView').then((m) => ({ default: m.V4ComingSoonView }))
);
const SharedPresentationView = React.lazy(() =>
  import('@/components/Presentations/SharedPresentationView').then((m) => ({
    default: m.SharedPresentationView,
  }))
);
const ReportsAndPresentationsHub = React.lazy(() =>
  import('@/components/ReportsAndPresentations/ReportsAndPresentationsHub').then((m) => ({
    default: m.ReportsAndPresentationsHub,
  }))
);
// Consultify Presentation Studio (Module Delivery Contract S5) — read-only
// surface that consumes the four /api/presentation-studio/*/preview endpoints.
const PresentationStudioPage = React.lazy(() =>
  import('@/components/PresentationStudio/PresentationStudioPage').then((m) => ({
    default: m.PresentationStudioPage,
  }))
);
// Consultify Document Studio (MVP-1, Mode 1) — productized Document runtime
// above the V8.1 substrate.
// See docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md.
const DocumentStudioView = React.lazy(() =>
  import('@/components/DocumentStudio/DocumentStudioView').then((m) => ({
    default: m.DocumentStudioView,
  }))
);
const DeckBuilder = React.lazy(() =>
  import('@/components/Presentations/DeckBuilder/DeckBuilder').then((m) => ({
    default: m.DeckBuilder,
  }))
);
const PresentationWizard = React.lazy(() =>
  import('@/components/Presentations/PresentationWizard').then((m) => ({
    default: m.PresentationWizard,
  }))
);
const MeetingHub = React.lazy(() =>
  import('@/components/Meeting/MeetingHub').then((m) => ({ default: m.MeetingHub }))
);
// NOTE: Legacy Management Reports UI has been deprecated in favor of the unified
// Reports & Presentations hub under /presentations (tab=documents).

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

// AI Chat (Full Screen Chat View) — Wave 1 canonical shell.
const UnifiedChatPanel = React.lazy(() =>
  import('@/components/AIChat/UnifiedChatPanel').then((m) => ({ default: m.UnifiedChatPanel }))
);
const AIOSHub = React.lazy(() =>
  import('@/components/AIChat/AIOSHub').then((m) => ({ default: m.AIOSHub }))
);
const ActionCenter = React.lazy(() =>
  import('@/components/AIChat/ActionCenter').then((m) => ({ default: m.ActionCenter }))
);
const ResearchSessionsDock = React.lazy(() =>
  import('@/components/AIChat/ResearchSessionsDock').then((m) => ({
    default: m.ResearchSessionsDock,
  }))
);
const Wave5ArtifactRuntimePanel = React.lazy(() =>
  import('@/components/AIChat/Wave5ArtifactRuntimePanel').then((m) => ({
    default: m.Wave5ArtifactRuntimePanel,
  }))
);
const Wave6ContextLearningPanel = React.lazy(() =>
  import('@/components/AIChat/Wave6ContextLearningPanel').then((m) => ({
    default: m.Wave6ContextLearningPanel,
  }))
);
const Wave7ConnectorAdminPanel = React.lazy(() =>
  import('@/components/AIChat/Wave7ConnectorAdminPanel').then((m) => ({
    default: m.Wave7ConnectorAdminPanel,
  }))
);
const Wave8AgentCatalogPanel = React.lazy(() =>
  import('@/components/AIChat/Wave8AgentCatalogPanel').then((m) => ({
    default: m.Wave8AgentCatalogPanel,
  }))
);
const Wave9OutcomeAIOpsPanel = React.lazy(() =>
  import('@/components/AIChat/Wave9OutcomeAIOpsPanel').then((m) => ({
    default: m.Wave9OutcomeAIOpsPanel,
  }))
);

// KIMI-style workspaces (P22 Wordy / P23 Excele / P20 Prezentacje)
const WordyView = React.lazy(() =>
  import('@/components/AIChat/KimiWorkspace/WordyView').then((m) => ({ default: m.WordyView }))
);
const PrezentacjeView = React.lazy(() =>
  import('@/components/AIChat/KimiWorkspace/PrezentacjeView').then((m) => ({
    default: m.PrezentacjeView,
  }))
);
// KIMI-style Tabele workspace (Table Studio Foundation block — sky accent, D1=visible)
const TabeleView = React.lazy(() =>
  import('@/components/AIChat/KimiWorkspace/TabeleView').then((m) => ({
    default: m.default,
  }))
);

// Discovery Consultant (AI Discovery with Canvas)
const DiscoveryConsultantView = React.lazy(() =>
  import('@/components/Discovery/DiscoveryConsultantView').then((m) => ({
    default: m.DiscoveryConsultantView,
  }))
);

// Become Partner (Public Partner Recruitment Page)
const BecomePartnerView = React.lazy(() => import('@/views/BecomePartnerView'));
const PartnerApplicationView = React.lazy(() => import('@/views/PartnerApplicationView'));

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

// Partner Portal - New DBR77 Consultify Partner Portal
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
const EnterpriseOnboardingWizard = React.lazy(() =>
  import('@/components/Onboarding/EnterpriseOnboardingWizard').then((m) => ({
    default: m.EnterpriseOnboardingWizard,
  }))
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
// Standalone legal views removed — all legal documents served via LegalDocumentView (/legal/:docSlug)
const VectorPage = React.lazy(() =>
  import('../views/VectorPage').then((m) => ({ default: m.VectorPage }))
);
const LegalIndexView = React.lazy(() =>
  import('@/views/LegalIndexView').then((m) => ({ default: m.LegalIndexView }))
);
const LegalDocumentView = React.lazy(() =>
  import('@/views/LegalDocumentView').then((m) => ({ default: m.LegalDocumentView }))
);
const OAuthCallbackView = React.lazy(() => import('@/views/OAuthCallback'));
const ForgotPasswordView = React.lazy(() =>
  import('@/views/auth/ForgotPasswordView').then((m) => ({ default: m.ForgotPasswordView }))
);
const ResetPasswordView = React.lazy(() =>
  import('@/views/auth/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView }))
);

// Status & Changelog
const StatusPageView = React.lazy(() =>
  import('@/views/StatusPageView').then((m) => ({ default: m.StatusPageView }))
);
const ChangelogView = React.lazy(() =>
  import('@/views/ChangelogView').then((m) => ({ default: m.ChangelogView }))
);

// Knowledge Base & Pricing
const KnowledgeBaseEntryView = React.lazy(() =>
  import('@/views/KnowledgeBaseEntryView').then((m) => ({ default: m.KnowledgeBaseEntryView }))
);
const AppPricingView = React.lazy(() =>
  import('@/views/AppPricingView').then((m) => ({ default: m.AppPricingView }))
);
const ExecutiveView = React.lazy(() =>
  import('@/views/ExecutiveView').then((m) => ({ default: m.ExecutiveView }))
);
const BusinessCasesPage = React.lazy(() =>
  import('@/views/BusinessCasesPage').then((m) => ({ default: m.BusinessCasesPage }))
);

// Documentation Portal (Public)
const KnowledgeBaseHomePage = React.lazy(() =>
  import('@/views/knowledge/KnowledgeBaseHomePage').then((m) => ({
    default: m.KnowledgeBaseHomePage,
  }))
);
const KnowledgeBaseCategoryPage = React.lazy(() =>
  import('@/views/knowledge/KnowledgeBaseCategoryPage').then((m) => ({
    default: m.KnowledgeBaseCategoryPage,
  }))
);
const KnowledgeBaseArticlePage = React.lazy(() =>
  import('@/views/knowledge/KnowledgeBaseArticlePage').then((m) => ({
    default: m.KnowledgeBaseArticlePage,
  }))
);
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

// Public Form Page (Table Platform)
const PublicFormPage = React.lazy(() =>
  import('@/components/MyWork/table/forms/PublicFormPage').then((m) => ({
    default: m.PublicFormPage,
  }))
);

// Public JWT Form Page (Table Platform · Block D · D-S4)
const PublicJwtFormPage = React.lazy(() =>
  import('@/components/MyWork/table/forms/PublicJwtFormPage').then((m) => ({
    default: m.PublicJwtFormPage,
  }))
);

// Public Shared View (Table Platform)
const PublicViewPage = React.lazy(() => import('@/components/MyWork/table/PublicViewPage'));

// Public Mini Assessment (T015)
const PublicMiniAssessmentView = React.lazy(() =>
  import('@/views/PublicMiniAssessmentView').then((m) => ({ default: m.PublicMiniAssessmentView }))
);

// Education Hub (Public)
const ToolsShowcasePage = React.lazy(() =>
  import('@/views/ToolsShowcasePage').then((m) => ({ default: m.ToolsShowcasePage }))
);
const AuditsShowcasePage = React.lazy(() =>
  import('@/views/AuditsShowcasePage').then((m) => ({ default: m.AuditsShowcasePage }))
);
const ResourcesPage = React.lazy(() =>
  import('@/views/ResourcesPage').then((m) => ({ default: m.ResourcesPage }))
);
const HowItWorksPage = React.lazy(() =>
  import('@/views/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage }))
);
const AppIntroView = React.lazy(() => import('@/views/AppIntroView'));

const ForWhomPage = React.lazy(() =>
  import('@/views/ForWhomPage').then((m) => ({ default: m.ForWhomPage }))
);

const PricingLandingPage = React.lazy(() =>
  import('@/views/PricingLandingPage').then((m) => ({ default: m.PricingLandingPage }))
);

const EnterprisePage = React.lazy(() =>
  import('@/views/EnterprisePage').then((m) => ({ default: m.EnterprisePage }))
);

const OurStoryPage = React.lazy(() =>
  import('@/views/OurStoryPage').then((m) => ({ default: m.OurStoryPage }))
);

const RedirectWithTracking: React.FC<{ from: string; to: string; reason: string }> = ({
  from,
  to,
  reason,
}) => {
  React.useEffect(() => {
    trackFunnelEvent('route_redirected', { from, to, reason });
  }, [from, to, reason]);
  return <Navigate to={to} replace />;
};

const RedirectPreservingQuery: React.FC<{ from: string; to: string; reason: string }> = ({
  from,
  to,
  reason,
}) => {
  const location = useLocation();
  const target = `${to}${location.search || ''}`;
  React.useEffect(() => {
    trackFunnelEvent('route_redirected', { from, to: target, reason });
  }, [from, target, reason]);
  return <Navigate to={target} replace />;
};

const ReportsBuilderLegacyRedirect: React.FC = () => {
  const params = useParams<{ reportId?: string }>();
  const reportId = String(params.reportId || '').trim();
  const to = reportId
    ? `${ROUTES.REPORTS.BUILDER}/${encodeURIComponent(reportId)}`
    : ROUTES.REPORTS.BUILDER;

  React.useEffect(() => {
    trackFunnelEvent('route_redirected', {
      from: reportId ? `/reports-builder/${reportId}` : '/reports-builder/:reportId',
      to,
      reason: 'legacy_reports_builder_alias',
    });
  }, [reportId, to]);

  return <Navigate to={to} replace />;
};

const MyWorkSheetsDeepLinkRedirect: React.FC = () => {
  const params = useParams<{ workspaceId?: string; tableId?: string }>();
  const navigate = useNavigate();
  const workspaceId = String(params.workspaceId || '').trim();
  const tableId = String(params.tableId || '').trim();
  React.useEffect(() => {
    if (!workspaceId || !tableId) {
      navigate('/my-work', { replace: true });
      return;
    }
    toast.success('Transitioning to Sheets Builder lane...');
    navigate(
      `/my-work/ideas/${encodeURIComponent(workspaceId)}/workspace/table?tpTable=${encodeURIComponent(tableId)}`,
      { replace: true, state: { transition: 'sheets_deep_link_option_a' } }
    );
  }, [navigate, tableId, workspaceId]);
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
    </div>
  );
};

/** Redirects /auth?action=trial to /trial/start */
const AuthRouteWithTrialRedirect: React.FC<{
  isAuthenticated: boolean;
  authInitialStep: AuthStep;
  onAuthSuccess: (user: { status?: string; message?: string }) => void;
  onBack: () => void;
}> = ({ isAuthenticated, authInitialStep, onAuthSuccess, onBack }) => {
  const [searchParams] = useSearchParams();
  const routeLocation = useLocation();
  const action = searchParams.get('action');

  if (isAuthenticated) {
    const from = (routeLocation.state as { from?: { pathname?: string; search?: string } } | null)
      ?.from;
    const fromPath =
      from?.pathname && from.pathname !== ROUTES.AUTH && from.pathname !== '/auth'
        ? `${from.pathname}${from.search || ''}`
        : null;
    return <Navigate to={fromPath || ROUTES.AI_CHAT} replace />;
  }
  if (action === 'trial') {
    return <Navigate to="/trial/start" replace />;
  }
  return (
    <AuthLayout>
      <AuthView
        initialStep={authInitialStep}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    </AuthLayout>
  );
};

const PublicProductionModuleDisabled: React.FC<{ moduleName: string }> = ({ moduleName }) => (
  <div className="flex h-full items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
    <div>
      <p className="text-lg font-medium">
        {moduleName} module is not enabled for this organization.
      </p>
    </div>
  </div>
);

const ProductionModuleGate: React.FC<{
  enabled: boolean;
  moduleName: string;
  children: React.ReactNode;
}> = ({ enabled, moduleName, children }) =>
  enabled ? <>{children}</> : <PublicProductionModuleDisabled moduleName={moduleName} />;

const InternalToolsGate: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({
  enabled,
  children,
}) => (enabled ? <>{children}</> : <Navigate to={ROUTES.AI_CHAT} replace />);

export const AppRoutes: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentView,
    currentUser,
    currentOrganization,
    currentProjectId,
    setCurrentView,
    setCurrentUser,
    setCurrentOrganization,
    setCurrentProjectId,
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

  const isSuperAdmin = isSuperAdminRole(currentUser?.role);
  const hideNonCoreModulesOnPublicProduction = React.useMemo(
    () => shouldHideNonCoreModulesInPublicProduction(),
    []
  );
  const internalToolsEnabled = canUseInternalTools(currentUser);
  const directKimiModuleAccess = React.useMemo(() => {
    if (!currentUser?.isAuthenticated) return false;
    if (isSuperAdminRole(currentUser?.role)) return true;

    const email = String(currentUser?.email || '')
      .trim()
      .toLowerCase();
    if (!email) return false;

    const defaults = ['piotr.wisniewski@dbr77.com', 'piotrwisniewski@dbr77.com'];
    const configured = String(
      import.meta.env.VITE_DIRECT_KIMI_MODULE_ACCESS_EMAILS || 'piotr.wisniewski@dbr77.com'
    )
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const allowlist = new Set([...defaults, ...configured]);
    return allowlist.has(email);
  }, [currentUser?.isAuthenticated, currentUser?.role, currentUser?.email]);

  const KimiModuleGate: React.FC<{
    moduleKey: 'wordy' | 'excele' | 'prezentacje';
    children: React.ReactNode;
  }> = ({ moduleKey, children }) => {
    const [loading, setLoading] = React.useState(true);
    const [allowed, setAllowed] = React.useState(false);
    const MODULE_ACCESS_TIMEOUT_MS = 12000;

    React.useEffect(() => {
      let cancelled = false;
      const run = async () => {
        if (directKimiModuleAccess) {
          if (!cancelled) {
            setAllowed(true);
            setLoading(false);
          }
          return;
        }

        const timeoutId = window.setTimeout(() => {
          if (cancelled) return;
          setAllowed(false);
          setLoading(false);
        }, MODULE_ACCESS_TIMEOUT_MS);

        try {
          const data = await apiGet<{ modules?: string[] }>('/module-access/my');
          const modules = Array.isArray(data?.modules) ? data.modules : [];
          if (!cancelled) {
            setAllowed(modules.includes(moduleKey));
          }
        } catch {
          if (!cancelled) {
            setAllowed(false);
          }
        } finally {
          window.clearTimeout(timeoutId);
          if (!cancelled) {
            setLoading(false);
          }
        }
      };
      void run();
      return () => {
        cancelled = true;
      };
    }, [moduleKey, directKimiModuleAccess]);

    if (loading) {
      return (
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      );
    }

    return <>{allowed ? children : <V4ComingSoonView />}</>;
  };

  // If user is SUPERADMIN, ensure they land in SuperAdmin panel on generic routes.
  // This makes "login → superadmin" stable even when the app restores the last route (/chat).
  React.useEffect(() => {
    if (!currentUser?.isAuthenticated) return;
    if (!isSuperAdminRole(currentUser?.role)) return;

    const path = location.pathname || '/';
    const isAlreadyInSuperAdmin = path === '/superadmin' || path.startsWith('/superadmin/');
    if (isAlreadyInSuperAdmin) return;

    const isGenericLanding = path === '/' || path === '/chat' || path.startsWith('/chat/');
    if (isGenericLanding) {
      navigate('/superadmin', { replace: true });
    }
  }, [currentUser?.isAuthenticated, currentUser?.role, location.pathname, navigate]);

  // Set navigate function in store so setCurrentView can use React Router
  React.useEffect(() => {
    setNavigateFn(navigate);
  }, [navigate, setNavigateFn]);

  // --- HANDLERS (Moved from App.tsx) ---

  const handleStartSession = (mode: SessionMode) => {
    setSessionMode(mode);

    if (currentUser?.isAuthenticated) {
      setCurrentView(AppView.AI_CHAT);
      // Avoid /chat -> /superadmin bounce for SUPERADMIN accounts.
      navigate(isSuperAdminRole(currentUser.role) ? '/superadmin' : '/chat');
      return;
    }

    if (mode === SessionMode.FREE || mode === SessionMode.DEMO) {
      navigate('/demo');
      setAuthInitialStep(AuthStep.REGISTER);
      setCurrentView(AppView.AUTH);
    } else {
      navigate('/trial/start');
      setAuthInitialStep(AuthStep.REGISTER);
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
    const DEMO_EMAILS = new Set([
      'piotr.wisniewski@demo.com',
      'anna.zielinska@ateliertoys-demo.com',
    ]);
    const FORCE_DEMO_OFF_EMAIL = 'piotr.wisniewski@dbr77.com';
    const isDemoUser = (validUser as any).isDemo === true || DEMO_EMAILS.has(validUser.email);

    try {
      if (isDemoUser) {
        sessionStorage.setItem('isDemo', 'true');
      } else {
        sessionStorage.removeItem('isDemo');
        localStorage.removeItem('consultify_demo_session');
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
        localStorage.removeItem('consultify_demo_session');
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
    try {
      sessionStorage.removeItem('attribution_invite');
    } catch {
      // ignore storage errors
    }

    if (
      validUser.organizationId &&
      currentProjectId &&
      currentOrganization?.id &&
      currentOrganization.id !== validUser.organizationId
    ) {
      // A persisted project from another org would make PMO modules appear empty.
      setCurrentProjectId(null);
    }

    if (validUser.organizationId) {
      setCurrentOrganization({
        id: validUser.organizationId,
        name: validUser.organizationName || 'Organization',
      });
    }
    // IMPORTANT: RouterSync is the single source of truth for auth redirects.
    // Do not navigate here to avoid competing redirects during rehydration.
  };

  // --- RENDER ---
  // All routing now goes through React Router - removed blocking if/else conditions
  const renderInternalToolsShell = (
    routeBreadcrumbs: string[],
    children: React.ReactNode
  ): React.ReactNode => (
    <InternalToolsGate enabled={internalToolsEnabled}>
      <MainLayout breadcrumbs={breadcrumbs || routeBreadcrumbs}>
        <RouteErrorBoundary>
          <AnimationWrapper variant="fade">{children}</AnimationWrapper>
        </RouteErrorBoundary>
      </MainLayout>
    </InternalToolsGate>
  );

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
              // IMPORTANT: RouterSync is the single source of truth for auth redirects.
              // Using <Navigate> here can cause redirect loops during rehydration.
              <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
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
        <Route
          path={ROUTES.PARTNER.PUBLIC_APPLY}
          element={
            <AuthLayout>
              <AnimationWrapper variant="fade">
                <PartnerApplicationView />
              </AnimationWrapper>
            </AuthLayout>
          }
        />
        <Route
          path={ROUTES.PARTNER.PRICING}
          element={
            <AuthLayout>
              <AnimationWrapper variant="fade">
                <PartnerPricingView />
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

        {/* Knowledge Base - Public Product KB */}
        <Route path="/knowledge-base" element={<KnowledgeBaseHomePage />} />
        <Route path="/knowledge-base/:categorySlug" element={<KnowledgeBaseCategoryPage />} />
        <Route
          path="/knowledge-base/:categorySlug/:articleSlug"
          element={<KnowledgeBaseArticlePage />}
        />

        {/* Public Form Page (Table Platform) — no auth required */}
        <Route
          path="/forms/:slug"
          element={
            <Suspense fallback={<LoadingScreen message="Loading form..." />}>
              <PublicFormPage />
            </Suspense>
          }
        />

        {/* Public JWT Form Page (Block D · D-S4) — no auth required, JWT-tokenized */}
        <Route
          path="/public/forms/jwt/:token"
          element={
            <Suspense fallback={<LoadingScreen message="Loading private form..." />}>
              <PublicJwtFormPage />
            </Suspense>
          }
        />

        {/* Public Shared View (Table Platform) — no auth required */}
        <Route
          path="/public/views/:token"
          element={
            <Suspense fallback={<LoadingScreen message="Loading shared view..." />}>
              <PublicViewPage />
            </Suspense>
          }
        />

        {/* Public Mini Assessment (T015) */}
        <Route
          path="/assess/:token?"
          element={
            <Suspense fallback={<LoadingScreen message="Loading assessment..." />}>
              <PublicMiniAssessmentView />
            </Suspense>
          }
        />

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

        {/* Resources - Public video teasers (Public) */}
        <Route
          path="/resources"
          element={
            <AuthLayout>
              <Suspense fallback={<LoadingScreen message="Loading resources..." />}>
                <ResourcesPage />
              </Suspense>
            </AuthLayout>
          }
        />

        {/* How it works - Video teasers (Public) */}
        <Route
          path="/how-it-works"
          element={
            <AuthLayout>
              <Suspense fallback={<LoadingScreen message="Loading how it works..." />}>
                <HowItWorksPage />
              </Suspense>
            </AuthLayout>
          }
        />

        {/* For whom (Public) */}
        <Route
          path="/for-whom"
          element={
            <Suspense fallback={<LoadingScreen message="Loading..." />}>
              <ForWhomPage />
            </Suspense>
          }
        />

        {/* Pricing marketing page (Public) */}
        <Route
          path={ROUTES.CASE_STUDIES}
          element={
            <Suspense fallback={<LoadingScreen message="Loading business cases..." />}>
              <BusinessCasesPage />
            </Suspense>
          }
        />
        <Route
          path="/pricing"
          element={
            <Suspense fallback={<LoadingScreen message="Loading pricing..." />}>
              <PricingLandingPage />
            </Suspense>
          }
        />

        {/* Enterprise (Public) */}
        <Route
          path="/enterprise"
          element={
            <Suspense fallback={<LoadingScreen message="Loading..." />}>
              <EnterprisePage />
            </Suspense>
          }
        />

        {/* Our Story (Public) */}
        <Route
          path="/our-story"
          element={
            <Suspense fallback={<LoadingScreen message="Loading..." />}>
              <OurStoryPage />
            </Suspense>
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
                  targetMode={SessionMode.FREE}
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
                  targetMode={SessionMode.FREE}
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

        {/* Trial Start - self-serve trial registration */}
        <Route
          path="/trial/start"
          element={
            !isAuthInitializing && currentUser?.isAuthenticated ? (
              <Navigate to={ROUTES.AI_CHAT} replace />
            ) : (
              <AuthLayout>
                <AuthView
                  key="trial-form-stable"
                  initialStep={AuthStep.REGISTER}
                  targetMode={SessionMode.FULL}
                  onAuthSuccess={handleAuthSuccess}
                  onBack={() => navigate('/')}
                />
              </AuthLayout>
            )
          }
        />

        {/* Legacy /auth route — ?action=trial redirects to /trial/start */}
        <Route
          path={ROUTES.AUTH}
          element={
            <AuthRouteWithTrialRedirect
              isAuthenticated={!!currentUser?.isAuthenticated}
              authInitialStep={authInitialStep}
              onAuthSuccess={handleAuthSuccess}
              onBack={() => navigate('/')}
            />
          }
        />

        {/* OAuth Callback - Public route for OAuth redirects */}
        <Route
          path="/oauth/callback"
          element={
            <Suspense fallback={<LoadingScreen message="Processing authentication..." />}>
              <OAuthCallbackView />
            </Suspense>
          }
        />

        {/* Forgot Password - Public */}
        <Route
          path="/forgot-password"
          element={
            <AuthLayout>
              <Suspense fallback={<LoadingScreen message="Loading..." />}>
                <ForgotPasswordView />
              </Suspense>
            </AuthLayout>
          }
        />

        {/* Reset Password - Public */}
        <Route
          path="/reset-password"
          element={
            <AuthLayout>
              <Suspense fallback={<LoadingScreen message="Loading..." />}>
                <ResetPasswordView />
              </Suspense>
            </AuthLayout>
          }
        />

        {/* ============================================ */}
        {/* PROTECTED ROUTES - With MainLayout wrapper   */}
        {/* ============================================ */}

        {/* Studio */}
        <Route
          path={ROUTES.APP_INTRO}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Intro']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="fade">
                  <AppIntroView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

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
          path={`${ROUTES.MY_WORK}/*`}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['My Work']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="My Work"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <MyWorkView
                      currentUser={currentUser as any}
                      onNavigate={(view) => setCurrentView(view as AppView)}
                    />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/my-work/sheets/:workspaceId/tables/:tableId"
          element={<MyWorkSheetsDeepLinkRedirect />}
        />
        <Route path="/decisions" element={<Navigate to="/my-work/decisions" replace />} />

        {/* AI Chat - Full Screen Chat View */}
        <Route
          path={ROUTES.AI_CHAT}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['AI Chat']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="fade">
                  <ConversationRouteSync />
                  <UnifiedChatPanel mode="full" />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* AI OS - Manual acceptance hub for AI Actions, Memory, Connectors, Agents and Outcomes */}
        <Route
          path={ROUTES.AI_OS.ROOT}
          element={renderInternalToolsShell(['AI OS'], <AIOSHub />)}
        />
        <Route path={ROUTES.AI_OS.ALIAS} element={<Navigate to={ROUTES.AI_OS.ROOT} replace />} />
        <Route
          path={ROUTES.AI_OS.ACTIONS_ALIAS}
          element={<Navigate to={ROUTES.AI_OS.ACTION_CENTER} replace />}
        />
        <Route
          path={ROUTES.AI_OS.MEMORY_ALIAS}
          element={<Navigate to={ROUTES.AI_OS.CONTEXT} replace />}
        />
        <Route
          path={ROUTES.AI_OS.AIOPS_ALIAS}
          element={<Navigate to={ROUTES.AI_OS.OUTCOMES} replace />}
        />

        {/* Wave 3 - AI Action Center / AIRun ledger */}
        <Route
          path={ROUTES.AI_OS.ACTION_CENTER}
          element={renderInternalToolsShell(['AI', 'Action Center'], <ActionCenter />)}
        />

        {/* Wave 4 - Research Sessions Dock / Evidence reports */}
        <Route
          path={ROUTES.AI_OS.RESEARCH}
          element={renderInternalToolsShell(['AI', 'Research Sessions'], <ResearchSessionsDock />)}
        />

        {/* Wave 5 - Artifact Runtime / Document Work */}
        <Route
          path={ROUTES.AI_OS.ARTIFACTS}
          element={renderInternalToolsShell(['AI', 'Artifacts'], <Wave5ArtifactRuntimePanel />)}
        />

        {/* V10 Work Canvas (legacy route) -> canonical /chat split panel */}
        <Route
          path={ROUTES.AI_OS.WORK_CANVAS}
          element={
            <ProtectedRoute requiredRole="USER">
              <WorkCanvasRedirect />
            </ProtectedRoute>
          }
        />

        {/* Wave 6 - Org, Project, User Context and Controlled Learning */}
        <Route
          path={ROUTES.AI_OS.CONTEXT}
          element={renderInternalToolsShell(['AI', 'Context'], <Wave6ContextLearningPanel />)}
        />

        {/* Wave 7 - Enterprise Connectors, Tooling and AI App Management */}
        <Route
          path={ROUTES.AI_OS.CONNECTORS}
          element={renderInternalToolsShell(['AI', 'Connectors'], <Wave7ConnectorAdminPanel />)}
        />

        {/* Wave 8 - Agent Catalog, Roles and Scheduled Work */}
        <Route
          path={ROUTES.AI_OS.AGENTS}
          element={renderInternalToolsShell(['AI', 'Agents'], <Wave8AgentCatalogPanel />)}
        />

        {/* Wave 9 - Outcome, KPI, ROI, AI Ops and Final Acceptance */}
        <Route
          path={ROUTES.AI_OS.OUTCOMES}
          element={renderInternalToolsShell(['AI', 'Outcomes'], <Wave9OutcomeAIOpsPanel />)}
        />
        <Route path="/ai/*" element={<Navigate to={ROUTES.AI_OS.ROOT} replace />} />

        {/* AI Chat with Conversation ID - deep link to specific conversation */}
        <Route
          path={ROUTES.AI_CHAT_CONVERSATION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['AI Chat']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="fade">
                  <ConversationRouteSync />
                  <UnifiedChatPanel mode="full" />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />

        {/* KIMI Dokumenty — contact-required blocking page */}
        <Route
          path={ROUTES.WORDY}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.wordy', 'Documents')]}>
                <RouteErrorBoundary>
                  <KimiModuleGate moduleKey="wordy">
                    <WordyView />
                  </KimiModuleGate>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Legacy Excele/Tables route -> canonical Table Studio. */}
        <Route
          path={ROUTES.EXCELE}
          element={
            <RedirectPreservingQuery
              from={ROUTES.EXCELE}
              to={ROUTES.TABELE}
              reason="excele_merged_into_table_studio"
            />
          }
        />

        {/* KIMI Prezentacje — contact-required blocking page */}
        <Route
          path={ROUTES.PREZENTACJE_GEN}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.prezentacje', 'Presentations')]}>
                <RouteErrorBoundary>
                  <KimiModuleGate moduleKey="prezentacje">
                    <PrezentacjeView />
                  </KimiModuleGate>
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* KIMI Tabele Studio — operational tables workspace (D1=visible, sky accent) */}
        <Route
          path={ROUTES.TABELE}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.tabele', 'Tables')]}>
                <RouteErrorBoundary>
                  <TabeleView />
                </RouteErrorBoundary>
              </MainLayout>
            </ProtectedRoute>
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
        <Route
          path="/dashboard"
          element={
            <RedirectWithTracking
              from="/dashboard"
              to={ROUTES.AI_CHAT}
              reason="dashboard_deprecated"
            />
          }
        />

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
            <MainLayout breadcrumbs={breadcrumbs || ['Tools']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Tools"
              >
                <RouteErrorBoundary>
                  <DiscoveryToolsHub />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        {/* Discovery Tools - Strategic Tools with ToolWorkspace */}
        <Route
          path={ROUTES.DISCOVERY_TOOLS.STRATEGIC}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Tools', 'Strategic Analysis']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Tools"
              >
                <RouteErrorBoundary>
                  <DiscoveryToolsHub initialTab="library" initialCategory="strategic" />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        {/* T064 — Canonical Megatrend Analysis route */}
        <Route
          path={ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS}
          element={
            <MainLayout
              breadcrumbs={breadcrumbs || ['Tools', 'Strategic Analysis', 'Megatrends']}
              noPadding
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Tools"
              >
                <RouteErrorBoundary>
                  <div className="p-4 lg:p-6">
                    <MegatrendsWorkspace
                      source="tools"
                      showHeader
                      onBack={() => window.history.back()}
                    />
                  </div>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.DISCOVERY_TOOLS.OPERATIONAL}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Tools', 'Operational']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Tools"
              >
                <RouteErrorBoundary>
                  <DiscoveryToolsHub initialTab="library" initialCategory="operational" />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.DISCOVERY_TOOLS.DIGITAL}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Tools', 'Digital']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Tools"
              >
                <RouteErrorBoundary>
                  <DiscoveryToolsHub initialTab="library" initialCategory="digital" />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.DISCOVERY_TOOLS.PROCESS_AUTOMATION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Tools', 'Process Automation']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Tools"
              >
                <RouteErrorBoundary>
                  <DiscoveryToolsHub initialTab="library" initialCategory="automation" />
                </RouteErrorBoundary>
              </ProductionModuleGate>
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

        {/* M16 P0-4 — Legacy /context/* decommissioned: redirect to canonical /organization/*.
            ContextBuilderView is retained (referenced by quick-step entry paths) but the
            standalone /context route group now converges on the unified Organization workspace. */}
        <Route
          path={`${ROUTES.CONTEXT_BUILDER.ROOT}/*`}
          element={
            <Routes>
              <Route
                index
                element={
                  <RedirectWithTracking
                    from={ROUTES.CONTEXT_BUILDER.ROOT}
                    to={ROUTES.ORGANIZATION.ROOT}
                    reason="legacy_context_to_organization"
                  />
                }
              />
              <Route
                path="profile"
                element={
                  <RedirectWithTracking
                    from={ROUTES.CONTEXT_BUILDER.PROFILE}
                    to={ROUTES.ORGANIZATION.PROFILE}
                    reason="legacy_context_to_organization"
                  />
                }
              />
              <Route
                path="goals"
                element={
                  <RedirectWithTracking
                    from={ROUTES.CONTEXT_BUILDER.GOALS}
                    to={ROUTES.ORGANIZATION.GOALS}
                    reason="legacy_context_to_organization"
                  />
                }
              />
              <Route
                path="challenges"
                element={
                  <RedirectWithTracking
                    from={ROUTES.CONTEXT_BUILDER.CHALLENGES}
                    to={ROUTES.ORGANIZATION.CHALLENGES}
                    reason="legacy_context_to_organization"
                  />
                }
              />
              {/* T064 — Megatrends redirect to canonical Discovery Tools route */}
              <Route
                path="megatrends"
                element={<Navigate to={ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS} replace />}
              />
              <Route
                path="strategy"
                element={
                  <RedirectWithTracking
                    from={ROUTES.CONTEXT_BUILDER.STRATEGY}
                    to={ROUTES.ORGANIZATION.STRATEGY}
                    reason="legacy_context_to_organization"
                  />
                }
              />
              {/* Any other /context/* path → organization root */}
              <Route
                path="*"
                element={
                  <RedirectWithTracking
                    from={`${ROUTES.CONTEXT_BUILDER.ROOT}/*`}
                    to={ROUTES.ORGANIZATION.ROOT}
                    reason="legacy_context_to_organization"
                  />
                }
              />
            </Routes>
          }
        />

        {/* Licensed Tools alias - redirect to /assessment (T025) */}
        <Route path="/licensed-tools/*" element={<LicensedToolsRedirect />} />
        {/* Legacy Reports aliases */}
        <Route
          path="/reports-builder"
          element={
            <RedirectWithTracking
              from="/reports-builder"
              to={ROUTES.REPORTS.BUILDER}
              reason="legacy_reports_builder_alias"
            />
          }
        />
        <Route path="/reports-builder/:reportId" element={<ReportsBuilderLegacyRedirect />} />
        <Route
          path="/management-reports"
          element={
            <RedirectWithTracking
              from="/management-reports"
              to={ROUTES.REPORTS.MANAGEMENT}
              reason="legacy_management_reports_alias"
            />
          }
        />

        {/* Assessment Module - New Hub */}
        <Route
          path={`${ROUTES.ASSESSMENT.ROOT}/*`}
          element={
            <ProtectedRoute requireAuth={true}>
              <MainLayout breadcrumbs={breadcrumbs || ['Tools', 'Licensed']} noPadding>
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Tools"
                >
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
                </ProductionModuleGate>
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Transformation Modules - with MainLayout wrappers */}
        <Route
          path={ROUTES.INITIATIVES}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Initiatives']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Initiatives"
              >
                <RouteErrorBoundary>
                  <InitiativesHub />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ROADMAP}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Roadmap']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Initiatives"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <FullRoadmapView />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.PORTFOLIO}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Initiatives']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Initiatives"
              >
                <RouteErrorBoundary>
                  <PortfolioView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ROI}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['ROI']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Initiatives"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <FullROIView />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ECONOMICS}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Finance']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Finance"
              >
                <RouteErrorBoundary>
                  <EconomicsView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.FINANCE}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Finance']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Finance"
              >
                <RouteErrorBoundary>
                  <EconomicsView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/finance/statements/:id"
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Finance', 'Statement']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Finance"
              >
                <RouteErrorBoundary>
                  <EconomicsView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/finance/models/:id"
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Finance', 'Model']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Finance"
              >
                <RouteErrorBoundary>
                  <EconomicsView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/finance/analyses/:id"
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Finance', 'Analysis']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Finance"
              >
                <RouteErrorBoundary>
                  <EconomicsView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.EXECUTION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Execution']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Implementation"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <Suspense fallback={<LoadingScreen message="Loading..." />}>
                      <FullExecutionView />
                    </Suspense>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.IMPLEMENTATION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Implementation']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Implementation"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <Suspense fallback={<LoadingScreen message="Loading..." />}>
                      <ExecutionHub />
                    </Suspense>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.ROLLOUT}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Rollout']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Implementation"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <Suspense fallback={<LoadingScreen message="Loading..." />}>
                      <FullRolloutView />
                    </Suspense>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        {/* Reports & Presentations — unified V3 hub (V3-J01) */}
        <Route
          path={ROUTES.REPORTS.ROOT}
          element={
            <RedirectWithTracking
              from={ROUTES.REPORTS.ROOT}
              to={`${ROUTES.PRESENTATIONS}?tab=documents`}
              reason="reports_ui_moved_to_presentations"
            />
          }
        />
        <Route path="/assessment-reports/:reportId" element={<LegacyAssessmentReportRedirect />} />
        {/* Report Builder — deliverable reports */}
        <Route
          path={ROUTES.REPORTS.BUILDER}
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('sidebar.reportsBuilder', 'Report Builder'),
                ]
              }
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <ReportBuilderView />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={`${ROUTES.REPORTS.BUILDER}/:reportId`}
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('sidebar.reportsBuilder', 'Report Builder'),
                  t('common.edit', 'Edit'),
                ]
              }
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <ReportBuilderView />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        {/* Management Reports — legacy (deprecated) */}
        <Route
          path={ROUTES.REPORTS.MANAGEMENT}
          element={
            <RedirectWithTracking
              from={ROUTES.REPORTS.MANAGEMENT}
              to={`${ROUTES.PRESENTATIONS}?tab=documents`}
              reason="reports_management_deprecated"
            />
          }
        />
        <Route
          path={ROUTES.KPI_OKR}
          element={
            <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.results', 'Results')]} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Results"
              >
                <RouteErrorBoundary>
                  <KpiOkrView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.PRESENTATIONS}
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('rap.outputs.breadcrumb.library', 'Library'),
                ]
              }
              noPadding
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <ReportsAndPresentationsHub />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.PRESENTATION_STUDIO}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Presentation Studio']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Presentation Studio"
              >
                <RouteErrorBoundary>
                  <PresentationStudioPage />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.MEETING}
          element={
            <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.meeting', 'Meeting')]}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  <V4ComingSoonView />
                </AnimationWrapper>
              </RouteErrorBoundary>
            </MainLayout>
          }
        />
        <Route
          path="/presentations/wizard"
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('rap.breadcrumb.presentationWizard', 'Presentation Wizard'),
                ]
              }
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <PresentationWizard />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/presentations/builder/:deckId"
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('rap.breadcrumb.deckBuilder', 'Deck Builder'),
                ]
              }
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <DeckBuilder />
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/document-studio"
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('documentStudio.breadcrumb', 'Document Studio'),
                ]
              }
              noPadding
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <DocumentStudioView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/document-studio/:artifactId"
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.outputsLibrary', 'Outputs'),
                  t('documentStudio.breadcrumb', 'Document Studio'),
                ]
              }
              noPadding
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Outputs"
              >
                <RouteErrorBoundary>
                  <DocumentStudioView />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path="/presentations/shared/:shareToken"
          element={
            <RouteErrorBoundary>
              <SharedPresentationView />
            </RouteErrorBoundary>
          }
        />
        <Route
          path="/presentations/embed/:shareToken"
          element={
            <RouteErrorBoundary>
              <SharedPresentationView />
            </RouteErrorBoundary>
          }
        />
        <Route
          path={ROUTES.BENEFITS}
          element={
            <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.results', 'Results')]} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Results"
              >
                <RouteErrorBoundary>
                  <ResultsHub />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        {/* MCP IRIS + Marketplace dropped from navigation (decision D7). Redirect
            any direct/bookmarked URL access to the canonical home (/chat). */}
        <Route path={ROUTES.MCP_IRIS} element={<Navigate to={ROUTES.AI_CHAT} replace />} />
        <Route path={ROUTES.MCP_MARKETPLACE} element={<Navigate to={ROUTES.AI_CHAT} replace />} />

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

        {/* Partner Portal - New DBR77 Consultify Partner Portal */}
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
            <ProtectedRoute requireAuth={true}>
              <AnimationWrapper variant="slideUp">
                <ConsultantInviteView />
              </AnimationWrapper>
            </ProtectedRoute>
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
          path={ROUTES.PARTNER.ONBOARDING}
          element={
            <ProtectedRoute requireAuth={true}>
              <AnimationWrapper variant="slideUp">
                <EnterpriseOnboardingWizard />
              </AnimationWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.TRIAL_ENTRY}
          element={
            <AnimationWrapper variant="slideUp">
              <TrialEntryView
                onStartTrial={() => {
                  setSessionMode(SessionMode.FULL);
                  setAuthInitialStep(AuthStep.REGISTER);
                  setCurrentView(AppView.AUTH);
                  navigate('/trial/start');
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
        {/* Legacy standalone legal routes → redirect to database-backed /legal/:slug */}
        <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
        <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
        <Route path="/cookies" element={<Navigate to="/legal/cookies" replace />} />
        <Route path="/security" element={<Navigate to="/legal/security" replace />} />
        <Route
          path={ROUTES.VECTOR}
          element={
            <AnimationWrapper variant="fade">
              <VectorPage />
            </AnimationWrapper>
          }
        />

        {/* Legal Center - Public (T093) */}
        <Route
          path="/legal"
          element={
            <AnimationWrapper variant="fade">
              <LegalIndexView />
            </AnimationWrapper>
          }
        />
        <Route
          path="/legal/:docSlug"
          element={
            <AnimationWrapper variant="fade">
              <LegalDocumentView />
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
              <KnowledgeBaseEntryView />
            </AnimationWrapper>
          }
        />
        <Route
          path={ROUTES.APP_PRICING}
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
