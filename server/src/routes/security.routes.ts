/**
 * Security Routes
 *
 * DB-backed minimal endpoints to keep Security UI functional.
 */

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { normalizeOrganizationRole } from '../services/organizationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import rolesRoutes from './security/roles.routes.js';

const router = Router();

function parseSecurityJson(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function requireOrgAdmin(req: AuthRequest) {
  const orgId = req.user!.organizationId;
  const membership = await dbGet<{ role?: string }>(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
    [orgId, req.user!.id],
    { fallback: true }
  );
  const actorRole = normalizeOrganizationRole(membership?.role || req.user?.role);
  if (!['OWNER', 'ADMIN'].includes(actorRole)) {
    const guidance =
      actorRole === 'GUEST'
        ? 'Guests cannot access admin tools.'
        : 'You need admin access. Ask your workspace admin.';
    return { error: 'Admin access required', code: 'ADMIN_ACCESS_REQUIRED', guidance };
  }

  return null;
}

// ==========================================
// SECURITY SETTINGS (ORG)
// ==========================================

router.get(
  '/settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const denial = await requireOrgAdmin(req);
    if (denial) return res.status(403).json(denial);
    const organization = await dbGet<any>(
      `SELECT mfa_required, mfa_grace_period_days FROM organizations WHERE id = ?`,
      [orgId]
    );
    const row = await dbGet<any>(
      `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'security'`,
      [orgId]
    );
    const settings = parseSecurityJson(row?.setting_value);

    return res.json({
      organizationId: orgId,
      require2fa: !!organization?.mfa_required,
      passwordMinLength: settings.passwordMinLength ?? 12,
      passwordRequireUppercase: settings.passwordRequireUppercase ?? true,
      passwordRequireNumber: settings.passwordRequireNumber ?? true,
      passwordRequireSpecial: settings.passwordRequireSpecial ?? false,
      passwordExpiryDays: settings.passwordExpiryDays ?? 0,
      sessionTimeoutMinutes: settings.sessionTimeout ?? 60,
      maxSessionsPerUser: settings.maxSessionsPerUser ?? 5,
      ipWhitelist: Array.isArray(settings.ipWhitelist) ? settings.ipWhitelist : [],
      updatedAt: row?.updated_at || null,
    });
  })
);

router.put(
  '/settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body || {};
    const denial = await requireOrgAdmin(req);
    if (denial) return res.status(403).json(denial);

    await dbRun(`UPDATE organizations SET mfa_required = ? WHERE id = ?`, [
      body.require2fa ? 1 : 0,
      orgId,
    ]);
    await dbRun(
      `INSERT OR REPLACE INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
       VALUES (?, 'security', ?, datetime('now'))`,
      [
        orgId,
        JSON.stringify({
          passwordPolicy: body.passwordPolicy || 'standard',
          passwordMinLength: body.passwordMinLength ?? 12,
          passwordRequireUppercase: body.passwordRequireUppercase ?? true,
          passwordRequireNumber: body.passwordRequireNumber ?? true,
          passwordRequireSpecial: body.passwordRequireSpecial ?? false,
          passwordExpiryDays: body.passwordExpiryDays ?? 0,
          sessionTimeout: body.sessionTimeoutMinutes ?? 60,
          maxSessionsPerUser: body.maxSessionsPerUser ?? 5,
          ipWhitelist: body.ipWhitelist || [],
        }),
      ]
    );

    return res.json({ success: true });
  })
);

// ==========================================
// SESSIONS
// ==========================================

router.get(
  '/sessions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const rows = await dbAll(
      `SELECT s.*, u.email as user_email, u.first_name, u.last_name
               FROM user_sessions s
               JOIN users u ON u.id = s.user_id
               WHERE u.organization_id = ? AND s.user_id = ?
               ORDER BY s.created_at DESC
               LIMIT 50`,
      [orgId, userId]
    );

    const sessions = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      userName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      deviceInfo: r.device_info || 'unknown',
      ipAddress: r.ip_address || 'unknown',
      userAgent: r.user_agent || 'unknown',
      location: r.location || 'unknown',
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      expiresAt: r.expires_at,
      isCurrent: !!r.is_current,
    }));

    return res.json({ sessions });
  })
);

