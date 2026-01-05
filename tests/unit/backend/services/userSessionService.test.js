/**
 * User Session Service Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userSessionService from '../../../../server/src/services/userSessionService.js';

// Mock sessionCache
const mockSessionCache = {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../../../../server/src/services/redis/CacheService.js', () => ({
    sessionCache: mockSessionCache
}));

describe('UserSessionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createSession', () => {
        it('should create a session', async () => {
            await userSessionService.createSession('user-1', 'token-123', { ip: '127.0.0.1' });

            expect(mockSessionCache.set).toHaveBeenCalledWith(
                'user-1',
                expect.objectContaining({
                    userId: 'user-1',
                    token: 'token-123',
                    metadata: { ip: '127.0.0.1' }
                }),
                expect.any(Number)
            );
        });
    });

    describe('getSession', () => {
        it('should return session when it exists', async () => {
            const mockSession = {
                userId: 'user-1',
                token: 'token-123',
                expiresAt: Date.now() + 86400000,
                metadata: {}
            };
            mockSessionCache.get.mockResolvedValueOnce(mockSession);

            const result = await userSessionService.getSession('user-1');
            expect(result).toEqual(mockSession);
            expect(mockSessionCache.get).toHaveBeenCalledWith('user-1');
        });

        it('should return null when session does not exist', async () => {
            mockSessionCache.get.mockResolvedValueOnce(null);

            const result = await userSessionService.getSession('user-1');
            expect(result).toBeNull();
        });
    });

    describe('isValidSession', () => {
        it('should return true for valid session', async () => {
            const mockSession = {
                userId: 'user-1',
                token: 'token-123',
                expiresAt: Date.now() + 86400000
            };
            mockSessionCache.get.mockResolvedValueOnce(mockSession);

            const result = await userSessionService.isValidSession('user-1', 'token-123');
            expect(result).toBe(true);
        });

        it('should return false for invalid token', async () => {
            const mockSession = {
                userId: 'user-1',
                token: 'token-123',
                expiresAt: Date.now() + 86400000
            };
            mockSessionCache.get.mockResolvedValueOnce(mockSession);

            const result = await userSessionService.isValidSession('user-1', 'wrong-token');
            expect(result).toBe(false);
        });
    });

    describe('invalidateSession', () => {
        it('should invalidate a session', async () => {
            await userSessionService.invalidateSession('user-1');

            expect(mockSessionCache.del).toHaveBeenCalledWith('user-1');
        });
    });
});
