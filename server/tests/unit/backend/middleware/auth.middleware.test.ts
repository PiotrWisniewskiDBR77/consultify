/**
 * Auth Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { 
    verifyToken, 
    optionalAuth, 
    requireRole, 
    requireSuperAdmin, 
    requireOrganization, 
    requirePermission,
    setDependencies,
    type AuthRequest 
} from '../../../src/middleware/auth.middleware.js';
import jwt from 'jsonwebtoken';

describe('Auth Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockJwt: typeof jwt;
    let mockDb: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    };
    let mockPermissionService: {
        can: (user: unknown, capability: string, context?: unknown) => boolean;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        mockJwt = {
            verify: vi.fn(),
        } as unknown as typeof jwt;

        mockDb = {
            get: vi.fn((_sql, _params, callback) => callback(null, null)),
        };

        mockPermissionService = {
            can: vi.fn().mockReturnValue(true),
        };

        setDependencies({
            jwt: mockJwt,
            config: { JWT_SECRET: 'test-secret' },
            db: mockDb,
            PermissionService: mockPermissionService,
        });

        mockReq = {
            headers: {},
            body: {},
            query: {},
        };
    });

    describe('verifyToken', () => {
        it('should return 403 when no token provided', () => {
            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should extract token from Authorization header with Bearer prefix', () => {
            mockReq.headers = { authorization: 'Bearer test-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'user' });
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should extract token from Authorization header without Bearer prefix', () => {
            mockReq.headers = { authorization: 'test-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'user' });
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
        });

        it('should extract token from body', () => {
            mockReq.body = { token: 'body-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'user' });
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
        });

        it('should extract token from query', () => {
            mockReq.query = { token: 'query-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'user' });
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
        });

        it('should return 401 when token is expired', () => {
            mockReq.headers = { authorization: 'Bearer expired-token' };
            const expiredError = new Error('Token expired');
            expiredError.name = 'TokenExpiredError';
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(expiredError, null);
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when token is invalid', () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(new Error('Invalid token'), null);
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should attach user to request when token is valid', () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            const decoded = { 
                id: 'user-123', 
                email: 'test@example.com',
                role: 'admin',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, decoded);
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.user).toBeDefined();
            expect(mockReq.user?.id).toBe('user-123');
            expect(mockReq.userId).toBe('user-123');
            expect(mockReq.organizationId).toBe('org-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should check token revocation when jti is present', () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            const decoded = { 
                id: 'user-123', 
                jti: 'token-jti-123',
                iat: Math.floor(Date.now() / 1000),
            };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, decoded);
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockDb.get).toHaveBeenCalled();
        });

        it('should reject revoked token', () => {
            mockReq.headers = { authorization: 'Bearer revoked-token' };
            const decoded = { 
                id: 'user-123', 
                jti: 'revoked-jti',
            };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, decoded);
            });
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { jti: 'revoked-jti' });
            });

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
        });

        it('should bypass auth in test mode when enabled', () => {
            const originalEnv = process.env.NODE_ENV;
            const originalBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
            process.env.NODE_ENV = 'test';
            process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

            verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.user).toBeDefined();
            expect(mockReq.user?.id).toBe('test-user-id');
            expect(mockNext).toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
            if (originalBypass) {
                process.env.ENABLE_TEST_AUTH_BYPASS = originalBypass;
            } else {
                delete process.env.ENABLE_TEST_AUTH_BYPASS;
            }
        });
    });

    describe('optionalAuth', () => {
        it('should continue without user when no token', () => {
            optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeUndefined();
        });

        it('should attach user when valid token provided', () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'user' });
            });

            optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.user).toBeDefined();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should continue without user when token is invalid', () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(new Error('Invalid'), null);
            });

            optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireRole', () => {
        it('should return 401 when user not authenticated', () => {
            const middleware = requireRole('admin');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('should return 403 when user role not in required roles', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            const middleware = requireRole('admin', 'manager');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
        });

        it('should allow access when user role matches', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'admin',
                isSuperAdmin: false,
            };
            const middleware = requireRole('admin', 'manager');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireSuperAdmin', () => {
        it('should return 401 when user not authenticated', () => {
            requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 when user is not super admin', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'admin',
                isSuperAdmin: false,
            };
            requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
        });

        it('should allow access when user is super admin', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'admin',
                isSuperAdmin: true,
            };
            requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireOrganization', () => {
        it('should return 403 when organizationId not present', () => {
            requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization context required' });
        });

        it('should allow access when organizationId is present', () => {
            mockReq.organizationId = 'org-123';
            requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requirePermission', () => {
        it('should return 401 when user not authenticated', () => {
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 when user lacks permission', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            mockReq.can = vi.fn().mockReturnValue(false);
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should allow access when user has permission', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            mockReq.can = vi.fn().mockReturnValue(true);
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});

