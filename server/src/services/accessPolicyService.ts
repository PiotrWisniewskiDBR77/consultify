import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
// Import Sub-Services
import { AccessLimitService } from './access/AccessLimitService.js';
import { AccessResourceService } from './access/AccessResourceService.js';
import { AccessTrialService } from './access/AccessTrialService.js';
// Import Types
import {
  ACCESS_POSTURES,
  AIAccessContext,
  BILLING_RAILS,
  BillingRail,
  BillingStateRow,
  CanInviteUsersResult,
  CheckAccessResult,
  CONTRACT_STATUSES,
  ContractStatus,
  DailyUsage,
  DEFAULT_DEMO_LIMITS,
  DEFAULT_TRIAL_LIMITS,
  ENTITLEMENTS_MATRIX,
  IsAIRoleAllowedResult,
  ORG_TYPES,
  OrganizationLimits,
  OrganizationType,
  OrgType,
  PolicySnapshot,
  SeatAvailability,
  SeatAvailabilityEnhanced,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
  TrialStatus,
  TrialUsage,
  USAGE_THRESHOLD_PERCENT,
} from './access/AccessTypes.js';
import { AccessUsageService } from './access/AccessUsageService.js';

// Interfaces for Deps
interface AccessPolicyDeps {
  db: IDatabase;
  limitService: AccessLimitService;
  usageService: AccessUsageService;
  trialService: AccessTrialService;
  resourceService: AccessResourceService;
  SeatManagementService: any; // Dynamic type
}

function normalizeSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s === 'active') return SUBSCRIPTION_STATUSES.ACTIVE;
  if (s === 'trialing') return SUBSCRIPTION_STATUSES.TRIALING;
  if (s === 'past_due') return SUBSCRIPTION_STATUSES.PAST_DUE;
  if (s === 'canceling' || s === 'cancelling') return SUBSCRIPTION_STATUSES.CANCELING;
  if (s === 'canceled' || s === 'cancelled') return SUBSCRIPTION_STATUSES.CANCELED;
  return null;
}

function normalizeBillingRail(raw: string | null | undefined): BillingRail {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === BILLING_RAILS.STRIPE_SUBSCRIPTION) return BILLING_RAILS.STRIPE_SUBSCRIPTION;
  if (s === BILLING_RAILS.MANUAL_INVOICE) return BILLING_RAILS.MANUAL_INVOICE;
  if (s === BILLING_RAILS.HYBRID_USAGE_INVOICE) return BILLING_RAILS.HYBRID_USAGE_INVOICE;
  return null;
}

function normalizeContractStatus(raw: string | null | undefined): ContractStatus {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === CONTRACT_STATUSES.DRAFT) return CONTRACT_STATUSES.DRAFT;
  if (s === CONTRACT_STATUSES.ACTIVE) return CONTRACT_STATUSES.ACTIVE;
  if (s === CONTRACT_STATUSES.RENEWAL_DUE) return CONTRACT_STATUSES.RENEWAL_DUE;
  if (s === CONTRACT_STATUSES.GRACE) return CONTRACT_STATUSES.GRACE;
  if (s === CONTRACT_STATUSES.SUSPENDED) return CONTRACT_STATUSES.SUSPENDED;
  if (s === CONTRACT_STATUSES.EXPIRED) return CONTRACT_STATUSES.EXPIRED;
  if (s === CONTRACT_STATUSES.CANCELED) return CONTRACT_STATUSES.CANCELED;
  return null;
}

function isDateInFuture(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const parsed = new Date(raw);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
}

function hasManualBillingAccess(
  billingRail: BillingRail,
  contractStatus: ContractStatus,
  graceUntil?: string | null,
  accessExpiresAt?: string | null
): boolean {
  if (
    billingRail !== BILLING_RAILS.MANUAL_INVOICE &&
    billingRail !== BILLING_RAILS.HYBRID_USAGE_INVOICE
  ) {
    return false;
  }
  if (contractStatus === CONTRACT_STATUSES.ACTIVE) return true;
  if (contractStatus === CONTRACT_STATUSES.RENEWAL_DUE) return true;
  if (contractStatus === CONTRACT_STATUSES.GRACE)
    return isDateInFuture(graceUntil || accessExpiresAt);
  return false;
}

function resolveOrgTypeFromBilling(
  orgType: OrgType,
  subscriptionStatus: SubscriptionStatus | null,
  billingRail: BillingRail = null,
  contractStatus: ContractStatus = null,
  graceUntil?: string | null,
  accessExpiresAt?: string | null,
  hasBillingRecord: boolean = false
) {
  if (orgType === ORG_TYPES.DEMO) return ORG_TYPES.DEMO;
  if (hasManualBillingAccess(billingRail, contractStatus, graceUntil, accessExpiresAt)) {
    return ORG_TYPES.PAID;
  }
  if (
    subscriptionStatus === SUBSCRIPTION_STATUSES.ACTIVE ||
    subscriptionStatus === SUBSCRIPTION_STATUSES.TRIALING ||
    subscriptionStatus === SUBSCRIPTION_STATUSES.CANCELING ||
    subscriptionStatus === SUBSCRIPTION_STATUSES.PAST_DUE
  ) {
    return ORG_TYPES.PAID;
  }
  if (orgType === ORG_TYPES.PAID && hasBillingRecord) {
    return ORG_TYPES.TRIAL;
  }
  return orgType;
}

