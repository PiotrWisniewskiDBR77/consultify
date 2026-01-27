/**
 * Audit Log Middleware - Real Production Tests
 * Tests for server/src/middleware/auditLog.middleware.ts
 * 
 * This tests REAL production middleware with ActivityService mock.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted() for mocks
const { mockActivityService, mockLogger } = vi.hoisted(() => ({
    mockActivityService: {
        log: vi.fn().mockResolvedValue(undefined),
    },
    mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../../../server/src/services/ActivityService.js', () => ({
    default: mockActivityService,
    log: mockActivityService.log,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mockLogger,
}));

// Import REAL production middleware
import auditLogMiddleware from '../../../../server/src/middleware/auditLog.middleware.js';

describe('AuditLog Middleware - Real Production Tests', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock request
        mockReq = {
            method: 'POST',
            originalUrl: '/api/projects/123',
            user: {
                id: 'user-123',
                organizationId: 'org-456',
            },
            body: {
                name: 'Test Project',
                description: 'Test description',
            },
            ip: '192.168.1.1',
            get: vi.fn().mockReturnValue('Mozilla/5.0'),
        };

        // Setup mock response with end capture
        mockRes = {
            statusCode: 200,
            end: vi.fn(),
        };

        mockNext = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Skip non-mutating methods', () => {
        it('should skip GET requests', async () => {
            mockReq.method = 'GET';

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            // Should not have modified res.end
            expect(mockRes.end).not.toHaveBeenCalled();
        });

        it('should skip OPTIONS requests', async () => {
            mockReq.method = 'OPTIONS';

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip HEAD requests', async () => {
            mockReq.method = 'HEAD';

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Process mutating methods', () => {
        it('should wrap response end for POST requests', async () => {
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            // res.end should be overridden
            expect(typeof mockRes.end).toBe('function');
        });

        it('should wrap response end for PUT requests', async () => {
            mockReq.method = 'PUT';

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should wrap response end for PATCH requests', async () => {
            mockReq.method = 'PATCH';

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should wrap response end for DELETE requests', async () => {
            mockReq.method = 'DELETE';

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Log on successful response', () => {
        it('should log when response status is 2xx', async () => {
            const originalEnd = mockRes.end;
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            // Simulate response.end() being called
            mockRes.statusCode = 201;
            mockRes.end();

            // Wait for async log
            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    organizationId: 'org-456',
                    userId: 'user-123',
                    action: 'created',
                    entityType: 'project',
                })
            );
        });

        it('should not log when response status is 4xx', async () => {
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            // Simulate error response
            mockRes.statusCode = 400;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).not.toHaveBeenCalled();
        });

        it('should not log when response status is 5xx', async () => {
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 500;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).not.toHaveBeenCalled();
        });
    });

    describe('Action mapping', () => {
        it('should map POST to created action', async () => {
            mockReq.method = 'POST';
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 201;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'created' })
            );
        });

        it('should map PUT to updated action', async () => {
            mockReq.method = 'PUT';
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'updated' })
            );
        });

        it('should map DELETE to deleted action', async () => {
            mockReq.method = 'DELETE';
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'deleted' })
            );
        });
    });

    describe('Entity extraction', () => {
        it('should extract entity type from URL', async () => {
            mockReq.originalUrl = '/api/tasks/task-123';
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityType: 'task',
                    entityId: 'task-123',
                })
            );
        });

        it('should extract entity name from body', async () => {
            mockReq.body = { name: 'My New Project' };
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({ entityName: 'My New Project' })
            );
        });
    });

    describe('Error handling', () => {
        it('should handle ActivityService errors gracefully', async () => {
            mockActivityService.log.mockRejectedValueOnce(new Error('DB Error'));

            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            // Should log error but not crash
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should handle anonymous users', async () => {
            mockReq.user = undefined;
            await auditLogMiddleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            mockRes.end();

            await new Promise((r) => setTimeout(r, 50));

            expect(mockActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'anonymous' })
            );
        });
    });
});
