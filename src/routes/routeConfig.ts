/**
 * Route Configuration for React Router v7
 *
 * This file defines the URL structure and route mappings for the application.
 * Migration Strategy: Gradual replacement of ViewRenderer with standard routing.
 *
 * @see docs/modules/MODULE_ROUTING_ARCHITECTURE.md - Źródło prawdy dla routingu modułów
 * @see src/components/navigation/Sidebar/menuConfig.ts - Konfiguracja menu Sidebar
 * @see src/routes/AppRoutes.tsx - Definicje Route z komponentami
 */

import { AppView } from '@/types';

import { isExceleEngineEnabled } from '@/utils/exceleFlag';

/**
 * Route path definitions
 * Maps AppView enum values to URL paths
 */
export const ROUTES = {
  // Public Routes
  WELCOME: '/',
  AUTH: '/auth',
  // Backward-compatible aliases used by public-entry views.
  LOGIN: '/auth',
  REGISTER: '/auth',
  BECOME_PARTNER: '/become-partner',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Main App Routes
  AI_CHAT: '/chat',
  AI_CHAT_V10_RUNTIME: '/internal/v10-runtime',
  APP_INTRO: '/app-intro',
  AI_CHAT_CONVERSATION: '/chat/:conversationId',
  // Canonical Document module (Document Studio). `/wordy` is a
  // redirect-only legacy alias kept for old bookmarks / KIMI links.
  DOCUMENT_STUDIO: '/document-studio',
  WORDY: '/wordy',
  // Legacy spreadsheet route kept as a redirect-only alias to canonical Table Studio.
  EXCELE: '/excele',
  PREZENTACJE_GEN: '/prezentacje',
  TABELE: '/tabele',
  INTERVIEW: '/interview',
  DISCOVERY_CONSULTANT: '/discovery', // Legacy alias for Interview

  // Discovery Tools Module
  DISCOVERY_TOOLS: {
    ROOT: '/discovery-tools',
    STRATEGIC: '/discovery-tools/strategic',
    STRATEGIC_MEGATRENDS: '/discovery-tools/strategic/megatrends',
    OPERATIONAL: '/discovery-tools/operational',
    DIGITAL: '/discovery-tools/digital',
    PROCESS_AUTOMATION: '/discovery-tools/process-automation',
  },

  MY_WORK: '/my-work',
  PROJECTS: '/projects', // Zwornik (#78): project stakeholder registry + finance rollup
  // HP-22 Harvey-Parity: org-scoped client document vault. Gated by
  // clientVaultFlag (default OFF) — see AppRoutes.tsx registration.
  CLIENT_VAULT: '/vault',
  // HP-4 F3 Harvey-Parity: run-agent workspace entry point (AgentPlanWorkspace).
  // Gated by agentPlanFlag (default OFF) — see AppRoutes.tsx registration.
  AGENT_PLAN: '/agent-plan',
  DASHBOARD: '/chat', // DEPRECATED: Dashboard removed, redirects to Chat

  // Assessment Module
  ASSESSMENT: {
    ROOT: '/assessment',
    // Legacy "Audits" value was historical; keep canonical navigation in one place.
    // Canonical entry now resolves via AppView.ASSESSMENT_AUDITS -> '/audit-programs'.
    AUDITS: '/audit-programs',
    DRD: '/assessment/drd',
    SIRI: '/assessment/siri',
    ADMA: '/assessment/adma',
    CMMI: '/assessment/cmmi',
    LEAN: '/assessment/lean',
    OVERVIEW: '/assessment/overview',
    SUMMARY: '/assessment/summary',
  },

  // Context Builder
  CONTEXT_BUILDER: {
    ROOT: '/context',
    PROFILE: '/context/profile',
    GOALS: '/context/goals',
    CHALLENGES: '/context/challenges',
    MEGATRENDS: '/context/megatrends',
    STRATEGY: '/context/strategy',
  },

  // Organization (unified workspace: Context + Administration)
  ORGANIZATION: {
    ROOT: '/organization',
    PROFILE: '/organization/profile',
    GOALS: '/organization/goals',
    CHALLENGES: '/organization/challenges',
    MEGATRENDS: '/organization/megatrends', // DEPRECATED — redirects to canonical
    STRATEGY: '/organization/strategy',
    MEMBERS: '/organization/members',
    BILLING: '/organization/billing',
    LIMITS: '/organization/limits',
    DOMAINS: '/organization/domains',
    BRANDING: '/organization/branding',
  },

  // Transformation Modules
  INITIATIVES: '/initiatives',
  ROADMAP: '/roadmap',
  PORTFOLIO: '/portfolio',
  ROI: '/roi',
  ECONOMICS: '/economics',
  // Canonical alias for V3 Finance module (keeps backwards-compat /economics)
  FINANCE: '/finance',
  EXECUTION: '/execution',
  IMPLEMENTATION: '/implementation',
  ROLLOUT: '/rollout',
  REPORTS: {
    ROOT: '/reports',
    BUILDER: '/reports/builder',
    MANAGEMENT: '/reports/management',
  },
  PRESENTATIONS: '/presentations',
  PRESENTATION_STUDIO: '/presentation-studio',
  MEETING: '/meeting',
  KPI_OKR: '/kpi-okr',
  BENEFITS: '/benefits',
  RESULTS: '/results',
  CONCLUSIONS: '/conclusions',
  MCP_IRIS: '/mcp/iris',
  MCP_MARKETPLACE: '/mcp/marketplace',

  // Project Intelligence
  PROJECT_INTELLIGENCE: '/project-intelligence',

  // Studio
  STUDIO: '/studio',

  // Admin
  ADMIN: {
    ROOT: '/admin',
    OVERVIEW: '/admin/overview',
    PEOPLE: '/admin/people',
    MEMBERS: '/admin/people',
    SECURITY: '/admin/security',
    BILLING: '/admin/billing',
    AI: '/admin/ai',
    INTEGRATIONS: '/admin/integrations',
    AUDIT: '/admin/audit',
    OPERATIONS: '/admin/operations',
    ORGANIZATION: '/admin/operations',
    TEAM: '/admin/people',
    WORKSPACE: '/admin/operations',
    COLLABORATION: '/admin/security',
    COMPLIANCE: '/admin/compliance',
  },

  // Settings
  SETTINGS: {
    ROOT: '/settings',
    PROFILE: '/settings/profile',
    BILLING: '/settings/billing',
    AI: '/settings/ai',
    NOTIFICATIONS: '/settings/notifications',
    INTEGRATIONS: '/settings/integrations',
    ORGANIZATION: '/settings/organization',
    SECURITY: '/settings/security',
  },

  // SuperAdmin
  SUPERADMIN: {
    ROOT: '/superadmin',
    OVERVIEW: '/superadmin/overview',
    CUSTOMERS: '/superadmin/customers',
    CUSTOMERS_ORGANIZATIONS: '/superadmin/customers/organizations',
    CUSTOMERS_USERS: '/superadmin/customers/users',
    CUSTOMERS_FEEDBACK: '/superadmin/customers/feedback',
    CUSTOMERS_BULK_OPS: '/superadmin/customers/bulk-ops',
    CUSTOMERS_PLAYBOOKS: '/superadmin/customers/playbooks',
    CUSTOMERS_COMMUNICATION: '/superadmin/customers/communication',
    CUSTOMERS_COMMERCIAL: '/superadmin/customers/commercial',
    CUSTOMERS_BILLING: '/superadmin/customers/commercial/billing',
    CUSTOMERS_INVOICES: '/superadmin/customers/commercial/invoices',
    AI_PLATFORM: '/superadmin/ai-platform',
    AI_PLATFORM_LLM: '/superadmin/ai-platform/configuration/llm-providers',
    AI_PLATFORM_SETTINGS: '/superadmin/ai-platform/configuration/settings',
    AI_PLATFORM_INTELLIGENCE: '/superadmin/ai-platform/development/prompt-builder',
    AI_PLATFORM_KNOWLEDGE: '/superadmin/ai-platform/knowledge',
    SYSTEM: '/superadmin/system',
    SYSTEM_API_KEYS: '/superadmin/system/api-keys',
    CONTENT: '/superadmin/content',
    CONTENT_COMPLIANCE: '/superadmin/content/compliance',
    SECURITY: '/superadmin/security',
    SECURITY_SSO: '/superadmin/security/sso',
    SECURITY_POLICIES: '/superadmin/security/policies',
    CONFIGURATION: '/superadmin/configuration',
    CONFIGURATION_SETTINGS: '/superadmin/configuration/settings',
    CONFIGURATION_WHITELABEL: '/superadmin/configuration/whitelabel',
    REVENUE: '/superadmin/revenue',
    ANALYTICS: '/superadmin/analytics',
    VIRTUAL_WORKERS: '/superadmin/virtual-workers',
  },

  // Partner Portal
  PARTNER: {
    LANDING: '/partner',
    ONBOARDING: '/partner/onboarding',
    PUBLIC_APPLY: '/become-partner/apply',
    PRICING: '/partner/pricing',
    DASHBOARD: '/partner/dashboard',
    CLIENTS: '/partner/clients',
    COMMISSION: '/partner/commission',
    DIRECTORY: '/partner/directory',
    RESOURCES: '/partner/resources',
  },

  // Consultant
  CONSULTANT: {
    PANEL: '/consultant/panel',
    INVITES: '/consultant/invites',
  },

  // Wizards
  ORG_SETUP: '/setup/organization',
  ONBOARDING: '/setup/onboarding',
  ONBOARDING_ADMIN: '/setup/onboarding/admin',
  ONBOARDING_SEED: '/setup/onboarding/seed/:persona',
  ONBOARDING_SEED_BASE: '/setup/onboarding/seed',
  TRIAL_ENTRY: '/trial',

  // AI Actions
  AI_ACTIONS: '/ai-actions',
  AI_OS: {
    ROOT: '/ai',
    ALIAS: '/ai-os',
    ACTION_CENTER: '/ai/action-center',
    ACTIONS_ALIAS: '/ai/actions',
    RESEARCH: '/ai/research-sessions',
    ARTIFACTS: '/ai/artifacts',
    WORK_CANVAS: '/ai/work-canvas',
    CONTEXT: '/ai/context',
    MEMORY_ALIAS: '/ai/memory',
    CONNECTORS: '/ai/connectors',
    AGENTS: '/ai/agents',
    OUTCOMES: '/ai/outcomes',
    AIOPS_ALIAS: '/ai/aiops',
  },

  // Vector
  VECTOR: '/vector',

  // Legal
  LEGAL: {
    ABOUT: '/about',
    CONTACT: '/contact',
    TERMS: '/legal/terms',
    PRIVACY: '/legal/privacy',
    COOKIES: '/legal/cookies',
    SECURITY: '/legal/security',
    CENTER: '/legal',
    DOCUMENT: '/legal/:docSlug',
    ACCEPTABLE_USE: '/legal/acceptable-use',
    AI_POLICY: '/legal/ai-policy',
    SUBSCRIPTION: '/legal/subscription',
    DPA: '/legal/dpa',
    SLA: '/legal/sla',
    REFUNDS: '/legal/refunds',
    CUSTOMER_SECURITY: '/legal/customer-security',
    SUBPROCESSORS: '/legal/subprocessors',
  },

  // Status & Changelog
  STATUS: '/status',
  CHANGELOG: '/changelog',

  // Knowledge & Pricing
  DOCS: '/docs',
  KNOWLEDGE_BASE: '/knowledge',
  KNOWLEDGE_BASE_PUBLIC: '/knowledge-base',
  CASE_STUDIES: '/business-cases',
  PRICING: '/pricing',
  APP_PRICING: '/app/pricing',
  EXECUTIVE: '/executive',
} as const;

