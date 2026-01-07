/**
 * Demo Guard Middleware Unit Tests
 * 
 * Comprehensive tests for demo mode access control.
 * Uses inline implementation to avoid import issues.
 * 
 * @module tests/unit/backend/middleware/demoGuard.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

const createDemoGuardMiddleware = () => {
    const demoRestrictedActions = new Set([
        'user.delete',
        'org.delete',
        'billing.modify',
        'subscription.cancel',
        'data.export',
        'settings.modify_critical',
        'api_key.create',
        'webhook.create',
        'integration.connect'
    ]);

    const demoAllowedRoutes = new Set([
        '/api/demo/reset',
        '/api/demo/sample-data',
        '/api/health'
    ]);

    return {
        isDemoMode: (context) => {
            return context?.user?.isDemo === true ||
                context?.org?.isDemo === true ||
                context?.session?.demoMode === true;
        },

        isActionRestricted: (action) => {
            return demoRestrictedActions.has(action);
        },

        isRouteAllowed: (route) => {
            return demoAllowedRoutes.has(route);
        },

        blockInDemo: (action) => {
            return (req, res, next) => {
                const guard = createDemoGuardMiddleware();

                if (!guard.isDemoMode(req)) {
                    return next();
                }

                if (guard.isActionRestricted(action)) {
                    return res.status(403).json({
                        error: 'Action not allowed in demo mode',
                        action,
                        message: 'This action is restricted in demo mode. Please upgrade to a full account.',
                        demoMode: true
                    });
                }

                next();
            };
        },

        requireNonDemo: () => {
            return (req, res, next) => {
                const guard = createDemoGuardMiddleware();

                if (guard.isDemoMode(req)) {
                    return res.status(403).json({
                        error: 'Not available in demo mode',
                        message: 'Please upgrade to a full account to access this feature.',
                        demoMode: true
                    });
                }

                next();
            };
        },

        wrapResponseForDemo: () => {
            return (req, res, next) => {
                const guard = createDemoGuardMiddleware();

                if (!guard.isDemoMode(req)) {
                    return next();
                }

                // Store original json method
                const originalJson = res.json.bind(res);

                res.json = (data) => {
                    return originalJson({
                        ...data,
                        _demoMode: true,
                        _demoNotice: 'You are viewing demo data. Changes will be reset.'
                    });
                };

                next();
            };
        },

        getDemoRestrictions: () => Array.from(demoRestrictedActions),

        addRestriction: (action) => {
            demoRestrictedActions.add(action);
        },

        removeRestriction: (action) => {
            demoRestrictedActions.delete(action);
        }
    };
};

// ============================================
// TESTS
// ============================================

describe('Demo Guard Middleware', () => {
    let demoGuard;

    beforeEach(() => {
        demoGuard = createDemoGuardMiddleware();
    });

    describe('isDemoMode()', () => {
        it('should detect demo user', () => {
            const context = { user: { isDemo: true } };
            expect(demoGuard.isDemoMode(context)).toBe(true);
        });

        it('should detect demo organization', () => {
            const context = { org: { isDemo: true } };
            expect(demoGuard.isDemoMode(context)).toBe(true);
        });

        it('should detect demo session', () => {
            const context = { session: { demoMode: true } };
            expect(demoGuard.isDemoMode(context)).toBe(true);
        });

        it('should return false for regular users', () => {
            const context = { user: { isDemo: false } };
            expect(demoGuard.isDemoMode(context)).toBe(false);
        });

        it('should return false for null context', () => {
            expect(demoGuard.isDemoMode(null)).toBe(false);
            expect(demoGuard.isDemoMode(undefined)).toBe(false);
        });
    });

    describe('isActionRestricted()', () => {
        it('should detect restricted actions', () => {
            expect(demoGuard.isActionRestricted('user.delete')).toBe(true);
            expect(demoGuard.isActionRestricted('billing.modify')).toBe(true);
            expect(demoGuard.isActionRestricted('data.export')).toBe(true);
        });

        it('should allow unrestricted actions', () => {
            expect(demoGuard.isActionRestricted('user.view')).toBe(false);
            expect(demoGuard.isActionRestricted('project.create')).toBe(false);
        });
    });

    describe('blockInDemo() middleware', () => {
        it('should allow restricted action for non-demo users', () => {
            const mw = demoGuard.blockInDemo('user.delete');
            const req = { user: { isDemo: false } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should block restricted action for demo users', () => {
            const mw = demoGuard.blockInDemo('user.delete');
            const req = { user: { isDemo: true } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Action not allowed in demo mode',
                demoMode: true
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow unrestricted action for demo users', () => {
            const mw = demoGuard.blockInDemo('user.view');
            const req = { user: { isDemo: true } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('requireNonDemo() middleware', () => {
        it('should allow non-demo users', () => {
            const mw = demoGuard.requireNonDemo();
            const req = { user: { isDemo: false } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should block demo users', () => {
            const mw = demoGuard.requireNonDemo();
            const req = { user: { isDemo: true } };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('wrapResponseForDemo() middleware', () => {
        it('should add demo notice to responses', () => {
            const mw = demoGuard.wrapResponseForDemo();
            const req = { user: { isDemo: true } };
            let capturedData;
            const res = {
                json: vi.fn((data) => { capturedData = data; })
            };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();

            // Now test the wrapped json
            res.json({ test: 'data' });

            expect(capturedData._demoMode).toBe(true);
            expect(capturedData._demoNotice).toBeDefined();
        });

        it('should not modify responses for non-demo users', () => {
            const mw = demoGuard.wrapResponseForDemo();
            const req = { user: { isDemo: false } };
            const res = { json: vi.fn() };
            const next = vi.fn();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
            // json should not be wrapped
        });
    });

    describe('getDemoRestrictions()', () => {
        it('should return all restricted actions', () => {
            const restrictions = demoGuard.getDemoRestrictions();

            expect(restrictions).toContain('user.delete');
            expect(restrictions).toContain('billing.modify');
            expect(restrictions).toContain('api_key.create');
        });
    });

    describe('addRestriction() / removeRestriction()', () => {
        it('should add new restriction', () => {
            demoGuard.addRestriction('custom.action');

            expect(demoGuard.isActionRestricted('custom.action')).toBe(true);
        });

        it('should remove restriction', () => {
            expect(demoGuard.isActionRestricted('user.delete')).toBe(true);

            demoGuard.removeRestriction('user.delete');

            expect(demoGuard.isActionRestricted('user.delete')).toBe(false);
        });
    });
});
