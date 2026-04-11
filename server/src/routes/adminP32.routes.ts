import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import adminAuditService from '../services/adminAuditService.js';
import { normalizeOrganizationRole } from '../services/organizationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

type SecuritySettingsShape = {
  passwordPolicy?: string;
  sessionTimeout?: number;
  ipWhitelist?: string[];
  ssoEnabled?: boolean;
  ssoEnforced?: boolean;
  allowPasswordLogin?: boolean;
  ssoProvider?: string;
  ssoProviderType?: string;
  ssoProtocol?: 'saml' | 'oidc';
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
}

function adminGuidance(role?: string): string {
  const normalized = normalizeOrganizationRole(role);
  if (normalized === 'GUEST') return 'Guests cannot access admin tools.';
  return 'You need admin access. Ask your workspace admin.';
}

async function getAdminActor(
  req: AuthRequest,
  res: Response
): Promise<
  | {
  orgId: string;
  actorId: string;
  actorRole: string;
  isSuperAdmin: boolean;
}
  | null
> {
  const orgId = String(req.query.orgId || req.user?.organizationId || '').trim();
  const actorId = String(req.user?.id || '').trim();
  const isSuperAdmin =
    req.user?.role === 'SUPERADMIN' || req.user?.role === 'SUPER_ADMIN';

  if (!orgId || !actorId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }

  if (orgId !== req.user?.organizationId && !isSuperAdmin) {
    res.status(403).json({
      error: 'Cross-organization admin access is blocked',
      code: 'ADMIN_BOUNDARY_VIOLATION',
      guidance: 'Open the Admin cockpit for your active organization.',
    });
    return null;
  }

  const membership = await dbGet<{ role?: string }>(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
    [orgId, actorId],
    { fallback: true }
  );
  const actorRole = normalizeOrganizationRole(membership?.role || req.user?.role);

  if (!isSuperAdmin && !membership) {
    res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_ACCESS_REQUIRED',
      guidance: adminGuidance(req.user?.role),
    });
    return null;
  }

  if (!isSuperAdmin && !['OWNER', 'ADMIN'].includes(actorRole)) {
    res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_ACCESS_REQUIRED',
      guidance: adminGuidance(actorRole),
    });
    return null;
  }

  return { orgId, actorId, actorRole, isSuperAdmin };
}

async function readSecuritySettings(orgId: string) {
  const organization = await dbGet<{ mfa_required?: number; mfa_grace_period_days?: number }>(
    `SELECT mfa_required, mfa_grace_period_days FROM organizations WHERE id = ?`,
    [orgId],
    { fallback: true }
  );
  const securityRow = await dbGet<{ setting_value?: string }>(
    `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'security'`,
    [orgId],
    { fallback: true }
  );
  const ssoRow = await dbGet<Record<string, unknown>>(
    `SELECT * FROM sso_configurations WHERE organization_id = ? LIMIT 1`,
    [orgId],
    { fallback: true }
  );
  const securitySettings = parseJson<SecuritySettingsShape>(securityRow?.setting_value, {});

  return {
    mfaRequired: toBoolean(organization?.mfa_required),
    mfaGracePeriodDays: Number(organization?.mfa_grace_period_days ?? 7),
    passwordPolicy: securitySettings.passwordPolicy || 'standard',
    sessionTimeoutMinutes: Number(securitySettings.sessionTimeout ?? 60),
    ipWhitelist: Array.isArray(securitySettings.ipWhitelist) ? securitySettings.ipWhitelist : [],
    ssoEnabled: Boolean(
      ssoRow?.is_enabled ?? ssoRow?.is_active ?? securitySettings.ssoEnabled ?? false
    ),
    ssoEnforced: Boolean(
      ssoRow?.enforce_sso ?? ssoRow?.sso_enforced ?? securitySettings.ssoEnforced ?? false
    ),
    allowPasswordLogin: Boolean(
      ssoRow?.allow_password_login ?? securitySettings.allowPasswordLogin ?? true
    ),
    ssoProvider:
      String(
        ssoRow?.provider_name ||
          ssoRow?.provider_type ||
          securitySettings.ssoProvider ||
          'Custom SSO'
      ) || 'Custom SSO',
    ssoProviderType:
      String(ssoRow?.provider_type || securitySettings.ssoProviderType || 'custom') || 'custom',
    ssoProtocol:
      (String(ssoRow?.protocol || securitySettings.ssoProtocol || 'saml').toLowerCase() as
        | 'saml'
        | 'oidc') || 'saml',
  };
}

