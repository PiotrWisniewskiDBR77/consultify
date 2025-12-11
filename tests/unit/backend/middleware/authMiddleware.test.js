import { describe, it, expect, vi, beforeEach } from 'vitest';
import verifyToken from '../../../../server/middleware/authMiddleware';
import jwt from 'jsonwebtoken';
import db from '../../../../server/database';

vi.mock('jsonwebtoken');
vi.mock('../../../../server/database', () => ({
    default: {
        get: vi.fn(),
    },
    get: vi.fn()
}));

// Mock config
vi.mock('../../../../server/config', () => ({
    default: { JWT_SECRET: 'test-secret' },
    JWT_SECRET: 'test-secret'
}));

describe('AuthMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
        vi.clearAllMocks();
    });

    it('should return 403 if no token provided', () => {
        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No token provided' }));
    });

    it.skip('should return 401 if token expired', () => {
        req.headers['authorization'] = 'Bearer expired-token';
        // Mock jwt.verify to call callback with error
        jwt.verify.mockImplementation((token, secret, cb) => {
            cb({ name: 'TokenExpiredError' }, null);
        });

        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Token expired' }));
    });

    it('should return 401 if token invalid', () => {
        req.headers['authorization'] = 'Bearer invalid-token';
        jwt.verify.mockImplementation((token, secret, cb) => {
            cb(new Error('Invalid'), null);
        });

        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }));
    });

    it.skip('should call next() if token valid and no revocation check needed (no jti)', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        const decoded = { id: 1, role: 'USER' };
        jwt.verify.mockImplementation((token, secret, cb) => {
            cb(null, decoded);
        });

        verifyToken(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.userId).toBe(1);
    });

    it.skip('should check revocation if jti is present', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        const decoded = { id: 1, role: 'USER', jti: 'uuid' };
        jwt.verify.mockImplementation((token, secret, cb) => {
            cb(null, decoded);
        });

        // Mock db.get to assume token NOT revoked
        db.get.mockImplementation((query, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            // First call checks specific token revocation
            if (query.includes('FROM revoked_tokens WHERE jti')) {
                callback(null, undefined); // Not revoked
            }
            // Second call (nested) checks global revocation
            else if (query.includes('revoke-all')) {
                callback(null, undefined); // No global revoke
            }
        });

        verifyToken(req, res, next);
        expect(db.get).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it.skip('should return 401 if token is revoked', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        const decoded = { id: 1, role: 'USER', jti: 'uuid' };
        jwt.verify.mockImplementation((token, secret, cb) => {
            cb(null, decoded);
        });

        db.get.mockImplementation((query, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            // Assume revoked
            callback(null, { jti: 'uuid' });
        });

        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Token has been revoked' }));
    });
});
