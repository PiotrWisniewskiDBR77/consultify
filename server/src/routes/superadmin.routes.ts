/**
 * Super Admin Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All super admin API endpoints (requires SUPERADMIN role)
 *
 * Note: This route file uses wrappers to the existing JS controller
 * for backward compatibility during migration. Full TypeScript migration
 * of the controller logic will be done in subsequent stages.
 */

import { Response, Router } from 'express';

import SuperAdminController from '../controllers/SuperAdminController.js';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import {
    CreateAccessCodeSchema,
    CreateUserAdminSchema,
    ImpersonateUserSchema,
    UpdateOrganizationAdminSchema,
    UpdateUserAdminSchema,
} from '../validators/admin.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);
// Note: SuperAdminController is imported as SuperAdminController above
// Legacy require removed - using SuperAdminController import instead

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// ==========================================
// ORGANIZATIONS
// ==========================================

router.get('/organizations', SuperAdminController.getOrganizations);
router.get('/activities', SuperAdminController.getActivities);
router.get('/activities/stats', SuperAdminController.getActivities);
router.get('/dashboard', SuperAdminController.getDashboardStats);
router.put('/organizations/:id', validateBody(UpdateOrganizationAdminSchema), SuperAdminController.updateOrganization);
router.delete('/organizations/:id', SuperAdminController.deleteOrganization);
router.get('/organizations/:id/billing', SuperAdminController.getOrgBilling);

// ==========================================
// USERS
// ==========================================

router.get('/users', SuperAdminController.getUsers);
router.put('/users/:id', validateBody(UpdateUserAdminSchema), SuperAdminController.updateUser);
router.post('/users', validateBody(CreateUserAdminSchema), SuperAdminController.createUser);
router.post(
    '/users/invite',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.inviteUser(req, res, next);
    }),
);
router.post(
    '/users/:id/reset-password',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.resetUserPassword(req, res, next);
    }),
);

// ==========================================
// ACCESS REQUESTS
// ==========================================

router.get(
    '/access-requests',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getAccessRequests(req, res, next);
    }),
);
router.post(
    '/access-requests/:id/approve',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.approveAccessRequest(req, res, next);
    }),
);
router.post(
    '/access-requests/:id/reject',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.rejectAccessRequest(req, res, next);
    }),
);

// ==========================================
// ACCESS CODES
// ==========================================

router.get(
    '/access-codes',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getAccessCodes(req, res, next);
    }),
);
router.post(
    '/access-codes',
    validateBody(CreateAccessCodeSchema),
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createAccessCode(req, res, next);
    }),
);

// ==========================================
// IMPERSONATION
// ==========================================

router.post('/impersonate', validateBody(ImpersonateUserSchema), SuperAdminController.impersonateUser);

// ==========================================
// DATABASE EXPLORER
// ==========================================

router.get(
    '/database/tables',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getDatabaseTables(req, res, next);
    }),
);
router.get(
    '/database/rows/:tableName',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getDatabaseRows(req, res, next);
    }),
);

// ==========================================
// STORAGE
// ==========================================

router.get(
    '/storage/usage',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getStorageUsage(req, res, next);
    }),
);
router.get(
    '/storage/files/:orgId',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getStorageFiles(req, res, next);
    }),
);
router.delete(
    '/storage/files',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.deleteStorageFile(req, res, next);
    }),
);

// ==========================================
// LEGAL DOCUMENT MANAGEMENT
// ==========================================

router.get(
    '/legal/all',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getAllLegalDocs(req, res, next);
    }),
);
router.post(
    '/legal/publish',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.publishLegalDoc(req, res, next);
    }),
);
router.put(
    '/legal/:id/toggle-active',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.toggleLegalDocActive(req, res, next);
    }),
);
router.get(
    '/legal/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getLegalDocById(req, res, next);
    }),
);

// ==========================================
// LEGAL EVENTS AUDIT LOG
// ==========================================

router.get(
    '/legal-events',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getLegalEvents(req, res, next);
    }),
);
router.get(
    '/legal-events/stats',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getLegalEventStats(req, res, next);
    }),
);

// ==========================================
// ATTRIBUTION SYSTEM
// ==========================================

