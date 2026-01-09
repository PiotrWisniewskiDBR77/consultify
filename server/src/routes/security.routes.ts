/**
 * Security Routes (Mock)
 * Minimal responses to keep Security UI functional.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Admin sessions (from refresh_tokens if available)
router.get(
    '/admin-sessions',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const rows =
                (await dbAll(
                    `
                SELECT rt.id, rt.user_id, u.email as user_email, rt.created_at, rt.expires_at, rt.ip_address, rt.user_agent
                FROM refresh_tokens rt
                LEFT JOIN users u ON u.id = rt.user_id
                WHERE rt.revoked_at IS NULL
                ORDER BY rt.created_at DESC
                LIMIT 50
            `,
                    [],
                )) || [];

            const sessions = rows.map((r: any) => ({
                id: r.id,
                admin: r.user_email || r.user_id,
                device: r.user_agent || 'unknown',
                ip: r.ip_address || 'unknown',
                mfa: true,
                created_at: r.created_at,
                expires_at: r.expires_at,
            }));

            return res.json({ sessions });
        } catch (err) {
            console.error('[Security] admin-sessions fallback', err);
            return res.json({ sessions: [] });
        }
    }),
);

// Audit logs (activity_logs table fallback)
router.get(
    '/audit-logs',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const rows =
                (await dbAll(
                    `
                SELECT al.*, u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON u.id = al.user_id
                ORDER BY al.created_at DESC
                LIMIT 200
            `,
                    [],
                )) || [];

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
            console.error('[Security] audit-logs fallback', err);
            return res.json({ logs: [], stats: { total: 0, high: 0, medium: 0, low: 0, unresolved: 0 } });
        }
    }),
);

// API keys usage analytics placeholder
router.get(
    '/api-keys/usage',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        try {
            const { all: dbAll } = await import('../utils/DbPromise.js');
            const rows =
                (await dbAll(
                    `
                SELECT api_key_id, COUNT(*) as total_calls, SUM(tokens_used) as tokens, SUM(cost) as cost
                FROM api_logs
                GROUP BY api_key_id
                ORDER BY total_calls DESC
                LIMIT 50
            `,
                    [],
                )) || [];
            return res.json({ usage: rows });
        } catch (err) {
            console.error('[Security] api-keys/usage fallback', err);
            return res.json({ usage: [] });
        }
    }),
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
    }),
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
    }),
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
    }),
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
    }),
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
    }),
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
    }),
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
    }),
);

// Roles (custom)
const roles: any[] = [];

router.get(
    '/roles',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        return res.json({ roles });
    }),
);

router.post(
    '/roles',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const id = uuidv4();
        roles.push({ id, ...req.body, created_at: new Date().toISOString() });
        return res.json({ success: true, id });
    }),
);

router.put(
    '/roles/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { id } = req.params;
        const idx = roles.findIndex((r) => r.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Role not found' });
        roles[idx] = { ...roles[idx], ...req.body };
        return res.json({ success: true });
    }),
);

router.delete(
    '/roles/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { id } = req.params;
        const idx = roles.findIndex((r) => r.id === id);
        if (idx !== -1) roles.splice(idx, 1);
        return res.json({ success: true });
    }),
);

export default router;
