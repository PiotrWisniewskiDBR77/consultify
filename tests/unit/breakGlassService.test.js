/**
 * Break-Glass Service Unit Tests
 * Step 14: Governance, Security & Enterprise Controls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
    serialize: vi.fn(cb => cb()),
    initPromise: Promise.resolve()
};

const mockGovernanceAuditService = {
    logAudit: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    AUDIT_ACTIONS: {
        BREAK_GLASS_START: 'BREAK_GLASS_START',
        BREAK_GLASS_CLOSE: 'BREAK_GLASS_CLOSE'
    },
    RESOURCE_TYPES: {
        BREAK_GLASS_SESSION: 'BREAK_GLASS_SESSION'
    }
};

const BreakGlassService = require('../../server/services/breakGlassService');

describe('BreakGlassService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        BreakGlassService.setDependencies({
            db: mockDb,
            GovernanceAuditService: mockGovernanceAuditService,
            uuidv4: () => 'test-uuid-1234'
        });
        mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));
        mockDb.run.mockImplementation((sql, params, cb) => cb.call({ changes: 1 }, null));
        mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));
    });

    describe('SCOPES', () => {
        it('should define all break-glass scopes', () => {
            expect(BreakGlassService.SCOPES).toBeDefined();
            expect(BreakGlassService.SCOPES.POLICY_ENGINE_DISABLED).toBe('policy_engine_disabled');
            expect(BreakGlassService.SCOPES.APPROVAL_BYPASS).toBe('approval_bypass');
            expect(BreakGlassService.SCOPES.RATE_LIMIT_BYPASS).toBe('rate_limit_bypass');
            expect(BreakGlassService.SCOPES.EMERGENCY_ACCESS).toBe('emergency_access');
        });
    });

    describe('DEFAULT_DURATION_MINUTES', () => {
        it('should be 2 hours (120 minutes)', () => {
            expect(BreakGlassService.DEFAULT_DURATION_MINUTES).toBe(120);
        });
    });

    describe('MAX_DURATION_MINUTES', () => {
        it('should be 24 hours (1440 minutes)', () => {
            expect(BreakGlassService.MAX_DURATION_MINUTES).toBe(1440);
        });
    });

    describe('startSession', () => {
        it('should throw error for missing required parameters', async () => {
            await expect(BreakGlassService.startSession({}))
                .rejects.toThrow('Missing required parameters');
        });

        it('should throw error for invalid scope', async () => {
            await expect(BreakGlassService.startSession({
                actorId: 'user-1',
                actorRole: 'SUPERADMIN',
                orgId: 'org-1',
                reason: 'Emergency fix',
                scope: 'invalid_scope'
            })).rejects.toThrow('Invalid scope');
        });

        it('should throw error if session already exists for scope', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'existing-session' });
            });

            await expect(BreakGlassService.startSession({
                actorId: 'user-1',
                actorRole: 'SUPERADMIN',
                orgId: 'org-1',
                reason: 'Emergency fix',
                scope: 'policy_engine_disabled'
            })).rejects.toThrow('Active break-glass session already exists');
        });

        it('should create session successfully', async () => {
            const result = await BreakGlassService.startSession({
                actorId: 'user-1',
                actorRole: 'SUPERADMIN',
                orgId: 'org-1',
                reason: 'Emergency system update',
                scope: 'policy_engine_disabled',
                durationMinutes: 60
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.actorId).toBe('user-1');
            expect(result.scope).toBe('policy_engine_disabled');
            expect(result.expiresAt).toBeDefined();
        });

        it('should cap duration at MAX_DURATION_MINUTES', async () => {
            const result = await BreakGlassService.startSession({
                actorId: 'user-1',
                actorRole: 'SUPERADMIN',
                orgId: 'org-1',
                reason: 'Long maintenance',
                scope: 'emergency_access',
                durationMinutes: 9999 // Way over max
            });

            const expiresAt = new Date(result.expiresAt);
            const createdAt = new Date(result.createdAt);
            const durationMs = expiresAt - createdAt;
            const durationMinutes = durationMs / (60 * 1000);

            // Should be capped at MAX_DURATION_MINUTES (1440)
            expect(durationMinutes).toBeLessThanOrEqual(BreakGlassService.MAX_DURATION_MINUTES);
        });
    });

    describe('closeSession', () => {
        it('should throw error for non-existent session', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            await expect(BreakGlassService.closeSession('session-123', 'user-1', 'SUPERADMIN'))
                .rejects.toThrow('Session not found');
        });

        it('should throw error for already closed session', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'session-1', closed_at: '2024-01-01' });
            });

            await expect(BreakGlassService.closeSession('session-1', 'user-1', 'SUPERADMIN'))
                .rejects.toThrow('Session already closed');
        });

        it('should close session successfully', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    id: 'session-1',
                    organization_id: 'org-1',
                    scope: 'policy_engine_disabled',
                    closed_at: null
                });
            });

            const result = await BreakGlassService.closeSession('session-1', 'user-1', 'SUPERADMIN');

            expect(result.id).toBe('session-1');
            expect(result.closedAt).toBeDefined();
            expect(result.closedBy).toBe('user-1');
        });
    });

    describe('isBreakGlassActive', () => {
        it('should return false when no active session', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            const result = await BreakGlassService.isBreakGlassActive('org-1', 'policy_engine_disabled');
            expect(result).toBe(false);
        });

        it('should return true when active session exists', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { id: 'session-1', scope: 'policy_engine_disabled' });
            });

            const result = await BreakGlassService.isBreakGlassActive('org-1', 'policy_engine_disabled');
            expect(result).toBe(true);
        });
    });

    describe('getActiveSessions', () => {
        it('should return empty array when no sessions', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));

            const result = await BreakGlassService.getActiveSessions('org-1');
            expect(result).toEqual([]);
        });

        it('should return active sessions', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, [{
                    id: 'session-1',
                    organization_id: 'org-1',
                    actor_id: 'user-1',
                    reason: 'Test',
                    scope: 'emergency_access',
                    expires_at: new Date(Date.now() + 3600000).toISOString(),
                    created_at: new Date().toISOString()
                }]);
            });

            const result = await BreakGlassService.getActiveSessions('org-1');
            expect(result).toHaveLength(1);
            expect(result[0].scope).toBe('emergency_access');
        });
    });
});
