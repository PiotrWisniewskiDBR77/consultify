/**
 * Security Policies Routes
 *
 * DB-backed minimal endpoints to keep Security UI functional.
 * This replaces in-memory mocks (security integrity gate).
 */

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
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