router.get(
    '/organizations/:id/attribution',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getOrgAttribution(req, res, next);
    }),
);
router.get(
    '/attribution/export',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.exportAttribution(req, res, next);
    }),
);
router.get(
    '/attribution/partner-summary',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getPartnerSummary(req, res, next);
    }),
);

// ==========================================
// USAGE STATS BY ORGANIZATION
// ==========================================

router.get(
    '/usage/by-organization',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUsageByOrganization(req, res, next);
    }),
);

// ==========================================
// INVOICES
// ==========================================

router.get(
    '/invoices',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getInvoices(req, res, next);
    }),
);
router.get(
    '/invoices/stats',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getInvoiceStats(req, res, next);
    }),
);
router.post(
    '/invoices/:id/remind',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.remindInvoice(req, res, next);
    }),
);
router.post(
    '/invoices/:id/mark-paid',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.markInvoicePaid(req, res, next);
    }),
);
router.get(
    '/invoices/:id/pdf',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getInvoicePdf(req, res, next);
    }),
);

// ==========================================
// BRANDING
// ==========================================

router.post(
    '/branding/:orgId/logo',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.uploadBrandingLogo(req, res, next);
    }),
);

// ==========================================
// API KEYS
// ==========================================

router.get(
    '/api-keys',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getApiKeys(req, res, next);
    }),
);
router.post(
    '/api-keys',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createApiKey(req, res, next);
    }),
);
router.delete(
    '/api-keys/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.deleteApiKey(req, res, next);
    }),
);
router.get(
    '/api-keys/:id/usage',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getApiKeyUsage(req, res, next);
    }),
);

// ==========================================
// COMPLIANCE
// ==========================================

router.get(
    '/compliance/frameworks',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getComplianceFrameworks(req, res, next);
    }),
);
router.get(
    '/compliance/status/:frameworkId',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getComplianceStatus(req, res, next);
    }),
);
router.get(
    '/compliance/dsar',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getDsarRequests(req, res, next);
    }),
);
router.get(
    '/compliance/audits',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getComplianceAudits(req, res, next);
    }),
);

// ==========================================
// SYSTEM HEALTH
// ==========================================

router.get('/system-health', SuperAdminController.getSystemHealth);

// ==========================================
// ADMIN IAM MODULE
// ==========================================

console.log('[SuperAdminRoutes] SuperAdminController keys:', Object.keys(SuperAdminController || {}));

router.get('/admin/sessions', SuperAdminController.getAdminSessions);
router.post('/admin/sessions', SuperAdminController.createAdminSession);
router.delete('/admin/sessions/:id', SuperAdminController.revokeAdminSession);
router.get('/admin/sessions/stats', SuperAdminController.getAdminSessionStats);

/**
 * GET /api/superadmin/platform-stats
 * Comprehensive platform statistics for SuperAdmin dashboard header
 * Returns grouped data for: Infrastructure, Users, Business, Security, Performance
 */
