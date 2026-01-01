import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import legalComplianceMiddlewareMod from '../../../../server/middleware/legalComplianceMiddleware';

describe('Legal Compliance Middleware', () => {
    let req;
    let res;
    let next;
    let legalComplianceMiddleware;
    let checkPendingAcceptancesMock;

    beforeEach(() => {
        checkPendingAcceptancesMock = vi.fn();
        checkPendingAcceptancesMock.mockName('test-mock-fn');

        console.log('[TEST] Init mock:', checkPendingAcceptancesMock.getMockName());

        // Use the factory to create an instance with the mock service
        // Inject identity to verify correct object usage
        legalComplianceMiddleware = legalComplianceMiddlewareMod.factory({
            checkPendingAcceptances: checkPendingAcceptancesMock,
            identity: 'TEST_MOCK_SERVICE'
        });

        req = {
            user: { id: 'u1', organizationId: 'o1', role: 'user' },
            originalUrl: '/api/some/protected/route',
            path: '/api/some/protected/route'
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should skip if user is not authenticated', async () => {
        req.user = undefined;
        await legalComplianceMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(checkPendingAcceptancesMock).not.toHaveBeenCalled();
    });

    it('should skip exempt routes', async () => {
        req.originalUrl = '/api/legal/documents';
        await legalComplianceMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(checkPendingAcceptancesMock).not.toHaveBeenCalled();
    });

    it('should call next if no pending acceptances', async () => {
        checkPendingAcceptancesMock.mockResolvedValue({ hasAnyPending: false });

        console.log('[TEST] Expecting call to mock:', checkPendingAcceptancesMock.getMockName());
        await legalComplianceMiddleware(req, res, next);

        expect(checkPendingAcceptancesMock).toHaveBeenCalledWith('u1', 'o1', 'user');
        expect(next).toHaveBeenCalled();
    });

    it('should return 451 if there are pending acceptances', async () => {
        checkPendingAcceptancesMock.mockResolvedValue({
            hasAnyPending: true,
            required: [{ doc_type: 'terms', version: '2.0', title: 'Terms' }],
            dpaPending: false,
            isOrgAdmin: false
        });

        await legalComplianceMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(451);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'LEGAL_ACCEPTANCE_REQUIRED',
            pending: expect.any(Object)
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 451 with specific DPA message', async () => {
        checkPendingAcceptancesMock.mockResolvedValue({
            hasAnyPending: true,
            required: [],
            dpaPending: true,
            isOrgAdmin: true
        });

        await legalComplianceMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(451);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            pending: expect.objectContaining({
                message: 'Organization DPA acceptance required'
            })
        }));
    });

    it('should call next on error (fail open)', async () => {
        checkPendingAcceptancesMock.mockRejectedValue(new Error('DB Error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await legalComplianceMiddleware(req, res, next);

        expect(consoleSpy).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
