import type {
  AIPreferences,
  AIProjectRole,
  ChatCitation,
  ChatOption,
  ChatResponseAction,
  OrgAISettings,
  SuperAdminAISettings,
  ToolCallInfo,
  UserAISettings,
} from './domain/ai';

export interface Invoice {
  id: string;
  created_at: string;
  amount_paid: number;
  status: string;
  currency?: string;
  downloadUrl?: string;
}

export enum AppView {
  AI_CHAT = 'AI_CHAT', // Main welcome screen with AI Chat
  AI_CHAT_V10_RUNTIME = 'AI_CHAT_V10_RUNTIME', // AI Chat v10 runtime route alias
  APP_INTRO = 'APP_INTRO', // In-app orientation screen
  INTERVIEW = 'INTERVIEW', // AI Interview - structured knowledge gathering (was Project Intelligence)
  DISCOVERY_CONSULTANT = 'DISCOVERY_CONSULTANT', // AI Discovery with Canvas (legacy alias for INTERVIEW)

  // Discovery Tools Module - 31 AI-powered strategic/operational/digital tools
  DISCOVERY_TOOLS = 'DISCOVERY_TOOLS', // Discovery Tools landing page
  DISCOVERY_TOOLS_STRATEGIC = 'DISCOVERY_TOOLS_STRATEGIC', // Strategic Analysis tools (1-10)
  DISCOVERY_TOOLS_OPERATIONAL = 'DISCOVERY_TOOLS_OPERATIONAL', // Operational Excellence tools (11-20)
  DISCOVERY_TOOLS_DIGITAL = 'DISCOVERY_TOOLS_DIGITAL', // Digital Transformation tools (21-30)
  DISCOVERY_TOOLS_PROCESS_AUTOMATION = 'DISCOVERY_TOOLS_PROCESS_AUTOMATION', // Process Automation by AI (31)

  WELCOME = 'WELCOME',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  USER_DASHBOARD = 'USER_DASHBOARD',
  DASHBOARD_OVERVIEW = 'DASHBOARD_OVERVIEW',
  DASHBOARD_SNAPSHOT = 'DASHBOARD_SNAPSHOT',

  // Quick Assessment
  QUICK_STEP1_PROFILE = 'QUICK_STEP1_PROFILE',
  QUICK_STEP2_USER_CONTEXT = 'QUICK_STEP2_USER_CONTEXT',
  QUICK_STEP3_EXPECTATIONS = 'QUICK_STEP3_EXPECTATIONS',
  TRIAL_ENTRY = 'TRIAL_ENTRY', // Phase C: Controlled Trial Selection

  // Full Transformation Views
  ONBOARDING_WIZARD = 'ONBOARDING_WIZARD', // Phase E: Guided First Value
  ORG_SETUP_WIZARD = 'ORG_SETUP_WIZARD', // Phase D: Organization Setup
  FULL_STEP1_CONTEXT = 'FULL_STEP1_CONTEXT', // NEW: Senior Consultant Context Gathering
  FULL_STEP1_ASSESSMENT = 'FULL_STEP1_ASSESSMENT', // Parent (legacy)

  // Assessment views (Multi-framework)
  ASSESSMENT_OVERVIEW = 'ASSESSMENT_OVERVIEW', // Assessment landing page
  ASSESSMENT_DRD = 'ASSESSMENT_DRD', // DRD with axis selector
  ASSESSMENT_SIRI = 'ASSESSMENT_SIRI', // SIRI framework
  ASSESSMENT_ADMA = 'ASSESSMENT_ADMA', // ADMA framework
  ASSESSMENT_CMMI = 'ASSESSMENT_CMMI', // CMMI-DMM framework
  ASSESSMENT_LEAN = 'ASSESSMENT_LEAN', // Lean 4.0 (RapidLean)
  ASSESSMENT_DIGITAL_EXTERNAL = 'ASSESSMENT_DIGITAL_EXTERNAL', // Legacy - kept for backward compat
  ASSESSMENT_LEAN_EXTERNAL = 'ASSESSMENT_LEAN_EXTERNAL', // Legacy - kept for backward compat
  ASSESSMENT_OTHER = 'ASSESSMENT_OTHER', // Other assessments
  ASSESSMENT_SUMMARY = 'ASSESSMENT_SUMMARY', // Assessment Hub dashboard
  ASSESSMENT_AUDITS = 'ASSESSMENT_AUDITS', // Generic reports/audits
  MY_ASSESSMENTS = 'MY_ASSESSMENTS', // User's assessments list
  REVIEWER_DASHBOARD = 'REVIEWER_DASHBOARD', // Reviewer pending reviews
  ASSESSMENT_DASHBOARD = 'ASSESSMENT_DASHBOARD', // Assessment module dashboard
  GAP_MAP = 'GAP_MAP', // Gap analysis dashboard
  ASSESSMENT_REPORTS = 'ASSESSMENT_REPORTS', // Assessment reports archive
  INITIATIVE_GENERATOR = 'INITIATIVE_GENERATOR', // Initiative generator wizard

  // DRD Axis Views (kept for backward compatibility)
  FULL_STEP1_PROCESSES = 'FULL_STEP1_PROCESSES',
  FULL_STEP1_DIGITAL = 'FULL_STEP1_DIGITAL',
  FULL_STEP1_MODELS = 'FULL_STEP1_MODELS',
  FULL_STEP1_DATA = 'FULL_STEP1_DATA',
  FULL_STEP1_CULTURE = 'FULL_STEP1_CULTURE',
  FULL_STEP1_CYBERSECURITY = 'FULL_STEP1_CYBERSECURITY',
  FULL_STEP1_AI = 'FULL_STEP1_AI',

  FULL_STEP2_INITIATIVES = 'FULL_STEP2_INITIATIVES',
  FULL_STEP3_ROADMAP = 'FULL_STEP3_ROADMAP',
  FULL_STEP4_ROI = 'FULL_STEP4_ROI',
  ECONOMICS = 'ECONOMICS', // Module: Economics & Value Realization (Digitization Maturity)
  FULL_STEP5_EXECUTION = 'FULL_STEP5_EXECUTION', // Keeping for backward compat
  IMPLEMENTATION = 'IMPLEMENTATION', // Module 4: Wdrożenie
  FULL_PILOT_EXECUTION = 'FULL_PILOT_EXECUTION', // @deprecated - alias for IMPLEMENTATION
  FULL_ROLLOUT = 'FULL_ROLLOUT', // Module 5
  FULL_STEP6_REPORTS = 'FULL_STEP6_REPORTS', // Report Builder (deliverable reports)
  REPORTS_ENTRY = 'REPORTS_ENTRY', // Reports landing /reports (entry router)
  REPORTS_MANAGEMENT = 'REPORTS_MANAGEMENT', // Management Reports (PMO)
  DRD_AUDIT_REPORT = 'DRD_AUDIT_REPORT', // DRD Audit Report Builder
  PRESENTATIONS = 'PRESENTATIONS', // Presentations library
  MEETING = 'MEETING', // Meeting workspace
  WORDY = 'WORDY', // KIMI-style document generation workspace (P22)
  EXCELE = 'EXCELE', // Legacy spreadsheet alias; canonical route/module is TABELE.
  PREZENTACJE_GEN = 'PREZENTACJE_GEN', // Gamma-style presentation generation workspace (P20)
  TABELE = 'TABELE', // KIMI-style operational-table workspace (Table Studio Foundation block — sky accent)
  KPI_OKR_DASHBOARD = 'KPI_OKR_DASHBOARD', // Module: KPI/OKR post-implementation tracking

  MASTERCLASS = 'MASTERCLASS',
  RESOURCES = 'RESOURCES',

  PARTNER_LANDING = 'PARTNER_LANDING',
  PARTNER_PRICING = 'PARTNER_PRICING',
  APP_PRICING = 'APP_PRICING',
  PARTNER_PROVIDER_HOME = 'PARTNER_PROVIDER_HOME',
  PARTNER_DASHBOARD = 'PARTNER_DASHBOARD',
  PARTNER_CLIENT_ACCESS = 'PARTNER_CLIENT_ACCESS',
  PARTNER_COMMISSION = 'PARTNER_COMMISSION',
  PARTNER_DIRECTORY = 'PARTNER_DIRECTORY',
  PARTNER_RESOURCES = 'PARTNER_RESOURCES',

  // Legacy/Fallback
  FREE_ASSESSMENT_CHAT = 'FREE_ASSESSMENT_CHAT',
  FULL_TRANSFORMATION_CHAT = 'FULL_TRANSFORMATION_CHAT',

  // SaaS / Admin
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_PROJECTS = 'ADMIN_PROJECTS',
  ADMIN_LLM = 'ADMIN_LLM',
  ADMIN_AI_HEALTH = 'ADMIN_AI_HEALTH',
  ADMIN_KNOWLEDGE = 'ADMIN_KNOWLEDGE',
  ADMIN_TEAMS = 'ADMIN_TEAMS',
  ADMIN_ANALYTICS = 'ADMIN_ANALYTICS',
  ADMIN_FEEDBACK = 'ADMIN_FEEDBACK',
  ADMIN_METRICS = 'ADMIN_METRICS',
  SETTINGS_PROFILE = 'SETTINGS_PROFILE',
  SETTINGS_BILLING = 'SETTINGS_BILLING',
  SETTINGS_AI = 'SETTINGS_AI',
  SETTINGS_NOTIFICATIONS = 'SETTINGS_NOTIFICATIONS',
  SETTINGS_INTEGRATIONS = 'SETTINGS_INTEGRATIONS',
  SETTINGS_REGIONALIZATION = 'SETTINGS_REGIONALIZATION',
  SETTINGS_ORGANIZATION = 'SETTINGS_ORGANIZATION', // NEW
  SETTINGS_MFA = 'SETTINGS_MFA',
  SETTINGS_ACTIVE_SESSIONS = 'SETTINGS_ACTIVE_SESSIONS',
  SETTINGS_LOGIN_HISTORY = 'SETTINGS_LOGIN_HISTORY',
  SETTINGS_DATA_CONTROLS = 'SETTINGS_DATA_CONTROLS',

  SETTINGS_API_KEYS = 'SETTINGS_API_KEYS', // Unique value for settings context
  SETTINGS_WEBHOOKS = 'SETTINGS_WEBHOOKS',
  SETTINGS_CALENDAR_SYNC = 'SETTINGS_CALENDAR_SYNC',
  SETTINGS_APPEARANCE = 'SETTINGS_APPEARANCE',
  SETTINGS_AI_MEMORY = 'SETTINGS_AI_MEMORY',
  SETTINGS_AI_RESPONSE_STYLE = 'SETTINGS_AI_RESPONSE_STYLE',
  SETTINGS_AI_CHAT_HISTORY = 'SETTINGS_AI_CHAT_HISTORY',
  SETTINGS_AI_VOICE = 'SETTINGS_AI_VOICE',

  // Context Builder (Renamed directly or used as parent)
  CONTEXT_BUILDER = 'CONTEXT_BUILDER',
  CONTEXT_BUILDER_PROFILE = 'CONTEXT_BUILDER_PROFILE',
  CONTEXT_BUILDER_GOALS = 'CONTEXT_BUILDER_GOALS',
  CONTEXT_BUILDER_CHALLENGES = 'CONTEXT_BUILDER_CHALLENGES',
  CONTEXT_BUILDER_MEGATRENDS = 'CONTEXT_BUILDER_MEGATRENDS',
  CONTEXT_BUILDER_STRATEGY = 'CONTEXT_BUILDER_STRATEGY',

  // Organization (Settings-like internal navigation)
  ORGANIZATION_PROFILE = 'ORGANIZATION_PROFILE',

  // Teamwork Views
  MY_WORK = 'MY_WORK', // New Module 7 (Tasks & Workflow)
  PROJECT_INTELLIGENCE = 'PROJECT_INTELLIGENCE', // AI-powered project knowledge capture
  PROJECTS = 'PROJECTS', // Zwornik (#78): project stakeholder registry + finance rollup
  CLIENT_VAULT = 'CLIENT_VAULT', // HP-22 Harvey-Parity: org-scoped client document vault (gated, ff.client_vault)
  AGENT_PLAN = 'AGENT_PLAN', // HP-4 F3 Harvey-Parity: run-agent workspace entry (gated, ff.agent_plan)

  // Initiative Lifecycle Management
  INITIATIVE_MANAGEMENT = 'INITIATIVE_MANAGEMENT', // @deprecated - use PORTFOLIO_ROADMAP
  PORTFOLIO_ROADMAP = 'PORTFOLIO_ROADMAP', // Unified Portfolio & Roadmap view (replaces INITIATIVE_MANAGEMENT + FULL_STEP3_ROADMAP)
  BENEFITS_REALIZATION = 'BENEFITS_REALIZATION', // DONE, BLOCKED, CANCELLED, ARCHIVED + KPIs
  CONCLUSIONS = 'CONCLUSIONS', // Conclusions layer — governed conclusions (verdict/rationale/evidence) + readout
  MCP_IRIS_COMING_SOON = 'MCP_IRIS_COMING_SOON',
  MCP_MARKETPLACE_COMING_SOON = 'MCP_MARKETPLACE_COMING_SOON',

  // Step D: Executive View (Read-only reporting for executives)
  EXECUTIVE_VIEW = 'EXECUTIVE_VIEW',

  // AI Action Proposals Review
  AI_ACTION_PROPOSALS = 'AI_ACTION_PROPOSALS',
  AI_OS_HOME = 'AI_OS_HOME',
  AI_OS_WORK_CANVAS = 'AI_OS_WORK_CANVAS',
  AI_OS_ACTION_CENTER = 'AI_OS_ACTION_CENTER',
  AI_OS_RESEARCH = 'AI_OS_RESEARCH',
  AI_OS_ARTIFACTS = 'AI_OS_ARTIFACTS',
  AI_OS_CONTEXT_MEMORY = 'AI_OS_CONTEXT_MEMORY',
  AI_OS_CONNECTORS = 'AI_OS_CONNECTORS',
  AI_OS_AGENTS = 'AI_OS_AGENTS',
  AI_OS_OUTCOMES = 'AI_OS_OUTCOMES',

  // Consultify Studio - Visual AI Workspace
  STUDIO = 'STUDIO',

  // Consultant Views
  CONSULTANT_PANEL = 'CONSULTANT_PANEL',
  CONSULTANT_INVITES = 'CONSULTANT_INVITES',

  // Step 13: Visual Playbook Editor
  SUPERADMIN_PLAYBOOK_TEMPLATES = 'SUPERADMIN_PLAYBOOK_TEMPLATES',
  SUPERADMIN_PLAYBOOK_EDITOR = 'SUPERADMIN_PLAYBOOK_EDITOR',
  ADMIN_PLAYBOOK_RUNS = 'ADMIN_PLAYBOOK_RUNS',

  // Org Admin Consultant Views
  ADMIN_SETTINGS_CONSULTANTS = 'ADMIN_SETTINGS_CONSULTANTS',
  ADMIN_INVITATIONS = 'ADMIN_INVITATIONS',
  ADMIN_TOKEN_MANAGEMENT = 'ADMIN_TOKEN_MANAGEMENT',

  // SuperAdmin Module Views (New modular structure)
  SUPERADMIN_OVERVIEW = 'SUPERADMIN_OVERVIEW',
  SUPERADMIN_CUSTOMERS = 'SUPERADMIN_CUSTOMERS',
  SUPERADMIN_AI_PLATFORM = 'SUPERADMIN_AI_PLATFORM', // Legacy - kept for backward compatibility
  // AI Platform - Variant A (3 Modules)
  SUPERADMIN_AI_INFRASTRUCTURE = 'SUPERADMIN_AI_INFRASTRUCTURE', // LLM Providers, Tiers, Settings, Health
  SUPERADMIN_AI_DEVELOPMENT = 'SUPERADMIN_AI_DEVELOPMENT', // Prompts, Intelligence, Experiments, Knowledge
  SUPERADMIN_AI_OPERATIONS = 'SUPERADMIN_AI_OPERATIONS', // Mission Control, Performance, Costs, SLA, Analytics
  SUPERADMIN_SYSTEM = 'SUPERADMIN_SYSTEM',
  SUPERADMIN_CONTENT = 'SUPERADMIN_CONTENT',
  SUPERADMIN_REVENUE = 'SUPERADMIN_REVENUE',
  SUPERADMIN_SECURITY = 'SUPERADMIN_SECURITY',
  SUPERADMIN_CONFIGURATION = 'SUPERADMIN_CONFIGURATION',
  SUPERADMIN_ANALYTICS = 'SUPERADMIN_ANALYTICS', // Custom Dashboards, Reports, Metrics, Predictive
  SUPERADMIN_VIRTUAL_WORKERS = 'SUPERADMIN_VIRTUAL_WORKERS', // Virtual Workers (Anna, Teresa, etc.)

  // SuperAdmin Legacy Views (kept for backward compatibility - used as tab identifiers)
  SUPERADMIN_DASHBOARD = 'SUPERADMIN_DASHBOARD',
  SUPERADMIN_ORGANIZATIONS = 'SUPERADMIN_ORGANIZATIONS',
  SUPERADMIN_USERS = 'SUPERADMIN_USERS',
  SUPERADMIN_BILLING = 'SUPERADMIN_BILLING',
  SUPERADMIN_AI_CONFIG = 'SUPERADMIN_AI_CONFIG',
  SUPERADMIN_LLM_MANAGEMENT = 'SUPERADMIN_LLM_MANAGEMENT',
  SUPERADMIN_AI_INTELLIGENCE = 'SUPERADMIN_AI_INTELLIGENCE',
  SUPERADMIN_KNOWLEDGE = 'SUPERADMIN_KNOWLEDGE',
  SUPERADMIN_SETTINGS = 'SUPERADMIN_SETTINGS',

  // SuperAdmin Enterprise Views (used as tab identifiers)
  SUPERADMIN_SSO = 'SUPERADMIN_SSO',
  SUPERADMIN_SECURITY_POLICIES = 'SUPERADMIN_SECURITY_POLICIES',
  SUPERADMIN_API_MANAGEMENT = 'SUPERADMIN_API_MANAGEMENT',
  SUPERADMIN_WHITELABEL = 'SUPERADMIN_WHITELABEL',
  SUPERADMIN_COMPLIANCE = 'SUPERADMIN_COMPLIANCE',
  SUPERADMIN_INVOICES = 'SUPERADMIN_INVOICES',
  SUPERADMIN_FEEDBACK = 'SUPERADMIN_FEEDBACK',
  SUPERADMIN_COMMUNICATION = 'SUPERADMIN_COMMUNICATION',
  SUPERADMIN_BULK_OPERATIONS = 'SUPERADMIN_BULK_OPERATIONS',

  // Admin Module Views (7-module structure - Best practices from ClickUp/HubSpot/Replit)
  ADMIN_OVERVIEW = 'ADMIN_OVERVIEW', // Dashboard, Metrics, Analytics
  ADMIN_ORGANIZATION = 'ADMIN_ORGANIZATION', // Profile, Branding, Ownership
  ADMIN_ORGANIZATION_SETTINGS = 'ADMIN_ORGANIZATION_SETTINGS',
  ADMIN_TEAM = 'ADMIN_TEAM', // Users, Groups, Invitations, Roles
  ADMIN_WORKSPACE = 'ADMIN_WORKSPACE', // Projects, Knowledge, Playbooks
  ADMIN_PROJECT_DETAILS = 'ADMIN_PROJECT_DETAILS', // Specific project management
  ADMIN_AI = 'ADMIN_AI', // LLM, Health, Analytics, Tokens
  ADMIN_BILLING = 'ADMIN_BILLING', // Plans, Payments, Invoices, Alerts
  ADMIN_SECURITY = 'ADMIN_SECURITY', // Auth, Access, Audit, Data
  ADMIN_SETTINGS = 'ADMIN_SETTINGS', // Legacy - redirects to ADMIN_SECURITY

  // Admin Enterprise Views (legacy - used as tab identifiers)

  ADMIN_API_KEYS = 'ADMIN_API_KEYS',
  ADMIN_BILLING_MANAGEMENT = 'ADMIN_BILLING_MANAGEMENT',
  ADMIN_BULK_OPERATIONS = 'ADMIN_BULK_OPERATIONS',
  ADMIN_WORK_MODE = 'ADMIN_WORK_MODE',

  // Settings Enterprise Views
  SETTINGS_SECURITY = 'SETTINGS_SECURITY',
  SETTINGS_API_ACCESS = 'SETTINGS_API_ACCESS',
  SETTINGS_PRIVACY = 'SETTINGS_PRIVACY',
  SETTINGS_SSO = 'SETTINGS_SSO',

  // Settings (additional)
  SETTINGS_LEGAL = 'SETTINGS_LEGAL',

  // Extended User Settings
  SETTINGS_WORK_PREFERENCES = 'SETTINGS_WORK_PREFERENCES',
  SETTINGS_DASHBOARD_PREFERENCES = 'SETTINGS_DASHBOARD_PREFERENCES',
  SETTINGS_ACCESSIBILITY = 'SETTINGS_ACCESSIBILITY',

