import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock usageService - must be defined before vi.mock
const mockUsageService = {
    checkQuota: vi.fn(),
    recordTokenUsage: vi.fn(),
    recordStorageUsage: vi.fn()
};

// Mock usageService - CommonJS module.exports returns the object directly
vi.mock('../../../../server/services/usageService.js', () => {
    return mockUsageService;
});

vi.mock('../../../../server/database', () => ({
    default: { 
        run: vi.fn(), 
        get: vi.fn(), 
        all: vi.fn(),
        initPromise: Promise.resolve() 
    }
}));

// Import middleware after mocking - use ES module import for TypeScript version
import * as quotaMiddleware from '../../../../server/src/middleware/quota.middleware.ts';

describe('Quota Middleware (Integration)', () => {
    let req, res, next;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Inject mock dependencies into middleware
        if (quotaMiddleware.setDependencies) {
            quotaMiddleware.setDependencies({
                usageService: mockUsageService
            });
        }

        req = {
            user: { organizationId: 'org-quota-middleware-test', id: 'user-quota-test' },
            path: '/api/generate',
            body: { model: 'gpt-4' }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            set: vi.fn()
        };
        next = vi.fn();
    });

    describe('enforceTokenQuota', () => {
        it('should return 401 if no orgId', async () => {
            req.user = undefined;
            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should allow if usage is below limit', async () => {
            mockUsageService.checkQuota.mockResolvedValue({
                allowed: true,
                limit: 1000,
                used: 500,
                percentage: 50
            });

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.quotaInfo).toBeDefined();
            expect(req.quotaInfo.allowed).toBe(true);
        });

        it('should block 429 if usage exceeds limit', async () => {
            mockUsageService.checkQuota.mockResolvedValue({
                allowed: false,
                limit: 1000,
                used: 1500,
                percentage: 150
            });

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow if overage is enabled even if exceeded', async () => {
            mockUsageService.checkQuota.mockResolvedValue({
                allowed: true,
                limit: 1000,
                used: 1500,
                percentage: 150
            });

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should set warning headers if > 80%', async () => {
            mockUsageService.checkQuota.mockResolvedValue({
                allowed: true,
                limit: 1000,
                used: 850,
                percentage: 85
            });

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(res.set).toHaveBeenCalledWith('X-Quota-Warning', 'true');
        });
    });

    describe('enforceStorageQuota', () => {
        it('should allow if allowed', async () => {
            mockUsageService.checkQuota.mockResolvedValue({
                allowed: true,
                limit: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
                used: 5 * 1024 * 1024 * 1024, // 5 GB in bytes
                percentage: 50
            });

            await quotaMiddleware.enforceStorageQuota(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block 429 if exceeded', async () => {
            mockUsageService.checkQuota.mockResolvedValue({
                allowed: false,
                limit: 1 * 1024 * 1024 * 1024, // 1 GB in bytes
                used: 2 * 1024 * 1024 * 1024, // 2 GB in bytes
                percentage: 200
            });

            await quotaMiddleware.enforceStorageQuota(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
        });
    });

    describe('recordTokenUsageAfterResponse', () => {
        it('should insert usage record into DB', async () => {
            mockUsageService.recordTokenUsage.mockResolvedValue({ id: 'usage-1' });

            await quotaMiddleware.recordTokenUsageAfterResponse(req, res, 123, 'completion');

            expect(mockUsageService.recordTokenUsage).toHaveBeenCalledWith(
                'org-quota-middleware-test',
                'user-quota-test', // userId from req.user
                123, // tokens
                'completion', // action
                expect.objectContaining({
                    endpoint: '/api/generate',
                    model: 'gpt-4'
                })
            );
        });
    });
});
