/**
 * Integrations Automation Routes (Zapier/Make backbone)
 *
 * - Org-admin API key management (integration_api_keys)
 * - Event catalog (triggers + actions)
 * - Minimal actions endpoint protected by integration API keys
 */
import crypto from 'crypto';
import type { Request } from 'express';
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import {
  buildOrgSuspendedResponseBody,
  isOrganizationSuspended,
} from '../../services/organizationSuspensionGuard.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

const serviceUnavailable = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

type IntegrationApiKey = {
  id: string;
  organization_id: string;
  name: string;
  api_key_hash: string;
  key_prefix: string;
  permissions?: string | null;
  allowed_events?: string | null;
  allowed_actions?: string | null;
  rate_limit_per_minute?: number | null;
  rate_limit_per_day?: number | null;
  request_count?: number | null;
  last_used_at?: string | null;
  expires_at?: string | null;
  is_active?: number | null;
  created_at?: string | null;
  created_by?: string | null;
};

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function safeJsonArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
  } catch {
    return [];
  }
  return [];
}

async function tableExists(table: string): Promise<boolean> {
  const cols = await dbAll<{ name: string }>(`PRAGMA table_info(${table})`, []).catch(() => []);
  return (cols || []).length > 0;
}

function extractIntegrationApiKey(req: any): string | null {
  const auth = String(req.headers?.authorization || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    return token.startsWith('ik_') ? token : null;
  }
  const header = req.headers?.['x-api-key'];
  if (typeof header === 'string' && header.startsWith('ik_')) return header.trim();
  return null;
}

type RateEntry = { count: number; resetAt: number };
const minuteStore = new Map<string, RateEntry>();
const dayStore = new Map<string, RateEntry>();

function nextUtcMidnightMs(nowMs: number): number {
  const d = new Date(nowMs);
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return next.getTime();
}

function checkWindow(store: Map<string, RateEntry>, keyId: string, limit: number, resetAt: number) {
  const now = Date.now();
  let entry = store.get(keyId);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt };
    store.set(keyId, entry);
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

async function validateIntegrationKey(rawKey: string): Promise<{
  key: IntegrationApiKey;
  organizationId: string;
  permissions: string[];
  allowedActions: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
} | null> {
  if (!rawKey?.startsWith('ik_')) return null;
  if (!(await tableExists('integration_api_keys'))) return null;

  const body = rawKey.slice(3);
  const prefix = body.slice(0, 8);
  if (!prefix) return null;

  const rows = await dbAll<IntegrationApiKey>(
    `SELECT * FROM integration_api_keys WHERE key_prefix = ? AND is_active = 1 LIMIT 10`,
    [prefix]
  );
  const hash = sha256(rawKey);
  const match = (rows || []).find((r: any) => String(r?.api_key_hash || '') === hash);
  if (!match) return null;

  if (match.expires_at) {
    const exp = new Date(String(match.expires_at));
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) return null;
  }

  const permissions = safeJsonArray(match.permissions);
  const allowedActions = safeJsonArray(match.allowed_actions);
  const rateLimitPerMinute = Number(match.rate_limit_per_minute || 60);
  const rateLimitPerDay = Number(match.rate_limit_per_day || 10000);

  return {
    key: match,
    organizationId: String(match.organization_id || ''),
    permissions,
    allowedActions,
    rateLimitPerMinute,
    rateLimitPerDay,
  };
}

async function integrationApiKeyAuth(req: any, res: Response, next: any) {
  const raw = extractIntegrationApiKey(req);
  if (!raw) return res.status(401).json({ error: 'API key required (ik_)' });

  const validated = await validateIntegrationKey(raw);
  if (!validated?.organizationId) return res.status(401).json({ error: 'Invalid API key' });

  // rate limits
  const minute = checkWindow(
    minuteStore,
    validated.key.id,
    validated.rateLimitPerMinute,
    Date.now() + 60 * 1000
  );
  const day = checkWindow(
    dayStore,
    validated.key.id,
    validated.rateLimitPerDay,
    nextUtcMidnightMs(Date.now())
  );

  res.setHeader('X-RateLimit-Limit-Minute', String(validated.rateLimitPerMinute));
  res.setHeader('X-RateLimit-Remaining-Minute', String(minute.remaining));
  res.setHeader('X-RateLimit-Reset-Minute', String(Math.ceil(minute.resetAt / 1000)));

  res.setHeader('X-RateLimit-Limit-Day', String(validated.rateLimitPerDay));
  res.setHeader('X-RateLimit-Remaining-Day', String(day.remaining));
  res.setHeader('X-RateLimit-Reset-Day', String(Math.ceil(day.resetAt / 1000)));

  if (!minute.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded (minute)' });
  }
  if (!day.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded (day)' });
  }

  // attach
  req.integrationApiKey = validated.key;
  req.organizationId = validated.organizationId;
  req.integrationApiKeyPermissions = validated.permissions;
  req.integrationApiKeyAllowedActions = validated.allowedActions;

  // ---------------------------------------------------------------------------
  // DEC-91 / TRI-MUST-12 — the `ik_` integration keys are a FIFTH front door.
  //
  // This middleware is a second, independent API-key implementation: it never
  // touches `verifyToken` AND it is not `apiKeyAuth.middleware.ts`, so neither
  // of the enforcement points added earlier reached it. A Zapier/Make key of a
  // suspended tenant kept working — `POST /actions/tasks.create` still INSERTed
  // rows for an organization that had been cut off everywhere else.
  //
  // Checked AFTER the org is resolved from the key row in the database (never
  // from anything the caller sends) and BEFORE `next()`, so no action handler
  // runs. No exemptions: this router has no superadmin, logout or health
  // surface behind key auth. Same guard, same process cache, same body.
  // ---------------------------------------------------------------------------
  if (await isOrganizationSuspended(req.organizationId, dbGet)) {
    return res.status(403).json(buildOrgSuspendedResponseBody());
  }

  // best-effort usage tracking
  await dbRun(
    `UPDATE integration_api_keys
     SET request_count = COALESCE(request_count, 0) + 1,
         last_used_at = datetime('now')
     WHERE id = ?`,
    [validated.key.id]
  ).catch(() => null);

  return next();
}