  // Settings Module Views (6-module structure)
  SETTINGS_PROFILE_MODULE = 'SETTINGS_PROFILE_MODULE',
  SETTINGS_AI_MODULE = 'SETTINGS_AI_MODULE',
  SETTINGS_NOTIFICATIONS_MODULE = 'SETTINGS_NOTIFICATIONS_MODULE',
  SETTINGS_SECURITY_MODULE = 'SETTINGS_SECURITY_MODULE',
  SETTINGS_INTEGRATIONS_MODULE = 'SETTINGS_INTEGRATIONS_MODULE',
  SETTINGS_APPEARANCE_MODULE = 'SETTINGS_APPEARANCE_MODULE',

  // Help & Documentation
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE',
  KNOWLEDGE_BASE_ARTICLE = 'KNOWLEDGE_BASE_ARTICLE',
  STATUS_PAGE = 'STATUS_PAGE',
  CHANGELOG = 'CHANGELOG',
  HELP_ANALYTICS = 'HELP_ANALYTICS',
}

// SCMS: Canonical Change Lifecycle Phases (System Reframe Step 0)
export enum SCMSPhase {
  PHASE_1_CONTEXT = 'Context', // AppView.FULL_STEP1_CONTEXT
  PHASE_2_ASSESSMENT = 'Assessment', // AppView.FULL_STEP1_ASSESSMENT
  PHASE_3_INITIATIVES = 'Initiatives', // AppView.FULL_STEP2_INITIATIVES
  PHASE_4_ROADMAP = 'Roadmap', // AppView.FULL_STEP3_ROADMAP
  PHASE_5_EXECUTION = 'Execution', // AppView.FULL_STEP5_EXECUTION + FULL_PILOT_EXECUTION
  PHASE_6_STABILIZATION = 'Stabilization', // AppView.FULL_ROLLOUT + FULL_STEP6_REPORTS
}

export enum SessionMode {
  FREE = 'FREE',
  FULL = 'FULL',
  DEMO = 'DEMO', // Phase B: Read-only demo experience
}

export enum AuthStep {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  CODE_ENTRY = 'CODE_ENTRY',
}

// SCMS: Canonical Roles (Step 1)
/**
 * UserRole (Account Type) - Organization-level access control
 *
 * These determine what users can do across the ENTIRE ORGANIZATION.
 * For project-level roles (PM, Team Lead, etc.), see ProjectRole enum below.
 *
 * Account Types:
 * - OWNER: Special administrator — all ADMIN functions PLUS billing, ownership transfer, deletion.
 *          Must have Admin Panel, users, projects, settings, AI config, etc. (same as ADMIN).
 * - ADMIN: Administrator - full access except billing (users, projects, settings, Admin Panel).
 * - USER: Standard user - works in assigned projects only.
 *
 * Note: CONSULTANT is deprecated as a separate account type.
 *       Consultants should have USER account type + CONSULTANT project role.
 */
export enum UserRole {
  // Platform Level (DBR77 internal)
  SUPERADMIN = 'SUPERADMIN', // DBR77 Platform Owner - manages all tenants

  // Organization Level (Account Types)
  OWNER = 'OWNER', // Special admin: ADMIN + billing, ownership transfer, deletion
  ADMIN = 'ADMIN', // Organization Admin - users, projects, settings
  USER = 'USER', // Standard User - project access only

  // Legacy roles - kept for backward compatibility, map to USER internally
  PROJECT_MANAGER = 'PROJECT_MANAGER', // @deprecated - use ProjectRole.PROJECT_MANAGER
  TEAM_MEMBER = 'TEAM_MEMBER', // @deprecated - use ProjectRole.TEAM_MEMBER
  VIEWER = 'VIEWER', // @deprecated - use ProjectRole.STAKEHOLDER
  CEO = 'CEO', // @deprecated - use OWNER or ADMIN
  MANAGER = 'MANAGER', // @deprecated - use ADMIN
  CONSULTANT = 'CONSULTANT', // @deprecated - use USER + ProjectRole.CONSULTANT
  GUEST = 'GUEST', // @deprecated - use USER + limited project access
  OTHER = 'OTHER', // @deprecated - use USER
}

/**
 * ProjectRole - Project-level access control (PRINCE2/PMBOK aligned)
 *
 * These determine what users can do within SPECIFIC PROJECTS.
 * Users must have a UserRole (Account Type) + ProjectRole for each project.
 *
 * Hierarchy:
 * Level 0: PROJECT_EXECUTIVE - Strategic decisions, budget approval
 * Level 1: PROJECT_MANAGER - Day-to-day management
 * Level 2: TEAM_LEAD - Team/technical leadership
 * Level 3: TEAM_MEMBER - Task execution
 * Level 3: CONSULTANT - External advisor (free seat with access code)
 * Level 4: STAKEHOLDER - Observer, read-only
 */
export enum ProjectRole {
  PROJECT_EXECUTIVE = 'PROJECT_EXECUTIVE', // Sponsor, ultimate authority
  PROJECT_MANAGER = 'PROJECT_MANAGER', // Day-to-day management
  TEAM_LEAD = 'TEAM_LEAD', // Technical/functional lead
  TEAM_MEMBER = 'TEAM_MEMBER', // Standard project member
  CONSULTANT = 'CONSULTANT', // External advisor (free seat)
  STAKEHOLDER = 'STAKEHOLDER', // Observer, read-only
  OBSERVER = 'OBSERVER', // Read-only observer
  TASK_ASSIGNEE = 'TASK_ASSIGNEE', // Task assignee
  SPONSOR = 'SPONSOR',
  DECISION_OWNER = 'DECISION_OWNER',
  PMO_LEAD = 'PMO_LEAD',
  WORKSTREAM_OWNER = 'WORKSTREAM_OWNER',
  INITIATIVE_OWNER = 'INITIATIVE_OWNER',
  SME = 'SME', // Subject Matter Expert
  REVIEWER = 'REVIEWER',
}

// ============================================
// TYPE ALIASES FOR TERMINOLOGY CLARITY
// ============================================

/**
 * AccountType - Alias for UserRole
 * Use this when referring to organization-level user types (OWNER, ADMIN, USER)
 */
export type AccountType = UserRole;
export const AccountType = UserRole;

/**
 * PROJECT_ROLES - List of valid project roles for UI dropdowns
 */
export const PROJECT_ROLES = [
  { id: ProjectRole.PROJECT_EXECUTIVE, name: 'Project Executive / Sponsor', level: 0 },
  { id: ProjectRole.PROJECT_MANAGER, name: 'Project Manager', level: 1 },
  { id: ProjectRole.TEAM_LEAD, name: 'Team Lead', level: 2 },
  { id: ProjectRole.TEAM_MEMBER, name: 'Team Member', level: 3 },
  { id: ProjectRole.CONSULTANT, name: 'Consultant', level: 3 },
  { id: ProjectRole.STAKEHOLDER, name: 'Stakeholder / Viewer', level: 4 },
] as const;

/**
 * ACCOUNT_TYPES - List of valid account types for UI dropdowns
 */
export const ACCOUNT_TYPES = [
  { id: UserRole.OWNER, name: 'Owner', description: 'Full organization control including billing' },
  { id: UserRole.ADMIN, name: 'Admin', description: 'Manage users, projects, and settings' },
  { id: UserRole.USER, name: 'User', description: 'Access assigned projects only' },
] as const;

// Organization Ownership Status
export type OwnershipStatus = 'ACTIVE' | 'PENDING_TRANSFER' | 'SUSPENDED';

