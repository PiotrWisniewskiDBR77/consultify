/**
 * View to Module Mapping
 *
 * Maps all AppView values to their corresponding help module.
 * Used by the HelpContext to determine which documentation to show.
 */

import { AppView } from '../types';

// Module identifiers for the help system
export type HelpModuleId =
  | 'dashboard'
  | 'assessment'
  | 'initiatives'
  | 'roadmap'
  | 'implementation'
  | 'reports'
  | 'mywork'
  | 'organization'
  | 'settings'
  | 'admin'
  | 'superadmin'
  | 'ai-tools'
  | 'knowledge'
  | 'onboarding'
  | 'consultant'
  | 'ecosystem'
  | 'playbook-templates'
  | 'email-templates';

// Card ID mapping for contextual help within modules
export interface ViewHelpMapping {
  moduleId: HelpModuleId;
  cardId?: string; // Links to cardDocumentation.ts
  subSection?: string; // For more granular help within a card
}

/**
 * Maps each AppView to its help module and optional card ID
 */
export const VIEW_TO_MODULE_MAP: Record<string, ViewHelpMapping> = {
  // ==========================================
  // MYWORK MODULE (unified Dashboard + My Work)
  // ==========================================
  [AppView.WELCOME]: { moduleId: 'onboarding' },
  [AppView.AUTH]: { moduleId: 'onboarding' },
  [AppView.MY_WORK]: { moduleId: 'mywork', cardId: 'mywork-tasks' },
  [AppView.DASHBOARD]: { moduleId: 'mywork', cardId: 'mywork-tasks' },
  [AppView.USER_DASHBOARD]: { moduleId: 'mywork', cardId: 'mywork-tasks' },
  [AppView.DASHBOARD_OVERVIEW]: { moduleId: 'mywork', cardId: 'mywork-tasks' },
  [AppView.DASHBOARD_SNAPSHOT]: { moduleId: 'mywork', cardId: 'mywork-tasks' },

  // ==========================================
  // ONBOARDING MODULE
  // ==========================================
  [AppView.QUICK_STEP1_PROFILE]: { moduleId: 'onboarding', cardId: 'onboarding-profile' },
  [AppView.QUICK_STEP2_USER_CONTEXT]: { moduleId: 'onboarding', cardId: 'onboarding-context' },
  [AppView.QUICK_STEP3_EXPECTATIONS]: { moduleId: 'onboarding', cardId: 'onboarding-expectations' },
  [AppView.TRIAL_ENTRY]: { moduleId: 'onboarding', cardId: 'onboarding-trial' },
  [AppView.ONBOARDING_WIZARD]: { moduleId: 'onboarding', cardId: 'onboarding-wizard' },
  [AppView.ORG_SETUP_WIZARD]: { moduleId: 'onboarding', cardId: 'onboarding-org-setup' },

  // ==========================================
  // ASSESSMENT MODULE
  // ==========================================
  [AppView.FULL_STEP1_CONTEXT]: { moduleId: 'assessment', cardId: 'assessment-context' },
  [AppView.FULL_STEP1_ASSESSMENT]: { moduleId: 'assessment', cardId: 'assessment-overview' },
  [AppView.ASSESSMENT_OVERVIEW]: { moduleId: 'assessment', cardId: 'assessment-overview' },
  [AppView.ASSESSMENT_DRD]: { moduleId: 'assessment', cardId: 'assessment-drd' },
  [AppView.ASSESSMENT_SIRI]: { moduleId: 'assessment', cardId: 'assessment-siri' },
  [AppView.ASSESSMENT_ADMA]: { moduleId: 'assessment', cardId: 'assessment-adma' },
  [AppView.ASSESSMENT_CMMI]: { moduleId: 'assessment', cardId: 'assessment-cmmi' },
  [AppView.ASSESSMENT_LEAN]: { moduleId: 'assessment', cardId: 'assessment-lean' },
  [AppView.ASSESSMENT_DIGITAL_EXTERNAL]: { moduleId: 'assessment', cardId: 'assessment-digital' },
  [AppView.ASSESSMENT_LEAN_EXTERNAL]: { moduleId: 'assessment', cardId: 'assessment-lean' },
  [AppView.ASSESSMENT_OTHER]: { moduleId: 'assessment', cardId: 'assessment-other' },
  [AppView.ASSESSMENT_SUMMARY]: { moduleId: 'assessment', cardId: 'assessment-summary' },
  [AppView.ASSESSMENT_AUDITS]: { moduleId: 'assessment', cardId: 'assessment-audits' },
  [AppView.MY_ASSESSMENTS]: { moduleId: 'assessment', cardId: 'my-assessments' },
  [AppView.REVIEWER_DASHBOARD]: { moduleId: 'assessment', cardId: 'reviewer-dashboard' },
  [AppView.ASSESSMENT_DASHBOARD]: { moduleId: 'assessment', cardId: 'assessment-dashboard' },
  [AppView.GAP_MAP]: { moduleId: 'assessment', cardId: 'gap-map' },
  [AppView.ASSESSMENT_REPORTS]: { moduleId: 'assessment', cardId: 'assessment-reports' },

  // DRD Axis Views
  [AppView.FULL_STEP1_PROCESSES]: {
    moduleId: 'assessment',
    cardId: 'assessment-drd',
    subSection: 'processes',
  },
  [AppView.FULL_STEP1_DIGITAL]: {
    moduleId: 'assessment',
    cardId: 'assessment-drd',
    subSection: 'digital',
  },
  [AppView.FULL_STEP1_MODELS]: {
    moduleId: 'assessment',
    cardId: 'assessment-drd',
    subSection: 'models',
  },
  [AppView.FULL_STEP1_DATA]: {
    moduleId: 'assessment',
    cardId: 'assessment-drd',
    subSection: 'data',
  },
  [AppView.FULL_STEP1_CULTURE]: {
    moduleId: 'assessment',
    cardId: 'assessment-drd',
    subSection: 'culture',
  },
  [AppView.FULL_STEP1_CYBERSECURITY]: {
    moduleId: 'assessment',
    cardId: 'assessment-drd',
    subSection: 'cybersecurity',
  },
  [AppView.FULL_STEP1_AI]: { moduleId: 'assessment', cardId: 'assessment-drd', subSection: 'ai' },

  // ==========================================
  // INITIATIVES MODULE
  // ==========================================
  [AppView.FULL_STEP2_INITIATIVES]: { moduleId: 'initiatives', cardId: 'initiatives-list' },
  [AppView.INITIATIVE_GENERATOR]: { moduleId: 'initiatives', cardId: 'initiative-generator' },

  // ==========================================
  // PORTFOLIO & ROADMAP MODULE (unified)
  // ==========================================
  [AppView.PORTFOLIO_ROADMAP]: { moduleId: 'roadmap', cardId: 'portfolio-roadmap' },
  [AppView.FULL_STEP3_ROADMAP]: { moduleId: 'roadmap', cardId: 'roadmap-view' }, // @deprecated - use PORTFOLIO_ROADMAP
  [AppView.INITIATIVE_MANAGEMENT]: { moduleId: 'initiatives', cardId: 'initiative-management' }, // @deprecated - use PORTFOLIO_ROADMAP

  // ==========================================
  // IMPLEMENTATION MODULE
  // ==========================================
  [AppView.FULL_STEP5_EXECUTION]: {
    moduleId: 'implementation',
    cardId: 'implementation-execution',
  },
  [AppView.IMPLEMENTATION]: { moduleId: 'implementation', cardId: 'implementation-center' },
  [AppView.FULL_ROLLOUT]: { moduleId: 'implementation', cardId: 'implementation-rollout' },

  // ==========================================
  // REPORTS MODULE
  // ==========================================
  [AppView.FULL_STEP4_ROI]: { moduleId: 'reports', cardId: 'reports-roi' },
  [AppView.FULL_STEP6_REPORTS]: { moduleId: 'reports', cardId: 'reports-overview' },
  [AppView.DRD_AUDIT_REPORT]: { moduleId: 'reports', cardId: 'reports-drd-audit' },
  [AppView.KPI_OKR_DASHBOARD]: { moduleId: 'reports', cardId: 'reports-kpi-okr' },
  [AppView.EXECUTIVE_VIEW]: { moduleId: 'reports', cardId: 'reports-executive' },

  // ==========================================
  // ORGANIZATION MODULE (Context Builder)
  // ==========================================
  [AppView.CONTEXT_BUILDER]: { moduleId: 'organization', cardId: 'org-context' },
  [AppView.CONTEXT_BUILDER_PROFILE]: { moduleId: 'organization', cardId: 'org-profile' },
  [AppView.CONTEXT_BUILDER_GOALS]: { moduleId: 'organization', cardId: 'org-goals' },
  [AppView.CONTEXT_BUILDER_CHALLENGES]: { moduleId: 'organization', cardId: 'org-challenges' },
  [AppView.CONTEXT_BUILDER_MEGATRENDS]: { moduleId: 'organization', cardId: 'org-megatrends' },
  [AppView.CONTEXT_BUILDER_STRATEGY]: { moduleId: 'organization', cardId: 'org-strategy' },

  // ==========================================
  // AI TOOLS MODULE
  // ==========================================
  [AppView.AI_ACTION_PROPOSALS]: { moduleId: 'ai-tools', cardId: 'ai-advisor' },
  [AppView.FREE_ASSESSMENT_CHAT]: { moduleId: 'ai-tools', cardId: 'ai-chat' },
  [AppView.FULL_TRANSFORMATION_CHAT]: { moduleId: 'ai-tools', cardId: 'ai-chat' },

  // ==========================================
  // KNOWLEDGE MODULE
  // ==========================================
  [AppView.MASTERCLASS]: { moduleId: 'knowledge', cardId: 'knowledge-masterclass' },
  [AppView.RESOURCES]: { moduleId: 'knowledge', cardId: 'knowledge-resources' },

  // ==========================================
  // ECOSYSTEM MODULE
  // ==========================================
  [AppView.AFFILIATE_DASHBOARD]: { moduleId: 'ecosystem', cardId: 'affiliate-dashboard' },

  // ==========================================
  // USER SETTINGS MODULE
  // ==========================================
  [AppView.SETTINGS_PROFILE]: { moduleId: 'settings', cardId: 'settings-profile' },
  [AppView.SETTINGS_BILLING]: { moduleId: 'settings', cardId: 'settings-billing' },
  [AppView.SETTINGS_AI]: { moduleId: 'settings', cardId: 'settings-ai' },
  [AppView.SETTINGS_NOTIFICATIONS]: { moduleId: 'settings', cardId: 'settings-notifications' },
  [AppView.SETTINGS_INTEGRATIONS]: { moduleId: 'settings', cardId: 'settings-integrations' },
  [AppView.SETTINGS_REGIONALIZATION]: { moduleId: 'settings', cardId: 'settings-regional' },
  [AppView.SETTINGS_ORGANIZATION]: { moduleId: 'settings', cardId: 'settings-organization' },
  [AppView.SETTINGS_SECURITY]: { moduleId: 'settings', cardId: 'settings-security' },
  [AppView.SETTINGS_API_ACCESS]: { moduleId: 'settings', cardId: 'settings-api' },
  [AppView.SETTINGS_PRIVACY]: { moduleId: 'settings', cardId: 'settings-privacy' },
  [AppView.SETTINGS_SSO]: { moduleId: 'settings', cardId: 'settings-sso' },
  [AppView.SETTINGS_LEGAL]: { moduleId: 'settings', cardId: 'settings-legal' },
  [AppView.SETTINGS_WORK_PREFERENCES]: { moduleId: 'settings', cardId: 'settings-work' },
  [AppView.SETTINGS_DASHBOARD_PREFERENCES]: { moduleId: 'settings', cardId: 'settings-dashboard' },
  [AppView.SETTINGS_ACCESSIBILITY]: { moduleId: 'settings', cardId: 'settings-accessibility' },
  // New Settings Module Views (6-module structure)
  [AppView.SETTINGS_PROFILE_MODULE]: { moduleId: 'settings', cardId: 'settings-profile-module' },
  [AppView.SETTINGS_AI_MODULE]: { moduleId: 'settings', cardId: 'settings-ai-module' },
  [AppView.SETTINGS_NOTIFICATIONS_MODULE]: {
    moduleId: 'settings',
    cardId: 'settings-notifications-module',
  },
  [AppView.SETTINGS_SECURITY_MODULE]: { moduleId: 'settings', cardId: 'settings-security-module' },
  [AppView.SETTINGS_INTEGRATIONS_MODULE]: {
    moduleId: 'settings',
    cardId: 'settings-integrations-module',
  },
  [AppView.SETTINGS_APPEARANCE_MODULE]: {
    moduleId: 'settings',
    cardId: 'settings-appearance-module',
  },

  // ==========================================
  // ADMIN MODULE
  // ==========================================
  [AppView.ADMIN_DASHBOARD]: { moduleId: 'admin', cardId: 'admin-dashboard' },
  [AppView.ADMIN_USERS]: { moduleId: 'admin', cardId: 'admin-users' },
  [AppView.ADMIN_PROJECTS]: { moduleId: 'admin', cardId: 'admin-projects' },
  [AppView.ADMIN_LLM]: { moduleId: 'admin', cardId: 'admin-llm' },
  [AppView.ADMIN_AI_HEALTH]: { moduleId: 'admin', cardId: 'admin-ai-health' },
  [AppView.ADMIN_KNOWLEDGE]: { moduleId: 'admin', cardId: 'admin-knowledge' },
  [AppView.ADMIN_TEAMS]: { moduleId: 'admin', cardId: 'admin-teams' },
  [AppView.ADMIN_ANALYTICS]: { moduleId: 'admin', cardId: 'admin-analytics' },
  [AppView.ADMIN_FEEDBACK]: { moduleId: 'admin', cardId: 'admin-feedback' },
  [AppView.ADMIN_BILLING]: { moduleId: 'admin', cardId: 'admin-billing' },
  [AppView.ADMIN_METRICS]: { moduleId: 'admin', cardId: 'admin-metrics' },
  [AppView.ADMIN_PLAYBOOK_RUNS]: { moduleId: 'admin', cardId: 'admin-playbooks' },
  [AppView.ADMIN_SETTINGS_CONSULTANTS]: { moduleId: 'admin', cardId: 'admin-consultants' },
  [AppView.ADMIN_SECURITY]: { moduleId: 'admin', cardId: 'admin-security' },
  [AppView.ADMIN_API_KEYS]: { moduleId: 'admin', cardId: 'admin-api-keys' },
  [AppView.ADMIN_BILLING_MANAGEMENT]: { moduleId: 'admin', cardId: 'admin-billing-mgmt' },
  [AppView.ADMIN_BULK_OPERATIONS]: { moduleId: 'admin', cardId: 'admin-bulk-ops' },
  // New Admin Module Views (5-module structure)
  [AppView.ADMIN_OVERVIEW]: { moduleId: 'admin', cardId: 'admin-overview-module' },
  [AppView.ADMIN_TEAM]: { moduleId: 'admin', cardId: 'admin-team-module' },
  [AppView.ADMIN_WORKSPACE]: { moduleId: 'admin', cardId: 'admin-workspace-module' },
  [AppView.ADMIN_AI]: { moduleId: 'admin', cardId: 'admin-ai-module' },
  [AppView.ADMIN_SETTINGS]: { moduleId: 'admin', cardId: 'admin-settings-module' },

  // ==========================================
  // SUPERADMIN MODULE
  // ==========================================
  [AppView.SUPERADMIN_DASHBOARD]: { moduleId: 'superadmin', cardId: 'superadmin-dashboard' },
  [AppView.SUPERADMIN_ORGANIZATIONS]: {
    moduleId: 'superadmin',
    cardId: 'superadmin-organizations',
  },
  [AppView.SUPERADMIN_USERS]: { moduleId: 'superadmin', cardId: 'superadmin-users' },
  [AppView.SUPERADMIN_BILLING]: { moduleId: 'superadmin', cardId: 'superadmin-billing' },
  [AppView.SUPERADMIN_AI_CONFIG]: { moduleId: 'superadmin', cardId: 'superadmin-ai-config' },
  [AppView.SUPERADMIN_KNOWLEDGE]: { moduleId: 'superadmin', cardId: 'superadmin-knowledge' },
  [AppView.SUPERADMIN_SETTINGS]: { moduleId: 'superadmin', cardId: 'superadmin-settings' },
  [AppView.SUPERADMIN_SSO]: { moduleId: 'superadmin', cardId: 'superadmin-sso' },
  [AppView.SUPERADMIN_SECURITY_POLICIES]: { moduleId: 'superadmin', cardId: 'superadmin-security' },
  [AppView.SUPERADMIN_API_MANAGEMENT]: { moduleId: 'superadmin', cardId: 'superadmin-api' },
  [AppView.SUPERADMIN_WHITELABEL]: { moduleId: 'superadmin', cardId: 'superadmin-whitelabel' },
  [AppView.SUPERADMIN_COMPLIANCE]: { moduleId: 'superadmin', cardId: 'superadmin-compliance' },
  [AppView.SUPERADMIN_INVOICES]: { moduleId: 'superadmin', cardId: 'superadmin-invoices' },
  [AppView.SUPERADMIN_BULK_OPERATIONS]: { moduleId: 'superadmin', cardId: 'superadmin-bulk-ops' },
  [AppView.SUPERADMIN_FEEDBACK]: { moduleId: 'superadmin', cardId: 'superadmin-feedback' },
  [AppView.SUPERADMIN_PLAYBOOK_TEMPLATES]: {
    moduleId: 'playbook-templates',
    cardId: 'superadmin-playbooks',
  },
  [AppView.SUPERADMIN_PLAYBOOK_EDITOR]: {
    moduleId: 'playbook-templates',
    cardId: 'superadmin-playbook-editor',
  },
};

/**
 * Get help mapping for a given view
 */
export function getHelpMapping(view: AppView | string): ViewHelpMapping {
  return VIEW_TO_MODULE_MAP[view] || { moduleId: 'dashboard' };
}

/**
 * Get module ID for a given view
 */
export function getModuleId(view: AppView | string): HelpModuleId {
  return getHelpMapping(view).moduleId;
}

/**
 * Get card ID for a given view (for contextual help)
 */
export function getCardId(view: AppView | string): string | undefined {
  return getHelpMapping(view).cardId;
}

/**
 * Get all views belonging to a module
 */
export function getViewsForModule(moduleId: HelpModuleId): string[] {
  return Object.entries(VIEW_TO_MODULE_MAP)
    .filter(([_, mapping]) => mapping.moduleId === moduleId)
    .map(([view]) => view);
}