router.get(
    '/platform-stats',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        const safeQuery = async <T>(query: string, defaultValue: T): Promise<T> => {
            try {
                const result = await dbGet<T>(query);
                return result || defaultValue;
            } catch {
                return defaultValue;
            }
        };

        const safeQueryAll = async <T>(query: string): Promise<T[]> => {
            try {
                const result = await dbAll<T>(query);
                return result || [];
            } catch {
                return [];
            }
        };

        try {
            // ==================== INFRASTRUCTURE ====================
            const dbSize = await safeQuery<{ size: number }>(
                `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`,
                { size: 0 }
            );

            // ==================== USERS ====================
            const activeUsers = await safeQuery<{ count: number }>(`
                SELECT COUNT(DISTINCT user_id) as count 
                FROM refresh_tokens 
                WHERE revoked_at IS NULL 
                AND expires_at > datetime('now')
                AND (last_used_at IS NULL OR datetime(last_used_at) > datetime('now', '-30 minutes'))
            `, { count: 0 });

            const totalUsers = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM users WHERE is_active = 1`,
                { count: 0 }
            );

            const totalOrgs = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM organizations WHERE is_active = 1`,
                { count: 0 }
            );

            const todaySignups = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')`,
                { count: 0 }
            );

            const todayLogins = await safeQuery<{ count: number }>(
                `SELECT COUNT(DISTINCT user_id) as count FROM login_history WHERE date(created_at) = date('now') AND status = 'success'`,
                { count: 0 }
            );

            // Recent signups list
            const recentSignups = await safeQueryAll<{ email: string; created_at: string; org_name: string | null }>(`
                SELECT u.email, u.created_at, o.name as org_name
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                WHERE u.created_at > datetime('now', '-24 hours')
                ORDER BY u.created_at DESC
                LIMIT 10
            `);

            // ==================== BUSINESS ====================
            const trialsExpiringSoon = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM organizations WHERE trial_ends_at BETWEEN datetime('now') AND datetime('now', '+7 days')`,
                { count: 0 }
            );

            const trialsExpiringSoonList = await safeQueryAll<{ name: string; trial_ends_at: string }>(`
                SELECT name, trial_ends_at 
                FROM organizations 
                WHERE trial_ends_at BETWEEN datetime('now') AND datetime('now', '+7 days')
                ORDER BY trial_ends_at ASC
                LIMIT 10
            `);

            const overdueInvoices = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status = 'pending' AND due_date < date('now'))`,
                { count: 0 }
            );

            const overdueInvoicesList = await safeQueryAll<{ org_name: string; amount: number; due_date: string }>(`
                SELECT o.name as org_name, i.amount, i.due_date
                FROM invoices i
                JOIN organizations o ON i.organization_id = o.id
                WHERE i.status = 'overdue' OR (i.status = 'pending' AND i.due_date < date('now'))
                ORDER BY i.due_date ASC
                LIMIT 10
            `);

            const pendingFeedback = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM feedback WHERE status = 'pending' OR status = 'new'`,
                { count: 0 }
            );

            const recentFeedback = await safeQueryAll<{ type: string; message: string; created_at: string; user_email: string | null }>(`
                SELECT f.type, substr(f.message, 1, 100) as message, f.created_at, u.email as user_email
                FROM feedback f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.status = 'pending' OR f.status = 'new'
                ORDER BY f.created_at DESC
                LIMIT 10
            `);

            // ==================== SECURITY ====================
            const failedLoginsLastHour = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM login_history WHERE status = 'failed' AND created_at > datetime('now', '-1 hour')`,
                { count: 0 }
            );

            const failedLoginsList = await safeQueryAll<{ email: string; ip_address: string; created_at: string; failure_reason: string | null }>(`
                SELECT lh.email, lh.ip_address, lh.created_at, lh.failure_reason
                FROM login_history lh
                WHERE lh.status = 'failed' AND lh.created_at > datetime('now', '-1 hour')
                ORDER BY lh.created_at DESC
                LIMIT 20
            `);

            const suspiciousActivity = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM login_history WHERE status = 'failed' AND created_at > datetime('now', '-1 hour') GROUP BY ip_address HAVING COUNT(*) > 5`,
                { count: 0 }
            );

            const apiErrorsLast15Min = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM api_logs WHERE status_code >= 500 AND created_at > datetime('now', '-15 minutes')`,
                { count: 0 }
            );

            const recentErrors = await safeQueryAll<{ endpoint: string; status_code: number; error_message: string | null; created_at: string }>(`
                SELECT endpoint, status_code, error_message, created_at
                FROM api_logs
                WHERE status_code >= 500 AND created_at > datetime('now', '-1 hour')
                ORDER BY created_at DESC
                LIMIT 20
            `);

            // ==================== PERFORMANCE ====================
            const avgApiLatency = await safeQuery<{ avg_latency: number }>(
                `SELECT AVG(response_time_ms) as avg_latency FROM api_logs WHERE created_at > datetime('now', '-15 minutes')`,
                { avg_latency: 0 }
            );

            const slowQueries = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM api_logs WHERE response_time_ms > 1000 AND created_at > datetime('now', '-1 hour')`,
                { count: 0 }
            );

            const slowQueriesList = await safeQueryAll<{ endpoint: string; response_time_ms: number; created_at: string }>(`
                SELECT endpoint, response_time_ms, created_at
                FROM api_logs
                WHERE response_time_ms > 1000 AND created_at > datetime('now', '-1 hour')
                ORDER BY response_time_ms DESC
                LIMIT 10
            `);

            const aiRequestsToday = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM llm_logs WHERE date(created_at) = date('now')`,
                { count: 0 }
            );

            const aiTokensToday = await safeQuery<{ total: number }>(
                `SELECT SUM(total_tokens) as total FROM llm_logs WHERE date(created_at) = date('now')`,
                { total: 0 }
            );

            const aiErrorsToday = await safeQuery<{ count: number }>(
                `SELECT COUNT(*) as count FROM llm_logs WHERE date(created_at) = date('now') AND error IS NOT NULL`,
                { count: 0 }
            );

            return res.json({
                timestamp: new Date().toISOString(),
                
                infrastructure: {
                    dbSizeMB: Math.round((dbSize.size || 0) / 1024 / 1024 * 10) / 10,
                },

                users: {
                    activeNow: activeUsers.count,
                    totalUsers: totalUsers.count,
                    totalOrgs: totalOrgs.count,
                    todaySignups: todaySignups.count,
                    todayLogins: todayLogins.count,
                    recentSignups,
                },

                business: {
                    trialsExpiring: trialsExpiringSoon.count,
                    trialsExpiringSoonList,
                    overdueInvoices: overdueInvoices.count,
                    overdueInvoicesList,
                    pendingFeedback: pendingFeedback.count,
                    recentFeedback,
                },

                security: {
                    failedLoginsLastHour: failedLoginsLastHour.count,
                    failedLoginsList,
                    suspiciousIPs: suspiciousActivity.count,
                    apiErrors15Min: apiErrorsLast15Min.count,
                    recentErrors,
                },

                performance: {
                    avgApiLatencyMs: Math.round(avgApiLatency.avg_latency || 0),
                    slowQueries: slowQueries.count,
                    slowQueriesList,
                    aiRequestsToday: aiRequestsToday.count,
                    aiTokensToday: aiTokensToday.total || 0,
                    aiErrorsToday: aiErrorsToday.count,
                },
            });
        } catch (error: any) {
            console.error('[SuperAdmin] Platform stats error:', error);
            return res.status(500).json({ error: error?.message });
        }
    }),
);

