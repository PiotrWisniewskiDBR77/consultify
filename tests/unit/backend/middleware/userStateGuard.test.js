import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userStateGuard from '../../../../server/middleware/userStateGuard';
import db from '../../../../server/db/sqliteAsync';

const { attachUserState, requireState, _setDb } = userStateGuard;

// Mock DB with proper hoisting handling
vi.mock('../../../../server/db/sqliteAsync', () => {
    const api = {
        getAsync: vi.fn(),
        runAsync: vi.fn()
    };
    return {
        default: api,
        ...api
    };
});

// Mock UserStateMachine
vi.mock('../../../../server/services/userStateMachine', () => ({
    default: {
        USER_STATES: { ANON: 'ANON', ORG_MEMBER: 'ORG_MEMBER' },
        PHASES: { A: 'A' },
        getPermissions: vi.fn().mockReturnValue(['perm1'])
    }
}));

import UserStateMachine from '../../../../server/services/userStateMachine';

describe('User State Guard Middleware', () => {
    let req;
    let res;
    let next;
    let mockDb;

    beforeEach(() => {
        req = { user: { id: 'u1' } };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
        mockDb = {
            getAsync: vi.fn(),
            runAsync: vi.fn()
        };
        _setDb(mockDb);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('attachUserState', () => {
        it('should attach default state if user not found', async () => {
            mockDb.getAsync.mockResolvedValue(null);
            await attachUserState(req, res, next);

            expect(req.userState).toBe('ANON');
            expect(next).toHaveBeenCalled();
        });

        it('should attach state from db', async () => {
            mockDb.getAsync.mockResolvedValue({ user_journey_state: 'ORG_MEMBER', current_phase: 'D' });
            await attachUserState(req, res, next);

            expect(req.userState).toBe('ORG_MEMBER');
            expect(req.currentPhase).toBe('D');
            expect(next).toHaveBeenCalled();
        });
    });

    describe('requireState', () => {
        it('should allow if state matches', () => {
            req.userState = 'ORG_MEMBER';
            const middleware = requireState('ORG_MEMBER');
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block if state does not match', () => {
            req.userState = 'ANON';
            const middleware = requireState('ORG_MEMBER');
            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
