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

type AdminIamPolicy = {
  delegatedRoles: Array<{
    id: string;
    name: string;
    capabilities: string[];
  }>;
  accessReviewsEnabled: boolean;
  accessReviewCadenceDays: number;
  contextAwareAccessEnabled: boolean;
  privilegedSessionReauthMinutes: number;
  breakGlassEnabled: boolean;
  breakGlassApprovers: string[];
  alertOnPrivilegedChange: boolean;
};

const DEFAULT_ADMIN_IAM_POLICY: AdminIamPolicy = {
  delegatedRoles: [
    { id: 'billing_admin', name: 'Billing Admin', capabilities: ['billing:read', 'billing:write'] },
    { id: 'security_admin', name: 'Security Admin', capabilities: ['security:write', 'audit:read'] },
    { id: 'ai_admin', name: 'AI Admin', capabilities: ['ai:governance', 'ai:operations', 'ai:budget'] },
    { id: 'compliance_admin', name: 'Compliance Admin', capabilities: ['audit:read', 'compliance:read'] },
  ],
  accessReviewsEnabled: true,
  accessReviewCadenceDays: 90,
  contextAwareAccessEnabled: false,
  privilegedSessionReauthMinutes: 30,
  breakGlassEnabled: false,
  breakGlassApprovers: [],
  alertOnPrivilegedChange: true,
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

async function readOrganizationSetting<T>(orgId: string, key: string, fallback: T): Promise<T> {
  const row = await dbGet<{ setting_value?: string }>(
    `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = ?`,
    [orgId, key],
    { fallback: true }
  );
  return parseJson<T>(row?.setting_value, fallback);
}

async function writeOrganizationSetting(orgId: string, key: string, value: unknown) {
  await dbRun(
    `INSERT OR REPLACE INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [orgId, key, JSON.stringify(value)]
  );
}

async function readAdminIamPolicy(orgId: string): Promise<AdminIamPolicy> {
  return readOrganizationSetting<AdminIamPolicy>(orgId, 'admin_iam_policy', DEFAULT_ADMIN_IAM_POLICY);
}

async function writeAdminIamPolicy(orgId: string, value: AdminIamPolicy) {
  await writeOrganizationSetting(orgId, 'admin_iam_policy', value);
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

async function readBillingSummary(orgId: string) {
  const [billingRow, orgRow, alertsRow] = await Promise.all([
    dbGet<Record<string, unknown>>(
      `SELECT ob.subscription_plan_id, ob.status, ob.current_period_end,
              sp.name as plan_name, sp.price_monthly, sp.token_limit, sp.storage_limit_gb
       FROM organization_billing ob
       LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
       WHERE ob.organization_id = ?
       LIMIT 1`,
      [orgId],
      { fallback: true }
    ),
    dbGet<Record<string, unknown>>(
      `SELECT trial_tokens_used, token_balance, plan, trial_expires_at FROM organizations WHERE id = ?`,
      [orgId],
      { fallback: true }
    ),
    dbGet<Record<string, unknown>>(
      `SELECT token_threshold_80, token_threshold_90, token_threshold_100, cost_cap_monthly, email_notifications
       FROM billing_alerts WHERE organization_id = ?`,
      [orgId],
      { fallback: true }
    ),
  ]);

  let policySnapshot: any = null;
  try {
    const accessPolicyService = (await import('../services/accessPolicyService.js')).default;
    policySnapshot = await accessPolicyService.buildPolicySnapshot(orgId);
  } catch {
    policySnapshot = null;
  }

  return {
    billing: {
      status: String(billingRow?.status || policySnapshot?.subscriptionStatus || 'inactive'),
      subscriptionPlanId: billingRow?.subscription_plan_id || null,
      currentPeriodEnd: billingRow?.current_period_end || null,
      trialEndsAt: orgRow?.trial_expires_at || policySnapshot?.trialExpiresAt || null,
    },
    plan: {
      name: String(billingRow?.plan_name || orgRow?.plan || 'Trial'),
      priceMonthly: Number(billingRow?.price_monthly || 0),
      tokenLimit: Number(billingRow?.token_limit || policySnapshot?.limits?.maxTotalTokens || 0),
      storageLimitGb: Number(
        billingRow?.storage_limit_gb || (policySnapshot?.limits?.maxStorageMb || 0) / 1024
      ),
    },
    usage: {
      tokensUsed: Number(orgRow?.trial_tokens_used || policySnapshot?.usageToday?.tokensUsed || 0),
      tokenBalance: Number(orgRow?.token_balance || 0),
      usersUsed: Number(policySnapshot?.usageToday?.users || 0),
      usersLimit: Number(policySnapshot?.limits?.maxUsers || 0),
      projectsUsed: Number(policySnapshot?.usageToday?.projects || 0),
      projectsLimit: Number(policySnapshot?.limits?.maxProjects || 0),
      aiCallsUsed: Number(policySnapshot?.usageToday?.aiCalls || 0),
      aiCallsLimit: Number(policySnapshot?.limits?.maxAICallsPerDay || 0),
    },
    alerts: {
      tokenThreshold80: Boolean(alertsRow?.token_threshold_80),
      tokenThreshold90: Boolean(alertsRow?.token_threshold_90),
      tokenThreshold100: Boolean(alertsRow?.token_threshold_100),
      costCapMonthly: Number(alertsRow?.cost_cap_monthly || 0),
      emailNotifications: Boolean(alertsRow?.email_notifications),
    },
    policySnapshot,
  };
}

async function readAiSummary(orgId: string) {
  let governancePolicy: any = null;
  let governanceSummary: any = null;
  let contextPolicy: any = null;
  let llmPolicy: any = null;

  try {
    const AIPolicyEngine = (await import('../services/aiPolicyEngine.js')).default;
    const [effective, summary] = await Promise.all([
      AIPolicyEngine.getEffectivePolicy(orgId, null, null),
      AIPolicyEngine.getPolicySummary(orgId),
    ]);
    governancePolicy = effective;
    governanceSummary = summary;
  } catch {
    governancePolicy = null;
    governanceSummary = null;
  }

  try {
    const { getOrgContextPolicy } = await import('../services/ai/contextGovernance.js');
    contextPolicy = await getOrgContextPolicy(orgId);
  } catch {
    contextPolicy = null;
  }

  try {
    llmPolicy = await dbGet<Record<string, unknown>>(
      `SELECT mode, review_state, internet_enabled, audit_required, updated_at
       FROM llm_org_policies
       WHERE organization_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [orgId],
      { fallback: true }
    );
  } catch {
    llmPolicy = null;
  }

  return {
    governancePolicy,
    governanceSummary,
    contextPolicy,
    llmPolicy,
  };
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
  '/overview',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId } = actor;

    const [memberRows, ownershipTransfers, billingSummary, aiSummary, securityPolicy, collaboration, auditStats] =
      await Promise.all([
        dbAll<{ role?: string; total?: number }>(
          `SELECT role, COUNT(*) as total FROM organization_members WHERE organization_id = ? GROUP BY role`,
          [orgId],
          { fallback: true }
        ),
        dbGet<{ total?: number }>(
          `SELECT COUNT(*) as total FROM ownership_transfer_requests WHERE organization_id = ? AND status = 'pending'`,
          [orgId],
          { fallback: true }
        ),
        readBillingSummary(orgId),
        readAiSummary(orgId),
        readSecuritySettings(orgId),
        readCollaborationControls(orgId),
        (async () => {
          const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0 });
          const scoped = logs.filter((log: any) => matchesAuditFilter(log, orgId, {}));
          return {
            totalLogs: scoped.length,
            unresolvedCount: scoped.filter((log: any) => log.status !== 'resolved').length,
            highRiskCount: scoped.filter((log: any) => Number(log.risk_score || 0) >= 60).length,
          };
        })(),
      ]);

    const membersByRole = Object.fromEntries(
      memberRows.map((row) => [String(row.role || 'unknown').toUpperCase(), Number(row.total || 0)])
    );

    return res.json({
      organizationId: orgId,
      overview: {
        membersByRole,
        totalMembers: Object.values(membersByRole).reduce((sum, value) => sum + Number(value), 0),
        pendingOwnershipTransfers: Number(ownershipTransfers?.total || 0),
        securityPolicy,
        collaboration,
        billing: billingSummary,
        ai: aiSummary,
        audit: auditStats,
      },
    });
  })
);