router.get(
  '/sessions/all',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const denial = await requireOrgAdmin(req);
    if (denial) return res.status(403).json(denial);
    const rows = await dbAll(
      `SELECT s.*, u.email as user_email, u.first_name, u.last_name
               FROM user_sessions s
               JOIN users u ON u.id = s.user_id
               WHERE u.organization_id = ?
               ORDER BY s.created_at DESC
               LIMIT 200`,
      [orgId]
    );

    const sessions = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      userName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      deviceInfo: r.device_info || 'unknown',
      ipAddress: r.ip_address || 'unknown',
      userAgent: r.user_agent || 'unknown',
      location: r.location || 'unknown',
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      expiresAt: r.expires_at,
      isCurrent: !!r.is_current,
    }));

    return res.json({ sessions });
  })
);

router.delete(
  '/sessions/:sessionId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const { sessionId } = req.params;
    const orgId = req.user!.organizationId;
    const session = await dbGet<{ user_id: string }>(
      `SELECT s.user_id
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND u.organization_id = ?
        LIMIT 1`,
      [sessionId, orgId],
      { fallback: false }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.user_id !== req.user!.id) {
      const denial = await requireOrgAdmin(req);
      if (denial) return res.status(403).json(denial);
    }

    await dbRun(
      `DELETE FROM user_sessions
        WHERE id = ?
          AND EXISTS (
            SELECT 1 FROM users u
             WHERE u.id = user_sessions.user_id AND u.organization_id = ?
          )`,
      [sessionId, orgId]
    );
    return res.json({ success: true });
  })
);

router.delete(
  '/sessions/user/:userId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;
    const denial = await requireOrgAdmin(req);
    if (denial) return res.status(403).json(denial);

    const user = await dbGet<{ id: string }>(
      `SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId],
      { fallback: false }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    await dbRun(
      `DELETE FROM user_sessions
        WHERE user_id = ?
          AND EXISTS (
            SELECT 1 FROM users u WHERE u.id = user_sessions.user_id AND u.organization_id = ?
          )`,
      [userId, orgId]
    );
    return res.json({ success: true });
  })
);

// ==========================================
// LOGIN HISTORY
// ==========================================

router.get(
  '/login-history',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const rows = await dbAll(
      `SELECT lh.*, u.email as user_email, u.first_name, u.last_name
               FROM login_history lh
               JOIN users u ON u.id = lh.user_id
               WHERE lh.organization_id = ?
               ORDER BY lh.created_at DESC
               LIMIT ?`,
      [orgId, limit]
    );

    const history = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      userName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      ipAddress: r.ip_address || 'unknown',
      userAgent: r.user_agent || 'unknown',
      location: r.location || 'unknown',
      status: r.status === 'failed' ? 'failed' : 'success',
      failureReason: r.failure_reason || undefined,
      createdAt: r.created_at,
    }));

    return res.json({ history });
  })
);

// ==========================================
// 2FA STATUS
// ==========================================

router.get(
  '/2fa/org-status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const rows = await dbAll(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, COALESCE(f.is_enabled, 0) as has2fa, f.enabled_at
               FROM users u
               LEFT JOIN user_2fa f ON f.user_id = u.id
               WHERE u.organization_id = ?`,
      [orgId]
    );

    const enabled = rows.filter((r: any) => r.has2fa).length;
    const total = rows.length;
    const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0;

    return res.json({
      summary: {
        total,
        enabled,
        disabled: total - enabled,
        percentage,
      },
      users: rows.map((r: any) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        role: r.role,
        has2fa: !!r.has2fa,
        enabledAt: r.enabled_at,
      })),
    });
  })
);

