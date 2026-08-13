/**
 * User Domain Types
 * Enterprise SaaS Architecture - User & Organization Types
 */

import type { WorkingHours } from '../core';

// ==========================================
// USER TYPES
// ==========================================

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type UserRole =
  | 'user'
  | 'admin'
  | 'owner'
  | 'super_admin'
  | 'USER'
  | 'ADMIN'
  | 'OWNER'
  | 'SUPERADMIN'
  | 'GUEST'
  | 'VIEWER'
  | 'PROJECT_MANAGER'
  | 'TEAM_MEMBER';

export type AccessLevel = 'free' | 'full' | 'trial';

/**
 * Core User entity
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  phone?: string;
  avatarUrl?: string;
  companyName?: string;
  title?: string;
  bio?: string;
  status: UserStatus;
  role: UserRole;
  accessLevel: AccessLevel;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isSuperAdmin?: boolean;
  organizationId?: string;
  organizationName?: string;
  preferences?: UserPreferences;
  profile?: UserProfile;
  security?: UserSecuritySettings;
  usage?: UserUsage;
  onboarding?: UserOnboarding;
  metadata?: UserMetadata;
  lastLoginAt?: string;
  lastLogin?: string; // Alias
  // Extended fields
  aiConfig?: any;
  timezone?: string;
  mfaEnabled?: boolean;
  preferredLanguage?: string;
  /**
   * P0.3 (2026-07-26): account-level UI interface language (en/pl/de/ar/ja/es
   * from src/i18n.ts SUPPORTED_LANGUAGES). Distinct from `preferredLanguage`
   * (AI content-generation language). SSOT priority for a logged-in session
   * is account (`language`) > localStorage > navigator — see
   * src/services/languagePreference.ts. Mirrors the same field on the
   * (separately-defined) `User` in `types/core.ts`.
   */
  language?: string;
  socialLinks?: any;
  jobTitle?: string;
  skills?: string[];
  workingHours?: any;
  statusMessage?: string;
  outOfOfficeDates?: any;
  outOfOfficeUntil?: string;
  outOfOfficeMessage?: string;
  pronouns?: string;
  isOutOfOffice?: boolean;
  birthday?: string;
  journeyState?: any;
  licensePlanId?: string;
  dateFormat?: string;
  timeFormat?: string;
  linkedinId?: string;
  department?: string;
  projectRole?: string;
  profileVisibility?: 'public' | 'team' | 'internal' | 'private';
  location?: string;
  units?: 'metric' | 'imperial';
  // UI preferences
  uiDensity?: 'compact' | 'comfortable' | 'spacious';
  startPage?: string;
  fontScale?: number;
  // Extended profile properties
  linkedAccounts?: any;
  tokenLimit?: number;
  certifications?: any[];
  education?: any[];
  workExperience?: any[];
  availabilityStatus?: 'available' | 'busy' | 'away' | 'dnd' | 'offline';
  industry?: string;
  country?: string;
  hasWorkspace?: boolean;
  impersonatorId?: string;
  isDemo?: boolean;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  units: 'metric' | 'imperial';
  currency: string;
  notifications: NotificationPreferences;
  accessibility?: AccessibilityPreferences;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'none' | 'daily' | 'weekly';
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  categories: Record<string, NotificationChannelSettings>;
}

export interface NotificationChannelSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

/**
 * Accessibility preferences
 */
export interface AccessibilityPreferences {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
}

/**
 * User profile (extended info)
 */
export interface UserProfile {
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  location?: string;
  country?: string;
  industry?: string;
  companySize?: string;
  jobFunction?: string;
  expertise?: string[];
  interests?: string[];
  workingHours?: WorkingHours;
}

// WorkingHours is re-exported from the import at the top

/**
 * User security settings
 */
export interface UserSecuritySettings {
  mfaEnabled: boolean;
  mfaMethods: MFAMethod[];
  passwordLastChanged?: string;
  loginNotifications: boolean;
  trustedDevices?: TrustedDevice[];
  activeSessions?: UserSession[];
}

export type MFAMethod = 'totp' | 'sms' | 'email' | 'webauthn';

export interface TrustedDevice {
  id: string;
  name: string;
  browser: string;
  os: string;
  lastUsed: string;
  addedAt: string;
}

export interface UserSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location?: string;
  isCurrent: boolean;
  lastActive: string;
  createdAt: string;
}

/**
 * User usage stats
 */
