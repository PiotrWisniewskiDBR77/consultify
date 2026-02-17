/**
 * L1 Unit Tests: AccessPolicyService (REAL)
 *
 * This suite MUST touch the real implementation under server/src/services/accessPolicyService.ts
 * and must not be a local re-implementation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbPromiseGet, mockLogger, mockedSeatModule } = vi.hoisted(() => ({
  mockDbPromiseGet: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockedSeatModule: {
    canAddUser: vi.fn(),
    getSeatConfiguration: vi.fn(),
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = await vi.importActual('../../../server/src/utils/DbPromise.js');
  return {
    ...actual,
    get: mockDbPromiseGet,
  };
});

vi.mock('../../../server/src/services/seatManagementService.js', () => ({
  default: mockedSeatModule,
}));

const {
  checkAccess,
  setDependencies,
  ORG_TYPES,
  isAIRoleAllowed,
  getAIAccessContext,
  buildPolicySnapshot,
  canInviteUsers,
  getSeatAvailability,
  getSeatAvailabilityEnhanced,
  incrementUsage,
  createDefaultLimits,
  removeLimits,
  trackTokenUsage,
} = await import('../../../server/src/services/accessPolicyService.ts');

function makeOrgInfo(overrides = {}) {
  return {
    id: 'org-1',
    name: 'Org',
    organizationType: ORG_TYPES.TRIAL,
    isActive: true,
    ...overrides,
  };
}

function makeLimits(overrides = {}) {
  return {
    organizationId: 'org-1',
    maxProjects: 3,
    maxUsers: 4,
    maxAICallsPerDay: 50,
    maxInitiatives: 5,
    maxStorageMb: 100,
    maxTotalTokens: 100000,
    aiRolesEnabled: ['ADVISOR'],
    ...overrides,
  };
}

function makeUsage(overrides = {}) {
  return {
    organizationId: 'org-1',
    counterDate: '2026-01-01',
    aiCallsCount: 0,
    projectsCount: 0,
    usersCount: 0,
    initiativesCount: 0,
    storageUsedMb: 0,
    ...overrides,
  };
}

function makeTrialStatus(overrides = {}) {
  return {
    expired: false,
    daysRemaining: 10,
    warningLevel: 'none',
    ...overrides,
  };
}

function makeTrialUsage(overrides = {}) {
  return {
    tokensUsed: 0,
    ...overrides,
  };
}

describe('AccessPolicyService (L1 REAL)', () => {
  const db = {};

  const limitService = {
    getOrganizationType: vi.fn(),
    getOrganizationLimits: vi.fn(),
    createDefaultLimits: vi.fn(),
    removeLimits: vi.fn(),
    setDependencies: vi.fn(),
  };

  const usageService = {
    getDailyUsage: vi.fn(),
    incrementUsage: vi.fn(),
    trackTokenUsage: vi.fn(),
    getTrialUsage: vi.fn(),
    setDependencies: vi.fn(),
  };

  const trialService = {
    checkTrialStatus: vi.fn(),
    setDependencies: vi.fn(),
  };

  const resourceService = {
    countOrgProjects: vi.fn(),
    countOrgInitiatives: vi.fn(),
    countOrgUsers: vi.fn(),
    setDependencies: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    setDependencies({
      db,
      limitService,
      usageService,
      trialService,
      resourceService,
      SeatManagementService: mockedSeatModule,
    });

    limitService.getOrganizationType.mockResolvedValue(makeOrgInfo());
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits());
    trialService.checkTrialStatus.mockResolvedValue(makeTrialStatus());
    usageService.getDailyUsage.mockResolvedValue(makeUsage());
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage());
    resourceService.countOrgProjects.mockResolvedValue(0);
    resourceService.countOrgInitiatives.mockResolvedValue(0);
    resourceService.countOrgUsers.mockResolvedValue(0);
    mockedSeatModule.canAddUser.mockResolvedValue(true);
    mockedSeatModule.getSeatConfiguration.mockResolvedValue({
      total_seats_available: 10,
      seats_used: 2,
      seats_remaining: 8,
      utilization_percent: '20.0',
      base_seats_included: 2,
      additional_seats_purchased: 8,
      auto_add_seats_on_invite: 1,
    });

    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) return { count: 0 };
      return null;
    });
  });

  it('delegate: incrementUsage uses default amount=1', async () => {
    await expect(incrementUsage('org-1', 'ai_calls')).resolves.toBeUndefined();
    expect(usageService.incrementUsage).toHaveBeenCalledWith('org-1', 'ai_calls', 1);
  });

  it('delegate: createDefaultLimits defaults orgType to TRIAL', async () => {
    await expect(createDefaultLimits('org-1')).resolves.toBeUndefined();
    expect(limitService.createDefaultLimits).toHaveBeenCalledWith('org-1', ORG_TYPES.TRIAL);
  });

  it('delegate: removeLimits forwards to limitService', async () => {
    await expect(removeLimits('org-1')).resolves.toBeUndefined();
    expect(limitService.removeLimits).toHaveBeenCalledWith('org-1');
  });

  it('delegate: trackTokenUsage forwards to usageService', async () => {
    await expect(trackTokenUsage('org-1', 123)).resolves.toBeUndefined();
    expect(usageService.trackTokenUsage).toHaveBeenCalledWith('org-1', 123);
  });

  it('initDeps: loads SeatManagementService via dynamic import when missing', async () => {
    mockedSeatModule.getSeatConfiguration.mockResolvedValueOnce({
      total_seats_available: 6,
      seats_used: 2,
      seats_remaining: 4,
      utilization_percent: '33.3',
      base_seats_included: 2,
      additional_seats_purchased: 4,
      auto_add_seats_on_invite: 1,
    });

    const out = await getSeatAvailabilityEnhanced('org-1');
    expect(mockedSeatModule.getSeatConfiguration).toHaveBeenCalledWith('org-1');
    expect(out).toEqual(
      expect.objectContaining({
        maxSeats: 6,
        currentSeats: 2,
        seatsRemaining: 4,
        utilizationPercent: 33.3,
        autoAddEnabled: true,
      })
    );
  });

  it('setDependencies: uses provided SeatManagementService without dynamic import', async () => {
    const injectedSeat = {
      canAddUser: vi.fn().mockResolvedValue(true),
      getSeatConfiguration: vi.fn().mockResolvedValue({
        total_seats_available: 3,
        seats_used: 1,
        seats_remaining: 2,
        utilization_percent: '33.3',
        base_seats_included: 1,
        additional_seats_purchased: 2,
        auto_add_seats_on_invite: 0,
      }),
    };

    try {
      setDependencies({ SeatManagementService: injectedSeat });
      const out = await getSeatAvailabilityEnhanced('org-1');

      expect(injectedSeat.getSeatConfiguration).toHaveBeenCalledWith('org-1');
      expect(mockedSeatModule.getSeatConfiguration).not.toHaveBeenCalled();
      expect(out).toEqual(
        expect.objectContaining({
          maxSeats: 3,
          currentSeats: 1,
          seatsRemaining: 2,
          utilizationPercent: 33.3,
          autoAddEnabled: false,
        })
      );
    } finally {
      // Prevent cross-test pollution (setDependencies cannot unset keys)
      setDependencies({ SeatManagementService: mockedSeatModule });
    }
  });

  it('denies when organization not found', async () => {
    limitService.getOrganizationType.mockResolvedValue(null);
    await expect(checkAccess('org-404', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'ORG_NOT_FOUND' })
    );
  });

  it('denies when organization is inactive', async () => {
    limitService.getOrganizationType.mockResolvedValue(makeOrgInfo({ isActive: false }));
    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'ORG_INACTIVE' })
    );
  });

  it('denies when trial expired (non-paid)', async () => {
    trialService.checkTrialStatus.mockResolvedValue(
      makeTrialStatus({ expired: true, warningLevel: 'expired' })
    );
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'TRIAL_EXPIRED' })
    );
  });

  it('denies write actions in DEMO mode', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.DEMO })
    );
    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'DEMO_READ_ONLY' })
    );
  });

  it('allows everything for PAID orgs', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.PAID })
    );
    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies AI calls for TRIAL orgs until onboarding completed', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'PENDING' };
      if (s.includes('FROM payment_methods')) return { count: 0 };
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'TRIAL_PROFILE_INCOMPLETE' })
    );
  });

  it('fails open when onboarding_status query throws (schema mismatch)', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(null);
    mockDbPromiseGet.mockRejectedValueOnce(new Error('no such column'));

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies when project limit reached', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxProjects: 1 }));
    resourceService.countOrgProjects.mockResolvedValue(1);

    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'PROJECT_LIMIT_REACHED' })
    );
  });

  it('allows creating project when below limit', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxProjects: 3 }));
    resourceService.countOrgProjects.mockResolvedValue(2);

    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies when initiative limit reached', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxInitiatives: 1 }));
    resourceService.countOrgInitiatives.mockResolvedValue(1);

    await expect(checkAccess('org-1', 'create_initiative')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'INITIATIVE_LIMIT_REACHED' })
    );
  });

  it('allows creating initiative when below limit', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxInitiatives: 5 }));
    resourceService.countOrgInitiatives.mockResolvedValue(4);

    await expect(checkAccess('org-1', 'create_initiative')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('fails open for create_project when limits are missing', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(null);

    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('fails open for create_initiative when limits are missing', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(null);

    await expect(checkAccess('org-1', 'create_initiative')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies when user invite limit reached', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxUsers: 1 }));
    resourceService.countOrgUsers.mockResolvedValue(1);

    await expect(checkAccess('org-1', 'invite_user')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'USER_LIMIT_REACHED' })
    );
  });

  it('allows inviting user when below limit', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxUsers: 10 }));
    resourceService.countOrgUsers.mockResolvedValue(0);
    await expect(checkAccess('org-1', 'invite_user')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies when daily AI call limit reached', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxAICallsPerDay: 2 }));
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ aiCallsCount: 2 }));

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'AI_LIMIT_REACHED' })
    );
  });

  it('allows AI call when below limits and within token budget', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(
      makeLimits({ maxAICallsPerDay: 5, maxTotalTokens: 100 })
    );
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ aiCallsCount: 1 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 10 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      return null;
    });
    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies AI call when token budget exceeded and no payment method exists', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(
      makeLimits({ maxAICallsPerDay: 5, maxTotalTokens: 100 })
    );
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ aiCallsCount: 1 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 100 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) return { count: 0 };
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'AI_TOKEN_BUDGET_EXCEEDED' })
    );
  });

  it('allows AI call when token budget exceeded but payment method exists (hybrid trial)', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(
      makeLimits({ maxAICallsPerDay: 5, maxTotalTokens: 100 })
    );
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ aiCallsCount: 1 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 100 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) return { count: 1 };
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies AI call when token budget exceeded and payment method lookup throws (fail closed)', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(
      makeLimits({ maxAICallsPerDay: 5, maxTotalTokens: 100 })
    );
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ aiCallsCount: 1 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 100 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) throw new Error('db down');
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'AI_TOKEN_BUDGET_EXCEEDED' })
    );
  });

  it('denies when storage upload limit reached', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxStorageMb: 10 }));
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ storageUsedMb: 10 }));

    await expect(checkAccess('org-1', 'upload')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'STORAGE_LIMIT_REACHED' })
    );
  });

  it('allows upload when below storage limit', async () => {
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxStorageMb: 10 }));
    usageService.getDailyUsage.mockResolvedValue(makeUsage({ storageUsedMb: 9 }));
    await expect(checkAccess('org-1', 'upload')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('denies when trial token budget exceeded and no payment method', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxTotalTokens: 100 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 100 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) return { count: 0 };
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'AI_TOKEN_BUDGET_EXCEEDED' })
    );
  });

  it('denies when token budget exceeded and payment-method query throws (fail closed)', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxTotalTokens: 100 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 100 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) throw new Error('db down');
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: false, errorCode: 'AI_TOKEN_BUDGET_EXCEEDED' })
    );
  });

  it('allows AI calls when token budget exceeded but payment method exists (hybrid trial)', async () => {
    limitService.getOrganizationType.mockResolvedValue(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValue(makeLimits({ maxTotalTokens: 100 }));
    usageService.getTrialUsage.mockResolvedValue(makeTrialUsage({ tokensUsed: 100 }));
    mockDbPromiseGet.mockImplementation(async (_db, sql) => {
      const s = String(sql);
      if (s.includes('onboarding_status')) return { onboarding_status: 'ORG_SETUP_COMPLETED' };
      if (s.includes('FROM payment_methods')) return { count: 1 };
      return null;
    });

    await expect(checkAccess('org-1', 'ai_call')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('fails open on unexpected exceptions (does not block users)', async () => {
    limitService.getOrganizationType.mockRejectedValueOnce(new Error('boom'));
    await expect(checkAccess('org-1', 'create_project')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('isAIRoleAllowed: defaults to ADVISOR when limits missing', async () => {
    limitService.getOrganizationLimits.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(isAIRoleAllowed('org-1', 'ADVISOR')).resolves.toEqual({
      allowed: true,
      reason: undefined,
    });
    await expect(isAIRoleAllowed('org-1', 'EXECUTOR')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: expect.stringContaining('Only ADVISOR') })
    );
  });

  it('isAIRoleAllowed: respects aiRolesEnabled list', async () => {
    limitService.getOrganizationLimits.mockResolvedValueOnce(
      makeLimits({ aiRolesEnabled: ['ADVISOR', 'EXECUTOR'] })
    );
    await expect(isAIRoleAllowed('org-1', 'EXECUTOR')).resolves.toEqual({
      allowed: true,
      reason: undefined,
    });
    await expect(isAIRoleAllowed('org-1', 'OTHER')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: expect.stringContaining('Upgrade') })
    );
  });

  it('getAIAccessContext: sets badge + canExecuteAIActions based on org type', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.DEMO })
    );
    const demo = await getAIAccessContext('org-1');
    expect(demo.aiResponseBadge).toBe('🎯 Demo AI');
    expect(demo.canExecuteAIActions).toBe(false);

    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    const trial = await getAIAccessContext('org-1');
    expect(trial.aiResponseBadge).toBe('🔬 Trial AI');
    expect(trial.canExecuteAIActions).toBe(false);

    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.PAID })
    );
    const paid = await getAIAccessContext('org-1');
    expect(paid.aiResponseBadge).toBeNull();
    expect(paid.canExecuteAIActions).toBe(true);
  });

  it('buildPolicySnapshot: returns null when org not found', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(null);
    await expect(buildPolicySnapshot('org-404')).resolves.toBeNull();
  });

  it('buildPolicySnapshot: demo produces blocked features/actions and banner', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.DEMO })
    );
    const snap = await buildPolicySnapshot('org-1');
    expect(snap.isDemo).toBe(true);
    expect(snap.blockedFeatures).toContain('SSO');
    expect(snap.blockedActions).toContain('CREATE_PROJECT');
    expect(snap.messages.bannerText).toContain('demo');
  });

  it('buildPolicySnapshot: trial expired sets banner+modal and blocks WRITE', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    trialService.checkTrialStatus.mockResolvedValueOnce(
      makeTrialStatus({ expired: true, warningLevel: 'expired', daysRemaining: 0 })
    );
    const snap = await buildPolicySnapshot('org-1');
    expect(snap.isTrialExpired).toBe(true);
    expect(snap.messages.bannerText).toContain('expired');
    expect(snap.messages.modalText).toContain('read-only');
    expect(snap.blockedActions).toContain('WRITE');
  });

  it('buildPolicySnapshot: trial limit pressure adds blocked actions (counts)', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    trialService.checkTrialStatus.mockResolvedValueOnce(
      makeTrialStatus({ expired: false, warningLevel: 'warning', daysRemaining: 2 })
    );
    limitService.getOrganizationLimits.mockResolvedValueOnce(
      makeLimits({ maxProjects: 1, maxUsers: 1, maxAICallsPerDay: 1 })
    );
    resourceService.countOrgProjects.mockResolvedValueOnce(1);
    resourceService.countOrgUsers.mockResolvedValueOnce(1);
    usageService.getDailyUsage.mockResolvedValueOnce(makeUsage({ aiCallsCount: 1 }));

    const snap = await buildPolicySnapshot('org-1');
    expect(snap.messages.bannerText).toContain('2 days remaining');
    expect(snap.blockedActions).toContain('CREATE_PROJECT');
    expect(snap.blockedActions).toContain('INVITES');
    expect(snap.blockedActions).toContain('AI_CALL');
  });

  it('buildPolicySnapshot: day singular in banner when daysRemaining=1', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    trialService.checkTrialStatus.mockResolvedValueOnce(
      makeTrialStatus({ expired: false, warningLevel: 'warning', daysRemaining: 1 })
    );
    const snap = await buildPolicySnapshot('org-1');
    expect(snap.messages.bannerText).toContain('1 day remaining');
  });

  it('canInviteUsers: denies for ORG_NOT_FOUND / DEMO / TRIAL_EXPIRED', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(null);
    await expect(canInviteUsers('org-404', 'u1')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reasonCode: 'ORG_NOT_FOUND' })
    );

    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.DEMO })
    );
    await expect(canInviteUsers('org-1', 'u1')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reasonCode: 'DEMO_READ_ONLY' })
    );

    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    trialService.checkTrialStatus.mockResolvedValueOnce(
      makeTrialStatus({ expired: true, warningLevel: 'expired', daysRemaining: 0 })
    );
    await expect(canInviteUsers('org-1', 'u1')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reasonCode: 'TRIAL_EXPIRED' })
    );
  });

  it('canInviteUsers: uses SeatManagementService.canAddUser when available', async () => {
    mockedSeatModule.canAddUser.mockResolvedValueOnce(false);
    await expect(canInviteUsers('org-1', 'u1')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reasonCode: 'USER_LIMIT_REACHED' })
    );
  });

  it('canInviteUsers: returns OK when seat check passes', async () => {
    mockedSeatModule.canAddUser.mockResolvedValueOnce(true);
    await expect(canInviteUsers('org-1', 'u1')).resolves.toEqual(
      expect.objectContaining({ allowed: true, reasonCode: 'OK' })
    );
  });

  it('canInviteUsers: falls back to limits when seat check throws', async () => {
    mockedSeatModule.canAddUser.mockRejectedValueOnce(new Error('seat system down'));
    limitService.getOrganizationLimits.mockResolvedValueOnce(makeLimits({ maxUsers: 1 }));
    resourceService.countOrgUsers.mockResolvedValueOnce(1);
    await expect(canInviteUsers('org-1', 'u1')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reasonCode: 'USER_LIMIT_REACHED' })
    );
  });

  it('getSeatAvailability: paid or no limits returns unlimited', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.PAID })
    );
    resourceService.countOrgUsers.mockResolvedValueOnce(7);
    await expect(getSeatAvailability('org-1')).resolves.toEqual({
      maxSeats: -1,
      currentSeats: 7,
      seatsRemaining: -1,
    });

    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValueOnce(null);
    resourceService.countOrgUsers.mockResolvedValueOnce(3);
    await expect(getSeatAvailability('org-1')).resolves.toEqual({
      maxSeats: -1,
      currentSeats: 3,
      seatsRemaining: -1,
    });
  });

  it('getSeatAvailability: trial returns remaining seats', async () => {
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValueOnce(makeLimits({ maxUsers: 4 }));
    resourceService.countOrgUsers.mockResolvedValueOnce(3);
    await expect(getSeatAvailability('org-1')).resolves.toEqual({
      maxSeats: 4,
      currentSeats: 3,
      seatsRemaining: 1,
    });
  });

  it('getSeatAvailabilityEnhanced: returns detailed config and falls back on error', async () => {
    mockedSeatModule.getSeatConfiguration.mockResolvedValueOnce({
      total_seats_available: 10,
      seats_used: 5,
      seats_remaining: 5,
      utilization_percent: '50.0',
      base_seats_included: 2,
      additional_seats_purchased: 8,
      auto_add_seats_on_invite: 0,
    });
    await expect(getSeatAvailabilityEnhanced('org-1')).resolves.toEqual(
      expect.objectContaining({
        maxSeats: 10,
        currentSeats: 5,
        seatsRemaining: 5,
        utilizationPercent: 50,
        autoAddEnabled: false,
      })
    );

    mockedSeatModule.getSeatConfiguration.mockRejectedValueOnce(new Error('boom'));
    limitService.getOrganizationType.mockResolvedValueOnce(
      makeOrgInfo({ organizationType: ORG_TYPES.TRIAL })
    );
    limitService.getOrganizationLimits.mockResolvedValueOnce(makeLimits({ maxUsers: 4 }));
    resourceService.countOrgUsers.mockResolvedValueOnce(4);
    await expect(getSeatAvailabilityEnhanced('org-1')).resolves.toEqual(
      expect.objectContaining({
        maxSeats: 4,
        currentSeats: 4,
        seatsRemaining: 0,
        autoAddEnabled: false,
      })
    );
  });

  it('isAIRoleAllowed: allows ADVISOR when limits missing or roles disabled', async () => {
    limitService.getOrganizationLimits.mockResolvedValueOnce(null);
    await expect(isAIRoleAllowed('org-1', 'ADVISOR')).resolves.toEqual(
      expect.objectContaining({ allowed: true })
    );
  });

  it('isAIRoleAllowed: denies non-ADVISOR when roles disabled (with reason)', async () => {
    limitService.getOrganizationLimits.mockResolvedValueOnce(makeLimits({ aiRolesEnabled: null }));
    await expect(isAIRoleAllowed('org-1', 'EXECUTOR')).resolves.toEqual(
      expect.objectContaining({ allowed: false, reason: expect.any(String) })
    );
  });
});
