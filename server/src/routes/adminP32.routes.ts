import crypto from 'node:crypto';

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { getRequestAccessRole, isRequestSuperAdmin } from '../middleware/requestAccess.js';
import AccessCodeService from '../services/accessCodeService.js';
import adminAuditService from '../services/adminAuditService.js';
import { normalizeOrganizationRole } from '../services/organizationService.js';
import {
  insertScimGroupMapping,
  ScimGroupMappingError,
  scimMappingsHasProjectId,
} from '../services/scimGroupMappingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { flagOn } from '../utils/pgFlags.js';

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

type AdminRoleAssignment = {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  capabilities: string[];
  expiresAt: string | null;
};

type AdminPeopleMember = {
  id: string;
  user_id: string;
  role: string;
  status: string | null;
  created_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

const DEFAULT_ADMIN_IAM_POLICY: AdminIamPolicy = {
  delegatedRoles: [
    { id: 'billing_admin', name: 'Billing Admin', capabilities: ['billing:read', 'billing:write'] },
    {
      id: 'security_admin',
      name: 'Security Admin',
      capabilities: ['security:write', 'audit:read'],
    },
    {
      id: 'ai_admin',
      name: 'AI Admin',
      capabilities: ['ai:governance', 'ai:operations', 'ai:budget'],
    },
    {
      id: 'compliance_admin',
      name: 'Compliance Admin',
      capabilities: ['audit:read', 'compliance:read'],
    },
  ],
  accessReviewsEnabled: true,
  accessReviewCadenceDays: 90,
  contextAwareAccessEnabled: false,
  privilegedSessionReauthMinutes: 30,
  breakGlassEnabled: false,
  breakGlassApprovers: [],
  alertOnPrivilegedChange: true,
};

const ADMIN_PEOPLE_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER', 'GUEST', 'CONSULTANT']);
const SECURITY_PASSWORD_POLICIES = new Set(['standard', 'strong', 'strict']);
const SECURITY_SSO_PROTOCOLS = new Set(['saml', 'oidc']);

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sendValidationError(res: Response, errors: string[]) {
  return res.status(400).json({
    error: errors[0] || 'Invalid request',
    code: 'VALIDATION_ERROR',
    details: errors,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseOptionalBoolean(
  value: unknown,
  field: string,
  errors: string[],
  fallback: boolean
): boolean {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  errors.push(`${field} must be a boolean`);
  return fallback;
}

function parseBoundedInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[],
  fallback: number
): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`);
    return fallback;
  }
  return parsed;
}

function parseNonEmptyString(
  value: unknown,
  field: string,
  errors: string[],
  fallback: string,
  maxLength = 120
): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${field} must be a non-empty string`);
    return fallback;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    errors.push(`${field} must be ${maxLength} characters or less`);
    return fallback;
  }
  return trimmed;
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

async function ensureAdminGovernanceTables() {
  await dbRun(`CREATE TABLE IF NOT EXISTS admin_role_assignments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    capabilities_json TEXT NOT NULL,
    expires_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_role_assignment_unique
     ON admin_role_assignments(organization_id, user_id, role_id)`
  );
}

function hasCapability(owned: string[], required: string[]) {
  if (owned.includes('*') || owned.includes('admin:*')) return true;
  return required.some((capability) => {
    if (owned.includes(capability)) return true;
    if (capability.endsWith(':read')) {
      const scope = capability.slice(0, -':read'.length);
      return owned.includes(`${scope}:write`);
    }
    return false;
  });
}

async function readAdminRoleAssignments(orgId: string): Promise<AdminRoleAssignment[]> {
  await ensureAdminGovernanceTables();
  const rows = await dbAll<any>(
    `SELECT id, user_id, role_id, role_name, capabilities_json, expires_at
     FROM admin_role_assignments
     WHERE organization_id = ?
     ORDER BY created_at DESC`,
    [orgId],
    { fallback: true }
  );
  return (rows || []).map((row: any) => ({
    id: String(row.id),
    userId: String(row.user_id),
    roleId: String(row.role_id),
    roleName: String(row.role_name),
    capabilities: parseJson<string[]>(row.capabilities_json, []),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
  }));
}

async function getActorCapabilities(
  orgId: string,
  actorId: string,
  actorRole: string,
  isSuperAdmin: boolean
): Promise<string[]> {
  if (isSuperAdmin) return ['*'];
  if (actorRole === 'OWNER') return ['*'];
  if (actorRole === 'ADMIN') {
    return [
      'people:read',
      'people:write',
      'security:read',
      'security:write',
      'billing:read',
      'billing:write',
      'ai:read',
      'ai:governance',
      'ai:operations',
      'ai:budget',
      'integrations:read',
      'integrations:write',
      'audit:read',
      'audit:export',
      'compliance:read',
      'compliance:write',
      'operations:read',
      'operations:write',
      'iam:read',
      'iam:write',
    ];
  }

  const assignments = await readAdminRoleAssignments(orgId);
  const now = Date.now();
  const activeAssignments = assignments.filter(
    (assignment) =>
      assignment.userId === actorId &&
      (!assignment.expiresAt ||
        Number.isNaN(Date.parse(assignment.expiresAt)) ||
        Date.parse(assignment.expiresAt) > now)
  );
  return Array.from(new Set(activeAssignments.flatMap((assignment) => assignment.capabilities)));
}

async function getAdminActor(
  req: AuthRequest,
  res: Response,
  requiredCapabilities: string[] = []
): Promise<{
  orgId: string;
  actorId: string;
  actorRole: string;
  isSuperAdmin: boolean;
  capabilities: string[];
} | null> {
  const orgId = String(req.query.orgId || req.user?.organizationId || '').trim();
  const actorId = String(req.user?.id || '').trim();
  const isSuperAdmin = isRequestSuperAdmin(req);
  const requestRole = getRequestAccessRole(req);

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
  const actorRole = normalizeOrganizationRole(
    membership?.role || (requestRole === 'superadmin' ? 'OWNER' : requestRole)
  );
  const capabilities = await getActorCapabilities(orgId, actorId, actorRole, isSuperAdmin);

  if (!isSuperAdmin && !membership) {
    res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_ACCESS_REQUIRED',
      guidance: adminGuidance(requestRole),
    });
    return null;
  }

  if (!isSuperAdmin && !['OWNER', 'ADMIN'].includes(actorRole) && capabilities.length === 0) {
    res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_ACCESS_REQUIRED',
      guidance: adminGuidance(actorRole),
    });
    return null;
  }

  if (requiredCapabilities.length > 0 && !hasCapability(capabilities, requiredCapabilities)) {
    res.status(403).json({
      error: 'Admin capability required',
      code: 'ADMIN_CAPABILITY_REQUIRED',
      requiredCapabilities,
      guidance: 'Ask an owner to assign the required delegated admin role or capability.',
    });
    return null;
  }

  return { orgId, actorId, actorRole, isSuperAdmin, capabilities };
}

function toAdminPeopleMember(row: AdminPeopleMember) {
  return {
    id: String(row.id || row.user_id),
    userId: String(row.user_id),
    user_id: String(row.user_id),
    role: normalizeOrganizationRole(row.role),
    status: row.status || 'ACTIVE',
    createdAt: row.created_at || null,
    created_at: row.created_at || null,
    firstName: row.first_name || null,
    first_name: row.first_name || null,
    lastName: row.last_name || null,
    last_name: row.last_name || null,
    email: row.email || null,
  };
}

async function readAdminPeople(orgId: string) {
  const rows = await dbAll<AdminPeopleMember>(
    `SELECT m.id, m.user_id, m.role, m.status, m.created_at, u.first_name, u.last_name, u.email
     FROM organization_members m
     LEFT JOIN users u ON m.user_id = u.id
     WHERE m.organization_id = ?
     ORDER BY
       CASE UPPER(m.role)
         WHEN 'OWNER' THEN 1
         WHEN 'ADMIN' THEN 2
         WHEN 'MEMBER' THEN 3
         WHEN 'CONSULTANT' THEN 4
         ELSE 5
       END,
       COALESCE(u.email, m.user_id) ASC`,
    [orgId],
    { fallback: true }
  );
  return (rows || []).map(toAdminPeopleMember);
}

async function createAdminPeopleMember(
  orgId: string,
  actorId: string,
  actorRole: string,
  body: any
) {
  const errors: string[] = [];
  const role = normalizeOrganizationRole(body?.role === undefined ? 'MEMBER' : String(body.role));
  if (!ADMIN_PEOPLE_ROLES.has(role)) {
    errors.push('role must be one of OWNER, ADMIN, MEMBER, GUEST, or CONSULTANT');
  }
  if (role === 'OWNER' && actorRole !== 'OWNER') {
    errors.push('Only an owner can add another owner');
  }

  const email = String(body?.targetEmail || body?.email || '').trim();
  let targetUserId = String(body?.targetUserId || body?.userId || '').trim();
  if (!targetUserId && !email) {
    errors.push('Provide targetUserId or targetEmail');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('targetEmail must be a valid email address');
  }
  if (errors.length) {
    return { validationErrors: errors };
  }

  if (!targetUserId && email) {
    const userByEmail = await dbGet<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [email],
      { fallback: true }
    );
    if (!userByEmail?.id) {
      return {
        notFound: {
          error: 'User not found for the provided email',
          code: 'USER_NOT_FOUND',
          guidance:
            'Create the user account first or generate an access code for self-service join.',
        },
      };
    }
    targetUserId = userByEmail.id;
  }

  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
    [orgId, targetUserId],
    { fallback: true }
  );
  if (existing?.id) {
    return {
      conflict: {
        error: 'User is already a member of this organization',
        code: 'MEMBER_ALREADY_EXISTS',
        guidance: 'Update the existing membership instead of adding a duplicate.',
      },
    };
  }

  const id = uuidv4();
  await dbRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, invited_by_user_id)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
    [id, orgId, targetUserId, role, actorId]
  );

  const created = await dbGet<AdminPeopleMember>(
    `SELECT m.id, m.user_id, m.role, m.status, m.created_at, u.first_name, u.last_name, u.email
     FROM organization_members m
     LEFT JOIN users u ON m.user_id = u.id
     WHERE m.organization_id = ? AND m.user_id = ?
     LIMIT 1`,
    [orgId, targetUserId],
    { fallback: true }
  );

  return {
    member: created
      ? toAdminPeopleMember(created)
      : toAdminPeopleMember({
          id,
          user_id: targetUserId,
          role,
          status: 'ACTIVE',
          created_at: null,
          first_name: null,
          last_name: null,
          email: email || null,
        }),
  };
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