function resolveAccessPosture(input: {
  orgType: OrgType;
  isDemoView: boolean;
  trialStatus: TrialStatus;
  subscriptionStatus: SubscriptionStatus | null;
  billingRail: BillingRail;
  contractStatus: ContractStatus;
  graceUntil?: string | null;
  accessExpiresAt?: string | null;
}) {
  const {
    orgType,
    isDemoView,
    trialStatus,
    subscriptionStatus,
    billingRail,
    contractStatus,
    graceUntil,
    accessExpiresAt,
  } = input;

  if (orgType === ORG_TYPES.DEMO) {
    return isDemoView ? ACCESS_POSTURES.DEMO_VIEW : ACCESS_POSTURES.DEMO_ORG;
  }

  if (
    billingRail === BILLING_RAILS.MANUAL_INVOICE ||
    billingRail === BILLING_RAILS.HYBRID_USAGE_INVOICE
  ) {
    if (contractStatus === CONTRACT_STATUSES.SUSPENDED) return ACCESS_POSTURES.SUSPENDED;
    if (contractStatus === CONTRACT_STATUSES.RENEWAL_DUE)
      return ACCESS_POSTURES.PAID_MANUAL_RENEWAL_DUE;
    if (hasManualBillingAccess(billingRail, contractStatus, graceUntil, accessExpiresAt)) {
      return ACCESS_POSTURES.PAID_MANUAL_ACTIVE;
    }
  }

  if (subscriptionStatus === SUBSCRIPTION_STATUSES.PAST_DUE) {
    return ACCESS_POSTURES.PAID_PAST_DUE;
  }
  if (subscriptionStatus === SUBSCRIPTION_STATUSES.CANCELING) {
    return ACCESS_POSTURES.PAID_CANCELING;
  }
  if (
    subscriptionStatus === SUBSCRIPTION_STATUSES.ACTIVE ||
    subscriptionStatus === SUBSCRIPTION_STATUSES.TRIALING
  ) {
    return ACCESS_POSTURES.PAID_ACTIVE;
  }
  if (trialStatus.expired) {
    return ACCESS_POSTURES.TRIAL_EXPIRED;
  }
  if (trialStatus.warningLevel === 'warning' || trialStatus.warningLevel === 'critical') {
    return ACCESS_POSTURES.TRIAL_EXPIRING;
  }
  return ACCESS_POSTURES.TRIAL_ACTIVE;
}

class AccessPolicyServiceClass {
  private deps: AccessPolicyDeps;

  constructor() {
    const db = getDatabase();
    const limitService = new AccessLimitService(db);
    this.deps = {
      db,
      limitService,
      usageService: new AccessUsageService(db),
      trialService: new AccessTrialService(limitService),
      resourceService: new AccessResourceService(db),
      SeatManagementService: null,
    };
  }

  /**
   * Initialize dynamic dependencies
   */
  private async initDeps(): Promise<void> {
    if (!this.deps.SeatManagementService) {
      const seatModule = await import('./seatManagementService.js');
      this.deps.SeatManagementService = seatModule.default || seatModule;
    }
  }

  /**
   * Set dependencies (for testing)
   */
  public setDependencies(newDeps: Partial<AccessPolicyDeps>): void {
    if (newDeps.db) {
      this.deps.db = newDeps.db;
      this.deps.limitService.setDependencies({ db: newDeps.db });
      this.deps.usageService.setDependencies({ db: newDeps.db });
      this.deps.resourceService.setDependencies({ db: newDeps.db });
      this.deps.trialService.setDependencies({ limitService: this.deps.limitService });
    }
    if (newDeps.limitService) {
      this.deps.limitService = newDeps.limitService;
      // Update trial service to use new limit service
      this.deps.trialService.setDependencies({ limitService: newDeps.limitService });
    }
    if (newDeps.usageService) this.deps.usageService = newDeps.usageService;
    if (newDeps.trialService) this.deps.trialService = newDeps.trialService;
    if (newDeps.resourceService) this.deps.resourceService = newDeps.resourceService;
    if (newDeps.SeatManagementService)
      this.deps.SeatManagementService = newDeps.SeatManagementService;
  }

  // ==========================================
  // LIMIT SERVICE DELEGATES
  // ==========================================

  async getOrganizationType(organizationId: string): Promise<OrganizationType | null> {
    return this.deps.limitService.getOrganizationType(organizationId);
  }

  async getOrganizationLimits(organizationId: string): Promise<OrganizationLimits | null> {
    return this.deps.limitService.getOrganizationLimits(organizationId);
  }

  async createDefaultLimits(
    organizationId: string,
    orgType: OrgType = ORG_TYPES.TRIAL
  ): Promise<void> {
    return this.deps.limitService.createDefaultLimits(organizationId, orgType);
  }

  async removeLimits(organizationId: string): Promise<void> {
    return this.deps.limitService.removeLimits(organizationId);
  }

  // ==========================================
  // TRIAL SERVICE DELEGATES
  // ==========================================

  async checkTrialStatus(organizationId: string): Promise<TrialStatus> {
    return this.deps.trialService.checkTrialStatus(organizationId);
  }

  // ==========================================
  // USAGE SERVICE DELEGATES
  // ==========================================

  async getDailyUsage(organizationId: string): Promise<DailyUsage> {
    return this.deps.usageService.getDailyUsage(organizationId);
  }

