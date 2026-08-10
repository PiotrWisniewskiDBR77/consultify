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
import { BetaGate, ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { AnimationWrapper } from '@/components/shared/AnimationWrapper';
import { V8UnavailableBanner } from '@/components/shared/V8UnavailableBanner';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { AppView, AuthStep, SessionMode, User } from '@/types';
import { isClientReaderEnabled } from '@/utils/clientReaderFlag';
import { isDrdReportEnabled } from '@/utils/drdReportFlag';
import { isExceleEngineEnabled } from '@/utils/exceleFlag';
import { canUseInternalTools } from '@/utils/internalToolsAccess';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { shouldHideNonCoreModulesInPublicProduction } from '@/utils/publicProduction';
import { isSuperAdminRole } from '@/utils/roleGuards';
import { isStudioEnabled } from '@/utils/studioFlag';
import { AuthView } from '@/views/AuthView';
import { ProductEntryPage } from '@/views/ProductEntryPage';
import { StudioUnavailableView } from '@/views/StudioUnavailableView';

import { buildCanonicalRedirectTarget, buildCanonicalTabRedirectTarget } from './canonicalRedirect';
import { LegacyAssessmentReportRedirect } from './LegacyAssessmentReportRedirect';
import { LicensedToolsRedirect } from './LicensedToolsRedirect';
import { buildMaterialsStudioBreadcrumb } from './materialsStudioBreadcrumb';
import { resolvePresentationWizardRedirectTarget } from './presentationWizardRedirect';
import { ROUTES } from './routeConfig';
import { WorkCanvasRedirect } from './WorkCanvasRedirect';

// Lazy load views for new routes
const StudioView = lazyWithRetry(() =>
  import('@/views/StudioView').then((m) => ({ default: m.StudioView }))
);
const MyWorkView = lazyWithRetry(() =>
  import('@/views/MyWorkView').then((m) => ({ default: m.MyWorkView }))
);
// HP-22 / HP-4 F3 (Client Vault, Run agent): the lazy view components and
// their route-level flag gates were removed here in VLT-004/AGT-003
// (relokacja 2026-07-23) — both surfaces now render from the My Work tab
// (MyWorkHub.tsx); ROUTES.CLIENT_VAULT/ROUTES.AGENT_PLAN below are
// redirect-only so old links don't 404.
// M16 P0-4: ContextBuilderView is no longer routed standalone — /context/* now
// redirects to the canonical /organization/* workspace. The view file is retained
// because quick-step entry paths still resolve through these (redirected) routes.
// Discovery Tools Module - New Hub
const DiscoveryToolsHub = lazyWithRetry(() =>
  import('@/components/Discovery/DiscoveryToolsHub').then((m) => ({ default: m.DiscoveryToolsHub }))
);

// T064 — Megatrends canonical workspace
const MegatrendsWorkspace = lazyWithRetry(() =>
  import('@/components/Megatrend/MegatrendsWorkspace').then((m) => ({
    default: m.MegatrendsWorkspace,
  }))
);

// Assessment Module - New Hub
const AssessmentHub = lazyWithRetry(() =>
  import('@/components/assessment/AssessmentHub').then((m) => ({ default: m.AssessmentHub }))
);
const AssessmentSessionEditorView = lazyWithRetry(() =>
  import('@/views/AssessmentSessionEditorView').then((m) => ({
    default: m.AssessmentSessionEditorView,
  }))
);

// Transformation Modules - New Hubs (ModuleHub pattern)
const InitiativesHub = lazyWithRetry(() =>
  import('@/components/Initiatives/InitiativesHub').then((m) => ({ default: m.InitiativesHub }))
);
const ExecutionHub = lazyWithRetry(() =>
  import('@/components/Execution/ExecutionHub').then((m) => ({ default: m.ExecutionHub }))
);
const ResultsHub = lazyWithRetry(() =>
  import('@/components/Results/ResultsHub').then((m) => ({ default: m.default }))
);
// RN-G2 (2026-08-10) — Results Next registry shells (P0). New routes ALONGSIDE
// the legacy ResultsHub above, not instead of it — see RN_G2_UI_SCOPE.md §E.
const ResultsKpiRegistryPage = lazyWithRetry(() =>
  import('@/components/ResultsVNext/ResultsKpiRegistryPage').then((m) => ({
    default: m.default,
  }))
);
const ResultsRoiRegistryPage = lazyWithRetry(() =>
  import('@/components/ResultsVNext/ResultsRoiRegistryPage').then((m) => ({
    default: m.default,
  }))
);
const ResultsOkrRegistryPage = lazyWithRetry(() =>
  import('@/components/ResultsVNext/ResultsOkrRegistryPage').then((m) => ({
    default: m.default,
  }))
);
// RN-G2 P1 #8 (2026-08-10) — KPI Scorecards detail route
// (`/results/kpi/scorecards/:scorecardId`, master plan §11). List-only
// surface (items + review snapshots as StandardTable tabs) inside the same
// ResultsVNextRegistryShell the KPI registry uses — see the component's own
// header comment for the deliberate archetype deferral.
const ResultsKpiScorecardDetailPage = lazyWithRetry(() =>
  import('@/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage').then((m) => ({
    default: m.default,
  }))
);

const ConclusionsHub = lazyWithRetry(() =>
  import('@/components/Conclusions/ConclusionsHub').then((m) => ({ default: m.default }))
);

// Legacy views (kept for backward compatibility)
const FullInitiativesView = lazyWithRetry(() =>
  import('@/views/FullInitiativesView').then((m) => ({ default: m.FullInitiativesView }))
);
// FullRoadmapView and PortfolioView are retained as legacy source files only.
// Their historical routes redirect to the single InitiativesHub owner below.
const FullROIView = lazyWithRetry(() =>
  import('@/views/FullROIView').then((m) => ({ default: m.FullROIView }))
);
const EconomicsView = lazyWithRetry(() =>
  import('@/views/EconomicsView').then((m) => ({ default: m.EconomicsView }))
);
const ReportBuilderView = lazyWithRetry(() =>
  import('@/views/ReportBuilderView').then((m) => ({ default: m.ReportBuilderView }))
);
const ManagementReportsHub = lazyWithRetry(() =>
  import('@/components/Reports/Management/ReportsHub').then((m) => ({ default: m.ReportsHub }))
);
const SharedPresentationView = lazyWithRetry(() =>
  import('@/components/Presentations/SharedPresentationView').then((m) => ({
    default: m.SharedPresentationView,
  }))
);
// MAT-006 (2026-08-02) — public, unauthenticated reader for a shared
// workbook (`GET /api/workbook/shared/:token`), mirrors SharedPresentationView.
const SharedWorkbookView = lazyWithRetry(() =>
  import('@/components/AIChat/KimiWorkspace/SharedWorkbookView').then((m) => ({
    default: m.SharedWorkbookView,
  }))
);
const ReportsAndPresentationsHub = lazyWithRetry(() =>
  import('@/components/ReportsAndPresentations/ReportsAndPresentationsHub').then((m) => ({
    default: m.ReportsAndPresentationsHub,
  }))
);
// Consultify Presentation Studio (Module Delivery Contract S5) — read-only
// surface that consumed the four /api/presentation-studio/*/preview endpoints.
// Route retired 2026-07-27 (front wygaszony, zero linków w UI — patrz
// PresentationStudioRedirect powyżej); komponent NIE skasowany, więc lazy
// import zostaje niepotrzebny tu — patrz `_SPIS_MARTWYCH_DO_KASACJI_2026-07-27.md`.
// Consultify Document Studio (MVP-1, Mode 1) — productized Document runtime
// above the V8.1 substrate.
// See docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md.
const DocumentStudioView = lazyWithRetry(() =>
  import('@/components/DocumentStudio/DocumentStudioView').then((m) => ({
    default: m.DocumentStudioView,
  }))
);
const DeckBuilder = lazyWithRetry(() =>
  import('@/components/Presentations/DeckBuilder/DeckBuilder').then((m) => ({
    default: m.DeckBuilder,
  }))
);
// PresentationWizard lazy import retired 2026-07-27 — `/presentations/wizard`
// is now redirect-only (PresentationWizardRedirect above); component kept
// under src/components/Presentations/PresentationWizard.tsx, unimported here.
const MeetingHub = lazyWithRetry(() =>
  import('@/components/Meeting/MeetingHub').then((m) => ({ default: m.MeetingHub }))
);
// NOTE: Legacy Management Reports UI has been deprecated in favor of the unified
// Reports & Presentations hub under /presentations (tab=documents).

// Settings
const SettingsView = lazyWithRetry(() =>
  import('@/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

// Organization
const OrganizationView = lazyWithRetry(() =>
  import('@/views/OrganizationView').then((m) => ({ default: m.OrganizationView }))
);

// Admin
const AdminView = lazyWithRetry(() =>
  import('@/views/admin/AdminView').then((m) => ({ default: m.AdminView }))
);

// SuperAdmin
const SuperAdminView = lazyWithRetry(() =>
  import('@/views/superadmin/SuperAdminView').then((m) => ({ default: m.SuperAdminView }))
);

// AI Chat (Full Screen Chat View) — Wave 1 canonical shell.
const UnifiedChatPanel = lazyWithRetry(() =>
  import('@/components/AIChat/UnifiedChatPanel').then((m) => ({ default: m.UnifiedChatPanel }))
);
const AIOSHub = lazyWithRetry(() =>
  import('@/components/AIChat/AIOSHub').then((m) => ({ default: m.AIOSHub }))
);
const ActionCenter = lazyWithRetry(() =>
  import('@/components/AIChat/ActionCenter').then((m) => ({ default: m.ActionCenter }))
);
const ResearchSessionsDock = lazyWithRetry(() =>
  import('@/components/AIChat/ResearchSessionsDock').then((m) => ({
    default: m.ResearchSessionsDock,
  }))
);
const Wave5ArtifactRuntimePanel = lazyWithRetry(() =>
  import('@/components/AIChat/Wave5ArtifactRuntimePanel').then((m) => ({
    default: m.Wave5ArtifactRuntimePanel,
  }))
);
const Wave6ContextLearningPanel = lazyWithRetry(() =>
  import('@/components/AIChat/Wave6ContextLearningPanel').then((m) => ({
    default: m.Wave6ContextLearningPanel,
  }))
);
const Wave7ConnectorAdminPanel = lazyWithRetry(() =>
  import('@/components/AIChat/Wave7ConnectorAdminPanel').then((m) => ({
    default: m.Wave7ConnectorAdminPanel,
  }))
);
const Wave8AgentCatalogPanel = lazyWithRetry(() =>
  import('@/components/AIChat/Wave8AgentCatalogPanel').then((m) => ({
    default: m.Wave8AgentCatalogPanel,
  }))
);
const Wave9OutcomeAIOpsPanel = lazyWithRetry(() =>
  import('@/components/AIChat/Wave9OutcomeAIOpsPanel').then((m) => ({
    default: m.Wave9OutcomeAIOpsPanel,
  }))
);

// KIMI-style workspaces (P20 Prezentacje). The P22 Wordy workspace
// (WordyView) is deprecated — `/wordy` now redirects to the canonical
// Document Studio (`/document-studio`); see the route below.
const PrezentacjeView = lazyWithRetry(() =>
  import('@/components/AIChat/KimiWorkspace/PrezentacjeView').then((m) => ({
    default: m.PrezentacjeView,
  }))
);
// KIMI-style Tabele workspace (Table Studio Foundation block — sky accent, D1=visible)
const TabeleView = lazyWithRetry(() =>
  import('@/components/AIChat/KimiWorkspace/TabeleView').then((m) => ({
    default: m.default,
  }))
);
// Excel engine (real .xlsx z formułami) — odsłaniany pod /excele za flagą
// isExceleEngineEnabled (default OFF → redirect jak dziś). Audyt 2026-07-22.
const ExceleView = lazyWithRetry(() =>
  import('@/components/AIChat/KimiWorkspace/ExceleView').then((m) => ({
    default: m.default,
  }))
);

// Discovery Consultant (AI Discovery with Canvas)
const DiscoveryConsultantView = lazyWithRetry(() =>
  import('@/components/Discovery/DiscoveryConsultantView').then((m) => ({
    default: m.DiscoveryConsultantView,
  }))
);

// Become Partner (Public Partner Recruitment Page)
const BecomePartnerView = lazyWithRetry(() => import('@/views/BecomePartnerView'));
const PartnerApplicationView = lazyWithRetry(() => import('@/views/PartnerApplicationView'));

// Dashboard - DEPRECATED: Removed, redirects to Chat

// Project Intelligence (legacy)
const ProjectIntelligenceView = lazyWithRetry(() =>
  import('@/views/ProjectIntelligenceView').then((m) => ({ default: m.ProjectIntelligenceView }))
);

// Projects — Zwornik (#78): stakeholder registry + finance rollup per project.
const MyProjects = lazyWithRetry(() =>
  import('@/components/MyWork/MyProjects').then((m) => ({ default: m.MyProjects }))
);

// Interview Module - New Hub (ModuleHub pattern) - BCG Enterprise Level
const InterviewHub = lazyWithRetry(() =>
  import('@/components/Interview/InterviewHub').then((m) => ({ default: m.InterviewHub }))
);

// AI Actions
const ActionProposalView = lazyWithRetry(() =>
  import('@/views/ActionProposalView').then((m) => ({ default: m.ActionProposalView }))
);

// Partner Portal - New DBR77 Consultify Partner Portal
const PartnerPortalViewNew = lazyWithRetry(() =>
  import('@/views/partner/PartnerPortalView').then((m) => ({ default: m.PartnerPortalViewNew }))
);

const PartnerPricingView = lazyWithRetry(() =>
  import('@/views/partner/PartnerPricingView').then((m) => ({ default: m.PartnerPricingView }))
);
const ClientAccessView = lazyWithRetry(() =>
  import('@/views/partner/ClientAccessView').then((m) => ({ default: m.ClientAccessView }))
);
const ProviderHomeView = lazyWithRetry(() =>
  import('@/views/partner/ProviderHomeView').then((m) => ({ default: m.ProviderHomeView }))
);

// Consultant
const ConsultantPanelView = lazyWithRetry(() =>
  import('@/views/consultant/ConsultantPanelView').then((m) => ({ default: m.ConsultantPanelView }))
);
const ConsultantInviteView = lazyWithRetry(() =>
  import('@/views/consultant/ConsultantInviteView').then((m) => ({
    default: m.ConsultantInviteView,
  }))
);

// Wizards
const OrgSetupWizard = lazyWithRetry(() =>
  import('@/views/OrgSetupWizard').then((m) => ({ default: m.OrgSetupWizard }))
);
const OnboardingWizard = lazyWithRetry(() =>
  import('@/views/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard }))
);
const EnterpriseOnboardingWizard = lazyWithRetry(() =>
  import('@/components/Onboarding/EnterpriseOnboardingWizard').then((m) => ({
    default: m.EnterpriseOnboardingWizard,
  }))
);
const TrialEntryView = lazyWithRetry(() =>
  import('@/views/TrialEntryView').then((m) => ({ default: m.TrialEntryView }))
);

// Legal Pages
const AboutView = lazyWithRetry(() =>
  import('@/views/legal/AboutView').then((m) => ({ default: m.AboutView }))
);
const ContactView = lazyWithRetry(() =>
  import('@/views/legal/ContactView').then((m) => ({ default: m.ContactView }))
);
// Standalone legal views removed — all legal documents served via LegalDocumentView (/legal/:docSlug)
const VectorPage = lazyWithRetry(() =>
  import('../views/VectorPage').then((m) => ({ default: m.VectorPage }))
);
const LegalIndexView = lazyWithRetry(() =>
  import('@/views/LegalIndexView').then((m) => ({ default: m.LegalIndexView }))
);
const LegalDocumentView = lazyWithRetry(() =>
  import('@/views/LegalDocumentView').then((m) => ({ default: m.LegalDocumentView }))
);
const OAuthCallbackView = lazyWithRetry(() => import('@/views/OAuthCallback'));
const ForgotPasswordView = lazyWithRetry(() =>
  import('@/views/auth/ForgotPasswordView').then((m) => ({ default: m.ForgotPasswordView }))
);
const ResetPasswordView = lazyWithRetry(() =>
  import('@/views/auth/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView }))
);

// Status & Changelog
const StatusPageView = lazyWithRetry(() =>
  import('@/views/StatusPageView').then((m) => ({ default: m.StatusPageView }))
);
const ChangelogView = lazyWithRetry(() =>
  import('@/views/ChangelogView').then((m) => ({ default: m.ChangelogView }))
);

// Knowledge Base & Pricing
const KnowledgeBaseEntryView = lazyWithRetry(() =>
  import('@/views/KnowledgeBaseEntryView').then((m) => ({ default: m.KnowledgeBaseEntryView }))
);
const AppPricingView = lazyWithRetry(() =>
  import('@/views/AppPricingView').then((m) => ({ default: m.AppPricingView }))
);
const ExecutiveView = lazyWithRetry(() =>
  import('@/views/ExecutiveView').then((m) => ({ default: m.ExecutiveView }))
);
const BusinessCasesPage = lazyWithRetry(() =>
  import('@/views/BusinessCasesPage').then((m) => ({ default: m.BusinessCasesPage }))
);

// Documentation Portal (Public)
const KnowledgeBaseHomePage = lazyWithRetry(() =>
  import('@/views/knowledge/KnowledgeBaseHomePage').then((m) => ({
    default: m.KnowledgeBaseHomePage,
  }))
);
const KnowledgeBaseCategoryPage = lazyWithRetry(() =>
  import('@/views/knowledge/KnowledgeBaseCategoryPage').then((m) => ({
    default: m.KnowledgeBaseCategoryPage,
  }))
);
const KnowledgeBaseArticlePage = lazyWithRetry(() =>
  import('@/views/knowledge/KnowledgeBaseArticlePage').then((m) => ({
    default: m.KnowledgeBaseArticlePage,
  }))
);
const DocsLayout = lazyWithRetry(() =>
  import('@/layouts/DocsLayout').then((m) => ({ default: m.DocsLayout }))
);
const DocsHomeView = lazyWithRetry(() =>
  import('@/views/docs/DocsHomeView').then((m) => ({ default: m.DocsHomeView }))
);
const DocsCategoryView = lazyWithRetry(() =>
  import('@/views/docs/DocsCategoryView').then((m) => ({ default: m.DocsCategoryView }))
);
const DocsArticleView = lazyWithRetry(() =>
  import('@/views/docs/DocsArticleView').then((m) => ({ default: m.DocsArticleView }))
);
const DocsSearchView = lazyWithRetry(() =>
  import('@/views/docs/DocsSearchView').then((m) => ({ default: m.DocsSearchView }))
);
const DocsApiReferenceView = lazyWithRetry(() =>
  import('@/views/docs/DocsApiReferenceView').then((m) => ({ default: m.DocsApiReferenceView }))
);
const DocsChangelogView = lazyWithRetry(() =>
  import('@/views/docs/DocsChangelogView').then((m) => ({ default: m.DocsChangelogView }))
);
const DocsSecurityView = lazyWithRetry(() =>
  import('@/views/docs/DocsSecurityView').then((m) => ({ default: m.DocsSecurityView }))
);

// Public Form Page (Table Platform)
const PublicFormPage = lazyWithRetry(() =>
  import('@/components/MyWork/table/forms/PublicFormPage').then((m) => ({
    default: m.PublicFormPage,
  }))
);

// Public JWT Form Page (Table Platform · Block D · D-S4)
const PublicJwtFormPage = lazyWithRetry(() =>
  import('@/components/MyWork/table/forms/PublicJwtFormPage').then((m) => ({
    default: m.PublicJwtFormPage,
  }))
);

// Public Shared View (Table Platform)
const PublicViewPage = lazyWithRetry(() => import('@/components/MyWork/table/PublicViewPage'));
// F1/F3 — Document Studio client reader (share-link, read-only). Za flagą
// `ff_client_reader` (default OFF) — patrz `src/utils/clientReaderFlag.ts`.
const SharedDocumentReaderPage = lazyWithRetry(
  () => import('@/components/DocumentStudio/publicReader/SharedDocumentReaderPage')
);
// Public Booking Widget (#24c) — Calendly-like, niezalogowane.
const PublicBookingView = lazyWithRetry(() =>
  import('@/views/PublicBookingView').then((m) => ({ default: m.PublicBookingView }))
);
// Audit Orchestrator hub (audit #19 family) — authenticated module route.
const AuditProgramsHub = lazyWithRetry(() => import('@/components/Audit/AuditsHub'));
// DRD Audit Report engine — full editor (AI chat, per-section AI actions, PDF
// export, publishing-grade "Raport DRD" client report) wired to a live backend
// but previously reachable by ZERO routes (audyt 2026-07-26). Flag-gated entry
// under the Audits module — see src/utils/drdReportFlag.ts (default OFF).
const DRDAuditReportView = lazyWithRetry(() =>
  import('@/views/DRDAuditReportView').then((m) => ({ default: m.DRDAuditReportView }))
);

// Public Mini Assessment (T015)
const PublicMiniAssessmentView = lazyWithRetry(() =>
  import('@/views/PublicMiniAssessmentView').then((m) => ({ default: m.PublicMiniAssessmentView }))
);

// Education Hub (Public)
const ToolsShowcasePage = lazyWithRetry(() =>
  import('@/views/ToolsShowcasePage').then((m) => ({ default: m.ToolsShowcasePage }))
);
const AuditsShowcasePage = lazyWithRetry(() =>
  import('@/views/AuditsShowcasePage').then((m) => ({ default: m.AuditsShowcasePage }))
);
const ResourcesPage = lazyWithRetry(() =>
  import('@/views/ResourcesPage').then((m) => ({ default: m.ResourcesPage }))
);
const HowItWorksPage = lazyWithRetry(() =>
  import('@/views/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage }))
);
const AppIntroView = lazyWithRetry(() => import('@/views/AppIntroView'));

// DRD Maturity Matrix — read-only DEMONSTRATION prototype (Piotr's Digital
// Pathfinder). Reconnects the previously orphaned DRD_STRUCTURE + MaturityMatrix
// onto an achievable URL for live review. Not a production flow.
const DRDMatrixPreview = lazyWithRetry(() =>
  import('@/views/DRDMatrixPreview').then((m) => ({ default: m.DRDMatrixPreview }))
);

const ForWhomPage = lazyWithRetry(() =>
  import('@/views/ForWhomPage').then((m) => ({ default: m.ForWhomPage }))
);

const PricingLandingPage = lazyWithRetry(() =>
  import('@/views/PricingLandingPage').then((m) => ({ default: m.PricingLandingPage }))
);

const EnterprisePage = lazyWithRetry(() =>
  import('@/views/EnterprisePage').then((m) => ({ default: m.EnterprisePage }))
);

const OurStoryPage = lazyWithRetry(() =>
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
  const target = buildCanonicalRedirectTarget(to, location);
  React.useEffect(() => {
    trackFunnelEvent('route_redirected', { from, to: target, reason });
  }, [from, target, reason]);
  return <Navigate to={target} replace />;
};

const RedirectToCanonicalTab: React.FC<{
  from: string;
  to: string;
  tab: string;
  reason: string;
}> = ({ from, to, tab, reason }) => {
  const location = useLocation();
  const target = buildCanonicalTabRedirectTarget(to, location, tab);
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

/**
 * `/presentations/wizard` — scalenie wejść prezentacji 2026-07-27
 * (Harvard/wdrozenie-100/_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md,
 * "DO SCALENIA" #1). `PresentationWizard` był osierocony z nawigacji (zero
 * linków w UI) i żył tylko z deep-linków tworzonych przez
 * artifactNavigation.ts / chatActionHandler.ts / useActionHandler.ts /
 * server `artifacts.routes.ts` (openPath dla `presentation_template`) — te
 * cztery miejsca zostały przepięte na kanoniczne cele (Teresa /prezentacje
 * dla generacji, Architekt szablonów dla edycji/klonu). Ta trasa zostaje
 * jako redirect na wypadek starych zakładek/bookmarków, zamiast usuwać ją
 * całkiem — patrz reguła "przycisk cofania" (CLAUDE.md #8). Rozgałęzienie
 * celu wg query — patrz `resolvePresentationWizardRedirectTarget`
 * (wyodrębnione do osobnego pliku, żeby dało się to przetestować bez
 * montowania całego drzewa routera).
 */
const PresentationWizardRedirect: React.FC = () => {
  const location = useLocation();
  const { target, reason } = resolvePresentationWizardRedirectTarget(location.search);

  React.useEffect(() => {
    trackFunnelEvent('route_redirected', { from: '/presentations/wizard', to: target, reason });
  }, [target, reason]);

  return <Navigate to={target} replace />;
};

/**
 * `/presentation-studio` — porzucony sprint z maja (preview+approval nakładka
 * na ten sam silnik `presentationGeneratorService`), zero linków w UI
 * (potwierdzone grep 2026-07-27: brak w sidebarze/nawigacji). Wygaszenie
 * frontu wg inwentarza "DO WYGASZENIA" — backend (`presentationStudio.routes.ts`
 * + serwisy) zostaje jako fundament pod przyszły "approval gate", komponenty
 * `src/components/PresentationStudio/*` też NIE są kasowane w tym kroku.
 */
const PresentationStudioRedirect: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search || '');
  params.set('tab', 'presentations');
  const target = `/presentations?${params.toString()}`;

  React.useEffect(() => {
    trackFunnelEvent('route_redirected', {
      from: ROUTES.PRESENTATION_STUDIO,
      to: target,
      reason: 'presentation_studio_retired',
    });
  }, [target]);

  return <Navigate to={target} replace />;
};

/**
 * Audits module entry for the DRD audit report engine (audyt 2026-07-26).
 * Reads `:reportId` from the URL and mounts `DRDAuditReportView`, which
 * fetches the report itself via `GET /assessment-reports/:reportId/full`
 * (contract: src/views/DRDAuditReportView.tsx — `api.getFullReport`).
 * Flag-gated (`isDrdReportEnabled`, default OFF): OFF → redirects to
 * /audit-programs so the route is a no-op for every user until Piotr
 * accepts the visual on a dev-render screenshot (canon: "Piotr nigdy nie
 * jest pierwszym testerem wizualnym").
 */
const DRDAuditReportRoute: React.FC = () => {
  const params = useParams<{ reportId: string }>();
  if (!isDrdReportEnabled()) {
    return <Navigate to="/audit-programs" replace />;
  }
  return <DRDAuditReportView reportId={params.reportId} />;
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

// VTS pilot scope: these route modules stay enabled on public production even
// when non-core modules are otherwise hidden (sidebar visibility is handled
// separately in publicProduction.ts / pilotAccess.ts). Keep names in sync with
// the `moduleName` props below.
const PUBLIC_PRODUCTION_CORE_ROUTE_MODULES = new Set(['My Work', 'Initiatives', 'Implementation']);
const ProductionModuleGate: React.FC<{
  enabled: boolean;
  moduleName: string;
  children: React.ReactNode;
}> = ({ enabled, moduleName, children }) =>
  enabled || PUBLIC_PRODUCTION_CORE_ROUTE_MODULES.has(moduleName) ? (
    <>{children}</>
  ) : (
    <PublicProductionModuleDisabled moduleName={moduleName} />
  );

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

  // FAZA B3 (2026-07-27): the 3 Materiały studios (Document Studio,
  // Prezentacje, Excel) resume an existing material via `?artifactId=`
  // (or, for Document Studio, `/document-studio/:artifactId`). Used to pick
  // a "resumed" vs "new" label for the studio breadcrumb's last segment —
  // we don't have the real material title here without reaching into each
  // studio's own load state (out of scope for this pass, see report).
  const materialsArtifactIdParam = new URLSearchParams(location.search).get('artifactId');

  const isSuperAdmin = isSuperAdminRole(currentUser?.role);
  const hideNonCoreModulesOnPublicProduction = React.useMemo(
    () => shouldHideNonCoreModulesInPublicProduction(),
    []
  );
  const internalToolsEnabled = canUseInternalTools(currentUser);

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

        {/*
          F1/F3 — Document Studio client reader, no auth required.
          Za flagą `isClientReaderEnabled()` (default OFF): OFF → trasa
          efektywnie NIE ISTNIEJE (redirect na "*" catch-all, tak samo jak
          każdy inny nieznany URL), zero regresji. ON → montuje read-only
          czytnik dokumentu przez share-link token (scope read/comment/
          download/edit — sam token niesie autoryzację, backend resolve'uje
          organizationId/artifactId server-side, patrz
          `documentShareLinkPublicRoutes` w document-studio.routes.ts).
        */}
        <Route
          path="/shared/doc/:token"
          element={
            isClientReaderEnabled() ? (
              <Suspense fallback={<LoadingScreen message="Ładowanie dokumentu..." />}>
                <SharedDocumentReaderPage />
              </Suspense>
            ) : (
              <Navigate to={ROUTES.WELCOME} replace />
            )
          }
        />

        {/* Public Booking Widget (#24c) — Calendly-like, no auth required */}
        <Route
          path="/book/:consultantSlug"
          element={
            <Suspense fallback={<LoadingScreen message="Ładowanie terminów..." />}>
              <PublicBookingView />
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

        {/* DRD Maturity Matrix — read-only DEMONSTRATION prototype (Piotr's
            Digital Pathfinder). Publicly reachable by URL for live review;
            no auth, no backend. Not a production flow. */}
        <Route
          path="/drd-matrix-preview"
          element={
            <Suspense fallback={<LoadingScreen message="Loading matrix..." />}>
              <DRDMatrixPreview />
            </Suspense>
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
              // 2026-07-28 fix: a deep link bounced here via RouterSync/
              // ProtectedRoute (both now write `?redirect=<original path+query>`,
              // e.g. an Excel workbook link's `artifactId` + `ff_excele_edit`)
              // must land back on that original destination, not unconditionally
              // on AI_CHAT — this ternary used to win that race and drop it.
              // Same same-origin-relative guard as the two producers.
              <Navigate
                to={(() => {
                  const raw = new URLSearchParams(location.search).get('redirect');
                  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : ROUTES.AI_CHAT;
                })()}
                replace
              />
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

        {/* Studio — gated OFF by default (studioFlag): AI chat backend
            (/api/studio/ai/*) was never implemented server-side, so the
            real StudioView crashes on first chat message. Placeholder
            keeps the route reachable without exposing the broken chat. */}
        <Route
          path={ROUTES.STUDIO}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Studio']}>
              <RouteErrorBoundary>
                <AnimationWrapper variant="slideUp">
                  {isStudioEnabled() ? <StudioView /> : <StudioUnavailableView />}
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

        {/* Projects — Zwornik (#78): stakeholder registry + finance rollup */}
        <Route
          path={ROUTES.PROJECTS}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Projects']} noPadding>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Projects"
              >
                <RouteErrorBoundary>
                  <MyProjects />
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />

        {/* Client Vault (HP-22, Harvey-Parity) — VLT-004 (relokacja
            2026-07-23): the surface moved from its own route into the My
            Work "Vault" tab (MyWorkHub.tsx). This route is kept only so old
            /vault links (bookmarks, other in-app links) never 404 — it
            always redirects to the tab; MyWorkHub itself gates the tab on
            isClientVaultEnabled(), so a stale link falls back to the default
            tab if the flag is ever off. */}
        <Route
          path={ROUTES.CLIENT_VAULT}
          element={<Navigate to={`${ROUTES.MY_WORK}?tab=vault`} replace />}
        />

        {/* Run agent (HP-4 F3, Harvey-Parity) — AGT-003 (relokacja
            2026-07-23): the surface moved from its own route into the My
            Work "Agent" tab (MyWorkHub.tsx). This route is kept only so old
            /agent-plan links never 404 — it always redirects to the tab;
            MyWorkHub itself gates the tab on isAgentPlanEnabled(). */}
        <Route
          path={ROUTES.AGENT_PLAN}
          element={<Navigate to={`${ROUTES.MY_WORK}?tab=agent`} replace />}
        />

        {/* Audit Orchestrator (audit #19 family) — authenticated, inside the
            app shell so it gets nav + bearer token. /audits stays the public
            showcase; the functional hub lives at /audit-programs. */}
        <Route
          path="/audit-programs"
          element={
            <BetaGate moduleId="MODULE_AUDITS">
              <MainLayout breadcrumbs={breadcrumbs || ['Audits']}>
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <Suspense fallback={<LoadingScreen message="Loading audits..." />}>
                      <AuditProgramsHub />
                    </Suspense>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </MainLayout>
            </BetaGate>
          }
        />

        {/* DRD Audit Report engine (audyt 2026-07-26) — reconnects the
            previously orphaned DRDAuditReportView (zero importers, live
            backend) onto the Audits module. Flag-gated (isDrdReportEnabled,
            default OFF, ?ff_drd_report=1 to preview) — see
            DRDAuditReportRoute above for the OFF→redirect behavior. */}
        <Route
          path="/audit-programs/drd-report/:reportId"
          element={
            <BetaGate moduleId="MODULE_AUDITS">
              <MainLayout breadcrumbs={breadcrumbs || ['Audits', 'Raport DRD']}>
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <Suspense fallback={<LoadingScreen message="Loading DRD report..." />}>
                      <DRDAuditReportRoute />
                    </Suspense>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </MainLayout>
            </BetaGate>
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

        {/*
          Legacy /wordy (KimiWorkspace report-builder) route -> canonical
          Document Studio. Module 10 route-identity resolution: the fully
          built Document Studio (`/document-studio`, backed by
          `/api/document-studio`) is the canonical Document module. The
          old KimiWorkspace `WordyView` (backed by `/api/report-builder`)
          is deprecated and redirect-only, mirroring the
          `/excele` -> `/tabele` consolidation.
        */}
        <Route
          path={ROUTES.WORDY}
          element={
            <RedirectPreservingQuery
              from={ROUTES.WORDY}
              to={ROUTES.DOCUMENT_STUDIO}
              reason="wordy_merged_into_document_studio"
            />
          }
        />

        {/* Legacy Excele/Tables route -> canonical Table Studio. */}
        {/*
          Excel engine (real .xlsx z formułami — WorkbookGeneratorService).
          Za flagą isExceleEngineEnabled (default OFF): ON → montuje ExceleView
          (realny silnik), OFF → dokładnie dzisiejszy redirect na Table Studio
          (zero regresji na /tabele). Audyt _AUDYT_DOKUMENTY_2026-07-22 — silnik
          formuł był osierocony z UI. Flaga jest bramką (bez BetaGate MODULE_TABELE,
          bo to inny moduł).
        */}
        <Route
          path={ROUTES.EXCELE}
          element={
            isExceleEngineEnabled() ? (
              <ProtectedRoute requireAuth={true}>
                <MainLayout
                  breadcrumbs={
                    breadcrumbs ||
                    buildMaterialsStudioBreadcrumb(
                      t('sidebar.materialy', 'Materials'),
                      t('rap.tabs.sheets', 'Sheets'),
                      'sheets',
                      materialsArtifactIdParam
                        ? t('excele.breadcrumb.open', 'Sheet')
                        : t('excele.breadcrumb.new', 'New sheet')
                    )
                  }
                >
                  <RouteErrorBoundary>
                    <ExceleView />
                  </RouteErrorBoundary>
                </MainLayout>
              </ProtectedRoute>
            ) : (
              <RedirectPreservingQuery
                from={ROUTES.EXCELE}
                to={ROUTES.TABELE}
                reason="excele_merged_into_table_studio"
              />
            )
          }
        />

        {/*
          KIMI Prezentacje — self-serve presentation generator lane.
          The contact-required KimiModuleGate was removed (Module 12 audit gap #1):
          the generator is real and backend-wired, so it must be reachable by every
          authenticated user without ops intervention — mirroring Tabele/Document Studio.
        */}
        <Route
          path={ROUTES.PREZENTACJE_GEN}
          element={
            <ProtectedRoute requireAuth={true}>
              <BetaGate moduleId="MODULE_PREZENTACJE_GEN">
                <MainLayout
                  breadcrumbs={
                    breadcrumbs ||
                    buildMaterialsStudioBreadcrumb(
                      t('sidebar.materialy', 'Materials'),
                      t('rap.tabs.presentations', 'Presentations'),
                      'presentations',
                      materialsArtifactIdParam
                        ? t('prezentacje.breadcrumb.open', 'Presentation')
                        : t('prezentacje.breadcrumb.new', 'New presentation')
                    )
                  }
                >
                  <RouteErrorBoundary>
                    <PrezentacjeView />
                  </RouteErrorBoundary>
                </MainLayout>
              </BetaGate>
            </ProtectedRoute>
          }
        />

        {/* KIMI Tabele Studio — operational tables workspace (D1=visible, sky accent) */}
        <Route
          path={ROUTES.TABELE}
          element={
            <ProtectedRoute requireAuth={true}>
              <BetaGate moduleId="MODULE_TABELE">
                <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.tabele', 'Tables')]}>
                  <RouteErrorBoundary>
                    <TabeleView />
                  </RouteErrorBoundary>
                </MainLayout>
              </BetaGate>
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

        {/* Discovery revive — the canvas-based Discovery Consultant now has a
            real backend (persistence + convert-to-project + SPIN extraction).
            Mounted on a dedicated path so it's reachable for evaluation
            without disturbing the deliberate DISCOVERY_CONSULTANT → InterviewHub
            redirect above. */}
        <Route
          path="/discovery/canvas"
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Discovery']} noPadding>
              <RouteErrorBoundary>
                <DiscoveryConsultantView />
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
                <V8UnavailableBanner moduleName="Interview">
                  <InterviewHub />
                </V8UnavailableBanner>
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
                <V8UnavailableBanner moduleName="Interview">
                  <InterviewHub />
                </V8UnavailableBanner>
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
        {/*
          Module 05: /roadmap and /portfolio are legacy aliases. Preserve route
          state while sending bookmarks to the single /initiatives owner.
        */}
        <Route
          path={ROUTES.ROADMAP}
          element={
            <RedirectPreservingQuery
              from={ROUTES.ROADMAP}
              to={ROUTES.INITIATIVES}
              reason="initiatives_canonical_route"
            />
          }
        />
        <Route
          path={ROUTES.PORTFOLIO}
          element={
            <RedirectPreservingQuery
              from={ROUTES.PORTFOLIO}
              to={ROUTES.INITIATIVES}
              reason="initiatives_canonical_route"
            />
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
            <RedirectPreservingQuery
              from={ROUTES.ECONOMICS}
              to={ROUTES.FINANCE}
              reason="finance_canonical_route"
            />
          }
        />
        <Route
          path={ROUTES.FINANCE}
          element={
            <BetaGate moduleId="MODULE_ECONOMICS">
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
            </BetaGate>
          }
        />
        <Route
          path="/finance/statements/:id"
          element={
            <BetaGate moduleId="MODULE_ECONOMICS">
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
            </BetaGate>
          }
        />
        <Route
          path="/finance/models/:id"
          element={
            <BetaGate moduleId="MODULE_ECONOMICS">
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
            </BetaGate>
          }
        />
        <Route
          path="/finance/analyses/:id"
          element={
            <BetaGate moduleId="MODULE_ECONOMICS">
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
            </BetaGate>
          }
        />
        <Route
          path={ROUTES.EXECUTION}
          element={
            <MainLayout breadcrumbs={breadcrumbs || ['Execution']}>
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Execution"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <V8UnavailableBanner moduleName="Execution">
                      <Suspense fallback={<LoadingScreen message="Loading..." />}>
                        <ExecutionHub />
                      </Suspense>
                    </V8UnavailableBanner>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        <Route
          path={ROUTES.IMPLEMENTATION}
          element={
            <RedirectPreservingQuery
              from={ROUTES.IMPLEMENTATION}
              to={ROUTES.EXECUTION}
              reason="execution_canonical_route"
            />
          }
        />
        {/* Rollout consolidated into ExecutionHub as a tab (Module 06 Realizacja).
            Legacy FullRolloutView + SplitLayout retired — redirect to the tab. */}
        <Route
          path={ROUTES.ROLLOUT}
          element={
            <RedirectToCanonicalTab
              from={ROUTES.ROLLOUT}
              to={ROUTES.EXECUTION}
              tab="rollout"
              reason="rollout_consolidated_into_execution_hub"
            />
          }
        />
        {/* Reports & Presentations — unified V3 hub (V3-J01) */}
        <Route
          path={ROUTES.REPORTS.ROOT}
          element={
            <RedirectWithTracking
              from={ROUTES.REPORTS.ROOT}
              to={`${ROUTES.PRESENTATIONS}?tab=all`}
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
        {/* Management Reports — PMO reports (Team Meeting / Steering Committee / Portfolio Health / RAID) */}
        <Route
          path={ROUTES.REPORTS.MANAGEMENT}
          element={
            <MainLayout
              breadcrumbs={
                breadcrumbs || [
                  t('sidebar.reports', 'Reports'),
                  t('sidebar.reportsManagement', 'Management Reports'),
                ]
              }
              noPadding
            >
              <ProductionModuleGate
                enabled={!hideNonCoreModulesOnPublicProduction}
                moduleName="Management Reports"
              >
                <RouteErrorBoundary>
                  <AnimationWrapper variant="slideUp">
                    <Suspense fallback={<LoadingScreen message="Loading reports..." />}>
                      <ManagementReportsHub />
                    </Suspense>
                  </AnimationWrapper>
                </RouteErrorBoundary>
              </ProductionModuleGate>
            </MainLayout>
          }
        />
        {/*
          /kpi-okr is a permanent alias for /benefits (Results). It redirects
          directly rather than mounting a view, so the router manifest no longer
          carries a dead view module. See Module 07 audit (route cleanup).
        */}
        <Route
          path={ROUTES.KPI_OKR}
          element={
            <RedirectPreservingQuery
              from={ROUTES.KPI_OKR}
              to={ROUTES.RESULTS}
              reason="results_canonical_route"
            />
          }
        />
        <Route
          path={ROUTES.PRESENTATIONS}
          element={
            <BetaGate moduleId="MODULE_PRESENTATIONS">
              <MainLayout
                breadcrumbs={breadcrumbs || [t('sidebar.materialy', 'Materials')]}
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
            </BetaGate>
          }
        />
        <Route path={ROUTES.PRESENTATION_STUDIO} element={<PresentationStudioRedirect />} />
        <Route
          path={ROUTES.MEETING}
          element={
            <BetaGate moduleId="MODULE_MEETING">
              <MainLayout breadcrumbs={breadcrumbs || [t('sidebar.meeting', 'Meeting')]} noPadding>
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Meeting"
                >
                  <RouteErrorBoundary>
                    <MeetingHub />
                  </RouteErrorBoundary>
                </ProductionModuleGate>
              </MainLayout>
            </BetaGate>
          }
        />
        <Route path="/presentations/wizard" element={<PresentationWizardRedirect />} />
        <Route
          path="/presentations/builder/:deckId"
          element={
            <BetaGate moduleId="MODULE_PRESENTATIONS">
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
            </BetaGate>
          }
        />
        {/*
          Canonical Document module (Module 10). Reachable for every
          authenticated user — the public-production hide gate is lifted
          because Document Studio is now the canonical Document surface
          (with its own sidebar entry), not a hidden Outputs sub-tool.
        */}
        <Route
          path="/document-studio"
          element={
            <ProtectedRoute requireAuth={true}>
              <BetaGate moduleId="MODULE_DOCUMENT_STUDIO">
                <MainLayout
                  breadcrumbs={
                    breadcrumbs ||
                    buildMaterialsStudioBreadcrumb(
                      t('sidebar.materialy', 'Materials'),
                      t('rap.tabs.documents', 'Documents'),
                      'documents',
                      materialsArtifactIdParam
                        ? t('documentStudio.breadcrumb.open', 'Document')
                        : t('documentStudio.breadcrumb.new', 'New document')
                    )
                  }
                  noPadding
                >
                  <RouteErrorBoundary>
                    <DocumentStudioView />
                  </RouteErrorBoundary>
                </MainLayout>
              </BetaGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/document-studio/:artifactId"
          element={
            <ProtectedRoute requireAuth={true}>
              <BetaGate moduleId="MODULE_DOCUMENT_STUDIO">
                <MainLayout
                  breadcrumbs={
                    breadcrumbs ||
                    buildMaterialsStudioBreadcrumb(
                      t('sidebar.materialy', 'Materials'),
                      t('rap.tabs.documents', 'Documents'),
                      'documents',
                      t('documentStudio.breadcrumb.open', 'Document')
                    )
                  }
                  noPadding
                >
                  <RouteErrorBoundary>
                    <DocumentStudioView />
                  </RouteErrorBoundary>
                </MainLayout>
              </BetaGate>
            </ProtectedRoute>
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
        {/* MAT-006 (2026-08-02) — public, unauthenticated workbook share
            viewer, same shape as /presentations/shared/:shareToken above. */}
        <Route
          path="/excele/shared/:shareToken"
          element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingScreen message="Ładowanie skoroszytu..." />}>
                <SharedWorkbookView />
              </Suspense>
            </RouteErrorBoundary>
          }
        />
        <Route
          path={ROUTES.BENEFITS}
          element={
            <RedirectPreservingQuery
              from={ROUTES.BENEFITS}
              to={ROUTES.RESULTS}
              reason="results_canonical_route"
            />
          }
        />
        <Route
          path={ROUTES.RESULTS}
          element={
            <BetaGate moduleId="MODULE_BENEFITS">
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
            </BetaGate>
          }
        />
        {/* RN-G2 (2026-08-10) — Results Next registries: KPI / ROI / OKR.
            EXACT-path routes new alongside the legacy `/results` route above
            (React Router matches exact paths first, so no collision). Same
            entitlement chain the legacy hub uses (BetaGate MODULE_BENEFITS +
            ProductionModuleGate "Results") — reused, not reinvented, per
            RN_G2_UI_SCOPE.md §E. Each page is internally gated OFF by its own
            resultsVNextFeatureFlags.ts flag until its domain vertical ships
            (P1/P2/P3) — see ResultsVNextRegistryRouteBase.tsx. */}
        <Route
          path={ROUTES.RESULTS_KPI.ROOT}
          element={
            <BetaGate moduleId="MODULE_BENEFITS">
              <MainLayout
                breadcrumbs={
                  breadcrumbs || [t('sidebar.results', 'Results'), t('results.kpi', 'KPI')]
                }
                noPadding
              >
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Results"
                >
                  <RouteErrorBoundary>
                    <ResultsKpiRegistryPage />
                  </RouteErrorBoundary>
                </ProductionModuleGate>
              </MainLayout>
            </BetaGate>
          }
        />
        {/* RN-G2 P1 #8 (2026-08-10) — KPI Scorecards detail. Same entitlement
            chain as ROUTES.RESULTS_KPI.ROOT above (reused, not reinvented);
            internally gated by the SAME `kpiRegistry` flag (one flag per
            domain, not per screen — resultsVNextFeatureFlags.ts's own
            documented convention). */}
        <Route
          path={ROUTES.RESULTS_KPI.SCORECARD}
          element={
            <BetaGate moduleId="MODULE_BENEFITS">
              <MainLayout
                breadcrumbs={
                  breadcrumbs || [
                    t('sidebar.results', 'Results'),
                    t('results.kpi', 'KPI'),
                    t('results.kpiScorecard', 'Scorecard'),
                  ]
                }
                noPadding
              >
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Results"
                >
                  <RouteErrorBoundary>
                    <ResultsKpiScorecardDetailPage />
                  </RouteErrorBoundary>
                </ProductionModuleGate>
              </MainLayout>
            </BetaGate>
          }
        />
        <Route
          path={ROUTES.RESULTS_ROI.ROOT}
          element={
            <BetaGate moduleId="MODULE_BENEFITS">
              <MainLayout
                breadcrumbs={
                  breadcrumbs || [t('sidebar.results', 'Results'), t('results.roi', 'ROI')]
                }
                noPadding
              >
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Results"
                >
                  <RouteErrorBoundary>
                    <ResultsRoiRegistryPage />
                  </RouteErrorBoundary>
                </ProductionModuleGate>
              </MainLayout>
            </BetaGate>
          }
        />
        <Route
          path={ROUTES.RESULTS_OKR.ROOT}
          element={
            <BetaGate moduleId="MODULE_BENEFITS">
              <MainLayout
                breadcrumbs={
                  breadcrumbs || [t('sidebar.results', 'Results'), t('results.okr', 'OKR')]
                }
                noPadding
              >
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Results"
                >
                  <RouteErrorBoundary>
                    <ResultsOkrRegistryPage />
                  </RouteErrorBoundary>
                </ProductionModuleGate>
              </MainLayout>
            </BetaGate>
          }
        />
        {/* Conclusions layer — governed conclusions (verdict/rationale/evidence) +
            per-conclusion readout. Infra live since OXFORD #41; this is the user
            surface. Beta-gated via MODULE_CONCLUSIONS (open for admins). */}
        <Route
          path={ROUTES.CONCLUSIONS}
          element={
            <BetaGate moduleId="MODULE_CONCLUSIONS">
              <MainLayout
                breadcrumbs={breadcrumbs || [t('sidebar.conclusions', 'Conclusions')]}
                noPadding
              >
                <ProductionModuleGate
                  enabled={!hideNonCoreModulesOnPublicProduction}
                  moduleName="Conclusions"
                >
                  <RouteErrorBoundary>
                    <ConclusionsHub />
                  </RouteErrorBoundary>
                </ProductionModuleGate>
              </MainLayout>
            </BetaGate>
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

        {/* Partner Portal - New DBR77 Consultify Partner Portal
         *
         * SECURITY (defense-in-depth): This route is intentionally gated only by
         * requireAuth, NOT by a partner-role/connection check. Un-connected authed
         * users only ever see the "connect" screen here — no partner data leaks at
         * the route level — so testers/internal users can reach and inspect the
         * portal shell. Access to actual partner DATA is enforced SERVER-SIDE via
         * partner-scoping on every partner API, and self-connect is flag-gated by
         * the backend. Do NOT add a client-side role block that hides the view. */}
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