function validateSecuritySettingsUpdate(
  body: unknown,
  current: Awaited<ReturnType<typeof readSecuritySettings>>
) {
  const errors: string[] = [];
  if (!isPlainObject(body)) {
    return { errors: ['Request body must be a JSON object'], next: current };
  }

  const passwordPolicy = parseNonEmptyString(
    body.passwordPolicy,
    'passwordPolicy',
    errors,
    current.passwordPolicy,
    40
  ).toLowerCase();
  if (body.passwordPolicy !== undefined && !SECURITY_PASSWORD_POLICIES.has(passwordPolicy)) {
    errors.push('passwordPolicy must be one of standard, strong, or strict');
  }

  const parsedProtocol = parseNonEmptyString(
    body.ssoProtocol,
    'ssoProtocol',
    errors,
    current.ssoProtocol,
    10
  ).toLowerCase();
  if (body.ssoProtocol !== undefined && !SECURITY_SSO_PROTOCOLS.has(parsedProtocol)) {
    errors.push('ssoProtocol must be saml or oidc');
  }

  let ipWhitelist = current.ipWhitelist;
  if (body.ipWhitelist !== undefined) {
    if (!Array.isArray(body.ipWhitelist)) {
      errors.push('ipWhitelist must be an array of CIDR or IP strings');
    } else {
      ipWhitelist = body.ipWhitelist.map((item) => String(item).trim()).filter(Boolean);
      if (ipWhitelist.length > 50 || ipWhitelist.some((item) => item.length > 128)) {
        errors.push('ipWhitelist can contain up to 50 entries, each 128 characters or less');
      }
    }
  }

  const next = {
    mfaRequired: parseOptionalBoolean(body.mfaRequired, 'mfaRequired', errors, current.mfaRequired),
    mfaGracePeriodDays: parseBoundedInteger(
      body.mfaGracePeriodDays,
      'mfaGracePeriodDays',
      0,
      365,
      errors,
      current.mfaGracePeriodDays
    ),
    passwordPolicy,
    sessionTimeoutMinutes: parseBoundedInteger(
      body.sessionTimeoutMinutes,
      'sessionTimeoutMinutes',
      5,
      1440,
      errors,
      current.sessionTimeoutMinutes
    ),
    ipWhitelist,
    ssoEnabled: parseOptionalBoolean(body.ssoEnabled, 'ssoEnabled', errors, current.ssoEnabled),
    ssoEnforced: parseOptionalBoolean(body.ssoEnforced, 'ssoEnforced', errors, current.ssoEnforced),
    allowPasswordLogin: parseOptionalBoolean(
      body.allowPasswordLogin,
      'allowPasswordLogin',
      errors,
      current.allowPasswordLogin
    ),
    ssoProvider: parseNonEmptyString(
      body.ssoProvider,
      'ssoProvider',
      errors,
      current.ssoProvider,
      120
    ),
    ssoProviderType: parseNonEmptyString(
      body.ssoProviderType,
      'ssoProviderType',
      errors,
      current.ssoProviderType,
      80
    ),
    ssoProtocol: SECURITY_SSO_PROTOCOLS.has(parsedProtocol)
      ? (parsedProtocol as 'saml' | 'oidc')
      : current.ssoProtocol,
  };

  if (next.ssoEnforced && !next.ssoEnabled) {
    errors.push('ssoEnabled must be true before SSO can be enforced');
  }
  if (next.ssoEnforced && next.allowPasswordLogin) {
    errors.push('allowPasswordLogin must be false when SSO is enforced');
  }

  return { errors, next };
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
  return readOrganizationSetting<AdminIamPolicy>(
    orgId,
    'admin_iam_policy',
    DEFAULT_ADMIN_IAM_POLICY
  );
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
  await dbRun(`UPDATE organizations SET mfa_required = ?, mfa_grace_period_days = ? WHERE id = ?`, [
    next.mfaRequired ? 1 : 0,
    next.mfaGracePeriodDays,
    orgId,
  ]);

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

// ══════════════════════════════════════════════════════════════════════════
// HP-24: SSO self-service (org-admin configures own org's SAML/OIDC metadata)
//
// readSecuritySettings()/writeSecuritySettings() above already let a tenant
// admin flip is_enabled + name a provider, but never touch the actual IdP
// metadata (entity ID, SSO URL, certificate, OIDC issuer/client). Without
// those fields the SSO login flow (routes/integrations/sso.routes.ts →
// loadOIDCConfig/loadSAMLConfig) has nothing to read — SSO stays dead for
// self-service orgs, only superadmin (views/superadmin/SSOConfigurationView)
// could actually populate it. This block is the missing write path, scoped
// hard to the caller's own organization_id (never accepted from the body).
// ══════════════════════════════════════════════════════════════════════════

type SsoSelfConfigShape = {
  organizationId: string;
  configured: boolean;
  isEnabled: boolean;
  protocol: 'saml' | 'oidc';
  providerName: string;
  providerType: string;
  domains: string[];
  saml: {
    entityId: string;
    ssoUrl: string;
    sloUrl: string;
    nameIdFormat: string;
    certificateSet: boolean;
  };
  oidc: {
    issuer: string;
    clientId: string;
    clientSecretSet: boolean;
    authorizationUrl: string;
    tokenUrl: string;
    userinfoUrl: string;
    scopes: string;
  };
  updatedAt: string | null;
};

type SsoSelfConfigWrite = {
  protocol: 'saml' | 'oidc';
  providerName: string;
  providerType: string;
  domains: string[];
  isEnabled: boolean;
  saml: {
    entityId: string;
    ssoUrl: string;
    sloUrl: string;
    nameIdFormat: string;
    certificate: string | null; // null = not supplied this request, leave column untouched
  };
  oidc: {
    issuer: string;
    clientId: string;
    clientSecret: string | null; // null = not supplied this request, leave column untouched
    authorizationUrl: string;
    tokenUrl: string;
    userinfoUrl: string;
    scopes: string;
  };
};

async function ensureSsoConfigurationsTable() {
  await dbRun(`CREATE TABLE IF NOT EXISTS sso_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    saml_entity_id TEXT,
    saml_sso_url TEXT,
    saml_slo_url TEXT,
    saml_certificate TEXT,
    saml_signature_algorithm TEXT DEFAULT 'SHA256',
    saml_name_id_format TEXT DEFAULT 'emailAddress',
    oidc_issuer TEXT,
    oidc_client_id TEXT,
    oidc_client_secret TEXT,
    oidc_authorization_url TEXT,
    oidc_token_url TEXT,
    oidc_userinfo_url TEXT,
    oidc_scopes TEXT DEFAULT 'openid profile email',
    attribute_mappings TEXT DEFAULT '{"email":"email","firstName":"given_name","lastName":"family_name"}',
    jit_provisioning INTEGER DEFAULT 1,
    default_role TEXT DEFAULT 'user',
    group_mappings TEXT DEFAULT '[]',
    allowed_domains TEXT,
    is_enabled INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
  )`);
}

async function readSsoSelfConfig(orgId: string): Promise<SsoSelfConfigShape> {
  await ensureSsoConfigurationsTable();
  // Hard org-scope: this is the ONLY predicate on the lookup — an org admin
  // can never pass a different organization_id in because we never read one
  // from the request body/query here, only from the authenticated actor.
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM sso_configurations WHERE organization_id = ? LIMIT 1`,
    [orgId],
    { fallback: true }
  );

  let domains: string[] = [];
  try {
    const parsed = JSON.parse(String(row?.allowed_domains || '[]'));
    domains = Array.isArray(parsed) ? parsed.map((d) => String(d)) : [];
  } catch {
    domains = [];
  }

  return {
    organizationId: orgId,
    configured: Boolean(row?.id),
    isEnabled: toBoolean(row?.is_enabled, false),
    protocol: (String(row?.protocol || 'saml').toLowerCase() === 'oidc' ? 'oidc' : 'saml') as
      | 'saml'
      | 'oidc',
    providerName: String(row?.provider_name || ''),
    providerType: String(row?.provider_type || 'custom'),
    domains,
    saml: {
      entityId: String(row?.saml_entity_id || ''),
      ssoUrl: String(row?.saml_sso_url || ''),
      sloUrl: String(row?.saml_slo_url || ''),
      nameIdFormat: String(row?.saml_name_id_format || 'emailAddress'),
      certificateSet: Boolean(row?.saml_certificate),
    },
    oidc: {
      issuer: String(row?.oidc_issuer || ''),
      clientId: String(row?.oidc_client_id || ''),
      clientSecretSet: Boolean(row?.oidc_client_secret),
      authorizationUrl: String(row?.oidc_authorization_url || ''),
      tokenUrl: String(row?.oidc_token_url || ''),
      userinfoUrl: String(row?.oidc_userinfo_url || ''),
      scopes: String(row?.oidc_scopes || 'openid profile email'),
    },
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
  };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isPemCertificate(value: string): boolean {
  return value.includes('BEGIN CERTIFICATE') && value.includes('END CERTIFICATE');
}

function isValidSsoDomain(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
}

function parseOptionalPlainString(
  value: unknown,
  field: string,
  errors: string[],
  fallback: string,
  maxLength = 500
): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`);
    return fallback;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    errors.push(`${field} must be ${maxLength} characters or less`);
    return fallback;
  }
  return trimmed;
}

