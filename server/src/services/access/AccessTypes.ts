/**
 * Access Policy Types and Constants
 */

export const ORG_TYPES = {
  DEMO: 'DEMO',
  TRIAL: 'TRIAL',
  PAID: 'PAID',
} as const;

export type OrgType = (typeof ORG_TYPES)[keyof typeof ORG_TYPES];

export const DEFAULT_TRIAL_LIMITS = {
  max_projects: 3,
  max_users: 4, // Owner + 3 invites
  max_ai_calls_per_day: 50, // Soft limit, hard limit is token budget
  max_initiatives: 5,
  max_storage_mb: 100,
  max_total_tokens: 100000,
  ai_roles_enabled_json: '["ADVISOR"]',
} as const;

export const DEFAULT_DEMO_LIMITS = {
  max_projects: 1,
  max_users: 1,
  max_ai_calls_per_day: 10,
  max_initiatives: 5,
  max_storage_mb: 10,
  max_total_tokens: 10000,
  ai_roles_enabled_json: '["ADVISOR"]',
} as const;

export const DEFAULT_PAID_LIMITS = {
  max_projects: 10000,
  max_users: 10000,
  max_ai_calls_per_day: 100000,
  max_initiatives: 10000,
  max_storage_mb: 102400,
  max_total_tokens: 100000000,
  ai_roles_enabled_json: '["ADVISOR","EXECUTOR","RESEARCHER"]',
} as const;

export const TRIAL_DURATION_DAYS = 14;

export const TRIAL_WARNING_DAYS = {
  WARNING: 7,
  CRITICAL: 3,
} as const;

// Subscription statuses used across policy snapshots and banners.
// Keep aligned with Stripe vocabulary where possible (e.g. `canceled`, `past_due`).
export const SUBSCRIPTION_STATUSES = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  CANCELING: 'canceling',
} as const;

export type SubscriptionStatus =
  | (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES]
  | null;

// Percent thresholds for usage banners/meters.
export const USAGE_THRESHOLD_PERCENT = {
  APPROACHING: 70,
  EXCEEDED: 100,
} as const;

// Entitlements matrix (feature-level) consumed by AccessPolicyService.
export const ENTITLEMENTS_MATRIX: Record<OrgType, Record<string, 'allowed' | 'blocked'>> = {
  DEMO: {
    SSO: 'blocked',
  },
  TRIAL: {},
  PAID: {},
};

export interface OrganizationType {
  id: string;
  name: string;
  organizationType: OrgType;
  trialStartedAt?: string | null;
  trialExpiresAt?: string | null;
  isActive: boolean;
  plan?: string | null;
  status?: string | null;
}

export interface OrganizationLimits {
  id?: string;
  organizationId: string;
  maxProjects: number;
  maxUsers: number;
  maxAICallsPerDay: number;
  maxInitiatives: number;
  maxStorageMb: number;
  maxTotalTokens: number;
  aiRolesEnabled: string[];
}

export interface TrialStatus {
  expired: boolean;
  daysRemaining: number;
  warningLevel: 'none' | 'warning' | 'critical' | 'expired';
}

export interface DailyUsage {
  id?: string;
  organizationId: string;
  counterDate: string;
  aiCallsCount: number;
  projectsCount: number;
  usersCount: number;
  initiativesCount: number;
  storageUsedMb: number;
}

export interface TrialUsage {
  tokensUsed: number;
}

export interface CheckAccessResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
}

export interface IsAIRoleAllowedResult {
  allowed: boolean;
  reason?: string;
}

export interface AIAccessContext {
  organizationType: OrgType;
  isDemo: boolean;
  isTrial: boolean;
  isPaid: boolean;
  trialStatus: TrialStatus;
  allowedAIRoles: string[];
  dailyAIUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
  canExecuteAIActions: boolean;
  aiResponseBadge: string | null;
}

export interface PolicySnapshot {
  orgType: OrgType;
  isDemo: boolean;
  isTrial: boolean;
  isPaid: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  trialStartedAt?: string | null;
  trialExpiresAt?: string | null;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  warningLevel: 'none' | 'warning' | 'critical' | 'expired';
  limits: {
    maxProjects: number;
    maxUsers: number;
    maxAICallsPerDay: number;
    maxInitiatives: number;
    maxStorageMb: number;
    maxTotalTokens: number;
    aiRolesEnabled: string[];
  } | null;
  usageToday: {
    aiCalls: number;
    projects: number;
    users: number;
    initiatives: number;
    storageMb: number;
    tokensUsed: number;
  };
  usagePercent: {
    aiCalls: number;
    projects: number;
    users: number;
    initiatives: number;
    storage: number;
    tokens: number;
  };
  blockedFeatures: string[];
  blockedActions: string[];
  upgradeCtas: {
    primaryAction: string;
    primaryActionKey: string;
    urlOrRoute: string;
    reason?: string;
  };
  messages: {
    bannerText: string | null;
    bannerTextKey: string | null;
    modalText: string | null;
    modalTextKey: string | null;
  };
  hasPaymentMethod: boolean;
}

export interface OrganizationRow {
  id: string;
  name: string;
  organization_type?: string | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  is_active: number;
  plan?: string | null;
  status?: string | null;
  trial_tokens_used?: number;
}

export interface OrganizationLimitsRow {
  id: string;
  organization_id: string;
  max_projects: number;
  max_users: number;
  max_ai_calls_per_day: number;
  max_initiatives: number;
  max_storage_mb: number;
  max_total_tokens?: number | null;
  ai_roles_enabled_json?: string | null;
}

export interface UsageCountersRow {
  id: string;
  organization_id: string;
  counter_date: string;
  ai_calls_count: number;
  projects_count: number;
  users_count: number;
  initiatives_count: number;
  storage_used_mb: number;
}

export interface CountRow {
  count: number;
}

export interface CanInviteUsersResult {
  allowed: boolean;
  reasonCode: string;
}

export interface SeatAvailability {
  maxSeats: number;
  currentSeats: number;
  seatsRemaining: number;
}

export interface SeatAvailabilityEnhanced extends SeatAvailability {
  utilizationPercent: number;
  baseSeatsIncluded: number;
  additionalSeatsPurchased: number;
  autoAddEnabled: boolean;
}

export interface TrialConversionResult {
  newOrganizationId: string;
  previousOrgType: OrgType;
  newOrgType: OrgType;
  convertedAt: string;
}

export interface TrialWarningResult {
  organizationId: string;
  warningLevel: 'warning' | 'critical';
  daysRemaining: number;
  notifiedUserIds: string[];
}

export interface TrialLockdownResult {
  organizationId: string;
  lockedAt: string;
  previousStatus: string;
}

export type AccessErrorCode =
  | 'ORG_NOT_FOUND'
  | 'ORG_INACTIVE'
  | 'TRIAL_EXPIRED'
  | 'TRIAL_PROFILE_INCOMPLETE'
  | 'DEMO_READ_ONLY'
  | 'DEMO_TIME_EXPIRED'
  | 'DEMO_AI_SESSION_LIMIT_REACHED'
  | 'AI_LIMIT_REACHED'
  | 'AI_TOKEN_BUDGET_EXCEEDED'
  | 'INSUFFICIENT_TOKENS'
  | 'PROJECT_LIMIT_REACHED'
  | 'INITIATIVE_LIMIT_REACHED'
  | 'USER_LIMIT_REACHED'
  | 'STORAGE_LIMIT_REACHED'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'SUBSCRIPTION_CANCELLED';
