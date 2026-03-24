import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

// Admin section titles mapping
const ADMIN_SECTION_TITLES: Record<string, string> = {
  organization: 'Strategic Profile',
  branding: 'Branding',
  billing: 'Plans',
  payment: 'Payment',
  tax: 'Tax',
  alerts: 'Alerts',
  security: 'Security',
  governance: 'Governance',
  audit: 'Audit',
  'report-creator': 'Report Templates',
  'initiative-templates': 'Initiative Templates',
  'initiative-sections': 'Section Library',
  integrations: 'Integrations',
  api: 'API',
  feedback: 'Feedback',
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
export const useBreadcrumbs = (): string[] | null => {
  const { t } = useTranslation();
  const { currentView } = useAppStore();
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
    currentView === AppView.DISCOVERY_CONSULTANT ||
    currentView === AppView.PROJECT_INTELLIGENCE
  ) {
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
    // Route-level crumb is the source of truth; deep-link sub-crumbs can be layered later.
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
  // BENEFITS MODULE
  // =====================================================
  else if (currentView === AppView.BENEFITS_REALIZATION) {
    return null;
  }
  // =====================================================
  // ECONOMICS MODULE
  // =====================================================
  else if (currentView === AppView.ECONOMICS || currentView === AppView.FULL_STEP4_ROI) {
    return null;
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
  // PRESENTATIONS MODULE
  // =====================================================
  else if (currentView === AppView.PRESENTATIONS) {
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

    // Check URL tab parameter for AdminSettingsModule sections
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ADMIN_SECTION_TITLES[tabParam]) {
      sub = ADMIN_SECTION_TITLES[tabParam];
    } else if (currentView === AppView.ADMIN_USERS) sub = t('common.users', 'Users');
    else if (currentView === AppView.ADMIN_PROJECTS) sub = t('common.projects', 'Projects');
    else if (currentView === AppView.ADMIN_LLM) sub = 'LLM';
    else if (currentView === AppView.ADMIN_KNOWLEDGE) sub = t('sidebar.knowledge', 'Knowledge');
    else if (currentView === AppView.ADMIN_FEEDBACK) sub = t('widgets.feedback.title', 'Feedback');
    else if (currentView === AppView.ADMIN_BILLING) sub = t('settings.billing', 'Billing');
    else if (currentView === AppView.ADMIN_ANALYTICS) sub = t('common.analytics', 'Analytics');
    else if (currentView === AppView.ADMIN_OVERVIEW) sub = t('assessment.overview', 'Overview');
    else if (currentView === AppView.ADMIN_ORGANIZATION)
      sub = t('sidebar.organization', 'Organization');
    else if (currentView === AppView.ADMIN_TEAM) sub = t('common.team', 'Team');
    else if (currentView === AppView.ADMIN_WORKSPACE) sub = t('common.workspace', 'Workspace');
    else if (currentView === AppView.ADMIN_AI) sub = 'AI';
    else if (currentView === AppView.ADMIN_SECURITY) sub = t('settings.security', 'Security');
    else sub = 'Strategic Profile'; // Default to first section
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
      sub = t('settings.ai', 'AI');
    } else if (
      currentView === AppView.SETTINGS_NOTIFICATIONS ||
      currentView === AppView.SETTINGS_NOTIFICATIONS_MODULE
    ) {
      sub = t('settings.notifications', 'Notifications');
    } else if (
      currentView === AppView.SETTINGS_INTEGRATIONS ||
      currentView === AppView.SETTINGS_INTEGRATIONS_MODULE
    ) {
      sub = t('settings.integrations', 'Integrations');
    } else if (
      currentView === AppView.SETTINGS_SECURITY ||
      currentView === AppView.SETTINGS_SECURITY_MODULE
    ) {
      sub = t('settings.security', 'Security');
    } else if (currentView === AppView.SETTINGS_APPEARANCE_MODULE) {
      sub = t('settings.appearance', 'Appearance');
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
  // =====================================================
  // AFFILIATE DASHBOARD
  // =====================================================
  else if (currentView === AppView.AFFILIATE_DASHBOARD) {
    return null;
  }

  // If we couldn't compute a meaningful override, fall back to route-provided crumbs.
  if (!section) return null;
  if (!sub) return [section];
  return [section, sub];
};
