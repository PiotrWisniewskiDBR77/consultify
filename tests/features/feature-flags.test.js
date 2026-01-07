/**
 * Feature Flag Service Tests
 * Tests for feature flag management
 * 
 * @module tests/features/feature-flags.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Feature flag service implementation
const createFeatureFlagService = () => {
    const flags = new Map();
    const overrides = new Map(); // User-specific overrides

    return {
        // Flag Management
        createFlag: (name, config = {}) => {
            if (flags.has(name)) return false;

            flags.set(name, {
                name,
                enabled: config.enabled ?? false,
                rolloutPercentage: config.rolloutPercentage ?? 100,
                allowedUsers: new Set(config.allowedUsers || []),
                blockedUsers: new Set(config.blockedUsers || []),
                allowedGroups: new Set(config.allowedGroups || []),
                metadata: config.metadata || {},
                createdAt: new Date().toISOString(),
            });
            return true;
        },

        deleteFlag: (name) => {
            return flags.delete(name);
        },

        getFlag: (name) => {
            const flag = flags.get(name);
            if (!flag) return null;
            return {
                ...flag,
                allowedUsers: [...flag.allowedUsers],
                blockedUsers: [...flag.blockedUsers],
                allowedGroups: [...flag.allowedGroups],
            };
        },

        getAllFlags: () => {
            return [...flags.keys()].map(name => this.getFlag(name));
        },

        updateFlag: (name, updates) => {
            const flag = flags.get(name);
            if (!flag) return false;

            if (updates.enabled !== undefined) flag.enabled = updates.enabled;
            if (updates.rolloutPercentage !== undefined) {
                flag.rolloutPercentage = Math.min(100, Math.max(0, updates.rolloutPercentage));
            }
            if (updates.metadata) flag.metadata = { ...flag.metadata, ...updates.metadata };

            flag.updatedAt = new Date().toISOString();
            return true;
        },

        // Enable/Disable
        enable: (name) => {
            const flag = flags.get(name);
            if (!flag) return false;
            flag.enabled = true;
            return true;
        },

        disable: (name) => {
            const flag = flags.get(name);
            if (!flag) return false;
            flag.enabled = false;
            return true;
        },

        // User Management
        allowUser: (name, userId) => {
            const flag = flags.get(name);
            if (!flag) return false;
            flag.allowedUsers.add(userId);
            return true;
        },

        blockUser: (name, userId) => {
            const flag = flags.get(name);
            if (!flag) return false;
            flag.blockedUsers.add(userId);
            return true;
        },

        // User Overrides
        setUserOverride: (userId, flagName, enabled) => {
            if (!overrides.has(userId)) {
                overrides.set(userId, new Map());
            }
            overrides.get(userId).set(flagName, enabled);
        },

        clearUserOverride: (userId, flagName) => {
            const userOverrides = overrides.get(userId);
            if (!userOverrides) return false;
            return userOverrides.delete(flagName);
        },

        // Evaluation
        isEnabled: (name, context = {}) => {
            const flag = flags.get(name);
            if (!flag) return false;
            if (!flag.enabled) return false;

            const { userId, groups = [] } = context;

            // Check user override first
            if (userId) {
                const userOverrides = overrides.get(userId);
                if (userOverrides && userOverrides.has(name)) {
                    return userOverrides.get(name);
                }
            }

            // Check blocked users
            if (userId && flag.blockedUsers.has(userId)) {
                return false;
            }

            // Check allowed users (bypass percentage)
            if (userId && flag.allowedUsers.has(userId)) {
                return true;
            }

            // Check allowed groups
            if (groups.length > 0) {
                for (const group of groups) {
                    if (flag.allowedGroups.has(group)) {
                        return true;
                    }
                }
            }

            // Check rollout percentage
            if (flag.rolloutPercentage < 100) {
                if (!userId) return false;

                // Deterministic hash based on userId and flag name
                const hash = [...(userId + name)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
                const bucket = hash % 100;
                return bucket < flag.rolloutPercentage;
            }

            return true;
        },

        // Evaluate multiple flags
        evaluateAll: (context = {}) => {
            const result = {};
            for (const [name] of flags) {
                result[name] = this.isEnabled(name, context);
            }
            return result;
        },

        // Reset
        reset: () => {
            flags.clear();
            overrides.clear();
        },
    };
};

describe('Feature Flag Service Tests', () => {
    let service;

    beforeEach(() => {
        service = createFeatureFlagService();
    });

    // ═══════════════════════════════════════════════════════════════════
    // FLAG MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    describe('Flag Management', () => {
        it('should create flag', () => {
            const result = service.createFlag('new-feature', { enabled: true });

            expect(result).toBe(true);
            expect(service.getFlag('new-feature')).toBeDefined();
        });

        it('should not create duplicate flag', () => {
            service.createFlag('feature');
            const result = service.createFlag('feature');

            expect(result).toBe(false);
        });

        it('should delete flag', () => {
            service.createFlag('temp');

            expect(service.deleteFlag('temp')).toBe(true);
            expect(service.getFlag('temp')).toBeNull();
        });

        it('should update flag', () => {
            service.createFlag('feature', { enabled: false });
            service.updateFlag('feature', { enabled: true, rolloutPercentage: 50 });

            const flag = service.getFlag('feature');
            expect(flag.enabled).toBe(true);
            expect(flag.rolloutPercentage).toBe(50);
        });

        it('should get all flags', () => {
            service.createFlag('feature1');
            service.createFlag('feature2');
            service.createFlag('feature3');

            expect(service.getAllFlags().length).toBe(3);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENABLE / DISABLE
    // ═══════════════════════════════════════════════════════════════════

    describe('Enable / Disable', () => {
        beforeEach(() => {
            service.createFlag('feature', { enabled: false });
        });

        it('should enable flag', () => {
            service.enable('feature');

            expect(service.getFlag('feature').enabled).toBe(true);
        });

        it('should disable flag', () => {
            service.enable('feature');
            service.disable('feature');

            expect(service.getFlag('feature').enabled).toBe(false);
        });

        it('should return false for unknown flag', () => {
            expect(service.enable('unknown')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // USER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    describe('User Management', () => {
        beforeEach(() => {
            service.createFlag('beta-feature', { enabled: true, rolloutPercentage: 0 });
        });

        it('should allow specific user', () => {
            service.allowUser('beta-feature', 'user-1');

            expect(service.isEnabled('beta-feature', { userId: 'user-1' })).toBe(true);
        });

        it('should block specific user', () => {
            service.createFlag('feature', { enabled: true });
            service.blockUser('feature', 'user-1');

            expect(service.isEnabled('feature', { userId: 'user-1' })).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // USER OVERRIDES
    // ═══════════════════════════════════════════════════════════════════

    describe('User Overrides', () => {
        beforeEach(() => {
            service.createFlag('feature', { enabled: false });
        });

        it('should override flag for user', () => {
            service.setUserOverride('user-1', 'feature', true);

            expect(service.isEnabled('feature', { userId: 'user-1' })).toBe(true);
        });

        it('should clear override', () => {
            service.setUserOverride('user-1', 'feature', true);
            service.clearUserOverride('user-1', 'feature');

            expect(service.isEnabled('feature', { userId: 'user-1' })).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EVALUATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Evaluation', () => {
        it('should return false if flag does not exist', () => {
            expect(service.isEnabled('nonexistent')).toBe(false);
        });

        it('should return false if flag disabled', () => {
            service.createFlag('feature', { enabled: false });

            expect(service.isEnabled('feature')).toBe(false);
        });

        it('should return true if enabled and 100% rollout', () => {
            service.createFlag('feature', { enabled: true, rolloutPercentage: 100 });

            expect(service.isEnabled('feature')).toBe(true);
        });

        it('should check group membership', () => {
            service.createFlag('premium-feature', {
                enabled: true,
                rolloutPercentage: 0,
                allowedGroups: ['premium'],
            });

            expect(service.isEnabled('premium-feature', { groups: ['premium'] })).toBe(true);
            expect(service.isEnabled('premium-feature', { groups: ['free'] })).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ROLLOUT PERCENTAGE
    // ═══════════════════════════════════════════════════════════════════

    describe('Rollout Percentage', () => {
        it('should be deterministic for same user', () => {
            service.createFlag('feature', { enabled: true, rolloutPercentage: 50 });

            const result1 = service.isEnabled('feature', { userId: 'user-1' });
            const result2 = service.isEnabled('feature', { userId: 'user-1' });

            expect(result1).toBe(result2);
        });

        it('should return false without userId for partial rollout', () => {
            service.createFlag('feature', { enabled: true, rolloutPercentage: 50 });

            expect(service.isEnabled('feature')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EVALUATE ALL
    // ═══════════════════════════════════════════════════════════════════

    describe('Evaluate All', () => {
        it('should evaluate all flags', () => {
            service.createFlag('feature1', { enabled: true });
            service.createFlag('feature2', { enabled: false });
            service.createFlag('feature3', { enabled: true });

            const results = service.evaluateAll();

            expect(results.feature1).toBe(true);
            expect(results.feature2).toBe(false);
            expect(results.feature3).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RESET
    // ═══════════════════════════════════════════════════════════════════

    describe('Reset', () => {
        it('should reset all data', () => {
            service.createFlag('feature');
            service.setUserOverride('user-1', 'feature', true);

            service.reset();

            expect(service.getAllFlags().length).toBe(0);
        });
    });
});
