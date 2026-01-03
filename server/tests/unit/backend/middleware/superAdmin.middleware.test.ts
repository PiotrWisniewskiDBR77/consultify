/**
 * Super Admin Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { verifySuperAdmin, setDependencies, type AuthRequest } from '../../../src/middleware/superAdmin.middleware.js';
import jwt from 'jsonwebtoken';

describe('Super Admin Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockJwt: typeof jwt;
    let mockDb: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
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

        setDependencies({
            jwt: mockJwt,
            config: { JWT_SECRET: 'test-secret' },
            db: mockDb,
        });

        mockReq = {
            headers: {},
        };
    });

    describe('verifySuperAdmin', () => {
        it('should return 403 when no token provided', () => {
            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
        });

        it('should allow SUPERADMIN role from token', () => {
            mockReq.headers = { authorization: 'Bearer superadmin-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'SUPERADMIN', organizationId: 'org-123' });
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user?.isSuperAdmin).toBe(true);
        });

        it('should allow SUPER_ADMIN role from token', () => {
            mockReq.headers = { authorization: 'Bearer superadmin-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'SUPER_ADMIN', organizationId: 'org-123' });
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should check database when token role is not SUPERADMIN', () => {
            mockReq.headers = { authorization: 'Bearer user-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'ADMIN', organizationId: 'org-123' });
            });
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { role: 'SUPERADMIN' });
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockDb.get).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject non-superadmin role from database', () => {
            mockReq.headers = { authorization: 'Bearer user-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'ADMIN', organizationId: 'org-123' });
            });
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { role: 'ADMIN' });
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Requires Super Admin privileges' });
        });

        it('should return 401 when token is invalid', () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(new Error('Invalid token'), null);
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should handle database errors gracefully', () => {
            mockReq.headers = { authorization: 'Bearer user-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'ADMIN', organizationId: 'org-123' });
            });
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(new Error('DB error'), null);
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            // Should continue with token role if DB check fails
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should extract token from Bearer header', () => {
            mockReq.headers = { authorization: 'Bearer token123' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                expect(_token).toBe('token123');
                callback(null, { id: 'user-123', role: 'SUPERADMIN' });
            });

            verifySuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});

