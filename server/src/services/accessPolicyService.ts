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
  AIAccessContext,
  CanInviteUsersResult,
  CheckAccessResult,
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
  TRIAL_DURATION_DAYS,
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
      const [orgInfo, trialStatus, limits, usage, trialUsage] = await Promise.all([
        this.getOrganizationType(organizationId),
        this.checkTrialStatus(organizationId),
        this.getOrganizationLimits(organizationId),
        this.getDailyUsage(organizationId),
        this.getTrialUsage(organizationId),
      ]);

      if (!orgInfo)
        return { allowed: false, reason: 'Organization not found', errorCode: 'ORG_NOT_FOUND' };
      if (!orgInfo.isActive)
        return { allowed: false, reason: 'Organization is inactive', errorCode: 'ORG_INACTIVE' };

      // Trial Expired check
      if (trialStatus.expired && orgInfo.organizationType !== ORG_TYPES.PAID) {
        return {
          allowed: false,
          reason: 'Trial period has expired. Please upgrade to continue.',
          errorCode: 'TRIAL_EXPIRED',
        };
      }

      // Demo Mode check
      if (orgInfo.organizationType === ORG_TYPES.DEMO) {
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

      // Trial gating: require org setup completion before using AI
      if (orgInfo.organizationType === ORG_TYPES.TRIAL && action === 'ai_call') {
        try {
          const row = await DbPromise.get<{ onboarding_status?: string | null }>(
            this.deps.db,
            `SELECT onboarding_status FROM organizations WHERE id = ?`,
            [organizationId],
            { fallback: false }
          );
          if ((row as any)?.onboarding_status !== 'ORG_SETUP_COMPLETED') {
            return {
              allowed: false,
              reason: 'Please complete organization setup to start your trial AI experience.',
              errorCode: 'TRIAL_PROFILE_INCOMPLETE',
            };
          }
        } catch {
          // fail open if schema mismatch
        }
      }

      // Paid check
      if (orgInfo.organizationType === ORG_TYPES.PAID) return { allowed: true };

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
      // Fail open for system errors to avoid blocking legitimate users
      return { allowed: true };
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
    const [orgInfo, trialStatus, limits, usage] = await Promise.all([
      this.getOrganizationType(organizationId),
      this.checkTrialStatus(organizationId),
      this.getOrganizationLimits(organizationId),
      this.getDailyUsage(organizationId),
    ]);
    return {
      organizationType: orgInfo?.organizationType || ORG_TYPES.TRIAL,
      isDemo: orgInfo?.organizationType === ORG_TYPES.DEMO,
      isTrial: orgInfo?.organizationType === ORG_TYPES.TRIAL,
      isPaid: orgInfo?.organizationType === ORG_TYPES.PAID,
      trialStatus,
      allowedAIRoles: limits?.aiRolesEnabled || ['ADVISOR'],
      dailyAIUsage: {
        used: usage?.aiCallsCount || 0,
        limit: limits?.maxAICallsPerDay || 50,
        remaining: Math.max(0, (limits?.maxAICallsPerDay || 50) - (usage?.aiCallsCount || 0)),
      },
      canExecuteAIActions: orgInfo?.organizationType === ORG_TYPES.PAID,
      aiResponseBadge:
        orgInfo?.organizationType === ORG_TYPES.DEMO
          ? '🎯 Demo AI'
          : orgInfo?.organizationType === ORG_TYPES.TRIAL
            ? '🔬 Trial AI'
            : null,
    };
  }

  async buildPolicySnapshot(organizationId: string): Promise<PolicySnapshot | null> {
    const [orgInfo, trialStatus, limits, usage, trialUsage] = await Promise.all([
      this.getOrganizationType(organizationId),
      this.checkTrialStatus(organizationId),
      this.getOrganizationLimits(organizationId),
      this.getDailyUsage(organizationId),
      this.getTrialUsage(organizationId),
    ]);

    if (!orgInfo) return null;

    const isDemo = orgInfo.organizationType === ORG_TYPES.DEMO;
    const isTrial = orgInfo.organizationType === ORG_TYPES.TRIAL;
    const isPaid = orgInfo.organizationType === ORG_TYPES.PAID;

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

    let subscriptionStatus: SubscriptionStatus | null = null;
    try {
      const subRow = await DbPromise.get<{ status: string }>(
        this.deps.db,
        `SELECT status FROM subscriptions WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
        [organizationId],
        { fallback: false }
      );
      if (subRow?.status) {
        subscriptionStatus = subRow.status as SubscriptionStatus;
      }
    } catch {
      // table may not exist
    }

    const blockedFeatures: string[] = [];
    const blockedActions: string[] = [];
    const entitlements = ENTITLEMENTS_MATRIX[orgInfo.organizationType] || {};

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
        'CREATE_INITIATIVE'
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

    if (subscriptionStatus === SUBSCRIPTION_STATUSES.PAST_DUE) {
      blockedActions.push('AI_DO_ACTIONS', 'CREATE_PROJECT', 'CREATE_INITIATIVE', 'INVITES');
    }

    if ((isTrial || isDemo) && limits) {
      if (projectCount >= limits.maxProjects && limits.maxProjects >= 0)
        blockedActions.push('CREATE_PROJECT');
      if (userCount >= limits.maxUsers && limits.maxUsers >= 0) blockedActions.push('INVITES');
      if (usage.aiCallsCount >= limits.maxAICallsPerDay && limits.maxAICallsPerDay >= 0)
        blockedActions.push('AI_CALL');
      if (initiativeCount >= limits.maxInitiatives && limits.maxInitiatives >= 0)
        blockedActions.push('CREATE_INITIATIVE');
      if (
        limits.maxTotalTokens > 0 &&
        trialUsage.tokensUsed >= limits.maxTotalTokens &&
        !hasPaymentMethod
      ) {
        blockedActions.push('AI_TOKEN_BUDGET');
      }
    }

    const safePercent = (used: number, limit: number): number => {
      if (limit <= 0) return 0;
      return Math.min(100, Math.round((used / limit) * 100));
    };

    const usagePercent = {
      aiCalls: safePercent(usage?.aiCallsCount || 0, limits?.maxAICallsPerDay || 1),
      projects: safePercent(projectCount, limits?.maxProjects || 1),
      users: safePercent(userCount, limits?.maxUsers || 1),
      initiatives: safePercent(initiativeCount, limits?.maxInitiatives || 1),
      storage: safePercent(usage?.storageUsedMb || 0, limits?.maxStorageMb || 1),
      tokens: safePercent(trialUsage.tokensUsed, limits?.maxTotalTokens || 1),
    };

    let bannerText: string | null = null;
    let bannerTextKey: string | null = null;
    let modalText: string | null = null;
    let modalTextKey: string | null = null;

    if (isDemo) {
      bannerText = 'You are viewing a demo environment (read-only)';
      bannerTextKey = 'access.banner.demo';
    } else if (subscriptionStatus === SUBSCRIPTION_STATUSES.PAST_DUE) {
      bannerText = 'Payment failed. Please update your payment method to avoid service interruption.';
      bannerTextKey = 'access.banner.pastDue';
    } else if (isTrial && trialStatus.expired) {
      bannerText = 'Your trial has expired. Upgrade to continue.';
      bannerTextKey = 'access.banner.trialExpired';
      modalText =
        'Your trial period has ended. Your data is safe, but your organization is now in read-only mode. Upgrade to restore full access.';
      modalTextKey = 'access.modal.trialExpired';
    } else if (isTrial && trialStatus.warningLevel === 'critical') {
      bannerText = `Trial expires in ${trialStatus.daysRemaining} day${trialStatus.daysRemaining !== 1 ? 's' : ''}. Upgrade now to keep full access.`;
      bannerTextKey = 'access.banner.trialCritical';
    } else if (isTrial && trialStatus.warningLevel === 'warning') {
      bannerText = `${trialStatus.daysRemaining} day${trialStatus.daysRemaining !== 1 ? 's' : ''} left in your trial`;
      bannerTextKey = 'access.banner.trialWarning';
    }

    const anyApproaching = Object.values(usagePercent).some(
      (p) => p >= USAGE_THRESHOLD_PERCENT.APPROACHING && p < USAGE_THRESHOLD_PERCENT.EXCEEDED
    );
    if (isTrial && !trialStatus.expired && anyApproaching && !bannerText) {
      bannerText = 'You are approaching your usage limits. Consider upgrading for uninterrupted access.';
      bannerTextKey = 'access.banner.approachingLimits';
    }

    let primaryAction = 'Upgrade Plan';
    let primaryActionKey = 'access.cta.upgradePlan';
    let ctaReason: string | undefined;

    if (trialStatus.expired) {
      primaryAction = 'Upgrade Now';
      primaryActionKey = 'access.cta.upgradeNow';
      ctaReason = 'trial_expired';
    } else if (subscriptionStatus === SUBSCRIPTION_STATUSES.PAST_DUE) {
      primaryAction = 'Fix Payment';
      primaryActionKey = 'access.cta.fixPayment';
      ctaReason = 'payment_failed';
    } else if (
      isTrial &&
      limits &&
      limits.maxTotalTokens > 0 &&
      trialUsage.tokensUsed >= limits.maxTotalTokens &&
      !hasPaymentMethod
    ) {
      primaryAction = 'Add Payment Method';
      primaryActionKey = 'access.cta.addPaymentMethod';
      ctaReason = 'token_budget_exceeded';
    }

    return {
      orgType: orgInfo.organizationType,
      isDemo,
      isTrial,
      isPaid,
      subscriptionStatus,
      trialStartedAt: orgInfo.trialStartedAt,
      trialExpiresAt: orgInfo.trialExpiresAt,
      trialDaysLeft: trialStatus.daysRemaining,
      isTrialExpired: trialStatus.expired,
      warningLevel: trialStatus.warningLevel,
      limits: limits
        ? {
            maxProjects: limits.maxProjects,
            maxUsers: limits.maxUsers,
            maxAICallsPerDay: limits.maxAICallsPerDay,
            maxInitiatives: limits.maxInitiatives,
            maxStorageMb: limits.maxStorageMb,
            maxTotalTokens: limits.maxTotalTokens,
            aiRolesEnabled: limits.aiRolesEnabled,
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
        urlOrRoute: '/settings?tab=billing',
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
    if (orgInfo.organizationType === ORG_TYPES.DEMO)
      return { allowed: false, reasonCode: 'DEMO_READ_ONLY' };
    if (trialStatus.expired && orgInfo.organizationType !== ORG_TYPES.PAID)
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
