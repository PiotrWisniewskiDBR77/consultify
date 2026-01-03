/**
 * Unit Tests for Admin Session Service
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

// Import and inject mocks
const adminSessionService = require('../../../../server/services/adminSessionService');
adminSessionService.setDependencies({ db: mockDb });

describe('AdminSessionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createSession', () => {
        it('should create a new session successfully', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const session = await adminSessionService.createSession({
                adminId: 'admin-123',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                mfaVerified: true,
                expiresInHours: 24
            });

            expect(session).toBeDefined();
            expect(session.adminId).toBe('admin-123');
            expect(session.ipAddress).toBe('192.168.1.1');
            expect(session.mfaVerified).toBe(true);
            expect(session.sessionToken).toBeDefined();
            expect(session.sessionToken.length).toBe(64); // 32 bytes = 64 hex chars
        });

        it('should default mfaVerified to false', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const session = await adminSessionService.createSession({
                adminId: 'admin-123',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0'
            });

            expect(session.mfaVerified).toBe(false);
        });
    });

    describe('getSession', () => {
        it('should return session when found', async () => {
            mockDb.get.mockResolvedValueOnce({
                id: 'session-123',
                admin_id: 'admin-123',
                session_token: 'token123',
                ip_address: '192.168.1.1',
                user_agent: 'Mozilla/5.0',
                mfa_verified: 1,
                created_at: '2025-01-01T00:00:00Z',
                expires_at: '2025-01-02T00:00:00Z',
                is_active: 1,
                admin_email: 'admin@test.com',
                first_name: 'Test',
                last_name: 'Admin'
            });

            const session = await adminSessionService.getSession('token123');

            expect(session).toBeDefined();
            expect(session.adminId).toBe('admin-123');
            expect(session.mfaVerified).toBe(true);
            expect(session.isActive).toBe(true);
            expect(session.admin.email).toBe('admin@test.com');
        });

        it('should return null when session not found', async () => {
            mockDb.get.mockResolvedValueOnce(null);

            const session = await adminSessionService.getSession('invalid-token');

            expect(session).toBeNull();
        });
    });

    describe('verifySession', () => {
        it('should return valid for active non-expired session', async () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            mockDb.get.mockResolvedValueOnce({
                id: 'session-123',
                admin_id: 'admin-123',
                session_token: 'token123',
                is_active: 1,
                expires_at: futureDate
            });

            const result = await adminSessionService.verifySession('token123');

            expect(result.valid).toBe(true);
            expect(result.session).toBeDefined();
        });

        it('should return invalid for revoked session', async () => {
            mockDb.get.mockResolvedValueOnce({
                id: 'session-123',
                admin_id: 'admin-123',
                session_token: 'token123',
                is_active: 0,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });

            const result = await adminSessionService.verifySession('token123');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Session has been revoked');
        });

        it('should return invalid for expired session', async () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            mockDb.get.mockResolvedValueOnce({
                id: 'session-123',
                admin_id: 'admin-123',
                session_token: 'token123',
                is_active: 1,
                expires_at: pastDate
            });
            mockDb.run.mockResolvedValueOnce({ changes: 1 }); // For auto-deactivation

            const result = await adminSessionService.verifySession('token123');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Session has expired');
        });
    });

    describe('revokeSession', () => {
        it('should revoke session successfully', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const result = await adminSessionService.revokeSession('session-123');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE admin_sessions SET is_active = 0'),
                ['session-123']
            );
        });

        it('should return false if session not found', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 0 });

            const result = await adminSessionService.revokeSession('invalid-id');

            expect(result).toBe(false);
        });
    });

    describe('getActiveSessions', () => {
        it('should return all active sessions', async () => {
            mockDb.all.mockResolvedValueOnce([
                {
                    id: 'session-1',
                    admin_id: 'admin-1',
                    is_active: 1,
                    mfa_verified: 1,
                    admin_email: 'admin1@test.com',
                    first_name: 'Admin',
                    last_name: 'One'
                },
                {
                    id: 'session-2',
                    admin_id: 'admin-2',
                    is_active: 1,
                    mfa_verified: 0,
                    admin_email: 'admin2@test.com',
                    first_name: 'Admin',
                    last_name: 'Two'
                }
            ]);

            const sessions = await adminSessionService.getActiveSessions();

            expect(sessions).toHaveLength(2);
            expect(sessions[0].mfaVerified).toBe(true);
            expect(sessions[1].mfaVerified).toBe(false);
        });

        it('should filter by adminId when provided', async () => {
            mockDb.all.mockResolvedValueOnce([
                {
                    id: 'session-1',
                    admin_id: 'admin-1',
                    is_active: 1,
                    mfa_verified: 1,
                    admin_email: 'admin1@test.com',
                    first_name: 'Admin',
                    last_name: 'One'
                }
            ]);

            await adminSessionService.getActiveSessions('admin-1');

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('AND s.admin_id = ?'),
                ['admin-1']
            );
        });
    });

    describe('revokeAllSessions', () => {
        it('should revoke all sessions for admin', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 3 });

            const count = await adminSessionService.revokeAllSessions('admin-123');

            expect(count).toBe(3);
        });

        it('should exclude current session when specified', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 2 });

            await adminSessionService.revokeAllSessions('admin-123', 'current-session-id');

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('AND id != ?'),
                ['admin-123', 'current-session-id']
            );
        });
    });

    describe('getSessionStats', () => {
        it('should return session statistics', async () => {
            mockDb.get.mockResolvedValueOnce({
                total_sessions: 10,
                active_sessions: 5,
                mfa_verified_sessions: 3,
                unique_admins: 4
            });

            const stats = await adminSessionService.getSessionStats();

            expect(stats.totalSessions).toBe(10);
            expect(stats.activeSessions).toBe(5);
            expect(stats.mfaVerifiedSessions).toBe(3);
            expect(stats.uniqueAdmins).toBe(4);
        });
    });

    describe('cleanupExpiredSessions', () => {
        it('should delete expired sessions', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 5 });

            const count = await adminSessionService.cleanupExpiredSessions();

            expect(count).toBe(5);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM admin_sessions WHERE expires_at < datetime')
            );
        });
    });

    describe('updateMfaStatus', () => {
        it('should update MFA status', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const result = await adminSessionService.updateMfaStatus('session-123', true);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE admin_sessions SET mfa_verified = ?'),
                [1, 'session-123']
            );
        });
    });
});