function parseOptionalHttpsUrl(
  value: unknown,
  field: string,
  errors: string[],
  fallback: string,
  maxLength = 500
): string {
  const trimmed = parseOptionalPlainString(value, field, errors, fallback, maxLength);
  if (trimmed && !isHttpsUrl(trimmed)) {
    errors.push(`${field} must be a valid https:// URL`);
    return fallback;
  }
  return trimmed;
}

function validateSsoSelfConfigUpdate(
  body: unknown,
  current: SsoSelfConfigShape
): { errors: string[]; next: SsoSelfConfigWrite | null } {
  const errors: string[] = [];
  if (!isPlainObject(body)) {
    return { errors: ['Request body must be a JSON object'], next: null };
  }

  const protocol = parseNonEmptyString(
    body.protocol,
    'protocol',
    errors,
    current.protocol,
    10
  ).toLowerCase();
  if (body.protocol !== undefined && !SECURITY_SSO_PROTOCOLS.has(protocol)) {
    errors.push('protocol must be saml or oidc');
  }

  const providerName = parseNonEmptyString(
    body.providerName,
    'providerName',
    errors,
    current.providerName || 'Custom SSO',
    120
  );
  const providerType = parseOptionalPlainString(
    body.providerType,
    'providerType',
    errors,
    current.providerType || 'custom',
    80
  );

  let domains = current.domains;
  if (body.domains !== undefined) {
    if (!Array.isArray(body.domains)) {
      errors.push('domains must be an array of domain strings');
    } else {
      domains = body.domains.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
      if (domains.length > 20) {
        errors.push('domains can contain up to 20 entries');
      }
      const invalidDomain = domains.find((domain) => !isValidSsoDomain(domain));
      if (invalidDomain) {
        errors.push(`"${invalidDomain}" is not a valid domain`);
      }
    }
  }

  const isEnabled = parseOptionalBoolean(body.isEnabled, 'isEnabled', errors, current.isEnabled);

  const samlBody = isPlainObject(body.saml) ? body.saml : {};
  const samlEntityId = parseOptionalPlainString(
    samlBody.entityId,
    'saml.entityId',
    errors,
    current.saml.entityId,
    500
  );
  const samlSsoUrl = parseOptionalHttpsUrl(
    samlBody.ssoUrl,
    'saml.ssoUrl',
    errors,
    current.saml.ssoUrl,
    500
  );
  const samlSloUrl = samlBody.sloUrl
    ? parseOptionalHttpsUrl(samlBody.sloUrl, 'saml.sloUrl', errors, current.saml.sloUrl, 500)
    : current.saml.sloUrl;
  const samlNameIdFormat = parseOptionalPlainString(
    samlBody.nameIdFormat,
    'saml.nameIdFormat',
    errors,
    current.saml.nameIdFormat || 'emailAddress',
    200
  );
  let samlCertificate: string | null = null;
  if (typeof samlBody.certificate === 'string' && samlBody.certificate.trim()) {
    const trimmed = samlBody.certificate.trim();
    if (!isPemCertificate(trimmed)) {
      errors.push('saml.certificate must be a PEM-encoded X.509 certificate');
    } else {
      samlCertificate = trimmed;
    }
  }

  const oidcBody = isPlainObject(body.oidc) ? body.oidc : {};
  const oidcIssuer = parseOptionalHttpsUrl(
    oidcBody.issuer,
    'oidc.issuer',
    errors,
    current.oidc.issuer,
    500
  );
  const oidcClientId = parseOptionalPlainString(
    oidcBody.clientId,
    'oidc.clientId',
    errors,
    current.oidc.clientId,
    200
  );
  const oidcAuthorizationUrl = oidcBody.authorizationUrl
    ? parseOptionalHttpsUrl(
        oidcBody.authorizationUrl,
        'oidc.authorizationUrl',
        errors,
        current.oidc.authorizationUrl,
        500
      )
    : current.oidc.authorizationUrl;
  const oidcTokenUrl = oidcBody.tokenUrl
    ? parseOptionalHttpsUrl(oidcBody.tokenUrl, 'oidc.tokenUrl', errors, current.oidc.tokenUrl, 500)
    : current.oidc.tokenUrl;
  const oidcUserinfoUrl = oidcBody.userinfoUrl
    ? parseOptionalHttpsUrl(
        oidcBody.userinfoUrl,
        'oidc.userinfoUrl',
        errors,
        current.oidc.userinfoUrl,
        500
      )
    : current.oidc.userinfoUrl;
  const oidcScopes = parseOptionalPlainString(
    oidcBody.scopes,
    'oidc.scopes',
    errors,
    current.oidc.scopes || 'openid profile email',
    300
  );
  let oidcClientSecret: string | null = null;
  if (typeof oidcBody.clientSecret === 'string' && oidcBody.clientSecret.trim()) {
    oidcClientSecret = oidcBody.clientSecret.trim();
  }

  if (isEnabled) {
    if (protocol === 'saml') {
      if (!samlEntityId) errors.push('saml.entityId is required to enable SAML SSO');
      if (!samlSsoUrl) errors.push('saml.ssoUrl is required to enable SAML SSO');
      if (!samlCertificate && !current.saml.certificateSet) {
        errors.push('saml.certificate is required to enable SAML SSO');
      }
    } else {
      if (!oidcIssuer) errors.push('oidc.issuer is required to enable OIDC SSO');
      if (!oidcClientId) errors.push('oidc.clientId is required to enable OIDC SSO');
      if (!oidcClientSecret && !current.oidc.clientSecretSet) {
        errors.push('oidc.clientSecret is required to enable OIDC SSO');
      }
    }
  }

  if (errors.length) return { errors, next: null };

  return {
    errors: [],
    next: {
      protocol: SECURITY_SSO_PROTOCOLS.has(protocol)
        ? (protocol as 'saml' | 'oidc')
        : current.protocol,
      providerName,
      providerType,
      domains,
      isEnabled,
      saml: {
        entityId: samlEntityId,
        ssoUrl: samlSsoUrl,
        sloUrl: samlSloUrl,
        nameIdFormat: samlNameIdFormat,
        certificate: samlCertificate,
      },
      oidc: {
        issuer: oidcIssuer,
        clientId: oidcClientId,
        clientSecret: oidcClientSecret,
        authorizationUrl: oidcAuthorizationUrl,
        tokenUrl: oidcTokenUrl,
        userinfoUrl: oidcUserinfoUrl,
        scopes: oidcScopes,
      },
    },
  };
}

/** Readiness check independent of the requested isEnabled flag — used by the
 * "test connection" action so an admin can validate before flipping the
 * switch. Format/completeness only: we deliberately do NOT make an outbound
 * network call to an admin-supplied URL (SSRF risk); this checks shape only. */
function checkSsoSelfReadiness(next: SsoSelfConfigWrite, current: SsoSelfConfigShape): string[] {
  const errors: string[] = [];
  if (next.protocol === 'saml') {
    if (!next.saml.entityId) errors.push('SAML entity ID is required');
    if (!next.saml.ssoUrl) errors.push('SAML SSO URL is required');
    if (!next.saml.certificate && !current.saml.certificateSet) {
      errors.push('X.509 certificate is required');
    }
  } else {
    if (!next.oidc.issuer) errors.push('OIDC issuer is required');
    if (!next.oidc.clientId) errors.push('OIDC client ID is required');
    if (!next.oidc.clientSecret && !current.oidc.clientSecretSet) {
      errors.push('OIDC client secret is required');
    }
  }
  return errors;
}

