import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import legalComplianceMiddleware from '../../../../server/middleware/legalComplianceMiddleware';
import LegalService from '../../../../server/services/legalService';

// Mock LegalService
vi.mock('../../../../server/services/legalService', () => ({
    default: {
        checkPendingAcceptances: vi.fn()
    }
}));

describe('Legal Compliance Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
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
        vi.restoreAllMocks();
    });

    it('should skip if user is not authenticated', async () => {
        req.user = undefined;
        await legalComplianceMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(LegalService.checkPendingAcceptances).not.toHaveBeenCalled();
    });

    it('should skip exempt routes', async () => {
        req.originalUrl = '/api/legal/documents';
        await legalComplianceMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(LegalService.checkPendingAcceptances).not.toHaveBeenCalled();
    });

    it('should call next if no pending acceptances', async () => {
        LegalService.checkPendingAcceptances.mockResolvedValue({ hasAnyPending: false });

        await legalComplianceMiddleware(req, res, next);

        expect(LegalService.checkPendingAcceptances).toHaveBeenCalledWith('u1', 'o1', 'user');
        expect(next).toHaveBeenCalled();
    });

    it('should return 451 if there are pending acceptances', async () => {
        LegalService.checkPendingAcceptances.mockResolvedValue({
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
        LegalService.checkPendingAcceptances.mockResolvedValue({
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
        LegalService.checkPendingAcceptances.mockRejectedValue(new Error('DB Error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await legalComplianceMiddleware(req, res, next);

        expect(consoleSpy).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