  async incrementUsage(
    organizationId: string,
    counterType: 'ai_calls' | 'projects' | 'users' | 'initiatives' | 'storage',
    amount: number = 1
  ): Promise<void> {
    return this.deps.usageService.incrementUsage(organizationId, counterType, amount);
  }

  async trackTokenUsage(organizationId: string, tokens: number): Promise<void> {
    return this.deps.usageService.trackTokenUsage(organizationId, tokens);
  }

  async getTrialUsage(organizationId: string): Promise<TrialUsage> {
    return this.deps.usageService.getTrialUsage(organizationId);
  }

  // ==========================================
  // COMPLEX LOGIC (Aggregate)
  // ==========================================

  async checkAccess(
    organizationId: string,
    action: 'create_project' | 'create_initiative' | 'invite_user' | 'ai_call' | 'upload' | 'write'
  ): Promise<CheckAccessResult> {
    try {
      const [orgInfo, trialStatus, limits, usage, trialUsage, billingRow] = await Promise.all([
        this.getOrganizationType(organizationId),
        this.checkTrialStatus(organizationId),
        this.getOrganizationLimits(organizationId),
        this.getDailyUsage(organizationId),
        this.getTrialUsage(organizationId),
        DbPromise.get<BillingStateRow>(
          this.deps.db,
          `SELECT status, billing_rail, contract_status, grace_until, access_expires_at
           FROM organization_billing WHERE organization_id = ?`,
          [organizationId],
          { fallback: true }
        ),
      ]);

      if (!orgInfo)
        return { allowed: false, reason: 'Organization not found', errorCode: 'ORG_NOT_FOUND' };
      if (!orgInfo.isActive)
        return { allowed: false, reason: 'Organization is inactive', errorCode: 'ORG_INACTIVE' };

      const subscriptionStatus = normalizeSubscriptionStatus((billingRow as any)?.status);
      const billingRail = normalizeBillingRail((billingRow as any)?.billing_rail);
      const contractStatus = normalizeContractStatus((billingRow as any)?.contract_status);
      const effectiveOrgType = resolveOrgTypeFromBilling(
        orgInfo.organizationType,
        subscriptionStatus,
        billingRail,
        contractStatus,
        (billingRow as any)?.grace_until,
        (billingRow as any)?.access_expires_at,
        Boolean(billingRow)
      );

      // Dunning / past-due restrictions (Stripe is SSOT).
      if (
        subscriptionStatus === SUBSCRIPTION_STATUSES.PAST_DUE ||
        contractStatus === CONTRACT_STATUSES.SUSPENDED
      ) {
        const blockedWhenPastDue = new Set([
          'create_project',
          'create_initiative',
          'invite_user',
          'ai_call',
          'upload',
          'write',
        ]);
        if (blockedWhenPastDue.has(action)) {
          return {
            allowed: false,
            reason:
              contractStatus === CONTRACT_STATUSES.SUSPENDED
                ? 'Your contract is suspended. Please contact your account team to restore access.'
                : 'Payment failed. Please update your payment method to restore access.',
            errorCode:
              contractStatus === CONTRACT_STATUSES.SUSPENDED
                ? 'SUBSCRIPTION_CANCELLED'
                : 'SUBSCRIPTION_PAST_DUE',
          };
        }
      }

      // Trial Expired check
      if (trialStatus.expired && effectiveOrgType !== ORG_TYPES.PAID) {
        return {
          allowed: false,
          reason: 'Trial period has expired. Please upgrade to continue.',
          errorCode: 'TRIAL_EXPIRED',
        };
      }

      // Demo Mode check
      if (effectiveOrgType === ORG_TYPES.DEMO) {
        const writeActions = [
          'create_project',
          'create_initiative',
          'invite_user',
          'upload',
          'write',
        ];
        if (writeActions.includes(action)) {
          return {
            allowed: false,
            reason: 'Demo mode is read-only. Start a free trial to create your own data.',
            errorCode: 'DEMO_READ_ONLY',
          };
        }
      }

      // Trial gating: allow first AI interactions before requiring org setup completion.
      // This preserves the "aha moment" and avoids hard onboarding walls right after signup.
      if (effectiveOrgType === ORG_TYPES.TRIAL && action === 'ai_call') {
        try {
          const row = await DbPromise.get<{ onboarding_status?: string | null }>(
            this.deps.db,
            `SELECT onboarding_status FROM organizations WHERE id = ?`,
            [organizationId],
            { fallback: false }
          );
          if ((row as any)?.onboarding_status !== 'ORG_SETUP_COMPLETED') {
            const graceAiCalls = 3;
            if ((usage.aiCallsCount || 0) < graceAiCalls) {
              return { allowed: true };
            }
            return {
              allowed: false,
              reason: 'Please complete organization setup to start your trial AI experience.',
              errorCode: 'TRIAL_PROFILE_INCOMPLETE',
            };
          }
        } catch (onboardingError) {
          logger.error(
            '[AccessPolicyService] Failed to verify onboarding status:',
            onboardingError
          );
          return {
            allowed: false,
            reason: 'We could not verify your trial onboarding status. Please try again shortly.',
            errorCode: 'TRIAL_ONBOARDING_STATUS_UNAVAILABLE',
          };
        }
      }

      // Paid check
      if (effectiveOrgType === ORG_TYPES.PAID) return { allowed: true };

      if (!limits) return { allowed: true };

      // Check specific limits
      switch (action) {
        case 'create_project': {
          const count = await this.deps.resourceService.countOrgProjects(organizationId);
          if (count >= limits.maxProjects) {
            return {
              allowed: false,
              reason: `Project limit reached (${limits.maxProjects}). Upgrade to create more projects.`,
              errorCode: 'PROJECT_LIMIT_REACHED',
            };
          }
          break;
        }
        case 'create_initiative': {
          const count = await this.deps.resourceService.countOrgInitiatives(organizationId);
          if (count >= limits.maxInitiatives) {
            return {
              allowed: false,
              reason: `Initiative limit reached (${limits.maxInitiatives}). Upgrade to create more initiatives.`,
              errorCode: 'INITIATIVE_LIMIT_REACHED',
            };
          }
          break;
        }
        case 'invite_user': {
          const count = await this.deps.resourceService.countOrgUsers(organizationId);
          if (count >= limits.maxUsers) {
            return {
              allowed: false,
              reason: `User limit reached (${limits.maxUsers}). Upgrade to invite more users.`,
              errorCode: 'USER_LIMIT_REACHED',
            };
          }
          break;
        }
        case 'ai_call': {
          if (usage.aiCallsCount >= limits.maxAICallsPerDay) {
            return {
              allowed: false,
              reason: `Daily AI call limit reached (${limits.maxAICallsPerDay}). Upgrade for unlimited AI access.`,
              errorCode: 'AI_LIMIT_REACHED',
            };
          }
          if (limits.maxTotalTokens && trialUsage.tokensUsed >= limits.maxTotalTokens) {
            // Hybrid trial: if a payment method exists, allow AI beyond free budget (PAYG/hybrid)
            try {
              if (orgInfo.organizationType === ORG_TYPES.TRIAL) {
                const row = await DbPromise.get<{ count: number | string }>(
                  this.deps.db,
                  `SELECT COUNT(*) as count FROM payment_methods WHERE organization_id = ?`,
                  [organizationId],
                  { fallback: false }
                );
                const count = parseInt(String((row as any)?.count ?? 0), 10) || 0;
                if (count > 0) {
                  break;
                }
              }
            } catch (pmErr) {
              // fail closed for token budget enforcement
            }
            return {
              allowed: false,
              reason: `Trial AI token budget exceeded (${limits.maxTotalTokens}). Add a payment method or upgrade to continue using AI features.`,
              errorCode: 'AI_TOKEN_BUDGET_EXCEEDED',
            };
          }
          break;
        }
        case 'upload': {
          if (usage.storageUsedMb >= limits.maxStorageMb) {
            return {
              allowed: false,
              reason: `Storage limit reached (${limits.maxStorageMb}MB). Upgrade for more storage.`,
              errorCode: 'STORAGE_LIMIT_REACHED',
            };
          }
          break;
        }
      }

      return { allowed: true };
    } catch (error: unknown) {
      logger.error('[AccessPolicyService] Error checking access:', error);
      return {
        allowed: false,
        reason: 'Access policy is temporarily unavailable. Please try again in a moment.',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
      };
    }
  }

