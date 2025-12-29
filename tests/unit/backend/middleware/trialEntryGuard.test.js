import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trialEntryGuard, isTrialEntryUser, _setDb } from '../../../../server/middleware/trialEntryGuard';

describe('Trial Entry Guard Middleware', () => {
    let req;
    let res;
    let next;
    let mockDb;

    beforeEach(() => {
        req = {
            user: { id: 'u1' },
            method: 'POST',
            path: '/api/initiatives'
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
        mockDb = {
            get: vi.fn()
        };
        _setDb(mockDb);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isTrialEntryUser', () => {
        it('should return true if status is TRIAL_ENTRY', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { user_status: 'TRIAL_ENTRY' }));
            const result = await isTrialEntryUser('u1');
            expect(result).toBe(true);
        });

        it('should return false if status is other check', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { user_status: 'ACTIVE' }));
            const result = await isTrialEntryUser('u1');
            expect(result).toBe(false);
        });
    });

    describe('trialEntryGuard', () => {
        it('should skip if no user', async () => {
            req.user = undefined;
            await trialEntryGuard(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should skip if not trial entry user', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { user_status: 'ACTIVE' }));
            await trialEntryGuard(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block blocked route for trial entry user', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { user_status: 'TRIAL_ENTRY' }));

            await trialEntryGuard(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TRIAL_ENTRY_RESTRICTION' }));
            expect(req.isTrialEntry).toBe(true);
        });

        it('should allow non-blocked route for trial entry user', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { user_status: 'TRIAL_ENTRY' }));
            req.path = '/api/allowed/path';

            await trialEntryGuard(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });
});
