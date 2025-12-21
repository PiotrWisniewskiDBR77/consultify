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

    it('should return 401 if token expired', () => {
        req.headers['authorization'] = 'Bearer expired-token';
        // Mock jwt.verify to call callback with error asynchronously
        jwt.verify.mockImplementation((token, secret, cb) => {
            process.nextTick(() => {
                const error = new Error('Token expired');
                error.name = 'TokenExpiredError';
                cb(error, null);
            });
        });

        verifyToken(req, res, next);
        // Wait for async callback
        return new Promise(resolve => {
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(401);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Token expired' }));
                resolve();
            }, 10);
        });
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

    it('should call next() if token valid and no revocation check needed (no jti)', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        const decoded = { id: 1, role: 'USER' };
        jwt.verify.mockImplementation((token, secret, cb) => {
            process.nextTick(() => {
                cb(null, decoded);
            });
        });

        verifyToken(req, res, next);
        // Wait for async callback
        return new Promise(resolve => {
            setTimeout(() => {
                expect(next).toHaveBeenCalled();
                expect(req.userId).toBe(1);
                resolve();
            }, 10);
        });
    });

    it('should check revocation if jti is present', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        const decoded = { id: 1, role: 'USER', jti: 'uuid', iat: Math.floor(Date.now() / 1000) };
        
        let callCount = 0;
        jwt.verify.mockImplementation((token, secret, cb) => {
            process.nextTick(() => {
                cb(null, decoded);
            });
        });

        // Mock db.get to handle nested calls - first for jti check, second for revoke-all
        db.get.mockImplementation((query, params, cb) => {
            callCount++;
            const callback = typeof params === 'function' ? params : cb;
            // First call checks specific token revocation
            if (callCount === 1) {
                process.nextTick(() => {
                    callback(null, undefined); // Not revoked
                });
            }
            // Second call (nested) checks global revocation
            else if (callCount === 2) {
                process.nextTick(() => {
                    callback(null, undefined); // No global revoke
                });
            }
        });

        verifyToken(req, res, next);
        // Wait for async callbacks
        return new Promise(resolve => {
            setTimeout(() => {
                expect(db.get).toHaveBeenCalled();
                expect(next).toHaveBeenCalled();
                resolve();
            }, 20);
        });
    });

    it('should return 401 if token is revoked', () => {
        req.headers['authorization'] = 'Bearer valid-token';
        const decoded = { id: 1, role: 'USER', jti: 'uuid' };
        jwt.verify.mockImplementation((token, secret, cb) => {
            process.nextTick(() => {
                cb(null, decoded);
            });
        });

        db.get.mockImplementation((query, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            // Token is revoked - return row
            process.nextTick(() => {
                callback(null, { jti: 'uuid' });
            });
        });

        verifyToken(req, res, next);
        // Wait for async callbacks
        return new Promise(resolve => {
            setTimeout(() => {
                expect(res.status).toHaveBeenCalledWith(401);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Token has been revoked' }));
                resolve();
            }, 20);
        });
    });
});
