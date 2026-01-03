/**
 * Trial Entry Guard Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { trialEntryGuard, requireOrgContext, isTrialEntryUser, setDependencies, BLOCKED_ROUTES, type AuthRequest } from '../../../../src/middleware/trialEntryGuard.middleware.js';

describe('Trial Entry Guard Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockDb: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockDb = {
            get: vi.fn((_sql, _params, callback) => callback(null, { user_status: 'ORG_MEMBER' })),
        };

        setDependencies({ db: mockDb });

        mockReq = {
            user: {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            },
            method: 'GET',
            path: '/api/test',
        };
    });

    describe('trialEntryGuard', () => {
        it('should allow non-trial-entry users', async () => {
            await trialEntryGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when user is undefined', async () => {
            mockReq.user = undefined;
            await trialEntryGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block blocked routes for trial entry users', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { user_status: 'TRIAL_ENTRY' });
            });
            mockReq.method = 'POST';
            mockReq.path = '/api/initiatives';
            await trialEntryGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'TRIAL_ENTRY_RESTRICTION',
                })
            );
        });

        it('should allow non-blocked routes for trial entry users', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { user_status: 'TRIAL_ENTRY' });
            });
            mockReq.method = 'GET';
            mockReq.path = '/api/ai/chat';
            await trialEntryGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(new Error('DB error'), null);
            });
            await trialEntryGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireOrgContext', () => {
        it('should block trial entry users', async () => {
            mockReq.isTrialEntry = true;
            await requireOrgContext(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should block when no organization', async () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            await requireOrgContext(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should allow when organization exists', async () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
                organizationId: 'org-123',
            };
            await requireOrgContext(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('isTrialEntryUser', () => {
        it('should return true for trial entry users', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { user_status: 'TRIAL_ENTRY' });
            });
            const result = await isTrialEntryUser('user-123');
            expect(result).toBe(true);
        });

        it('should return false for non-trial-entry users', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { user_status: 'ORG_MEMBER' });
            });
            const result = await isTrialEntryUser('user-123');
            expect(result).toBe(false);
        });
    });

    describe('BLOCKED_ROUTES', () => {
        it('should have blocked routes defined', () => {
            expect(BLOCKED_ROUTES.length).toBeGreaterThan(0);
        });

        it('should block initiative creation', () => {
            const route = BLOCKED_ROUTES.find(r => r.path.test('/api/initiatives'));
            expect(route).toBeDefined();
            expect(route?.method).toBe('POST');
        });
    });
});