async function writeSsoSelfConfig(orgId: string, actorId: string, next: SsoSelfConfigWrite) {
  await ensureSsoConfigurationsTable();
  const existing = await dbGet<{ id?: string }>(
    `SELECT id FROM sso_configurations WHERE organization_id = ? LIMIT 1`,
    [orgId],
    { fallback: true }
  );

  const domainsJson = JSON.stringify(next.domains);

  if (existing?.id) {
    // organization_id stays in the WHERE clause — the row this admin can
    // touch is pinned to their own org no matter what the row's PK is.
    await dbRun(
      `UPDATE sso_configurations SET
        protocol = ?, provider_name = ?, provider_type = ?,
        saml_entity_id = ?, saml_sso_url = ?, saml_slo_url = ?, saml_name_id_format = ?,
        saml_certificate = COALESCE(?, saml_certificate),
        oidc_issuer = ?, oidc_client_id = ?, oidc_authorization_url = ?, oidc_token_url = ?, oidc_userinfo_url = ?, oidc_scopes = ?,
        oidc_client_secret = COALESCE(?, oidc_client_secret),
        allowed_domains = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ?`,
      [
        next.protocol,
        next.providerName,
        next.providerType,
        next.saml.entityId,
        next.saml.ssoUrl,
        next.saml.sloUrl,
        next.saml.nameIdFormat,
        next.saml.certificate,
        next.oidc.issuer,
        next.oidc.clientId,
        next.oidc.authorizationUrl,
        next.oidc.tokenUrl,
        next.oidc.userinfoUrl,
        next.oidc.scopes,
        next.oidc.clientSecret,
        domainsJson,
        next.isEnabled ? 1 : 0,
        orgId,
      ]
    );
  } else {
    await dbRun(
      `INSERT INTO sso_configurations (
        id, organization_id, protocol, provider_name, provider_type,
        saml_entity_id, saml_sso_url, saml_slo_url, saml_name_id_format, saml_certificate,
        oidc_issuer, oidc_client_id, oidc_client_secret, oidc_authorization_url, oidc_token_url, oidc_userinfo_url, oidc_scopes,
        allowed_domains, is_enabled, jit_provisioning, default_role, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'member', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        `sso-${uuidv4()}`,
        orgId,
        next.protocol,
        next.providerName,
        next.providerType,
        next.saml.entityId,
        next.saml.ssoUrl,
        next.saml.sloUrl,
        next.saml.nameIdFormat,
        next.saml.certificate,
        next.oidc.issuer,
        next.oidc.clientId,
        next.oidc.clientSecret,
        next.oidc.authorizationUrl,
        next.oidc.tokenUrl,
        next.oidc.userinfoUrl,
        next.oidc.scopes,
        domainsJson,
        next.isEnabled ? 1 : 0,
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
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [
      key,
      JSON.stringify(value),
    ]);
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
      tokenThreshold80: flagOn(alertsRow?.token_threshold_80),
      tokenThreshold90: flagOn(alertsRow?.token_threshold_90),
      tokenThreshold100: flagOn(alertsRow?.token_threshold_100),
      costCapMonthly: Number(alertsRow?.cost_cap_monthly || 0),
      emailNotifications: flagOn(alertsRow?.email_notifications),
    },
    policySnapshot,
  };
}

/**
 * Manual-billing plan assignment (decision D8: manual invoices first).
 *
 * Lets a tenant admin / superadmin assign a subscription plan plus credit (token),
 * storage, seat, and expiry limits to an organization without going through Stripe
 * self-service. Writes to the canonical sources read back by readBillingSummary:
 *   - organization_billing      (plan id, status, current period end / expiry)
 *   - organization_limits       (max_total_tokens, max_storage_mb, max_users, ai calls)
 *   - organizations             (plan label, token_balance, trial_expires_at)
 */
async function assignBillingPlan(
  orgId: string,
  body: Record<string, unknown>
): Promise<
  | { ok: true; summary: Awaited<ReturnType<typeof readBillingSummary>> }
  | { ok: false; validationErrors: string[] }
> {
  const validationErrors: string[] = [];

  const planId = body.planId == null ? null : String(body.planId).trim() || null;
  const planName = body.planName == null ? null : String(body.planName).trim() || null;
  const status = String(body.status || 'active').trim();
  const allowedStatuses = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused'];
  if (!allowedStatuses.includes(status)) {
    validationErrors.push(`status must be one of: ${allowedStatuses.join(', ')}`);
  }

  const toNonNegativeInt = (value: unknown, field: string): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      validationErrors.push(`${field} must be a non-negative integer`);
      return null;
    }
    return parsed;
  };

  const tokenLimit = toNonNegativeInt(body.tokenLimit, 'tokenLimit');
  const storageLimitMb = toNonNegativeInt(body.storageLimitMb, 'storageLimitMb');
  const seats = toNonNegativeInt(body.seats, 'seats');
  const aiCallsPerDay = toNonNegativeInt(body.aiCallsPerDay, 'aiCallsPerDay');
  const tokenBalance = toNonNegativeInt(body.tokenBalance, 'tokenBalance');

  let expiresAt: string | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== '') {
    const ts = Date.parse(String(body.expiresAt));
    if (Number.isNaN(ts)) {
      validationErrors.push('expiresAt must be a valid ISO date');
    } else {
      expiresAt = new Date(ts).toISOString();
    }
  }

  if (planId) {
    const plan = await dbGet<{ id: string }>(
      `SELECT id FROM subscription_plans WHERE id = ? LIMIT 1`,
      [planId],
      { fallback: true }
    );
    if (!plan) validationErrors.push('planId does not match a known subscription plan');
  }

  if (validationErrors.length > 0) {
    return { ok: false, validationErrors };
  }

  // organization_billing (upsert by organization_id, which is UNIQUE)
  const existingBilling = await dbGet<{ id: string }>(
    `SELECT id FROM organization_billing WHERE organization_id = ? LIMIT 1`,
    [orgId],
    { fallback: true }
  );
  if (existingBilling?.id) {
    await dbRun(
      `UPDATE organization_billing
       SET subscription_plan_id = COALESCE(?, subscription_plan_id),
           status = ?,
           current_period_end = COALESCE(?, current_period_end),
           updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ?`,
      [planId, status, expiresAt, orgId]
    );
  } else {
    await dbRun(
      `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, status, current_period_end)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), orgId, planId, status, expiresAt]
    );
  }

  // organization_limits (upsert by organization_id, which is UNIQUE)
  const existingLimits = await dbGet<{ id: string }>(
    `SELECT id FROM organization_limits WHERE organization_id = ? LIMIT 1`,
    [orgId],
    { fallback: true }
  );
  if (existingLimits?.id) {
    await dbRun(
      `UPDATE organization_limits
       SET max_total_tokens = COALESCE(?, max_total_tokens),
           max_storage_mb = COALESCE(?, max_storage_mb),
           max_users = COALESCE(?, max_users),
           max_ai_calls_per_day = COALESCE(?, max_ai_calls_per_day)
       WHERE organization_id = ?`,
      [tokenLimit, storageLimitMb, seats, aiCallsPerDay, orgId]
    );
  } else {
    await dbRun(
      `INSERT INTO organization_limits (id, organization_id, max_total_tokens, max_storage_mb, max_users, max_ai_calls_per_day)
       VALUES (?, ?, COALESCE(?, 100000), COALESCE(?, 100), COALESCE(?, 4), COALESCE(?, 50))`,
      [uuidv4(), orgId, tokenLimit, storageLimitMb, seats, aiCallsPerDay]
    );
  }

  // organizations (plan label, token credit balance, expiry mirror)
  await dbRun(
    `UPDATE organizations
     SET plan = COALESCE(?, plan),
         token_balance = COALESCE(?, token_balance),
         trial_expires_at = COALESCE(?, trial_expires_at)
     WHERE id = ?`,
    [planName, tokenBalance, expiresAt, orgId]
  );

  const summary = await readBillingSummary(orgId);
  return { ok: true, summary };
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

async function readBillingPaymentMethods(orgId: string) {
  const rows = await dbAll<any>(
    `SELECT * FROM payment_methods WHERE organization_id = ? ORDER BY is_default DESC, created_at DESC`,
    [orgId],
    { fallback: true }
  );
  return rows || [];
}

async function createBillingPaymentMethod(orgId: string, body: Record<string, unknown>) {
  const id = uuidv4();
  const paymentMethodId = String(body.paymentMethodId || `pm_${id.slice(0, 8)}`);
  // PCI: never accept raw card number; last4 is cosmetic only (mock billing, DP-11)
  const last4 = paymentMethodId.slice(-4) || '0000';
  const expMonth = Number(body.expiryMonth || 12);
  const expYear = Number(body.expiryYear || new Date().getFullYear() + 1);
  const holder = String(body.cardholderName || 'Card Holder');
  const countRow = (await dbGet<{ count?: number | string }>(
    `SELECT COUNT(*) as count FROM payment_methods WHERE organization_id = ?`,
    [orgId],
    { fallback: true }
  )) || { count: 0 };
  const isDefault = parseInt(String(countRow.count || 0), 10) === 0 ? 1 : 0;
  await dbRun(
    `INSERT INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
     VALUES (?, ?, ?, 'card', ?, ?, ?, ?, ?, ?)`,
    [id, orgId, paymentMethodId, 'Visa', last4, expMonth, expYear, holder, isDefault]
  );
  return dbGet(`SELECT * FROM payment_methods WHERE id = ?`, [id], { fallback: true });
}

async function setDefaultBillingPaymentMethod(orgId: string, paymentMethodId: string) {
  await dbRun(`UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?`, [orgId]);
  await dbRun(`UPDATE payment_methods SET is_default = 1 WHERE id = ? AND organization_id = ?`, [
    paymentMethodId,
    orgId,
  ]);
}

async function deleteBillingPaymentMethod(orgId: string, paymentMethodId: string) {
  const existing = await dbGet<any>(
    `SELECT * FROM payment_methods WHERE id = ? AND organization_id = ?`,
    [paymentMethodId, orgId],
    { fallback: true }
  );
  if (!existing) return { notFound: true, isDefault: false };
  if (Number(existing.is_default || 0) === 1) return { notFound: false, isDefault: true };
  await dbRun(`DELETE FROM payment_methods WHERE id = ? AND organization_id = ?`, [
    paymentMethodId,
    orgId,
  ]);
  return { notFound: false, isDefault: false };
}

async function readBillingInvoices(orgId: string) {
  const rows = await dbAll<any>(
    `SELECT id, invoice_number, status, amount_due, amount_paid, currency, issue_date, due_date, paid_at
     FROM invoices
     WHERE organization_id = ?
     ORDER BY issue_date DESC, created_at DESC
     LIMIT 50`,
    [orgId],
    { fallback: true }
  );
  return rows || [];
}

