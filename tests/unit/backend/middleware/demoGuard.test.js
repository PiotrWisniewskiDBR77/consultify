/**
 * Demo Guard Middleware Test
 * 
 * Tests for demo mode access restrictions.
 * 
 * @module tests/unit/backend/middleware/demoGuard.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create demo guard middleware
const createDemoGuard = (options = {}) => {
    const {
        allowedMethods = ['GET', 'HEAD', 'OPTIONS'],
        allowedPaths = ['/api/auth/logout', '/api/demo/feedback'],
        blockMessage = 'Write operations are disabled in demo mode'
    } = options;

    return (req, res, next) => {
        // Skip if not demo organization
        if (!req.organization?.isDemo) {
            return next();
        }

        // Allow specified paths
        if (allowedPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Allow read-only methods
        if (allowedMethods.includes(req.method)) {
            return next();
        }

        // Block write operations
        return res.status(403).json({
            error: 'Demo mode restriction',
            code: 'DEMO_WRITE_BLOCKED',
            message: blockMessage,
            allowedMethods,
            upgradeUrl: '/pricing'
        });
    };
};

describe('Demo Guard Middleware', () => {
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        middleware = createDemoGuard();

        mockReq = {
            method: 'GET',
            path: '/api/projects',
            organization: { isDemo: true }
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        mockNext = vi.fn();
    });

    describe('Demo Organization', () => {
        it('should allow GET requests in demo mode', () => {
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block POST requests in demo mode', () => {
            mockReq.method = 'POST';

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'DEMO_WRITE_BLOCKED'
                })
            );
        });

        it('should block PUT requests in demo mode', () => {
            mockReq.method = 'PUT';

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should block DELETE requests in demo mode', () => {
            mockReq.method = 'DELETE';

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Non-Demo Organization', () => {
        it('should allow all operations for non-demo org', () => {
            mockReq.organization.isDemo = false;
            mockReq.method = 'POST';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when no organization set', () => {
            delete mockReq.organization;
            mockReq.method = 'POST';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Allowed Paths', () => {
        it('should allow logout in demo mode', () => {
            mockReq.path = '/api/auth/logout';
            mockReq.method = 'POST';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow demo feedback in demo mode', () => {
            mockReq.path = '/api/demo/feedback';
            mockReq.method = 'POST';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
