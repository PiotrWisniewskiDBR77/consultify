import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import demoGuard from '../../../../server/middleware/demoGuard';

describe('Demo Guard Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            user: { isDemo: true, organizationId: 'org1', userId: 'user1' },
            method: 'POST',
            originalUrl: '/api/initiatives',
            query: {},
            body: {},
            params: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should skip if user is not demo', () => {
        req.user.isDemo = false;
        demoGuard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should block cross-tenant access in query', () => {
        req.query.organizationId = 'org2';
        demoGuard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DEMO_BLOCKED' }));
    });

    it('should allow safe methods', () => {
        req.method = 'GET';
        demoGuard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should allow whitelisted paths', () => {
        req.originalUrl = '/api/ai/chat';
        demoGuard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should block unsafe methods on non-whitelisted paths', () => {
        req.method = 'DELETE';
        req.originalUrl = '/api/users/123';

        demoGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE_USERS' }));
        expect(next).not.toHaveBeenCalled();
    });
});
