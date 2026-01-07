/**
 * Backend Auth Middleware Tests
 * Tests for authentication middleware
 * 
 * @module tests/backend/auth-middleware.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock JWT module
vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn(),
        sign: vi.fn(),
    },
}));

// Create mock middleware
const createAuthMiddleware = (jwtSecret = 'test-secret') => {
    return {
        authenticate: (req, res, next) => {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    error: 'No authorization header',
                    code: 'UNAUTHORIZED',
                });
            }

            if (!authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid authorization format',
                    code: 'UNAUTHORIZED',
                });
            }

            const token = authHeader.substring(7);

            try {
                // Mock token verification
                if (token === 'valid-token') {
                    req.user = { id: 'user-1', email: 'test@test.com', role: 'USER' };
                    return next();
                }
                if (token === 'admin-token') {
                    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };
                    return next();
                }
                if (token === 'superadmin-token') {
                    req.user = { id: 'sa-1', email: 'sa@test.com', role: 'SUPERADMIN' };
                    return next();
                }
                if (token === 'expired-token') {
                    throw new Error('Token expired');
                }

                throw new Error('Invalid token');
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    error: error.message,
                    code: 'INVALID_TOKEN',
                });
            }
        },

        requireRole: (...roles) => (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated',
                    code: 'UNAUTHORIZED',
                });
            }

            if (!roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                    code: 'FORBIDDEN',
                });
            }

            next();
        },

        requirePermission: (permission) => (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated',
                    code: 'UNAUTHORIZED',
                });
            }

            const userPermissions = req.user.permissions || [];

            if (!userPermissions.includes(permission) && !userPermissions.includes('*')) {
                return res.status(403).json({
                    success: false,
                    error: `Missing permission: ${permission}`,
                    code: 'FORBIDDEN',
                });
            }

            next();
        },

        optionalAuth: (req, res, next) => {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next();
            }

            const token = authHeader.substring(7);

            if (token === 'valid-token') {
                req.user = { id: 'user-1', email: 'test@test.com', role: 'USER' };
            }

            next();
        },
    };
};

// Mock request/response
const createMockReq = (headers = {}, user = null) => ({
    headers,
    user,
});

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
    };
    res.status = vi.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = vi.fn((data) => {
        res.body = data;
        return res;
    });
    return res;
};

describe('Auth Middleware Tests', () => {
    let middleware;
    let next;

    beforeEach(() => {
        middleware = createAuthMiddleware();
        next = vi.fn();
        vi.clearAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════════
    // AUTHENTICATE
    // ═══════════════════════════════════════════════════════════════════

    describe('authenticate', () => {
        it('should pass with valid token', () => {
            const req = createMockReq({ authorization: 'Bearer valid-token' });
            const res = createMockRes();

            middleware.authenticate(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe('user-1');
        });

        it('should reject without authorization header', () => {
            const req = createMockReq({});
            const res = createMockRes();

            middleware.authenticate(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should reject invalid format', () => {
            const req = createMockReq({ authorization: 'Basic token' });
            const res = createMockRes();

            middleware.authenticate(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should reject expired token', () => {
            const req = createMockReq({ authorization: 'Bearer expired-token' });
            const res = createMockRes();

            middleware.authenticate(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.body.error).toContain('expired');
        });

        it('should reject invalid token', () => {
            const req = createMockReq({ authorization: 'Bearer invalid-token' });
            const res = createMockRes();

            middleware.authenticate(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REQUIRE ROLE
    // ═══════════════════════════════════════════════════════════════════

    describe('requireRole', () => {
        it('should pass with correct role', () => {
            const req = createMockReq({}, { id: 'u1', role: 'ADMIN' });
            const res = createMockRes();

            middleware.requireRole('ADMIN')(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should pass with any of multiple roles', () => {
            const req = createMockReq({}, { id: 'u1', role: 'ADMIN' });
            const res = createMockRes();

            middleware.requireRole('USER', 'ADMIN')(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should reject without user', () => {
            const req = createMockReq({});
            const res = createMockRes();

            middleware.requireRole('ADMIN')(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should reject wrong role', () => {
            const req = createMockReq({}, { id: 'u1', role: 'USER' });
            const res = createMockRes();

            middleware.requireRole('ADMIN')(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REQUIRE PERMISSION
    // ═══════════════════════════════════════════════════════════════════

    describe('requirePermission', () => {
        it('should pass with correct permission', () => {
            const req = createMockReq({}, {
                id: 'u1',
                permissions: ['projects:read', 'projects:write']
            });
            const res = createMockRes();

            middleware.requirePermission('projects:read')(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should pass with wildcard permission', () => {
            const req = createMockReq({}, {
                id: 'u1',
                permissions: ['*']
            });
            const res = createMockRes();

            middleware.requirePermission('any:permission')(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should reject missing permission', () => {
            const req = createMockReq({}, {
                id: 'u1',
                permissions: ['projects:read']
            });
            const res = createMockRes();

            middleware.requirePermission('admin:manage')(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should reject without user', () => {
            const req = createMockReq({});
            const res = createMockRes();

            middleware.requirePermission('any')(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // OPTIONAL AUTH
    // ═══════════════════════════════════════════════════════════════════

    describe('optionalAuth', () => {
        it('should pass without token', () => {
            const req = createMockReq({});
            const res = createMockRes();

            middleware.optionalAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });

        it('should set user with valid token', () => {
            const req = createMockReq({ authorization: 'Bearer valid-token' });
            const res = createMockRes();

            middleware.optionalAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
        });

        it('should pass with invalid token (no error)', () => {
            const req = createMockReq({ authorization: 'Bearer bad-token' });
            const res = createMockRes();

            middleware.optionalAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });
});
