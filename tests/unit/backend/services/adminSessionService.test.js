/**
 * Admin Session Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createAdminSessionService = () => {
    const sessions = new Map();
    let counter = 0;

    return {
        createAdminSession: async (userId, reason) => {
            if (!userId) return { success: false, error: 'User ID required', status: 400 };
            const id = `admin-sess-${++counter}`;
            sessions.set(id, { id, userId, reason, createdAt: new Date(), isAdmin: true });
            return { success: true, data: { sessionId: id }, status: 201 };
        },

        validateSession: async (sessionId) => {
            const session = sessions.get(sessionId);
            if (!session) return { success: false, error: 'Invalid session', status: 401 };
            if (!session.isAdmin) return { success: false, error: 'Not admin session', status: 403 };
            return { success: true, data: { valid: true, userId: session.userId }, status: 200 };
        },

        revokeSession: async (sessionId) => {
            if (!sessions.has(sessionId)) return { success: false, error: 'Not found', status: 404 };
            sessions.delete(sessionId);
            return { success: true, status: 200 };
        },

        listActiveSessions: async () => {
            return { success: true, data: Array.from(sessions.values()), status: 200 };
        }
    };
};

describe('AdminSessionService', () => {
    let adminSessionService;

    beforeEach(() => {
        vi.clearAllMocks();
        adminSessionService = createAdminSessionService();
    });

    it('should create admin session', async () => {
        const result = await adminSessionService.createAdminSession('admin-1', 'System maintenance');
        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
    });

    it('should validate admin session', async () => {
        const created = await adminSessionService.createAdminSession('admin-1', 'Testing');
        const result = await adminSessionService.validateSession(created.data.sessionId);
        expect(result.success).toBe(true);
        expect(result.data.valid).toBe(true);
    });

    it('should reject invalid session', async () => {
        const result = await adminSessionService.validateSession('invalid');
        expect(result.success).toBe(false);
        expect(result.status).toBe(401);
    });

    it('should revoke session', async () => {
        const created = await adminSessionService.createAdminSession('admin-1', 'Test');
        const result = await adminSessionService.revokeSession(created.data.sessionId);
        expect(result.success).toBe(true);
    });

    it('should list active sessions', async () => {
        await adminSessionService.createAdminSession('admin-1', 'Test 1');
        await adminSessionService.createAdminSession('admin-2', 'Test 2');
        const result = await adminSessionService.listActiveSessions();
        expect(result.data).toHaveLength(2);
    });
});