// Organization Profile & Ownership (Billing Admin)
export interface OrganizationOwnership {
  id: string;
  organizationId: string;
  ownerUserId: string;
  billingEmail: string;
  billingName?: string;
  taxId?: string;
  vatNumber?: string;
  billingAddress?: BillingAddress;
  status: OwnershipStatus;
  transferredFromUserId?: string;
  transferredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Billing Address Structure
export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

// Organization Profile (Branding & Settings)
export interface OrganizationProfile {
  id: string;
  organizationId: string;
  // Branding
  logoUrl?: string;
  faviconUrl?: string;
  brandColor?: string;
  accentColor?: string;
  description?: string;
  industry?: string;
  companySize?: CompanySize;
  website?: string;
  // Custom Domain
  customDomain?: string;
  customDomainVerified?: boolean;
  customDomainVerifiedAt?: string;
  // Regional Settings
  defaultTimezone?: string;
  defaultLanguage?: string;
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat?: '12h' | '24h';
  currency?: string;
  // Social
  linkedinUrl?: string;
  twitterUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Company Size Options
export type CompanySize =
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-500'
  | '501-1000'
  | '1001-5000'
  | '5000+';

// User Group (Team within Organization)
export interface UserGroup {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  leaderId?: string;
  memberIds: string[];
  permissions: GroupPermission[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Group-level permissions
export interface GroupPermission {
  resource: 'projects' | 'initiatives' | 'tasks' | 'decisions' | 'knowledge' | 'analytics' | 'ai';
  actions: ('create' | 'read' | 'update' | 'delete' | 'manage')[];
  scope?: 'all' | 'own' | 'group';
}

// Custom Role Definition
export interface CustomRole {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  baseRole: UserRole;
  permissions: RolePermission[];
  isSystemRole: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Permission entry for custom roles
export interface RolePermission {
  resource: string;
  action: string;
  allowed: boolean;
  conditions?: Record<string, any>;
}

// API Key for integrations
export interface ApiKey {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  keyPrefix: string; // First 8 chars for identification
  keyHash: string; // Hashed full key
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdBy: string;
  createdAt: string;
  revokedAt?: string;
}

// Ownership Transfer Request
export interface OwnershipTransferRequest {
  id: string;
  organizationId: string;
  fromUserId: string;
  toUserId: string;
  toEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  requestedAt: string;
  respondedAt?: string;
  expiresAt: string;
  reason?: string;
}

// Organization Deletion Request
export interface OrganizationDeletionRequest {
  id: string;
  organizationId: string;
  requestedBy: string;
  reason?: string;
  scheduledAt: string; // 30 days grace period
  status: 'PENDING' | 'CANCELLED' | 'COMPLETED';
  createdAt: string;
  completedAt?: string;
}

// Announcement (Organization-wide communication)
export interface Announcement {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'CRITICAL';
  targetAudience: 'ALL' | 'ADMINS' | 'MANAGERS' | 'SPECIFIC_GROUPS';
  targetGroupIds?: string[];
  publishedAt?: string;
  expiresAt?: string;
  isPinned: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Spending Alert Configuration
export interface SpendingAlert {
  id: string;
  organizationId: string;
  type: 'AI_TOKENS' | 'STORAGE' | 'USERS' | 'TOTAL_SPEND';
  threshold: number;
  thresholdType: 'PERCENTAGE' | 'ABSOLUTE';
  action: 'NOTIFY' | 'NOTIFY_AND_PAUSE' | 'HARD_LIMIT';
  notifyEmails: string[];
  isActive: boolean;
  triggeredAt?: string;
  createdAt: string;
}

// SCMS: System Capabilities (Permissions)
export type Capability =
  // Owner-Only Scope (Billing Admin)
  | 'transfer_ownership' // Transfer org ownership to another user
  | 'delete_organization' // Delete entire organization (30-day grace)
  | 'manage_payment_methods' // Add/remove payment methods

  // Tenant Admin Scope
  | 'manage_users'
  | 'manage_roles'
  | 'manage_custom_roles' // Create/edit custom roles
  | 'manage_billing'
  | 'manage_org_settings'
  | 'manage_org_profile' // Logo, branding, etc.
  | 'manage_ai_policy'
  | 'manage_api_keys' // Create/revoke API keys
  | 'manage_user_groups' // Create/manage user groups
  | 'view_all_users'
  | 'export_data' // GDPR export

  // Project Governance Scope
  | 'create_project'
  | 'edit_project_settings'
  | 'manage_project_roles'
  | 'manage_workstreams'
  | 'approve_changes' // CR Approval
  | 'manage_stage_gates' // Phase Transitions
  | 'view_audit_log'

  // Execution Scope
  | 'create_initiative'
  | 'edit_initiative'
  | 'manage_roadmap'
  | 'assign_tasks'
  | 'update_task_status'
  | 'manage_risks'

  // AI Scope
  | 'ai_execute_actions' // "Auto" mode
  | 'ai_view_insights'

  // Communication Scope
  | 'create_announcements' // Post org-wide announcements
  | 'manage_notifications' // Configure notification settings
  | 'invite_guests'; // Invite external guests

// Governance: Change Request Status
export type ChangeRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';

// Governance: Change Request Type
export type ChangeRequestType = 'SCOPE' | 'SCHEDULE' | 'BUDGET' | 'GOVERNANCE' | 'RESOURCE';

// Governance: Change Request Entity
export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: ChangeRequestType;
  status: ChangeRequestStatus;

  // Impact Analysis
  impactedObjects: { type: 'initiative' | 'task' | 'milestone'; id: string }[];
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  rationale: string;

  // Workflow
  createdBy: string;
  createdAt: string;
  approvers?: string[]; // List of UserIDs who must approve
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;

  // AI
  aiRecommendedDecision?: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  aiAnalysis?: string;
}

// Governance: Policy Settings (Tenant or Project Level)
export interface GovernancePolicy {
  id: string;
  scopeId: string; // OrgID or ProjectID
  scopeType: 'ORGANIZATION' | 'PROJECT';

  // Rules
  requireChangeRequestFor: ('SCOPE' | 'SCHEDULE' | 'BUDGET')[];
  approvalThresholdCost?: number; // e.g., > $10k requires specific approval

  // AI strictness
  aiMode: 'ADVISORY' | 'ASSISTED' | 'PROACTIVE' | 'AUTOPILOT';
  allowedAiActions: Capability[]; // Which actions AI can take without human loop
}

// ==========================================
// STEP 3: PMO OBJECT MODEL
// ==========================================

// 3.1 STANDARDIZED STATUS ENUMS

/**
 * Initiative Status Lifecycle (ENFORCED)
 *
 * Module Flow:
 * - DRAFT: Created in Assessment Module (Module 2)
 * - PLANNING: Transferred to Initiative Management Module (Module 3)
 * - REVIEW: Pending approval reviews
 * - APPROVED: Ready for execution, transfers to Execution Module (Module 4/5)
 * - EXECUTING: Active work in progress (Execution Module)
 * - BLOCKED: Temporarily blocked (requires reason)
 * - DONE: Successfully completed (Benefits Module)
 * - CANCELLED: Terminated before completion
 * - ARCHIVED: Historical record (post-completion or post-cancellation)
 *
 * Initiative Status Lifecycle (11 statuses - Canonical)
 *
 * Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
 *
 * Lifecycle Flow:
 * DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 *                                                        ↓
 *                                                    BLOCKED
 *
 * Key Module Transitions:
 * - DRAFT → REVIEW: Tools/Assessment → Initiatives (Gate: PROMOTE)
 * - APPROVED → SCHEDULED: Initiatives → Execution (Gate: SCHEDULE)
 * - DONE → TRACKING: Execution → Benefits (Gate: START_TRACKING)
 */
export enum InitiativeStatus {
  // Source modules (Tools/Assessment) - Draft phase
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',

  // Initiative Management Module - Review & Planning phase
  REVIEW = 'REVIEW',
  PROMOTED = 'PROMOTED',
  PLANNING = 'PLANNING',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',

  // Execution Module - Active work
  EXECUTING = 'EXECUTING',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',

  // Benefits Module - Tracking phase
  TRACKING = 'TRACKING',

  // Terminal State
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

/** Task Status Lifecycle (ENFORCED) */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
}

/** Decision Status */
export enum DecisionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
}

/** Dependency Types */
export enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START', // Hard dependency
  SOFT = 'SOFT', // Informational only
}

/** Stage Gate Types */
export enum StageGateType {
  READINESS_GATE = 'READINESS_GATE', // Context → Assessment
  DESIGN_GATE = 'DESIGN_GATE', // Assessment → Initiatives
  PLANNING_GATE = 'PLANNING_GATE', // Initiatives → Roadmap
  EXECUTION_GATE = 'EXECUTION_GATE', // Roadmap → Execution
  CLOSURE_GATE = 'CLOSURE_GATE', // Execution → Stabilization
}

/** Initiative Module Types */
export type InitiativeModule =
  | 'ASSESSMENT'
  | 'INITIATIVE_MANAGEMENT'
  | 'ROADMAP'
  | 'EXECUTION'
  | 'TERMINAL'
  | 'UNKNOWN';

// ============================================
// PORTFOLIO VIEW TYPES
// ============================================

/** Portfolio View Mode - determines which view is active */
export type PortfolioViewMode = 'list' | 'kanban' | 'timeline' | 'matrix';

/** Portfolio Filters - filter state for portfolio view */
export interface PortfolioFilters {
  projectId?: string;
  status?: InitiativeStatus[];
  priority?: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')[];
  owner?: string;
  quarter?: string;
  search?: string;
}

/** Portfolio Sort Configuration */
export interface PortfolioSortConfig {
  field:
    | 'name'
    | 'status'
    | 'priority'
    | 'plannedStartDate'
    | 'plannedEndDate'
    | 'budget'
    | 'progress';
  direction: 'asc' | 'desc';
}

/** Program - V4-INIT-02 hierarchy entity for portfolio management */
export interface Program {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  parentProgramId?: string;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  ownerUserId?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Portfolio Stats - KPIs for portfolio header */
export interface PortfolioStats {
  total: number;
  byStatus: Record<InitiativeStatus, number>;
  totalBudget: number;
  averageProgress: number;
  criticalCount: number;
  blockedCount: number;
}

/** Portfolio Initiative - extended initiative data for portfolio view */
export interface PortfolioInitiative {
  id: string;
  name: string;
  /** Some portfolio reads carry `title` instead of `name`; UI falls back to it. */
  title?: string;
  summary?: string;
  description?: string;
  axis: string;
  status: InitiativeStatus;
  /** V8 planning read: normalized PMO status when raw DB value needed coercion */
  displayStatus?: string;
  p11LifecycleState?: string;
  statusReadDrift?: boolean;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  progress: number;
  budget: number;
  expectedRoi?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  targetQuarter?: string;
  waveId?: string;
  waveName?: string;
  programId?: string;
  programName?: string;
  projectId?: string;
  projectName?: string;
  sourceId?: string;
  sourceType?: string;
  ownerBusiness?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  ownerExecution?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  dependencies?: string[];
  isCriticalPath?: boolean;
  riskScore?: number;
  valueScore?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================

/** Status Transition - allowed transition from current status */
export interface StatusTransition {
  status: InitiativeStatus;
  label: string;
  module: InitiativeModule;
  requiresReason: boolean;
  requiresConfirmation: boolean;
}

/** Status History Entry - audit trail for status changes */
export interface StatusHistoryEntry {
  id: string;
  fromStatus: InitiativeStatus | null;
  toStatus: InitiativeStatus;
  reason?: string;
  context?: {
    charterCompleteness?: number;
    pendingTasks?: number;
    hasBlockingDecisions?: boolean;
  };
  changedAt: string;
  changedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}

/** Module Transition Info */
export interface ModuleTransition {
  crossesModule: boolean;
  fromModule: InitiativeModule;
  toModule: InitiativeModule;
}

/** Initiative Task Stats */
export interface InitiativeTaskStats {
  total: number;
  done: number;
  pending: number;
  blocked: number;
}

export type InitiativeKpiObservationPhase = 'realization' | 'post-implementation' | 'both';
export type InitiativeKpiDefinitionSource = 'library' | 'initiative-custom';
export type InitiativeKpiObservationStatus = 'active' | 'paused' | 'completed';
export type InitiativeKpiMeasurementFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface InitiativeKpiExpectation {
  baselineValue?: number | null;
  targetValue?: number | null;
  measurementFrequency: InitiativeKpiMeasurementFrequency;
}

/** Initiative KPI - Key Performance Indicator */
export interface InitiativeKPI {
  id: string;
  // V3: KPI can be global (no single initiative); relations live in mapping table.
  initiativeId?: string | null;
  mappingId?: string | null;
  name: string;
  description?: string;
  category?: string;
  targetValue: number | null;
  unit?: string;
  measurementFrequency: InitiativeKpiMeasurementFrequency;
  alertThreshold?: number;
  alertDirection: 'BELOW' | 'ABOVE';
  isPrimary: boolean;
  sortOrder: number;
  currentValue?: number | null;
  latestValue?: number | null;
  latestMeasurementDate?: string | null;
  // Optional helper fields for trend calculation (R1).
  prevValue?: number;
  prevMeasurementDate?: string | null;
  isOnTarget: boolean;
  createdAt: string;
  updatedAt?: string;
  /** RES-02: CAS pointer — send back as `expectedVersion` on update. */
  currentDefinitionVersion?: number | null;
  // Optional enrichment used by Results (R0/R1).
  baselineValue?: number | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  thresholdMode?: 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
  amberThresholdPct?: number | null;
  redThresholdPct?: number | null;
  amberThresholdAbs?: number | null;
  redThresholdAbs?: number | null;
  definitionSource?: InitiativeKpiDefinitionSource;
  observationPhase?: InitiativeKpiObservationPhase;
  trackedInRealization?: boolean;
  trackedPostImplementation?: boolean;
  observationStatus?: InitiativeKpiObservationStatus;
  realizationExpectation?: InitiativeKpiExpectation;
  postImplementationExpectation?: InitiativeKpiExpectation;
  target?: number;
  current?: number;
  status?: 'on-target' | 'below' | 'no-data';
  needsEntry?: boolean;
}

/** KPI Measurement - historical value record */
export interface KPIMeasurement {
  id: string;
  kpiId: string;
  value: number;
  measuredAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodKey?: string | null;
  notes?: string;
  explanation?: string;
  actionItems?: string[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

/** Initiative Review - approval workflow */
export interface InitiativeReview {
  id: string;
  initiativeId: string;
  reviewerId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  comments?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ==========================================
// META-PMO FRAMEWORK: CERTIFIABLE DOMAINS
// Standards: ISO 21500, PMI PMBOK 7th Ed, PRINCE2
// ==========================================

/**
 * PMO Domain IDs - Certifiable Core Domains
 *
 * These 7 domains represent the common denominators across professional PMO standards.
 * Each is methodology-neutral and can be traced to ISO 21500, PMBOK, and PRINCE2.
 *
 * @mapping ISO 21500: Subject Groups
 * @mapping PMBOK 7: Performance Domains
 * @mapping PRINCE2: Themes
 */
export enum PMODomainId {
  /**
   * Governance & Decision Making
   * @iso21500 Integration Subject Group (Decision Making)
   * @pmbok7 Stakeholder Performance Domain / Project Governance
   * @prince2 Organization Theme / Exception Management
   */
  GOVERNANCE_DECISION_MAKING = 'GOVERNANCE_DECISION_MAKING',

  /**
   * Scope & Change Control
   * @iso21500 Scope Subject Group
   * @pmbok7 Development Approach & Life Cycle Performance Domain
   * @prince2 Change Theme / Configuration Management
   */
  SCOPE_CHANGE_CONTROL = 'SCOPE_CHANGE_CONTROL',

  /**
   * Schedule & Milestones
   * @iso21500 Time Subject Group
   * @pmbok7 Planning Performance Domain / Schedule Management
   * @prince2 Plans Theme / Stage
   */
  SCHEDULE_MILESTONES = 'SCHEDULE_MILESTONES',

  /**
   * Risk & Issue Management
   * @iso21500 Risk Subject Group
   * @pmbok7 Uncertainty Performance Domain
   * @prince2 Risk Theme
   */
  RISK_ISSUE_MANAGEMENT = 'RISK_ISSUE_MANAGEMENT',

  /**
   * Resource & Responsibility
   * @iso21500 Resource Subject Group
   * @pmbok7 Team Performance Domain
   * @prince2 Organization Theme (Roles & Responsibilities)
   */
  RESOURCE_RESPONSIBILITY = 'RESOURCE_RESPONSIBILITY',

  /**
   * Performance Monitoring
   * @iso21500 Integration Subject Group (Control)
   * @pmbok7 Measurement Performance Domain
   * @prince2 Progress Theme
   */
  PERFORMANCE_MONITORING = 'PERFORMANCE_MONITORING',

  /**
   * Benefits Realization (Placeholder for future enhancement)
   * @iso21500 Integration Subject Group (Benefits)
   * @pmbok7 Delivery Performance Domain / Benefits Management
   * @prince2 Business Case Theme
   */
  BENEFITS_REALIZATION = 'BENEFITS_REALIZATION',
}

/**
 * PMO Standards Mapping - Explicit terminology mapping for certification
 *
 * Each SCMS concept maps to its equivalent in professional standards.
 * This enables auditors to trace SCMS terminology to known norms.
 */
export interface PMOStandardMapping {
  /** The SCMS concept name (e.g., 'Phase', 'Decision') */
  scmsConcept: string;
  /** The SCMS TypeScript object (e.g., 'SCMSPhase', 'Decision') */
  scmsObject: string;
  /** ISO 21500:2021 equivalent term */
  iso21500Term: string;
  /** ISO 21500 clause reference */
  iso21500Clause?: string;
  /** PMI PMBOK 7th Edition equivalent term */
  pmbokTerm: string;
  /** PMBOK Performance Domain */
  pmbokDomain?: string;
  /** PRINCE2 equivalent term */
  prince2Term: string;
  /** PRINCE2 Theme */
  prince2Theme?: string;
  /** Which PMO domain this belongs to */
  domainId: PMODomainId;
  /** Methodology-neutral description */
  description: string;
}

/**
 * PMO Domain - First-class certifiable domain concept
 *
 * Each domain is:
 * - Optional and configurable per project
 * - Named with neutral terminology
 * - Mappable to ISO/PMBOK/PRINCE2
 */
export interface PMODomain {
  /** Unique domain identifier */
  id: PMODomainId;
  /** Display name (neutral terminology) */
  name: string;
  /** Description of domain scope */
  description: string;
  /** ISO 21500 equivalent terminology */
  iso21500Term: string;
  /** PMBOK 7th Edition equivalent terminology */
  pmbokTerm: string;
  /** PRINCE2 equivalent terminology */
  prince2Term: string;
  /** Whether this domain can be enabled/disabled per project */
  isConfigurable: boolean;
  /** SCMS objects that belong to this domain */
  scmsObjects: string[];
  /** Notes for certification auditors */
  certificationNotes?: string;
}

/**
 * Project PMO Configuration - Per-project domain enablement
 *
 * Allows projects to:
 * - Enable/disable specific domains
 * - Customize phase/gate labels
 * - Configure governance without methodology lock-in
 */
export interface ProjectPMOConfiguration {
  projectId: string;
  /** Array of enabled domain IDs */
  enabledDomains: PMODomainId[];
  /** Custom phase names (optional) */
  phaseLabels?: Record<string, string>;
  /** Custom gate names (optional) */
  gateLabels?: Record<string, string>;
  /** Custom domain names (optional) */
  domainLabels?: Record<PMODomainId, string>;
}

/**
 * PMO Auditable Object - Base interface for certification traceability
 *
 * Any PMO object implementing this interface can be traced
 * back to its domain, phase, and standards equivalents.
 */
export interface PMOAuditableObject {
  /** The PMO domain this object belongs to */
  pmoDomainId: PMODomainId;
  /** The phase when this was created/modified */
  pmoPhase: SCMSPhase;
  /** Optional explicit standards mapping for this instance */
  standardsMapping?: {
    iso21500: string;
    pmbok: string;
    prince2: string;
  };
}

/**
 * PMO Audit Entry - Individual audit trail record
 *
 * Captures every governance action with full traceability:
 * - Domain → Standard terminology
 * - Phase → Lifecycle position
 * - Action → What was done
 */
export interface PMOAuditEntry {
  id: string;
  projectId: string;
  pmoDomainId: PMODomainId;
  pmoPhase: SCMSPhase;
  /** Type of PMO object (DECISION, BASELINE, CHANGE_REQUEST, etc.) */
  objectType: string;
  objectId: string;
  /** Action performed (CREATED, APPROVED, REJECTED, etc.) */
  action: string;
  actorId?: string;
  /** ISO 21500 term at time of action */
  iso21500Mapping: string;
  /** PMBOK term at time of action */
  pmbokMapping: string;
  /** PRINCE2 term at time of action */
  prince2Mapping: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// 3.2 PORTFOLIO (Implicit per Organization)

export interface Portfolio {
  organizationId: string;

  // Aggregated Metrics
  totalProjects: number;
  activeProjects: number;
  projectsOnTrack: number;
  projectsAtRisk: number;
  projectsBlocked: number;

  // Capacity
  totalInitiatives: number;
  completedInitiatives: number;
  overallProgress: number; // 0-100

  // Health
  healthScore: number; // 0-100
  topRisks: string[];
}

// 3.3 TRANSFORMATION PROJECT

export interface TransformationProject {
  id: string;
  organizationId: string;
  name: string;

  // Governance
  sponsorId: string; // REQUIRED: Executive Sponsor
  decisionOwnerId: string; // REQUIRED: Final decision maker
  projectManagerId?: string;

  // Scope
  locationsInScope: string[]; // Site/Location IDs

  // Timeline
  startDate?: string;
  targetEndDate?: string;

  // Phase Tracking (1-6)
  currentPhase: SCMSPhase;
  phaseHistory: { phase: SCMSPhase; enteredAt: string; exitedAt?: string }[];

  // Settings
  governanceSettings: {
    requireApprovalForPhaseTransition: boolean;
    allowPhaseRollback: boolean;
    stageGatesEnabled: boolean;
  };

  // Progress
  progress: number; // 0-100 (calculated from initiatives)
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

  createdAt: string;
  updatedAt: string;
}

// 3.4 INITIATIVE (Core Unit of Change)

export interface PMOInitiative {
  id: string;
  projectId: string; // REQUIRED: Must belong to exactly one project
  ownerId: string; // REQUIRED: Must have exactly one owner

  // Core Attributes
  title: string;
  description: string;

  // Scope
  relatedLocationIds: string[]; // May span multiple locations

  // Status & Priority
  status: InitiativeStatus;
  blockedReason?: string; // Required if status = BLOCKED
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  // Dependencies
  dependsOn: { initiativeId: string; type: DependencyType }[];

  // Related Decisions
  relatedDecisionIds: string[];

  // Progress (calculated)
  progress: number; // 0-100 (from tasks)
  totalTasks: number;
  completedTasks: number;

  // Roadmap
  waveId?: string;
  baselineVersion: number;

  // Audit
  createdAt: string;
  updatedAt: string;
}

// 3.5 TASK (Execution Unit)

export interface PMOTask {
  id: string;
  initiativeId: string; // REQUIRED: Must belong to exactly one initiative
  projectId: string; // Denormalized for queries

  // Core Attributes
  title: string;
  description?: string;

  // Assignment
  assigneeId?: string;

  // Execution
  status: TaskStatus;
  blockedReason?: string; // Required if status = BLOCKED
  blockerType?: 'RISK' | 'DECISION' | 'DEPENDENCY' | 'RESOURCE' | 'OTHER';

  // Timeline
  dueDate?: string;
  effortEstimate?: number; // Hours (lightweight)

  // Evidence
  attachments?: { id: string; name: string; url: string }[];
  evidence?: string;

  // Progress
  progress: number; // 0-100

  // Audit
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// 3.6 DECISION (Governance Checkpoint)

export interface Decision {
  id: string;
  projectId: string;

  // Type
  decisionType: 'INITIATIVE_APPROVAL' | 'PHASE_TRANSITION' | 'UNBLOCK' | 'CANCEL' | 'OTHER';

  // Related Object
  relatedObjectType: 'INITIATIVE' | 'PHASE' | 'ROADMAP' | 'TASK';
  relatedObjectId: string;

  // Ownership
  decisionOwnerId: string; // Single owner (no voting)

  // Status
  status: DecisionStatus;
  required: boolean; // Based on project governance settings

  // Escalation
  dueDate?: string;
  impact?: 'LOW' | 'MEDIUM' | 'HIGH';
  escalationLevel?: 'NONE' | 'AMBER' | 'RED';

  // Details
  title: string;
  description?: string;
  outcome?: string; // Notes from decision maker

  // Audit
  createdAt: string;
  decidedAt?: string;
  auditTrail: { action: string; by: string; at: string; notes?: string }[];
}

// 3.7 STAGE GATE

export interface StageGate {
  id: string;
  projectId: string;

  // Gate Definition
  gateType: StageGateType;
  fromPhase: SCMSPhase;
  toPhase: SCMSPhase;

  // Criteria
  completionCriteria: {
    criterion: string;
    isMet: boolean;
    evidence?: string;
  }[];

  // Status
  status: 'NOT_READY' | 'READY' | 'PASSED' | 'FAILED';
  requiresApproval: boolean;

  // Audit
  evaluatedAt?: string;
  evaluatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
}

// 3.8 INITIATIVE DEPENDENCY

export interface InitiativeDependency {
  id: string;
  fromInitiativeId: string; // Depends on
  toInitiativeId: string; // Dependent
  type: DependencyType;

  // Status
  isSatisfied: boolean;

  createdAt: string;
}

// ==========================================
// STEP 4: ROADMAP, SEQUENCING & CAPACITY
// ==========================================

/** Roadmap: Time-based execution plan for initiatives */
export interface Roadmap {
  id: string;
  projectId: string;
  name: string;

  // Status
  status: 'DRAFT' | 'ACTIVE' | 'BASELINED' | 'ARCHIVED';

  // Timeline
  plannedStartDate?: string;
  plannedEndDate?: string;

  // Metadata
  currentBaselineVersion: number;
  lastBaselinedAt?: string;

  createdAt: string;
  updatedAt: string;
}

/** RoadmapInitiative: Initiative with timeline data on roadmap */
export interface RoadmapInitiative {
  id: string; // Same as initiative.id
  roadmapId: string;
  initiativeId: string;

  // Planned (from baseline)
  plannedStartDate: string;
  plannedEndDate: string;
  plannedDuration: number; // Days
  sequencePosition: number;

  // Actual
  actualStartDate?: string;
  actualEndDate?: string;

  // Flags
  isMilestone: boolean;
  isCriticalPath: boolean;

  // Variance
  startVarianceDays?: number; // Actual - Planned
  endVarianceDays?: number;
}

/** ScheduleBaseline: Captured roadmap snapshot */
export interface ScheduleBaseline {
  id: string;
  roadmapId: string;
  projectId: string;

  // Version
  version: number;

  // Snapshot
  initiativeSnapshots: {
    initiativeId: string;
    plannedStartDate: string;
    plannedEndDate: string;
    sequencePosition: number;
  }[];

  // Approval
  approvedBy: string;
  approvedAt: string;
  rationale: string;

  createdAt: string;
}

/** CapacityEntry: User workload tracking */
export interface CapacityEntry {
  userId: string;
  weekStart: string; // Monday of the week

  // Hours
  allocatedHours: number;
  availableHours: number; // Default: 40
  utilizationPercent: number;

  // Breakdown
  initiativeAllocations: {
    initiativeId: string;
    hours: number;
  }[];

  // Status
  isOverloaded: boolean;
}

/** Scenario: What-if simulation (non-persistent) */
export interface Scenario {
  id: string;
  projectId: string;
  name: string;

  // Changes
  proposedChanges: {
    initiativeId: string;
    field: 'plannedStartDate' | 'plannedEndDate' | 'sequencePosition';
    originalValue: string | number;
    newValue: string | number;
  }[];

  // Impact Analysis
  impactAnalysis?: {
    affectedInitiatives: string[];
    dependencyBreaks: string[];
    capacityOverloads: string[];
    delayedByDays: number;
  };

  createdAt: string;
  createdBy: string;
}

/** VarianceReport: Baseline vs Actual comparison */
export interface VarianceReport {
  projectId: string;
  roadmapId: string;
  baselineVersion: number;

  // Summary
  totalInitiatives: number;
  onTrackCount: number;
  delayedCount: number;
  criticalDelays: number;
  onTrackPercent: number;

  // Details
  initiativeVariances: {
    initiativeId: string;
    initiativeName: string;
    plannedStart: string;
    plannedEnd: string;
    actualStart?: string;
    actualEnd?: string;
    startVarianceDays: number;
    endVarianceDays: number;
    status: 'ON_TRACK' | 'DELAYED' | 'CRITICAL' | 'EARLY';
  }[];

  generatedAt: string;
}

// ==========================================
// STEP 5: EXECUTION CONTROL, MY WORK & NOTIFICATIONS
// ==========================================

/** Notification Types */
export type NotificationType =
  // Execution
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  | 'TASK_BLOCKED'
  | 'INITIATIVE_STARTED'
  | 'INITIATIVE_STALLED'
  | 'INITIATIVE_COMPLETED'
  // Governance
  | 'DECISION_REQUIRED'
  | 'DECISION_OVERDUE'
  | 'CHANGE_REQUEST_SUBMITTED'
  | 'CHANGE_REQUEST_DECIDED'
  | 'GATE_PENDING_APPROVAL'
  // AI
  | 'AI_RISK_DETECTED'
  | 'AI_OVERLOAD_DETECTED'
  | 'AI_DEPENDENCY_CONFLICT'
  | 'AI_RECOMMENDATION'
  // SuperAdmin Signals
  | 'SYSTEM_ALERT'
  | 'CLIENT_TICKET'
  | 'USER_FEEDBACK';

/** Notification Severity */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/** Notification Entity */
export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  projectId?: string;
  projectName?: string;

  // Type & Severity
  type: NotificationType;
  severity: NotificationSeverity;

  // Content
  title: string;
  message: string;

  // Related Object
  relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE';
  relatedObjectId?: string;

  // Legacy Data Support
  data?: {
    link?: string;
    actionLabel?: string;
    priority?: string;
    [key: string]: unknown;
  };

  // Status
  isRead: boolean;
  isActionable: boolean;
  actionUrl?: string;

  // Timestamps
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
}

/** User Notification Settings */
export interface UserNotificationSettings {
  userId: string;

  // Channels
  inAppEnabled: boolean;
  emailEnabled: boolean;

  // Filters
  muteInfo: boolean;
  muteWarning: boolean;
  muteCritical: boolean;

  // Specific types
  mutedTypes: NotificationType[];
}

/** MyWork Aggregation */
export interface MyWork {
  userId: string;
  generatedAt: string;

  // Tasks Section
  myTasks: {
    total: number;
    overdue: number;
    dueToday: number;
    blocked: number;
    items: {
      id: string;
      title: string;
      initiativeName: string;
      projectName: string;
      dueDate?: string;
      status: string;
      priority: string;
      blockedReason?: string;
    }[];
  };

  // Initiatives Section (for Owners/PMs)
  myInitiatives?: {
    total: number;
    atRisk: number;
    items: {
      id: string;
      name: string;
      projectName: string;
      status: string;
      progress: number;
      blockers: string[];
      pendingDecisions: number;
    }[];
  };

  // Decisions Section (for Decision Owners)
  myDecisions?: {
    total: number;
    overdue: number;
    items: {
      id: string;
      title: string;
      projectName: string;
      decisionType: string;
      createdAt: string;
      isOverdue: boolean;
    }[];
  };

  // Alerts Section
  myAlerts: {
    total: number;
    critical: number;
    items: Notification[];
  };
}

/** Escalation Request */
export interface EscalationRequest {
  id: string;
  projectId: string;

  // Source
  sourceType: 'DECISION' | 'INITIATIVE' | 'TASK' | 'CAPACITY';
  sourceId: string;

  // Escalation Path
  fromUserId: string;
  toUserId: string;
  toRole: string;

  // Reason
  reason: string;
  triggerType: 'OVERDUE' | 'STALLED' | 'OVERLOAD' | 'MANUAL';
  daysOverdue?: number;

  // Status
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';

  // Audit
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// ==========================================
// AI TRUST & EXPLAINABILITY LAYER
// ==========================================

/**
 * AI Confidence Level - Computed deterministically based on data quality
 *
 * Rules:
 * - LOW: Missing data, conflicting signals, or no PMOHealthSnapshot
 * - MEDIUM: Partial data available, heuristics used, or blockers present
 * - HIGH: Strong PMOHealthSnapshot signals, no missing blockers, full context
 */
export enum AIConfidenceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * AI Explanation Object - Attached to every AI response
 *
 * This object ensures every AI output is:
 * - Explainable (reasoningSummary)
 * - Traceable (dataUsed)
 * - Auditable (timestamp, stored in audit log)
 * - Defensible (constraintsApplied)
 */
export interface AIExplanation {
  /** The active AI role for this interaction */
  aiRole: AIProjectRole;

  /** Whether regulatory/compliance mode is active */
  regulatoryMode: boolean;

  /** Computed confidence based on data quality */
  confidenceLevel: AIConfidenceLevel;

  /** Human-readable summary of reasoning (not LLM-dependent) */
  reasoningSummary: string;

  /** Data sources used for this response */
  dataUsed: {
    /** Whether project-specific data was available */
    projectData: boolean;
    /** Number of project memory items consulted */
    projectMemoryCount: number;
    /** List of external sources used (if any) */
    externalSources: string[];
  };

  /** List of governance constraints that affected the response */
  constraintsApplied: string[];

  /** ISO 8601 timestamp when explanation was generated */
  timestamp: string;
}

// ==========================================
// INVITATION SYSTEM (Enterprise B2B Collaboration)
// Supports organization and project-level invitations
// ==========================================

/** Invitation Types */
export enum InvitationType {
  ORG = 'ORG',
  PROJECT = 'PROJECT',
}

/** Invitation Status Lifecycle */
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/** Invitation Event Types (Audit Trail) */
export enum InvitationEventType {
  CREATED = 'created',
  SENT = 'sent',
  RESENT = 'resent',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/** Invitation - Token-based invitation to organization or project */
export interface Invitation {
  id: string;
  invitationType: InvitationType;
  organizationId: string;
  organizationName?: string;
  projectId?: string;
  projectName?: string;
  email: string;
  roleToAssign: string;
  token?: string; // Only returned when creating
  status: InvitationStatus;
  expiresAt: string;
  invitedByUserId: string;
  invitedBy?: {
    firstName: string;
    lastName: string;
  };
  acceptedByUserId?: string;
  acceptedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Invitation Event - Audit trail entry */
export interface InvitationEvent {
  id: string;
  invitationId: string;
  eventType: InvitationEventType;
  performedBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  performedByUserId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Invitation Validation Response */
export interface InvitationValidation {
  valid: boolean;
  invitationType: InvitationType;
  organizationName: string;
  projectName?: string;
  email: string;
  roleToAssign: string;
  expiresAt: string;
  /** When true, the first-login profile (job title + country) is mandatory. */
  requireProfile?: boolean;
  /** When true, this is a shared/open invitation — the user enters their own email. */
  requireEmail?: boolean;
  /** Prefilled from a pre-created (pending) account, if any. */
  firstName?: string;
  lastName?: string;
  /** True when this token activates a pre-created pending account. */
  isFirstLogin?: boolean;
}

// ==========================================
// STEP 6: STABILIZATION, REPORTING & ECONOMICS
// ==========================================

/** Stabilization Status for Initiatives */
export type StabilizationStatus =
  | 'STABILIZED'
  | 'PARTIALLY_STABILIZED'
  | 'UNSTABLE'
  | 'NOT_APPLICABLE';

/** Value Hypothesis Types */
export type ValueHypothesisType =
  | 'COST_REDUCTION'
  | 'REVENUE_INCREASE'
  | 'RISK_REDUCTION'
  | 'EFFICIENCY'
  | 'STRATEGIC_OPTION';

/** Value Hypothesis - Expected benefit of an initiative */
export interface ValueHypothesis {
  id: string;
  initiativeId: string;
  projectId: string;

  // Core
  description: string;
  type: ValueHypothesisType;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  // Ownership
  ownerId: string;

  // Linked initiatives
  relatedInitiativeIds: string[];

  // Status
  isValidated: boolean;
  validatedAt?: string;
  validatedBy?: string;

  createdAt: string;
  updatedAt: string;
}

/** Financial Assumption - Order-of-magnitude estimates */
export interface FinancialAssumption {
  id: string;
  valueHypothesisId: string;

  // Range-based (non-binding)
  lowEstimate?: number;
  expectedEstimate?: number;
  highEstimate?: number;
  currency: string;
  timeframe: string; // e.g., "per year", "one-time"

  // Metadata
  notes?: string;
  isNonBinding: boolean; // Always true

  createdAt: string;
}

/** Executive Report - High-level overview */
export interface ExecutiveReport {
  reportType: 'EXECUTIVE_OVERVIEW' | 'PROJECT_HEALTH' | 'GOVERNANCE' | 'BRIEFING';
  generatedAt: string;
  generatedBy: string;

  // Portfolio Summary
  portfolioHealth: {
    totalProjects: number;
    activeProjects: number;
    onTrack: number;
    atRisk: number;
    blocked: number;
  };

  // Phase Distribution
  phaseDistribution: {
    phase: string;
    count: number;
  }[];

  // Top Risks
  topRisks: string[];

  // Pending Decisions
  pendingDecisions: number;
  overdueDecisions: number;

  // Baseline Variance
  initiativesOnTrack: number;
  initiativesDelayed: number;

  // Stabilization
  stabilizationSummary?: {
    stabilized: number;
    partiallyStabilized: number;
    unstable: number;
  };

  // AI Narrative
  aiNarrative: string;
  changesSinceLastReview: string[];
}

/** Project Closure - Formal end of project */
export interface ProjectClosure {
  id: string;
  projectId: string;

  // Closure Details
  closureType: 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  closureDate: string;
  closedBy: string;

  // Summary
  lessonsLearned?: string;
  finalStatus: string;

  // Metrics at Closure
  totalInitiatives: number;
  completedInitiatives: number;
  cancelledInitiatives: number;

  // Value Realization
  valueHypothesesValidated: number;
  valueHypothesesTotal: number;

  // Audit
  approvedBy?: string;
  approvedAt?: string;
}

// ==========================================
// AI CORE LAYER — ENTERPRISE PMO BRAIN
// ==========================================

export interface MergedAISettings {
  // Feature flags (from org)
  webSearchEnabled: boolean;
  artifactsEnabled: boolean;
  thinkingStepsEnabled: boolean;
  focusModesEnabled: boolean;
  voiceEnabled: boolean;

  // Privacy
  enablePiiRedaction: boolean;
  dataRetentionPolicy: 'minimal' | 'standard' | 'extended';

  // Limits (from org)
  maxAICallsPerDay: number;
  maxTokensPerMonth: number;

  // Sources (for debugging)
  _sources: {
    superadmin: Partial<SuperAdminAISettings>;
    org: Partial<OrgAISettings>;
    user: Partial<UserAISettings>;
  };
}

// ==========================================
// SCMS PHASE 1: CONTEXT (Why Change?)
// ==========================================

// Project Context: Captures the strategic "Why" behind transformation
export interface ProjectContext {
  projectId: string;

  // Business Context
  businessModel?: {
    type: string[]; // B2B, B2C, Marketplace
    description: string;
  };
  coreProcesses?: string[];
  itLandscape?: {
    erp?: string;
    crm?: string;
    integrationLevel?: 'Low' | 'Medium' | 'High';
  };

  // Strategic Intent
  strategicGoals: StrategicGoal[];
  successCriteria?: string;
  transformationHorizon?: '12m' | '24m' | '36m';

  // Constraints & Challenges
  challenges: Challenge[];
  constraints: Constraint[];

  // AI Analysis
  contextReadinessScore?: number; // 0-100
  contextGaps?: string[]; // AI-detected missing information
  isContextComplete?: boolean;

  updatedAt?: string;
}

// ==========================================
// SCMS PHASE 2: ASSESSMENT (Where are we now?)
// ==========================================

// Maturity Assessment: Captures As-Is vs To-Be state
// ==========================================
// EXTERNAL ASSESSMENTS (SIRI, ADMA, LEAN)
// ==========================================

/** External Assessment Types */
export type ExternalAssessmentType = 'SIRI' | 'ADMA' | 'DIGITAL_OTHER' | 'LEAN';

/** External Assessment Status */
export type ExternalAssessmentStatus = 'uploaded' | 'processing' | 'mapped' | 'error';

/** External Assessment Entity */
export interface ExternalAssessment {
  id: string;
  projectId?: number;
  organizationId: number;

  // File Info
  type: ExternalAssessmentType;
  fileName: string;
  filePath: string;
  fileSize?: number;

  // Upload Info
  uploadedAt: string;
  uploadedBy: number;
  uploadedByName?: string;

  // Processing Status
  status: ExternalAssessmentStatus;
  processingError?: string;

  // Mapping to Initiatives
  generatedInitiatives?: string[]; // Initiative IDs
  mappingNotes?: string;

  // Metadata
  metadata?: {
    frameworkVersion?: string;
    assessmentDate?: string;
    assessorName?: string;
    maturityScore?: number;
    [key: string]: unknown;
  };

  updatedAt?: string;
}

export interface MaturityAssessment {
  id?: string;
  userId: string;

  // Per-Axis Scores
  axisScores: {
    axis: AxisId;
    asIs: number; // 1-7
    toBe: number; // 1-7
    gap: number; // Calculated: toBe - asIs
    justification?: string;
    areaScores?: Record<string, number[]>; // Sub-area scores
  }[];

  // Overall
  overallAsIs?: number;
  overallToBe?: number;
  overallGap?: number;

  // AI Analysis
  gapAnalysisSummary?: string;
  prioritizedGaps?: string[];

  // Audit Trail
  completedAxes: AxisId[];
  isComplete?: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum AssessmentStep {
  INTRO = 'INTRO',
  ROLE = 'ROLE',
  INDUSTRY = 'INDUSTRY',
  INDUSTRY_SUB = 'INDUSTRY_SUB',
  SIZE = 'SIZE',
  COUNTRY = 'COUNTRY',
  CHALLENGES = 'CHALLENGES',
  GOAL = 'GOAL',
  HORIZON = 'HORIZON',
  SUMMARY = 'SUMMARY',
  COMPLETE = 'COMPLETE',
  PRIORITY = 'PRIORITY',
  DIGITAL_MATURITY = 'DIGITAL_MATURITY',
  REVENUE = 'REVENUE',

  // New Module 1 Steps
  BUSINESS_MODEL = 'BUSINESS_MODEL',
  CORE_PROCESSES = 'CORE_PROCESSES',
  IT_LANDSCAPE = 'IT_LANDSCAPE',
  STRATEGIC_GOALS = 'STRATEGIC_GOALS',
  SUCCESS_CRITERIA = 'SUCCESS_CRITERIA',
  CHALLENGES_MAP = 'CHALLENGES_MAP',
  CONSTRAINTS = 'CONSTRAINTS',
}

export type Language = 'EN' | 'PL' | 'DE' | 'AR';

// ==================== WORLD-CLASS CHAT 2025 TYPES ====================

/**
 * Focus Mode for AI context filtering
 * Determines which sources the AI should prioritize in its response
 */
export type FocusMode = 'all' | 'pmo-docs' | 'project-data' | 'research' | 'web';

/**
 * Artifact - Generated structured content from AI (like Claude's Artifacts)
 * Can be code, documents, diagrams, or PMO-specific content
 */
export interface Artifact {
  id: string;
  type: 'markdown' | 'code' | 'html' | 'diagram' | 'table' | 'pmo-document';
  title: string;
  content: string;
  language?: string; // For code artifacts (e.g., 'typescript', 'python', 'sql')
  editable: boolean;
  version: number;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: {
    framework?: string; // For PMO docs: ISO/PMBOK/PRINCE2
    templateType?: string; // RACI, Risk Register, Status Report
    exportFormats?: string[]; // ['pdf', 'docx', 'xlsx']
  };
  /** Diagram-specific data (for type: 'diagram') */
  diagramData?: {
    diagramType: 'process_flow' | 'decision_tree' | 'mind_map' | 'org_chart';
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type?: string;
      label?: string;
    }>;
  };
}

/**
 * ThinkingStep - Chain of Thought reasoning step
 * Shows AI's reasoning process for transparency
 */
export interface ThinkingStep {
  id: string;
  label: string;
  content: string;
  status: 'pending' | 'in_progress' | 'done';
  timestamp: Date;
  durationMs?: number;
  category?: 'analysis' | 'research' | 'synthesis' | 'validation';
}

/**
 * Message feedback for learning system
 */
export interface MessageFeedback {
  rating: 'positive' | 'negative';
  reason?: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
  type?: 'text' | 'action_request' | 'summary' | 'file' | 'tool_call';
  options?: ChatOption[]; // For interactive buttons
  multiSelect?: boolean; // If true, allows multiple selections
  toolCalls?: ToolCallInfo[]; // For AI tool calls (MCP)
  isThinking?: boolean; // For MAX Mode deep reasoning indicator
  citations?: ChatCitation[]; // Citations from PMO data
  actions?: ChatResponseAction[]; // Action buttons in response

  // World-Class Chat 2025 Extensions
  artifacts?: Artifact[]; // Generated structured content
  thinkingSteps?: ThinkingStep[]; // Chain of Thought reasoning
  canEdit?: boolean; // Allow user to edit this message
  regenerateCount?: number; // How many times regenerated
  focusMode?: FocusMode; // Which focus was used for context
  feedback?: MessageFeedback; // User feedback on this message
  metadata?: {
    // Additional context data
    responseMode?: string;
    [key: string]: any;
  };
  parentMessageId?: string; // For branching conversations (edit history)
  isStreaming?: boolean; // Currently being streamed
  streamProgress?: number; // 0-100 for progress indicator

  // Team conversation extensions
  authorUserId?: string | null; // User who sent this message (null for AI)
  authorName?: string | null; // Display name of author
}

export interface AIMessageHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface StrategicGoal {
  id: string;
  title: string;
  type: 'Efficiency' | 'Growth' | 'Quality' | 'Innovation' | 'Cost' | 'Other';
  horizon: '12m' | '24m' | '36m';
  priority: 'High' | 'Medium' | 'Low';
  description?: string;
}

export interface Challenge {
  id: string;
  title: string;
  area: 'People' | 'Process' | 'Technology' | 'Data';
  severity: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  description?: string;
}

export interface Constraint {
  id: string;
  type: 'Budget' | 'Time' | 'Talent' | 'Legacy Tech' | 'Culture';
  description: string;
  impactLevel: 'High' | 'Medium' | 'Low';
}

export interface CompanyProfile {
  name: string;
  industry: string;
  subIndustry?: string;
  size: string;
  country: string;
  role: string;

  // Module 1 New Fields
  businessModel?: {
    type: string[]; // B2B, B2C, Marketplace, etc.
    description: string;
  };
  coreProcesses?: string[]; // Sales, Production, etc.
  itLandscape?: {
    erp?: string;
    mes?: string;
    wms?: string;
    crm?: string;
    customApps?: string;
    integrationLevel?: 'Low' | 'Medium' | 'High';
  };
}

export interface FreeSession {
  // Step 1
  painPoints: string[];
  goal: string;
  timeHorizon: string;
  step1Completed: boolean;

  // Step 2 (Extended Profile)
  mainPainPoint?: string;
  priorityArea?: string;
  digitalMaturity?: string;
  revenueBracket?: string;
  step2Completed: boolean;

  // Step 3 (Recommendations)
  generatedFocusAreas?: string[];
  generatedQuickWins?: { title: string; desc: string }[];
  step3Completed: boolean;

  // Module 1 Context Fields
  strategicGoals?: StrategicGoal[];
  successCriteria?: string;
  challengesMap?: Challenge[];
  constraints?: Constraint[];

  // Legacy
  selectedIdeas: string[];
}

// --- FULL SESSION TYPES ---

export type AxisId =
  | 'processes'
  | 'digitalProducts'
  | 'businessModels'
  | 'dataManagement'
  | 'culture'
  | 'cybersecurity'
  | 'aiMaturity';

export interface AssessmentAxis {
  score: number;
  answers: number[]; // 1-7 scale values
  areaScores?: { [areaId: string]: number[] }; // Granular scores per area (e.g., "1A": [3, 4])
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export type StrategicIntent = 'Grow' | 'Fix' | 'Stabilize' | 'De-risk' | 'Build capability';

export interface StakeholderImpact {
  role: string; // e.g. "Sales Team"
  impact: 'Wins' | 'Loses' | 'Must Change';
  description: string;
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8';
export type Wave = 'Wave 1' | 'Wave 2' | 'Wave 3';
// Updated InitiativeStatus to include Pilot-specific 'Validated' (Task) or Initiative status

export type TaskType = 'task' | 'bug' | 'story' | 'epic' | 'subtask' | 'pilot';

export interface DecisionImpact {
  decisionType:
    | 'CONTINUE'
    | 'MOVE_TO_PILOT'
    | 'MOVE_TO_SCALE'
    | 'STOP'
    | 'APPROVE_INVESTMENT'
    | 'CHANGE_SCOPE';
  decisionStatement: string;
}

export interface TaskChangeLog {
  id: string;
  type: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedBy: string;
  changedAt: string;
}

export interface AIInsight {
  strategicRelevance: 'HIGH' | 'MEDIUM' | 'LOW';
  executionRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  clarityScore: number;
  summary: string;
  lastComputedAt: string;
}

export interface RiskRating {
  risk: string;
  mitigation: string;
  metric: 'Low' | 'Medium' | 'High';
}

// NEW: Pilot Result Struct
export interface PilotLearning {
  type: 'success' | 'failure' | 'surprise';
  insight: string;
  impact: string;
  actionable: string; // What we will do about it
}

// Module 5: Rollout Types
export interface RAIDItem {
  id: string;
  type: 'Risk' | 'Assumption' | 'Issue' | 'Dependency';
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  probability?: 'High' | 'Medium' | 'Low'; // Only for Risks
  ownerId?: string;
  status: 'Open' | 'Mitigated' | 'Closed';
  dueDate?: string;
  linkedInitiativeId?: string;
  mitigationPlan?: string;
}

export interface KPITracking {
  id: string;
  name: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  ownerId?: string;
  linkedInitiativeIds?: string[];
  history: { date: string; value: number }[];
}

export interface StakeholderMapItem {
  id: string;
  name: string;
  role: string;
  influence: 1 | 2 | 3 | 4 | 5;
  attitude: 'Supportive' | 'Neutral' | 'Resistant';
  engagementStrategy?: string;
}

export interface CommsPlanItem {
  id: string;
  message: string;
  audience: string;
  channel: string; // Email, Townhall, Slack...
  ownerId?: string;
  date: string;
  status: 'Draft' | 'Scheduled' | 'Sent';
}

export type CostRange = 'Low (<$10k)' | 'Medium ($10k-$50k)' | 'High (>$50k)';
export type BenefitRange = 'Low (<$20k/yr)' | 'Medium ($20k-$100k/yr)' | 'High (>$100k/yr)';

export interface Milestone {
  name: string;
  date: string;
  status: 'pending' | 'completed';
  isDecisionGate?: boolean;
  decision?: 'continue' | 'adjust' | 'stop';
  decisionRationale?: string;
}

export interface TargetState {
  process: string[];
  behavior: string[];
  capability: string[];
}

export interface StrategicChangeLog {
  id: string;
  date: string;
  user: string;
  change: string;
  reason: string;
  impact?: string;
}

export interface InitiativeAttachment {
  id: string;
  name: string;
  url: string;
  type: 'audit' | 'data' | 'strategy' | 'external';
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface StrategicFit {
  axisAlign: boolean;
  goalAlign: boolean;
  painPointAlign: boolean;
  reasoning: string;
}

export interface DecisionReadinessBreakdown {
  strategic: boolean;
  problem: boolean;
  target: boolean;
  execution: boolean;
  value: boolean;
}

export interface ProblemStructured {
  symptom: string;
  rootCause: string;
  costOfInaction: string;
}

// Initiative Comments for discussion threads
export interface InitiativeComment {
  id: string;
  initiativeId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string; // For threaded replies
  reactions?: { emoji: string; userIds: string[] }[];
}

// Related/Linked Initiatives
export interface RelatedInitiative {
  id: string;
  initiativeId: string;
  relatedInitiativeId: string;
  relationType: 'DEPENDS_ON' | 'BLOCKS' | 'RELATED_TO' | 'PARENT_OF' | 'CHILD_OF';
  note?: string;
  createdAt: string;
  createdBy: string;
}

// Initiative Team Member Assignment
export interface InitiativeTeamMember {
  id: string;
  initiativeId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'email'>;
  role: 'CONTRIBUTOR' | 'REVIEWER' | 'OBSERVER' | 'SME' | 'STAKEHOLDER';
  allocation?: number; // % allocation (0-100)
  startDate?: string;
  endDate?: string;
  assignedAt: string;
  assignedBy: string;
}

// Initiative Version Snapshot
export interface InitiativeVersion {
  id: string;
  initiativeId: string;
  version: number;
  snapshot: Partial<FullInitiative>;
  changeType: 'STATUS_CHANGE' | 'CONTENT_UPDATE' | 'APPROVAL' | 'MANUAL_SAVE';
  changeSummary: string;
  createdAt: string;
  createdBy: string;
  createdByUser?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
}

export interface FullInitiative {
  id: string;
  projectId: string; // Added to resolve type error
  name: string;
  description?: string;
  axis: AxisId;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  complexity: 'High' | 'Medium' | 'Low'; // Keep for compatibility
  status: InitiativeStatus;
  currentStage?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualEndDate?: string;
  sourceId?: string;
  sourceType?: string;
  blockedReason?: string;
  slaDeadline?: string;
  tasks?: Task[];

  // DRD New Fields
  summary?: string;
  applicantOneLiner?: string; // Executive One-Liner
  strategicIntent?: StrategicIntent;
  decisionReadiness?: number; // 0-100
  decisionReadinessBreakdown?: DecisionReadinessBreakdown; // New Task 8
  stakeholders?: StakeholderImpact[];

  // Pilot Specific Fields (Module 4)
  hypotheses?: string[]; // Mandatory for Pilot
  killCriteria?: string[]; // Mandatory for Pilot
  pilotRisks?: RiskRating[]; // Risks specific to pilot execution
  pilotLearnings?: PilotLearning[]; // Post-pilot evaluation

  hypothesis?: string; // Legacy singular
  businessValue?: 'High' | 'Medium' | 'Low';
  valueDriver?: 'Cost' | 'Revenue' | 'Capital' | 'Risk' | 'Capability';
  confidenceLevel?: 'High' | 'Medium' | 'Low';
  valueTiming?: 'Immediate' | 'Short term' | 'Long term';
  competenciesRequired?: string[];
  milestones?: Milestone[];
  // killCriteria?: string; // Removed legacy singular in favor of array above

  // Professional Card Fields
  problemStatement?: string;
  problemStructured?: ProblemStructured; // New Task 8

  targetState?: TargetState; // New Task 8
  decisionToMake?: string; // New Task 8
  decisionOwnerId?: string; // New Task 8
  strategicFit?: StrategicFit; // New Task 8
  attachments?: InitiativeAttachment[]; // New Task 8
  changeLog?: StrategicChangeLog[]; // New Task 8

  deliverables?: string[];

  successCriteria?: string[];
  scopeIn?: string[];
  scopeOut?: string[];
  keyRisks?: { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[];
  relatedGap?: string; // Links this initiative to a specific DRD Gap

  // Task 4: Scope Enhancements
  assumptions?: {
    org?: string;
    data?: string;
    budget?: string;
    people?: string;
  };
  structuredSuccessCriteria?: {
    type: 'Behavior' | 'Process' | 'Capability' | 'Metric';
    value: string;
  }[];

  // Economics (financial fields for analytics)
  capex?: number;
  budget?: number;
  firstYearOpex?: number;
  annualBenefit?: number;
  roi?: number;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  socialImpact?: string;

  // Legacy Economics (keep or map?)
  estimatedCost?: number;
  estimatedAnnualBenefit?: number;
  costRange?: CostRange;
  benefitRange?: BenefitRange;

  // Timeline
  startDate?: string;
  pilotEndDate?: string;
  endDate?: string;
  quarter?: Quarter;
  wave?: Wave;

  // Governance
  ownerBusinessId?: string;
  ownerExecutionId?: string;
  ownerTechnicalId?: string;
  sponsorId?: string;
  assigneeId?: string; // For risk calculations
  ownerBusiness?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  ownerExecution?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  ownerTechnical?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  sponsor?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  marketContext?: string;

  // Execution
  progress?: number;

  createdAt?: string;
  updatedAt?: string;

  // Strategic Portfolio Fields (New)
  aiConfidence?: 'High' | 'Medium' | 'Low'; // Green, Yellow, Red
  strategicGoalId?: string; // Link to StrategicGoal
  completenessScore?: number; // 0-100%
  valueStatement?: string; // Concise "Value" for preview

  // Initiative Intelligence (Task 7)
  lessonsLearned?: string; // What we learned
  strategicSurprises?: string; // What surprised us
  nextTimeAvoid?: string; // What we would do differently (avoid)
  patternTags?: string[]; // Cross-initiative patterns

  // DRD New Fields (Task 7 - Roadmap Enhancements)
  strategicRole?: 'Foundation' | 'Enabler' | 'Accelerator' | 'Scaling';
  effortProfile?: {
    analytical: number;
    operational: number;
    change: number;
    [key: string]: number; // index signature
  };
  placementReason?: string; // Why is this scheduled here?

  // Collaboration & History
  comments?: InitiativeComment[];
  teamMembers?: InitiativeTeamMember[];
  relatedInitiatives?: RelatedInitiative[];
  versions?: InitiativeVersion[];

  /** Mark Complete — AI signal. { sectionId: boolean, ... }. Persisted in section_completions JSON column. */
  sectionCompletions?: Record<string, boolean>;
}

// Alias Initiative to FullInitiative for backend compatibility
export type Initiative = FullInitiative;

export interface EconomicsSummary {
  totalCost: number;
  totalAnnualBenefit: number;
  overallROI: number;
  paybackPeriodYears: number;
}

export interface FullReport {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  generatedAt?: string;

  // New Fields for Comprehensive Report
  transformationDescription?: string;
  drdLevels?: { axis: string; level: number }[];
  keyInitiatives?: { name: string; status: string; impact: string }[];
  kpiResults?: { kpi: string; value: string; trend: string }[];
  financials?: { cost: number; benefit: number; roi: number; payback: number };
  lessonsLearned?: string[];
  aiRecommendations?: string[];
  roadmapHighlights?: string[];
  cultureAssessment?: string;
}

// --- COMPOSABLE REPORTS (NEW) ---

export type BlockType =
  | 'text'
  | 'table'
  | 'cards'
  | 'matrix'
  | 'evidence_list'
  | 'recommendation'
  | 'image'
  | 'callout';

export interface ReportSource {
  module: string; // e.g. "ChallengeMap"
  entityId?: string; // e.g. challengeId
  snapshotHash?: string;
}

export interface ReportBlockMeta {
  confidence?: number;
  tags?: string[];
  lastGeneratedBy?: string;
  lastEditedBy?: string;
}

// Content types for different block types
export interface TextBlockContent {
  text: string;
}

export interface TableBlockContent {
  headers: string[];
  rows: string[][];
}

export interface CalloutBlockContent {
  level: 'info' | 'warning' | 'success' | 'error';
  text: string;
}

export interface CardsBlockContent {
  cards: Array<{
    title: string;
    description?: string;
    value?: string | number;
    [key: string]: unknown;
  }>;
}

export interface MatrixBlockContent {
  rows: string[];
  columns: string[];
  data: (string | number)[][];
}

export interface EvidenceListBlockContent {
  items: Array<{
    id: string;
    title: string;
    description?: string;
    source?: string;
    [key: string]: unknown;
  }>;
}

export interface RecommendationBlockContent {
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority?: string;
    [key: string]: unknown;
  }>;
}

export interface ImageBlockContent {
  url: string;
  alt?: string;
  caption?: string;
}

export type ReportBlockContent =
  | TextBlockContent
  | TableBlockContent
  | CalloutBlockContent
  | CardsBlockContent
  | MatrixBlockContent
  | EvidenceListBlockContent
  | RecommendationBlockContent
  | ImageBlockContent;

export interface ReportBlock {
  id: string;
  reportId: string;
  type: BlockType;
  title?: string;
  module: string;
  anchor?: string;

  editable: boolean;
  aiRegeneratable: boolean;
  locked: boolean;

  content?: ReportBlockContent;
  meta?: ReportBlockMeta;
  position: number;

  message?: string; // For callout (legacy)
  level?: string; // For callout (legacy)
}

export interface Report {
  id: string;
  projectId?: string;
  organizationId: string;
  title: string;
  status: 'draft' | 'final' | 'archived';
  version: number;

  blockOrder: string[]; // List of block IDs
  blocks: Record<string, ReportBlock>; // Map for O(1) access

  sources?: ReportSource[];
  createdAt: string;
  updatedAt: string;
}

// --- MODULE 2 TYPES ---

// Align DRDAxis with AxisId
export type DRDAxis =
  | 'processes'
  | 'digitalProducts'
  | 'businessModels'
  | 'dataManagement'
  | 'culture'
  | 'cybersecurity'
  | 'aiMaturity';
export type MaturityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Assessment Status
export enum AssessmentStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  FINALIZED = 'FINALIZED',
}

// Report Status
export enum ReportStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
}

export interface AxisAssessment {
  actual: MaturityLevel;
  target: MaturityLevel;
  justification: string;
  notes?: string;
  areaScores?: Record<string, number[]>; // [actual, target] for each sub-area
  areaNotes?: Record<string, string>; // Notes justification for each sub-area
}

// Report Section Types
export type ReportSectionType =
  | 'executive-summary'
  | 'gap-analysis'
  | 'recommendations'
  | 'benchmarks'
  | 'roadmap'
  | 'custom';

export interface ReportSection {
  id: string;
  type: ReportSectionType;
  title: string;
  content: string; // Markdown/rich text
  status: 'draft' | 'reviewing' | 'approved';
  aiGenerated: boolean;
  lastEditedBy: 'ai' | 'human';
  lastEditedAt: Date;
  comments?: Comment[];
  suggestions?: AISuggestion[];
  order: number;
}

export interface Comment {
  id: string;
  text: string;
  date: Date;
  author: string;
  authorId: string;
  sectionId: string;
}

export interface AISuggestion {
  id: string;
  type:
    | 'expand'
    | 'condense'
    | 'refine'
    | 'add-data'
    | 'add-example'
    | 'restructure'
    | 'add-section';
  text: string;
  originalText: string;
  sectionId: string;
  accepted?: boolean;
  rejected?: boolean;
}

// Report Content Structure
export interface ReportContent {
  executiveSummary: string;
  gapAnalysis: string;
  recommendations: Recommendation[];
  benchmarks?: string;
  roadmap?: string;
  customSections?: ReportSection[];
}

// Recommendation Types
export type RecommendationType = 'development' | 'balance' | 'stabilization';
export type RecommendationPriority = 'high' | 'medium' | 'low';
export type RecommendationImpact = 'high' | 'medium' | 'low';
export type RecommendationEffort = 'high' | 'medium' | 'low';
export type TransformationPhase = 'measure' | 'optimize' | 'automate';

export interface Recommendation {
  id: string;
  type: RecommendationType;

  // For development recommendations
  axis?: DRDAxis;
  currentLevel?: MaturityLevel;
  targetLevel?: MaturityLevel;

  // For balance recommendations
  axes?: DRDAxis[];

  // Common fields
  priority: RecommendationPriority;
  rationale: string;
  impact: RecommendationImpact;
  effort: RecommendationEffort;

  // Transformation philosophy
  transformationPhase: TransformationPhase;

  // Link to initiative (after generation)
  initiativeId?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Assessment Report Interface (extended version for new report system)
export interface AssessmentReport {
  id: string;
  assessmentId: string; // Link to assessment/project
  name: string; // "DRD – Sales Q1 2025"
  type: 'DRD' | 'LEAN' | 'SIRI' | 'ADMA' | 'CMMI';
  status: ReportStatus;

  // Content
  content: ReportContent;
  sections: ReportSection[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  generatedAt?: string; // Aligned with base FullReport interface - ISO string format
  finalizedAt?: Date;
  createdBy: string;

  // Relationships
  basedOnId?: string; // If copied from another report

  // Version control
  version: number;
  previousVersionId?: string;
}

// Assessment Interface (extended)
export interface Assessment {
  id: string;
  projectId: string;
  name: string; // "DRD – Sales Q1 2025"
  type: 'DRD' | 'LEAN' | 'SIRI' | 'ADMA' | 'CMMI';
  status: AssessmentStatus;

  // Scores
  axes: Record<DRDAxis, AxisAssessment>;

  // Report
  report?: Report;
  reportId?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
  createdBy: string;

  // Relationships
  basedOnId?: string; // If copied from another assessment

  // Progress tracking
  completedAxes: DRDAxis[];
  totalAxes: number;
}

// =====================================================
// ASSESSMENT WORKFLOW TYPES
// =====================================================

/** Workflow states for assessment approval process */
export type WorkflowState =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'COMPLETED'
  | 'IN_PROGRESS';

/** Review status for individual reviewers */
export type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

/** Assessment workflow status */
export interface AssessmentWorkflowStatus {
  id: string;
  assessmentId: string;
  projectId: string;
  organizationId: string;
  status: WorkflowState;
  currentVersion: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedReviews: number;
  totalReviews: number;
  reviewProgress: number;
  canSubmitForReview: boolean;
  canApprove: boolean;
  slaDeadline?: Date;
  isOverdue?: boolean;
}

/** Assessment version for history tracking */
export interface AssessmentVersion {
  id: string;
  assessmentId: string;
  version: number;
  data: Assessment;
  createdAt: Date;
  createdBy: string;
  createdByName?: string;
  changeLog?: string;
}

/** Assessment review by stakeholder */
export interface AssessmentReview {
  id: string;
  workflowId: string;
  assessmentId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerEmail?: string;
  status: ReviewStatus;
  feedback?: string;
  rating?: number;
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/** Workflow transition record */
export interface WorkflowTransition {
  id: string;
  workflowId: string;
  assessmentId: string;
  fromStatus: WorkflowState;
  toStatus: WorkflowState;
  triggeredBy: string;
  triggeredByName?: string;
  reason?: string;
  timestamp: Date;
}

/** Assessment comment on axis */
export interface AssessmentComment {
  id: string;
  assessmentId: string;
  axisId: string;
  userId: string;
  userName: string;
  content: string;
  parentId?: string;
  createdAt: Date;
  updatedAt?: Date;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

// =====================================================
// INITIATIVE GENERATOR TYPES
// =====================================================

/** Risk level for initiatives */
export type InitiativeRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Status of generated initiative */
export type GeneratedInitiativeStatus = 'DRAFT' | 'APPROVED' | 'TRANSFERRED';

/** Initiative generated from assessment gaps */
export interface GeneratedInitiative {
  id: string;
  assessmentId: string;
  sourceAxisId: DRDAxis;
  name: string;
  description: string;
  objectives: string[];
  estimatedROI: number;
  estimatedBudget: number;
  timeline: string;
  riskLevel: InitiativeRiskLevel;
  priority: number;
  status: GeneratedInitiativeStatus;
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

/** Constraints for AI initiative generation */
export interface InitiativeGeneratorConstraints {
  maxBudget?: number;
  maxTimeline?: string;
  teamSize?: string;
  riskAppetite?: 'conservative' | 'moderate' | 'aggressive';
  focusAreas?: DRDAxis[];
}

/** Gap data for initiative generation */
export interface GapForGeneration {
  axisId: DRDAxis;
  axisName: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  selected: boolean;
}

/** Template categories for initiative generation */
export type TemplateCategory =
  | 'DATA'
  | 'PROCESS'
  | 'PRODUCT'
  | 'CULTURE'
  | 'SECURITY'
  | 'AI_ML'
  | 'CUSTOM';

/** Initiative Template for reusable charter patterns */
export interface InitiativeTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  applicableAxes: DRDAxis[];

  // Pre-filled charter fields
  problemStructured?: Partial<ProblemStructured>;
  targetState?: Partial<TargetState>;
  killCriteria?: string[];
  suggestedTasks?: Partial<Task>[];
  suggestedRoles?: { role: string; allocation: number }[];
  typicalTimeline?: string;
  typicalBudgetRange?: { min: number; max: number };

  isPublic: boolean;
  organizationId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// Migrated to domain/ai.ts

/** Assessment tab types */
export type AssessmentTab = 'dashboard' | 'assessments' | 'reviews' | 'gap-map' | 'reports';

export interface AdditionalAudit {
  id: string;
  name: string;
  date: string;
  score: string;
  fileUrl?: string; // or local ref
  aiSummary?: string;
  mappedAxis?: DRDAxis;
}

export interface RoadmapItem {
  id: string;
  initiativeId: string;
  startDate: string;
  endDate: string;
  lane?: string;
}

export interface FullSession {
  id: string;

  // Progress Flags
  step1Completed?: boolean;
  step2Completed?: boolean;
  step3Completed?: boolean;
  step4Completed?: boolean;
  step5Completed?: boolean;

  // Module 1 PRO: Context Sufficiency
  contextSufficiency?: {
    score: number; // 0-100
    gaps: string[];
    isReady: boolean;
    lastAnalysis?: string;
  };

  // Module 2 Assessment Data
  assessment: Partial<Record<DRDAxis, AxisAssessment>> & { completedAxes: AxisId[] };
  assessmentStatus?: AssessmentStatus; // IN_PROGRESS | FINALIZED
  audits: AdditionalAudit[];
  gapMapAnalysis?: string; // AI generated summary of gaps

  // Report Data
  report?: Report;
  reportId?: string;

  // Module 3 Data
  initiatives: FullInitiative[];
  roadmap: RoadmapItem[];

  // Module 4 & 5 Data (Placeholders)
  kpiResults?: Record<string, string>;
  economics?: EconomicsSummary;

  // Module 5: Rollout Execution Data
  rollout?: {
    scope?: {
      programName: string;
      businessGoals: string[];
      inScope: string[];
      outScope: string[];
      strategicPillars: { title: string; description: string }[];
    };
    governance?: {
      roles: { role: string; personId?: string; responsibilities: string }[];
      workstreams: { id: string; name: string; ownerId?: string; members: string[] }[];
    };
    risks?: RAIDItem[];
    kpis?: KPITracking[];
    changeManagement?: {
      stakeholders: StakeholderMapItem[];
      commsPlan: CommsPlanItem[];
    };
    closure?: {
      checklist: { item: string; completed: boolean }[];
      lessonsLearned: { category: string; lesson: string; recommendation: string }[];
      isClosed: boolean;
      closedAt?: string;
    };
  };

  chatHistory?: ChatMessage[];

  // Legacy / Computed
  drdLevels?: Record<string, { current: number; target: number }>;
}

export interface SessionContext {
  mode: SessionMode;
  step: number;
  companyProfile: Partial<CompanyProfile>;
  fullSession?: FullSession;
}

export interface Idea {
  id: string;
  category: 'quickwin' | 'process' | 'ai';
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  impactDescription: string;
  area: 'Procesy' | 'Dane' | 'AI / Automatyzacja';
  isSelected: boolean;
}

export interface TimelineItem {
  ideaId: string;
  startMonth: number;
  endMonth: number;
  category: 'quickwin' | 'process' | 'ai';
}

export interface ImplementationPlan {
  timeline: TimelineItem[];
  operationalImpact: {
    process: string;
    data: string;
    ai: string;
  };
  financialImpact: {
    process: string;
    data: string;
    ai: string;
  };
}

export interface KnowledgeDoc {
  id: string;
  filename: string;
  filepath: string;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  created_at: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  provider:
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'mistral'
    | 'groq'
    | 'together'
    | 'nvidia'
    | 'deepseek'
    | 'qwen'
    | 'ernie'
    | 'z_ai'
    | 'ollama'
    | 'tavily'
    | 'google_search'
    | 'cohere';
  api_key: string;
  endpoint?: string;
  model_id: string;
  cost_per_1k: number;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  markup_multiplier?: number;
  is_active: boolean;
  is_default?: boolean;
  visibility: 'admin' | 'public' | 'beta';
  priority?: number;

  // Organization Context
  is_enabled_for_org?: boolean;

  // Technical Conditions
  context_window?: number;
  max_outputs?: number; // Max output tokens
  description?: string;
  capabilities?: string[]; // e.g. "vision", "reasoning", "coding"

  // Runtime status (optional)
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  tier?: string;
  isConfigured?: boolean;
}

export type AIProviderType = 'system' | 'openai' | 'gemini' | 'ollama';

export interface AIProviderConfig {
  provider: AIProviderType;
  modelId: string;
  apiKey?: string;
  endpoint?: string;
  visibleModelIds?: string[];
  privateModels?: PrivateModel[]; // Using PrivateModel defined below
}

export interface UserAIConfig {
  provider?: AIProviderType; // Default/Active provider
  modelId?: string; // Default/Active model ID
  endpoint?: string; // Local endpoint
  apiKey?: string; // Custom API Key (Legacy/Single)

  // New Multi-Model Config
  visibleModelIds?: string[]; // IDs of system models user wants to see
  privateModels?: PrivateModel[]; // User's custom models
}

export interface PrivateModel {
  id: string;
  name: string;
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  modelId: string;
}

// ==========================================
// PHASE 1: TEAMWORK & COLLABORATION TYPES
// ==========================================

// Task Status (Workflow)
// Extended to include legacy aliases used in some components
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
// Task Status (Workflow)
// Extended to include legacy aliases used in some components
// Basic access roles for the legacy project_users table
export type ProjectUserRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TeamRole = 'lead' | 'member';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  projectId: string; // Keep for legacy, but might be empty if initiativeId is used
  projectName?: string;
  organizationId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  progress?: number; // 0-100
  blockedReason?: string;
  priority: TaskPriority;
  assigneeId?: string;
  backupAssigneeId?: string;
  assignee?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  reporterId?: string;
  reporter?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  dueDate?: string;
  startedAt?: string;
  estimatedHours?: number;
  checklist?: ChecklistItem[];
  attachments?: TaskAttachment[];
  tags?: string[];
  customStatusId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // PMO governance additions
  ownerId?: string;
  requiresAcceptance?: boolean;
  acceptanceType?: 'manual' | 'automatic' | null;
  acceptorId?: string | null;

  // Strategic Execution Fields (Upgrade)
  taskType: TaskType;
  expectedOutcome?: string;
  decisionImpact?: DecisionImpact;
  evidenceRequired?: ('DOCUMENT' | 'DATA' | 'DEMO' | 'APPROVAL')[];
  evidenceItems?: {
    id: string;
    type: string;
    title: string;
    urlOrFileId: string;
    createdBy: string;
    createdAt: string;
  }[];
  strategicContribution?: ('PROCESS_CHANGE' | 'BEHAVIOR_CHANGE' | 'CAPABILITY_CHANGE')[];

  // Dependencies
  dependencies?: {
    dependsOnTaskIds: string[];
    blocksTaskIds: string[];
  };

  // AI Insight
  aiInsight?: AIInsight;

  // Change Log
  changeLog?: TaskChangeLog[];

  // Legacy / Optional Mappings
  budgetAllocated?: number;
  budgetSpent?: number;
  riskRating?: RiskRating;
  acceptanceCriteria?: string;
  blockingIssues?: string;
  stepPhase?: 'design' | 'pilot' | 'rollout';
  initiativeId?: string;
  initiativeName?: string;
  why?: string;

  // Weight for progress calculation (1-5, default 1)
  weight?: number;
  weightReason?: string;

  // Evidence Sign-off
  signedOff?: boolean;
  signedOffAt?: string;
  signedOffBy?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  leadId?: string;
  lead?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  memberCount?: number;
  createdAt: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatarUrl'>;
  role: TeamRole;
  joinedAt: string;
}

export interface ProjectUser {
  projectId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  role: ProjectUserRole;
  assignedAt: string;
}

export interface CustomStatus {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
}

// Notification Types

// Activity Log (Audit Trail)
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'commented'
  | 'completed'
  | 'archived';

export type ActivityEntityType = 'task' | 'project' | 'user' | 'team' | 'organization';

export interface ActivityLog {
  id: string;
  organizationId: string;
  userId?: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Extended User with aiConfig (remove duplicate by keeping this one)
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinId?: string;
  companyName: string;
  role?: UserRole; // SUPERADMIN, ADMIN, USER
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  lastLogin?: string;
  isAuthenticated: boolean;
  accessLevel: 'free' | 'full';
  preferredLanguage?: Language;
  /**
   * P0.3 (2026-07-26): account-level UI interface language (en/pl/de/ar/jp/es
   * from src/i18n.ts SUPPORTED_LANGUAGES). Distinct from `preferredLanguage`
   * (AI content-generation language). SSOT priority for a logged-in session
   * is account (`language`) > localStorage > navigator — see
   * src/services/languagePreference.ts.
   */
  language?: string;
  organizationId?: string;
  organizationName?: string;
  avatarUrl?: string;
  isDemo?: boolean;
  impersonatorId?: string;
  tokenUsage?: number;
  tokenLimit?: number;
  tokenResetAt?: string;
  aiConfig?: AIProviderConfig;
  aiPreferences?: AIPreferences;
  licensePlanId?: string;
  mfaEnabled?: boolean;

  // Profile settings extensions
  industry?: string;
  country?: string;
  units?: 'metric' | 'imperial';
  hasWorkspace?: boolean;
  journeyState?: string;
  currentPhase?: string;
  jobTitle?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  linkedAccounts?: LinkedAccounts;
  // Professional Profile extensions
  bio?: string;
  skills?: string[];
  certifications?: Certification[];
  education?: Education[];
  workExperience?: WorkExperience[];
  socialLinks?: SocialLinks;
  // Contact extensions
  emails?: ContactEmail[];
  phones?: ContactPhone[];
  officeAddress?: Address;
  emergencyContact?: EmergencyContact;
  preferredContactMethod?: 'email' | 'phone' | 'in-app';
  // Availability & Status
  statusMessage?: string;
  outOfOfficeDates?: OutOfOfficePeriod[];
  workingHours?: WorkingHours;
  doNotDisturbHours?: DoNotDisturbHours;
  // Profile enhancements
  displayName?: string;
  pronouns?: 'he/him' | 'she/her' | 'they/them' | 'other' | '';
  department?: string;
  projectRole?: string;
  isOutOfOffice?: boolean;
  outOfOfficeUntil?: string;
  outOfOfficeMessage?: string;
  // Extended Profile Fields (Phase 1)
  birthday?: string; // ISO date string
  location?: string; // City/Country
  availabilityStatus?: 'online' | 'away' | 'busy' | 'dnd'; // Real-time availability status
  profileVisibility?: 'public' | 'team' | 'private';
  profileCompletionScore?: number; // 0-100
  activityStatus?: UserActivityStatus;
  seniorityLevel?: string;
  siteLocation?: string;
  tenureYears?: string;
  managesTeam?: boolean;
  teamSize?: string;
  expertiseTags?: string[];
  engagementLevel?: string;
  profileSurveyCompletedAt?: string;
  profileSurveyDismissedCount?: number;
  profileSurveyLastDismissedAt?: string;
  // UI Preferences
  uiDensity?: 'comfortable' | 'compact' | 'spacious';
  startPage?: 'dashboard' | 'myTasks' | 'inbox' | 'lastVisited';
  fontScale?: number; // 90, 100, 110, 120
}

// Linked social/OAuth accounts
export interface LinkedAccounts {
  google?: {
    id: string;
    email: string;
    name?: string;
    linkedAt: string;
  };
  linkedin?: {
    id: string;
    email?: string;
    name?: string;
    profileUrl?: string;
    linkedAt: string;
  };
}

// Professional Profile Types
export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  location?: string;
}

export interface SocialLinks {
  twitter?: string;
  github?: string;
  website?: string;
  portfolio?: string;
  medium?: string;
  devto?: string;
}

// Contact Information Types
export interface ContactEmail {
  id: string;
  email: string;
  type: 'work' | 'personal' | 'other';
  isPrimary: boolean;
  isVerified: boolean;
}

export interface ContactPhone {
  id: string;
  phone: string;
  type: 'work' | 'mobile' | 'home' | 'other';
  isPrimary: boolean;
  isVerified?: boolean; // Added for verification support
  countryCode?: string;
}

export interface Address {
  id?: string;
  type?: 'office' | 'home' | 'billing' | 'shipping' | 'other'; // Added for address type
  isPrimary?: boolean; // Added for primary address support
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  formatted?: string;
}

export interface EmergencyContact {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

// Availability Types
export interface OutOfOfficePeriod {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
  isAllDay: boolean;
}

export interface WorkingHours {
  timezone: string;
  days?: {
    monday?: DaySchedule;
    tuesday?: DaySchedule;
    wednesday?: DaySchedule;
    thursday?: DaySchedule;
    friday?: DaySchedule;
    saturday?: DaySchedule;
    sunday?: DaySchedule;
  };
  schedule?: {
    [key: string]: {
      start: string;
      end: string;
      isWorkDay: boolean;
    };
  };
}

export interface DaySchedule {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  breaks?: BreakPeriod[];
}

export interface BreakPeriod {
  startTime: string;
  endTime: string;
}

export interface DoNotDisturbHours {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
}

// ==========================================
// EXTENDED PROFILE TYPES (Settings Enhancement)
// ==========================================

/**
 * Extended User Profile
 * Comprehensive profile data beyond basic user info
 */
export interface UserProfileExtended {
  userId: string;

  // Bio & About
  shortBio?: string;
  longBio?: string;
  skills?: string[] | UserSkill[];
  certifications?: Certification[];
  yearsExperience?: number;
  education?: Education[];

  // Professional Details
  department?: string;
  managerId?: string;
  employeeId?: string;
  hireDate?: string;
  contractType?: ContractType;
  workingHours?: { start: string; end: string };
  workDays?: number[]; // 0-6, where 0 = Sunday

  // Social Links (extended)
  socialLinks?: ExtendedSocialLinks;

  // Contact Information (extended)
  contactInfo?: ExtendedContactInfo;

  // Visibility Settings
  visibility?: ProfileVisibility;

  // Email Preferences
  emailPreferences?: EmailPreferences;

  // Profile Completion
  profileCompletion?: ProfileCompletion;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

export type ContractType = 'full-time' | 'part-time' | 'contractor' | 'freelance';

export interface UserSkill {
  id: string;
  name: string;
  category?: 'technical' | 'soft' | 'language' | 'tool';
  proficiencyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsExperience?: number;
  isPrimary?: boolean;
  endorsementCount?: number;
}

export interface ExtendedSocialLinks extends SocialLinks {
  linkedin?: string;
  custom?: CustomSocialLink[];
}

export interface CustomSocialLink {
  name: string;
  url: string;
  icon?: string;
}

export interface ExtendedContactInfo {
  workPhone?: string;
  mobilePhone?: string;
  officeAddress?: string;
  officeBuilding?: string;
  officeFloor?: string;
  officeDesk?: string;
  skype?: string;
  teams?: string;
  slack?: string;
  discord?: string;
  zoomLink?: string;
}

export interface ProfileVisibility {
  profile: 'public' | 'organization' | 'team' | 'private';
  showEmail: boolean;
  showPhone: boolean;
  showActivityStatus: boolean;
  showLastSeen: boolean;
  showInDirectory: boolean;
  allowMentionsFrom: 'all' | 'team' | 'none';
  allowDirectMessagesFrom: 'all' | 'team' | 'none';
}

export interface EmailPreferences {
  signature?: string;
  signatureHtml?: string;
  aliases?: string[];
  forwarding?: EmailForwarding[];
  outOfOffice?: OutOfOfficeSettings;
  digestFrequency?: 'realtime' | 'daily' | 'weekly' | 'never';
}

export interface EmailForwarding {
  email: string;
  enabled: boolean;
}

export interface OutOfOfficeSettings {
  enabled: boolean;
  message?: string;
  start?: string;
  end?: string;
  autoReply?: boolean;
}

export interface ProfileCompletion {
  score: number; // 0-100
  details: Record<string, boolean>;
}

// ==========================================
// KEYBOARD SHORTCUTS TYPES
// ==========================================

export type ShortcutPreset = 'default' | 'vscode' | 'sublime' | 'vim' | 'custom';

export interface KeyboardShortcuts {
  preset: ShortcutPreset;
  enabled: boolean;
  showHints: boolean;
  customShortcuts?: Record<string, string>;
  disabledShortcuts?: string[];
}

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  defaultKey: string;
  currentKey?: string;
  isCustom?: boolean;
}

export type ShortcutCategory =
  | 'navigation'
  | 'editing'
  | 'task_management'
  | 'search'
  | 'ai'
  | 'general';

// ==========================================
// EXTENDED PREFERENCES TYPES
// ==========================================

export interface CollaborationPreferences {
  defaultMentionBehavior: 'notify' | 'silent' | 'none';
  defaultCommentVisibility: 'team' | 'project' | 'public';
  autoFollowCreated: boolean;
  autoFollowAssigned: boolean;
  autoFollowCommented: boolean;
  showTypingIndicators: boolean;
  showReadReceipts: boolean;
  defaultSharePermission: 'view' | 'comment' | 'edit';
  collaborationMode: 'realtime' | 'periodic' | 'manual';
}

export interface PerformancePreferences {
  imageQuality: 'low' | 'medium' | 'high' | 'original';
  videoQuality: 'low' | 'medium' | 'high' | 'auto';
  autoLoadImages: boolean;
  autoLoadVideos: boolean;
  bandwidthSaverMode: boolean;
  offlineModeEnabled: boolean;
  offlineSyncWifiOnly: boolean;
  cacheSizeMb: number;
  animationEnabled: boolean;
  reduceDataUsage: boolean;
  preloadContent: boolean;
}

export interface MobilePreferences {
  pushNotificationsEnabled: boolean;
  mobileDataSyncEnabled: boolean;
  wifiOnlySync: boolean;
  mobileOfflineMode: boolean;
  biometricLoginEnabled: boolean;
  quickActions: string[];
  widgetConfig?: Record<string, unknown>;
  hapticFeedbackEnabled: boolean;
}

export interface AutomationRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
  isEnabled: boolean;
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AutomationTriggerType =
  | 'task_created'
  | 'task_completed'
  | 'task_assigned'
  | 'due_date_approaching'
  | 'status_changed'
  | 'comment_added'
  | 'tag_added';

export type AutomationActionType =
  | 'notify'
  | 'assign'
  | 'move'
  | 'tag'
  | 'set_priority'
  | 'add_comment'
  | 'create_task';

export interface AILearningPreferences {
  allowLearningFromInteractions: boolean;
  allowLearningFromDocuments: boolean;
  allowLearningFromTasks: boolean;
  allowPersonalization: boolean;
  shareAnonymousUsage: boolean;
  aiSuggestionsEnabled: boolean;
  aiAutoCompleteEnabled: boolean;
  aiSmartRepliesEnabled: boolean;
  aiSummaryEnabled: boolean;
  aiPrioritySuggestions: boolean;
  feedbackCollectionEnabled: boolean;
  modelPreference: 'speed' | 'balanced' | 'quality';
}

export interface QuietHoursSettings {
  id?: string;
  name?: string;
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  daysOfWeek: number[]; // 0-6
  allowUrgent: boolean;
  allowMentions: boolean;
  allowDirectMessages: boolean;
  autoReplyEnabled: boolean;
  autoReplyMessage?: string;
}

export interface SecurityAlertPreferences {
  alertNewLogin: boolean;
  alertNewDevice: boolean;
  alertPasswordChange: boolean;
  alertEmailChange: boolean;
  alertMfaChange: boolean;
  alertApiKeyCreated: boolean;
  alertSuspiciousActivity: boolean;
  alertFailedLoginAttempts: boolean;
  failedLoginThreshold: number;
  alertSessionTimeout: boolean;
  alertDataExport: boolean;
  alertChannel: 'email' | 'push' | 'both';
}

// Extended Accessibility Preferences
export interface AccessibilityPreferencesExtended {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrastMode: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  showKeyboardShortcuts: boolean;
  focusHighlight: boolean;
  cursorSize: 'default' | 'large' | 'extra-large';
  textSpacing: 'default' | 'wide' | 'wider';
  underlineLinks: boolean;
  // New extended options
  colorBlindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  fontFamily?: string;
  lineHeight?: 'default' | 'relaxed' | 'loose';
  letterSpacing?: 'default' | 'wide' | 'wider';
  voiceCommandsEnabled?: boolean;
  textToSpeechEnabled?: boolean;
  speechToTextEnabled?: boolean;
  caretWidth?: 'default' | 'thick';
  focusIndicatorStyle?: 'default' | 'high-contrast' | 'animated';
}

// Extended Regional Settings
export interface RegionalPreferencesExtended {
  timezone: string;
  units: 'metric' | 'imperial';
  currency: string;
  numberFormat: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 'sunday' | 'monday' | 'saturday';
  // New extended options
  fiscalYearStartMonth?: number; // 1-12
  businessHours?: {
    start: string;
    end: string;
  };
  weekNumberingStyle?: 'iso' | 'us';
  publicHolidaysCalendar?: string;
}

// Task Template for quick creation
export interface TaskTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultPriority?: 'low' | 'medium' | 'high' | 'urgent';
  defaultTags?: string[];
  defaultChecklist?: ChecklistItem[];
  defaultAssignee?: 'self' | 'manager' | string;
  defaultDueDays?: number;
  defaultProjectId?: string;
  isFavorite?: boolean;
  useCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Dashboard Layout for multiple saved configurations
export interface DashboardLayout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  layoutConfig: DashboardLayoutConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLayoutConfig {
  widgets: DashboardWidget[];
  columns?: number;
  compactMode?: boolean;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config?: Record<string, unknown>;
  refreshInterval?: number; // seconds
  isVisible?: boolean;
}

// User Activity Status (Phase 1)
export interface UserActivityStatus {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'dnd';
  statusMessage?: string;
  lastSeen: string; // ISO datetime
  currentlyActive: boolean;
}

// Permission request types
export type PermissionRequestType =
  | 'ROLE_CHANGE'
  | 'TOKEN_LIMIT'
  | 'STORAGE_LIMIT'
  | 'FEATURE_ACCESS';
export type PermissionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PermissionRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface PermissionRequest {
  id: string;
  organizationId: string;
  userId: string;
  requestType: PermissionRequestType;
  currentValue?: string;
  requestedValue?: string;
  justification?: string;
  status: PermissionRequestStatus;
  priority: PermissionRequestPriority;
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  user?: User;
  reviewer?: User;
}

// Migrated to domain/ai.ts

// Organization with extended fields
export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'trial' | 'pro' | 'enterprise';
  status: 'active' | 'blocked' | 'trial' | 'pending';
  created_at: string; // Support snake_case for views
  createdAt?: string; // Support camelCase for legacy
  user_count: number;
  userCount?: number;
  discount_percent?: number;
  validUntil?: string;
}

// Project with extended fields
export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  goal?: string;
  status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
  ownerId?: string;
  ownerName?: string;
  owner_first_name?: string;
  owner_last_name?: string;
  owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  createdAt: string;
  created_at?: string; // Legacy support
  updatedAt: string;
  updated_at?: string; // Legacy support
  taskCount?: number;
  memberCount?: number;
  initiativeCount?: number;
  assessmentCount?: number;
  documentCount?: number;
  team?: ProjectMember[];
  initiatives?: Initiative[];
  assessments?: Assessment[];
  documents?: ProjectDocument[];
  workstreams?: Workstream[];
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  url?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// PHASE 2: DRD STRATEGY EXECUTION TYPES
// ==========================================

export interface TaskDependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
  createdAt: string;
}

// Extended Task Interface
// Note: We are augmenting the existing Task interface.
// Ideally we keep one definition, so we will update the previous Task interface in place
// or extend it here. Since I am replacing the end of the file, I will just export
// the extensions if I can't reach the original definition easily in this chunks.
// However, 'types.ts' is small enough I should probably update the main Task definition earlier in the file
// OR just add the fields to the interface if I had access to it.
// Wait, I am at the end of the file. The Task definition was around line 341.
// I will just add a note here that Task is extended, but for the code to compile,
// I should really update the original Task interface.
// BUT, since I can't edit non-contiguous easily without 'multi_replace',
// and I am currently in 'replace_file_content' for the END of the file...
// Actually, I can use 'multi_replace_file_content' to update both.
// For now, let's just add the types here and I will do a separate pass to update the Task interface
// at line 341 using `multi_replace` or checking if I can do it all now.
// I will assume I need to update the Task interface in a separate call or use multi_replace.
// Let's use multi_replace instead of this single replace to do it cleanly.

export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'read' | 'resolved' | 'rejected';

export interface Feedback {
  id: string;
  userId: string;
  type: FeedbackType;
  message: string;
  screenshot?: string; // Base64
  url?: string;
  status: FeedbackStatus;
  createdAt: string;
  user?: Pick<User, 'firstName' | 'lastName' | 'email'>;
}

// Legacy Invitation types removed - see INVITATION SYSTEM section above for comprehensive types

// ==========================================
// LEGAL & COMPLIANCE
// ==========================================

/** Legal Document Types (T093 canonical set) */
export type LegalDocType =
  | 'TOS'
  | 'PRIVACY'
  | 'COOKIES'
  | 'AUP'
  | 'AI_POLICY'
  | 'DPA'
  | 'SUBSCRIPTION'
  | 'SLA'
  | 'REFUNDS';

/** Legal Document (from legal_documents table) */
export interface LegalDocument {
  id: string;
  docType: LegalDocType;
  version: string;
  title: string;
  contentMd?: string;
  effectiveFrom: string;
  isActive: boolean;
  changeSummary?: string;
  expiresAt?: string;
  scopeType?: string;
  createdAt?: string;
  createdBy?: string;
}

/** Legal Acceptance Record */
export interface LegalAcceptance {
  id: string;
  docType: LegalDocType;
  version: string;
  acceptedAt: string;
  scope: 'USER' | 'ORG_ADMIN';
  organizationId?: string;
  userId: string;
}

/** Pending Legal Acceptances Response */
export interface PendingLegalDocs {
  required: LegalDocument[];
  dpaPending: boolean;
  dpaDoc?: LegalDocument;
  isOrgAdmin: boolean;
  hasAnyPending: boolean;
}

/** Legal Acceptance Status for Admin View */
export interface UserAcceptanceStatus {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  acceptanceStatus: Record<
    LegalDocType,
    {
      accepted: boolean;
      acceptedVersion?: string;
      currentVersion: string;
    }
  >;
}

// ==========================================
// STEP 13: VISUAL PLAYBOOK EDITOR TYPES
// ==========================================

/** Node types in playbook graph */
export enum PlaybookNodeType {
  START = 'START',
  ACTION = 'ACTION',
  BRANCH = 'BRANCH',
  CHECK = 'CHECK',
  END = 'END',
}

/** Single node in playbook graph */
export interface PlaybookNode {
  id: string;
  type: PlaybookNodeType;
  title: string;
  data: {
    actionType?: string;
    description?: string;
    payloadTemplate?: Record<string, unknown>;
    condition?: string;
    isOptional?: boolean;
    waitForPrevious?: boolean;
  };
  position: { x: number; y: number };
}

/** Edge connecting nodes in playbook graph */
export interface PlaybookEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

/** Complete playbook graph structure */
export interface TemplateGraph {
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
  meta: {
    trigger_signal: string;
  };
}

/** Template status enum */
export enum TemplateStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
}

/** Playbook template with versioning */
export interface PlaybookTemplateVersion {
  id: string;
  key: string;
  title: string;
  description: string;
  triggerSignal: string;
  version: number;
  status: TemplateStatus;
  templateGraph: TemplateGraph | null;
  estimatedDurationMins: number;
  publishedAt?: string;
  publishedByUserId?: string;
  parentTemplateId?: string;
  isActive: boolean;
  createdAt?: string;
  steps?: PlaybookTemplateStep[];
}

/** Template step (for legacy linear format) */
export interface PlaybookTemplateStep {
  id: string;
  stepOrder: number;
  actionType: string;
  title: string;
  description?: string;
  payloadTemplate: Record<string, unknown>;
  isOptional: boolean;
  waitForPrevious: boolean;
}

/** Validation error from template validation */
export interface TemplateValidationError {
  code: string;
  message: string;
  nodeId?: string | null;
}

/** Validation result */
export interface TemplateValidationResult {
  ok: boolean;
  errors: TemplateValidationError[];
}

/** Export format for templates */
export interface PlaybookTemplateExport {
  exportVersion: string;
  exportedAt: string;
  template: {
    key: string;
    title: string;
    description: string;
    triggerSignal: string;
    estimatedDurationMins: number;
    templateGraph: TemplateGraph | null;
    steps?: PlaybookTemplateStep[];
  };
}

// ==========================================
// CONTENT MODULE ENTERPRISE TYPES
// Email templates, categories, tags, comments, reviews, analytics
// ==========================================

/** Email template status */
export type EmailTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

/** Email template with versioning */
export interface EmailTemplate {
  id: string;
  organizationId?: string;
  templateKey: string;
  name: string;
  description?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  availableVariables: string[];
  variablesSchema?: Record<string, unknown>;
  version: number;
  status: EmailTemplateStatus;
  categoryId?: string;
  languageCode: string;
  parentTemplateId?: string;
  publishedAt?: string;
  publishedBy?: string;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // Populated relations
  category?: ContentCategory;
  tags?: ContentTag[];
}

/** Email template version (audit trail) */
export interface EmailTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  templateKey?: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variablesSchema?: string;
  changedBy?: string;
  changeNotes?: string;
  changeType: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'RESTORE';
  statusAtVersion?: EmailTemplateStatus;
  createdAt: string;
}

/** Email send tracking record */
export interface EmailSend {
  id: string;
  templateId: string;
  organizationId?: string;
  recipientEmail: string;
  recipientUserId?: string;
  subject: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED';
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  retryCount: number;
  openCount: number;
  clickCount: number;
  firstClickUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Content category (for playbooks and emails) */
export interface ContentCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  contentType: 'PLAYBOOK' | 'EMAIL' | 'ALL';
  parentId?: string;
  sortOrder: number;
  color: string;
  icon: string;
  organizationId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // Populated relations
  parent?: ContentCategory;
  children?: ContentCategory[];
}

/** Content tag */
export interface ContentTag {
  id: string;
  name: string;
  slug: string;
  contentType: 'PLAYBOOK' | 'EMAIL' | 'ALL';
  color: string;
  organizationId?: string;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
}

/** Content tag mapping */
export interface ContentTagMapping {
  id: string;
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  tagId: string;
  createdAt: string;
  createdBy?: string;
  // Populated relations
  tag?: ContentTag;
}

/** Content comment */
export interface ContentComment {
  id: string;
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  userId: string;
  commentText: string;
  parentCommentId?: string;
  threadId?: string;
  positionRef?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  mentionedUserIds: string[];
  isEdited: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  replies?: ContentComment[];
}

/** Content review status */
export type ContentReviewStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED';

/** Content review priority */
export type ContentReviewPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/** Content review */
export interface ContentReview {
  id: string;
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  requestedBy: string;
  requestedAt: string;
  reviewerId: string;
  status: ContentReviewStatus;
  reviewNotes?: string;
  checklistItems: ContentReviewChecklistItem[];
  reviewedAt?: string;
  versionAtReview?: number;
  priority: ContentReviewPriority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

/** Content review checklist item */
export interface ContentReviewChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  note?: string;
}

/** Content analytics event type */
export type ContentAnalyticsEventType =
  | 'VIEW'
  | 'EDIT'
  | 'USE'
  | 'EXPORT'
  | 'CLONE'
  | 'PUBLISH'
  | 'TEST_SEND'
  | 'PREVIEW'
  | 'DEPRECATE'
  | 'RESTORE';

/** Content analytics event */
export interface ContentAnalyticsEvent {
  id: string;
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  eventType: ContentAnalyticsEventType;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  durationMs?: number;
  createdAt: string;
}

/** Content favorite */
export interface ContentFavorite {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  notes?: string;
  folderName: string;
  createdAt: string;
}

/** Content permission type */
export type ContentPermissionType = 'VIEW' | 'EDIT' | 'DELETE' | 'PUBLISH' | 'REVIEW' | 'ADMIN';

/** Content permission grant type */
export type ContentPermissionGrantType = 'GRANT' | 'DENY';

/** Content permission */
export interface ContentPermission {
  id: string;
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE' | 'CATEGORY';
  userId?: string;
  role?: string;
  permission: ContentPermissionType;
  grantType: ContentPermissionGrantType;
  organizationId?: string;
  grantedBy?: string;
  expiresAt?: string;
  createdAt: string;
}

/** Playbook template version (for version history) */
export interface PlaybookTemplateVersionHistory {
  id: string;
  templateId: string;
  version: number;
  title: string;
  description?: string;
  triggerSignal?: string;
  templateGraph?: string;
  estimatedDurationMins?: number;
  changedBy?: string;
  changeNotes?: string;
  changeType: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'RESTORE';
  statusAtVersion?: TemplateStatus;
  createdAt: string;
}

/** Extended Playbook Template with enterprise features */
export interface PlaybookTemplateEnterprise extends PlaybookTemplateVersion {
  categoryId?: string;
  organizationId?: string;
  usageCount: number;
  lastUsedAt?: string;
  avgExecutionTimeMins?: number;
  successRate?: number;
  updatedAt: string;
  // Populated relations
  category?: ContentCategory;
  tags?: ContentTag[];
  versions?: PlaybookTemplateVersionHistory[];
  comments?: ContentComment[];
  reviews?: ContentReview[];
}

/** Content analytics aggregated stats */
export interface ContentAnalyticsStats {
  contentId: string;
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  totalEvents: number;
  uniqueUsers: number;
  uniqueOrgs: number;
  views: number;
  edits: number;
  uses: number;
  exports: number;
  clones: number;
  firstInteraction?: string;
  lastInteraction?: string;
}

/** Email template stats */
export interface EmailTemplateStats {
  id: string;
  templateKey: string;
  name: string;
  status: EmailTemplateStatus;
  version: number;
  usageCount: number;
  totalSends: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  openRate: number;
  clickRate: number;
}

/** Playbook template stats */
export interface PlaybookTemplateStats {
  id: string;
  key: string;
  title: string;
  status: TemplateStatus;
  version: number;
  usageCount: number;
  successRate?: number;
  avgExecutionTimeMins?: number;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  cancelledRuns: number;
}

/** Content search filters */
export interface ContentSearchFilters {
  query?: string;
  contentTypes?: ('PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE')[];
  statuses?: string[];
  categoryIds?: string[];
  tagIds?: string[];
  createdBy?: string;
  organizationId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/** Content search result */
export interface ContentSearchResult {
  items: (PlaybookTemplateEnterprise | EmailTemplate)[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Bulk action type */
export type ContentBulkActionType =
  | 'PUBLISH'
  | 'DEPRECATE'
  | 'DELETE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'CHANGE_CATEGORY';

/** Bulk action request */
export interface ContentBulkActionRequest {
  action: ContentBulkActionType;
  contentIds: string[];
  contentType: 'PLAYBOOK_TEMPLATE' | 'EMAIL_TEMPLATE';
  payload?: Record<string, unknown>;
}

/** Bulk action result */
export interface ContentBulkActionResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{
    contentId: string;
    error: string;
  }>;
}

/** Email test send request */
export interface EmailTestSendRequest {
  templateId: string;
  recipientEmails: string[];
  testData?: Record<string, unknown>;
}

/** Email preview request */
export interface EmailPreviewRequest {
  templateId?: string;
  subject?: string;
  htmlContent?: string;
  testData?: Record<string, unknown>;
}

/** Email preview response */
export interface EmailPreviewResponse {
  subject: string;
  html: string;
  text?: string;
  warnings?: string[];
}

/** Content analytics dashboard data */
export interface ContentAnalyticsDashboard {
  totalPlaybookTemplates: number;
  totalEmailTemplates: number;
  totalCategories: number;
  totalTags: number;
  publishedPlaybooks: number;
  publishedEmails: number;
  totalPlaybookRuns: number;
  totalEmailsSent: number;
  avgPlaybookSuccessRate: number;
  avgEmailOpenRate: number;
  avgEmailClickRate: number;
  topPlaybooks: PlaybookTemplateStats[];
  topEmails: EmailTemplateStats[];
  recentActivity: ContentAnalyticsEvent[];
  usageByCategory: Array<{
    categoryId: string;
    categoryName: string;
    playbookCount: number;
    emailCount: number;
    usageCount: number;
  }>;
  usageOverTime: Array<{
    date: string;
    playbookUses: number;
    emailSends: number;
  }>;
}

// Document Library
export type DocumentScope = 'project' | 'user';
export type DocumentStatus =
  | 'active'
  | 'archived'
  | 'deleted'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'ocr_required'
  | 'unreadable'
  | 'failed';

export interface Document {
  id: string;
  organizationId: string;
  projectId?: string;
  ownerId: string;
  ownerName?: string | null;
  scope: DocumentScope;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fileSizeBytes?: number;
  mimeType: string;
  filepath: string;
  description?: string;
  tags?: string[];
  status: DocumentStatus;
  processingError?: string | null;
  processingState?: {
    status:
      | 'not_processing'
      | 'queued'
      | 'claimed'
      | 'processing'
      | 'retry_scheduled'
      | 'stale_processing'
      | 'attention_required';
    attentionRequired: boolean;
    reason: string | null;
    jobId: string | null;
    jobStatus: string | null;
    jobUpdatedAt: string | null;
    staleAfterMs: number;
    attentionReadBack?: {
      status: 'not_required' | 'visible_to_user';
      observedAt: string | null;
    };
    recoveryAuditReadBack?: {
      status: 'not_checked' | 'not_found' | 'found';
      actionType: string | null;
      recordedAt: string | null;
    };
    acknowledgement?: {
      status: 'not_required' | 'unacknowledged' | 'acknowledged';
      acknowledgedAt: string | null;
      acknowledgedByCurrentUser: boolean;
    };
  };
  chunkCount?: number;
  sourceUpload?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadOptions {
  scope: DocumentScope;
  projectId?: string;
  description?: string;
  tags?: string[];
}

// ==========================================
// PMO PROJECT ROLES & WORKSTREAMS
// ==========================================
// Compliant with: ISO 21500:2021, PMI PMBOK 7th Edition, PRINCE2
// See: docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md

/**
 * PMO Project Role - Standardized role types aligned with global PMO standards
 *
 * ISO 21500 Mapping: Project Team Roles (Clause 4.6.2)
 * PMBOK 7 Mapping: Team Performance Domain
 * PRINCE2 Mapping: Organization Theme (Project Roles)
 */
export enum PMOProjectRole {
  /** Strategic decisions, budget authority | ISO: Project Sponsor (4.3.2) | PMBOK: Sponsor | PRINCE2: Executive */
  SPONSOR = 'SPONSOR',

  /** Final decision authority | ISO: Decision Maker (4.3.4) | PMBOK: Project Decision Authority | PRINCE2: Project Board */
  DECISION_OWNER = 'DECISION_OWNER',

  /** Overall project coordination | ISO: Project Manager (4.3.3) | PMBOK: Project Manager | PRINCE2: Project Manager */
  PMO_LEAD = 'PMO_LEAD',

  /** Workstream delivery | ISO: Work Package Manager (4.4.4) | PMBOK: Work Package Lead | PRINCE2: Team Manager */
  WORKSTREAM_OWNER = 'WORKSTREAM_OWNER',

  /** Initiative delivery | ISO: Activity Owner (4.4.5) | PMBOK: Activity Owner | PRINCE2: Work Package Owner */
  INITIATIVE_OWNER = 'INITIATIVE_OWNER',

  /** Task execution | ISO: Resource (4.6.2) | PMBOK: Team Member | PRINCE2: Team Member */
  TASK_ASSIGNEE = 'TASK_ASSIGNEE',

  /** Domain expertise | ISO: Subject Matter Expert (4.6.3) | PMBOK: Specialist | PRINCE2: Technical Consultant */
  SME = 'SME',

  /** Assessment and review | ISO: Quality Reviewer (4.7.2) | PMBOK: Quality Assessor | PRINCE2: Quality Reviewer */
  REVIEWER = 'REVIEWER',

  /** Read-only visibility | ISO: Stakeholder (4.2.2) | PMBOK: Stakeholder | PRINCE2: Stakeholder */
  OBSERVER = 'OBSERVER',

  /** Limited scope advisory | ISO: External Advisor (4.6.4) | PMBOK: External Resource | PRINCE2: External Advisor */
  CONSULTANT = 'CONSULTANT',

  /** Notifications and updates | ISO: Stakeholder (4.2.2) | PMBOK: Stakeholder | PRINCE2: Stakeholder */
  STAKEHOLDER = 'STAKEHOLDER',
}

/**
 * RACI Type for responsibility matrix
 *
 * ISO 21500: Responsibility Matrix (Clause 4.6.5)
 * PMBOK 7: RACI Chart
 * PRINCE2: Organization Theme (Responsibility Assignment)
 */
export type RACIType = 'R' | 'A' | 'C' | 'I';

/**
 * Project Permissions - Granular permission flags for project members
 */
export interface ProjectPermissions {
  // Viewing
  canViewProject: boolean;
  canViewTasks: boolean;
  canViewInitiatives: boolean;
  canViewDecisions: boolean;
  canViewFinancials: boolean;

  // Task Management
  canCreateTasks: boolean;
  canAssignTasks: boolean;
  canUpdateTasks: boolean;
  canDeleteTasks: boolean;

  // Initiative Management
  canCreateInitiatives: boolean;
  canUpdateInitiatives: boolean;
  canDeleteInitiatives: boolean;

  // Decision Management
  canRequestDecisions: boolean;
  canApproveDecisions: boolean;

  // Change Control
  canSubmitChangeRequests: boolean;
  canApproveChangeRequests: boolean;

  // Governance
  canManageTeam: boolean;
  canManageWorkstreams: boolean;
  canConfigureProject: boolean;

  // Escalation
  canEscalate: boolean;
  canReceiveEscalations: boolean;
}

/**
 * Default permissions by role
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<PMOProjectRole, ProjectPermissions> = {
  [PMOProjectRole.SPONSOR]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: true,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: true,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: true,
    canManageTeam: true,
    canManageWorkstreams: false,
    canConfigureProject: true,
    canEscalate: false,
    canReceiveEscalations: true,
  },
  [PMOProjectRole.DECISION_OWNER]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: true,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: true,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: true,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: true,
  },
  [PMOProjectRole.PMO_LEAD]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: true,
    canCreateTasks: true,
    canAssignTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: true,
    canCreateInitiatives: true,
    canUpdateInitiatives: true,
    canDeleteInitiatives: true,
    canRequestDecisions: true,
    canApproveDecisions: false,
    canSubmitChangeRequests: true,
    canApproveChangeRequests: false,
    canManageTeam: true,
    canManageWorkstreams: true,
    canConfigureProject: true,
    canEscalate: true,
    canReceiveEscalations: true,
  },
  [PMOProjectRole.WORKSTREAM_OWNER]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: false,
    canCreateTasks: true,
    canAssignTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: false,
    canCreateInitiatives: true,
    canUpdateInitiatives: true,
    canDeleteInitiatives: false,
    canRequestDecisions: true,
    canApproveDecisions: false,
    canSubmitChangeRequests: true,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: true,
    canReceiveEscalations: true,
  },
  [PMOProjectRole.INITIATIVE_OWNER]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: false,
    canCreateTasks: true,
    canAssignTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: true,
    canDeleteInitiatives: false,
    canRequestDecisions: true,
    canApproveDecisions: false,
    canSubmitChangeRequests: true,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: true,
    canReceiveEscalations: true,
  },
  [PMOProjectRole.TASK_ASSIGNEE]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: false,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: true,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: true,
    canReceiveEscalations: false,
  },
  [PMOProjectRole.SME]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: false,
  },
  [PMOProjectRole.REVIEWER]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: false,
  },
  [PMOProjectRole.OBSERVER]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: false,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: false,
  },
  [PMOProjectRole.CONSULTANT]: {
    canViewProject: true,
    canViewTasks: true,
    canViewInitiatives: true,
    canViewDecisions: true,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: false,
  },
  [PMOProjectRole.STAKEHOLDER]: {
    canViewProject: true,
    canViewTasks: false,
    canViewInitiatives: true,
    canViewDecisions: false,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: false,
  },
};

/**
 * Project Member - Individual team member assignment within a project
 *
 * ISO 21500: Project Team (Clause 4.6.2)
 * PMBOK 7: Team Performance Domain
 * PRINCE2: Organization Theme (Project Roles)
 */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;

  /** Role within this project */
  projectRole: PMOProjectRole;

  /** Optional workstream assignment */
  workstreamId?: string;

  /** Allocation percentage (0-100) */
  allocationPercent: number;

  /** Effective permissions (may be customized from defaults) */
  permissions: ProjectPermissions;

  /** Assignment period */
  startDate?: string;
  endDate?: string;

  /** Audit fields */
  createdAt: string;
  updatedAt: string;
  addedById?: string;

  /** User details (joined) */
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Workstream Status
 */
export type WorkstreamStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

/**
 * Workstream - Logical grouping of initiatives within a project
 *
 * ISO 21500: Work Breakdown Structure (Clause 4.4.3)
 * PMBOK 7: Work Package Grouping
 * PRINCE2: Work Package Cluster
 */
export interface Workstream {
  id: string;
  projectId: string;

  /** Display name */
  name: string;

  /** Description */
  description?: string;

  /** Owner of this workstream (must have WORKSTREAM_OWNER role) */
  ownerId: string;

  /** Initiatives assigned to this workstream */
  initiativeIds: string[];

  /** Status */
  status: WorkstreamStatus;

  /** Color for UI display */
  color?: string;

  /** Order for sorting */
  sortOrder: number;

  /** Audit fields */
  createdAt: string;
  updatedAt: string;

  /** Computed fields for UI (optional, populated by backend) */
  progress?: number;
  initiativeCount?: number;
  completedCount?: number;
  ownerName?: string;
}

/**
 * Task Escalation Level
 */
export type EscalationLevel = 0 | 1 | 2 | 3;

/**
 * Task Escalation - Record of escalation event
 *
 * ISO 21500: Escalation (Clause 4.3.4)
 * PMBOK 7: Escalation Path
 * PRINCE2: Exception Report
 */
export interface TaskEscalation {
  id: string;
  taskId: string;
  projectId: string;

  /** Escalation level (0→1→2→3) */
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;

  /** Who received the escalation */
  escalatedToId: string;

  /** Reason for escalation */
  reason: string;

  /** Type of escalation trigger */
  triggerType: 'SLA_BREACH' | 'BLOCKED' | 'MANUAL' | 'PRIORITY_CHANGE';

  /** Resolution (if resolved) */
  resolvedAt?: string;
  resolutionNote?: string;

  /** Audit fields */
  createdAt: string;
}

/**
 * Extended Task with PMO fields
 */
export interface TaskPMOExtension {
  /** Workstream this task belongs to */
  workstreamId?: string;

  /** SLA in hours (default 24) */
  slaHours: number;

  /** SLA due timestamp */
  slaDueAt?: string;

  /** Current escalation level (0 = not escalated) */
  escalationLevel: EscalationLevel;

  /** Who task was escalated to */
  escalatedToId?: string;

  /** Last escalation timestamp */
  lastEscalatedAt?: string;
}

/**
 * RACI Entry - Single RACI assignment
 */
export interface RACIEntry {
  objectType:
    | 'PROJECT'
    | 'INITIATIVE'
    | 'TASK'
    | 'DECISION'
    | 'CHANGE_REQUEST'
    | 'ASSESSMENT'
    | 'ROADMAP'
    | 'STAGE_GATE';
  objectId?: string;
  userId: string;
  projectRole: PMOProjectRole;
  raciType: RACIType;
}

/**
 * RACI Matrix - Complete RACI view for a project
 */
export interface RACIMatrix {
  projectId: string;
  entries: RACIEntry[];
  generatedAt: string;
}

// =====================================================
// MANAGEMENT REPORTS MODULE
// PMO Standards: ISO 21500:2021, PMBOK 7, PRINCE2
// =====================================================

/**
 * Management Report Types
 */
export type ManagementReportType =
  | 'TEAM_MEETING'
  | 'TEAM_WEEKLY'
  | 'STEERING_COMMITTEE'
  | 'PORTFOLIO_HEALTH'
  | 'RAID';
export type ManagementReportScope = 'PORTFOLIO' | 'PROJECT';
export type ManagementReportStatus = 'DRAFT' | 'FINAL' | 'APPROVED' | 'ARCHIVED';

/**
 * RAG Status (Red/Amber/Green) - PRINCE2 Traffic Light Reporting
 */
export type RAGStatus = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

/**
 * RAG Category for Steering Committee Reports
 */
export interface RAGStatusItem {
  category: 'SCHEDULE' | 'BUDGET' | 'SCOPE' | 'RISK' | 'QUALITY' | 'RESOURCES';
  status: RAGStatus;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  summary: string;
  details?: string;
}

/**
 * Overall RAG Status Grid
 */
export interface OverallRAGStatus {
  schedule: RAGStatusItem;
  budget: RAGStatusItem;
  scope: RAGStatusItem;
  risk: RAGStatusItem;
  overallHealth: RAGStatus;
  lastUpdated: string;
}

/**
 * Status Summary for Team Meeting Reports
 */
export interface TeamStatusSummary {
  progressPercent: number;
  healthStatus: RAGStatus;
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksBlocked: number;
  tasksOverdue: number;
  initiativesTotal: number;
  initiativesOnTrack: number;
  initiativesAtRisk: number;
  decisionsApproved: number;
  decisionsPending: number;
}

/**
 * Completed Work Item
 */
export interface CompletedWorkItem {
  id: string;
  type: 'TASK' | 'INITIATIVE' | 'MILESTONE' | 'DECISION';
  title: string;
  completedAt: string;
  completedBy: string;
  completedByName: string;
  projectId?: string;
  projectName?: string;
  initiativeId?: string;
  initiativeTitle?: string;
  impact?: string;
}

/**
 * Work In Progress Item
 */
export interface WorkInProgressItem {
  id: string;
  type: 'TASK' | 'INITIATIVE';
  title: string;
  assigneeId: string;
  assigneeName: string;
  progressPercent: number;
  dueDate?: string;
  daysUntilDue?: number;
  status: RAGStatus;
  projectId?: string;
  projectName?: string;
}

/**
 * Blocker Item
 */
export interface BlockerItem {
  id: string;
  type: 'TASK' | 'INITIATIVE' | 'DECISION';
  title: string;
  blockedReason: string;
  blockedSince: string;
  daysBlocked: number;
  ownerId: string;
  ownerName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  projectId?: string;
  projectName?: string;
  suggestedAction?: string;
}

/**
 * Decision Item
 */
export interface ReportDecisionItem {
  id: string;
  title: string;
  description?: string;
  decisionType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';
  ownerId: string;
  ownerName: string;
  createdAt: string;
  daysWaiting: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId?: string;
  projectName?: string;
  options?: string[];
  recommendation?: string;
}

/**
 * Planned Item for Next Period
 */
export interface PlannedItem {
  id: string;
  type: 'TASK' | 'INITIATIVE' | 'MILESTONE' | 'GATE';
  title: string;
  plannedDate: string;
  assigneeId?: string;
  assigneeName?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  projectId?: string;
  projectName?: string;
}

/**
 * KPI Metric for Steering Committee
 */
export interface KPIMetric {
  id: string;
  name: string;
  category: 'DELIVERY' | 'QUALITY' | 'COST' | 'TIME' | 'RISK' | 'RESOURCE';
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  status: RAGStatus;
  variance?: number;
  variancePercent?: number;
  sparklineData?: number[];
}

/**
 * Risk/Issue Item for Steering Committee
 */
export interface RiskIssueItem {
  id: string;
  type: 'RISK' | 'ISSUE';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probability?: 'LOW' | 'MEDIUM' | 'HIGH'; // For risks only
  impact: string;
  owner: string;
  ownerName: string;
  status: string;
  detectedAt: string;
  daysOpen: number;
  mitigationPlan?: string;
  projectId?: string;
  projectName?: string;
  requiresEscalation: boolean;
}

/**
 * Decision for Board Approval
 */
export interface DecisionForBoard {
  id: string;
  title: string;
  description: string;
  decisionType: 'BUDGET' | 'SCOPE' | 'RESOURCE' | 'TIMELINE' | 'STRATEGIC' | 'RISK_ACCEPTANCE';
  requestedBy: string;
  requestedByName: string;
  deadline: string;
  daysUntilDeadline: number;
  impact: string;
  options: {
    id: string;
    label: string;
    description: string;
    recommendation?: boolean;
    pros?: string[];
    cons?: string[];
  }[];
  projectId?: string;
  projectName?: string;
  estimatedValue?: number;
  currency?: string;
}

/**
 * Forecast Section
 */
export interface ForecastSection {
  nextMilestones: {
    id: string;
    name: string;
    plannedDate: string;
    status: RAGStatus;
    projectId?: string;
    projectName?: string;
  }[];
  nextGates: {
    id: string;
    name: string;
    gateType: string;
    plannedDate: string;
    readiness: RAGStatus;
    missingCriteria: string[];
    projectId?: string;
    projectName?: string;
  }[];
  projectedCompletion?: string;
  confidenceLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  forecastNarrative: string;
}

/**
 * Audit Trail Information (PMO Standards Compliance)
 */
export interface AuditTrailInfo {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  generatedByName: string;
  version: string;
  pmoDomain: PMODomainId;
  iso21500Mapping: string;
  pmbokMapping: string;
  prince2Mapping: string;
  dataSnapshot: {
    projectsIncluded: number;
    tasksAnalyzed: number;
    initiativesAnalyzed: number;
    decisionsAnalyzed: number;
    risksAnalyzed: number;
    dataAsOf: string;
  };
}

/**
 * Team Meeting Report Content
 */
export interface TeamMeetingReportContent {
  statusSummary: TeamStatusSummary;
  completedWork: CompletedWorkItem[];
  workInProgress: WorkInProgressItem[];
  blockers: BlockerItem[];
  pendingDecisions: ReportDecisionItem[];
  nextPeriodPlan: PlannedItem[];

  // Per-project breakdown (for portfolio reports)
  projectBreakdown?: {
    projectId: string;
    projectName: string;
    status: RAGStatus;
    tasksCompleted: number;
    tasksTotal: number;
    blockers: number;
    highlights: string[];
  }[];

  // AI-generated insights
  aiHighlights?: string[];
  aiConcerns?: string[];
}

/**
 * Team Weekly Report Content (same structure as Team Meeting)
 */
export interface TeamWeeklyReportContent extends TeamMeetingReportContent {}

/**
 * Portfolio Health Report Content
 */
export interface PortfolioHealthReportContent {
  executiveSummary: string;
  portfolioOverview: {
    totalProjects: number;
    onTrack: number;
    atRisk: number;
    critical: number;
    overallHealth: RAGStatus;
  };
  healthDrivers: {
    category: 'SCHEDULE' | 'BUDGET' | 'SCOPE' | 'RISK' | 'QUALITY' | 'RESOURCES' | 'BENEFITS';
    status: RAGStatus;
    summary: string;
  }[];
  projectHealth: {
    projectId: string;
    projectName: string;
    ownerName?: string;
    status: RAGStatus;
    keyIssues: string[];
    nextMilestone?: string;
    decisionsRequired?: number;
  }[];
  benefitsSnapshot?: {
    totalBenefits: number;
    realizedBenefits: number;
    pipelineBenefits: number;
  };
  economicsSnapshot?: {
    plannedBudget?: number;
    actualSpend?: number;
    variancePercent?: number;
  };
  risksAndIssues: RiskIssueItem[];
  decisionsRequired: DecisionForBoard[];
  nextPeriodPriorities: string[];
  warnings: string[];
  auditTrail: AuditTrailInfo;
}

/**
 * RAID Report Content (Risk, Assumption, Issue, Dependency)
 */
export interface RaidReportContent {
  executiveSummary: string;
  risks: RAIDItem[];
  assumptions: RAIDItem[];
  issues: RAIDItem[];
  dependencies: RAIDItem[];
  decisionsRequired: DecisionForBoard[];
  escalations: {
    id: string;
    level: RAGStatus;
    reason: string;
    ownerName?: string;
    dueDate?: string;
    projectId?: string;
    projectName?: string;
  }[];
  auditTrail: AuditTrailInfo;
}

/**
 * Steering Committee Report Content
 */
export interface SteeringCommitteeReportContent {
  executiveSummary: string;
  overallStatus: OverallRAGStatus;
  kpis: KPIMetric[];
  risksAndIssues: RiskIssueItem[];
  decisionsRequired: DecisionForBoard[];
  forecast: ForecastSection;

  // Per-project status (for portfolio reports)
  projectStatuses?: {
    projectId: string;
    projectName: string;
    owner: string;
    phase: string;
    status: OverallRAGStatus;
    keyIssues: string[];
    nextMilestone?: string;
  }[];

  // AI transparency - never hide bad news
  warnings: string[];

  // Audit trail
  auditTrail: AuditTrailInfo;
}

/**
 * Approval Status for Management Reports
 */
export type ReportApprovalStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Management Report
 */
export interface ManagementReport {
  id: string;
  organizationId: string;
  projectId?: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: ManagementReportStatus;
  generatedBy: string;
  generatedByName: string;
  content:
    | TeamMeetingReportContent
    | TeamWeeklyReportContent
    | SteeringCommitteeReportContent
    | PortfolioHealthReportContent
    | RaidReportContent;
  aiNarrative: string;
  aiWarnings?: string[];
  pdfPath?: string;
  pptxPath?: string;
  shareToken?: string;
  shareExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  // Enterprise fields
  currentVersion?: number;
  approvalStatus?: ReportApprovalStatus;
  requiresApproval?: boolean;
  approvalConfig?: ReportApprovalConfig;
  lockedAt?: string;
  lockedBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  integrityHash?: string;
  previousReportId?: string;
  // Period comparison
  periodComparison?: PeriodComparisonData;
}

/**
 * Management Report Generation Options
 */
export interface ManagementReportOptions {
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  projectId?: string; // Required if scope is PROJECT
  organizationId: string;
  periodDays?: number; // Default 7 for team meeting, 30 for steering
  customPeriodStart?: string;
  customPeriodEnd?: string;
  includeSections?: string[];
  excludeSections?: string[];
  aiEnhancement?: boolean;
  generatePdf?: boolean;
  generatePptx?: boolean;
}

/**
 * Management Report Schedule
 */
export interface ManagementReportSchedule {
  id: string;
  organizationId: string;
  projectId?: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  lastGeneratedAt?: string;
  nextScheduledAt?: string;
  recipients: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Report History Filter
 */
export interface ManagementReportFilter {
  organizationId: string;
  projectId?: string;
  reportType?: ManagementReportType;
  scope?: ManagementReportScope;
  status?: ManagementReportStatus;
  fromDate?: string;
  toDate?: string;
  generatedBy?: string;
  limit?: number;
  offset?: number;
}

// =====================================================
// MANAGEMENT REPORTS - ENTERPRISE FEATURES
// =====================================================

/**
 * Report Version for version history
 */
export interface ReportVersion {
  id: string;
  reportId: string;
  versionNumber: number;
  versionLabel: string;
  content: TeamMeetingReportContent | SteeringCommitteeReportContent;
  aiNarrative?: string;
  aiWarnings?: string[];
  changeSummary?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

/**
 * Approval Level Configuration
 */
export interface ApprovalLevelConfig {
  level: number;
  role: 'MANAGER' | 'PMO_LEAD' | 'SPONSOR';
  required: boolean;
  slaHours?: number;
  assignedTo?: string;
}

/**
 * Report Approval Configuration
 */
export interface ReportApprovalConfig {
  levels: ApprovalLevelConfig[];
  autoSubmit?: boolean;
  requireAllLevels?: boolean;
}

/**
 * Single Approval Record
 */
export interface ReportApproval {
  id: string;
  reportId: string;
  versionId?: string;
  approvalLevel: number;
  requiredRole: string;
  assignedTo?: string;
  assignedToName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  decisionComment?: string;
  decidedAt?: string;
  decidedBy?: string;
  decidedByName?: string;
  slaDueAt?: string;
  createdAt: string;
}

/**
 * Approval Chain Status
 */
export interface ApprovalChainStatus {
  reportId: string;
  currentLevel: number;
  totalLevels: number;
  overallStatus: ReportApprovalStatus;
  levels: ReportApproval[];
  canApprove: boolean;
  canReject: boolean;
  currentUserLevel?: number;
}

/**
 * Report Comment
 */
export interface ReportComment {
  id: string;
  reportId: string;
  versionId?: string;
  sectionId?: string;
  parentCommentId?: string;
  content: string;
  mentions?: string[];
  isResolved: boolean;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  replies?: ReportComment[];
}

/**
 * Report Audit Log Action Types
 */
export type ReportAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'VERSION_CREATED'
  | 'SUBMITTED_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'FINALIZED'
  | 'UNLOCKED'
  | 'SHARED'
  | 'SHARE_VIEWED'
  | 'EXPORTED_PDF'
  | 'EXPORTED_PPTX'
  | 'COMMENT_ADDED'
  | 'COMMENT_RESOLVED'
  | 'COMMENT_DELETED'
  | 'SCHEDULE_CREATED'
  | 'EMAIL_SENT';

/**
 * Report Audit Log Entry
 */
export interface ReportAuditEntry {
  id: string;
  reportId: string;
  versionId?: string;
  action: ReportAuditAction;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

/**
 * Period Comparison Change
 */
export interface PeriodComparisonChange {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

/**
 * Period Comparison Data
 */
export interface PeriodComparisonData {
  previousReportId?: string;
  previousPeriod?: {
    start: string;
    end: string;
  };
  hasPreviousReport: boolean;
  changes: {
    tasksCompleted?: PeriodComparisonChange;
    progressPercent?: PeriodComparisonChange;
    blockers?: PeriodComparisonChange;
    overdueTasks?: PeriodComparisonChange;
    pendingDecisions?: PeriodComparisonChange;
    criticalRisks?: PeriodComparisonChange;
    budgetVariance?: PeriodComparisonChange;
    kpis?: Record<string, PeriodComparisonChange>;
  };
}

/**
 * EVM (Earned Value Management) Metrics
 */
export interface EVMMetrics {
  pv: number; // Planned Value
  ev: number; // Earned Value
  ac: number; // Actual Cost
  bac: number; // Budget at Completion
  sv: number; // Schedule Variance (EV - PV)
  cv: number; // Cost Variance (EV - AC)
  spi: number; // Schedule Performance Index (EV / PV)
  cpi: number; // Cost Performance Index (EV / AC)
  eac: number; // Estimate at Completion
  etc: number; // Estimate to Complete
  vac: number; // Variance at Completion (BAC - EAC)
  tcpi: number; // To-Complete Performance Index
  percentComplete: number;
  asOfDate: string;
}

/**
 * Report Approval Preset
 */
export interface ReportApprovalPreset {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  reportType?: ManagementReportType;
  levels: ApprovalLevelConfig[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Version Comparison Result
 */
export interface VersionComparisonResult {
  version1: ReportVersion;
  version2: ReportVersion;
  changes: {
    field: string;
    section?: string;
    type: 'added' | 'removed' | 'modified';
    oldValue?: unknown;
    newValue?: unknown;
  }[];
  summary: string;
}

// =====================================================
// MULTI-FRAMEWORK ASSESSMENT TYPES
// =====================================================

/**
 * Framework identifiers for assessment module
 */
export type AssessmentFrameworkId = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

/**
 * Generic framework assessment score
 */
export interface FrameworkDimensionScore {
  current: number;
  target: number;
  gap: number;
  evidence?: string;
  justification?: string;
}

// =====================================================
// SIRI (Smart Industry Readiness Index) Types
// =====================================================

export type SIRIBuildingBlockId = 'PROCESS' | 'TECHNOLOGY' | 'ORGANIZATION';

export interface SIRIBlockScore {
  score: number;
  target?: number;
  dimensionScores: Record<string, number>;
}

export interface SIRIDimensionScore extends FrameworkDimensionScore {
  areaScores?: Record<string, number>;
}

export interface SIRIAssessmentData {
  buildingBlocks: Record<SIRIBuildingBlockId, SIRIBlockScore>;
  dimensions: Record<string, SIRIDimensionScore>;
  prioritisationMatrix: Record<string, number>;
  overallScore: number;
  metadata: {
    assessmentDate: string;
    version: string;
    source: 'manual' | 'imported';
  };
}

// =====================================================
// ADMA (Advanced Digital Maturity Assessment) Types
// =====================================================

export type ADMAPillarId =
  | 'strategy'
  | 'smart_products'
  | 'smart_operations'
  | 'smart_supply'
  | 'data_driven';

export interface ADMAPillarScore {
  current: number;
  target: number;
  gap: number;
  dimensionScores: Record<string, number>;
}

export interface ADMAAssessmentData {
  pillars: Record<ADMAPillarId, ADMAPillarScore>;
  dimensions: Record<string, FrameworkDimensionScore>;
  overallMaturity: number;
  metadata: {
    assessmentDate: string;
    version: string;
    source: 'manual' | 'imported';
  };
}

// =====================================================
// CMMI (Capability Maturity Model Integration) Types
// =====================================================

export type CMMICategoryId = 'DOING' | 'MANAGING' | 'ENABLING';
export type CMMIModelType = 'DEV' | 'SVC' | 'SPM';

export interface CMMIPracticeAreaScore {
  level: number; // 1-5
  target?: number;
  evidence?: string;
  gaps?: string[];
}

export interface CMMICategoryScore {
  averageLevel: number;
  practiceAreaScores: Record<string, number>;
}

export interface CMMIAssessmentData {
  maturityLevel: number;
  practiceAreas: Record<string, CMMIPracticeAreaScore>;
  categories: Record<CMMICategoryId, CMMICategoryScore>;
  overallScore: number;
  metadata: {
    assessmentDate: string;
    version: string;
    source: 'manual' | 'imported';
    model: CMMIModelType;
  };
}

// =====================================================
// DBR77 Lean 4.0 Types
// =====================================================

export type DBR77PhaseId = 'MEASURE' | 'OPTIMIZE' | 'AUTOMATE';
export type DBR77DimensionId = 'PROCESSES' | 'WORKSTATIONS';
export type DBR77WasteType =
  | 'TRANSPORTATION'
  | 'INVENTORY'
  | 'MOTION'
  | 'WAITING'
  | 'OVERPRODUCTION'
  | 'OVER_PROCESSING'
  | 'DEFECTS'
  | 'SKILLS';

export type DBR77AutomationTech =
  | 'RPA'
  | 'AI_ML'
  | 'IOT'
  | 'COBOT'
  | 'AMR'
  | 'VISION'
  | 'NLP'
  | 'DIGITAL_TWIN'
  | 'WORKFLOW'
  | 'ANALYTICS';

export type DBR77RoleEvolution = 'ELIMINATE' | 'TRANSFORM' | 'AUGMENT' | 'MAINTAIN';

export interface DBR77ProcessMetrics {
  cycleTime: number;
  taktTime: number;
  leadTime: number;
  wip: number;
  defectRate: number;
  oee: number;
  valueAddedRatio: number;
}

export interface DBR77ProcessLeanScore {
  wasteIdentified: DBR77WasteType[];
  wasteImpact: Partial<Record<DBR77WasteType, number>>;
  fiveSLevel: number;
  standardWorkDefined: boolean;
  visualManagement: number;
  continuousFlow: number;
}

export interface DBR77AutomationPotential {
  feasibility: number;
  roi: number;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedTechnologies: DBR77AutomationTech[];
  estimatedSavings: number;
  implementationTime: number;
}

export interface DBR77ProcessAssessment {
  id: string;
  name: string;
  department: string;
  category: 'VALUE_STREAM' | 'FLOW' | 'SUPPORT' | 'MANAGEMENT';
  currentState: DBR77ProcessMetrics;
  leanAssessment: DBR77ProcessLeanScore;
  automationPotential: DBR77AutomationPotential;
  priority: number;
}

export interface DBR77WorkstationMetrics {
  tasksPerDay: number;
  avgTaskTime: number;
  errorRate: number;
  overtimeHours: number;
  skillLevel: number;
  digitalMaturity: number;
}

export interface DBR77WorkstationLeanScore {
  workplaceOrganization: number;
  standardizedWork: boolean;
  wasteInRole: DBR77WasteType[];
  wasteImpact: Partial<Record<DBR77WasteType, number>>;
  crossTraining: number;
  kaizen: number;
}

export interface DBR77WorkstationAutomation {
  taskAutomationPercent: number;
  augmentationPercent: number;
  roleEvolution: DBR77RoleEvolution;
  retrainingNeeded: boolean;
  newSkillsRequired: string[];
  estimatedSavings: number;
  recommendedTechnologies: DBR77AutomationTech[];
}

export interface DBR77WorkstationAssessment {
  id: string;
  name: string;
  department: string;
  headcount: number;
  currentState: DBR77WorkstationMetrics;
  leanAssessment: DBR77WorkstationLeanScore;
  automationPotential: DBR77WorkstationAutomation;
  priority: number;
}

export interface DBR77ManagementPractices {
  dailyManagement: {
    tieredMeetings: boolean;
    visualBoards: number;
    kpiTracking: number;
    problemSolving: 'NONE' | 'BASIC' | 'A3' | 'DMAIC' | '8D';
    gembaWalks: number;
  };
  continuousImprovement: {
    kaizenEvents: number;
    suggestionSystem: boolean;
    pdcaCycles: number;
    rootCauseAnalysis: number;
  };
  peopleDevelopment: {
    trainingHoursPerYear: number;
    multiSkilling: number;
    coachingCulture: number;
  };
}

export interface DBR77AssessmentData {
  processes: DBR77ProcessAssessment[];
  workstations: DBR77WorkstationAssessment[];
  managementPractices: DBR77ManagementPractices;
  summary: {
    totalProcesses: number;
    totalWorkstations: number;
    totalHeadcount: number;
    avgLeanMaturity: number;
    avgAutomationPotential: number;
    totalEstimatedSavings: number;
    topWastes: DBR77WasteType[];
  };
  metadata: {
    assessmentDate: string;
    version: string;
    assessor?: string;
  };
}

// =====================================================
// UNIFIED MULTI-FRAMEWORK ASSESSMENT
// =====================================================

/**
 * Unified assessment data that can hold any framework's data
 */
export interface MultiFrameworkAssessment {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  framework: AssessmentFrameworkId;
  status: AssessmentStatus;

  // Framework-specific data (only one will be populated)
  drdData?: Partial<Record<DRDAxis, AxisAssessment>>;
  siriData?: SIRIAssessmentData;
  admaData?: ADMAAssessmentData;
  cmmiData?: CMMIAssessmentData;
  leanData?: DBR77AssessmentData;

  // Import metadata (for PDF imports)
  importSource?: {
    fileName: string;
    uploadedAt: string;
    parsedAt?: string;
    confidence: number;
    rawText?: string;
  };

  // Progress tracking
  progress: number; // 0-100
  completedDimensions: string[];
  totalDimensions: number;

  // Workflow
  workflowStatus?: WorkflowState;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy?: string;
}

/**
 * PDF Import result
 */
export interface PDFImportResult {
  success: boolean;
  detectedFramework?: AssessmentFrameworkId;
  confidence: number;
  extractedScores?: Record<string, number>;
  rawText?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Framework score mapping to DRD (for initiative generation)
 */
export interface FrameworkToDRDMapping {
  frameworkId: AssessmentFrameworkId;
  frameworkDimension: string;
  drdAxis: DRDAxis;
  score: number;
  normalizedScore: number; // Converted to 1-7 scale
}
