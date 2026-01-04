import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
}));

// Mock the database module
vi.mock('../../../../server/src/database/index.js', () => ({
    getDatabase: () => mockDb
}));

// Import middleware after mocking
const planLimitsModule = await import('../../../../server/middleware/planLimits.js');
const checkPlanLimit = planLimitsModule.checkPlanLimit;

describe('PlanLimits Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            user: { organizationId: 'org-test-plan' },
            body: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();

        // Reset mocks
        vi.clearAllMocks();
    });

    const setupOrg = (plan, status = 'active') => {
        mockDb.get.mockImplementationOnce((sql, params, callback) => {
            if (sql.includes('organizations WHERE id = ?')) {
                callback(null, { id: 'org-test-plan', name: 'Test Org', plan, status });
            }
        });
    };

    const setProjectCount = (count) => {
        mockDb.get.mockImplementationOnce((sql, params, callback) => {
            if (sql.includes('COUNT(*) as count FROM projects')) {
                callback(null, { count });
            }
        });
    };

    const setMemberCount = (count) => {
        mockDb.get.mockImplementationOnce((sql, params, callback) => {
            if (sql.includes('COUNT(*) as count FROM users WHERE organization_id = ?')) {
                callback(null, { count });
            }
        });
    };

    it('should return 403 if no organization found in user', async () => {
        req.user.organizationId = null;
        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 if organization does not exist in DB', async () => {
        mockDb.get.mockImplementationOnce((sql, params, callback) => {
            callback(null, null);
        });

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should allow request if within limit (Free plan)', async () => {
        setupOrg('free');
        setProjectCount(0); // Limit is 1

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should block request if limit reached (Free plan)', async () => {
        setupOrg('free');
        setProjectCount(1); // Limit is 1. We have 1. Next creation would be 2.

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Plan limit reached') }));
    });

    it('should allow request if within limit (Pro plan)', async () => {
        setupOrg('pro');
        setProjectCount(5); // Limit 10

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should treat trial status as pro plan', async () => {
        setupOrg('free', 'trial'); // Status is trial, so should be Pro
        setProjectCount(5); // Limit 10 (Pro), 1 (Free). Should pass.

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should handle undefined limits gracefully (warn and allow)', async () => {
        setupOrg('free');
        const middleware = checkPlanLimit('unknown_limit_key');

        const consoleSpy = vi.spyOn(console, 'warn');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should check max_members limit', async () => {
        setupOrg('free'); // Limit 1
        setMemberCount(2); // 2 users > 1 limit

        const middleware = checkPlanLimit('max_members');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
    });
});