async function readBillingUsageDetails(orgId: string) {
  const [usageRows, overage, alerts] = await Promise.all([
    dbAll<any>(
      `SELECT metric_name, SUM(quantity) as total, DATE(recorded_at) as date
       FROM usage_records
       WHERE organization_id = ?
       GROUP BY metric_name, DATE(recorded_at)
       ORDER BY date DESC
       LIMIT 100`,
      [orgId],
      { fallback: true }
    ),
    dbGet<any>(
      `SELECT sp.token_overage_rate, sp.storage_overage_rate
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.organization_id = ? AND s.status = 'active'
       LIMIT 1`,
      [orgId],
      { fallback: true }
    ),
    dbGet<any>(`SELECT * FROM billing_alerts WHERE organization_id = ?`, [orgId], {
      fallback: true,
    }),
  ]);
  return {
    usageRecords: usageRows || [],
    overageRates: {
      tokenOverageRate: Number(overage?.token_overage_rate || 0.002),
      storageOverageRate: Number(overage?.storage_overage_rate || 0.1),
      userOverageRate: 5,
    },
    alerts: {
      emailThreshold: flagOn(alerts?.token_threshold_80) ? 0.8 : null,
      costCapMonthly: alerts?.cost_cap_monthly || null,
      emailNotifications: flagOn(alerts?.email_notifications),
    },
  };
}

function generateTenantAccessCode() {
  return `ORG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function ensureAdminAccessCodeTables() {
  await dbRun(`CREATE TABLE IF NOT EXISTS access_codes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'MEMBER',
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
}

async function readAdminAccessCodes(orgId: string) {
  // ensureAdminAccessCodeTables() stays as a safety net for environments where
  // migrations haven't run yet (CREATE TABLE IF NOT EXISTS is a no-op once the
  // real migrated schema exists).
  await ensureAdminAccessCodeTables();
  // Dual-model reconciliation (CTO decision, 2026-07-20): read via
  // AccessCodeService.listCodesByOrganization() instead of raw SQL, so both
  // hash-model (accessCodeService) and legacy-created codes for this org show
  // up with a consistent shape.
  const rows = await AccessCodeService.listCodesByOrganization(orgId);

  return (rows || []).map((row: any) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    code: String(row.code),
    role: normalizeOrganizationRole(row.role),
    maxUses: Number(row.max_uses || 1),
    currentUses: Number(row.current_uses || 0),
    expiresAt: row.expires_at || null,
    createdAt: row.created_at || null,
  }));
}

async function createAdminAccessCode(orgId: string, body: any, createdBy?: string | null) {
  const errors: string[] = [];
  const role = normalizeOrganizationRole(body?.role || 'MEMBER');
  if (!ADMIN_PEOPLE_ROLES.has(role) || role === 'OWNER') {
    errors.push('role must be ADMIN, MEMBER, GUEST, or CONSULTANT');
  }
  const maxUses = parseBoundedInteger(body?.maxUses, 'maxUses', 1, 1000, errors, 1);
  const expiresInDays = parseBoundedInteger(
    body?.expiresInDays,
    'expiresInDays',
    1,
    365,
    errors,
    7
  );
  if (errors.length) return { validationErrors: errors };

  await ensureAdminAccessCodeTables();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  // Dual-model reconciliation (CTO decision, 2026-07-20): create via
  // AccessCodeService.createLegacyCompatCode() instead of a raw INSERT, so
  // the row is valid/visible to both the legacy readers (this file's list
  // above, access-control.routes, auth.routes) AND accessCodeService's
  // hash-lookup validate/accept paths. `code` is pre-generated here to keep
  // the existing "ORG-XXXXXXXX" tenant-code format callers may recognize;
  // `createdBy || 'system'` preserves the prior fallback exactly (created_by
  // is nullable now, but 'system' is the historical sentinel other code
  // paths already expect).
  const code = generateTenantAccessCode();
  const created = await AccessCodeService.createLegacyCompatCode({
    code,
    organizationId: orgId,
    createdByUserId: createdBy || 'system',
    role,
    maxUses,
    expiresAt,
  });

  return {
    code: {
      id: created.id,
      organizationId: orgId,
      code: created.code,
      role,
      maxUses,
      currentUses: 0,
      expiresAt,
    },
  };
}

/**
 * M15-H02 — progi budżetowe muszą być fail-closed.
 *
 * `server/src/utils/DbPromise.ts` ma `fallback = true` DOMYŚLNIE — nie tylko dla
 * `get`/`all`, ale również dla `run`. Na bazie bez tabeli `billing_alerts` (stan
 * demo 2026-08-05) zarówno odczyt, jak i ZAPIS „przechodziły" po cichu: `SELECT`
 * zwracał `null`, `INSERT` połykał `42P01`, a handler i tak odpowiadał
 * `{ success: true }`. Administrator dostawał zielony toast za zapis, który nigdy
 * się nie wydarzył, a po ponownym otwarciu widział te same sfabrykowane wartości.
 *
 * Odtąd KAŻDA ścieżka progów jawnie wyłącza fallback i traktuje brak trwałego
 * wiersza jako niedostępność magazynu — nigdy jako „zapisane". Odczyt degraduje
 * się uczciwie (200 + `available:false` + PUSTA lista, żeby nie wywalić całej
 * sekcji Rozliczenia), zapis jest fail-closed (5xx, bez wpisu audytowego).
 */
const BILLING_ALERTS_UNAVAILABLE_CODE = 'BILLING_ALERTS_STORAGE_UNAVAILABLE';

class BillingAlertsUnavailableError extends Error {
  readonly code = BILLING_ALERTS_UNAVAILABLE_CODE;

  constructor(readonly reason: string) {
    super('Billing alert thresholds could not be persisted or read back.');
    this.name = 'BillingAlertsUnavailableError';
  }
}

/** Odczyt bez fallbacku — brak tabeli MUSI rzucić, nie udawać pustki. */
function selectBillingAlertsRow(orgId: string) {
  return dbGet<any>(`SELECT * FROM billing_alerts WHERE organization_id = ?`, [orgId], {
    fallback: false,
  });
}

/** Alerty budujemy WYŁĄCZNIE z realnie utrwalonego wiersza. */
function mapBillingAlertsRow(record: any) {
  return [
    {
      id: record.id,
      type: 'tokens',
      threshold: 80,
      notifyEmails: ['billing@example.com'],
      isActive: flagOn(record.token_threshold_80),
    },
    {
      id: `${record.id}-spend`,
      type: 'spend',
      threshold: record.cost_cap_monthly ? 75 : 0,
      notifyEmails: ['finance@example.com'],
      isActive: true,
    },
  ];
}

async function readBillingAlerts(orgId: string) {
  try {
    let record = await selectBillingAlertsRow(orgId);
    if (!record) {
      await dbRun(
        `INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100, cost_cap_monthly, email_notifications)
         VALUES (?, ?, 1, 1, 1, 2000, 1)`,
        [uuidv4(), orgId],
        { fallback: false }
      );
      record = await selectBillingAlertsRow(orgId);
    }
    // Read-back jest autorytetem: bez wiersza nie ma czego pokazać jako „ustawione".
    if (!record) {
      return {
        available: false,
        unavailableReason: BILLING_ALERTS_UNAVAILABLE_CODE,
        alerts: [] as any[],
      };
    }
    return { available: true, alerts: mapBillingAlertsRow(record) };
  } catch {
    return {
      available: false,
      unavailableReason: BILLING_ALERTS_UNAVAILABLE_CODE,
      alerts: [] as any[],
    };
  }
}

/**
 * Zapis progów. Rzuca `BillingAlertsUnavailableError`, gdy zapis albo tenantowy
 * read-back nie potwierdzi danych — wywołujący MUSI wtedy odpowiedzieć błędem.
 * Zwraca stan potwierdzony przez bazę, żeby UI nie musiał ufać własnemu stanowi.
 */
