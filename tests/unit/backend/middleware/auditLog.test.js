
import { describe, it, expect, vi, beforeEach } from 'vitest';
import auditLogMiddleware from '../../../../server/middleware/auditLog';

const mockAuditLogService = {
    createLog: vi.fn(),
};

// ... (retain mockReq, mockRes, mockNext definitions) ...

const mockReq = {
    method: 'GET',
    originalUrl: '/api/projects',
    body: {},
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('TestAgent'),
    user: { id: 1, email: 'test@example.com', organizationId: 10 }
};

const mockRes = {
    statusCode: 200,
    end: vi.fn(),
};

const mockNext = vi.fn();

describe('AuditLog Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auditLogMiddleware.setDependencies({
            AuditLogService: mockAuditLogService
        });

        // Reset mocks
        mockReq.method = 'GET';
        mockReq.user = { id: 1, email: 'test@example.com', organizationId: 10 };
        mockReq.body = {};
        mockReq.originalUrl = '/api/projects';
        mockRes.statusCode = 200;
        mockRes.end = vi.fn(); // Reset end override
    });

    it('should ignore GET requests', () => {
        mockReq.method = 'GET';
        auditLogMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockAuditLogService.createLog).not.toHaveBeenCalled();
    });

    it('should log POST requests on success', () => {
        mockReq.method = 'POST';
        mockReq.originalUrl = '/api/projects';
        mockReq.body = { name: 'New Project' };

        // Execute middleware
        auditLogMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();

        // Simulate request completion
        mockRes.statusCode = 201;
        mockRes.end('response chunk');

        expect(mockAuditLogService.createLog).toHaveBeenCalledWith(expect.objectContaining({
            action_type: 'created',
            resource_type: 'project',
            user_id: 1,
            organization_id: 10
        }));
    });

    it('should log DELETE requests', () => {
        mockReq.method = 'DELETE';
        mockReq.originalUrl = '/api/projects/123';

        auditLogMiddleware(mockReq, mockRes, mockNext);

        mockRes.statusCode = 200;
        mockRes.end();

        expect(mockAuditLogService.createLog).toHaveBeenCalledWith(expect.objectContaining({
            action_type: 'deleted',
            resource_id: '123'
        }));
    });

    it('should not log failures (400)', () => {
        mockReq.method = 'POST';
        auditLogMiddleware(mockReq, mockRes, mockNext);

        mockRes.statusCode = 400; // Bad Request
        mockRes.end();

        expect(mockAuditLogService.createLog).not.toHaveBeenCalled();
    });

    it('should update dependencies via setDependencies', () => {
        const newMock = { createLog: vi.fn() };
        auditLogMiddleware.setDependencies({ AuditLogService: newMock });

        mockReq.method = 'POST';
        mockReq.originalUrl = '/api/projects';
        mockRes.statusCode = 201;

        auditLogMiddleware(mockReq, mockRes, mockNext);
        mockRes.end();

        expect(newMock.createLog).toHaveBeenCalled();
        expect(mockAuditLogService.createLog).not.toHaveBeenCalled();
    });
});