// Keep legacy endpoint for backward compatibility
router.get('/online-users', asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
        const activeUsers = await dbGet<{ count: number }>(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM refresh_tokens 
            WHERE revoked_at IS NULL AND expires_at > datetime('now')
        `);
        return res.json({ activeSessions: activeUsers?.count || 0, totalActive: activeUsers?.count || 0 });
    } catch {
        return res.json({ activeSessions: 0, totalActive: 0 });
    }
}));

router.get('/admin/audit-logs', SuperAdminController.getAdminAuditLogs);
router.get('/admin/audit-logs/stats', SuperAdminController.getAdminAuditStats);

router.get('/admin/permissions', SuperAdminController.getAdminPermissions);
router.get('/admin/permissions/matrix', SuperAdminController.getPermissionsMatrix);
router.post('/admin/permissions', SuperAdminController.createAdminPermission);

router.get('/admin/approval-workflows', SuperAdminController.getApprovalWorkflows);
router.post('/admin/approval-workflows', SuperAdminController.createApprovalWorkflow);
router.get('/admin/approval-requests', SuperAdminController.getApprovalRequests);

// ==========================================
// SIGNALS - System Alerts, Client Tickets, Feedback
// ==========================================

router.get(
    '/signals',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            // Import database utility
            const { all: dbAll } = await import('../utils/DbPromise.js');

            // Fetch all unread notifications of signal types
            const signals = await dbAll(`
                SELECT id, user_id, type, title, message, severity, created_at, is_read, data
                FROM notifications
                WHERE type IN ('SYSTEM_ALERT', 'CLIENT_TICKET', 'USER_FEEDBACK')
                AND is_read = 0
                ORDER BY 
                    CASE severity 
                        WHEN 'CRITICAL' THEN 1 
                        WHEN 'HIGH' THEN 2 
                        WHEN 'WARNING' THEN 3 
                        ELSE 4 
                    END,
                    created_at DESC
                LIMIT 100
            `);

            return res.json(signals || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching signals:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==========================================
// CUSTOMER LIFECYCLE MANAGEMENT
// ==========================================

// Get all lifecycle stages
router.get(
    '/lifecycle/stages',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const stages = await dbAll(`
                SELECT cls.*, 
                    (SELECT COUNT(*) FROM organizations o WHERE o.lifecycle_stage_id = cls.id) as organization_count
                FROM customer_lifecycle_stages cls
                WHERE cls.is_active = 1
                ORDER BY cls.order_index ASC
            `);
            return res.json(stages || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching lifecycle stages:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Create lifecycle stage
router.post(
    '/lifecycle/stages',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { name, description, orderIndex, color } = req.body;
            const id = `stage-${Date.now()}`;
            
            await dbRun(`
                INSERT INTO customer_lifecycle_stages (id, name, description, order_index, color)
                VALUES (?, ?, ?, ?, ?)
            `, [id, name, description || '', orderIndex || 0, color || '#3B82F6']);
            
            return res.json({ success: true, id });
        } catch (err: any) {
            console.error('[SuperAdmin] Error creating lifecycle stage:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Update lifecycle stage
router.put(
    '/lifecycle/stages/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { id } = req.params;
            const { name, description, orderIndex, color, isActive } = req.body;
            
            await dbRun(`
                UPDATE customer_lifecycle_stages 
                SET name = ?, description = ?, order_index = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [name, description || '', orderIndex || 0, color || '#3B82F6', isActive ? 1 : 0, id]);
            
            return res.json({ success: true });
        } catch (err: any) {
            console.error('[SuperAdmin] Error updating lifecycle stage:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Delete lifecycle stage
router.delete(
    '/lifecycle/stages/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { id } = req.params;
            
            await dbRun(`DELETE FROM customer_lifecycle_stages WHERE id = ?`, [id]);
            
            return res.json({ success: true });
        } catch (err: any) {
            console.error('[SuperAdmin] Error deleting lifecycle stage:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Get lifecycle transitions
router.get(
    '/lifecycle/transitions',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const transitions = await dbAll(`
                SELECT clt.*,
                    o.name as organization_name,
                    fs.name as from_stage_name,
                    ts.name as to_stage_name,
                    u.email as transitioned_by_email
                FROM customer_lifecycle_transitions clt
                LEFT JOIN organizations o ON clt.organization_id = o.id
                LEFT JOIN customer_lifecycle_stages fs ON clt.from_stage_id = fs.id
                LEFT JOIN customer_lifecycle_stages ts ON clt.to_stage_id = ts.id
                LEFT JOIN users u ON clt.transitioned_by = u.id
                ORDER BY clt.transitioned_at DESC
                LIMIT 50
            `);
            return res.json(transitions || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching lifecycle transitions:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Create lifecycle transition (move organization to new stage)
router.post(
    '/lifecycle/transitions',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { organizationId, fromStageId, toStageId, notes } = req.body;
            const userId = req.user?.id;
            const id = `trans-${Date.now()}`;
            
            // Insert transition record
            await dbRun(`
                INSERT INTO customer_lifecycle_transitions (id, organization_id, from_stage_id, to_stage_id, transitioned_by, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, organizationId, fromStageId || null, toStageId, userId, notes || '']);
            
            // Update organization's current stage
            await dbRun(`
                UPDATE organizations SET lifecycle_stage_id = ? WHERE id = ?
            `, [toStageId, organizationId]);
            
            return res.json({ success: true, id });
        } catch (err: any) {
            console.error('[SuperAdmin] Error creating lifecycle transition:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Get lifecycle stats
router.get(
    '/lifecycle/stats',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { all: dbAll, get: dbGet } = await import('../utils/DbPromise.js');
            
            const stageStats = await dbAll(`
                SELECT cls.id as stage_id, cls.name as stage_name, cls.color,
                    COUNT(o.id) as count
                FROM customer_lifecycle_stages cls
                LEFT JOIN organizations o ON o.lifecycle_stage_id = cls.id
                WHERE cls.is_active = 1
                GROUP BY cls.id
                ORDER BY cls.order_index
            `);
            
            const totalTransitions = await dbGet(`
                SELECT COUNT(*) as total FROM customer_lifecycle_transitions
            `) as { total: number };
            
            return res.json({
                stageStats: stageStats || [],
                totalTransitions: totalTransitions?.total || 0
            });
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching lifecycle stats:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==========================================
// CUSTOMER SUCCESS PLAYBOOKS
// ==========================================

// Get all playbooks
router.get(
    '/playbooks',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const playbooks = await dbAll(`
                SELECT * FROM customer_success_playbooks
                ORDER BY created_at DESC
            `);
            return res.json(playbooks || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching playbooks:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Get playbook actions
router.get(
    '/playbooks/actions',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const actions = await dbAll(`
                SELECT cpa.*,
                    csp.name as playbook_name,
                    o.name as organization_name
                FROM customer_playbook_actions cpa
                LEFT JOIN customer_success_playbooks csp ON cpa.playbook_id = csp.id
                LEFT JOIN organizations o ON cpa.organization_id = o.id
                ORDER BY cpa.created_at DESC
                LIMIT 100
            `);
            return res.json(actions || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching playbook actions:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Get playbook stats
router.get(
    '/playbooks/stats',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { get: dbGet } = await import('../utils/DbPromise.js');
            
            const stats = await dbGet(`
                SELECT 
                    (SELECT COUNT(*) FROM customer_success_playbooks) as total_playbooks,
                    (SELECT COUNT(*) FROM customer_success_playbooks WHERE is_active = 1) as active_playbooks,
                    (SELECT COUNT(*) FROM customer_playbook_actions) as total_actions,
                    (SELECT COUNT(*) FROM customer_playbook_actions WHERE status = 'completed') as completed_actions
            `) as any;
            
            return res.json(stats || { total_playbooks: 0, active_playbooks: 0, total_actions: 0, completed_actions: 0 });
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching playbook stats:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Create playbook
router.post(
    '/playbooks',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { name, description, triggerConditions, actions } = req.body;
            const id = `pb-${Date.now()}`;
            
            await dbRun(`
                INSERT INTO customer_success_playbooks (id, name, description, trigger_conditions_json, actions_json)
                VALUES (?, ?, ?, ?, ?)
            `, [id, name, description || '', JSON.stringify(triggerConditions || {}), JSON.stringify(actions || [])]);
            
            return res.json({ success: true, id });
        } catch (err: any) {
            console.error('[SuperAdmin] Error creating playbook:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Delete playbook
router.delete(
    '/playbooks/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { id } = req.params;
            
            await dbRun(`DELETE FROM customer_success_playbooks WHERE id = ?`, [id]);
            
            return res.json({ success: true });
        } catch (err: any) {
            console.error('[SuperAdmin] Error deleting playbook:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Execute playbook for organization
router.post(
    '/playbooks/:id/execute',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');
            const { id } = req.params;
            const { organizationId } = req.body;
            
            // Get playbook
            const playbook = await dbGet(`SELECT * FROM customer_success_playbooks WHERE id = ?`, [id]) as any;
            if (!playbook) {
                return res.status(404).json({ error: 'Playbook not found' });
            }
            
            // Parse actions and create action records
            const actions = JSON.parse(playbook.actions_json || '[]');
            for (const action of actions) {
                const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                await dbRun(`
                    INSERT INTO customer_playbook_actions (id, playbook_id, organization_id, action_type, action_config_json, status, executed_at)
                    VALUES (?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
                `, [actionId, id, organizationId, action.type, JSON.stringify(action.config || {})]);
            }
            
            return res.json({ success: true, actionsExecuted: actions.length });
        } catch (err: any) {
            console.error('[SuperAdmin] Error executing playbook:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==========================================
// CUSTOMER CONTRACTS
// ==========================================

// Get all contracts
router.get(
    '/contracts',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const { status } = req.query;
            
            let query = `
                SELECT cc.*, o.name as organization_name
                FROM customer_contracts cc
                LEFT JOIN organizations o ON cc.organization_id = o.id
            `;
            const params: any[] = [];
            
            if (status) {
                query += ` WHERE cc.status = ?`;
                params.push(status);
            }
            query += ` ORDER BY cc.created_at DESC`;
            
            const contracts = await dbAll(query, params);
            return res.json(contracts || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching contracts:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Get contract stats
router.get(
    '/contracts/stats',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { get: dbGet } = await import('../utils/DbPromise.js');
            
            const stats = await dbGet(`
                SELECT 
                    COUNT(*) as total_contracts,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
                    COALESCE(SUM(value), 0) as total_value,
                    (SELECT COUNT(*) FROM customer_contracts WHERE renewal_date BETWEEN date('now') AND date('now', '+30 days')) as renewals_30d
                FROM customer_contracts
            `) as any;
            
            return res.json(stats || { total_contracts: 0, active_contracts: 0, total_value: 0, renewals_30d: 0 });
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching contract stats:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Get upcoming renewals
router.get(
    '/contracts/renewals',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const days = parseInt(req.query.days as string) || 30;
            
            const renewals = await dbAll(`
                SELECT cc.id, o.name as organization_name, cc.renewal_date, cc.value,
                    CAST(julianday(cc.renewal_date) - julianday('now') AS INTEGER) as days_until
                FROM customer_contracts cc
                LEFT JOIN organizations o ON cc.organization_id = o.id
                WHERE cc.renewal_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
                AND cc.status = 'active'
                ORDER BY cc.renewal_date ASC
            `, [days]);
            
            return res.json(renewals || []);
        } catch (err: any) {
            console.error('[SuperAdmin] Error fetching renewals:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Create contract
router.post(
    '/contracts',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { organizationId, contractType, startDate, endDate, renewalDate, value, currency, terms, documentUrl } = req.body;
            const id = `contract-${Date.now()}`;
            
            await dbRun(`
                INSERT INTO customer_contracts (id, organization_id, contract_type, start_date, end_date, renewal_date, value, currency, terms_json, document_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, organizationId, contractType || 'subscription', startDate, endDate || null, renewalDate || null, value || 0, currency || 'USD', JSON.stringify(terms || {}), documentUrl || null]);
            
            return res.json({ success: true, id });
        } catch (err: any) {
            console.error('[SuperAdmin] Error creating contract:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// Delete contract
router.delete(
    '/contracts/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        try {
            const { run: dbRun } = await import('../utils/DbPromise.js');
            const { id } = req.params;
            
            await dbRun(`DELETE FROM customer_contracts WHERE id = ?`, [id]);
            
            return res.json({ success: true });
        } catch (err: any) {
            console.error('[SuperAdmin] Error deleting contract:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Organizations
// ==========================================

router.get(
    '/organizations/:id/metadata',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getOrganizationMetadata(req, res, next);
    }),
);
router.put(
    '/organizations/:id/metadata',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateOrganizationMetadata(req, res, next);
    }),
);
router.get(
    '/organizations/:id/tags',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getOrganizationTags(req, res, next);
    }),
);
router.post(
    '/organizations/:id/tags',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.addOrganizationTag(req, res, next);
    }),
);
router.delete(
    '/organizations/:id/tags/:tagId',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.removeOrganizationTag(req, res, next);
    }),
);
router.get(
    '/organizations/:id/health',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getOrganizationHealth(req, res, next);
    }),
);
router.get(
    '/organizations/:id/relationships',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getOrganizationRelationships(req, res, next);
    }),
);
router.get(
    '/organizations/:id/analytics',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getOrganizationAnalytics(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Users
// ==========================================

router.get(
    '/users/:id/profile-extended',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserProfileExtended(req, res, next);
    }),
);
router.put(
    '/users/:id/profile-extended',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateUserProfileExtended(req, res, next);
    }),
);
router.get(
    '/users/:id/activity',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserActivity(req, res, next);
    }),
);
router.get(
    '/users/:id/sessions',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserSessions(req, res, next);
    }),
);
router.delete(
    '/users/:id/sessions/:sessionId',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.revokeUserSession(req, res, next);
    }),
);
router.get(
    '/users/:id/groups',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserGroups(req, res, next);
    }),
);
router.get(
    '/users/:id/onboarding',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserOnboardingProgress(req, res, next);
    }),
);
router.put(
    '/users/:id/onboarding',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateUserOnboardingProgress(req, res, next);
    }),
);
router.get(
    '/users/:id/license',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserLicense(req, res, next);
    }),
);
router.put(
    '/users/:id/license',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.assignUserLicense(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Security
// ==========================================

router.get(
    '/organizations/:id/ip-whitelist',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getIPWhitelist(req, res, next);
    }),
);
router.post(
    '/organizations/:id/ip-whitelist',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.addIPWhitelist(req, res, next);
    }),
);
router.delete(
    '/ip-whitelist/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.removeIPWhitelist(req, res, next);
    }),
);
router.get(
    '/users/:id/devices',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserDevices(req, res, next);
    }),
);
router.post(
    '/devices/:id/block',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.blockDevice(req, res, next);
    }),
);
router.get(
    '/users/:id/mfa',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getMFAMethods(req, res, next);
    }),
);
router.post(
    '/users/:id/mfa/totp/setup',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.setupTOTP(req, res, next);
    }),
);
router.post(
    '/users/:id/mfa/totp/verify',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.verifyTOTP(req, res, next);
    }),
);
router.get(
    '/organizations/:id/password-policy',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getPasswordPolicy(req, res, next);
    }),
);
router.put(
    '/organizations/:id/password-policy',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updatePasswordPolicy(req, res, next);
    }),
);
router.get(
    '/security-events',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getSecurityEvents(req, res, next);
    }),
);
router.post(
    '/security-events/:id/resolve',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.resolveSecurityEvent(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Support
// ==========================================

router.get(
    '/support/tickets',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getSupportTickets(req, res, next);
    }),
);
router.post(
    '/support/tickets',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createSupportTicket(req, res, next);
    }),
);
router.put(
    '/support/tickets/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateSupportTicket(req, res, next);
    }),
);
router.post(
    '/support/tickets/:id/comments',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.addTicketComment(req, res, next);
    }),
);
router.get(
    '/organizations/:id/customer-success/notes',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getCustomerSuccessNotes(req, res, next);
    }),
);
router.post(
    '/organizations/:id/customer-success/notes',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createCustomerSuccessNote(req, res, next);
    }),
);
router.get(
    '/organizations/:id/customer-success/health',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getCustomerHealthCheck(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Feedback
// ==========================================

router.get(
    '/feedback',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getFeedbackItems(req, res, next);
    }),
);
router.post(
    '/feedback',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createFeedbackItem(req, res, next);
    }),
);
router.post(
    '/feedback/:id/vote',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.voteFeedback(req, res, next);
    }),
);
router.post(
    '/feedback/:id/comments',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.addFeedbackComment(req, res, next);
    }),
);
router.get(
    '/feature-roadmap',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getFeatureRoadmap(req, res, next);
    }),
);
router.put(
    '/feature-roadmap/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateFeatureRoadmap(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Analytics
// ==========================================

router.get(
    '/users/:id/adoption-metrics',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserAdoptionMetrics(req, res, next);
    }),
);
router.get(
    '/organizations/:id/churn-prediction',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getChurnPrediction(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Compliance
// ==========================================

router.get(
    '/compliance/retention-policies',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getDataRetentionPolicies(req, res, next);
    }),
);
router.post(
    '/compliance/retention-policies',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createDataRetentionPolicy(req, res, next);
    }),
);
router.get(
    '/compliance/gdpr-requests',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getGDPRRequests(req, res, next);
    }),
);
router.post(
    '/compliance/gdpr-requests',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createGDPRRequest(req, res, next);
    }),
);
router.get(
    '/users/:id/consents',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getUserConsents(req, res, next);
    }),
);
router.put(
    '/users/:id/consents',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateUserConsent(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Automation
// ==========================================

router.get(
    '/automation/rules',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getAutomationRules(req, res, next);
    }),
);
router.post(
    '/automation/rules',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createAutomationRule(req, res, next);
    }),
);
router.put(
    '/automation/rules/:id',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateAutomationRule(req, res, next);
    }),
);
router.get(
    '/webhooks',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getWebhookSubscriptions(req, res, next);
    }),
);
router.post(
    '/webhooks',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createWebhookSubscription(req, res, next);
    }),
);

// ==========================================
// ENTERPRISE CUSTOMERS MODULE - Communication
// ==========================================

router.get(
    '/email/templates',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getEmailTemplates(req, res, next);
    }),
);
router.post(
    '/email/templates',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createEmailTemplate(req, res, next);
    }),
);
router.get(
    '/email/campaigns',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getEmailCampaigns(req, res, next);
    }),
);
router.post(
    '/email/campaigns',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.createEmailCampaign(req, res, next);
    }),
);
router.get(
    '/users/:id/notification-preferences',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.getNotificationPreferences(req, res, next);
    }),
);
router.put(
    '/users/:id/notification-preferences',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.updateNotificationPreferences(req, res, next);
    }),
);

// ==========================================
// REFRESH TOKEN
// ==========================================

router.post(
    '/refresh-token',
    asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
        await SuperAdminController.refreshToken(req, res, next);
    }),
);

export default router;
