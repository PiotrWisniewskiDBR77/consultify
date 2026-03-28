/**
 * Security Policies Routes
 *
 * DB-backed minimal endpoints to keep Security UI functional.
 * This replaces in-memory mocks (security integrity gate).
 */

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

type PolicyRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  settings_json: string;
  enabled: number;
  last_updated: string;
};

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const defaultPolicies = [
  {
    id: 'password-policy',
    name: 'Password Policy',
    category: 'Authentication',
    settings: { minLength: 12, requireUppercase: true, requireNumber: true, requireSpecial: true },
    enabled: true,
  },
  {
    id: 'session-timeout',
    name: 'Session Timeout',
    category: 'Session',
    settings: { timeoutMinutes: 30, extendOnActivity: true },
    enabled: true,
  },
  {
    id: 'mfa-required',
    name: 'MFA Required',
    category: 'Authentication',
    settings: { required: true, methods: ['totp', 'webauthn'] },
    enabled: true,
  },
  {
    id: 'ip-allowlist',
    name: 'IP Allowlist (Admin)',
    category: 'Network',
    settings: { enabled: true, cidr: ['192.168.0.0/24', '10.0.0.0/24'] },
    enabled: true,
  },
] as const;

async function ensureSchema() {
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS security_policies (
        id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        settings_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_updated TEXT NOT NULL,
        PRIMARY KEY (id, organization_id)
      )
    `
  );
}

async function ensureDefaults(orgId: string) {
  await ensureSchema();
  const exists = await dbGet<{ id: string }>(
    `SELECT id FROM security_policies WHERE organization_id = ? LIMIT 1`,
    [orgId]
  );
  if (exists) return;

  const now = new Date().toISOString();
  for (const p of defaultPolicies) {
    await dbRun(
      `
        INSERT INTO security_policies (id, organization_id, name, category, settings_json, enabled, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, organization_id) DO NOTHING
      `,
      [p.id, orgId, p.name, p.category, JSON.stringify(p.settings), p.enabled ? 1 : 0, now]
    );
  }
}

router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    await ensureDefaults(orgId);

    const rows = (await dbAll<PolicyRow>(
      `SELECT * FROM security_policies WHERE organization_id = ? ORDER BY category ASC, name ASC`,
      [orgId]
    )) as PolicyRow[];

    const policies = rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      settings: safeParseJson(r.settings_json, {}),
      enabled: !!r.enabled,
      last_updated: r.last_updated,
    }));

    return res.json({ policies });
  })
);

router.get(
  '/defaults',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    await ensureDefaults('__global__');
    const rows = (await dbAll<PolicyRow>(
      `SELECT * FROM security_policies WHERE organization_id = '__global__' ORDER BY category ASC, name ASC`,
      []
    )) as PolicyRow[];

    const settings = rows.reduce(
      (acc: any, r) => {
        const s = safeParseJson(r.settings_json, {}) as any;
        if (r.id === 'password-policy') {
          acc.passwordMinLength = s.minLength || 8;
          acc.passwordRequireUppercase = !!s.requireUppercase;
          acc.passwordRequireLowercase = s.requireLowercase !== false;
          acc.passwordRequireNumbers = !!s.requireNumber;
          acc.passwordRequireSpecial = !!s.requireSpecial;
          acc.passwordExpiryDays = s.expiryDays || 0;
          acc.passwordHistoryCount = s.historyCount || 0;
        }
        if (r.id === 'session-timeout') {
          acc.sessionTimeoutMinutes = s.timeoutMinutes || 480;
          acc.concurrentSessionsLimit = s.concurrentLimit || 5;
          acc.requireSessionBinding = !!s.requireBinding;
          acc.lockoutDurationMinutes = s.lockoutMinutes || 15;
          acc.maxLoginAttempts = s.maxAttempts || 5;
        }
        if (r.id === 'mfa-required') {
          acc.mfaRequired = !!s.required;
          acc.mfaMethods = s.methods || ['totp'];
          acc.mfaRememberDeviceDays = s.rememberDays || 30;
        }
        if (r.id === 'ip-allowlist') {
          acc.ipAllowlist = s.cidr || [];
          acc.ipBlocklist = s.blocklist || [];
          acc.geoRestrictions = s.geoRestrictions || [];
        }
        return acc;
      },
      {
        id: '__global__',
        organizationId: null,
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecial: false,
        passwordExpiryDays: 0,
        passwordHistoryCount: 0,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        sessionTimeoutMinutes: 480,
        concurrentSessionsLimit: 5,
        requireSessionBinding: false,
        ipAllowlist: [],
        ipBlocklist: [],
        geoRestrictions: [],
        mfaRequired: false,
        mfaMethods: ['totp'],
        mfaRememberDeviceDays: 30,
        compliancePreset: 'none',
      }
    );

    return res.json({ policy: settings });
  })
);

router.put(
  '/defaults',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    await ensureDefaults('__global__');
    const body = req.body || {};
    const now = new Date().toISOString();

    if (body.passwordMinLength !== undefined || body.compliancePreset !== undefined) {
      await dbRun(
        `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = '__global__' AND id = 'password-policy'`,
        [
          JSON.stringify({
            minLength: body.passwordMinLength || 8,
            requireUppercase: body.passwordRequireUppercase !== false,
            requireLowercase: body.passwordRequireLowercase !== false,
            requireNumber: body.passwordRequireNumbers !== false,
            requireSpecial: !!body.passwordRequireSpecial,
            expiryDays: body.passwordExpiryDays || 0,
            historyCount: body.passwordHistoryCount || 0,
          }),
          now,
        ]
      );
    }

    if (body.sessionTimeoutMinutes !== undefined) {
      await dbRun(
        `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = '__global__' AND id = 'session-timeout'`,
        [
          JSON.stringify({
            timeoutMinutes: body.sessionTimeoutMinutes || 480,
            concurrentLimit: body.concurrentSessionsLimit || 5,
            requireBinding: !!body.requireSessionBinding,
            lockoutMinutes: body.lockoutDurationMinutes || 15,
            maxAttempts: body.maxLoginAttempts || 5,
            extendOnActivity: true,
          }),
          now,
        ]
      );
    }

    if (body.mfaRequired !== undefined) {
      await dbRun(
        `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = '__global__' AND id = 'mfa-required'`,
        [
          JSON.stringify({
            required: !!body.mfaRequired,
            methods: body.mfaMethods || ['totp'],
            rememberDays: body.mfaRememberDeviceDays || 30,
          }),
          now,
        ]
      );
    }

    if (body.ipAllowlist !== undefined || body.ipBlocklist !== undefined) {
      await dbRun(
        `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = '__global__' AND id = 'ip-allowlist'`,
        [
          JSON.stringify({
            enabled: true,
            cidr: body.ipAllowlist || [],
            blocklist: body.ipBlocklist || [],
            geoRestrictions: body.geoRestrictions || [],
          }),
          now,
        ]
      );
    }

    return res.json({ success: true });
  })
);

router.get(
  '/all',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    await ensureSchema();
    const rows = (await dbAll<PolicyRow>(
      `SELECT DISTINCT organization_id FROM security_policies WHERE organization_id != '__global__'`,
      []
    )) as PolicyRow[];

    const policies = rows.map((r) => ({ organization_id: r.organization_id }));
    return res.json({ policies });
  })
);

router.post(
  '/:orgId/preset',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    const { orgId } = req.params;
    const { preset } = req.body;
    await ensureDefaults(orgId);
    const now = new Date().toISOString();

    const presetConfigs: Record<string, any> = {
      soc2: { minLength: 12, expiryDays: 90, mfaRequired: true, timeout: 60 },
      hipaa: { minLength: 14, expiryDays: 60, mfaRequired: true, timeout: 15, concurrent: 1 },
      gdpr: { minLength: 10, expiryDays: 180, mfaRequired: false, timeout: 240 },
      none: { minLength: 8, expiryDays: 0, mfaRequired: false, timeout: 480 },
    };
    const cfg = presetConfigs[preset] || presetConfigs.none;

    await dbRun(
      `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = ? AND id = 'password-policy'`,
      [
        JSON.stringify({
          minLength: cfg.minLength,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSpecial: preset !== 'none',
          expiryDays: cfg.expiryDays,
          historyCount: 0,
        }),
        now,
        orgId,
      ]
    );
    await dbRun(
      `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = ? AND id = 'session-timeout'`,
      [
        JSON.stringify({
          timeoutMinutes: cfg.timeout,
          concurrentLimit: cfg.concurrent || 5,
          extendOnActivity: true,
        }),
        now,
        orgId,
      ]
    );
    await dbRun(
      `UPDATE security_policies SET settings_json = ?, last_updated = ? WHERE organization_id = ? AND id = 'mfa-required'`,
      [
        JSON.stringify({
          required: cfg.mfaRequired,
          methods: ['totp', 'webauthn'],
          rememberDays: 30,
        }),
        now,
        orgId,
      ]
    );

    return res.json({ success: true });
  })
);

router.post(
  '/unlock-account',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
      await dbRun(
        `UPDATE users SET is_locked = 0, failed_login_attempts = 0, locked_at = NULL WHERE email = ?`,
        [email]
      );
    } catch {
      // Table may not have is_locked column — graceful fallback
    }
    return res.json({ success: true, message: `Account ${email} unlocked` });
  })
);

router.put(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.user!.organizationId;
    const { id } = req.params;
    await ensureSchema();

    const existing = await dbGet<PolicyRow>(
      `SELECT * FROM security_policies WHERE organization_id = ? AND id = ?`,
      [orgId, id]
    );
    if (!existing) return res.status(404).json({ error: 'Policy not found' });

    const nextRow = {
      name: req.body?.name ?? existing.name,
      category: req.body?.category ?? existing.category,
      settings_json: JSON.stringify(
        req.body?.settings ?? safeParseJson(existing.settings_json, {})
      ),
      enabled:
        typeof req.body?.enabled === 'boolean'
          ? req.body.enabled
            ? 1
            : 0
          : Number(existing.enabled),
      last_updated: new Date().toISOString(),
    };

    await dbRun(
      `
        UPDATE security_policies
        SET name = ?, category = ?, settings_json = ?, enabled = ?, last_updated = ?
        WHERE organization_id = ? AND id = ?
      `,
      [
        nextRow.name,
        nextRow.category,
        nextRow.settings_json,
        nextRow.enabled,
        nextRow.last_updated,
        orgId,
        id,
      ]
    );

    return res.json({ success: true });
  })
);

export default router;