/**
 * Maps AppView enum to route paths
 * Used for backward compatibility during migration
 */
export const APP_VIEW_TO_ROUTE: Record<AppView, string> = {
  // Public
  [AppView.WELCOME]: ROUTES.WELCOME,
  [AppView.AUTH]: ROUTES.AUTH,

  // Main
  [AppView.AI_CHAT]: ROUTES.AI_CHAT,
  [AppView.AI_CHAT_V10_RUNTIME]: ROUTES.AI_CHAT_V10_RUNTIME,
  [AppView.APP_INTRO]: ROUTES.APP_INTRO,
  [AppView.MY_WORK]: ROUTES.MY_WORK,
  [AppView.PROJECTS]: ROUTES.PROJECTS,
  [AppView.CLIENT_VAULT]: ROUTES.CLIENT_VAULT,
  [AppView.AGENT_PLAN]: ROUTES.AGENT_PLAN,
  [AppView.DASHBOARD]: ROUTES.AI_CHAT, // DEPRECATED: redirects to Chat
  [AppView.USER_DASHBOARD]: ROUTES.AI_CHAT, // DEPRECATED: redirects to Chat
  [AppView.DASHBOARD_OVERVIEW]: ROUTES.AI_CHAT, // DEPRECATED: redirects to Chat
  [AppView.DASHBOARD_SNAPSHOT]: ROUTES.AI_CHAT, // DEPRECATED: redirects to Chat

  // Assessment
  [AppView.ASSESSMENT_DRD]: ROUTES.ASSESSMENT.DRD,
  [AppView.ASSESSMENT_SIRI]: ROUTES.ASSESSMENT.SIRI,
  [AppView.ASSESSMENT_ADMA]: ROUTES.ASSESSMENT.ADMA,
  [AppView.ASSESSMENT_CMMI]: ROUTES.ASSESSMENT.CMMI,
  [AppView.ASSESSMENT_LEAN]: ROUTES.ASSESSMENT.LEAN,
  [AppView.ASSESSMENT_LEAN_EXTERNAL]: ROUTES.ASSESSMENT.LEAN,
  [AppView.ASSESSMENT_OVERVIEW]: ROUTES.ASSESSMENT.OVERVIEW,
  [AppView.ASSESSMENT_SUMMARY]: ROUTES.ASSESSMENT.SUMMARY,
  // Repointed to the real, registered Audit Orchestrator hub (/audit-programs).
  // The old ROUTES.ASSESSMENT.AUDITS ('/assessment/audits') was never registered
  // in AppRoutes, so the "Audits" sidebar item + reverse-lookup breadcrumb now
  // resolve to the working hub.
  [AppView.ASSESSMENT_AUDITS]: '/audit-programs',
  [AppView.ASSESSMENT_DIGITAL_EXTERNAL]: ROUTES.ASSESSMENT.DRD,
  [AppView.ASSESSMENT_OTHER]: ROUTES.ASSESSMENT.ROOT,
  [AppView.MY_ASSESSMENTS]: ROUTES.ASSESSMENT.ROOT,
  [AppView.REVIEWER_DASHBOARD]: ROUTES.ASSESSMENT.ROOT,
  [AppView.ASSESSMENT_DASHBOARD]: ROUTES.ASSESSMENT.ROOT,
  [AppView.GAP_MAP]: ROUTES.ASSESSMENT.ROOT,
  [AppView.ASSESSMENT_REPORTS]: ROUTES.ASSESSMENT.ROOT,
  [AppView.INITIATIVE_GENERATOR]: ROUTES.INITIATIVES,

  // Context Builder
  [AppView.CONTEXT_BUILDER]: ROUTES.CONTEXT_BUILDER.ROOT,
  [AppView.CONTEXT_BUILDER_PROFILE]: ROUTES.CONTEXT_BUILDER.PROFILE,
  [AppView.CONTEXT_BUILDER_GOALS]: ROUTES.CONTEXT_BUILDER.GOALS,
  [AppView.CONTEXT_BUILDER_CHALLENGES]: ROUTES.CONTEXT_BUILDER.CHALLENGES,
  [AppView.CONTEXT_BUILDER_MEGATRENDS]: ROUTES.CONTEXT_BUILDER.MEGATRENDS,
  [AppView.CONTEXT_BUILDER_STRATEGY]: ROUTES.CONTEXT_BUILDER.STRATEGY,

  // Organization (Settings-like)
  [AppView.ORGANIZATION_PROFILE]: ROUTES.ORGANIZATION.PROFILE,

  // Transformation
  [AppView.FULL_STEP1_CONTEXT]: ROUTES.CONTEXT_BUILDER.ROOT,
  [AppView.FULL_STEP1_ASSESSMENT]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_PROCESSES]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_DIGITAL]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_MODELS]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_DATA]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_CULTURE]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_CYBERSECURITY]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP1_AI]: ROUTES.ASSESSMENT.DRD,
  [AppView.FULL_STEP2_INITIATIVES]: ROUTES.INITIATIVES,
  [AppView.FULL_STEP3_ROADMAP]: ROUTES.INITIATIVES,
  [AppView.FULL_STEP4_ROI]: ROUTES.ROI,
  [AppView.ECONOMICS]: ROUTES.FINANCE,
  [AppView.FULL_STEP5_EXECUTION]: ROUTES.EXECUTION,
  [AppView.IMPLEMENTATION]: ROUTES.EXECUTION,
  [AppView.FULL_PILOT_EXECUTION]: ROUTES.EXECUTION,
  [AppView.FULL_ROLLOUT]: ROUTES.ROLLOUT,
  [AppView.FULL_STEP6_REPORTS]: ROUTES.REPORTS.BUILDER,
  [AppView.REPORTS_ENTRY]: ROUTES.REPORTS.ROOT,
  [AppView.REPORTS_MANAGEMENT]: ROUTES.REPORTS.MANAGEMENT,
  [AppView.DRD_AUDIT_REPORT]: ROUTES.REPORTS.BUILDER,
  [AppView.PRESENTATIONS]: ROUTES.PRESENTATIONS,
  [AppView.MEETING]: ROUTES.MEETING,
  // Document module: the legacy WORDY view now resolves to the canonical
  // Document Studio route (mirrors the EXCELE -> TABELE consolidation).
  [AppView.WORDY]: ROUTES.DOCUMENT_STUDIO,
  // Excel = własne wejście (decyzja Piotra 2026-07-22). Canonical → /excele:
  // bezpieczne także przy fladze OFF, bo /excele redirectuje wtedy na /tabele
  // (AppRoutes), a wpis nav „Excel" pojawia się dopiero przy fladze ON.
  [AppView.EXCELE]: ROUTES.EXCELE,
  [AppView.PREZENTACJE_GEN]: ROUTES.PREZENTACJE_GEN,
  [AppView.TABELE]: ROUTES.TABELE,
  [AppView.KPI_OKR_DASHBOARD]: ROUTES.RESULTS,
  [AppView.PORTFOLIO_ROADMAP]: ROUTES.INITIATIVES,
  [AppView.INITIATIVE_MANAGEMENT]: ROUTES.INITIATIVES,
  [AppView.BENEFITS_REALIZATION]: ROUTES.RESULTS,
  [AppView.CONCLUSIONS]: ROUTES.CONCLUSIONS,
  [AppView.MCP_IRIS_COMING_SOON]: ROUTES.MCP_IRIS,
  [AppView.MCP_MARKETPLACE_COMING_SOON]: ROUTES.MCP_MARKETPLACE,

  // Interview (was Project Intelligence)
  [AppView.PROJECT_INTELLIGENCE]: ROUTES.PROJECT_INTELLIGENCE,
  [AppView.INTERVIEW]: ROUTES.INTERVIEW,
  [AppView.DISCOVERY_CONSULTANT]: ROUTES.DISCOVERY_CONSULTANT,

  // Discovery Tools Module
  [AppView.DISCOVERY_TOOLS]: ROUTES.DISCOVERY_TOOLS.ROOT,
  [AppView.DISCOVERY_TOOLS_STRATEGIC]: ROUTES.DISCOVERY_TOOLS.STRATEGIC,
  [AppView.DISCOVERY_TOOLS_OPERATIONAL]: ROUTES.DISCOVERY_TOOLS.OPERATIONAL,
  [AppView.DISCOVERY_TOOLS_DIGITAL]: ROUTES.DISCOVERY_TOOLS.DIGITAL,
  [AppView.DISCOVERY_TOOLS_PROCESS_AUTOMATION]: ROUTES.DISCOVERY_TOOLS.PROCESS_AUTOMATION,

  // Studio
  [AppView.STUDIO]: ROUTES.STUDIO,

  // Admin
  [AppView.ADMIN_DASHBOARD]: ROUTES.ADMIN.ROOT,
  [AppView.ADMIN_OVERVIEW]: ROUTES.ADMIN.OVERVIEW,
  [AppView.ADMIN_ORGANIZATION]: ROUTES.ADMIN.ORGANIZATION,
  [AppView.ADMIN_ORGANIZATION_SETTINGS]: ROUTES.ADMIN.ORGANIZATION,
  [AppView.ADMIN_TEAM]: ROUTES.ADMIN.TEAM,
  [AppView.ADMIN_WORKSPACE]: ROUTES.ADMIN.INTEGRATIONS,
  [AppView.ADMIN_PROJECT_DETAILS]: ROUTES.ADMIN.INTEGRATIONS,
  [AppView.ADMIN_AI]: ROUTES.ADMIN.AI,
  [AppView.ADMIN_BILLING]: ROUTES.ADMIN.BILLING,
  [AppView.ADMIN_SECURITY]: ROUTES.ADMIN.SECURITY,
  [AppView.ADMIN_SETTINGS]: ROUTES.ADMIN.SECURITY,
  [AppView.ADMIN_USERS]: ROUTES.ADMIN.PEOPLE,
  [AppView.ADMIN_PROJECTS]: ROUTES.ADMIN.OPERATIONS,
  [AppView.ADMIN_LLM]: ROUTES.ADMIN.AI,
  [AppView.ADMIN_AI_HEALTH]: ROUTES.ADMIN.AI,
  [AppView.ADMIN_KNOWLEDGE]: ROUTES.ADMIN.AI,
  [AppView.ADMIN_TEAMS]: ROUTES.ADMIN.PEOPLE,
  [AppView.ADMIN_ANALYTICS]: ROUTES.ADMIN.OVERVIEW,
  [AppView.ADMIN_FEEDBACK]: ROUTES.ADMIN.OVERVIEW,
  [AppView.ADMIN_METRICS]: ROUTES.ADMIN.OVERVIEW,
  [AppView.ADMIN_API_KEYS]: ROUTES.ADMIN.SECURITY,
  [AppView.ADMIN_BILLING_MANAGEMENT]: ROUTES.ADMIN.BILLING,
  [AppView.ADMIN_BULK_OPERATIONS]: ROUTES.ADMIN.OPERATIONS,
  [AppView.ADMIN_WORK_MODE]: ROUTES.ADMIN.OVERVIEW,
  [AppView.ADMIN_SETTINGS_CONSULTANTS]: ROUTES.ADMIN.PEOPLE,
  [AppView.ADMIN_INVITATIONS]: ROUTES.ADMIN.PEOPLE,
  [AppView.ADMIN_TOKEN_MANAGEMENT]: ROUTES.ADMIN.SECURITY,

  // Settings
  [AppView.SETTINGS_PROFILE]: ROUTES.SETTINGS.PROFILE,
  [AppView.SETTINGS_BILLING]: ROUTES.SETTINGS.BILLING,
  [AppView.SETTINGS_AI]: `${ROUTES.SETTINGS.ROOT}/ai-behavior`,
  [AppView.SETTINGS_NOTIFICATIONS]: `${ROUTES.SETTINGS.ROOT}/notifications-overview`,
  [AppView.SETTINGS_INTEGRATIONS]: ROUTES.SETTINGS.INTEGRATIONS,
  [AppView.SETTINGS_ORGANIZATION]: `${ROUTES.SETTINGS.ROOT}/tenant-defaults`,
  [AppView.SETTINGS_MFA]: `${ROUTES.SETTINGS.ROOT}/auth-access`,
  [AppView.SETTINGS_ACTIVE_SESSIONS]: `${ROUTES.SETTINGS.ROOT}/auth-access`,
  [AppView.SETTINGS_LOGIN_HISTORY]: `${ROUTES.SETTINGS.ROOT}/auth-access`,
  [AppView.SETTINGS_DATA_CONTROLS]: `${ROUTES.SETTINGS.ROOT}/data-controls`,
  [AppView.SETTINGS_API_KEYS]: `${ROUTES.SETTINGS.ROOT}/api-keys`,
  [AppView.SETTINGS_WEBHOOKS]: ROUTES.SETTINGS.INTEGRATIONS,
  [AppView.SETTINGS_CALENDAR_SYNC]: ROUTES.SETTINGS.INTEGRATIONS,
  [AppView.SETTINGS_APPEARANCE]: `${ROUTES.SETTINGS.ROOT}/theme`,
  [AppView.SETTINGS_AI_MEMORY]: `${ROUTES.SETTINGS.ROOT}/ai-memory`,
  [AppView.SETTINGS_AI_RESPONSE_STYLE]: `${ROUTES.SETTINGS.ROOT}/ai-behavior`,
  [AppView.SETTINGS_AI_CHAT_HISTORY]: `${ROUTES.SETTINGS.ROOT}/ai-chat-history`,
  [AppView.SETTINGS_AI_VOICE]: `${ROUTES.SETTINGS.ROOT}/ai-voice`,
  [AppView.SETTINGS_SECURITY]: `${ROUTES.SETTINGS.ROOT}/security-dashboard`,
  [AppView.SETTINGS_API_ACCESS]: `${ROUTES.SETTINGS.ROOT}/api-keys`,
  [AppView.SETTINGS_PRIVACY]: `${ROUTES.SETTINGS.ROOT}/privacy`,
  [AppView.SETTINGS_SSO]: `${ROUTES.SETTINGS.ROOT}/auth-access`,
  [AppView.SETTINGS_LEGAL]: ROUTES.SETTINGS.PROFILE,
  [AppView.SETTINGS_WORK_PREFERENCES]: `${ROUTES.SETTINGS.ROOT}/work-preferences`,
  [AppView.SETTINGS_DASHBOARD_PREFERENCES]: `${ROUTES.SETTINGS.ROOT}/dashboard`,
  [AppView.SETTINGS_ACCESSIBILITY]: `${ROUTES.SETTINGS.ROOT}/accessibility`,
  [AppView.SETTINGS_PROFILE_MODULE]: ROUTES.SETTINGS.PROFILE,
  [AppView.SETTINGS_AI_MODULE]: `${ROUTES.SETTINGS.ROOT}/ai-behavior`,
  [AppView.SETTINGS_NOTIFICATIONS_MODULE]: `${ROUTES.SETTINGS.ROOT}/notifications-overview`,
  [AppView.SETTINGS_SECURITY_MODULE]: `${ROUTES.SETTINGS.ROOT}/security-dashboard`,
  [AppView.SETTINGS_INTEGRATIONS_MODULE]: ROUTES.SETTINGS.INTEGRATIONS,
  [AppView.SETTINGS_APPEARANCE_MODULE]: `${ROUTES.SETTINGS.ROOT}/theme`,
  [AppView.SETTINGS_REGIONALIZATION]: `${ROUTES.SETTINGS.ROOT}/regional`,

  // SuperAdmin
  [AppView.SUPERADMIN_OVERVIEW]: ROUTES.SUPERADMIN.OVERVIEW,
  [AppView.SUPERADMIN_CUSTOMERS]: ROUTES.SUPERADMIN.CUSTOMERS,
  [AppView.SUPERADMIN_COMMUNICATION]: ROUTES.SUPERADMIN.CUSTOMERS_COMMUNICATION,
  [AppView.SUPERADMIN_AI_PLATFORM]: ROUTES.SUPERADMIN.AI_PLATFORM,
  [AppView.SUPERADMIN_AI_INFRASTRUCTURE]: ROUTES.SUPERADMIN.AI_PLATFORM,
  [AppView.SUPERADMIN_AI_DEVELOPMENT]: ROUTES.SUPERADMIN.AI_PLATFORM,
  [AppView.SUPERADMIN_AI_OPERATIONS]: ROUTES.SUPERADMIN.AI_PLATFORM,
  [AppView.SUPERADMIN_SYSTEM]: ROUTES.SUPERADMIN.SYSTEM,
  [AppView.SUPERADMIN_CONTENT]: ROUTES.SUPERADMIN.CONTENT,
  [AppView.SUPERADMIN_REVENUE]: ROUTES.SUPERADMIN.CUSTOMERS_COMMERCIAL,
  [AppView.SUPERADMIN_SECURITY]: ROUTES.SUPERADMIN.SECURITY,
  [AppView.SUPERADMIN_CONFIGURATION]: ROUTES.SUPERADMIN.CONFIGURATION,
  [AppView.SUPERADMIN_ANALYTICS]: ROUTES.SUPERADMIN.ANALYTICS,
  [AppView.SUPERADMIN_VIRTUAL_WORKERS]: ROUTES.SUPERADMIN.VIRTUAL_WORKERS,
  [AppView.SUPERADMIN_DASHBOARD]: ROUTES.SUPERADMIN.OVERVIEW,
  [AppView.SUPERADMIN_ORGANIZATIONS]: ROUTES.SUPERADMIN.CUSTOMERS_ORGANIZATIONS,
  [AppView.SUPERADMIN_USERS]: ROUTES.SUPERADMIN.CUSTOMERS_USERS,
  [AppView.SUPERADMIN_BILLING]: ROUTES.SUPERADMIN.CUSTOMERS_BILLING,
  [AppView.SUPERADMIN_AI_CONFIG]: ROUTES.SUPERADMIN.AI_PLATFORM_SETTINGS,
  [AppView.SUPERADMIN_LLM_MANAGEMENT]: ROUTES.SUPERADMIN.AI_PLATFORM_LLM,
  [AppView.SUPERADMIN_AI_INTELLIGENCE]: ROUTES.SUPERADMIN.AI_PLATFORM_INTELLIGENCE,
  [AppView.SUPERADMIN_KNOWLEDGE]: ROUTES.SUPERADMIN.AI_PLATFORM_KNOWLEDGE,
  [AppView.SUPERADMIN_SETTINGS]: ROUTES.SUPERADMIN.CONFIGURATION_SETTINGS,
  [AppView.SUPERADMIN_SSO]: ROUTES.SUPERADMIN.SECURITY_SSO,
  [AppView.SUPERADMIN_SECURITY_POLICIES]: ROUTES.SUPERADMIN.SECURITY_POLICIES,
  [AppView.SUPERADMIN_API_MANAGEMENT]: ROUTES.SUPERADMIN.SYSTEM_API_KEYS,
  [AppView.SUPERADMIN_WHITELABEL]: ROUTES.SUPERADMIN.CONFIGURATION_WHITELABEL,
  [AppView.SUPERADMIN_COMPLIANCE]: ROUTES.SUPERADMIN.CONTENT_COMPLIANCE,
  [AppView.SUPERADMIN_INVOICES]: ROUTES.SUPERADMIN.CUSTOMERS_INVOICES,
  [AppView.SUPERADMIN_FEEDBACK]: ROUTES.SUPERADMIN.CUSTOMERS_FEEDBACK,
  [AppView.SUPERADMIN_BULK_OPERATIONS]: ROUTES.SUPERADMIN.CUSTOMERS_BULK_OPS,
  [AppView.SUPERADMIN_PLAYBOOK_TEMPLATES]: ROUTES.SUPERADMIN.CUSTOMERS_PLAYBOOKS,
  [AppView.SUPERADMIN_PLAYBOOK_EDITOR]: ROUTES.SUPERADMIN.CUSTOMERS_PLAYBOOKS,
  [AppView.ADMIN_PLAYBOOK_RUNS]: ROUTES.ADMIN.ROOT,

  // Partner
  [AppView.PARTNER_LANDING]: ROUTES.PARTNER.LANDING,
  [AppView.PARTNER_PRICING]: ROUTES.PARTNER.PRICING,
  [AppView.APP_PRICING]: ROUTES.APP_PRICING,
  [AppView.PARTNER_PROVIDER_HOME]: ROUTES.PARTNER.DASHBOARD,
  [AppView.PARTNER_DASHBOARD]: ROUTES.PARTNER.DASHBOARD,
  [AppView.PARTNER_CLIENT_ACCESS]: ROUTES.PARTNER.CLIENTS,
  [AppView.PARTNER_COMMISSION]: ROUTES.PARTNER.COMMISSION,
  [AppView.PARTNER_DIRECTORY]: ROUTES.PARTNER.DIRECTORY,
  [AppView.PARTNER_RESOURCES]: ROUTES.PARTNER.RESOURCES,

  // Consultant
  [AppView.CONSULTANT_PANEL]: ROUTES.CONSULTANT.PANEL,
  [AppView.CONSULTANT_INVITES]: ROUTES.CONSULTANT.INVITES,

  // Wizards
  [AppView.ORG_SETUP_WIZARD]: ROUTES.ORG_SETUP,
  [AppView.ONBOARDING_WIZARD]: ROUTES.ONBOARDING,
  [AppView.TRIAL_ENTRY]: ROUTES.TRIAL_ENTRY,

  // Quick Assessment
  [AppView.FREE_ASSESSMENT_CHAT]: ROUTES.ASSESSMENT.ROOT,
  [AppView.QUICK_STEP1_PROFILE]: ROUTES.CONTEXT_BUILDER.PROFILE,
  [AppView.QUICK_STEP2_USER_CONTEXT]: ROUTES.CONTEXT_BUILDER.GOALS,
  [AppView.QUICK_STEP3_EXPECTATIONS]: ROUTES.CONTEXT_BUILDER.STRATEGY,

  // AI Actions
  [AppView.AI_ACTION_PROPOSALS]: ROUTES.AI_ACTIONS,
  [AppView.AI_OS_HOME]: ROUTES.AI_OS.ROOT,
  [AppView.AI_OS_WORK_CANVAS]: ROUTES.AI_OS.WORK_CANVAS,
  [AppView.AI_OS_ACTION_CENTER]: ROUTES.AI_OS.ACTION_CENTER,
  [AppView.AI_OS_RESEARCH]: ROUTES.AI_OS.RESEARCH,
  [AppView.AI_OS_ARTIFACTS]: ROUTES.AI_OS.ARTIFACTS,
  [AppView.AI_OS_CONTEXT_MEMORY]: ROUTES.AI_OS.CONTEXT,
  [AppView.AI_OS_CONNECTORS]: ROUTES.AI_OS.CONNECTORS,
  [AppView.AI_OS_AGENTS]: ROUTES.AI_OS.AGENTS,
  [AppView.AI_OS_OUTCOMES]: ROUTES.AI_OS.OUTCOMES,

  // Legacy/Fallback
  [AppView.FULL_TRANSFORMATION_CHAT]: ROUTES.AI_CHAT,
  [AppView.MASTERCLASS]: ROUTES.AI_CHAT,
  [AppView.RESOURCES]: ROUTES.AI_CHAT,
  [AppView.EXECUTIVE_VIEW]: ROUTES.EXECUTIVE,
  [AppView.KNOWLEDGE_BASE]: ROUTES.DOCS,
  [AppView.KNOWLEDGE_BASE_ARTICLE]: ROUTES.DOCS,
  [AppView.STATUS_PAGE]: ROUTES.AI_CHAT,
  [AppView.CHANGELOG]: ROUTES.AI_CHAT,
  [AppView.HELP_ANALYTICS]: ROUTES.AI_CHAT,
};