  async isAIRoleAllowed(organizationId: string, aiRole: string): Promise<IsAIRoleAllowedResult> {
    const limits = await this.getOrganizationLimits(organizationId);
    if (!limits || !limits.aiRolesEnabled) {
      return {
        allowed: aiRole === 'ADVISOR',
        reason: aiRole !== 'ADVISOR' ? 'Only ADVISOR role is available in trial mode.' : undefined,
      };
    }
    const allowed = limits.aiRolesEnabled.includes(aiRole);
    return {
      allowed,
      reason: allowed
        ? undefined
        : `${aiRole} role is not available in your current plan. Upgrade to unlock additional AI capabilities.`,
    };
  }

  async getAIAccessContext(organizationId: string): Promise<AIAccessContext> {
    const [orgInfo, trialStatus, limits, usage, billingRow] = await Promise.all([
      this.getOrganizationType(organizationId),
      this.checkTrialStatus(organizationId),
      this.getOrganizationLimits(organizationId),
      this.getDailyUsage(organizationId),
      DbPromise.get<BillingStateRow>(
        this.deps.db,
        `SELECT status, billing_rail, contract_status, grace_until, access_expires_at
         FROM organization_billing WHERE organization_id = ?`,
        [organizationId],
        { fallback: true }
      ),
    ]);
    const subscriptionStatus = normalizeSubscriptionStatus((billingRow as any)?.status);
    const billingRail = normalizeBillingRail((billingRow as any)?.billing_rail);
    const contractStatus = normalizeContractStatus((billingRow as any)?.contract_status);
    const effectiveOrgType = resolveOrgTypeFromBilling(
      orgInfo?.organizationType || ORG_TYPES.TRIAL,
      subscriptionStatus,
      billingRail,
      contractStatus,
      (billingRow as any)?.grace_until,
      (billingRow as any)?.access_expires_at,
      Boolean(billingRow)
    );
    return {
      organizationType: effectiveOrgType,
      isDemo: effectiveOrgType === ORG_TYPES.DEMO,
      isTrial: effectiveOrgType === ORG_TYPES.TRIAL,
      isPaid: effectiveOrgType === ORG_TYPES.PAID,
      trialStatus,
      allowedAIRoles: limits?.aiRolesEnabled || ['ADVISOR'],
      dailyAIUsage: {
        used: usage?.aiCallsCount || 0,
        limit: limits?.maxAICallsPerDay || 50,
        remaining: Math.max(0, (limits?.maxAICallsPerDay || 50) - (usage?.aiCallsCount || 0)),
      },
      canExecuteAIActions: effectiveOrgType === ORG_TYPES.PAID,
      aiResponseBadge:
        effectiveOrgType === ORG_TYPES.DEMO
          ? '🎯 Demo AI'
          : effectiveOrgType === ORG_TYPES.TRIAL
            ? '🔬 Trial AI'
            : null,
    };
  }