async function writeSecuritySettings(
  orgId: string,
  actorId: string,
  next: {
    mfaRequired: boolean;
    mfaGracePeriodDays: number;
    passwordPolicy: string;
    sessionTimeoutMinutes: number;
    ipWhitelist: string[];
    ssoEnabled: boolean;
    ssoEnforced: boolean;
    allowPasswordLogin: boolean;
    ssoProvider: string;
    ssoProviderType: string;
    ssoProtocol: 'saml' | 'oidc';
  }
) {
  await dbRun(
    `UPDATE organizations SET mfa_required = ?, mfa_grace_period_days = ? WHERE id = ?`,
    [next.mfaRequired ? 1 : 0, next.mfaGracePeriodDays, orgId]
  );

  await dbRun(
    `INSERT OR REPLACE INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
     VALUES (?, 'security', ?, datetime('now'))`,
    [
      orgId,
      JSON.stringify({
        passwordPolicy: next.passwordPolicy,
        sessionTimeout: next.sessionTimeoutMinutes,
        ipWhitelist: next.ipWhitelist,
        ssoEnabled: next.ssoEnabled,
        ssoEnforced: next.ssoEnforced,
        allowPasswordLogin: next.allowPasswordLogin,
        ssoProvider: next.ssoProvider,
        ssoProviderType: next.ssoProviderType,
        ssoProtocol: next.ssoProtocol,
      }),
    ]
  );

  const existingSso = await dbGet<{ id?: string }>(
    `SELECT id FROM sso_configurations WHERE organization_id = ? LIMIT 1`,
    [orgId],
    { fallback: true }
  );

  if (existingSso?.id) {
    await dbRun(
      `UPDATE sso_configurations
       SET protocol = ?, provider_name = ?, provider_type = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        next.ssoProtocol,
        next.ssoProvider,
        next.ssoProviderType,
        next.ssoEnabled ? 1 : 0,
        existingSso.id,
      ]
    );
  } else if (next.ssoEnabled || next.ssoEnforced) {
    await dbRun(
      `INSERT INTO sso_configurations (
        id, organization_id, protocol, provider_name, provider_type,
        is_enabled, jit_provisioning, default_role, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 'member', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        `sso-${uuidv4()}`,
        orgId,
        next.ssoProtocol,
        next.ssoProvider,
        next.ssoProviderType,
        next.ssoEnabled ? 1 : 0,
        actorId,
      ]
    );
  }
}