function requireAllowedAction(actionId: string) {
  return (req: any, res: Response, next: any) => {
    const allowed = Array.isArray(req.integrationApiKeyAllowedActions)
      ? req.integrationApiKeyAllowedActions
      : [];
    if (!allowed.length) return next(); // empty means "all actions" for MVP
    if (!allowed.includes(actionId))
      return res.status(403).json({ error: 'Action not allowed for this key' });
    return next();
  };
}

// ============================================================
// Catalog (JWT)
// ============================================================
router.get(
  '/catalog',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      version: 1,
      triggers: [
        { id: 'tasks.created', description: 'Task created' },
        { id: 'tasks.updated', description: 'Task updated' },
        { id: 'initiatives.updated', description: 'Initiative updated' },
        { id: 'notifications.sent', description: 'Notification dispatched' },
      ],
      actions: [
        {
          id: 'tasks.create',
          description: 'Create a task in Consultify',
          inputShape: {
            title: 'string',
            description: 'string?',
            dueDate: 'isoDate?',
            projectId: 'string?',
          },
        },
      ],
      auth: { scheme: 'ik_', header: 'X-API-Key' },
    });
  })
);

// ============================================================
// Key management (org admin, JWT)
// ============================================================
router.get(
  '/keys',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await tableExists('integration_api_keys'))) return serviceUnavailable(res);
    const orgId = req.user?.organizationId;
    const rows = await dbAll<IntegrationApiKey>(
      `SELECT id, organization_id, name, key_prefix, permissions, allowed_events, allowed_actions,
              rate_limit_per_minute, rate_limit_per_day, request_count, last_used_at, expires_at, is_active, created_at, created_by
       FROM integration_api_keys
       WHERE organization_id = ?
       ORDER BY created_at DESC`,
      [orgId]
    );
    return res.json({ keys: rows || [] });
  })
);

router.post(
  '/keys',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await tableExists('integration_api_keys'))) return serviceUnavailable(res);
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const rateLimitPerMinute = Number(req.body?.rateLimitPerMinute || 60);
    const rateLimitPerDay = Number(req.body?.rateLimitPerDay || 10000);
    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.map((p: any) => String(p))
      : [];
    const allowedActions = Array.isArray(req.body?.allowedActions)
      ? req.body.allowedActions.map((a: any) => String(a))
      : [];
    const allowedEvents = Array.isArray(req.body?.allowedEvents)
      ? req.body.allowedEvents.map((e: any) => String(e))
      : [];

    const random = crypto.randomBytes(24).toString('base64url'); // ~192 bits
    const plainTextKey = `ik_${random}`;
    const keyPrefix = random.slice(0, 8);
    const apiKeyHash = sha256(plainTextKey);

    const id = `iak-${uuidv4()}`;
    await dbRun(
      `INSERT INTO integration_api_keys (
        id, organization_id, name, api_key_hash, key_prefix,
        permissions, allowed_events, allowed_actions,
        rate_limit_per_minute, rate_limit_per_day,
        is_active, request_count, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, datetime('now'), datetime('now'))`,
      [
        id,
        orgId,
        name,
        apiKeyHash,
        keyPrefix,
        JSON.stringify(permissions),
        JSON.stringify(allowedEvents),
        JSON.stringify(allowedActions),
        rateLimitPerMinute,
        rateLimitPerDay,
        req.user?.id || 'system',
      ]
    );

    return res.status(201).json({
      success: true,
      warning: 'Store this key securely. It cannot be retrieved again.',
      key: {
        id,
        name,
        keyPrefix,
        rateLimitPerMinute,
        rateLimitPerDay,
        permissions,
        allowedEvents,
        allowedActions,
      },
      plainTextKey,
    });
  })
);

router.delete(
  '/keys/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await tableExists('integration_api_keys'))) return serviceUnavailable(res);
    const orgId = req.user?.organizationId;
    const id = String(req.params.id || '').trim();
    await dbRun(
      `UPDATE integration_api_keys SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    return res.json({ success: true });
  })
);

// ============================================================
// Actions (API key)
// ============================================================
router.post(
  '/actions/tasks.create',
  integrationApiKeyAuth,
  requireAllowedAction('tasks.create'),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = String(req.organizationId || '').trim();
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const title = String(req.body?.title || '').trim();
    const description = req.body?.description ? String(req.body.description) : null;
    const dueDate = req.body?.dueDate ? String(req.body.dueDate) : null;
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const id = uuidv4();
    await dbRun(
      `INSERT INTO tasks (id, project_id, organization_id, title, description, status, priority, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'todo', 'medium', ?, datetime('now'), datetime('now'))`,
      [id, projectId, orgId, title, description, dueDate]
    );

    return res
      .status(201)
      .json({ success: true, task: { id, title, description, dueDate, projectId } });
  })
);

export default router;