export interface UserUsage {
  tokenUsage: number;
  tokenLimit: number;
  storageUsed: number;
  storageLimit: number;
  projectCount: number;
  taskCount: number;
  aiCallsToday: number;
  lastAICall?: string;
}

/**
 * User onboarding state
 */
export interface UserOnboarding {
  isCompleted: boolean;
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt?: string;
  completedAt?: string;
  context?: OnboardingContext;
}

export interface OnboardingContext {
  role?: string;
  goals?: string[];
  industry?: string;
  companySize?: string;
  experience?: string;
  source?: string;
  referralCode?: string;
}

/**
 * User metadata
 */
export interface UserMetadata {
  source?: 'organic' | 'referral' | 'paid' | 'partner';
  campaign?: string;
  referredBy?: string;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
}

// ==========================================
// ORGANIZATION TYPES
// ==========================================

export type OrganizationStatus = 'active' | 'suspended' | 'cancelled' | 'trial';

export type OrganizationPlan = 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';

/**
 * Organization entity
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  plan: OrganizationPlan;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  settings: OrganizationSettings;
  branding?: OrganizationBranding;
  limits?: OrganizationLimits;
  billing?: OrganizationBillingInfo;
  features?: OrganizationFeatures;
  memberCount?: number;
  user_count?: number; // Alias for memberCount
  projectCount?: number;
  discount_percent?: number;
  discountPercent?: number; // Alias
  created_at?: string; // Legacy alias
  createdAt: string;
  updatedAt: string;
}

/**
 * Organization settings
 */
export interface OrganizationSettings {
  timezone: string;
  locale: string;
  dateFormat: string;
  currency: string;
  defaultProjectMethodology?: string;
  requireMFA?: boolean;
  allowGuestUsers?: boolean;
  allowPublicProjects?: boolean;
  domainRestriction?: string[];
  ssoEnabled?: boolean;
  ssoProvider?: string;
  dataRetentionDays?: number;
}

/**
 * Organization branding
 */
export interface OrganizationBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
  emailHeaderUrl?: string;
  loginBackgroundUrl?: string;
}

/**
 * Organization limits
 */
export interface OrganizationLimits {
  maxUsers: number;
  maxProjects: number;
  maxStorage: number;
  maxAITokensPerMonth: number;
  maxApiCallsPerMonth?: number;
  maxIntegrations?: number;
}

/**
 * Organization billing info
 */
export interface OrganizationBillingInfo {
  subscriptionId?: string;
  customerId?: string;
  planId?: string;
  billingEmail?: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  paymentMethodCount?: number;
}

import { BillingAddress } from './billing';

/**
 * Organization features (feature flags)
 */
export interface OrganizationFeatures {
  aiEnabled: boolean;
  advancedAnalytics: boolean;
  customIntegrations: boolean;
  apiAccess: boolean;
  sso: boolean;
  auditLogs: boolean;
  whitelabel: boolean;
  prioritySupport: boolean;
  customRoles: boolean;
  dataExport: boolean;
  customFields: boolean;
}

// ==========================================
// ORGANIZATION MEMBER TYPES
// ==========================================

export type OrganizationMemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'guest' | 'billing';

/**
 * Organization member
 */
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  permissions?: string[];
  teams?: string[];
  invitedBy?: string;
  invitedAt?: string;
  joinedAt?: string;
  lastActive?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Organization invitation
 */
export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  role: OrganizationRole;
  invitedBy: string;
  inviterName?: string;
  message?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

// ==========================================
// TEAM TYPES
// ==========================================

/**
 * Team entity
 */
export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  leadId?: string;
  leadName?: string;
  color?: string;
  icon?: string;
  memberCount: number;
  members?: TeamMember[];
  projects?: string[];
  settings?: TeamSettings;
  createdAt: string;
  updatedAt: string;
}

/**
 * Team member
 */
export interface TeamMember {
  userId: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  role: 'lead' | 'member';
  joinedAt: string;
}

/**
 * Team settings
 */
export interface TeamSettings {
  isPrivate: boolean;
  allowSelfJoin: boolean;
  notifyOnNewMember: boolean;
  defaultProjectRole?: string;
}

// ==========================================
// AUDIT & ACTIVITY TYPES
// ==========================================

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'invite'
  | 'join'
  | 'leave'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  changes?: AuditChange[];
  ip?: string;
  userAgent?: string;
  location?: string;
  timestamp: string;
}

export interface AuditChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * User activity
 */
export interface UserActivity {
  id: string;
  userId: string;
  type: string;
  description: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