  async buildPolicySnapshot(
    organizationId: string,
    options?: { isDemoView?: boolean }
  ): Promise<PolicySnapshot | null> {
    const [orgInfo, trialStatus, limits, usage, trialUsage, billingRow] = await Promise.all([
      this.getOrganizationType(organizationId),
      this.checkTrialStatus(organizationId),
      this.getOrganizationLimits(organizationId),
      this.getDailyUsage(organizationId),
      this.getTrialUsage(organizationId),
      DbPromise.get<BillingStateRow>(
        this.deps.db,
        `SELECT status, subscription_plan_id, billing_rail, contract_status, renewal_at, grace_until,
                access_expires_at, managed_by_user_id, is_manual_override
         FROM organization_billing WHERE organization_id = ?`,
        [organizationId],
        { fallback: true }
      ),
    ]);

    if (!orgInfo) return null;

    const subscriptionStatus = normalizeSubscriptionStatus((billingRow as any)?.status);
    const billingRail = normalizeBillingRail((billingRow as any)?.billing_rail);
    const contractStatus = normalizeContractStatus((billingRow as any)?.contract_status);
    const renewalAt = (billingRow as any)?.renewal_at || null;
    const graceUntil = (billingRow as any)?.grace_until || null;
    const accessExpiresAt = (billingRow as any)?.access_expires_at || null;
    const managedByUserId = (billingRow as any)?.managed_by_user_id || null;
    const isManualBilling =
      billingRail === BILLING_RAILS.MANUAL_INVOICE ||
      billingRail === BILLING_RAILS.HYBRID_USAGE_INVOICE;
    const effectiveOrgType = resolveOrgTypeFromBilling(
      orgInfo.organizationType,
      subscriptionStatus,
      billingRail,
      contractStatus,
      graceUntil,
      accessExpiresAt,
      Boolean(billingRow)
    );

    const isDemo = effectiveOrgType === ORG_TYPES.DEMO;
    const isTrial = effectiveOrgType === ORG_TYPES.TRIAL;
    const isPaid = effectiveOrgType === ORG_TYPES.PAID;
    const isDemoView = Boolean(options?.isDemoView && isDemo);
    const posture = resolveAccessPosture({
      orgType: effectiveOrgType,
      isDemoView,
      trialStatus,
      subscriptionStatus,
      billingRail,
      contractStatus,
      graceUntil,
      accessExpiresAt,
    });

    const projectCount = await this.deps.resourceService.countOrgProjects(organizationId);
    const userCount = await this.deps.resourceService.countOrgUsers(organizationId);
    let initiativeCount = 0;
    try {
      initiativeCount = await this.deps.resourceService.countOrgInitiatives(organizationId);
    } catch {
      // fail open
    }

    let hasPaymentMethod = false;
    try {
      const pmRow = await DbPromise.get<{ count: number | string }>(
        this.deps.db,
        `SELECT COUNT(*) as count FROM payment_methods WHERE organization_id = ?`,
        [organizationId],
        { fallback: false }
      );
      hasPaymentMethod = parseInt(String((pmRow as any)?.count ?? 0), 10) > 0;
    } catch {
      // table may not exist
    }

    const blockedFeatures: string[] = [];
    const blockedActions: string[] = [];
    const entitlements = ENTITLEMENTS_MATRIX[effectiveOrgType] || {};

    for (const [feature, status] of Object.entries(entitlements)) {
      if (status === 'blocked') {
        blockedFeatures.push(feature.toUpperCase());
      }
    }

    if (isDemo) {
      blockedActions.push(
        'AI_DO_ACTIONS',
        'INVITES',
        'EXPORT',
        'CREATE_PROJECT',
        'CREATE_INITIATIVE',
        'WRITE'
      );
    } else if (isTrial && trialStatus.expired) {
      blockedActions.push(
        'AI_DO_ACTIONS',
        'INVITES',
        'EXPORT',
        'CREATE_PROJECT',
        'CREATE_INITIATIVE',
        'WRITE'
      );
    }

    if (posture === ACCESS_POSTURES.PAID_PAST_DUE || posture === ACCESS_POSTURES.SUSPENDED) {
      blockedActions.push(
        'AI_DO_ACTIONS',
        'CREATE_PROJECT',
        'CREATE_INITIATIVE',
        'INVITES',
        'WRITE'
      );
    }

    const subscribedPlanId = (billingRow as any)?.subscription_plan_id as string | null | undefined;
    let resolvedLimits: OrganizationLimits | null = limits;
    if (subscribedPlanId) {
      try {
        const orgLimitRow = await DbPromise.get<{
          max_storage_mb?: number | null;
          max_total_tokens?: number | null;
        }>(
          this.deps.db,
          `SELECT max_storage_mb, max_total_tokens FROM organization_limits WHERE organization_id = ?`,
          [organizationId],
          { fallback: true }
        );
        const planRow = await DbPromise.get<{
          limits?: string | null;
          token_limit?: number | null;
          storage_limit_gb?: number | null;
        }>(
          this.deps.db,
          `SELECT limits, token_limit, storage_limit_gb FROM subscription_plans WHERE id = ?`,
          [subscribedPlanId],
          { fallback: true }
        );
        const planLimits = planRow?.limits ? JSON.parse(planRow.limits) : {};
        const orgTokenOverride =
          typeof orgLimitRow?.max_total_tokens === 'number'
            ? orgLimitRow.max_total_tokens
            : undefined;
        const orgStorageOverride =
          typeof orgLimitRow?.max_storage_mb === 'number' ? orgLimitRow.max_storage_mb : undefined;
        const planTokenLimit =
          typeof (planLimits as any)?.tokens === 'number'
            ? (planLimits as any).tokens
            : typeof planRow?.token_limit === 'number'
              ? planRow.token_limit
              : undefined;
        const planStorageMb =
          typeof (planLimits as any)?.storage_gb === 'number'
            ? Math.round((planLimits as any).storage_gb * 1024)
            : typeof planRow?.storage_limit_gb === 'number'
              ? Math.round(planRow.storage_limit_gb * 1024)
              : undefined;
        const tokens = orgTokenOverride ?? planTokenLimit;
        const storageMb = orgStorageOverride ?? planStorageMb;

        if (!resolvedLimits) {
          resolvedLimits = {
            organizationId,
            maxProjects: -1,
            maxUsers: -1,
            maxAICallsPerDay: -1,
            maxInitiatives: -1,
            maxStorageMb: storageMb ?? -1,
            maxTotalTokens: tokens ?? -1,
            aiRolesEnabled: ['ADVISOR'],
          };
        } else {
          resolvedLimits = {
            ...resolvedLimits,
            maxTotalTokens: tokens ?? resolvedLimits.maxTotalTokens,
            maxStorageMb: storageMb ?? resolvedLimits.maxStorageMb,
          };
        }
      } catch {
        // fail open
      }
    }

    if ((isTrial || isDemo) && resolvedLimits) {
      if (projectCount >= resolvedLimits.maxProjects && resolvedLimits.maxProjects >= 0) {
        blockedActions.push('CREATE_PROJECT');
      }
      if (userCount >= resolvedLimits.maxUsers && resolvedLimits.maxUsers >= 0) {
        blockedActions.push('INVITES');
      }
      if (
        usage.aiCallsCount >= resolvedLimits.maxAICallsPerDay &&
        resolvedLimits.maxAICallsPerDay >= 0
      ) {
        blockedActions.push('AI_CALL');
      }
      if (initiativeCount >= resolvedLimits.maxInitiatives && resolvedLimits.maxInitiatives >= 0) {
        blockedActions.push('CREATE_INITIATIVE');
      }
      if (
        resolvedLimits.maxTotalTokens > 0 &&
        trialUsage.tokensUsed >= resolvedLimits.maxTotalTokens &&
        !hasPaymentMethod &&
        !isManualBilling
      ) {
        blockedActions.push('AI_TOKEN_BUDGET');
      }
    }

    const safePercent = (used: number, limit: number): number => {
      if (limit <= 0) return 0;
      return Math.min(100, Math.round((used / limit) * 100));
    };

    const usagePercent = {
      aiCalls: safePercent(usage?.aiCallsCount || 0, resolvedLimits?.maxAICallsPerDay || 1),
      projects: safePercent(projectCount, resolvedLimits?.maxProjects || 1),
      users: safePercent(userCount, resolvedLimits?.maxUsers || 1),
      initiatives: safePercent(initiativeCount, resolvedLimits?.maxInitiatives || 1),
      storage: safePercent(usage?.storageUsedMb || 0, resolvedLimits?.maxStorageMb || 1),
      tokens: safePercent(trialUsage.tokensUsed, resolvedLimits?.maxTotalTokens || 1),
    };

    let bannerText: string | null = null;
    let bannerTextKey: string | null = null;
    let modalText: string | null = null;
    let modalTextKey: string | null = null;
    let primaryAction = 'Upgrade Plan';
    let primaryActionKey = 'access.cta.upgradePlan';
    let ctaReason: string | undefined;
    let ctaUrlOrRoute = '/settings?tab=billing';

    if (isDemo) {
      bannerText = isDemoView
        ? 'You are exploring the Atelier Toys demo workspace.'
        : 'You are viewing a demo environment (read-only)';
      bannerTextKey = 'access.banner.demo';
      primaryAction = 'Start Trial';
      primaryActionKey = 'access.cta.startTrial';
      ctaReason = 'demo_mode';
      ctaUrlOrRoute = '/trial/start';
    } else if (posture === ACCESS_POSTURES.PAID_PAST_DUE) {
      bannerText =
        'Payment failed. Please update your payment method to avoid service interruption.';
      bannerTextKey = 'access.banner.pastDue';
      primaryAction = 'Fix Payment';
      primaryActionKey = 'access.cta.fixPayment';
      ctaReason = 'payment_failed';
      ctaUrlOrRoute = '/settings?tab=billing';
    } else if (posture === ACCESS_POSTURES.PAID_CANCELING) {
      bannerText = 'Your subscription will end at the close of the current billing period.';
      bannerTextKey = 'access.banner.canceling';
      primaryAction = 'Renew Subscription';
      primaryActionKey = 'access.cta.renewSubscription';
      ctaReason = 'subscription_canceling';
      ctaUrlOrRoute = '/settings?tab=billing';
    } else if (posture === ACCESS_POSTURES.SUSPENDED) {
      bannerText = 'Your contract is suspended. Contact your account team to restore access.';
      bannerTextKey = 'access.banner.contractSuspended';
      primaryAction = 'Contact Account Team';
      primaryActionKey = 'access.cta.contactAccountTeam';
      ctaReason = 'contract_suspended';
      ctaUrlOrRoute = '/legal/contact?topic=billing&reason=contract_suspended';
    } else if (posture === ACCESS_POSTURES.PAID_MANUAL_RENEWAL_DUE) {
      bannerText =
        'Your contract is nearing renewal. Coordinate the next term with your account team.';
      bannerTextKey = 'access.banner.contractRenewalDue';
      primaryAction = 'Renew Contract';
      primaryActionKey = 'access.cta.renewContract';
      ctaReason = 'contract_renewal_due';
      ctaUrlOrRoute = '/legal/contact?topic=billing&reason=contract_renewal_due';
    } else if (isTrial && trialStatus.expired) {
      bannerText = 'Your trial has expired. Upgrade to continue.';
      bannerTextKey = 'access.banner.trialExpired';
      modalText =
        'Your trial period has ended. Your data is safe, but your organization is now in read-only mode. Upgrade to restore full access.';
      modalTextKey = 'access.modal.trialExpired';
      primaryAction = 'Upgrade Now';
      primaryActionKey = 'access.cta.upgradeNow';
      ctaReason = 'trial_expired';
      ctaUrlOrRoute = '/settings?tab=billing';
    } else if (isTrial && trialStatus.warningLevel === 'critical') {
      bannerText = `Trial expires in ${trialStatus.daysRemaining} day${trialStatus.daysRemaining !== 1 ? 's' : ''}. Upgrade now to keep full access.`;
      bannerTextKey = 'access.banner.trialCritical';
    } else if (isTrial && trialStatus.warningLevel === 'warning') {
      bannerText = `${trialStatus.daysRemaining} day${trialStatus.daysRemaining !== 1 ? 's' : ''} remaining`;
      bannerTextKey = 'access.banner.trialWarning';
    }

    const anyApproaching = Object.values(usagePercent).some(
      (p) => p >= USAGE_THRESHOLD_PERCENT.APPROACHING && p < USAGE_THRESHOLD_PERCENT.EXCEEDED
    );
    if (isTrial && !trialStatus.expired && anyApproaching && !bannerText) {
      bannerText =
        'You are approaching your usage limits. Consider upgrading for uninterrupted access.';
      bannerTextKey = 'access.banner.approachingLimits';
    }

    if (
      isTrial &&
      resolvedLimits &&
      resolvedLimits.maxTotalTokens > 0 &&
      trialUsage.tokensUsed >= resolvedLimits.maxTotalTokens &&
      !hasPaymentMethod &&
      !isManualBilling
    ) {
      primaryAction = 'Add Payment Method';
      primaryActionKey = 'access.cta.addPaymentMethod';
      ctaReason = 'token_budget_exceeded';
      ctaUrlOrRoute = '/settings?tab=billing';
    }

    return {
      orgType: effectiveOrgType,
      posture,
      isDemo,
      isDemoView,
      isTrial,
      isPaid,
      billingRail,
      contractStatus,
      subscriptionStatus,
      sourceOfTruth: isDemo
        ? 'demo_mode'
        : isManualBilling
          ? 'manual_contract'
          : isPaid
            ? 'stripe'
            : 'trial_clock',
      trialStartedAt: orgInfo.trialStartedAt,
      trialExpiresAt: orgInfo.trialExpiresAt,
      trialDaysLeft: trialStatus.daysRemaining,
      isTrialExpired: trialStatus.expired,
      warningLevel: trialStatus.warningLevel,
      renewalAt,
      graceUntil,
      accessExpiresAt,
      managedByUserId,
      isManualBilling,
      limits: resolvedLimits
        ? {
            maxProjects: resolvedLimits.maxProjects,
            maxUsers: resolvedLimits.maxUsers,
            maxAICallsPerDay: resolvedLimits.maxAICallsPerDay,
            maxInitiatives: resolvedLimits.maxInitiatives,
            maxStorageMb: resolvedLimits.maxStorageMb,
            maxTotalTokens: resolvedLimits.maxTotalTokens,
            aiRolesEnabled: resolvedLimits.aiRolesEnabled,
          }
        : null,
      usageToday: {
        aiCalls: usage?.aiCallsCount || 0,
        projects: projectCount,
        users: userCount,
        initiatives: initiativeCount,
        storageMb: usage?.storageUsedMb || 0,
        tokensUsed: trialUsage.tokensUsed,
      },
      usagePercent,
      blockedFeatures: [...new Set(blockedFeatures)],
      blockedActions: [...new Set(blockedActions)],
      upgradeCtas: {
        primaryAction,
        primaryActionKey,
        urlOrRoute: ctaUrlOrRoute,
        reason: ctaReason,
      },
      messages: {
        bannerText,
        bannerTextKey,
        modalText,
        modalTextKey,
      },
      hasPaymentMethod,
    };
  }