/**
 * Helper function to get route path from AppView
 * Enhanced with diagnostic logging for navigation debugging
 */
export function getRouteFromAppView(view: AppView): string {
  const route = APP_VIEW_TO_ROUTE[view];

  if (!route) {
    if (view.startsWith('SUPERADMIN_')) {
      console.warn(
        `[routeConfig] WARNING: No route mapping for superadmin view "${view}", falling back to superadmin root`
      );
      return ROUTES.SUPERADMIN.ROOT;
    }
    console.warn(
      `[routeConfig] WARNING: No route mapping for view "${view}", falling back to chat`
    );
    console.warn('[routeConfig] This may indicate a missing entry in APP_VIEW_TO_ROUTE');
    return ROUTES.AI_CHAT;
  }

  return route;
}

/**
 * Helper function to get AppView from route path
 * Used for backward compatibility
 */
export function getAppViewFromRoute(path: string): AppView | null {
  const canonicalRouteOrder: AppView[] = [
    AppView.TABELE,
    AppView.WORDY,
    AppView.PREZENTACJE_GEN,
    AppView.SUPERADMIN_OVERVIEW,
    AppView.SUPERADMIN_DASHBOARD,
    AppView.SUPERADMIN_CUSTOMERS,
    AppView.SUPERADMIN_ORGANIZATIONS,
    AppView.SUPERADMIN_USERS,
    AppView.SUPERADMIN_FEEDBACK,
    AppView.SUPERADMIN_BULK_OPERATIONS,
    AppView.SUPERADMIN_PLAYBOOK_TEMPLATES,
    AppView.SUPERADMIN_COMMUNICATION,
    AppView.SUPERADMIN_REVENUE,
    AppView.SUPERADMIN_BILLING,
    AppView.SUPERADMIN_INVOICES,
    AppView.SUPERADMIN_AI_PLATFORM,
    AppView.SUPERADMIN_LLM_MANAGEMENT,
    AppView.SUPERADMIN_AI_CONFIG,
    AppView.SUPERADMIN_AI_INTELLIGENCE,
    AppView.SUPERADMIN_KNOWLEDGE,
    AppView.SUPERADMIN_CONFIGURATION,
    AppView.SUPERADMIN_SETTINGS,
    AppView.SUPERADMIN_WHITELABEL,
    AppView.SUPERADMIN_ANALYTICS,
    AppView.SUPERADMIN_SYSTEM,
    AppView.SUPERADMIN_API_MANAGEMENT,
    AppView.SUPERADMIN_CONTENT,
    AppView.SUPERADMIN_COMPLIANCE,
    AppView.SUPERADMIN_SECURITY,
    AppView.SUPERADMIN_SSO,
    AppView.SUPERADMIN_SECURITY_POLICIES,
  ];

  for (const view of canonicalRouteOrder) {
    if (APP_VIEW_TO_ROUTE[view] === path) return view;
  }

  const entry = Object.entries(APP_VIEW_TO_ROUTE).find(([_, route]) => route === path);
  return entry ? (entry[0] as AppView) : null;
}

