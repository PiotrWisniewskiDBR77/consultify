/**
 * Plan Limit Service Unit Tests
 * 
 * Tests for plan-based feature limits.
 * 
 * @module tests/unit/backend/planLimitService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create plan limit service implementation
const createPlanLimitService = () => {
    const planLimits = new Map([
        ['free', {
            projects: 3,
            users: 5,
            storage: 1 * 1024 * 1024 * 1024, // 1GB
            aiCalls: 100,
            integrations: 2,
            features: ['basic_analytics']
        }],
        ['pro', {
            projects: 25,
            users: 50,
            storage: 50 * 1024 * 1024 * 1024, // 50GB
            aiCalls: 5000,
            integrations: 10,
            features: ['basic_analytics', 'advanced_analytics', 'ai_assistant', 'custom_reports']
        }],
        ['enterprise', {
            projects: Infinity,
            users: Infinity,
            storage: Infinity,
            aiCalls: Infinity,
            integrations: Infinity,
            features: ['basic_analytics', 'advanced_analytics', 'ai_assistant', 'custom_reports', 'sso', 'audit_logs', 'api_access']
        }]
    ]);

    const usage = new Map();

    // Internal helper: check limit
    const checkLimitInternal = (orgId, plan, resource) => {
        const limits = planLimits.get(plan) || planLimits.get('free');
        const limit = limits[resource];

        if (limit === undefined) {
            return { allowed: true, limit: null, used: 0 };
        }

        const key = `${orgId}:${resource}`;
        const used = usage.get(key) || 0;

        return {
            allowed: used < limit || limit === Infinity,
            limit,
            used,
            remaining: limit === Infinity ? Infinity : Math.max(0, limit - used)
        };
    };

    return {
        // Get limits for plan
        getLimits: async (plan) => {
            return planLimits.get(plan) || planLimits.get('free');
        },

        // Check if action is allowed
        checkLimit: async (orgId, plan, resource) => {
            return checkLimitInternal(orgId, plan, resource);
        },

        // Increment usage
        incrementUsage: async (orgId, resource, amount = 1) => {
            const key = `${orgId}:${resource}`;
            const current = usage.get(key) || 0;
            usage.set(key, current + amount);
            return usage.get(key);
        },

        // Decrement usage
        decrementUsage: async (orgId, resource, amount = 1) => {
            const key = `${orgId}:${resource}`;
            const current = usage.get(key) || 0;
            usage.set(key, Math.max(0, current - amount));
            return usage.get(key);
        },

        // Get current usage
        getUsage: async (orgId, resource) => {
            const key = `${orgId}:${resource}`;
            return usage.get(key) || 0;
        },

        // Check feature access
        hasFeature: async (plan, feature) => {
            const limits = planLimits.get(plan) || planLimits.get('free');
            return limits.features.includes(feature);
        },

        // Get all features for plan
        getFeatures: async (plan) => {
            const limits = planLimits.get(plan) || planLimits.get('free');
            return limits.features;
        },

        // Compare plans
        comparePlans: async (currentPlan, targetPlan) => {
            const current = planLimits.get(currentPlan) || planLimits.get('free');
            const target = planLimits.get(targetPlan) || planLimits.get('free');

            const improvements = [];
            const resources = ['projects', 'users', 'storage', 'aiCalls', 'integrations'];

            for (const resource of resources) {
                if (target[resource] > current[resource]) {
                    improvements.push({
                        resource,
                        current: current[resource],
                        new: target[resource],
                        increase: target[resource] === Infinity ? 'unlimited' : target[resource] - current[resource]
                    });
                }
            }

            const newFeatures = target.features.filter(f => !current.features.includes(f));

            return {
                currentPlan,
                targetPlan,
                improvements,
                newFeatures
            };
        },

        // Check upgrade needed
        checkUpgradeNeeded: async (orgId, plan, resource) => {
            const check = checkLimitInternal(orgId, plan, resource);

            if (check.allowed) {
                return { needed: false };
            }

            // Find next plan with higher limit
            const plans = ['free', 'pro', 'enterprise'];
            const currentIndex = plans.indexOf(plan);

            for (let i = currentIndex + 1; i < plans.length; i++) {
                const nextPlan = plans[i];
                const nextLimits = planLimits.get(nextPlan);
                if (nextLimits[resource] > check.used) {
                    return {
                        needed: true,
                        suggestedPlan: nextPlan,
                        newLimit: nextLimits[resource]
                    };
                }
            }

            return { needed: true, suggestedPlan: 'enterprise' };
        },

        // Reset usage
        resetUsage: async (orgId, resource) => {
            const key = `${orgId}:${resource}`;
            usage.delete(key);
        },

        // Clear for testing
        clear: () => usage.clear()
    };
};

describe('PlanLimitService', () => {
    let limitService;

    beforeEach(() => {
        limitService = createPlanLimitService();
    });

    describe('Plan Limits', () => {
        it('should return correct limits for free plan', async () => {
            const limits = await limitService.getLimits('free');

            expect(limits.projects).toBe(3);
            expect(limits.users).toBe(5);
            expect(limits.aiCalls).toBe(100);
        });

        it('should return correct limits for pro plan', async () => {
            const limits = await limitService.getLimits('pro');

            expect(limits.projects).toBe(25);
            expect(limits.users).toBe(50);
        });

        it('should return unlimited for enterprise', async () => {
            const limits = await limitService.getLimits('enterprise');

            expect(limits.projects).toBe(Infinity);
            expect(limits.users).toBe(Infinity);
        });
    });

    describe('Limit Checking', () => {
        it('should allow action within limits', async () => {
            await limitService.incrementUsage('org-1', 'projects', 2);

            const check = await limitService.checkLimit('org-1', 'free', 'projects');

            expect(check.allowed).toBe(true);
            expect(check.used).toBe(2);
            expect(check.remaining).toBe(1);
        });

        it('should block action at limit', async () => {
            await limitService.incrementUsage('org-1', 'projects', 3);

            const check = await limitService.checkLimit('org-1', 'free', 'projects');

            expect(check.allowed).toBe(false);
            expect(check.remaining).toBe(0);
        });

        it('should always allow for enterprise', async () => {
            await limitService.incrementUsage('org-1', 'projects', 1000);

            const check = await limitService.checkLimit('org-1', 'enterprise', 'projects');

            expect(check.allowed).toBe(true);
            expect(check.remaining).toBe(Infinity);
        });
    });

    describe('Usage Tracking', () => {
        it('should increment usage', async () => {
            await limitService.incrementUsage('org-1', 'aiCalls', 10);
            await limitService.incrementUsage('org-1', 'aiCalls', 5);

            const used = await limitService.getUsage('org-1', 'aiCalls');
            expect(used).toBe(15);
        });

        it('should decrement usage', async () => {
            await limitService.incrementUsage('org-1', 'projects', 5);
            await limitService.decrementUsage('org-1', 'projects', 2);

            const used = await limitService.getUsage('org-1', 'projects');
            expect(used).toBe(3);
        });

        it('should not go below zero', async () => {
            await limitService.decrementUsage('org-1', 'projects', 10);

            const used = await limitService.getUsage('org-1', 'projects');
            expect(used).toBe(0);
        });
    });

    describe('Feature Access', () => {
        it('should check feature access for plan', async () => {
            const freeHasAi = await limitService.hasFeature('free', 'ai_assistant');
            const proHasAi = await limitService.hasFeature('pro', 'ai_assistant');

            expect(freeHasAi).toBe(false);
            expect(proHasAi).toBe(true);
        });

        it('should list all features for plan', async () => {
            const features = await limitService.getFeatures('enterprise');

            expect(features).toContain('sso');
            expect(features).toContain('audit_logs');
            expect(features).toContain('api_access');
        });
    });

    describe('Plan Comparison', () => {
        it('should compare plans', async () => {
            const comparison = await limitService.comparePlans('free', 'pro');

            expect(comparison.improvements.length).toBeGreaterThan(0);
            expect(comparison.newFeatures).toContain('ai_assistant');
        });
    });

    describe('Upgrade Suggestion', () => {
        it('should suggest upgrade when limit reached', async () => {
            await limitService.incrementUsage('org-1', 'projects', 3);

            const result = await limitService.checkUpgradeNeeded('org-1', 'free', 'projects');

            expect(result.needed).toBe(true);
            expect(result.suggestedPlan).toBe('pro');
        });

        it('should not suggest upgrade when within limits', async () => {
            await limitService.incrementUsage('org-1', 'projects', 1);

            const result = await limitService.checkUpgradeNeeded('org-1', 'free', 'projects');

            expect(result.needed).toBe(false);
        });
    });
});
