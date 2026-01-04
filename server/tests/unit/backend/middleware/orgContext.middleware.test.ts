/**
 * Organization Context Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import orgContextMiddleware, {
    type AuthRequest,
    resolveUserOrgAccess,
    setDependencies,
} from '../../../../src/middleware/orgContext.middleware.js';

describe('Organization Context Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockDb: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
        all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockDb = {
            get: vi.fn((_sql, _params, callback) => {
                callback(null, { id: 'membership-123', role: 'ADMIN', status: 'active' });
            }),
            all: vi.fn((_sql, _params, callback) => {
                callback(null, []);
            }),
        };

        setDependencies({ db: mockDb });

        mockReq = {
            user: {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
                organizationId: 'org-123',
            },
            method: 'GET',
            params: {},
            headers: {},
        };
    });

    describe('orgContextMiddleware', () => {
        it('should return 401 when user not authenticated and required', async () => {
            mockReq.user = undefined;
            const middleware = orgContextMiddleware({ required: true });
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should use orgId from URL params', async () => {
            mockReq.params = { orgId: 'org-456' };
            const middleware = orgContextMiddleware();
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.org?.id).toBe('org-456');
            expect(mockReq.org?.source).toBe('url_param');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should use orgId from header when allowed', async () => {
            mockReq.headers = { 'x-org-id': 'org-789' };
            const middleware = orgContextMiddleware({ allowHeader: true });
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.org?.id).toBe('org-789');
            expect(mockReq.org?.source).toBe('header');
        });

        it('should use user default org for reads', async () => {
            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.org?.id).toBe('org-123');
            expect(mockReq.org?.source).toBe('user_default');
        });

        it('should require explicit orgId for write operations', async () => {
            mockReq.method = 'POST';
            mockReq.user!.organizationId = undefined;
            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should deny access when user has no access to org', async () => {
            mockReq.params = { orgId: 'other-org' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, null); // No membership found
            });
            const middleware = orgContextMiddleware();
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('resolveUserOrgAccess', () => {
        it('should return access info for member', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, { id: 'membership-123', role: 'ADMIN', status: 'active' });
                } else {
                    callback(null, null);
                }
            });
            const result = await resolveUserOrgAccess('user-123', 'org-123');

            expect(result.allowed).toBe(true);
            expect(result.isMember).toBe(true);
            expect(result.role).toBe('ADMIN');
        });

        it('should return access info for consultant', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('consultant_org_links')) {
                    callback(null, { id: 'link-123', status: 'active' });
                } else {
                    callback(null, null);
                }
            });
            const result = await resolveUserOrgAccess('user-123', 'org-123');

            expect(result.allowed).toBe(true);
            expect(result.isConsultant).toBe(true);
        });

        it('should return no access when neither member nor consultant', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, null);
            });
            const result = await resolveUserOrgAccess('user-123', 'org-123');

            expect(result.allowed).toBe(false);
        });
    });
});

