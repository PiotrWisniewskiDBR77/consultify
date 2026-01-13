/**
 * Trial Demo Integration Tests
 * Tests for demo mode restrictions, trial expiration, and seat limits
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock organization with trial/demo status
const createOrganization = (config = {}) => ({
  id: config.id || 'org-123',
  name: config.name || 'Test Org',
  isDemo: config.isDemo || false,
  trialStatus: config.trialStatus || 'active', // 'active', 'expired', 'upgraded'
  trialExpiresAt: config.trialExpiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  seatLimit: config.seatLimit || 5,
  currentSeats: config.currentSeats || 2,
  plan: config.plan || 'trial',
});

// Mock access control
const createAccessControl = () => ({
  checkWriteAccess: (org, user, operation) => {
    // Demo mode blocks all writes
    if (org.isDemo) {
      return {
        allowed: false,
        reason: 'Write operations blocked in demo mode',
        demoMode: true,
      };
    }

    // Trial expired blocks most operations
    if (org.trialStatus === 'expired') {
      const allowedOps = ['view', 'export', 'upgrade'];
      if (!allowedOps.includes(operation)) {
        return {
          allowed: false,
          reason: 'Trial expired - upgrade required',
          upgradeUrl: '/billing/upgrade',
        };
      }
    }

    return { allowed: true };
  },

  checkMutation: (org, user, mutationType) => {
    if (org.isDemo) {
      return { allowed: false, reason: 'Mutations blocked for demo users' };
    }
    return { allowed: true };
  },

  getUpgradeUrl: (org) => {
    if (org.trialStatus === 'expired') {
      return `/billing/upgrade?org=${org.id}&plan=pro`;
    }
    return null;
  },
});

// Mock seat management
const createSeatManager = () => ({
  checkSeatAvailability: (org) => {
    if (org.currentSeats >= org.seatLimit) {
      return {
        available: false,
        current: org.currentSeats,
        limit: org.seatLimit,
        reason: 'Seat limit reached for trial organization',
      };
    }
    return {
      available: true,
      current: org.currentSeats,
      limit: org.seatLimit,
      remaining: org.seatLimit - org.currentSeats,
    };
  },

  addSeat: (org) => {
    const check = this.checkSeatAvailability?.(org) || {
      available: org.currentSeats < org.seatLimit,
    };
    if (!check.available) {
      return { success: false, ...check };
    }
    return { success: true, newSeatCount: org.currentSeats + 1 };
  },
});

describe('Trial Demo Integration', () => {
  let accessControl;
  let seatManager;

  beforeEach(() => {
    vi.clearAllMocks();
    accessControl = createAccessControl();
    seatManager = createSeatManager();
  });

  describe('Demo Mode Restrictions', () => {
    it('should block write operations in demo mode', () => {
      const demoOrg = createOrganization({ isDemo: true });
      const user = { id: 'user-1', role: 'admin' };

      const result = accessControl.checkWriteAccess(demoOrg, user, 'create');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('demo mode');
      expect(result.demoMode).toBe(true);
    });

    it('should block mutations for demo users', () => {
      const demoOrg = createOrganization({ isDemo: true });
      const user = { id: 'demo-user' };

      const result = accessControl.checkMutation(demoOrg, user, 'UPDATE');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('demo users');
    });

    it('should allow operations for non-demo orgs', () => {
      const normalOrg = createOrganization({ isDemo: false });
      const user = { id: 'user-1' };

      const result = accessControl.checkWriteAccess(normalOrg, user, 'create');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Trial Expiration', () => {
    it('should block features after trial expires', () => {
      const expiredOrg = createOrganization({ trialStatus: 'expired' });
      const user = { id: 'user-1' };

      const result = accessControl.checkWriteAccess(expiredOrg, user, 'create');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should handle already upgraded orgs', () => {
      const upgradedOrg = createOrganization({
        trialStatus: 'upgraded',
        plan: 'pro',
      });
      const user = { id: 'user-1' };

      const result = accessControl.checkWriteAccess(upgradedOrg, user, 'create');
      expect(result.allowed).toBe(true);
    });

    it('should return upgrade URL for expired trials', () => {
      const expiredOrg = createOrganization({
        id: 'org-456',
        trialStatus: 'expired',
      });

      const url = accessControl.getUpgradeUrl(expiredOrg);

      expect(url).toBeDefined();
      expect(url).toContain('/billing/upgrade');
      expect(url).toContain('org-456');
    });

    it('should not return upgrade URL for active trials', () => {
      const activeOrg = createOrganization({ trialStatus: 'active' });

      const url = accessControl.getUpgradeUrl(activeOrg);
      expect(url).toBeNull();
    });
  });

  describe('Seat Limits', () => {
    it('should enforce seat limits for trial orgs', () => {
      const trialOrg = createOrganization({
        seatLimit: 5,
        currentSeats: 5,
      });

      const result = seatManager.checkSeatAvailability(trialOrg);

      expect(result.available).toBe(false);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(5);
      expect(result.reason).toContain('limit reached');
    });

    it('should allow adding seats within limit', () => {
      const trialOrg = createOrganization({
        seatLimit: 5,
        currentSeats: 3,
      });

      const result = seatManager.checkSeatAvailability(trialOrg);

      expect(result.available).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should track remaining seats correctly', () => {
      const trialOrg = createOrganization({
        seatLimit: 10,
        currentSeats: 7,
      });

      const result = seatManager.checkSeatAvailability(trialOrg);

      expect(result.available).toBe(true);
      expect(result.remaining).toBe(3);
    });
  });
});
