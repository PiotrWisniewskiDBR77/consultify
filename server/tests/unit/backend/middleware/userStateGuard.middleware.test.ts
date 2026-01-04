/**
 * User State Guard Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    attachUserState,
    type AuthRequest,
    requirePermission,
    requirePhase,
    requireState,
    setDependencies,
} from '../../../../src/middleware/userStateGuard.middleware.js';

describe('User State Guard Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockUserStateMachine: {
        USER_STATES: Record<string, string>;
        PHASES: Record<string, string>;
        getPermissions: (state: string) => Record<string, unknown>;
        hasPermission: (state: string, permission: string) => boolean;
        getPhase: (state: string) => string;
    };
    let mockDb: {
        getAsync: (sql: string, params: unknown[]) => Promise<unknown>;
    } | null;

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockUserStateMachine = {
            USER_STATES: {
                ANON: 'ANON',
                ORG_MEMBER: 'ORG_MEMBER',
                TEAM_COLLAB: 'TEAM_COLLAB',
            },
            PHASES: {
                A: 'A',
                B: 'B',
                G: 'G',
            },
            getPermissions: vi.fn().mockReturnValue({}),
            hasPermission: vi.fn().mockReturnValue(true),
            getPhase: vi.fn().mockReturnValue('G'),
        };
        mockDb = {
            getAsync: vi.fn().mockResolvedValue({
                user_journey_state: 'ORG_MEMBER',
                current_phase: 'G',
            }),
        };

        setDependencies({
            UserStateMachine: mockUserStateMachine,
            db: mockDb,
        });

        mockReq = {
            user: {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            },
        };
    });

    describe('attachUserState', () => {
        it('should attach user state from database', async () => {
            await attachUserState(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.userState).toBe('ORG_MEMBER');
            expect(mockReq.currentPhase).toBe('G');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set ANON state when user is undefined', async () => {
            mockReq.user = undefined;
            await attachUserState(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.userState).toBe('ANON');
            expect(mockReq.currentPhase).toBe('A');
        });

        it('should handle database errors gracefully', async () => {
            mockDb = null;
            setDependencies({
                UserStateMachine: mockUserStateMachine,
                db: null,
            });
            await attachUserState(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.userState).toBe('ANON');
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireState', () => {
        it('should allow when state matches', () => {
            mockReq.userState = 'ORG_MEMBER';
            const middleware = requireState('ORG_MEMBER');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when state is in allowed list', () => {
            mockReq.userState = 'ORG_MEMBER';
            const middleware = requireState(['ORG_MEMBER', 'TEAM_COLLAB']);
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when state does not match', () => {
            mockReq.userState = 'ANON';
            const middleware = requireState('ORG_MEMBER');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'INVALID_USER_STATE',
                }),
            );
        });

        it('should return 401 when state is undefined', () => {
            mockReq.userState = undefined;
            const middleware = requireState('ORG_MEMBER');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    describe('requirePhase', () => {
        it('should allow when phase matches', () => {
            mockReq.currentPhase = 'G';
            const middleware = requirePhase('G');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when phase does not match', () => {
            mockReq.currentPhase = 'A';
            const middleware = requirePhase('G');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requirePermission', () => {
        it('should allow when permission granted', () => {
            mockReq.userState = 'ORG_MEMBER';
            mockUserStateMachine.hasPermission = vi.fn().mockReturnValue(true);
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when permission not granted', () => {
            mockReq.userState = 'ORG_MEMBER';
            mockUserStateMachine.hasPermission = vi.fn().mockReturnValue(false);
            const middleware = requirePermission('write:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });
});
