/**
 * SuperAdmin Controller Tests
 * 
 * Tests for all SuperAdmin controller methods:
 * - Organizations CRUD
 * - Users CRUD
 * - Access Requests
 * - Access Codes
 * - Database Explorer
 * - Storage Management
 * - Legal Documents
 * - Attribution & Partners
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let controller;
let mockDb, mockActivityService, mockBillingService, mockUsageService, mockRealtimeService, mockStorageService, mockLegalService, mockLegalEventLogger, mockAttributionService, mockInvitationService, mockJwt, mockBcrypt, mockUuid, mockRefreshTokenService;
let mockReq, mockRes, mockNext;

beforeEach(async () => {
    vi.resetModules();

    // 1. Create Mocks
    mockDb = {
        all: vi.fn().mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, []);
            return Promise.resolve([]);
        }),
        get: vi.fn().mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, null);
            return Promise.resolve(null);
        }),
        run: vi.fn().mockImplementation(function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback.call({ changes: 1, lastID: 1 }, null);
            return Promise.resolve({ changes: 1, lastID: 1 });
        }),
        serialize: vi.fn((cb) => cb())
    };

    mockActivityService = { getRecent: vi.fn().mockResolvedValue([]), getStats: vi.fn().mockResolvedValue({ total: 0, last_hour: 0 }), log: vi.fn().mockResolvedValue({}) };
    mockBillingService = { getOrganizationBilling: vi.fn().mockResolvedValue({}), getInvoices: vi.fn().mockResolvedValue([]) };
    mockUsageService = { getCurrentUsage: vi.fn().mockResolvedValue({}) };
    mockRealtimeService = { getGlobalStats: vi.fn().mockReturnValue({}) };
    mockStorageService = { getGlobalUsage: vi.fn().mockResolvedValue({ totalSize: 0, breakdown: [] }), listFiles: vi.fn().mockResolvedValue([]), deleteFile: vi.fn().mockResolvedValue(true) };
    mockLegalService = { getAllDocuments: vi.fn().mockResolvedValue([]), publishDocument: vi.fn().mockResolvedValue({}), toggleDocumentActive: vi.fn().mockResolvedValue({}), getDocumentById: vi.fn().mockResolvedValue({}) };
    mockLegalEventLogger = { getEvents: vi.fn().mockResolvedValue([]), getEventStats: vi.fn().mockResolvedValue({}) };
    mockAttributionService = { getOrganizationAttribution: vi.fn().mockResolvedValue([]), getFirstAttribution: vi.fn().mockResolvedValue({}), exportAttribution: vi.fn().mockResolvedValue([]), getPartnerSummary: vi.fn().mockResolvedValue({}) };
    mockInvitationService = { createOrgInvitation: vi.fn().mockResolvedValue({ token: 'mock-token' }) };
    mockJwt = { sign: vi.fn(), verify: vi.fn() };
    mockBcrypt = { hashSync: vi.fn(), compareSync: vi.fn() };
    mockUuid = { v4: vi.fn() };
    mockRefreshTokenService = { generateTokenPair: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 1 }) };

    // 2. Register Mocks
    vi.doMock('../../../../server/database', () => mockDb);
    vi.doMock('../../../../server/services/activityService', () => mockActivityService);
    vi.doMock('../../../../server/services/billingService', () => mockBillingService);
    vi.doMock('../../../../server/services/usageService', () => mockUsageService);
    vi.doMock('../../../../server/services/realtimeService', () => mockRealtimeService);
    vi.doMock('../../../../server/services/storageService', () => mockStorageService);
    vi.doMock('../../../../server/services/legalService', () => mockLegalService);
    vi.doMock('../../../../server/services/legalEventLogger', () => ({ LegalEventLogger: mockLegalEventLogger }));
    vi.doMock('../../../../server/services/attributionService', () => mockAttributionService);
    vi.doMock('jsonwebtoken', () => ({ default: mockJwt, ...mockJwt }));
    vi.doMock('bcryptjs', () => ({ default: mockBcrypt, ...mockBcrypt }));
    vi.doMock('uuid', () => ({ default: mockUuid, ...mockUuid, v4: mockUuid.v4 }));
    vi.doMock('../../../../server/config', () => ({ default: { JWT_SECRET: 'test-secret', billing: { type: 'stripe' } }, JWT_SECRET: 'test-secret' }));
    vi.doMock('../../../../server/services/refreshTokenService', () => mockRefreshTokenService);
    vi.doMock('../../../../server/utils/errorHandler', () => ({
        AppError: class AppError extends Error {
            constructor(message, statusCode) {
                super(message);
                this.statusCode = statusCode;
            }
        },
        asyncHandler: (fn) => async (req, res, next) => {
            try { return await fn(req, res, next); } catch (err) { next(err); }
        }
    }));

    // 3. Request Objects
    mockReq = { params: {}, body: {}, query: {}, user: { id: 'admin-1' }, protocol: 'http', get: vi.fn(() => 'localhost') };
    mockRes = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();

    // 4. Load Controller and Set Dependencies
    // 4. Load Controller and Set Dependencies
    // Use dynamic import for ESM compatibility
    const module = await import('../../../../server/controllers/superAdminController.js');
    controller = module.default || module;

    // Set dependencies if exposed, or rely on mock replacement via vi.doMock
    // Since superAdminController.js uses 'deps' which is local, we rely on setDependencies if exported.
    // Step 935 implies supportTicketService exports it.
    // superAdminController.js usually doesn't export setDependencies if not designed for it?
    // Wait, test uses controller.setDependencies.
    // Let's assume the controller exports it.
    if (controller.setDependencies) {
        controller.setDependencies({
            db: mockDb,
            ActivityService: mockActivityService,
            BillingService: mockBillingService,
            UsageService: mockUsageService,
            RealtimeService: mockRealtimeService,
            StorageService: mockStorageService,
            LegalService: mockLegalService,
            LegalEventLogger: mockLegalEventLogger,
            AttributionService: mockAttributionService,
            InvitationService: mockInvitationService,
            jwt: mockJwt,
            bcrypt: mockBcrypt,
            uuid: mockUuid,
            RefreshTokenService: mockRefreshTokenService
        });
    }
});

describe('SuperAdmin Controller', () => {
    // Shared mock objects for all tests in this describe
    let mockOrgs, mockActivityStats, mockAiStats, mockOrgBilling, mockBilling, mockUsage, mockInvoices, mockUsers, mockInviteData, mockAccessRequests, mockAccessCode, mockResetToken;

    beforeEach(() => {
        // Prepare common mock data
        mockOrgs = [
            { id: 'org-1', name: 'Org 1', plan: 'pro', user_count: 5 },
            { id: 'org-2', name: 'Org 2', plan: 'free', user_count: 2 }
        ];

        mockActivityStats = { total: 100, last_hour: 5 };
        mockAiStats = { total_ai_calls: 1000, total_tokens: 50000 };
    });

    describe('getOrganizations', () => {
        it('should return list of organizations', async () => {
            const mockOrgs = [
                { id: 'org-1', name: 'Org 1', plan: 'pro', user_count: 5 },
                { id: 'org-2', name: 'Org 2', plan: 'free', user_count: 2 }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb(null, mockOrgs);
            });

            await controller.getOrganizations(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockOrgs);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle database errors', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await controller.getOrganizations(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(500);
        });
    });

    describe('getActivities', () => {
        it('should return recent activities with default limit', async () => {
            const mockActivities = [
                { id: 'act-1', action: 'created', entity_type: 'user' }
            ];

            mockActivityService.getRecent.mockResolvedValue(mockActivities);

            await controller.getActivities(mockReq, mockRes, mockNext);

            expect(mockActivityService.getRecent).toHaveBeenCalledWith(50);
            expect(mockRes.json).toHaveBeenCalledWith(mockActivities);
        });

        it('should use custom limit from query', async () => {
            mockReq.query.limit = '100';
            mockActivityService.getRecent.mockResolvedValue([]);

            await controller.getActivities(mockReq, mockRes, mockNext);

            expect(mockActivityService.getRecent).toHaveBeenCalledWith(100);
        });
    });

    describe('getDashboardStats', () => {
        it('should return dashboard statistics', async () => {
            const mockActivityStats = { total: 100, last_24h: 10 };
            const mockAiStats = { total_ai_calls: 500, total_tokens: 10000 };
            const mockCounts = { total_users: 10, total_orgs: 2, active_users_7d: 5 };
            const mockLive = { activeSessions: 3 };

            mockActivityService.getStats.mockResolvedValue(mockActivityStats);
            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (sql.includes('ai_logs')) {
                    if (typeof cb === 'function') cb(null, mockAiStats);
                    return Promise.resolve(mockAiStats);
                } else if (sql.includes('total_users') || sql.includes('COUNT(*) FROM users')) {
                    if (typeof cb === 'function') cb(null, mockCounts);
                    return Promise.resolve(mockCounts);
                } else {
                    if (typeof cb === 'function') cb(null, {});
                    return Promise.resolve({});
                }
            });
            mockRealtimeService.getGlobalStats.mockReturnValue(mockLive);

            await controller.getDashboardStats(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                activity: mockActivityStats,
                ai: mockAiStats,
                counts: mockCounts,
                live: mockLive
            }));
        });

        it('should handle activity stats errors gracefully', async () => {
            mockActivityService.getStats.mockRejectedValue(new Error('Stats error'));
            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb(null, {});
                return Promise.resolve({});
            });
            mockRealtimeService.getGlobalStats.mockReturnValue({});

            await controller.getDashboardStats(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.json).toHaveBeenCalled();
            expect(mockRes.json.mock.calls[0][0].activity).toEqual({
                total: 0,
                last_hour: 0,
                last_24h: 0,
                last_7d: 0
            });
        });
    });

    describe('updateOrganization', () => {
        it('should update organization successfully', async () => {
            mockReq.params.id = 'org-1';
            mockReq.body = { plan: 'enterprise', status: 'active' };

            mockDb.run.mockImplementation(function (sql, params, callback) {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb.call({ changes: 1 }, null);
                return Promise.resolve({ changes: 1 });
            });

            await controller.updateOrganization(mockReq, mockRes, mockNext);

            expect(mockDb.run).toHaveBeenCalled();
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Organization updated' });
        });

        it('should reject invalid plan', async () => {
            mockReq.params.id = 'org-1';
            mockReq.body = { plan: 'invalid' };

            await controller.updateOrganization(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });

        it('should reject invalid status', async () => {
            mockReq.params.id = 'org-1';
            mockReq.body = { status: 'invalid' };

            await controller.updateOrganization(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });

        it('should reject invalid discount percent', async () => {
            mockReq.params.id = 'org-1';
            mockReq.body = { discount_percent: 150 };

            await controller.updateOrganization(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });

        it('should return 404 if organization not found', async () => {
            mockReq.params.id = 'org-999';
            mockDb.run.mockImplementationOnce(function (sql, params, callback) {
                const cb = typeof params === 'function' ? params : callback;
                cb.call({ changes: 0 }, null);
                return Promise.resolve({ changes: 0 });
            });

            await controller.updateOrganization(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
        });
    });

    describe('deleteOrganization', () => {
        it('should delete organization and related data', async () => {
            mockReq.params.id = 'org-1';
            mockDb.run.mockImplementation(function (sql, params, callback) {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb.call({ changes: 1 }, null);
                return Promise.resolve({ changes: 1 });
            });

            await controller.deleteOrganization(mockReq, mockRes, mockNext);

            expect(mockDb.run).toHaveBeenCalledTimes(5); // sessions, project_users, projects, users, organizations
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should prevent deletion of system organization', async () => {
            mockReq.params.id = 'org-dbr77-system';

            await controller.deleteOrganization(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
        });
    });

    describe('getOrgBilling', () => {
        it('should return billing information', async () => {
            mockReq.params.id = 'org-1';
            const mockBilling = { status: 'active', plan: 'pro' };
            const mockUsage = { users: 10, storage: 1000 };
            const mockInvoices = [{ id: 'inv-1', amount: 100 }];

            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockUsageService.getCurrentUsage.mockResolvedValue(mockUsage);
            mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

            await controller.getOrgBilling(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.json).toHaveBeenCalledWith({
                billing: mockBilling,
                usage: mockUsage,
                invoices: mockInvoices
            });
        });

        it('should handle missing billing', async () => {
            mockReq.params.id = 'org-1';
            mockBillingService.getOrganizationBilling.mockResolvedValue(null);
            mockUsageService.getCurrentUsage.mockResolvedValue({});
            mockBillingService.getInvoices.mockResolvedValue([]);

            await controller.getOrgBilling(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.json).toHaveBeenCalledWith({
                billing: { status: 'no_subscription' },
                usage: {},
                invoices: []
            });
        });
    });

    describe('getUsers', () => {
        it('should return list of users', async () => {
            const mockUsers = [
                { id: 'user-1', email: 'user1@test.com', organization_name: 'Org 1' }
            ];

            mockDb.all.mockResolvedValue($2);

            await controller.getUsers(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });
    });

    describe('updateUser', () => {
        it('should update user successfully', async () => {
            mockReq.params.id = 'user-1';
            mockReq.body = { role: 'ADMIN', status: 'active' };

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.updateUser(mockReq, mockRes, mockNext);

            expect(mockDb.run).toHaveBeenCalled();
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'User updated successfully' });
        });

        it('should return 404 if user not found', async () => {
            mockReq.params.id = 'user-999';
            mockDb.run.mockImplementationOnce(function (sql, params, callback) {
                const cb = typeof params === 'function' ? params : callback;
                cb.call({ changes: 0 }, null);
                return Promise.resolve({ changes: 0 });
            });

            await controller.updateUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
        });
    });

    describe('createUser', () => {
        it('should create super admin user', async () => {
            mockReq.body = {
                email: 'admin@test.com',
                password: 'password123',
                firstName: 'Admin',
                lastName: 'User'
            };

            mockBcrypt.hashSync.mockReturnValue('hashed-password');
            mockUuid.v4.mockReturnValue('user-id-123');
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.createUser(mockReq, mockRes, mockNext);

            expect(mockBcrypt.hashSync).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalled();
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should require email and password', async () => {
            mockReq.body = { email: 'test@test.com' };

            await controller.createUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });

        it('should handle duplicate email', async () => {
            mockReq.body = {
                email: 'existing@test.com',
                password: 'password123'
            };

            mockBcrypt.hashSync.mockReturnValue('hashed');
            mockUuid.v4.mockReturnValue('user-id');
            mockDb.run.mockImplementation((sql, params, callback) => {
                const error = new Error('UNIQUE constraint failed');
                callback(error, null);
            });

            await controller.createUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });
    });

    describe('inviteUser', () => {
        it('should create invitation', async () => {
            mockReq.body = {
                email: 'newuser@test.com',
                organizationId: 'org-1',
                role: 'USER'
            };

            mockDb.get.mockResolvedValue($2);

            mockUuid.v4.mockReturnValueOnce('token-123').mockReturnValueOnce('invite-id');
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.inviteUser(mockReq, mockRes, mockNext);

            expect(mockInvitationService.createOrgInvitation).toHaveBeenCalledWith(
                'org-1',
                'newuser@test.com',
                'USER',
                'admin-1',
                {},
                expect.any(Object)
            );
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should require email and organizationId', async () => {
            mockReq.body = { email: 'test@test.com' };

            await controller.inviteUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });

        it('should reject if user already exists', async () => {
            mockReq.body = {
                email: 'existing@test.com',
                organizationId: 'org-1'
            };

            mockInvitationService.createOrgInvitation.mockRejectedValue(new Error('User already a member'));

            await controller.inviteUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });
    });

    describe('resetUserPassword', () => {
        it('should generate reset link', async () => {
            mockReq.params.id = 'user-1';
            const mockUser = { id: 'user-1', email: 'user@test.com' };

            mockDb.get.mockResolvedValue($2);

            mockUuid.v4.mockReturnValueOnce('token-123').mockReturnValueOnce('reset-id');
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.resetUserPassword(mockReq, mockRes, mockNext);

            expect(mockDb.get).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalled();
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should return 404 if user not found', async () => {
            mockReq.params.id = 'user-999';
            mockDb.get.mockResolvedValue($2);

            await controller.resetUserPassword(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
        });
    });

    describe('getAccessRequests', () => {
        it('should return access requests', async () => {
            const mockRequests = [
                { id: 'req-1', organization_id: 'org-1', status: 'pending' }
            ];

            mockDb.all.mockResolvedValue($2);

            await controller.getAccessRequests(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockRequests);
        });
    });

    describe('approveAccessRequest', () => {
        it('should approve access request', async () => {
            mockReq.params.id = 'req-1';
            const mockRequest = { id: 'req-1', organization_id: 'org-1' };

            mockDb.get.mockResolvedValue($2);

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.approveAccessRequest(mockReq, mockRes, mockNext);

            expect(mockDb.get).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalledTimes(2); // Update org, update request
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should return 404 if request not found', async () => {
            mockReq.params.id = 'req-999';
            mockDb.get.mockResolvedValue($2);

            await controller.approveAccessRequest(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
        });
    });

    describe('rejectAccessRequest', () => {
        it('should reject access request', async () => {
            mockReq.params.id = 'req-1';
            mockReq.body = { reason: 'Invalid request' };
            const mockRequest = { id: 'req-1', organization_id: 'org-1' };

            mockDb.get.mockResolvedValue($2);

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.rejectAccessRequest(mockReq, mockRes, mockNext);

            expect(mockDb.get).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalledTimes(2);
            expect(mockRes.json).toHaveBeenCalled();
        });
    });

    describe('getAccessCodes', () => {
        it('should return access codes', async () => {
            const mockCodes = [
                { id: 'code-1', code: 'ABC123', max_uses: 10 }
            ];

            mockDb.all.mockResolvedValue($2);

            await controller.getAccessCodes(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockCodes);
        });
    });

    describe('createAccessCode', () => {
        it('should create access code', async () => {
            mockReq.body = { code: 'TEST123', role: 'USER', maxUses: 50 };

            mockUuid.v4.mockReturnValue('code-id');
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.createAccessCode(mockReq, mockRes, mockNext);

            expect(mockDb.run).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should generate code if not provided', async () => {
            mockReq.body = { role: 'USER' };
            mockUuid.v4.mockReturnValueOnce('code-id').mockReturnValueOnce('GENERATED');

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null, { changes: 1 });
            });

            await controller.createAccessCode(mockReq, mockRes, mockNext);

            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('impersonateUser', () => {
        it('should generate impersonation token', async () => {
            mockReq.body = { userId: 'user-1' };
            const mockUser = {
                id: 'user-1',
                email: 'user@test.com',
                role: 'USER',
                organization_id: 'org-1',
                first_name: 'Test',
                last_name: 'User',
                status: 'active'
            };
            const mockOrg = { id: 'org-1', name: 'Test Org' };

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('users')) {
                    callback(null, mockUser);
                    return Promise.resolve(mockUser);
                } else {
                    callback(null, mockOrg);
                    return Promise.resolve(mockOrg);
                }
            });

            mockUuid.v4.mockReturnValue('jti-123');
            mockJwt.sign.mockReturnValue('impersonation-token');

            await controller.impersonateUser(mockReq, mockRes, mockNext);

            expect(mockDb.get).toHaveBeenCalledTimes(2);
            expect(mockJwt.sign).toHaveBeenCalled();
            expect(mockActivityService.log).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should require userId', async () => {
            mockReq.body = {};

            await controller.impersonateUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });

        it('should return 404 if user not found', async () => {
            mockReq.body = { userId: 'user-999' };
            mockDb.get.mockResolvedValue($2);

            await controller.impersonateUser(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
        });
    });

    describe('getDatabaseTables', () => {
        it('should return SQLite tables', async () => {
            process.env.DB_TYPE = undefined;
            const mockTables = [{ name: 'users' }, { name: 'organizations' }];

            mockDb.all.mockResolvedValue($2);

            await controller.getDatabaseTables(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(['users', 'organizations']);
        });

        it('should return PostgreSQL tables', async () => {
            process.env.DB_TYPE = 'postgres';
            const mockTables = [{ table_name: 'users' }];

            mockDb.all.mockResolvedValue($2);

            await controller.getDatabaseTables(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('getDatabaseRows', () => {
        it('should return table rows', async () => {
            mockReq.params.tableName = 'users';
            const mockRows = [{ id: 'user-1', email: 'test@test.com' }];

            mockDb.all.mockResolvedValue($2);

            await controller.getDatabaseRows(mockReq, mockRes, mockNext);

            expect(mockDb.all).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockRows);
        });

        it('should reject invalid table names', async () => {
            mockReq.params.tableName = 'users; DROP TABLE users;';

            await controller.getDatabaseRows(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        });
    });

    describe('getStorageUsage', () => {
        it('should return storage usage', async () => {
            const mockBreakdown = [{ organizationId: 'org-1', organizationName: 'Org 1', dataSize: 500, fileCount: 5 }];
            const mockUsage = { totalData: 1000, breakdown: mockBreakdown, totalFiles: 10 };
            mockStorageService.getGlobalUsage.mockResolvedValue(mockUsage);
            mockDb.all.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                cb(null, [{ id: 'org-1', name: 'Org 1' }]);
            });

            await controller.getStorageUsage(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockStorageService.getGlobalUsage).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });
    });

    describe('getStorageFiles', () => {
        it('should return storage files', async () => {
            mockReq.params.orgId = 'org-1';
            const mockFiles = [{ id: 'file-1', name: 'test.pdf' }];
            mockStorageService.listFiles.mockResolvedValue(mockFiles);

            await controller.getStorageFiles(mockReq, mockRes, mockNext);

            expect(mockStorageService.listFiles).toHaveBeenCalledWith('org-1');
            expect(mockRes.json).toHaveBeenCalledWith(mockFiles);
        });
    });

    describe('deleteStorageFile', () => {
        it('should delete storage file', async () => {
            mockReq.body = { orgId: 'org-1', path: 'test.pdf' };
            mockStorageService.deleteFile.mockResolvedValue(true);

            await controller.deleteStorageFile(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockStorageService.deleteFile).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe('getAllLegalDocs', () => {
        it('should return all legal documents', async () => {
            const mockDocs = [{ id: 'doc-1', name: 'Privacy Policy' }];
            mockLegalService.getAllDocuments.mockResolvedValue(mockDocs);

            await controller.getAllLegalDocs(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLegalService.getAllDocuments).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockDocs);
        });
    });

    describe('publishLegalDoc', () => {
        it('should publish legal document', async () => {
            mockReq.params.id = 'doc-1';
            mockReq.body = {
                docType: 'TOS',
                version: '1.0',
                title: 'Terms of Service',
                contentMd: '...',
                effectiveFrom: '2023-01-01'
            };
            const mockDoc = { id: 'doc-1', published: true };
            mockLegalService.publishDocument.mockResolvedValue(mockDoc);

            await controller.publishLegalDoc(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLegalService.publishDocument).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });
    });

    describe('toggleLegalDocActive', () => {
        it('should toggle legal document active status', async () => {
            mockReq.params.id = 'doc-1';
            mockReq.body = { isActive: true };
            const mockDoc = { id: 'doc-1', active: true };
            mockLegalService.toggleDocumentActive.mockResolvedValue(mockDoc);

            await controller.toggleLegalDocActive(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLegalService.toggleDocumentActive).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });
    });

    describe('getLegalDocById', () => {
        it('should return legal document by id', async () => {
            mockReq.params.id = 'doc-1';
            const mockDoc = { id: 'doc-1', name: 'Privacy Policy' };
            mockLegalService.getDocumentById.mockResolvedValue(mockDoc);

            await controller.getLegalDocById(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLegalService.getDocumentById).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockDoc);
        });
    });

    describe('getLegalEvents', () => {
        it('should return legal events', async () => {
            const mockEvents = [{ id: 'event-1', type: 'accept', metadata: '{}' }];
            mockLegalEventLogger.getEvents.mockResolvedValue(mockEvents);

            await controller.getLegalEvents(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLegalEventLogger.getEvents).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                count: 1,
                events: expect.any(Array)
            });
        });
    });

    describe('getLegalEventStats', () => {
        it('should return legal event statistics', async () => {
            const mockStats = { total: 100, accepts: 80 };
            mockLegalEventLogger.getEventStats.mockResolvedValue(mockStats);

            await controller.getLegalEventStats(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLegalEventLogger.getEventStats).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                period: '30 days',
                stats: mockStats
            });
        });
    });

    describe('getOrgAttribution', () => {
        it('should return organization attribution', async () => {
            mockReq.params.id = 'org-1';
            const mockAttribution = [{ source: 'google', medium: 'cpc' }];
            const mockFirst = { source: 'organic' };
            mockAttributionService.getOrganizationAttribution.mockResolvedValue(mockAttribution);
            mockAttributionService.getFirstAttribution.mockResolvedValue(mockFirst);

            try {
                await controller.getOrgAttribution(mockReq, mockRes, mockNext);
            } catch (err) {
                console.error('getOrgAttribution error:', err);
                throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockAttributionService.getOrganizationAttribution).toHaveBeenCalledWith('org-1');
            expect(mockAttributionService.getFirstAttribution).toHaveBeenCalledWith('org-1');
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                organizationId: 'org-1',
                firstAttribution: mockFirst,
                allEvents: mockAttribution,
                totalEvents: mockAttribution.length
            }));
        });
    });

    describe('exportAttribution', () => {
        it('should export attribution data', async () => {
            mockReq.query.startDate = '2023-01-01';
            const mockData = [{ org: 'org-1', source: 'google' }];
            mockAttributionService.exportAttribution.mockResolvedValue(mockData);

            await controller.exportAttribution(mockReq, mockRes, mockNext);

            expect(mockAttributionService.exportAttribution).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                count: 1,
                data: mockData,
                filters: expect.any(Object)
            }));
        });
    });

    describe('getPartnerSummary', () => {
        it('should return partner summary', async () => {
            mockReq.query.startDate = '2023-01-01';
            const mockSummary = { total: 10, active: 5 };
            mockAttributionService.getPartnerSummary.mockResolvedValue(mockSummary);

            await controller.getPartnerSummary(mockReq, mockRes, mockNext);

            expect(mockAttributionService.getPartnerSummary).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                period: expect.any(Object),
                partners: mockSummary
            });
        });
    });
    describe('Invoices & Billing', () => {
        it('should get invoice stats', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { total_revenue: 1000, paid_invoices: 5 });
            });

            await controller.getInvoiceStats(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                totalRevenue: 1000,
                paidInvoices: 5
            }));
        });

        it('should remind invoice', async () => {
            mockReq.params.id = 'inv-123';
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'inv-123' });
            });
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb(null);
            });

            await controller.remindInvoice(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: 'Reminder sent' });
        });

        it('should mark invoice as paid', async () => {
            mockReq.params.id = 'inv-123';
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'inv-123' });
            });
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb(null);
            });

            await controller.markInvoicePaid(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: 'Invoice marked as paid' });
        });

        it('should get invoice pdf placeholder', async () => {
            mockReq.params.id = 'inv-123';
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'inv-123' });
            });

            await controller.getInvoicePdf(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                pdf: expect.stringContaining('not implemented')
            }));
        });
    });

    describe('Branding', () => {
        it('should upload branding logo placeholder', async () => {
            mockReq.params.orgId = 'org-123';
            await controller.uploadBrandingLogo(mockReq, mockRes, mockNext);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'Logo uploaded'
            }));
        });
    });

    describe('API Keys', () => {
        it('should get API keys', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, [{ id: 'key-1' }]);
            });

            await controller.getApiKeys(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith([{ id: 'key-1' }]);
        });

        it('should create API key', async () => {
            mockReq.body = { name: 'New Key' };
            mockUuid.v4.mockReturnValue('new-uuid');
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb(null);
            });

            await controller.createApiKey(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                id: 'new-uuid',
                name: 'New Key'
            }));
        });

        it('should delete API key', async () => {
            mockReq.params.id = 'key-1';
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb(null);
            });

            await controller.deleteApiKey(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({ success: true });
        });

        it('should get API key usage', async () => {
            mockReq.params.id = 'key-1';
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { usage_count: 10, quota_used: 100 });
            });

            await controller.getApiKeyUsage(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({ count: 10, tokens: 100 });
        });
    });

    describe('Compliance', () => {
        it('should get compliance frameworks', async () => {
            await controller.getComplianceFrameworks(mockReq, mockRes, mockNext);
            expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
        });

        it('should get compliance status', async () => {
            mockReq.params.frameworkId = 'gdpr';
            await controller.getComplianceStatus(mockReq, mockRes, mockNext);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                framework: 'gdpr',
                status: 'compliant'
            }));
        });

        it('should get DSAR requests', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, [{ id: 'req-1' }]);
            });
            await controller.getDsarRequests(mockReq, mockRes, mockNext);
            expect(mockRes.json).toHaveBeenCalledWith([{ id: 'req-1' }]);
        });

        it('should get compliance audits list', async () => {
            await controller.getComplianceAudits(mockReq, mockRes, mockNext);
            expect(mockRes.json).toHaveBeenCalledWith([]);
        });
    });

    describe('Security Extras', () => {
        it('should refresh token', async () => {
            mockRefreshTokenService.generateTokenPair.mockResolvedValue({
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
                expiresIn: 3600
            });

            mockReq.user = { id: 'admin-1' };
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'admin-1', email: 'admin@test.com', role: 'super_admin' });
            });

            await controller.refreshToken(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'new-access',
                refreshToken: 'new-refresh'
            }));
        });
    });
});














