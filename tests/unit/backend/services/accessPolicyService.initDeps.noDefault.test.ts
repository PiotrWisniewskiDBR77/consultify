import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

// No default export on purpose: forces `seatModule.default || seatModule` to take the `seatModule` branch.
const seatModuleObject = {
  canAddUser: vi.fn(),
  getSeatConfiguration: vi.fn(),
};
vi.mock('../../../../server/src/services/seatManagementService.js', () => seatModuleObject);

describe('AccessPolicyService initDeps (no default export)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seatModuleObject.getSeatConfiguration.mockResolvedValue({
      total_seats_available: 7,
      seats_used: 3,
      seats_remaining: 4,
      utilization_percent: '42.857',
      base_seats_included: 1,
      additional_seats_purchased: 6,
      auto_add_seats_on_invite: 1,
    });
  });

  it('loads SeatManagementService from module object when default export is missing', async () => {
    vi.resetModules();

    const mod = await import('../../../../server/src/services/accessPolicyService.ts');
    mod.setDependencies({
      limitService: {
        setDependencies: vi.fn(),
        getOrganizationType: vi.fn(),
        getOrganizationLimits: vi.fn(),
      },
      usageService: {
        setDependencies: vi.fn(),
        getDailyUsage: vi.fn(),
        incrementUsage: vi.fn(),
        trackTokenUsage: vi.fn(),
        getTrialUsage: vi.fn(),
      },
      trialService: { setDependencies: vi.fn(), checkTrialStatus: vi.fn() },
      resourceService: {
        setDependencies: vi.fn(),
        countOrgProjects: vi.fn(),
        countOrgInitiatives: vi.fn(),
        countOrgUsers: vi.fn(),
      },
    } as any);

    const out = await mod.getSeatAvailabilityEnhanced('org-1');
    expect(seatModuleObject.getSeatConfiguration).toHaveBeenCalledWith('org-1');
    expect(out).toEqual(
      expect.objectContaining({
        maxSeats: 7,
        currentSeats: 3,
        seatsRemaining: 4,
        autoAddEnabled: true,
      })
    );
  });
});

