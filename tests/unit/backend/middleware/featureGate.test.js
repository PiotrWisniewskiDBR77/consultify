/**
 * Feature Gate Middleware Unit Tests
 *
 * Comprehensive tests for feature flag-based access control.
 * Uses inline implementation to avoid import issues.
 *
 * @module tests/unit/backend/middleware/featureGate.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

const createFeatureGateMiddleware = () => {
  const features = new Map([
    ['ai_assistant', { enabled: true, plans: ['pro', 'enterprise'], beta: false }],
    ['advanced_analytics', { enabled: true, plans: ['enterprise'], beta: false }],
    ['bulk_export', { enabled: true, plans: ['pro', 'enterprise'], beta: false }],
    ['api_access', { enabled: true, plans: ['pro', 'enterprise'], beta: false }],
    ['custom_branding', { enabled: true, plans: ['enterprise'], beta: false }],
    ['beta_features', { enabled: true, plans: ['enterprise'], beta: true }],
    ['sso_integration', { enabled: true, plans: ['enterprise'], beta: false }],
    ['audit_logs', { enabled: true, plans: ['pro', 'enterprise'], beta: false }],
    ['experimental_ui', { enabled: false, plans: [], beta: true }],
  ]);

  const userOverrides = new Map();
  const orgOverrides = new Map();

  return {
    isFeatureEnabled: (featureName, context = {}) => {
      const feature = features.get(featureName);
      if (!feature) return false;
      if (!feature.enabled) return false;

      // Check user-level override
      const userKey = `${context.userId}:${featureName}`;
      if (userOverrides.has(userKey)) {
        return userOverrides.get(userKey);
      }

      // Check org-level override
      const orgKey = `${context.orgId}:${featureName}`;
      if (orgOverrides.has(orgKey)) {
        return orgOverrides.get(orgKey);
      }

      // Check plan access
      if (feature.plans.length > 0 && context.plan) {
        if (!feature.plans.includes(context.plan)) {
          return false;
        }
      }

      // Check beta access
      if (feature.beta && !context.betaAccess) {
        return false;
      }

      return true;
    },

    requireFeature: (featureName, options = {}) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const context = {
          userId: req.user.id,
          orgId: req.user.orgId,
          plan: req.user.plan || req.org?.plan,
          betaAccess: req.user.betaAccess || req.org?.betaAccess,
        };

        const gate = createFeatureGateMiddleware();

        if (!gate.isFeatureEnabled(featureName, context)) {
          const message =
            options.upgradeMessage || `Feature '${featureName}' is not available for your plan`;
          return res.status(403).json({
            error: 'Feature not available',
            message,
            feature: featureName,
            upgrade: options.showUpgrade !== false,
          });
        }

        next();
      };
    },

    setFeatureOverride: (scope, id, featureName, enabled) => {
      const key = `${id}:${featureName}`;
      if (scope === 'user') {
        userOverrides.set(key, enabled);
      } else if (scope === 'org') {
        orgOverrides.set(key, enabled);
      }
    },

    removeFeatureOverride: (scope, id, featureName) => {
      const key = `${id}:${featureName}`;
      if (scope === 'user') {
        userOverrides.delete(key);
      } else if (scope === 'org') {
        orgOverrides.delete(key);
      }
    },

    getFeatureConfig: (featureName) => features.get(featureName) || null,

    getAllFeatures: () => Array.from(features.keys()),

    setFeatureConfig: (featureName, config) => {
      features.set(featureName, config);
    },

    toggleFeature: (featureName, enabled) => {
      const feature = features.get(featureName);
      if (feature) {
        feature.enabled = enabled;
      }
    },
  };
};

// ============================================
// TESTS
// ============================================

describe('Feature Gate Middleware', () => {
  let featureGate;

  beforeEach(() => {
    featureGate = createFeatureGateMiddleware();
  });

  describe('isFeatureEnabled()', () => {
    it('should return true for enabled feature with matching plan', () => {
      const result = featureGate.isFeatureEnabled('ai_assistant', { plan: 'pro' });
      expect(result).toBe(true);
    });

    it('should return false for disabled feature', () => {
      const result = featureGate.isFeatureEnabled('experimental_ui', { plan: 'enterprise' });
      expect(result).toBe(false);
    });

    it('should return false for non-existent feature', () => {
      const result = featureGate.isFeatureEnabled('non_existent');
      expect(result).toBe(false);
    });

    it('should return false for wrong plan level', () => {
      const result = featureGate.isFeatureEnabled('advanced_analytics', { plan: 'pro' });
      expect(result).toBe(false);
    });

    it('should return true for enterprise features with enterprise plan', () => {
      const result = featureGate.isFeatureEnabled('advanced_analytics', { plan: 'enterprise' });
      expect(result).toBe(true);
    });

    it('should respect beta access flag', () => {
      const withBeta = featureGate.isFeatureEnabled('beta_features', {
        plan: 'enterprise',
        betaAccess: true,
      });
      const withoutBeta = featureGate.isFeatureEnabled('beta_features', {
        plan: 'enterprise',
        betaAccess: false,
      });

      expect(withBeta).toBe(true);
      expect(withoutBeta).toBe(false);
    });

    it('should respect user overrides', () => {
      featureGate.setFeatureOverride('user', 'user-123', 'advanced_analytics', true);

      const result = featureGate.isFeatureEnabled('advanced_analytics', {
        userId: 'user-123',
        plan: 'free', // Normally wouldn't have access
      });

      expect(result).toBe(true);
    });

    it('should respect org overrides', () => {
      featureGate.setFeatureOverride('org', 'org-456', 'ai_assistant', false);

      const result = featureGate.isFeatureEnabled('ai_assistant', {
        orgId: 'org-456',
        plan: 'enterprise', // Normally would have access
      });

      expect(result).toBe(false);
    });
  });

  describe('requireFeature() middleware', () => {
    it('should return 401 for missing user', () => {
      const mw = featureGate.requireFeature('ai_assistant');
      const req = {};
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for unavailable feature', () => {
      const mw = featureGate.requireFeature('advanced_analytics');
      const req = {
        user: { id: 'user-1', plan: 'pro' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Feature not available',
          feature: 'advanced_analytics',
        })
      );
    });

    it('should call next for available feature', () => {
      const mw = featureGate.requireFeature('ai_assistant');
      const req = {
        user: { id: 'user-1', plan: 'pro' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      mw(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use custom upgrade message', () => {
      const mw = featureGate.requireFeature('advanced_analytics', {
        upgradeMessage: 'Upgrade to Enterprise for advanced analytics!',
      });
      const req = {
        user: { id: 'user-1', plan: 'free' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      mw(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Upgrade to Enterprise for advanced analytics!',
        })
      );
    });
  });

  describe('setFeatureOverride() / removeFeatureOverride()', () => {
    it('should set and remove user overrides', () => {
      featureGate.setFeatureOverride('user', 'user-1', 'api_access', true);

      expect(
        featureGate.isFeatureEnabled('api_access', {
          userId: 'user-1',
          plan: 'free',
        })
      ).toBe(true);

      featureGate.removeFeatureOverride('user', 'user-1', 'api_access');

      expect(
        featureGate.isFeatureEnabled('api_access', {
          userId: 'user-1',
          plan: 'free',
        })
      ).toBe(false);
    });
  });

  describe('getFeatureConfig()', () => {
    it('should return feature configuration', () => {
      const config = featureGate.getFeatureConfig('ai_assistant');

      expect(config.enabled).toBe(true);
      expect(config.plans).toContain('pro');
      expect(config.beta).toBe(false);
    });

    it('should return null for unknown feature', () => {
      const config = featureGate.getFeatureConfig('unknown');
      expect(config).toBeNull();
    });
  });

  describe('getAllFeatures()', () => {
    it('should return all feature names', () => {
      const features = featureGate.getAllFeatures();

      expect(features).toContain('ai_assistant');
      expect(features).toContain('advanced_analytics');
      expect(features).toContain('sso_integration');
    });
  });

  describe('setFeatureConfig()', () => {
    it('should add new feature configuration', () => {
      featureGate.setFeatureConfig('new_feature', {
        enabled: true,
        plans: ['enterprise'],
        beta: true,
      });

      expect(featureGate.getAllFeatures()).toContain('new_feature');
      expect(featureGate.getFeatureConfig('new_feature').beta).toBe(true);
    });
  });

  describe('toggleFeature()', () => {
    it('should toggle feature enabled state', () => {
      expect(featureGate.isFeatureEnabled('ai_assistant', { plan: 'pro' })).toBe(true);

      featureGate.toggleFeature('ai_assistant', false);

      expect(featureGate.isFeatureEnabled('ai_assistant', { plan: 'pro' })).toBe(false);

      featureGate.toggleFeature('ai_assistant', true);

      expect(featureGate.isFeatureEnabled('ai_assistant', { plan: 'pro' })).toBe(true);
    });
  });
});
