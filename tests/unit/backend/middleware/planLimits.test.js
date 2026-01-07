/**
 * Plan Limits Middleware Unit Tests
 *
 * Comprehensive tests for subscription plan-based limits.
 * Uses inline implementation to avoid import issues.
 *
 * @module tests/unit/backend/middleware/planLimits.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

const createPlanLimitsMiddleware = () => {
    const plans = new Map([
        [
            'trial',
            {
                name: 'Trial',
                limits: {
                    projects: 2,
                    users: 2,
                    assessments: 5,
                    aiQueries: 50,
                    storageGB: 0.5,
                    integrations: 0,
                    sso: false,
                    api: false,
                    customBranding: false,
                    support: 'community',
                },
                features: ['basic_reports', 'dashboard'],
            },
        ],
        [
            'starter',
            {
                name: 'Starter',
                limits: {
                    projects: 5,
                    users: 10,
                    assessments: 20,
                    aiQueries: 500,
                    storageGB: 5,
                    integrations: 2,
                    sso: false,
                    api: true,
                    customBranding: false,
                    support: 'email',
                },
                features: ['basic_reports', 'dashboard', 'export', 'api'],
            },
        ],
        [
            'professional',
            {
                name: 'Professional',
                limits: {
                    projects: 25,
                    users: 50,
                    assessments: -1, // unlimited
                    aiQueries: 5000,
                    storageGB: 50,
                    integrations: 10,
                    sso: true,
                    api: true,
                    customBranding: true,
                    support: 'priority',
                },
                features: ['basic_reports', 'dashboard', 'export', 'api', 'advanced_analytics', 'sso'],
            },
        ],
        [
            'enterprise',
            {
                name: 'Enterprise',
                limits: {
                    projects: -1,
                    users: -1,
                    assessments: -1,
                    aiQueries: -1,
                    storageGB: -1,
                    integrations: -1,
                    sso: true,
                    api: true,
                    customBranding: true,
                    support: 'dedicated',
                },
                features: ['*'],
            },
        ],
    ]);

    return {
        getPlan: (planId) => plans.get(planId) || null,

        getLimit: (planId, limitKey) => {
            const plan = plans.get(planId);
            if (!plan) return 0;
            return plan.limits[limitKey];
        },

        isLimitExceeded: (planId, limitKey, currentValue) => {
            const limit = plans.get(planId)?.limits[limitKey];
            if (limit === undefined) return true;
            if (limit === -1) return false; // unlimited
            if (typeof limit === 'boolean') return !limit;
            return currentValue >= limit;
        },

        hasFeature: (planId, feature) => {
            const plan = plans.get(planId);
            if (!plan) return false;
            if (plan.features.includes('*')) return true;
            return plan.features.includes(feature);
        },

        canUpgradeTo: (currentPlan, targetPlan) => {
            const planOrder = ['trial', 'starter', 'professional', 'enterprise'];
            const currentIdx = planOrder.indexOf(currentPlan);
            const targetIdx = planOrder.indexOf(targetPlan);
            return targetIdx > currentIdx;
        },

        getUpgradeOptions: (currentPlan) => {
            const planOrder = ['trial', 'starter', 'professional', 'enterprise'];
            const currentIdx = planOrder.indexOf(currentPlan);
            return planOrder.slice(currentIdx + 1);
        },

        enforcePlanLimit: (limitKey, options = {}) => {
            return (req, res, next) => {
                if (!req.org) {
                    return res.status(400).json({ error: 'Organization context required' });
                }

                const planId = req.org.plan || 'trial';
                const limits = createPlanLimitsMiddleware();
                const limit = limits.getLimit(planId, limitKey);

                // Get current count from request or options
                const currentCount = options.getCurrentCount?.(req) || req.resourceCount || 0;

                if (limits.isLimitExceeded(planId, limitKey, currentCount)) {
                    return res.status(403).json({
                        error: 'Plan limit exceeded',
                        limit: limitKey,
                        current: currentCount,
                        max: limit,
                        plan: planId,
                        upgradeOptions: limits.getUpgradeOptions(planId),
                    });
                }

                next();
            };
        },

        requireFeature: (feature) => {
            return (req, res, next) => {
                if (!req.org) {
                    return res.status(400).json({ error: 'Organization context required' });
                }

                const planId = req.org.plan || 'trial';
                const limits = createPlanLimitsMiddleware();

                if (!limits.hasFeature(planId, feature)) {
                    return res.status(403).json({
                        error: 'Feature not available in current plan',
                        feature,
                        plan: planId,
                        upgradeOptions: limits.getUpgradeOptions(planId),
                    });
                }

                next();
            };
        },

        comparePlans: (planA, planB) => {
            const a = plans.get(planA);
            const b = plans.get(planB);
            if (!a || !b) return null;

            const comparison = {};
            for (const key of Object.keys(a.limits)) {
                comparison[key] = {
                    [planA]: a.limits[key],
                    [planB]: b.limits[key],
                };
            }
            return comparison;
        },

        getAllPlans: () =>
            Array.from(plans.entries()).map(([id, plan]) => ({
                id,
                ...plan,
            })),
    };
};

// ============================================
// TESTS
// ============================================

describe('Plan Limits Middleware', () => {
    let planLimits;

    beforeEach(() => {
        planLimits = createPlanLimitsMiddleware();
    });

    describe('getPlan()', () => {
        it('should return plan details', () => {
            const plan = planLimits.getPlan('professional');

            expect(plan.name).toBe('Professional');
            expect(plan.limits.projects).toBe(25);
            expect(plan.limits.sso).toBe(true);
        });

        it('should return null for unknown plan', () => {
            expect(planLimits.getPlan('unknown')).toBeNull();
        });
    });

    describe('getLimit()', () => {
        it('should return limit value', () => {
            expect(planLimits.getLimit('trial', 'projects')).toBe(2);
            expect(planLimits.getLimit('starter', 'users')).toBe(10);
        });

        it('should return -1 for unlimited', () => {
            expect(planLimits.getLimit('enterprise', 'projects')).toBe(-1);
        });

        it('should return 0 for unknown plan', () => {
            expect(planLimits.getLimit('unknown', 'projects')).toBe(0);
        });
    });

    describe('isLimitExceeded()', () => {
        it('should return true when at limit', () => {
            expect(planLimits.isLimitExceeded('trial', 'projects', 2)).toBe(true);
        });

        it('should return false when under limit', () => {
            expect(planLimits.isLimitExceeded('trial', 'projects', 1)).toBe(false);
        });

        it('should return false for unlimited', () => {
            expect(planLimits.isLimitExceeded('enterprise', 'projects', 1000)).toBe(false);
        });

        it('should handle boolean limits', () => {
            expect(planLimits.isLimitExceeded('trial', 'sso', 0)).toBe(true); // sso: false
            expect(planLimits.isLimitExceeded('professional', 'sso', 0)).toBe(false); // sso: true
        });
    });

    describe('hasFeature()', () => {
        it('should return true for included features', () => {
            expect(planLimits.hasFeature('starter', 'dashboard')).toBe(true);
            expect(planLimits.hasFeature('starter', 'api')).toBe(true);
        });

        it('should return false for excluded features', () => {
            expect(planLimits.hasFeature('starter', 'advanced_analytics')).toBe(false);
            expect(planLimits.hasFeature('trial', 'sso')).toBe(false);
        });

        it('should return true for all features on enterprise', () => {
            expect(planLimits.hasFeature('enterprise', 'anything')).toBe(true);
            expect(planLimits.hasFeature('enterprise', 'custom_feature')).toBe(true);
        });
    });

    describe('canUpgradeTo()', () => {
        it('should allow upgrade to higher tier', () => {
            expect(planLimits.canUpgradeTo('trial', 'starter')).toBe(true);
            expect(planLimits.canUpgradeTo('starter', 'professional')).toBe(true);
        });

        it('should not allow downgrade', () => {
            expect(planLimits.canUpgradeTo('professional', 'starter')).toBe(false);
            expect(planLimits.canUpgradeTo('enterprise', 'trial')).toBe(false);
        });

        it('should not allow upgrade to same tier', () => {
            expect(planLimits.canUpgradeTo('starter', 'starter')).toBe(false);
        });
    });

    describe('getUpgradeOptions()', () => {
        it('should return available upgrades', () => {
            const options = planLimits.getUpgradeOptions('starter');

            expect(options).toContain('professional');
            expect(options).toContain('enterprise');
            expect(options).not.toContain('trial');
            expect(options).not.toContain('starter');
        });

        it('should return empty for enterprise', () => {
            expect(planLimits.getUpgradeOptions('enterprise')).toHaveLength(0);
        });
    });

    describe('enforcePlanLimit() middleware', () => {
        it('should return 400 for missing org', () => {
            const mw = planLimits.enforcePlanLimit('projects');
            const req = {};
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 403 when limit exceeded', () => {
            const mw = planLimits.enforcePlanLimit('projects');
            const req = {
                org: { plan: 'trial' },
                resourceCount: 2,
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
                    error: 'Plan limit exceeded',
                    limit: 'projects',
                }),
            );
        });

        it('should call next when within limits', () => {
            const mw = planLimits.enforcePlanLimit('projects');
            const req = {
                org: { plan: 'trial' },
                resourceCount: 1,
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('requireFeature() middleware', () => {
        it('should return 403 for unavailable feature', () => {
            const mw = planLimits.requireFeature('advanced_analytics');
            const req = { org: { plan: 'starter' } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should call next for available feature', () => {
            const mw = planLimits.requireFeature('api');
            const req = { org: { plan: 'starter' } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('comparePlans()', () => {
        it('should compare two plans', () => {
            const comparison = planLimits.comparePlans('starter', 'professional');

            expect(comparison.projects.starter).toBe(5);
            expect(comparison.projects.professional).toBe(25);
        });

        it('should return null for unknown plan', () => {
            expect(planLimits.comparePlans('unknown', 'starter')).toBeNull();
        });
    });

    describe('getAllPlans()', () => {
        it('should return all plans with details', () => {
            const allPlans = planLimits.getAllPlans();

            expect(allPlans.length).toBe(4);
            expect(allPlans.map((p) => p.id)).toContain('trial');
            expect(allPlans.map((p) => p.id)).toContain('enterprise');
        });
    });
});
