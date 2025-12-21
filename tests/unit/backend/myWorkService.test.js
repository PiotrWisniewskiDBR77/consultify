
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis before importing anything - CommonJS module
const mockRedis = vi.hoisted(() => ({
    get: vi.fn(() => Promise.resolve(null)),
    setEx: vi.fn(() => Promise.resolve('OK')),
    on: vi.fn(),
    connect: vi.fn(() => Promise.resolve()),
    isOpen: true
}));

// Mock redis before importing anything
vi.doMock('../../../server/utils/redisClient', () => mockRedis);

// Mock queryHelpers
const mockQueryHelpers = vi.hoisted(() => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    buildInPlaceholders: vi.fn((arr) => arr.map(() => '?').join(', '))
}));

vi.doMock('../../../server/utils/queryHelpers', () => mockQueryHelpers);

// Mock cacheHelper - bypass cache for tests
const mockCacheHelper = vi.hoisted(() => ({
    getCached: vi.fn(async (key, fn) => {
        // Bypass cache and directly execute the function
        return await fn();
    }),
    CacheKeys: {
        userDashboard: (userId, orgId) => `dashboard:user:${userId}:org:${orgId || 'null'}`
    },
    DEFAULT_TTL: {
        SHORT: 60
    }
}));

vi.doMock('../../../server/utils/cacheHelper', () => mockCacheHelper);

describe('MyWorkService', () => {
    let MyWorkService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        // Reset query helpers mocks
        mockQueryHelpers.queryAll.mockReset();
        mockQueryHelpers.queryOne.mockReset();
        // Reset cache helper mock - bypass cache completely
        mockCacheHelper.getCached.mockImplementation(async (key, fn) => {
            // Bypass cache and directly execute the function
            return await fn();
        });
        MyWorkService = (await import('../../../server/services/myWorkService.js')).default;
        // Override cache and query after import to use mocks
        MyWorkService.cache = mockCacheHelper;
        MyWorkService.query = mockQueryHelpers;
    });

    describe('getMyWork', () => {
        it('should aggregate work', async () => {
            // Mock all query methods to return empty arrays/null
            mockQueryHelpers.queryAll.mockResolvedValue([]);
            mockQueryHelpers.queryOne.mockResolvedValue(null);

            const result = await MyWorkService.getMyWork('user1');
            
            expect(result).toBeDefined();
            expect(result.myTasks.total).toBe(0);
            expect(result.myAlerts.total).toBe(0);
            expect(result.myInitiatives).toBeNull();
            expect(result.myDecisions).toBeNull();
        });
    });

    describe('errors', () => {
        it('should propagate db error', async () => {
            // Make _getMyTasks query fail (first query in Promise.all)
            mockQueryHelpers.queryAll.mockImplementation((sql, params) => {
                if (sql.includes('FROM tasks') && sql.includes('assignee_id')) {
                    return Promise.reject(new Error('Fail'));
                }
                return Promise.resolve([]);
            });
            mockQueryHelpers.queryOne.mockResolvedValue(null);
            
            await expect(MyWorkService.getMyWork('user1')).rejects.toThrow('Fail');
        });
    });
});