async function writeBillingAlerts(orgId: string, alerts: any[]) {
  const tokenAlert = alerts?.find((item: any) => item.type === 'tokens');
  const spendAlert = alerts?.find((item: any) => item.type === 'spend');
  const expectedTokenFlag = tokenAlert ? 1 : 0;
  const expectedCostCap = spendAlert?.threshold ? spendAlert.threshold * 1 : null;

  try {
    await dbRun(
      `INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100, cost_cap_monthly, email_notifications)
       VALUES (?, ?, ?, 1, 1, ?, 1)
       ON CONFLICT(organization_id) DO UPDATE SET
         token_threshold_80 = excluded.token_threshold_80,
         cost_cap_monthly = excluded.cost_cap_monthly,
         updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), orgId, expectedTokenFlag, expectedCostCap],
      { fallback: false }
    );
  } catch (error) {
    throw new BillingAlertsUnavailableError(
      `write failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let record: any = null;
  try {
    record = await selectBillingAlertsRow(orgId);
  } catch (error) {
    throw new BillingAlertsUnavailableError(
      `read-back failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!record) {
    throw new BillingAlertsUnavailableError('read-back returned no row for this organization');
  }

  // Read-back musi ZGADZAĆ SIĘ z tym, co wysłaliśmy. Zapis, który „przeszedł",
  // ale nie zmienił wiersza (0 rows affected, konflikt bez efektu), nie jest sukcesem.
  const persistedTokenFlag = flagOn(record.token_threshold_80) ? 1 : 0;
  const persistedCostCap =
    record.cost_cap_monthly === null || record.cost_cap_monthly === undefined
      ? null
      : Number(record.cost_cap_monthly);

  if (persistedTokenFlag !== expectedTokenFlag || persistedCostCap !== expectedCostCap) {
    throw new BillingAlertsUnavailableError(
      `read-back mismatch: tokenFlag ${persistedTokenFlag}!=${expectedTokenFlag} or costCap ${persistedCostCap}!=${expectedCostCap}`
    );
  }

  return { alerts: mapBillingAlertsRow(record) };
}

async function readBillingTaxSettings(orgId: string) {
  const settings = await dbGet<any>(
    `SELECT * FROM billing_tax_settings WHERE organization_id = ?`,
    [orgId],
    { fallback: true }
  );
  if (!settings) {
    return {
      company: { legalName: null, billingEmail: null },
      tax: { taxIdType: null, taxId: null, taxExempt: false },
      address: {
        line1: null,
        line2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
      },
      invoicePrefix: null,
      poNumber: null,
    };
  }

  return {
    company: {
      legalName: settings.billing_name,
      billingEmail: settings.billing_email,
    },
    tax: {
      taxIdType: settings.tax_id_type,
      taxId: settings.tax_id,
      taxExempt: flagOn(settings.tax_exempt),
    },
    address: {
      line1: settings.billing_address_line1,
      line2: settings.billing_address_line2,
      city: settings.billing_city,
      state: settings.billing_state,
      postalCode: settings.billing_postal_code,
      country: settings.billing_country,
    },
    invoicePrefix: settings.invoice_prefix,
    poNumber: settings.po_number,
  };
}

async function writeBillingTaxSettings(orgId: string, body: any) {
  const { company, tax, address, invoicePrefix, poNumber } = body || {};
  await dbRun(
    `INSERT INTO billing_tax_settings (id, organization_id, tax_id, tax_id_type, tax_exempt, billing_name, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, invoice_prefix, po_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(organization_id) DO UPDATE SET
       tax_id=excluded.tax_id,
       tax_id_type=excluded.tax_id_type,
       tax_exempt=excluded.tax_exempt,
       billing_name=excluded.billing_name,
       billing_email=excluded.billing_email,
       billing_address_line1=excluded.billing_address_line1,
       billing_address_line2=excluded.billing_address_line2,
       billing_city=excluded.billing_city,
       billing_state=excluded.billing_state,
       billing_postal_code=excluded.billing_postal_code,
       billing_country=excluded.billing_country,
       invoice_prefix=excluded.invoice_prefix,
       po_number=excluded.po_number`,
    [
      uuidv4(),
      orgId,
      tax?.taxId || null,
      tax?.taxIdType || null,
      tax?.taxExempt ? 1 : 0,
      company?.legalName || null,
      company?.billingEmail || null,
      address?.line1 || null,
      address?.line2 || null,
      address?.city || null,
      address?.state || null,
      address?.postalCode || null,
      address?.country || null,
      invoicePrefix || null,
      poNumber || null,
    ]
  );
}

async function readComplianceSummary(orgId: string) {
  const rows = await dbAll<any>(
    `SELECT setting_type, settings_data, enabled, updated_at, updated_by
     FROM compliance_settings
     WHERE organization_id = ?`,
    [orgId],
    { fallback: true }
  );
  const byType = new Map((rows || []).map((row: any) => [String(row.setting_type), row]));
  const gdpr = byType.get('gdpr');
  const cookies = byType.get('cookies');
  const retention = byType.get('data_retention');
  return {
    gdpr: gdpr
      ? {
          enabled: !!gdpr.enabled,
          ...parseJson(gdpr.settings_data, { features: [] }),
          lastUpdated: gdpr.updated_at,
        }
      : { enabled: false, features: [], lastUpdated: null },
    cookies: cookies
      ? {
          enabled: !!cookies.enabled,
          ...parseJson(cookies.settings_data, {}),
          lastUpdated: cookies.updated_at,
        }
      : { enabled: false, lastUpdated: null },
    dataRetention: retention
      ? parseJson(retention.settings_data, {
          userDataRetentionDays: 365,
          auditLogRetentionDays: 730,
          backupRetentionDays: 90,
          anonymizeInactiveUsers: false,
          inactiveUserDays: 365,
        })
      : {
          userDataRetentionDays: 365,
          auditLogRetentionDays: 730,
          backupRetentionDays: 90,
          anonymizeInactiveUsers: false,
          inactiveUserDays: 365,
        },
  };
}

async function writeComplianceSetting(
  orgId: string,
  actorId: string,
  type: string,
  enabled: boolean,
  data: any
) {
  await dbRun(
    `INSERT INTO compliance_settings (id, organization_id, setting_type, settings_data, enabled, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(organization_id, setting_type) DO UPDATE SET
       settings_data = excluded.settings_data,
       enabled = excluded.enabled,
       updated_by = excluded.updated_by,
       updated_at = datetime('now')`,
    [uuidv4(), orgId, type, JSON.stringify(data), enabled ? 1 : 0, actorId]
  );
}

async function readScimSummary(orgId: string) {
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_tokens (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    token_hash TEXT,
    token_prefix TEXT,
    organization_id TEXT,
    scopes TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_group_mappings (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    external_group_id TEXT,
    external_group_name TEXT,
    internal_role TEXT,
    custom_role_id TEXT,
    project_id TEXT,
    is_active INTEGER DEFAULT 1,
    auto_sync INTEGER DEFAULT 1,
    member_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_sync_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    operation TEXT,
    resource_type TEXT,
    resource_id TEXT,
    external_id TEXT,
    status TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_conflict_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    conflict_type TEXT,
    resource_type TEXT,
    external_id TEXT,
    internal_id TEXT,
    details_json TEXT,
    resolution TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  // HP-25 B2: read group mappings with an optional per-project dimension.
  // `project_id` ships via a manual (non-auto-run) migration; when it is not
  // yet applied the read degrades to the legacy org-wide shape rather than
  // returning zero rows (a bare `SELECT project_id` would be swallowed to []).
  const hasProjectDim = await scimMappingsHasProjectId();
  const groupMappingsSql = hasProjectDim
    ? `SELECT m.id, m.external_group_id, m.external_group_name, m.internal_role,
              m.is_active, m.member_count, m.project_id, p.name AS project_name
       FROM scim_group_mappings m
       LEFT JOIN projects p
         ON p.id = m.project_id AND p.organization_id = m.organization_id
       WHERE m.organization_id = ? ORDER BY m.created_at DESC`
    : `SELECT id, external_group_id, external_group_name, internal_role, is_active, member_count
       FROM scim_group_mappings WHERE organization_id = ? ORDER BY created_at DESC`;

  const [tokens, mappings, syncLogs, conflicts] = await Promise.all([
    dbAll<any>(
      `SELECT id, name, token_prefix, scopes, last_used_at, usage_count, is_active
       FROM scim_tokens WHERE organization_id = ? ORDER BY created_at DESC`,
      [orgId],
      { fallback: true }
    ),
    dbAll<any>(groupMappingsSql, [orgId], { fallback: true }),
    dbAll<any>(
      `SELECT id, operation, resource_type, status, error_message, created_at
       FROM scim_sync_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`,
      [orgId],
      { fallback: true }
    ),
    dbAll<any>(
      `SELECT id, conflict_type, resource_type, resolution, created_at
       FROM scim_conflict_log WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`,
      [orgId],
      { fallback: true }
    ),
  ]);
  return {
    tokens: tokens || [],
    groupMappings: mappings || [],
    syncLogs: syncLogs || [],
    conflicts: conflicts || [],
  };
}

async function createScimToken(orgId: string, name: string, description: string, scopes: string[]) {
  await readScimSummary(orgId);
  const id = uuidv4();
  const rawToken = `scim_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenPrefix = rawToken.substring(0, 12);
  await dbRun(
    `INSERT INTO scim_tokens (id, name, description, token_hash, token_prefix, organization_id, scopes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description || null, tokenHash, tokenPrefix, orgId, JSON.stringify(scopes || [])]
  );
  return { id, name, description, tokenPrefix, organizationId: orgId, scopes, token: rawToken };
}

async function deleteScimToken(orgId: string, id: string) {
  await readScimSummary(orgId);
  await dbRun(`DELETE FROM scim_tokens WHERE id = ? AND organization_id = ?`, [id, orgId]);
}

async function deleteScimGroupMapping(orgId: string, id: string) {
  await dbRun(`DELETE FROM scim_group_mappings WHERE id = ? AND organization_id = ?`, [id, orgId]);
}

async function readRiskSummary(orgId: string) {
  const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0, organizationId: orgId });
  const scoped = logs.filter((log: any) => matchesAuditFilter(log, orgId, {}));
  let llmIncidents: any[] = [];
  try {
    llmIncidents =
      (await dbAll<any>(
        `SELECT id, provider, status, started_at, resolved_at, severity
       FROM llm_incidents
       ORDER BY started_at DESC
       LIMIT 20`,
        [],
        { fallback: true }
      )) || [];
  } catch {
    llmIncidents = [];
  }
  return {
    audit: {
      totalLogs: scoped.length,
      unresolvedCount: scoped.filter((log: any) => log.status !== 'resolved').length,
      highRiskCount: scoped.filter((log: any) => Number(log.risk_score || 0) >= 60).length,
    },
    incidents: llmIncidents,
  };
}

async function createAdminRoleAssignment(orgId: string, actorId: string, body: any) {
  await ensureAdminGovernanceTables();
  const id = uuidv4();
  const roleId = String(body.roleId || '');
  const roleName = String(body.roleName || roleId || 'Delegated Admin');
  const capabilities = Array.isArray(body.capabilities) ? body.capabilities.map(String) : [];
  const userId = String(body.userId || '');
  const expiresAt = body.expiresAt ? String(body.expiresAt) : null;
  await dbRun(
    `INSERT OR REPLACE INTO admin_role_assignments (id, organization_id, user_id, role_id, role_name, capabilities_json, expires_at, created_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, orgId, userId, roleId, roleName, JSON.stringify(capabilities), expiresAt, actorId]
  );
  return { id, userId, roleId, roleName, capabilities, expiresAt };
}

function matchesAuditFilter(log: any, orgId: string, filters: Record<string, string>) {
  const metadata = parseJson<Record<string, unknown>>(log.metadata_json, {});
  const logOrgId = String(
    metadata.orgId || metadata.organizationId || (metadata.details as any)?.orgId || ''
  ).trim();

  if (logOrgId !== orgId) return false;
  if (filters.actionType && String(log.action_type) !== filters.actionType) return false;
  if (filters.status && String(log.status) !== filters.status) return false;
  if (filters.riskScoreMin && Number(log.risk_score || 0) < Number(filters.riskScoreMin))
    return false;
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

async function readAuditStatsForOrg(orgId: string) {
  try {
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0, organizationId: orgId });
    const scoped = logs.filter((log: any) => matchesAuditFilter(log, orgId, {}));
    return {
      totalLogs: scoped.length,
      unresolvedCount: scoped.filter((log: any) => log.status !== 'resolved').length,
      highRiskCount: scoped.filter((log: any) => Number(log.risk_score || 0) >= 60).length,
      status: 'ok',
    };
  } catch {
    return {
      totalLogs: 0,
      unresolvedCount: 0,
      highRiskCount: 0,
      status: 'not_configured',
      reason: 'Admin audit log storage is not available for this organization yet.',
    };
  }
}

async function handleGetSecurityPolicy(req: AuthRequest, res: Response) {
  const actor = await getAdminActor(req, res, ['security:read']);
  if (!actor) return;
  const { orgId } = actor;
  const policy = await readSecuritySettings(orgId);
  return res.json({ organizationId: orgId, policy });
}

async function handleUpdateSecurityPolicy(req: AuthRequest, res: Response) {
  const actor = await getAdminActor(req, res, ['security:write']);
  if (!actor) return;
  const { orgId, actorId } = actor;
  const current = await readSecuritySettings(orgId);
  const { errors, next } = validateSecuritySettingsUpdate(req.body, current);
  if (errors.length) return sendValidationError(res, errors);

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
}

router.use(verifyToken);

router.get(
  '/people',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['people:read']);
    if (!actor) return;
    const members = await readAdminPeople(actor.orgId);
    return res.json({ organizationId: actor.orgId, members });
  })
);

router.post(
  '/people',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['people:write']);
    if (!actor) return;
    const outcome = await createAdminPeopleMember(
      actor.orgId,
      actor.actorId,
      actor.actorRole,
      req.body || {}
    );
    if ('validationErrors' in outcome)
      return sendValidationError(res, outcome.validationErrors || []);
    if ('notFound' in outcome) return res.status(404).json(outcome.notFound);
    if ('conflict' in outcome) return res.status(409).json(outcome.conflict);

    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'add_admin_people_member',
      details: {
        orgId: actor.orgId,
        isSensitive: true,
        memberId: outcome.member.userId,
        role: outcome.member.role,
      },
    });

    return res.status(201).json({ success: true, member: outcome.member });
  })
);

