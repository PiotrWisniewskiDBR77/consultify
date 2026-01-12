import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireFeature, requireAccess, isFeatureAccessible, FEATURE_REQUIREMENTS } from '../../../../server/middleware/featureGate';

describe('Feature Gate Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            currentPhase: 'G',
            userState: 'ECOSYSTEM_NODE',
            userRole: 'ADMIN',
            user: { role: 'ADMIN' }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('requireFeature', () => {
        it('should allow access when all requirements are met', () => {
            // benchmark_access requires G, ECOSYSTEM_NODE, ADMIN/CONSULTANT
            const middleware = requireFeature('benchmark_access');
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block if phase is insufficient', () => {
            req.currentPhase = 'A';
            const middleware = requireFeature('benchmark_access');
            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FEATURE_ACCESS_DENIED' }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 500 for unknown feature', () => {
            const middleware = requireFeature('non_existent_feature');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('requireAccess', () => {
        it('should validate custom requirements', () => {
            const requirements = { phase: ['A'], state: [], role: [] };
            req.currentPhase = 'A';

            requireAccess(requirements)(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should fail custom requirements', () => {
            const requirements = { phase: ['Z'], state: [], role: [] };
            req.currentPhase = 'A';

            requireAccess(requirements)(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('isFeatureAccessible', () => {
        it('should return true for accessible feature', () => {
            const context = { phase: 'G', state: 'ECOSYSTEM_NODE', role: 'ADMIN' };
            expect(isFeatureAccessible('benchmark_access', context)).toBe(true);
        });

        it('should return false for inaccessible feature', () => {
            const context = { phase: 'A', state: 'ECOSYSTEM_NODE', role: 'ADMIN' };
            expect(isFeatureAccessible('benchmark_access', context)).toBe(false);
        });
    });
});