async function readCollaborationControls(orgId: string) {
  const rows = await dbAll<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (?, ?, ?)`,
    [
      `tenant:${orgId}:guest_access_enabled`,
      `tenant:${orgId}:external_link_sharing`,
      `module:${orgId}:tools:tool_approval_required`,
    ],
    { fallback: true }
  );

  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    guestAccessEnabled: parseJson(byKey.get(`tenant:${orgId}:guest_access_enabled`), false),
    externalLinkSharing: parseJson(byKey.get(`tenant:${orgId}:external_link_sharing`), false),
    toolApprovalRequired: parseJson(
      byKey.get(`module:${orgId}:tools:tool_approval_required`),
      true
    ),
  };
}

async function writeCollaborationControls(
  orgId: string,
  values: {
    guestAccessEnabled: boolean;
    externalLinkSharing: boolean;
    toolApprovalRequired: boolean;
  }
) {
  const writes = [
    [`tenant:${orgId}:guest_access_enabled`, values.guestAccessEnabled],
    [`tenant:${orgId}:external_link_sharing`, values.externalLinkSharing],
    [`module:${orgId}:tools:tool_approval_required`, values.toolApprovalRequired],
  ] as const;

  for (const [key, value] of writes) {
    await dbRun(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );
  }
}

function matchesAuditFilter(log: any, orgId: string, filters: Record<string, string>) {
  const metadata = parseJson<Record<string, unknown>>(log.metadata_json, {});
  const logOrgId = String(
    metadata.orgId || metadata.organizationId || metadata.details?.orgId || ''
  ).trim();

  if (logOrgId !== orgId) return false;
  if (filters.actionType && String(log.action_type) !== filters.actionType) return false;
  if (filters.status && String(log.status) !== filters.status) return false;
  if (filters.riskScoreMin && Number(log.risk_score || 0) < Number(filters.riskScoreMin)) return false;
  if (filters.search) {
    const haystack = JSON.stringify({
      actionType: log.action_type,
      adminId: log.admin_id,
      metadata,
    }).toLowerCase();
    if (!haystack.includes(filters.search.toLowerCase())) return false;
  }
  return true;
}

router.use(verifyToken);

router.get(
  '/security',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId } = actor;
    const policy = await readSecuritySettings(orgId);
    return res.json({ organizationId: orgId, policy });
  })
);

router.put(
  '/security',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId, actorId } = actor;
    const current = await readSecuritySettings(orgId);
    const body = req.body || {};
    const next = {
      mfaRequired: Boolean(body.mfaRequired ?? current.mfaRequired),
      mfaGracePeriodDays: Number(body.mfaGracePeriodDays ?? current.mfaGracePeriodDays ?? 7),
      passwordPolicy: String(body.passwordPolicy || current.passwordPolicy || 'standard'),
      sessionTimeoutMinutes: Number(
        body.sessionTimeoutMinutes ?? current.sessionTimeoutMinutes ?? 60
      ),
      ipWhitelist: Array.isArray(body.ipWhitelist) ? body.ipWhitelist : current.ipWhitelist,
      ssoEnabled: Boolean(body.ssoEnabled ?? current.ssoEnabled),
      ssoEnforced: Boolean(body.ssoEnforced ?? current.ssoEnforced),
      allowPasswordLogin: Boolean(body.allowPasswordLogin ?? current.allowPasswordLogin),
      ssoProvider: String(body.ssoProvider || current.ssoProvider || 'Custom SSO'),
      ssoProviderType: String(body.ssoProviderType || current.ssoProviderType || 'custom'),
      ssoProtocol:
        String(body.ssoProtocol || current.ssoProtocol || 'saml').toLowerCase() === 'oidc'
          ? 'oidc'
          : 'saml',
    } as const;

    await writeSecuritySettings(orgId, actorId, next);
    await adminAuditService.logAction({
      adminId: actorId,
      actionType: 'update_security_policy',
      details: {
        orgId,
        isSensitive: true,
        next,
      },
    });

    return res.json({ success: true, policy: next });
  })
);

router.get(
  '/collaboration',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId } = actor;
    const controls = await readCollaborationControls(orgId);
    return res.json({ organizationId: orgId, controls });
  })
);

router.put(
  '/collaboration',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId, actorId } = actor;
    const current = await readCollaborationControls(orgId);
    const next = {
      guestAccessEnabled: Boolean(req.body?.guestAccessEnabled ?? current.guestAccessEnabled),
      externalLinkSharing: Boolean(req.body?.externalLinkSharing ?? current.externalLinkSharing),
      toolApprovalRequired: Boolean(req.body?.toolApprovalRequired ?? current.toolApprovalRequired),
    };

    await writeCollaborationControls(orgId, next);
    await adminAuditService.logAction({
      adminId: actorId,
      actionType: 'update_collaboration_controls',
      details: {
        orgId,
        isSensitive: true,
        next,
      },
    });

    return res.json({ success: true, controls: next });
  })
);

router.get(
  '/audit-logs',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId } = actor;
    const filters = {
      actionType: String(req.query.actionType || ''),
      status: String(req.query.status || ''),
      riskScoreMin: String(req.query.riskScoreMin || ''),
      search: String(req.query.search || ''),
    };
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0 });
    const filtered = logs.filter((log: any) => matchesAuditFilter(log, orgId, filters));
    const paginated = filtered.slice(offset, offset + limit);

    return res.json({
      logs: paginated,
      total: filtered.length,
      limit,
      offset,
    });
  })
);

router.get(
  '/audit-logs/stats',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId } = actor;
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0 });
    const scoped = logs.filter((log: any) => matchesAuditFilter(log, orgId, {}));
    const unresolved = scoped.filter((log: any) => log.status !== 'resolved').length;
    const highRisk = scoped.filter((log: any) => Number(log.risk_score || 0) >= 60).length;

    return res.json({
      totalLogs: scoped.length,
      unresolvedCount: unresolved,
      highRiskCount: highRisk,
    });
  })
);

router.get(
  '/audit-logs/export',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId } = actor;
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0 });
    const scoped = logs.filter((log: any) =>
      matchesAuditFilter(log, orgId, { actionType: '', status: '', riskScoreMin: '', search: '' })
    );
    const headers = ['id', 'admin_id', 'action_type', 'risk_score', 'risk_level', 'status', 'created_at'];
    const rows = scoped.map((log: any) =>
      headers.map((header) => JSON.stringify(log[header] ?? '')).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-audit.csv"');
    return res.send(csv);
  })
);

export default router;