// Audit logs (activity_logs table fallback)
router.get(
  '/audit-logs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const denial = await requireOrgAdmin(req);
    if (denial) return res.status(403).json(denial);
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const rows = await dbAll(
        `
              SELECT al.*, u.email as user_email
              FROM activity_logs al
              LEFT JOIN users u ON u.id = al.user_id
              WHERE al.organization_id = ?
              ORDER BY al.created_at DESC
              LIMIT 200
          `,
        [orgId]
      );

      const logs = rows.map((r: any) => ({
        id: r.id,
        admin: r.user_email || r.user_id || 'system',
        action: r.action,
        resource: r.entity_type || r.entity_id,
        risk: 'low',
        status: 'logged',
        ip_address: r.ip_address || 'unknown',
        time: r.created_at,
      }));

      return res.json({
        logs,
        stats: { total: logs.length, high: 0, medium: 0, low: logs.length, unresolved: 0 },
      });
    } catch (err) {
      logger.error('[Security] audit-logs fallback', err);
      return res.json({ logs: [], stats: { total: 0, high: 0, medium: 0, low: 0, unresolved: 0 } });
    }
  })
);

// API keys usage analytics placeholder
router.get(
  '/api-keys/usage',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const denial = await requireOrgAdmin(req);
    if (denial) return res.status(403).json(denial);
    try {
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const rows = await dbAll(
        `
              SELECT api_key_id, COUNT(*) as total_calls, SUM(tokens_used) as tokens, SUM(cost) as cost
              FROM api_logs
              WHERE organization_id = ?
              GROUP BY api_key_id
              ORDER BY total_calls DESC
              LIMIT 50
          `,
        [orgId]
      );
      return res.json({ usage: rows });
    } catch (err) {
      logger.error('[Security] api-keys/usage fallback', err);
      return res.json({ usage: [] });
    }
  })
);

// Workflows & approval requests (sample)
router.get(
  '/workflows',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      workflows: [
        {
          id: 'wf-1',
          name: 'API Key Approval',
          resourceType: 'api_key',
          approvers: ['security@demo.com'],
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ],
      requests: [],
    });
  })
);

router.get(
  '/workflows/requests',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      requests: [
        {
          id: 'req-1',
          workflowId: 'wf-1',
          requester: 'dev@demo.com',
          resource: 'api_key:create',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ],
    });
  })
);

// Incidents / Threats / DLP / AI Budgets (sample)
router.get(
  '/incidents',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      incidents: [
        {
          id: 'inc-1',
          type: 'login_anomaly',
          severity: 'medium',
          status: 'open',
          created_at: new Date().toISOString(),
        },
      ],
    });
  })
);

router.get(
  '/threats',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      threats: [
        {
          id: 'thr-1',
          name: 'Brute force login pattern',
          severity: 'high',
          status: 'observing',
          detected_at: new Date().toISOString(),
        },
      ],
    });
  })
);

router.get(
  '/dlp',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      alerts: [
        {
          id: 'dlp-1',
          rule: 'PII export',
          status: 'open',
          created_at: new Date().toISOString(),
        },
      ],
    });
  })
);

router.get(
  '/ai-budgets',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      overview: { spending: 0, tokensUsed: 0, activeAlerts: 0, activeBudgets: 0 },
      budgets: [
        {
          id: 'budget-1',
          name: 'AI Prod Team',
          limit: 500,
          spent: 120,
          tokensUsed: 200000,
          status: 'active',
        },
      ],
      pricing: [
        { model: 'gpt-4o', pricePer1kTokens: 0.03 },
        { model: 'gemini-1.5-pro', pricePer1kTokens: 0.01 },
      ],
    });
  })
);

// Permissions definitions (sample)
router.get(
  '/permissions/definitions',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({
      permissions: [
        { id: 'read:users', name: 'Read Users', severity: 'low' },
        { id: 'write:users', name: 'Manage Users', severity: 'medium' },
        { id: 'admin:settings', name: 'Admin Settings', severity: 'high' },
        { id: 'admin:billing', name: 'Billing Admin', severity: 'critical' },
      ],
    });
  })
);

// Roles (custom) — DB-backed (security integrity gate)
// Extracted into `./security/roles.routes.ts` for focused testing/coverage.
router.use('/roles', rolesRoutes);

export default router;
