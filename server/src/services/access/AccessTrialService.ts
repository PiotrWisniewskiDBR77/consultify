import { AccessLimitService } from './AccessLimitService.js';
import { ORG_TYPES, TRIAL_DURATION_DAYS, TrialStatus } from './AccessTypes.js';

export class AccessTrialService {
  private limitService: AccessLimitService;

  constructor(limitService?: AccessLimitService) {
    this.limitService = limitService || new AccessLimitService();
  }

  setDependencies(deps: { limitService?: AccessLimitService }) {
    if (deps.limitService) {
      this.limitService = deps.limitService;
    }
  }

  /**
   * Check if trial is expired
   */
  async checkTrialStatus(organizationId: string): Promise<TrialStatus> {
    const orgInfo = await this.limitService.getOrganizationType(organizationId);

    if (!orgInfo) {
      return { expired: true, daysRemaining: 0, warningLevel: 'none' };
    }

    // PAID orgs never expire
    if (orgInfo.organizationType === ORG_TYPES.PAID) {
      return { expired: false, daysRemaining: -1, warningLevel: 'none' };
    }

    // DEMO orgs expire after 24 hours
    if (orgInfo.organizationType === ORG_TYPES.DEMO) {
      if (!orgInfo.trialStartedAt) {
        return { expired: false, daysRemaining: 1, warningLevel: 'none' };
      }
      const startDate = new Date(orgInfo.trialStartedAt);
      const now = new Date();
      const hoursElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const expired = hoursElapsed >= 24;
      return {
        expired,
        daysRemaining: expired ? 0 : 1,
        warningLevel: 'none',
      };
    }

    // TRIAL orgs check trial_expires_at
    if (!orgInfo.trialExpiresAt) {
      return { expired: false, daysRemaining: TRIAL_DURATION_DAYS, warningLevel: 'none' };
    }

    const expiresAt = new Date(orgInfo.trialExpiresAt);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let warningLevel: 'none' | 'warning' | 'critical' | 'expired' = 'none';
    if (daysRemaining <= 0) {
      warningLevel = 'expired';
    } else if (daysRemaining <= 3) {
      warningLevel = 'critical';
    } else if (daysRemaining <= 7) {
      warningLevel = 'warning';
    }

    return {
      expired: daysRemaining <= 0,
      daysRemaining: Math.max(0, daysRemaining),
      warningLevel,
    };
  }
}