router.get(
  '/billing/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const summary = await readBillingSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.get(
  '/ai/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const summary = await readAiSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.get(
  '/iam/policy',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const policy = await readAdminIamPolicy(actor.orgId);
    return res.json({ organizationId: actor.orgId, policy });
  })
);

router.put(
  '/iam/policy',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const current = await readAdminIamPolicy(actor.orgId);
    const body = req.body || {};
    const next: AdminIamPolicy = {
      delegatedRoles: Array.isArray(body.delegatedRoles) ? body.delegatedRoles : current.delegatedRoles,
      accessReviewsEnabled: Boolean(body.accessReviewsEnabled ?? current.accessReviewsEnabled),
      accessReviewCadenceDays: Number(
        body.accessReviewCadenceDays ?? current.accessReviewCadenceDays ?? 90
      ),
      contextAwareAccessEnabled: Boolean(
        body.contextAwareAccessEnabled ?? current.contextAwareAccessEnabled
      ),
      privilegedSessionReauthMinutes: Number(
        body.privilegedSessionReauthMinutes ?? current.privilegedSessionReauthMinutes ?? 30
      ),
      breakGlassEnabled: Boolean(body.breakGlassEnabled ?? current.breakGlassEnabled),
      breakGlassApprovers: Array.isArray(body.breakGlassApprovers)
        ? body.breakGlassApprovers
        : current.breakGlassApprovers,
      alertOnPrivilegedChange: Boolean(
        body.alertOnPrivilegedChange ?? current.alertOnPrivilegedChange
      ),
    };

    await writeAdminIamPolicy(actor.orgId, next);
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'update_admin_iam_policy',
      details: { orgId: actor.orgId, isSensitive: true, next },
    });

    return res.json({ success: true, policy: next });
  })
);

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
