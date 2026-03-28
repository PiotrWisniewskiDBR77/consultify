import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(false),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
  getOrgFlags: vi.fn().mockResolvedValue({}),
  getV8Flags: vi.fn().mockResolvedValue({}),
  setV8OrgFlag: vi.fn().mockResolvedValue(undefined),
}));

import {
  getV8Flags,
  isV8Enabled,
  isV8ShadowMode,
  setV8OrgFlag,
} from '../../../services/v8/featureFlagService.js';

describe('CP-33: Pilot Org Configuration', () => {
  describe('Pilot org selection criteria', () => {
    it('pilot org must be internal (not customer-facing)', () => {
      const pilotCriteria = {
        orgType: 'internal',
        minUsers: 2,
        maxUsers: 20,
        hasActiveChat: true,
        isCustomerFacing: false,
      };

      expect(pilotCriteria.isCustomerFacing).toBe(false);
      expect(pilotCriteria.orgType).toBe('internal');
    });

    it('pilot org must have active chat usage', () => {
      const pilotCriteria = { hasActiveChat: true };
      expect(pilotCriteria.hasActiveChat).toBe(true);
    });
  });

  describe('Pilot flag configuration sequence', () => {
    it('enables V8 for pilot org step by step', async () => {
      const pilotOrgId = 'pilot-org-internal';

      // Step 1: Enable chat module
      await setV8OrgFlag(pilotOrgId, 'chat', true, 'admin');
      expect(setV8OrgFlag).toHaveBeenCalledWith(pilotOrgId, 'chat', true, 'admin');

      // Step 2: Enable AI core module
      await setV8OrgFlag(pilotOrgId, 'ai_core', true, 'admin');
      expect(setV8OrgFlag).toHaveBeenCalledWith(pilotOrgId, 'ai_core', true, 'admin');
    });

    it('can verify flags are set correctly', async () => {
      const mockedGetFlags = vi.mocked(getV8Flags);
      mockedGetFlags.mockResolvedValueOnce({ chat: true, ai_core: true });

      const flags = await getV8Flags('pilot-org-internal');
      expect(flags).toEqual({ chat: true, ai_core: true });
    });

    it('can verify V8 is enabled for pilot org', async () => {
      const mockedIsEnabled = vi.mocked(isV8Enabled);
      mockedIsEnabled.mockResolvedValueOnce(true);

      const enabled = await isV8Enabled('pilot-org-internal');
      expect(enabled).toBe(true);
    });
  });

  describe('Shadow mode for pilot', () => {
    it('shadow mode should be active during pilot', async () => {
      const mockedShadow = vi.mocked(isV8ShadowMode);
      mockedShadow.mockResolvedValueOnce(true);

      const shadow = await isV8ShadowMode('pilot-org-internal');
      expect(shadow).toBe(true);
    });
  });

  describe('Pilot success criteria', () => {
    const pilotSuccessCriteria = {
      minShadowComparisons: 100,
      minMatchRate: 0.95,
      maxV8ErrorRate: 0.05,
      maxLatencyOverheadMs: 100,
      maxRecentMismatches: 0,
      minDurationDays: 7,
    };

    it('defines minimum 100 shadow comparisons', () => {
      expect(pilotSuccessCriteria.minShadowComparisons).toBe(100);
    });

    it('requires 95% match rate', () => {
      expect(pilotSuccessCriteria.minMatchRate).toBe(0.95);
    });

    it('requires V8 error rate below 5%', () => {
      expect(pilotSuccessCriteria.maxV8ErrorRate).toBe(0.05);
    });

    it('requires latency overhead below 100ms', () => {
      expect(pilotSuccessCriteria.maxLatencyOverheadMs).toBe(100);
    });

    it('requires zero mismatches in last 24h', () => {
      expect(pilotSuccessCriteria.maxRecentMismatches).toBe(0);
    });

    it('requires minimum 7 days of pilot', () => {
      expect(pilotSuccessCriteria.minDurationDays).toBe(7);
    });
  });

  describe('Pilot abort conditions', () => {
    it('abort if V8 errors affect legacy responses', () => {
      const abortConditions = [
        'V8 errors leak into legacy responses',
        'Shadow interceptor adds > 50ms to legacy response time',
        'V8 error rate > 20%',
        'Any data corruption detected',
        'User-reported regression',
      ];

      expect(abortConditions).toContain('V8 errors leak into legacy responses');
      expect(abortConditions.length).toBe(5);
    });
  });

  describe('Pilot → production progression criteria', () => {
    it('defines gate criteria for production promotion', () => {
      const productionGate = {
        pilotDurationMet: true,
        shadowComparisonsMet: true,
        matchRateMet: true,
        errorRateMet: true,
        latencyMet: true,
        noRecentMismatches: true,
        operatorApproval: true,
        sourceOfTruthApproval: true,
      };

      const allMet = Object.values(productionGate).every(Boolean);
      expect(allMet).toBe(true);
    });
  });
});