  async canInviteUsers(
    organizationId: string,
    requestingUserId: string
  ): Promise<CanInviteUsersResult> {
    // Here we use SeatManagementService from deps
    await this.initDeps(); // Ensure loaded

    const [orgInfo, trialStatus, limits] = await Promise.all([
      this.getOrganizationType(organizationId),
      this.checkTrialStatus(organizationId),
      this.getOrganizationLimits(organizationId),
    ]);

    if (!orgInfo) return { allowed: false, reasonCode: 'ORG_NOT_FOUND' };
    const billingRow = await DbPromise.get<BillingStateRow>(
      this.deps.db,
      `SELECT status, billing_rail, contract_status, grace_until, access_expires_at
       FROM organization_billing WHERE organization_id = ?`,
      [organizationId],
      { fallback: true }
    );
    const effectiveOrgType = resolveOrgTypeFromBilling(
      orgInfo.organizationType,
      normalizeSubscriptionStatus((billingRow as any)?.status),
      normalizeBillingRail((billingRow as any)?.billing_rail),
      normalizeContractStatus((billingRow as any)?.contract_status),
      (billingRow as any)?.grace_until,
      (billingRow as any)?.access_expires_at,
      Boolean(billingRow)
    );
    if (effectiveOrgType === ORG_TYPES.DEMO)
      return { allowed: false, reasonCode: 'DEMO_READ_ONLY' };
    if (trialStatus.expired && effectiveOrgType !== ORG_TYPES.PAID)
      return { allowed: false, reasonCode: 'TRIAL_EXPIRED' };

    try {
      const canAdd = await this.deps.SeatManagementService.canAddUser(organizationId);
      if (!canAdd) return { allowed: false, reasonCode: 'USER_LIMIT_REACHED' };
    } catch (seatErr) {
      // Fallback
      const error = seatErr as Error;
      logger.warn('[AccessPolicyService] Seat check failed, using fallback:', error.message);
      if (limits) {
        const currentUsers = await this.deps.resourceService.countOrgUsers(organizationId);
        if (currentUsers >= limits.maxUsers)
          return { allowed: false, reasonCode: 'USER_LIMIT_REACHED' };
      }
    }
    return { allowed: true, reasonCode: 'OK' };
  }

