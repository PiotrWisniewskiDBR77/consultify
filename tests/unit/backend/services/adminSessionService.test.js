import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Define mocks
const mocks = vi.hoisted(() => {
    return {
        db: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        },
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        },
        uuid: vi.fn(() => 'mock-uuid-1234')
    };
});

// Mock modules
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mocks.db,
    default: mocks.db
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mocks.logger
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

let adminSessionService;

describe('AdminSessionService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/adminSessionService.js');
        adminSessionService = module.default || module;

        if (adminSessionService.setDependencies) {
            adminSessionService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getActiveSessions', () => {
        it('should return all active sessions for admin', async () => {
            const mockSessions = [{
                id: 's1',
                user_id: 'u1',
                mfa_verified: 1,
                is_active: 1,
                admin_email: 'test@admin.com'
            }];
            mocks.db.all.mockResolvedValueOnce(mockSessions);

            const result = await adminSessionService.getActiveSessions('u1');

            expect(mocks.db.all).toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('s1');
        });
    });

    describe('revokeSession', () => {
        it('should revoke a specific session', async () => {
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });

            const result = await adminSessionService.revokeSession('s1');

            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE admin_sessions SET is_active = 0'),
                ['s1']
            );
            expect(result).toBe(true);
        });
    });
});
