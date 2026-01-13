/**
 * Feature Flag Service Unit Tests
 * Tests feature flag management and evaluation logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Feature flag configuration (in-memory for testing)
const createFeatureFlagService = () => {
  const flags = new Map();

  return {
    setFlag: (name, enabled, metadata = {}) => {
      flags.set(name, { enabled, metadata, updatedAt: new Date() });
    },

    isEnabled: (name, context = {}) => {
      const flag = flags.get(name);
      if (!flag) return false;

      // Check rollout percentage if defined
      if (flag.metadata.rolloutPercent !== undefined && context.userId) {
        const hash = context.userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const bucket = hash % 100;
        return bucket < flag.metadata.rolloutPercent;
      }

      // Check org-specific override
      if (flag.metadata.orgOverrides && context.orgId) {
        const override = flag.metadata.orgOverrides[context.orgId];
        if (override !== undefined) return override;
      }

      return flag.enabled;
    },

    getFlag: (name) => flags.get(name) || null,

    getAllFlags: () => Array.from(flags.entries()).map(([name, data]) => ({ name, ...data })),

    removeFlag: (name) => flags.delete(name),

    clear: () => flags.clear(),
  };
};

describe('FeatureFlagService', () => {
  let service;

  beforeEach(() => {
    service = createFeatureFlagService();
  });

  describe('Basic Flag Operations', () => {
    it('should set and check flag', () => {
      service.setFlag('new_ui', true);

      expect(service.isEnabled('new_ui')).toBe(true);
    });

    it('should return false for undefined flag', () => {
      expect(service.isEnabled('non_existent_flag')).toBe(false);
    });

    it('should disable flag', () => {
      service.setFlag('feature_x', true);
      service.setFlag('feature_x', false);

      expect(service.isEnabled('feature_x')).toBe(false);
    });

    it('should list all flags', () => {
      service.setFlag('flag_a', true);
      service.setFlag('flag_b', false);
      service.setFlag('flag_c', true);

      const flags = service.getAllFlags();

      expect(flags.length).toBe(3);
      expect(flags.some((f) => f.name === 'flag_a' && f.enabled === true)).toBe(true);
    });

    it('should remove flag', () => {
      service.setFlag('temp_flag', true);
      service.removeFlag('temp_flag');

      expect(service.isEnabled('temp_flag')).toBe(false);
    });
  });

  describe('Rollout Percentage', () => {
    it('should enable for users within rollout percentage', () => {
      service.setFlag('gradual_rollout', true, { rolloutPercent: 50 });

      // Test with multiple user IDs
      let enabledCount = 0;
      for (let i = 0; i < 100; i++) {
        if (service.isEnabled('gradual_rollout', { userId: `user-${i}` })) {
          enabledCount++;
        }
      }

      // Should be roughly 50% (allow some variance)
      expect(enabledCount).toBeGreaterThan(30);
      expect(enabledCount).toBeLessThan(70);
    });

    it('should handle 0% rollout', () => {
      service.setFlag('disabled_rollout', true, { rolloutPercent: 0 });

      expect(service.isEnabled('disabled_rollout', { userId: 'any-user' })).toBe(false);
    });

    it('should handle 100% rollout', () => {
      service.setFlag('full_rollout', true, { rolloutPercent: 100 });

      expect(service.isEnabled('full_rollout', { userId: 'any-user' })).toBe(true);
    });
  });

  describe('Organization Overrides', () => {
    it('should respect org-specific overrides', () => {
      service.setFlag('org_feature', true, {
        orgOverrides: {
          'org-special': false,
          'org-vip': true,
        },
      });

      // Default behavior
      expect(service.isEnabled('org_feature', { orgId: 'org-normal' })).toBe(true);

      // Specific override
      expect(service.isEnabled('org_feature', { orgId: 'org-special' })).toBe(false);
      expect(service.isEnabled('org_feature', { orgId: 'org-vip' })).toBe(true);
    });
  });

  describe('Flag Metadata', () => {
    it('should store and retrieve flag metadata', () => {
      service.setFlag('feature_with_meta', true, {
        description: 'Test feature',
        owner: 'team-x',
        jiraTicket: 'PROJ-123',
      });

      const flag = service.getFlag('feature_with_meta');

      expect(flag).not.toBeNull();
      expect(flag.metadata.description).toBe('Test feature');
      expect(flag.metadata.owner).toBe('team-x');
    });

    it('should track update timestamp', () => {
      const before = new Date();
      service.setFlag('timed_flag', true);
      const after = new Date();

      const flag = service.getFlag('timed_flag');

      expect(flag.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(flag.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context', () => {
      service.setFlag('simple_flag', true);

      expect(service.isEnabled('simple_flag', {})).toBe(true);
    });

    it('should handle null/undefined flag names gracefully', () => {
      expect(service.isEnabled(null)).toBe(false);
      expect(service.isEnabled(undefined)).toBe(false);
    });
  });
});
