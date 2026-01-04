/**
 * Admin Session Service Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDatabase } from '../../../../server/src/database/index.js';

// Mock logger to avoid noise
vi.mock('../../../../server/src/utils/Logger.ts', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

import AdminSessionService from '../../../../server/services/adminSessionService.js';

describe('AdminSessionService', () => {
    let db;

    beforeEach(() => {
        vi.clearAllMocks();
        db = getDatabase();

        // AdminSessionService expects Promise-based DB API (unlike legacy callback based)
        // We override the global mock implementation here
        db.all.mockImplementation((sql, params) => Promise.resolve([]));
        db.get.mockImplementation((sql, params) => Promise.resolve(null));
        db.run.mockImplementation((sql, params) => Promise.resolve({ changes: 0, lastID: 0 }));
    });

    describe('getActiveSessions', () => {
        it('should return all active sessions for admin', async () => {
            db.all.mockResolvedValue([{
                id: 's1',
                user_id: 'u1',
                mfa_verified: 1,
                is_active: 1,
                admin_email: 'test@admin.com'
            }]);

            const result = await AdminSessionService.getActiveSessions('org-1');
            expect(result).toHaveLength(1);
        });
    });

    describe('revokeSession', () => {
        it('should revoke a specific session', async () => {
            db.run.mockResolvedValue({ changes: 1 });

            const result = await AdminSessionService.revokeSession('s1', 'admin-1', 'reason');
            expect(result).toBe(true);
        });
    });
});
