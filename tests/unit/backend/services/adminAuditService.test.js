/**
 * Admin Audit Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createAdminAuditService = () => {
    const auditLogs = [];

    return {
        logAction: async (data) => {
            if (!data.action || !data.adminId) return { success: false, error: 'Action and adminId required', status: 400 };
            const log = { id: `audit-${Date.now()}`, ...data, timestamp: new Date() };
            auditLogs.push(log);
            return { success: true, data: log, status: 201 };
        },

        getAuditLogs: async (filters = {}) => {
            let result = auditLogs;
            if (filters.adminId) result = result.filter(l => l.adminId === filters.adminId);
            if (filters.action) result = result.filter(l => l.action === filters.action);
            return { success: true, data: result, status: 200 };
        },

        getAdminActivity: async (adminId, limit = 10) => {
            const activity = auditLogs.filter(l => l.adminId === adminId).slice(-limit);
            return { success: true, data: activity, status: 200 };
        }
    };
};

describe('AdminAuditService', () => {
    let auditService;

    beforeEach(() => {
        vi.clearAllMocks();
        auditService = createAdminAuditService();
    });

    it('should log admin action', async () => {
        const result = await auditService.logAction({ action: 'user_delete', adminId: 'admin-1', target: 'user-123' });
        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
    });

    it('should get audit logs with filters', async () => {
        await auditService.logAction({ action: 'user_delete', adminId: 'admin-1' });
        await auditService.logAction({ action: 'role_change', adminId: 'admin-2' });
        const result = await auditService.getAuditLogs({ adminId: 'admin-1' });
        expect(result.data).toHaveLength(1);
    });

    it('should get admin activity', async () => {
        await auditService.logAction({ action: 'login', adminId: 'admin-1' });
        await auditService.logAction({ action: 'config_change', adminId: 'admin-1' });
        const result = await auditService.getAdminActivity('admin-1');
        expect(result.data).toHaveLength(2);
    });

    it('should reject without required fields', async () => {
        const result = await auditService.logAction({});
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
    });
});