router.get(
  '/access-codes',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['people:read']);
    if (!actor) return;
    const codes = await readAdminAccessCodes(actor.orgId);
    return res.json({ organizationId: actor.orgId, codes });
  })
);

router.post(
  '/access-codes',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['people:write']);
    if (!actor) return;
    const outcome = await createAdminAccessCode(actor.orgId, req.body || {}, actor.actorId);
    if ('validationErrors' in outcome)
      return sendValidationError(res, outcome.validationErrors || []);

    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'generate_tenant_access_code',
      details: {
        orgId: actor.orgId,
        isSensitive: true,
        codeId: outcome.code.id,
        role: outcome.code.role,
        maxUses: outcome.code.maxUses,
      },
    });

    return res.status(201).json({ success: true, code: outcome.code });
  })
);

router.get(
  '/overview',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res);
    if (!actor) return;
    const { orgId, capabilities } = actor;
    const canReadPeople = hasCapability(capabilities, ['people:read']);
    const canReadBilling = hasCapability(capabilities, ['billing:read']);
    const canReadSecurity = hasCapability(capabilities, ['security:read']);
    const canReadAi = hasCapability(capabilities, ['ai:read', 'ai:governance', 'ai:operations']);
    const canReadAudit = hasCapability(capabilities, ['audit:read']);
    const sectionErrors: Record<string, string> = {};

    if (!canReadPeople) {
      sectionErrors.people = 'People overview requires people:read capability.';
      sectionErrors.ownership = 'Ownership transfer overview requires people:read capability.';
    }
    if (!canReadBilling)
      sectionErrors.billing = 'Billing overview requires billing:read capability.';
    if (!canReadSecurity) {
      sectionErrors.security = 'Security overview requires security:read capability.';
      sectionErrors.collaboration = 'Collaboration overview requires security:read capability.';
    }
    if (!canReadAi) sectionErrors.ai = 'AI overview requires AI admin capability.';
    if (!canReadAudit) sectionErrors.audit = 'Audit overview requires audit:read capability.';

    const [
      memberRows,
      ownershipTransfers,
      billingSummary,
      aiSummary,
      securityPolicy,
      collaboration,
      auditStats,
    ] = await Promise.all([
      canReadPeople
        ? dbAll<{ role?: string; total?: number }>(
            `SELECT role, COUNT(*) as total FROM organization_members WHERE organization_id = ? GROUP BY role`,
            [orgId],
            { fallback: true }
          )
        : Promise.resolve([]),
      canReadPeople
        ? dbGet<{ total?: number }>(
            `SELECT COUNT(*) as total FROM ownership_transfer_requests WHERE organization_id = ? AND status = 'pending'`,
            [orgId],
            { fallback: true }
          )
        : Promise.resolve(null),
      canReadBilling ? readBillingSummary(orgId) : Promise.resolve(null),
      canReadAi ? readAiSummary(orgId) : Promise.resolve(null),
      canReadSecurity ? readSecuritySettings(orgId) : Promise.resolve(null),
      canReadSecurity ? readCollaborationControls(orgId) : Promise.resolve(null),
      canReadAudit ? readAuditStatsForOrg(orgId) : Promise.resolve(null),
    ]);

    const membersByRole = Object.fromEntries(
      memberRows.map((row) => [String(row.role || 'unknown').toUpperCase(), Number(row.total || 0)])
    );

    return res.json({
      organizationId: orgId,
      sectionErrors,
      overview: {
        membersByRole,
        totalMembers: canReadPeople
          ? Object.values(membersByRole).reduce((sum, value) => sum + Number(value), 0)
          : null,
        pendingOwnershipTransfers: canReadPeople ? Number(ownershipTransfers?.total || 0) : null,
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
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const summary = await readBillingSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.get(
  '/billing/plans',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const plans = await dbAll<Record<string, unknown>>(
      `SELECT id, name, price_monthly, token_limit, storage_limit_gb
       FROM subscription_plans
       WHERE is_active = 1
       ORDER BY sort_order ASC, price_monthly ASC`,
      [],
      { fallback: true }
    );
    return res.json({ plans: plans || [] });
  })
);

router.put(
  '/billing/plan',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:write']);
    if (!actor) return;
    const outcome = await assignBillingPlan(actor.orgId, req.body || {});
    if (outcome.ok === false) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        validationErrors: outcome.validationErrors,
      });
    }
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'update_billing',
      details: {
        orgId: actor.orgId,
        isSensitive: true,
        planId: (req.body || {}).planId ?? null,
        planName: (req.body || {}).planName ?? null,
        tokenLimit: (req.body || {}).tokenLimit ?? null,
        storageLimitMb: (req.body || {}).storageLimitMb ?? null,
        seats: (req.body || {}).seats ?? null,
        expiresAt: (req.body || {}).expiresAt ?? null,
      },
    });
    return res.json({ success: true, summary: outcome.summary });
  })
);

router.get(
  '/ai/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['ai:read', 'ai:governance', 'ai:operations']);
    if (!actor) return;
    const summary = await readAiSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.get(
  '/iam/policy',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['iam:read']);
    if (!actor) return;
    const policy = await readAdminIamPolicy(actor.orgId);
    return res.json({ organizationId: actor.orgId, policy });
  })
);

router.put(
  '/iam/policy',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['iam:write']);
    if (!actor) return;
    const current = await readAdminIamPolicy(actor.orgId);
    const body = req.body || {};
    const next: AdminIamPolicy = {
      delegatedRoles: Array.isArray(body.delegatedRoles)
        ? body.delegatedRoles
        : current.delegatedRoles,
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
  '/iam/assignments',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['iam:read']);
    if (!actor) return;
    const assignments = await readAdminRoleAssignments(actor.orgId);
    return res.json({ organizationId: actor.orgId, assignments });
  })
);

router.post(
  '/iam/assignments',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['iam:write']);
    if (!actor) return;
    const assignment = await createAdminRoleAssignment(actor.orgId, actor.actorId, req.body || {});
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'assign_delegated_admin_role',
      details: { orgId: actor.orgId, isSensitive: true, assignment },
    });
    return res.status(201).json({ success: true, assignment });
  })
);

router.delete(
  '/iam/assignments/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['iam:write']);
    if (!actor) return;
    await ensureAdminGovernanceTables();
    await dbRun(`DELETE FROM admin_role_assignments WHERE id = ? AND organization_id = ?`, [
      req.params.id,
      actor.orgId,
    ]);
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'revoke_delegated_admin_role',
      details: { orgId: actor.orgId, isSensitive: true, assignmentId: req.params.id },
    });
    return res.json({ success: true });
  })
);