  async getSeatAvailability(organizationId: string): Promise<SeatAvailability> {
    const [orgInfo, limits, currentSeats] = await Promise.all([
      this.getOrganizationType(organizationId),
      this.getOrganizationLimits(organizationId),
      this.deps.resourceService.countOrgUsers(organizationId),
    ]);

    if (orgInfo?.organizationType === ORG_TYPES.PAID || !limits) {
      return { maxSeats: -1, currentSeats, seatsRemaining: -1 };
    }
    return {
      maxSeats: limits.maxUsers,
      currentSeats,
      seatsRemaining: Math.max(0, limits.maxUsers - currentSeats),
    };
  }

  async getSeatAvailabilityEnhanced(organizationId: string): Promise<SeatAvailabilityEnhanced> {
    await this.initDeps();
    try {
      const seatConfig = await this.deps.SeatManagementService.getSeatConfiguration(organizationId);
      return {
        maxSeats: seatConfig.total_seats_available || -1,
        currentSeats: seatConfig.seats_used || 0,
        seatsRemaining: seatConfig.seats_remaining || 0,
        utilizationPercent: parseFloat(seatConfig.utilization_percent || '0'),
        baseSeatsIncluded: seatConfig.base_seats_included || 0,
        additionalSeatsPurchased: seatConfig.additional_seats_purchased || 0,
        autoAddEnabled: seatConfig.auto_add_seats_on_invite === 1,
      };
    } catch (seatErr) {
      const error = seatErr as Error;
      logger.warn('[AccessPolicyService] Seat config failed, using fallback:', error.message);
      const basic = await this.getSeatAvailability(organizationId);
      return {
        ...basic,
        utilizationPercent: 0,
        baseSeatsIncluded: 0,
        additionalSeatsPurchased: 0,
        autoAddEnabled: false,
      };
    }
  }
}

