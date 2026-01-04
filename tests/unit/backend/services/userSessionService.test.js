/**
 * User Session Service Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDatabase } from '../../../../server/src/database/index.js';
import UserSessionService from '../../../../server/services/userSessionService.js';

describe('UserSessionService', () => {
    let db;

    beforeEach(() => {
        vi.clearAllMocks();
        db = getDatabase();
        db.run.mockClear();
        db.get.mockClear();
        db.all.mockClear();
    });

    describe('createSession', () => {
        it('should create a session', async () => {
            db.run.mockImplementation(function (sql, params, cb) {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await UserSessionService.createSession(
                'user-1', 'org-1', 'token', '127.0.0.1', 'agent', {}, '2025-01-01'
            );

            expect(result.id).toBeDefined();
            expect(result.isActive).toBe(true);
            expect(db.run).toHaveBeenCalledTimes(1);
        });
    });

    describe('getActiveSessions', () => {
        it('should return active sessions', async () => {
            const sessions = [{ id: 's1', user_id: 'user-1' }];
            db.all.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback(null, sessions);
                }
            });

            const result = await UserSessionService.getActiveSessions('user-1');
            expect(result).toEqual(sessions);
        });
    });

    describe('revokeAllSessions', () => {
        it('should revoke all sessions', async () => {
            db.run.mockImplementation(function (sql, params, cb) {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback.call({ changes: 2 }, null);
                }
            });

            const result = await UserSessionService.revokeAllSessions('user-1');
            expect(result.revoked).toBe(true);
        });
    });
});
