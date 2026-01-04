import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MyWorkService from '../../../server/src/services/myWorkService.js';

describe('MyWorkService', () => {
    let queryAllSpy;
    let queryOneSpy;
    let cacheSpy;

    beforeEach(() => {
        vi.clearAllMocks();

        // Spy on service methods
        queryAllSpy = vi.spyOn(MyWorkService, 'queryAll');
        queryOneSpy = vi.spyOn(MyWorkService, 'queryOne');

        // Spy on cache to bypass it
        // Note: BaseService uses cacheHelper, but MyWorkService.getMyWork uses this.cache.getCached
        // We need to ensure we bypass cache to test logic
        // If we can't easily spy on cache property (since it might be assigned), we can rely on BaseService.cache
        // Alternatively, since BaseService assigns properties, we can modify MyWorkService.cache

        MyWorkService.cache = {
            getCached: vi.fn(async (key, fn) => fn()), // Bypass cache
            CacheKeys: {
                userDashboard: (uid, oid) => `dashboard:${uid}:${oid}`
            },
            DEFAULT_TTL: { SHORT: 60 }
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getMyWork', () => {
        it('should aggregate work', async () => {
            // Mock empty results
            queryAllSpy.mockResolvedValue([]);
            queryOneSpy.mockResolvedValue(null);

            const result = await MyWorkService.getMyWork('user1');

            expect(result).toBeDefined();
            expect(result.myTasks.total).toBe(0);
            expect(result.myAlerts.total).toBe(0);
            expect(result.myInitiatives).toBeNull(); // Because hasInitiatives check (queryOne) returns null -> false
            expect(result.myDecisions).toBeNull();
        });
    });

    describe('errors', () => {
        it('should propagate db error', async () => {
            // Make _getMyTasks query fail
            queryAllSpy.mockImplementation((sql) => {
                if (sql.includes('FROM tasks')) {
                    return Promise.reject(new Error('Fail'));
                }
                return Promise.resolve([]);
            });
            queryOneSpy.mockResolvedValue(null);

            await expect(MyWorkService.getMyWork('user1')).rejects.toThrow('Fail');
        });
    });
});