/**
 * Maps a URL path (including nested routes) to an AppView.
 * Uses exact route matches first, then falls back to module root prefixes.
 */
export function getAppViewFromPath(path: string): AppView | null {
  const normalized = path.replace(/\/+$/, '') || '/';

  if (normalized === ROUTES.AI_OS.ROOT || normalized === ROUTES.AI_OS.ALIAS)
    return AppView.AI_OS_HOME;
  if (normalized === ROUTES.AI_OS.ACTIONS_ALIAS) return AppView.AI_OS_ACTION_CENTER;
  if (normalized === ROUTES.AI_OS.MEMORY_ALIAS) return AppView.AI_OS_CONTEXT_MEMORY;
  if (normalized === ROUTES.AI_OS.AIOPS_ALIAS) return AppView.AI_OS_OUTCOMES;
  if (normalized === ROUTES.AI_OS.ACTION_CENTER) return AppView.AI_OS_ACTION_CENTER;
  if (normalized === ROUTES.AI_OS.RESEARCH) return AppView.AI_OS_RESEARCH;
  if (normalized === ROUTES.AI_OS.ARTIFACTS) return AppView.AI_OS_ARTIFACTS;
  if (normalized === ROUTES.AI_OS.CONTEXT) return AppView.AI_OS_CONTEXT_MEMORY;
  if (normalized === ROUTES.AI_OS.CONNECTORS) return AppView.AI_OS_CONNECTORS;
  if (normalized === ROUTES.AI_OS.AGENTS) return AppView.AI_OS_AGENTS;
  if (normalized === ROUTES.AI_OS.OUTCOMES) return AppView.AI_OS_OUTCOMES;

  if (normalized === ROUTES.SETTINGS.PROFILE) return AppView.SETTINGS_PROFILE_MODULE;
  if (
    [
      'ai-behavior',
      'ai-model-params',
      'ai-autocomplete',
      'ai-memory',
      'ai-privacy',
      'ai-prompt-library',
      'ai-voice',
      'ai-usage',
    ].some((section) => normalized === `${ROUTES.SETTINGS.ROOT}/${section}`)
  ) {
    return AppView.SETTINGS_AI_MODULE;
  }
  if (
    [
      'notifications-overview',
      'notifications-email-digest',
      'notifications-desktop-sounds',
      'notifications-availability',
    ].some((section) => normalized === `${ROUTES.SETTINGS.ROOT}/${section}`)
  ) {
    return AppView.SETTINGS_NOTIFICATIONS_MODULE;
  }
  if (normalized === `${ROUTES.SETTINGS.ROOT}/security-dashboard`)
    return AppView.SETTINGS_SECURITY_MODULE;
  if (normalized === ROUTES.SETTINGS.INTEGRATIONS) return AppView.SETTINGS_INTEGRATIONS_MODULE;
  if (normalized === `${ROUTES.SETTINGS.ROOT}/theme`) return AppView.SETTINGS_APPEARANCE_MODULE;

  // Both historical app-view IDs emit the canonical Results route. Resolve
  // the reverse mapping explicitly to the sidebar/owner view instead of
  // depending on object insertion order between duplicate route values.
  if (normalized === ROUTES.RESULTS) return AppView.BENEFITS_REALIZATION;
  // Initiatives has several historical AppView ids pointing at the same owner.
  // Keep URL sync on the sidebar/owner identity instead of object insertion order.
  if (normalized === ROUTES.INITIATIVES) return AppView.FULL_STEP2_INITIATIVES;

  const exact = getAppViewFromRoute(normalized);
  if (exact) return exact;

  if (normalized === ROUTES.AI_CHAT_V10_RUNTIME) return AppView.AI_CHAT_V10_RUNTIME;
  // /chat/:conversationId → AI_CHAT
  if (normalized.startsWith('/chat/')) return AppView.AI_CHAT;
  if (normalized.startsWith(ROUTES.DOCS)) return AppView.KNOWLEDGE_BASE;
  if (normalized.startsWith(ROUTES.KNOWLEDGE_BASE_PUBLIC)) return AppView.KNOWLEDGE_BASE;
  if (normalized.startsWith(ROUTES.KNOWLEDGE_BASE)) return AppView.KNOWLEDGE_BASE;
  if (normalized.startsWith(ROUTES.MY_WORK)) return AppView.MY_WORK;
  if (normalized.startsWith(ROUTES.PROJECTS)) return AppView.PROJECTS;
  if (normalized.startsWith(ROUTES.CLIENT_VAULT)) return AppView.CLIENT_VAULT;
  if (normalized.startsWith(ROUTES.AGENT_PLAN)) return AppView.AGENT_PLAN;
  if (normalized.startsWith(ROUTES.INITIATIVES)) return AppView.FULL_STEP2_INITIATIVES;
  if (normalized.startsWith(ROUTES.PORTFOLIO) || normalized.startsWith(ROUTES.ROADMAP)) {
    return AppView.PORTFOLIO_ROADMAP;
  }
  if (normalized.startsWith(ROUTES.ROI)) return AppView.FULL_STEP4_ROI;
  if (normalized.startsWith(ROUTES.PROJECT_INTELLIGENCE)) return AppView.PROJECT_INTELLIGENCE;
  if (normalized.startsWith(ROUTES.AI_ACTIONS)) return AppView.AI_ACTION_PROPOSALS;
  if (normalized.startsWith(ROUTES.CONSULTANT.PANEL)) return AppView.CONSULTANT_PANEL;
  if (normalized.startsWith(ROUTES.CONSULTANT.INVITES)) return AppView.CONSULTANT_INVITES;
  if (normalized.startsWith(ROUTES.ORG_SETUP)) return AppView.ORG_SETUP_WIZARD;
  if (normalized.startsWith(ROUTES.ONBOARDING)) return AppView.ONBOARDING_WIZARD;
  if (normalized.startsWith(ROUTES.ONBOARDING_ADMIN)) return AppView.ONBOARDING_WIZARD;
  if (normalized.startsWith(ROUTES.ONBOARDING_SEED_BASE)) return AppView.ONBOARDING_WIZARD;
  if (normalized.startsWith(ROUTES.IMPLEMENTATION)) return AppView.FULL_STEP5_EXECUTION;
  if (normalized.startsWith(ROUTES.EXECUTION)) return AppView.FULL_STEP5_EXECUTION;
  if (normalized.startsWith(ROUTES.ROLLOUT)) return AppView.FULL_ROLLOUT;
  if (
    normalized.startsWith(ROUTES.RESULTS) ||
    normalized.startsWith(ROUTES.BENEFITS) ||
    normalized.startsWith(ROUTES.KPI_OKR)
  ) {
    return AppView.BENEFITS_REALIZATION;
  }
  if (normalized.startsWith(ROUTES.CONCLUSIONS)) return AppView.CONCLUSIONS;

  if (normalized.startsWith(ROUTES.SETTINGS.ROOT)) return AppView.SETTINGS_PROFILE_MODULE;
  if (normalized.startsWith(ROUTES.ADMIN.ROOT)) return AppView.ADMIN_DASHBOARD;
  if (normalized.startsWith(ROUTES.PARTNER.ONBOARDING)) return AppView.PARTNER_LANDING;
  if (normalized.startsWith(ROUTES.PARTNER.LANDING)) return AppView.PARTNER_LANDING;
  // SuperAdmin: map nested routes to the correct section view
  if (normalized.startsWith(ROUTES.SUPERADMIN.OVERVIEW)) return AppView.SUPERADMIN_OVERVIEW;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_PLAYBOOKS))
    return AppView.SUPERADMIN_PLAYBOOK_TEMPLATES;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_BULK_OPS))
    return AppView.SUPERADMIN_BULK_OPERATIONS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_FEEDBACK))
    return AppView.SUPERADMIN_FEEDBACK;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_INVOICES))
    return AppView.SUPERADMIN_INVOICES;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_BILLING)) return AppView.SUPERADMIN_BILLING;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_COMMERCIAL))
    return AppView.SUPERADMIN_REVENUE;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_COMMUNICATION))
    return AppView.SUPERADMIN_COMMUNICATION;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_USERS)) return AppView.SUPERADMIN_USERS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS_ORGANIZATIONS))
    return AppView.SUPERADMIN_ORGANIZATIONS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CUSTOMERS)) return AppView.SUPERADMIN_CUSTOMERS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.AI_PLATFORM_LLM))
    return AppView.SUPERADMIN_LLM_MANAGEMENT;
  if (normalized.startsWith(ROUTES.SUPERADMIN.AI_PLATFORM_SETTINGS))
    return AppView.SUPERADMIN_AI_CONFIG;
  if (normalized.startsWith(ROUTES.SUPERADMIN.AI_PLATFORM_INTELLIGENCE))
    return AppView.SUPERADMIN_AI_INTELLIGENCE;
  if (normalized.startsWith(ROUTES.SUPERADMIN.AI_PLATFORM_KNOWLEDGE))
    return AppView.SUPERADMIN_KNOWLEDGE;
  if (normalized.startsWith(ROUTES.SUPERADMIN.AI_PLATFORM)) return AppView.SUPERADMIN_AI_PLATFORM;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CONTENT_COMPLIANCE))
    return AppView.SUPERADMIN_COMPLIANCE;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CONTENT)) return AppView.SUPERADMIN_CONTENT;
  if (normalized.startsWith(ROUTES.SUPERADMIN.SYSTEM_API_KEYS))
    return AppView.SUPERADMIN_API_MANAGEMENT;
  if (normalized.startsWith(ROUTES.SUPERADMIN.SYSTEM)) return AppView.SUPERADMIN_SYSTEM;
  if (normalized.startsWith(ROUTES.SUPERADMIN.SECURITY_POLICIES))
    return AppView.SUPERADMIN_SECURITY_POLICIES;
  if (normalized.startsWith(ROUTES.SUPERADMIN.SECURITY_SSO)) return AppView.SUPERADMIN_SSO;
  if (normalized.startsWith(ROUTES.SUPERADMIN.SECURITY)) return AppView.SUPERADMIN_SECURITY;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CONFIGURATION_WHITELABEL))
    return AppView.SUPERADMIN_WHITELABEL;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CONFIGURATION_SETTINGS))
    return AppView.SUPERADMIN_SETTINGS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.CONFIGURATION))
    return AppView.SUPERADMIN_CONFIGURATION;
  if (normalized.startsWith(ROUTES.SUPERADMIN.REVENUE)) return AppView.SUPERADMIN_REVENUE;
  if (normalized.startsWith(ROUTES.SUPERADMIN.ANALYTICS)) return AppView.SUPERADMIN_ANALYTICS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.VIRTUAL_WORKERS))
    return AppView.SUPERADMIN_VIRTUAL_WORKERS;
  if (normalized.startsWith(ROUTES.SUPERADMIN.ROOT)) return AppView.SUPERADMIN_CUSTOMERS;
  if (normalized.startsWith(ROUTES.ASSESSMENT.ROOT)) return AppView.ASSESSMENT_OVERVIEW;
  if (normalized.startsWith(ROUTES.DISCOVERY_TOOLS.ROOT)) return AppView.DISCOVERY_TOOLS;
  if (normalized.startsWith(ROUTES.CONTEXT_BUILDER.ROOT)) return AppView.CONTEXT_BUILDER;
  if (normalized.startsWith(ROUTES.ORGANIZATION.ROOT)) return AppView.ORGANIZATION_PROFILE;
  if (normalized.startsWith(ROUTES.FINANCE) || normalized.startsWith(ROUTES.ECONOMICS)) {
    return AppView.ECONOMICS;
  }

  // Reports module: /reports (entry), /reports/builder, /reports/management
  if (normalized.startsWith(ROUTES.REPORTS.ROOT)) {
    if (normalized === ROUTES.REPORTS.ROOT) return AppView.REPORTS_ENTRY;
    if (normalized.startsWith(ROUTES.REPORTS.MANAGEMENT)) return AppView.REPORTS_MANAGEMENT;
    return AppView.FULL_STEP6_REPORTS; // builder or builder/:id
  }

  // Document module (canonical Document Studio + legacy /wordy alias).
  // Both resolve to the WORDY view so the "Documents" sidebar entry
  // highlights on /document-studio and /document-studio/:artifactId.
  if (normalized.startsWith(ROUTES.DOCUMENT_STUDIO)) return AppView.WORDY;
  if (normalized.startsWith(ROUTES.WORDY)) return AppView.WORDY;
  // KIMI-style workspaces
  // Excel = osobne narzędzie obliczeniowe (decyzja Piotra 2026-07-22) — za flagą
  // klasyfikuje się jako własny AppView.EXCELE (podświetla wpis „Excel" w
  // sidebarze, własny breadcrumb). Flaga OFF → zachowanie bajt-identyczne
  // (klasyfikacja jako TABELE, jak dotąd); AppRoutes i tak redirectuje /excele→
  // /tabele przy OFF, więc zero regresji.
  if (normalized.startsWith(ROUTES.EXCELE))
    return isExceleEngineEnabled() ? AppView.EXCELE : AppView.TABELE;
  if (normalized.startsWith(ROUTES.PREZENTACJE_GEN)) return AppView.PREZENTACJE_GEN;
  if (normalized.startsWith(ROUTES.TABELE)) return AppView.TABELE;

  // Meeting & MCP
  if (normalized.startsWith(ROUTES.MEETING)) return AppView.MEETING;
  if (normalized.startsWith(ROUTES.MCP_IRIS)) return AppView.MCP_IRIS_COMING_SOON;
  if (normalized.startsWith(ROUTES.MCP_MARKETPLACE)) return AppView.MCP_MARKETPLACE_COMING_SOON;

  // Outputs library and nested presentation flows stay under one visible module.
  if (normalized.startsWith(ROUTES.PRESENTATIONS)) {
    return AppView.PRESENTATIONS;
  }

  return null;
}

/**
 * Validates that all AppView enum values have corresponding route mappings
 * Call this during development to catch missing mappings early
 */
export function validateRouteCompleteness(): { valid: boolean; missing: string[] } {
  const allViews = Object.values(AppView);
  const mappedViews = Object.keys(APP_VIEW_TO_ROUTE);

  const missing = allViews.filter((view) => !mappedViews.includes(view));

  if (missing.length > 0) {
    console.error('[routeConfig] VALIDATION ERROR: Missing route mappings for views:', missing);
  } else {
    console.log('[routeConfig] Route validation passed: All AppView values have mappings');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Run validation in development mode
if (process.env.NODE_ENV === 'development') {
  // Defer validation to avoid blocking initial load
  setTimeout(() => {
    validateRouteCompleteness();
  }, 1000);
}
