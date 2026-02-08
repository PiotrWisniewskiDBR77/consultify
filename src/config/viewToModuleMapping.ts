import { AppView } from '../types';

export interface ViewHelpMapping {
  moduleId: string;
  cardId?: string;
}

export type HelpModuleId = string;

/**
 * Maps application views to specific help modules.
 * This ensures that when a user opens the help panel, they see content
 * relevant to their current activity.
 */
export function getHelpMapping(viewId: string): ViewHelpMapping {
  // Normalize viewId
  const view = viewId.toUpperCase();

  // 1. Direct Module Mappings (String matches for industrial modules)
  if (view === 'MES') return { moduleId: 'mes' };
  if (view === 'WMS') return { moduleId: 'wms' };
  if (view === 'QMS') return { moduleId: 'qms' };
  if (view === 'CMMS') return { moduleId: 'cmms' };
  if (view === 'HSE') return { moduleId: 'hse' };
  if (view === 'ESG') return { moduleId: 'esg' };
  if (view === 'IOT') return { moduleId: 'iot' };
  if (view === 'GEMBA') return { moduleId: 'gemba' };
  if (view === 'KPI') return { moduleId: 'kpi' };
  if (view === 'DATA_AI') return { moduleId: 'data_ai' };
  if (view === 'MRP') return { moduleId: 'mrp' };
  if (view === 'APS') return { moduleId: 'aps' };
  if (view === 'DT') return { moduleId: 'dt' };
  if (view === 'HRM') return { moduleId: 'hrm' };
  if (view === 'LMS') return { moduleId: 'lms' };
  if (view === 'SKILLS') return { moduleId: 'skills' };
  if (view === 'BILLING') return { moduleId: 'billing' };

  // 2. AppView Enum Mappings
  switch (view) {
    // AI Chat & Assistance
    case AppView.AI_CHAT:
      return { moduleId: 'ai_chat' };

    // Dashboard & Home
    case AppView.DASHBOARD:
    case AppView.USER_DASHBOARD:
    case AppView.DASHBOARD_OVERVIEW:
    case AppView.DASHBOARD_SNAPSHOT:
    case AppView.WELCOME:
      return { moduleId: 'dashboard' };

    // Assessment Hub & Discovery
    case AppView.ASSESSMENT_OVERVIEW:
    case AppView.ASSESSMENT_SUMMARY:
    case AppView.ASSESSMENT_DASHBOARD:
    case AppView.MY_ASSESSMENTS:
    case AppView.ASSESSMENT_AUDITS:
    case AppView.ASSESSMENT_REPORTS:
    case AppView.GAP_MAP:
    case AppView.INTERVIEW:
    case AppView.DISCOVERY_CONSULTANT:
    case AppView.DISCOVERY_TOOLS:
    case AppView.DISCOVERY_TOOLS_STRATEGIC:
    case AppView.DISCOVERY_TOOLS_OPERATIONAL:
    case AppView.DISCOVERY_TOOLS_DIGITAL:
    case AppView.DISCOVERY_TOOLS_PROCESS_AUTOMATION:
    case AppView.PROJECT_INTELLIGENCE:
    case AppView.ASSESSMENT_DRD:
    case AppView.ASSESSMENT_SIRI:
    case AppView.ASSESSMENT_ADMA:
    case AppView.ASSESSMENT_CMMI:
    case AppView.ASSESSMENT_LEAN:
    case AppView.FULL_STEP1_CONTEXT:
    case AppView.FULL_STEP1_ASSESSMENT:
    case AppView.INITIATIVE_GENERATOR:
      return { moduleId: 'assessment' };

    // Initiatives & Project Management
    case AppView.FULL_STEP2_INITIATIVES:
    case AppView.INITIATIVE_MANAGEMENT:
    case AppView.ADMIN_PROJECTS:
    case AppView.ADMIN_PROJECT_DETAILS:
      return { moduleId: 'initiatives' };

    // Roadmap & Timeline
    case AppView.FULL_STEP3_ROADMAP:
    case AppView.PORTFOLIO_ROADMAP:
      return { moduleId: 'roadmap' };

    // Execution & Tasks
    case AppView.IMPLEMENTATION:
    case AppView.FULL_STEP5_EXECUTION:
    case AppView.FULL_PILOT_EXECUTION:
    case AppView.FULL_ROLLOUT:
    case AppView.MY_WORK:
    case AppView.BENEFITS_REALIZATION:
      return { moduleId: 'execution' };

    // Reports & Analytics
    case AppView.FULL_STEP6_REPORTS:
    case AppView.DRD_AUDIT_REPORT:
      return { moduleId: 'reports' };

    // Industrial Specific (if accessed via specific AppView)
    case AppView.KPI_OKR_DASHBOARD:
      return { moduleId: 'kpi' };
    case AppView.ECONOMICS:
    case AppView.FULL_STEP4_ROI:
      return { moduleId: 'economics' };

    // Settings & Admin
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
      return { moduleId: 'settings' };

    // Onboarding
    case AppView.ONBOARDING_WIZARD:
    case AppView.ORG_SETUP_WIZARD:
    case AppView.QUICK_STEP1_PROFILE:
    case AppView.QUICK_STEP2_USER_CONTEXT:
    case AppView.QUICK_STEP3_EXPECTATIONS:
      return { moduleId: 'onboarding' };

    // Partner Portal
    case AppView.PARTNER_DASHBOARD:
    case AppView.PARTNER_LANDING:
    case AppView.PARTNER_PROVIDER_HOME:
      return { moduleId: 'partner' };

    // Default
    default:
      return { moduleId: 'welcome' };
  }
}