router.get(
  '/billing/payment-methods',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const paymentMethods = await readBillingPaymentMethods(actor.orgId);
    return res.json({ organizationId: actor.orgId, paymentMethods });
  })
);

router.post(
  '/billing/payment-methods',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:write']);
    if (!actor) return;
    const paymentMethod = await createBillingPaymentMethod(actor.orgId, req.body || {});
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'add_billing_payment_method',
      details: { orgId: actor.orgId, isSensitive: true, paymentMethodId: paymentMethod?.id },
    });
    return res.status(201).json({ paymentMethod });
  })
);

router.put(
  '/billing/payment-methods/:id/default',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:write']);
    if (!actor) return;
    await setDefaultBillingPaymentMethod(actor.orgId, req.params.id);
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'set_default_payment_method',
      details: { orgId: actor.orgId, isSensitive: true, paymentMethodId: req.params.id },
    });
    return res.json({ success: true });
  })
);

router.delete(
  '/billing/payment-methods/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:write']);
    if (!actor) return;
    const outcome = await deleteBillingPaymentMethod(actor.orgId, req.params.id);
    if (outcome.notFound) return res.status(404).json({ error: 'Payment method not found' });
    if (outcome.isDefault)
      return res.status(409).json({ error: 'Cannot remove default payment method' });
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'remove_payment_method',
      details: { orgId: actor.orgId, isSensitive: true, paymentMethodId: req.params.id },
    });
    return res.json({ success: true });
  })
);

router.get(
  '/billing/invoices',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const invoices = await readBillingInvoices(actor.orgId);
    return res.json({ organizationId: actor.orgId, invoices });
  })
);

router.get(
  '/billing/usage-details',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const summary = await readBillingUsageDetails(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.get(
  '/billing/alerts',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const data = await readBillingAlerts(actor.orgId);
    return res.json({ organizationId: actor.orgId, ...data });
  })
);

router.put(
  '/billing/alerts',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:write']);
    if (!actor) return;

    let persisted: { alerts: any[] };
    try {
      persisted = await writeBillingAlerts(actor.orgId, req.body?.alerts || []);
    } catch (error) {
      if (error instanceof BillingAlertsUnavailableError) {
        // Fail-closed: żadnego `success`, żadnego wpisu audytowego o zmianie,
        // która się nie wydarzyła (M15-H02).
        return res.status(503).json({
          success: false,
          error: 'billing_alerts_unavailable',
          code: error.code,
          message:
            'Nie udało się trwale zapisać progów budżetowych. Ustawienia pozostały bez zmian.',
        });
      }
      throw error;
    }

    // Audyt dopiero po potwierdzonym read-backu.
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'update_billing_alerts',
      details: { orgId: actor.orgId, isSensitive: true },
    });
    return res.json({ success: true, alerts: persisted.alerts });
  })
);

router.get(
  '/billing/tax-settings',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:read']);
    if (!actor) return;
    const settings = await readBillingTaxSettings(actor.orgId);
    return res.json({ organizationId: actor.orgId, settings });
  })
);

router.put(
  '/billing/tax-settings',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['billing:write']);
    if (!actor) return;
    await writeBillingTaxSettings(actor.orgId, req.body || {});
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'update_billing_tax_settings',
      details: { orgId: actor.orgId, isSensitive: true },
    });
    return res.json({ success: true });
  })
);

router.get(
  '/compliance/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['compliance:read']);
    if (!actor) return;
    const summary = await readComplianceSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.put(
  '/compliance/data-retention',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['compliance:write']);
    if (!actor) return;
    await writeComplianceSetting(
      actor.orgId,
      actor.actorId,
      'data_retention',
      true,
      req.body || {}
    );
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'update_data_retention_policy',
      details: { orgId: actor.orgId, isSensitive: true },
    });
    return res.json({ success: true });
  })
);

router.get(
  '/identity/scim',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:read']);
    if (!actor) return;
    const summary = await readScimSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.post(
  '/identity/scim/tokens',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:write']);
    if (!actor) return;
    const token = await createScimToken(
      actor.orgId,
      String(req.body?.name || 'Tenant SCIM Token'),
      String(req.body?.description || ''),
      Array.isArray(req.body?.scopes) ? req.body.scopes.map(String) : ['users:read', 'users:write']
    );
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'create_scim_token',
      details: { orgId: actor.orgId, isSensitive: true, tokenId: token.id },
    });
    return res.status(201).json({ success: true, token });
  })
);

router.delete(
  '/identity/scim/tokens/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:write']);
    if (!actor) return;
    await deleteScimToken(actor.orgId, req.params.id);
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'revoke_scim_token',
      details: { orgId: actor.orgId, isSensitive: true, tokenId: req.params.id },
    });
    return res.json({ success: true });
  })
);

router.post(
  '/identity/scim/group-mappings',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:write']);
    if (!actor) return;
    // ★ Org-scope: orgId comes from the authenticated actor, never the body.
    // projectId is optional and is validated inside the service to belong to
    // this org before any write (cross-org / IDOR guard on the P1 table).
    const rawProjectId = req.body?.projectId;
    try {
      const mapping = await insertScimGroupMapping({
        orgId: actor.orgId,
        externalGroupName: String(req.body?.externalGroupName || ''),
        externalGroupId: String(req.body?.externalGroupId || ''),
        internalRole: String(req.body?.internalRole || 'member'),
        projectId: rawProjectId ? String(rawProjectId) : null,
      });
      await adminAuditService.logAction({
        adminId: actor.actorId,
        actionType: 'create_scim_group_mapping',
        details: {
          orgId: actor.orgId,
          isSensitive: true,
          mappingId: mapping.id,
          projectId: mapping.projectId,
          projectScoped: mapping.projectIdApplied,
        },
      });
      return res.status(201).json({ success: true, mapping });
    } catch (error) {
      if (error instanceof ScimGroupMappingError) {
        const status = error.code === 'PROJECT_NOT_IN_ORG' ? 404 : 400;
        return res.status(status).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  })
);

router.delete(
  '/identity/scim/group-mappings/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:write']);
    if (!actor) return;
    await deleteScimGroupMapping(actor.orgId, req.params.id);
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'delete_scim_group_mapping',
      details: { orgId: actor.orgId, isSensitive: true, mappingId: req.params.id },
    });
    return res.json({ success: true });
  })
);

router.get(
  '/risk/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['audit:read']);
    if (!actor) return;
    const summary = await readRiskSummary(actor.orgId);
    return res.json({ organizationId: actor.orgId, summary });
  })
);

router.get(['/security', '/security/policy'], asyncHandler(handleGetSecurityPolicy));

router.put(['/security', '/security/policy'], asyncHandler(handleUpdateSecurityPolicy));

// ── HP-24: SSO self-service (org-scoped, never superadmin-only) ──
// Mounted at /api/admin/sso-self by Gateway.ts (adminP32Routes → '/api/admin').

router.get(
  '/sso-self',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:read']);
    if (!actor) return;
    const config = await readSsoSelfConfig(actor.orgId);
    return res.json({ organizationId: actor.orgId, config });
  })
);

router.put(
  '/sso-self',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:write']);
    if (!actor) return;
    const current = await readSsoSelfConfig(actor.orgId);
    const { errors, next } = validateSsoSelfConfigUpdate(req.body, current);
    if (errors.length || !next) return sendValidationError(res, errors);

    await writeSsoSelfConfig(actor.orgId, actor.actorId, next);
    await adminAuditService.logAction({
      adminId: actor.actorId,
      actionType: 'update_sso_self_config',
      details: {
        orgId: actor.orgId,
        isSensitive: true,
        protocol: next.protocol,
        isEnabled: next.isEnabled,
      },
    });

    const updated = await readSsoSelfConfig(actor.orgId);
    return res.json({ success: true, config: updated });
  })
);

router.post(
  '/sso-self/validate',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:read']);
    if (!actor) return;
    const current = await readSsoSelfConfig(actor.orgId);
    // Force isEnabled=true for this pass so the readiness check runs
    // regardless of the switch's current requested state (a "test
    // connection" preview should tell you what's missing before you flip it).
    const bodyForValidation = isPlainObject(req.body)
      ? { ...req.body, isEnabled: true }
      : { isEnabled: true };
    const { errors, next } = validateSsoSelfConfigUpdate(bodyForValidation, current);
    if (!next) return res.json({ valid: false, errors });
    const readinessErrors = checkSsoSelfReadiness(next, current);
    return res.json({ valid: readinessErrors.length === 0, errors: readinessErrors });
  })
);

router.get(
  '/collaboration',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:read']);
    if (!actor) return;
    const { orgId } = actor;
    const controls = await readCollaborationControls(orgId);
    return res.json({ organizationId: orgId, controls });
  })
);

router.put(
  '/collaboration',
  asyncHandler(async (req: AuthRequest, res) => {
    const actor = await getAdminActor(req, res, ['security:write']);
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
    const actor = await getAdminActor(req, res, ['audit:read']);
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
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0, organizationId: orgId });
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
    const actor = await getAdminActor(req, res, ['audit:read']);
    if (!actor) return;
    const { orgId } = actor;
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0, organizationId: orgId });
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
    const actor = await getAdminActor(req, res, ['audit:export', 'audit:read']);
    if (!actor) return;
    const { orgId } = actor;
    const logs = await adminAuditService.getLogs({ limit: 1000, offset: 0, organizationId: orgId });
    const scoped = logs.filter((log: any) =>
      matchesAuditFilter(log, orgId, { actionType: '', status: '', riskScoreMin: '', search: '' })
    );
    const headers = [
      'id',
      'admin_id',
      'action_type',
      'risk_score',
      'risk_level',
      'status',
      'created_at',
    ];
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
