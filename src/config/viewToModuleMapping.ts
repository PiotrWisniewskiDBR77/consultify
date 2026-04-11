import { AppView } from '../types';

export interface ViewHelpMapping {
  moduleId: string;
  cardId?: string;
  documentId?: string;
  stage?: string;
  supportModule?: string;
  nextStep?: string;
  aiPromptKey?: string;
}

export type HelpModuleId = string;

/**
 * Maps product views to the canonical help narrative.
 * `stage` drives the main journey help, while `supportModule`
 * describes standalone/supporting areas that can sit outside the journey.
 */
export function getHelpMapping(viewId: string): ViewHelpMapping {
  const view = viewId.toUpperCase();

  if (view === 'MES')
    return { moduleId: 'mes', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'WMS')
    return { moduleId: 'wms', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'QMS')
    return { moduleId: 'qms', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'CMMS')
    return { moduleId: 'cmms', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'HSE')
    return { moduleId: 'hse', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'ESG')
    return { moduleId: 'esg', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'IOT')
    return { moduleId: 'iot', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'GEMBA')
    return { moduleId: 'gemba', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'KPI') return { moduleId: 'kpi', stage: 'results', aiPromptKey: 'results' };
  if (view === 'DATA_AI')
    return { moduleId: 'data_ai', stage: 'tools_assessments', aiPromptKey: 'tools_assessments' };
  if (view === 'MRP') return { moduleId: 'mrp', stage: 'execution', aiPromptKey: 'execution' };
  if (view === 'APS') return { moduleId: 'aps', stage: 'execution', aiPromptKey: 'execution' };
  if (view === 'DT') return { moduleId: 'dt', stage: 'results', aiPromptKey: 'results' };
  if (view === 'HRM') return { moduleId: 'hrm', stage: 'execution', aiPromptKey: 'execution' };
  if (view === 'LMS') return { moduleId: 'lms', stage: 'execution', aiPromptKey: 'execution' };
  if (view === 'SKILLS')
    return { moduleId: 'skills', stage: 'execution', aiPromptKey: 'execution' };
  if (view === 'BILLING')
    return { moduleId: 'billing', supportModule: 'finance', aiPromptKey: 'finance' };

  switch (view) {
    case AppView.APP_INTRO:
      return {
        moduleId: 'dashboard',
        stage: 'interview',
        nextStep: 'tools_assessments',
        aiPromptKey: 'interview',
      };

    case AppView.AI_CHAT:
      return { moduleId: 'ai_chat', stage: 'interview', aiPromptKey: 'interview' };

    case AppView.DASHBOARD:
    case AppView.USER_DASHBOARD:
    case AppView.DASHBOARD_OVERVIEW:
    case AppView.DASHBOARD_SNAPSHOT:
    case AppView.WELCOME:
      return {
        moduleId: 'dashboard',
        stage: 'interview',
        nextStep: 'tools_assessments',
        aiPromptKey: 'interview',
      };

    case AppView.INTERVIEW:
    case AppView.DISCOVERY_CONSULTANT:
    case AppView.PROJECT_INTELLIGENCE:
    case AppView.FULL_STEP1_CONTEXT:
      return {
        moduleId: 'interview',
        stage: 'interview',
        nextStep: 'tools_assessments',
        aiPromptKey: 'interview',
      };

    case AppView.ASSESSMENT_OVERVIEW:
    case AppView.ASSESSMENT_SUMMARY:
    case AppView.ASSESSMENT_DASHBOARD:
    case AppView.MY_ASSESSMENTS:
    case AppView.ASSESSMENT_AUDITS:
    case AppView.ASSESSMENT_REPORTS:
    case AppView.GAP_MAP:
    case AppView.DISCOVERY_TOOLS:
    case AppView.DISCOVERY_TOOLS_STRATEGIC:
    case AppView.DISCOVERY_TOOLS_OPERATIONAL:
    case AppView.DISCOVERY_TOOLS_DIGITAL:
    case AppView.DISCOVERY_TOOLS_PROCESS_AUTOMATION:
    case AppView.ASSESSMENT_DRD:
    case AppView.ASSESSMENT_SIRI:
    case AppView.ASSESSMENT_ADMA:
    case AppView.ASSESSMENT_CMMI:
    case AppView.ASSESSMENT_LEAN:
    case AppView.FULL_STEP1_ASSESSMENT:
    case AppView.FULL_STEP1_PROCESSES:
    case AppView.FULL_STEP1_DIGITAL:
    case AppView.FULL_STEP1_MODELS:
    case AppView.FULL_STEP1_DATA:
    case AppView.FULL_STEP1_CULTURE:
    case AppView.FULL_STEP1_CYBERSECURITY:
    case AppView.FULL_STEP1_AI:
      return {
        moduleId: 'assessment',
        stage: 'tools_assessments',
        nextStep: 'initiatives',
        aiPromptKey: 'tools_assessments',
      };

    case AppView.INITIATIVE_GENERATOR:
    case AppView.FULL_STEP2_INITIATIVES:
    case AppView.INITIATIVE_MANAGEMENT:
    case AppView.ADMIN_PROJECTS:
    case AppView.ADMIN_PROJECT_DETAILS:
    case AppView.FULL_STEP3_ROADMAP:
    case AppView.PORTFOLIO_ROADMAP:
      return {
        moduleId: 'initiatives',
        stage: 'initiatives',
        nextStep: 'execution',
        aiPromptKey: 'initiatives',
      };

    case AppView.IMPLEMENTATION:
    case AppView.FULL_STEP5_EXECUTION:
    case AppView.FULL_PILOT_EXECUTION:
    case AppView.FULL_ROLLOUT:
      return {
        moduleId: 'execution',
        stage: 'execution',
        nextStep: 'results',
        aiPromptKey: 'execution',
      };

    case AppView.BENEFITS_REALIZATION:
      return { moduleId: 'results', stage: 'results', aiPromptKey: 'results' };

    case AppView.MY_WORK:
      return { moduleId: 'mywork', supportModule: 'my_work', aiPromptKey: 'my_work' };

    case AppView.ECONOMICS:
    case AppView.FULL_STEP4_ROI:
      return {
        moduleId: 'economics',
        supportModule: 'finance',
        stage: 'results',
        aiPromptKey: 'finance',
      };

    case AppView.FULL_STEP6_REPORTS:
    case AppView.DRD_AUDIT_REPORT:
    case AppView.REPORTS_ENTRY:
    case AppView.REPORTS_MANAGEMENT:
    case AppView.PRESENTATIONS:
      return {
        moduleId: 'outputs',
        supportModule: 'presentations',
        stage: 'results',
        aiPromptKey: 'outputs',
      };

    case 'PRESENTATIONS_TEMPLATES' as any:
      return {
        moduleId: 'templates',
        supportModule: 'presentations',
        stage: 'results',
        aiPromptKey: 'templates',
      };

    case AppView.MEETING:
      return { moduleId: 'knowledge', supportModule: 'ideas', aiPromptKey: 'ideas' };

    case AppView.KPI_OKR_DASHBOARD:
      return { moduleId: 'kpi', stage: 'results', aiPromptKey: 'results' };

    case AppView.SETTINGS_PROFILE:
    case AppView.SETTINGS_PROFILE_MODULE:
    case AppView.SETTINGS_BILLING:
    case AppView.SETTINGS_ORGANIZATION:
    case AppView.ADMIN_DASHBOARD:
    case AppView.ADMIN_USERS:
    case AppView.ADMIN_TEAMS:
    case AppView.ADMIN_ORGANIZATION:
    case AppView.SETTINGS_ACCESSIBILITY:
    case AppView.SETTINGS_APPEARANCE:
    case AppView.SETTINGS_APPEARANCE_MODULE:
    case AppView.SETTINGS_NOTIFICATIONS:
    case AppView.SETTINGS_NOTIFICATIONS_MODULE:
    case AppView.SETTINGS_SECURITY:
    case AppView.SETTINGS_SECURITY_MODULE:
    case AppView.SETTINGS_DATA_CONTROLS:
    case AppView.SETTINGS_INTEGRATIONS:
    case AppView.SETTINGS_INTEGRATIONS_MODULE:
      return { moduleId: 'settings', stage: 'interview', aiPromptKey: 'interview' };

    case AppView.ONBOARDING_WIZARD:
    case AppView.ORG_SETUP_WIZARD:
    case AppView.QUICK_STEP1_PROFILE:
    case AppView.QUICK_STEP2_USER_CONTEXT:
    case AppView.QUICK_STEP3_EXPECTATIONS:
      return {
        moduleId: 'onboarding',
        stage: 'interview',
        nextStep: 'tools_assessments',
        aiPromptKey: 'interview',
      };

    case AppView.PARTNER_DASHBOARD:
    case AppView.PARTNER_LANDING:
    case AppView.PARTNER_PROVIDER_HOME:
      return { moduleId: 'partner', stage: 'interview', aiPromptKey: 'interview' };

    case AppView.SUPERADMIN_OVERVIEW:
    case AppView.SUPERADMIN_DASHBOARD:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_overview',
        aiPromptKey: 'superadmin_overview',
      };

    case AppView.SUPERADMIN_CUSTOMERS:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_customers',
        aiPromptKey: 'superadmin_customers',
      };

    case AppView.SUPERADMIN_ORGANIZATIONS:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_organizations',
        aiPromptKey: 'superadmin_organizations',
      };

    case AppView.SUPERADMIN_USERS:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_users',
        aiPromptKey: 'superadmin_users',
      };

    case AppView.SUPERADMIN_FEEDBACK:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_feedback',
        aiPromptKey: 'superadmin_feedback',
      };

    case AppView.SUPERADMIN_COMMUNICATION:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_customers_communication',
        aiPromptKey: 'superadmin_customers_communication',
      };

    case AppView.SUPERADMIN_BULK_OPERATIONS:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_bulk_operations',
        aiPromptKey: 'superadmin_bulk_operations',
      };

    case AppView.SUPERADMIN_AI_PLATFORM:
      return {
        moduleId: 'superadmin_ai_infrastructure',
        documentId: 'superadmin_ai_configuration',
        aiPromptKey: 'superadmin_ai_configuration',
      };

    case AppView.SUPERADMIN_AI_INFRASTRUCTURE:
    case AppView.SUPERADMIN_AI_CONFIG:
    case AppView.SUPERADMIN_LLM_MANAGEMENT:
      return {
        moduleId: 'superadmin_ai_infrastructure',
        documentId: 'superadmin_ai_configuration',
        aiPromptKey: 'superadmin_ai_configuration',
      };

    case AppView.SUPERADMIN_AI_DEVELOPMENT:
    case AppView.SUPERADMIN_AI_INTELLIGENCE:
      return {
        moduleId: 'superadmin_ai_development',
        documentId: 'superadmin_ai_development',
        aiPromptKey: 'superadmin_ai_development',
      };

    case AppView.SUPERADMIN_KNOWLEDGE:
      return {
        moduleId: 'superadmin_ai_development',
        documentId: 'superadmin_ai_knowledge',
        aiPromptKey: 'superadmin_ai_knowledge',
      };

    case AppView.SUPERADMIN_AI_OPERATIONS:
      return {
        moduleId: 'superadmin_ai_operations',
        documentId: 'superadmin_ai_operations',
        aiPromptKey: 'superadmin_ai_operations',
      };

    case AppView.SUPERADMIN_SYSTEM:
    case AppView.SUPERADMIN_SETTINGS:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_system',
        aiPromptKey: 'superadmin_system',
      };

    case AppView.SUPERADMIN_CONTENT:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_content',
        aiPromptKey: 'superadmin_content',
      };

    case AppView.SUPERADMIN_PLAYBOOK_TEMPLATES:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_playbook_templates',
        aiPromptKey: 'superadmin_playbook_templates',
      };

    case AppView.SUPERADMIN_PLAYBOOK_EDITOR:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_playbook_editor',
        aiPromptKey: 'superadmin_playbook_editor',
      };

    case AppView.SUPERADMIN_REVENUE:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_revenue',
        aiPromptKey: 'superadmin_revenue',
      };

    case AppView.SUPERADMIN_BILLING:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_billing',
        aiPromptKey: 'superadmin_billing',
      };

    case AppView.SUPERADMIN_INVOICES:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_invoices',
        aiPromptKey: 'superadmin_invoices',
      };

    case AppView.SUPERADMIN_SECURITY:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_security',
        aiPromptKey: 'superadmin_security',
      };

    case AppView.SUPERADMIN_SSO:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_sso',
        aiPromptKey: 'superadmin_sso',
      };

    case AppView.SUPERADMIN_SECURITY_POLICIES:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_security_policies',
        aiPromptKey: 'superadmin_security_policies',
      };

    case AppView.SUPERADMIN_API_MANAGEMENT:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_api_management',
        aiPromptKey: 'superadmin_api_management',
      };

    case AppView.SUPERADMIN_COMPLIANCE:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_compliance',
        aiPromptKey: 'superadmin_compliance',
      };

    case AppView.SUPERADMIN_CONFIGURATION:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_configuration',
        aiPromptKey: 'superadmin_configuration',
      };

    case AppView.SUPERADMIN_WHITELABEL:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_whitelabel',
        aiPromptKey: 'superadmin_whitelabel',
      };

    case AppView.SUPERADMIN_ANALYTICS:
      return {
        moduleId: 'superadmin',
        documentId: 'superadmin_analytics',
        aiPromptKey: 'superadmin_analytics',
      };

    default:
      return {
        moduleId: 'welcome',
        stage: 'interview',
        nextStep: 'tools_assessments',
        aiPromptKey: 'interview',
      };
  }
}
