import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import type { BreadcrumbSegment } from '../layouts/MainLayout';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

// Admin section titles mapping
const ADMIN_SECTION_TITLES: Record<string, string> = {
  overview: 'Overview',
  people: 'People & Access',
  members: 'People & Access',
  security: 'Security & Identity',
  billing: 'Billing & FinOps',
  ai: 'AI Governance & Operations',
  integrations: 'Integrations & Sync',
  audit: 'Audit, Compliance & Risk',
  operations: 'Organization Operations',
};

/**
 * Hook that returns breadcrumbs for the current view.
 * Returns [section, subsection] where section is the main module name
 * and subsection is the specific page within that module.
 *
 * Structure follows the main sidebar navigation:
 * - AI Chat
 * - Interview
 * - Tools (V3: unified hub — Library / Sessions / Outputs / Initiatives)
 * - Assessment
 * - Initiatives
 * - Execution
 * - Benefits
 * - Economics
 * - Reports
 */
export const useBreadcrumbs = (): BreadcrumbSegment[] | null => {
  const { t } = useTranslation();
  const { currentView } = useAppStore();
  const myWorkBreadcrumbs = useAppStore((s) => s.myWorkBreadcrumbs);
  const interviewBreadcrumbs = useAppStore((s) => s.interviewBreadcrumbs);
  const location = useLocation();

  // Important: prefer route-provided breadcrumbs whenever possible.
  // This hook should only override when it can compute something BETTER than the static route fallback
  // (e.g. Admin sub-sections based on `?tab=`).
  if (!currentView) return null;

  let section = '';
  let sub = '';

  const viewParts = String(currentView).split('_');

  // =====================================================
  // AI CHAT
  // =====================================================
  if (currentView === AppView.AI_CHAT || currentView === AppView.APP_INTRO) {
    // Let AppRoutes provide canonical crumbs for Chat routes.
    return null;
  }
  // =====================================================
  // INTERVIEW / DISCOVERY CONSULTANT
  // =====================================================
  else if (
    currentView === AppView.INTERVIEW ||
    currentView === AppView.DISCOVERY_CONSULTANT ||
    currentView === AppView.PROJECT_INTELLIGENCE
  ) {
    if (interviewBreadcrumbs && interviewBreadcrumbs.length > 0) {
      return interviewBreadcrumbs;
    }
    return null;
  }
  // =====================================================
  // DISCOVERY TOOLS
  // =====================================================
  else if (currentView === AppView.DISCOVERY_TOOLS) {
    return null;
  }
  // =====================================================
  // MY WORK
  // =====================================================
  else if (currentView === AppView.MY_WORK) {
    if (myWorkBreadcrumbs && myWorkBreadcrumbs.length > 0) {
      return myWorkBreadcrumbs;
    }
    return null;
  }
  // =====================================================
  // DASHBOARD VIEWS
  // =====================================================
  else if (
    currentView === AppView.USER_DASHBOARD ||
    currentView === AppView.DASHBOARD ||
    currentView === AppView.DASHBOARD_OVERVIEW ||
    currentView === AppView.DASHBOARD_SNAPSHOT
  ) {
    return null;
  }
  // =====================================================
  // ASSESSMENT MODULE
  // =====================================================
  else if (currentView === AppView.ASSESSMENT_DRD) {
    return null;
  } else if (currentView === AppView.ASSESSMENT_SIRI) {
    return null;
  } else if (currentView === AppView.ASSESSMENT_ADMA) {
    return null;
  } else if (currentView === AppView.ASSESSMENT_CMMI) {
    return null;
  } else if (
    currentView === AppView.ASSESSMENT_LEAN ||
    currentView === AppView.ASSESSMENT_LEAN_EXTERNAL
  ) {
    return null;
  } else if (
    currentView === AppView.ASSESSMENT_SUMMARY ||
    currentView === AppView.ASSESSMENT_OVERVIEW
  ) {
    return null;
  } else if (currentView === AppView.ASSESSMENT_AUDITS) {
    return null;
  }
  // =====================================================
  // CONTEXT BUILDER (Organization)
  // =====================================================
  else if (currentView.startsWith('CONTEXT_BUILDER')) {
    return null;
  }
  // =====================================================
  // INITIATIVES MODULE
  // =====================================================
  else if (
    currentView === AppView.FULL_STEP2_INITIATIVES ||
    currentView === AppView.PORTFOLIO_ROADMAP ||
    currentView === AppView.FULL_STEP3_ROADMAP
  ) {
    return null;
  }
  // =====================================================
  // EXECUTION MODULE
  // =====================================================
  else if (
    currentView === AppView.FULL_STEP5_EXECUTION ||
    currentView === AppView.IMPLEMENTATION ||
    currentView === AppView.FULL_ROLLOUT
  ) {
    return null;
  }
  // =====================================================
  // BENEFITS MODULE (Results / KPI)
  // =====================================================
  else if (currentView === AppView.BENEFITS_REALIZATION) {
    section = t('sidebar.results', 'Results');
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const mode = params.get('mode');
    const rmode = params.get('rmode');

    if (tab === 'results_kpi') {
      sub =
        mode === 'overview'
          ? t('results.tabs.kpiOverview', 'KPI Overview')
          : mode === 'queue'
            ? t('results.tabs.kpiQueue', 'KPI Queue')
            : mode === 'scorecards'
              ? t('results.tabs.kpiScorecards', 'Scorecards')
              : t('results.tabs.kpi', 'KPI');
    } else if (tab === 'results_reports') {
      sub =
        rmode === 'reports'
          ? t('results.tabs.kpiReports', 'Reports')
          : rmode === 'schedules'
            ? t('results.tabs.schedules', 'Schedules')
            : rmode === 'wallboards'
              ? t('results.tabs.wallboards', 'Wallboards')
              : rmode === 'connectors'
                ? t('results.tabs.connectors', 'Connectors')
                : t('results.tabs.kpiReports', 'Reports');
    } else if (tab === 'roi') {
      sub = t('results.tabs.roi', 'ROI');
    } else if (tab === 'roi_analysis') {
      sub = t('results.tabs.roiAnalysis', 'ROI Analysis');
    }
  }
  // =====================================================
  // ECONOMICS MODULE
  // =====================================================
  else if (currentView === AppView.ECONOMICS || currentView === AppView.FULL_STEP4_ROI) {
    section = t('sidebar.finance', 'Finance');
    const params = new URLSearchParams(location.search || '');
    const tab = (params.get('tab') || '').toLowerCase();
    const TAB_LABELS: Record<string, string> = {
      statements: t('finance.tabs.statements', 'Statements'),
      models: t('finance.tabs.models', 'Models'),
      analysis: t('finance.tabs.analysis', 'Analysis'),
      prediction: t('finance.tabs.prediction', 'Prediction'),
      valuation: t('finance.tabs.valuation', 'Valuation'),
      investment: t('finance.tabs.investment', 'Investment'),
    };
    const tabLabel = TAB_LABELS[tab] || null;
    if (tabLabel) {
      return [section, tabLabel];
    }
    const deepMatch = location.pathname.match(/^\/finance\/(statements|models|analyses)\/(.+)$/);
    if (deepMatch) {
      const segLabels: Record<string, string> = {
        statements: t('finance.tabs.statements', 'Statements'),
        models: t('finance.tabs.models', 'Models'),
        analyses: t('finance.tabs.analysis', 'Analysis'),
      };
      return [section, segLabels[deepMatch[1]] || deepMatch[1]];
    }
    return [section];
  }
  // =====================================================
  // REPORTS MODULE (V3-A04 / V3-J01)
  // =====================================================
  else if (
    currentView === AppView.FULL_STEP6_REPORTS ||
    currentView === AppView.REPORTS_ENTRY ||
    currentView === AppView.REPORTS_MANAGEMENT
  ) {
    return null;
  }
  // =====================================================
  // PRESENTATIONS MODULE (Outputs Library)
  // =====================================================
  else if (currentView === AppView.PRESENTATIONS) {
    const params = new URLSearchParams(location.search || '');
    const tab = (params.get('tab') || '').toLowerCase();
    const TAB_LABELS: Record<string, string> = {
      all: t('rap.tabs.all', 'All'),
      mine: t('rap.tabs.mine', 'Mine'),
      needs_review: t('rap.tabs.needsReview', 'Needs review'),
      review: t('rap.tabs.needsReview', 'Needs review'),
      documents: t('rap.tabs.documents', 'Documents'),
      reports: t('rap.tabs.documents', 'Documents'),
      presentations: t('rap.tabs.presentations', 'Presentations'),
      sheets: t('rap.tabs.sheets', 'Sheets'),
      templates: t('rap.tabs.templates', 'Templates'),
    };
    const tabLabel = TAB_LABELS[tab] || null;
    if (tabLabel) {
      return [t('sidebar.outputsLibrary', 'Outputs'), tabLabel];
    }
    return null;
  }
  // =====================================================
  // KPI & OKR
  // =====================================================
  else if (currentView === AppView.KPI_OKR_DASHBOARD) {
    return null;
  }
  // =====================================================
  // STUDIO
  // =====================================================
  else if (currentView === AppView.STUDIO) {
    return null;
  }
  // =====================================================
  // ADMIN VIEWS
  // =====================================================
  else if (viewParts.includes('ADMIN') || location.pathname.startsWith('/admin')) {
    section = t('sidebar.adminPanel', 'Admin Panel');

    const pathSection = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (pathSection && ADMIN_SECTION_TITLES[pathSection]) {
      sub = ADMIN_SECTION_TITLES[pathSection];
    } else if (tabParam && ADMIN_SECTION_TITLES[tabParam]) {
      sub = ADMIN_SECTION_TITLES[tabParam];
    } else if (currentView === AppView.ADMIN_USERS) sub = 'People & Access';
    else if (currentView === AppView.ADMIN_PROJECTS) sub = 'Organization Operations';
    else if (currentView === AppView.ADMIN_LLM) sub = 'AI Governance & Operations';
    else if (currentView === AppView.ADMIN_KNOWLEDGE) sub = 'AI Governance & Operations';
    else if (currentView === AppView.ADMIN_FEEDBACK) sub = 'Overview';
    else if (currentView === AppView.ADMIN_BILLING) sub = 'Billing & FinOps';
    else if (currentView === AppView.ADMIN_ANALYTICS) sub = 'Overview';
    else if (currentView === AppView.ADMIN_OVERVIEW) sub = t('assessment.overview', 'Overview');
    else if (currentView === AppView.ADMIN_ORGANIZATION) sub = 'Organization Operations';
    else if (currentView === AppView.ADMIN_TEAM) sub = 'People & Access';
    else if (currentView === AppView.ADMIN_WORKSPACE) sub = 'Integrations & Sync';
    else if (currentView === AppView.ADMIN_AI) sub = 'AI Governance & Operations';
    else if (currentView === AppView.ADMIN_SECURITY) sub = 'Security & Identity';
    else sub = 'Overview';
  }
  // =====================================================
  // SETTINGS VIEWS
  // =====================================================
  else if (viewParts.includes('SETTINGS')) {
    section = t('sidebar.settings', 'Settings');
    if (
      currentView === AppView.SETTINGS_PROFILE ||
      currentView === AppView.SETTINGS_PROFILE_MODULE
    ) {
      sub = t('settings.sidebar.profile', 'Profile');
    } else if (currentView === AppView.SETTINGS_BILLING) {
      sub = t('settings.billing', 'Billing');
    } else if (currentView === AppView.SETTINGS_AI || currentView === AppView.SETTINGS_AI_MODULE) {
      sub = t('settings.ai.title', 'AI');
    } else if (
      currentView === AppView.SETTINGS_NOTIFICATIONS ||
      currentView === AppView.SETTINGS_NOTIFICATIONS_MODULE
    ) {
      sub = t('settings.notifications.label', 'Notifications');
    } else if (
      currentView === AppView.SETTINGS_INTEGRATIONS ||
      currentView === AppView.SETTINGS_INTEGRATIONS_MODULE
    ) {
      sub = t('settings.integrations.title', 'Integrations');
    } else if (
      currentView === AppView.SETTINGS_SECURITY ||
      currentView === AppView.SETTINGS_SECURITY_MODULE
    ) {
      sub = t('settings.security', 'Security');
    } else if (currentView === AppView.SETTINGS_APPEARANCE_MODULE) {
      sub = t('settings.appearance.label', 'Appearance');
    } else if (currentView === AppView.SETTINGS_ORGANIZATION) {
      sub = t('sidebar.organization', 'Organization');
    } else {
      sub = '';
    }
  }
  // =====================================================
  // PARTNER PORTAL
  // =====================================================
  else if (viewParts.includes('PARTNER')) {
    return null;
  }
  // =====================================================
  // CONSULTANT VIEWS
  // =====================================================
  else if (currentView === AppView.CONSULTANT_PANEL) {
    return null;
  } else if (currentView === AppView.CONSULTANT_INVITES) {
    return null;
  }
  // If we couldn't compute a meaningful override, fall back to route-provided crumbs.
  if (!section) return null;
  if (!sub) return [section];
  return [section, sub];
};