const serviceInstance = new AccessPolicyServiceClass();
export default serviceInstance;

// Re-export types
export * from './access/AccessTypes.js';

// Backward compatibility (bind methods)
export const getOrganizationType = serviceInstance.getOrganizationType.bind(serviceInstance);
export const getOrganizationLimits = serviceInstance.getOrganizationLimits.bind(serviceInstance);
export const checkTrialStatus = serviceInstance.checkTrialStatus.bind(serviceInstance);
export const getDailyUsage = serviceInstance.getDailyUsage.bind(serviceInstance);
export const incrementUsage = serviceInstance.incrementUsage.bind(serviceInstance);
export const trackTokenUsage = serviceInstance.trackTokenUsage.bind(serviceInstance);
export const getTrialUsage = serviceInstance.getTrialUsage.bind(serviceInstance);
export const checkAccess = serviceInstance.checkAccess.bind(serviceInstance);
export const isAIRoleAllowed = serviceInstance.isAIRoleAllowed.bind(serviceInstance);
export const getAIAccessContext = serviceInstance.getAIAccessContext.bind(serviceInstance);
export const createDefaultLimits = serviceInstance.createDefaultLimits.bind(serviceInstance);
export const removeLimits = serviceInstance.removeLimits.bind(serviceInstance);
export const buildPolicySnapshot = serviceInstance.buildPolicySnapshot.bind(serviceInstance);
export const canInviteUsers = serviceInstance.canInviteUsers.bind(serviceInstance);
export const getSeatAvailability = serviceInstance.getSeatAvailability.bind(serviceInstance);
export const getSeatAvailabilityEnhanced =
  serviceInstance.getSeatAvailabilityEnhanced.bind(serviceInstance);
export const setDependencies = serviceInstance.setDependencies.bind(serviceInstance);
