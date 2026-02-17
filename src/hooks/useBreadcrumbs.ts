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
 * - Discovery Tools
 * - Assessment
 * - Initiatives
 * - Execution
 * - Benefits
 * - Economics
 * - Reports
 */
export const useBreadcrumbs = () => {
  const { t } = useTranslation();
  const { currentView } = useAppStore();
  const location = useLocation();

  // Default values
  let section = t('sidebar.dashboard', 'Dashboard');
  let sub = '';

  const viewParts = currentView.split('_');

  // =====================================================
  // AI CHAT
  // =====================================================
  if (currentView === AppView.AI_CHAT) {
    section = 'AI';
    sub = t('sidebar.aiChat', 'Chat');
  }
  // =====================================================
  // INTERVIEW / DISCOVERY CONSULTANT
  // =====================================================
  else if (
    currentView === AppView.DISCOVERY_CONSULTANT ||
    currentView === AppView.PROJECT_INTELLIGENCE
  ) {
    section = t('sidebar.dashboard', 'Dashboard');
    sub = t('sidebar.interview', 'Interview');
  }
  // =====================================================
  // DISCOVERY TOOLS
  // =====================================================
  else if (currentView === AppView.DISCOVERY_TOOLS) {
    section = t('sidebar.dashboard', 'Dashboard');
    sub = t('sidebar.discoveryTools', 'Tools');
  }
  // =====================================================
  // MY WORK
  // =====================================================
  else if (currentView === AppView.MY_WORK) {
    section = t('sidebar.dashboard', 'Dashboard');
    sub = t('myWork.title', 'My Work');
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
    section = t('myWork.title', 'My Work');
    sub = '';
  }
  // =====================================================
  // ASSESSMENT MODULE
  // =====================================================
  else if (currentView === AppView.ASSESSMENT_DRD) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('assessment.drd', 'DRD');
  } else if (currentView === AppView.ASSESSMENT_SIRI) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('assessment.siri', 'SIRI');
  } else if (currentView === AppView.ASSESSMENT_ADMA) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('assessment.adma', 'ADMA');
  } else if (currentView === AppView.ASSESSMENT_CMMI) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('assessment.cmmi', 'CMMI');
  } else if (
    currentView === AppView.ASSESSMENT_LEAN ||
    currentView === AppView.ASSESSMENT_LEAN_EXTERNAL
  ) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('assessment.lean', 'Lean 4.0');
  } else if (
    currentView === AppView.ASSESSMENT_SUMMARY ||
    currentView === AppView.ASSESSMENT_OVERVIEW
  ) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('assessment.overview', 'Overview');
  } else if (currentView === AppView.ASSESSMENT_AUDITS) {
    section = t('sidebar.assessment', 'Assessment');
    sub = t('sidebar.myAssessments', 'My Assessments');
  }
  // =====================================================
  // CONTEXT BUILDER (Organization)
  // =====================================================
  else if (currentView.startsWith('CONTEXT_BUILDER')) {
    section = t('sidebar.organization', 'Organization');
    if (currentView === AppView.CONTEXT_BUILDER_PROFILE) {
      sub = t('settings.sidebar.profile', 'Profile');
    } else if (currentView === AppView.CONTEXT_BUILDER_GOALS) {
      sub = t('common.goals', 'Goals');
    } else if (currentView === AppView.CONTEXT_BUILDER_CHALLENGES) {
      sub = t('common.challenges', 'Challenges');
    } else if (currentView === AppView.CONTEXT_BUILDER_MEGATRENDS) {
      sub = t('common.megatrends', 'Megatrends');
    } else if (currentView === AppView.CONTEXT_BUILDER_STRATEGY) {
      sub = t('common.strategy', 'Strategy');
    } else {
      sub = t('settings.sidebar.profile', 'Profile');
    }
  }
  // =====================================================
  // INITIATIVES MODULE
  // =====================================================
  else if (
    currentView === AppView.FULL_STEP2_INITIATIVES ||
    currentView === AppView.PORTFOLIO_ROADMAP ||
    currentView === AppView.FULL_STEP3_ROADMAP
  ) {
    section = t('sidebar.initiatives', 'Initiatives');
    if (currentView === AppView.PORTFOLIO_ROADMAP || currentView === AppView.FULL_STEP3_ROADMAP) {
      sub = t('initiatives.roadmap', 'Roadmap');
    } else {
      sub = '';
    }
  }
  // =====================================================
  // EXECUTION MODULE
  // =====================================================
  else if (
    currentView === AppView.FULL_STEP5_EXECUTION ||
    currentView === AppView.IMPLEMENTATION ||
    currentView === AppView.FULL_ROLLOUT
  ) {
    section = t('sidebar.execution', 'Execution');
    if (currentView === AppView.IMPLEMENTATION) {
      sub = t('execution.dashboard', 'Dashboard');
    } else if (currentView === AppView.FULL_ROLLOUT) {
      sub = t('common.rollout', 'Rollout');
    } else {
      sub = '';
    }
  }
  // =====================================================
  // BENEFITS MODULE
  // =====================================================
  else if (currentView === AppView.BENEFITS_REALIZATION) {
    section = t('sidebar.benefits', 'Benefits');
    sub = '';
  }
  // =====================================================
  // ECONOMICS MODULE
  // =====================================================
  else if (currentView === AppView.ECONOMICS || currentView === AppView.FULL_STEP4_ROI) {
    section = t('sidebar.economics', 'Economics');
    if (currentView === AppView.FULL_STEP4_ROI) {
      sub = 'ROI';
    } else {
      sub = '';
    }
  }
  // =====================================================
  // REPORTS MODULE
  // =====================================================
  else if (currentView === AppView.FULL_STEP6_REPORTS) {
    section = t('sidebar.reports', 'Reports');
    sub = '';
  }
  // =====================================================
  // KPI & OKR
  // =====================================================
  else if (currentView === AppView.KPI_OKR_DASHBOARD) {
    section = t('benefits.title', 'Benefits');
    sub = t('benefits.kpis', 'KPI');
  }
  // =====================================================
  // STUDIO
  // =====================================================
  else if (currentView === AppView.STUDIO) {
    section = t('sidebar.tools', 'Tools');
    sub = 'Studio';
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
    section = t('sidebar.partnerPortal', 'Partner Portal');
    sub = '';
  }
  // =====================================================
  // CONSULTANT VIEWS
  // =====================================================
  else if (currentView === AppView.CONSULTANT_PANEL) {
    section = t('common.consultant', 'Consultant');
    sub = t('sidebar.dashboard', 'Dashboard');
  } else if (currentView === AppView.CONSULTANT_INVITES) {
    section = t('common.consultant', 'Consultant');
    sub = t('common.invites', 'Invites');
  }
  // =====================================================
  // AFFILIATE DASHBOARD
  // =====================================================
  else if (currentView === AppView.AFFILIATE_DASHBOARD) {
    section = t('sidebar.dashboard', 'Dashboard');
    sub = t('common.affiliate', 'Affiliate');
  }

  return [section, sub];
};
