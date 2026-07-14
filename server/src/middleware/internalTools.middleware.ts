import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

const DEFAULT_ALLOWED_EMAIL_DOMAINS = ['dbr77.com'];
const DEFAULT_ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN', 'OWNER'];

const MAX_CSV_ENV_LENGTH = 2048;
const MAX_EMAIL_LOCAL = 64;
const MAX_EMAIL_DOMAIN = 253;
const MAX_ROLE_LENGTH = 64;
const MAX_ORG_ID_LENGTH = 128;

function hasControlChar(s: string): boolean {
  // eslint-disable-next-line no-control-regex -- sanityzacja: celowa detekcja znaków kontrolnych w nagłówkach
  return /[\x00-\x1F\x7F]/.test(s);
}

function isValidEmailString(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (hasControlChar(v)) return false;
  const atCount = (v.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  const atIdx = v.indexOf('@');
  const local = v.slice(0, atIdx);
  const domain = v.slice(atIdx + 1);
  // local-part: length 1-64, no whitespace, no consecutive dots
  if (local.length < 1 || local.length > MAX_EMAIL_LOCAL) return false;
  if (/\s/.test(local)) return false;
  if (local.includes('..')) return false;
  // domain: length 1-253, no non-ASCII, no whitespace, no consecutive dots
  if (domain.length < 1 || domain.length > MAX_EMAIL_DOMAIN) return false;
  // eslint-disable-next-line no-control-regex -- sanityzacja: celowa detekcja znaków kontrolnych
  if (/[^\x00-\x7F]/.test(domain)) return false;
  if (/\s/.test(domain)) return false;
  if (domain.includes('..')) return false;
  return true;
}

function isValidRoleString(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (hasControlChar(v)) return false;
  if (v.length > MAX_ROLE_LENGTH) return false;
  return true;
}

function isValidDomainToken(t: string): boolean {
  if (hasControlChar(t)) return false;
  if (t.length < 1 || t.length > MAX_EMAIL_DOMAIN) return false;
  if (t.startsWith('.')) return false;
  if (t.includes('..')) return false;
  // eslint-disable-next-line no-control-regex -- sanityzacja: celowa detekcja znaków kontrolnych
  if (/[^\x00-\x7F]/.test(t)) return false;
  return true;
}

function isValidOrgIdToken(t: string): boolean {
  if (hasControlChar(t)) return false;
  if (t.includes('/') || t.includes('\\') || t.includes('..')) return false;
  if (t.length > MAX_ORG_ID_LENGTH) return false;
  return true;
}

function isValidRoleToken(t: string): boolean {
  if (hasControlChar(t)) return false;
  if (t.length > MAX_ROLE_LENGTH) return false;
  return true;
}

/**
 * Parse a CSV env var with per-token validation.
 * Returns null  → env var not set or oversized → caller should use defaults
 * Returns []    → env var is set but empty/invalid token → fail-closed (deny all)
 * Returns [...] → valid token list
 */
function parseCsvEnv(value: unknown, tokenValidator: (t: string) => boolean): string[] | null {
  if (typeof value !== 'string') return null;
  if (value.length > MAX_CSV_ENV_LENGTH) return null;
  const tokens = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return [];
  for (const t of tokens) {
    if (!tokenValidator(t)) return [];
  }
  return tokens;
}

function normalizeRole(role: string): string {
  const normalized = role.trim().toUpperCase();
  if (normalized === 'SUPER_ADMIN' || normalized === 'OWNER') return 'SUPERADMIN';
  if (normalized === 'ADMINISTRATOR') return 'ADMIN';
  return normalized;
}

function emailDomain(email: string): string {
  const atIdx = email.indexOf('@');
  return email
    .slice(atIdx + 1)
    .trim()
    .toLowerCase();
}

function isInternalToolsEnabled(): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return true;
  return (process.env.INTERNAL_TOOLS_ENABLED ?? '').trim() === 'true';
}

export function requireInternalToolsAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!isInternalToolsEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // --- Email accessor (may throw for getter traps) ---
  let rawEmail: unknown;
  try {
    rawEmail = req.user?.email;
  } catch {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!isValidEmailString(rawEmail)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const email = rawEmail;

  // --- Role accessor ---
  let rawRole: unknown;
  try {
    rawRole = (req.user as any)?.role;
  } catch {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!isValidRoleString(rawRole)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const role = rawRole;

  // --- OrgId accessor (organizationId, with legacy fallback) ---
  let rawOrgId: string;
  try {
    rawOrgId = String((req.user as any)?.organizationId ?? '');
  } catch {
    rawOrgId = '';
  }
  if (!rawOrgId) {
    try {
      rawOrgId = String((req.user as any)?.organization_id ?? req.organizationId ?? '');
    } catch {
      rawOrgId = String(req.organizationId ?? '');
    }
  }
  const orgId = rawOrgId.trim().toLowerCase();

  // Validate orgId itself
  if (orgId && !isValidOrgIdToken(orgId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // --- Parse env allowlists ---
  const domainsResult = parseCsvEnv(
    process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS,
    isValidDomainToken
  );
  const allowedDomains: string[] =
    domainsResult === null ? DEFAULT_ALLOWED_EMAIL_DOMAINS : domainsResult;

  const rolesResult = parseCsvEnv(process.env.INTERNAL_TOOLS_ALLOWED_ROLES, isValidRoleToken);
  const allowedRoles: string[] =
    rolesResult === null
      ? DEFAULT_ALLOWED_ROLES.map((r) => r.toUpperCase())
      : rolesResult.map((r) => r.toUpperCase());

  const orgIdsResult = parseCsvEnv(process.env.INTERNAL_TOOLS_ALLOWED_ORG_IDS, isValidOrgIdToken);
  // null → allow all (no org restriction), [] → deny all
  const hasAllowedOrg =
    orgIdsResult === null ? true : orgIdsResult.length === 0 ? false : orgIdsResult.includes(orgId);

  const hasAllowedDomain = allowedDomains.length > 0 && allowedDomains.includes(emailDomain(email));
  const hasAllowedRole = allowedRoles.includes(normalizeRole(role));

  if (!hasAllowedDomain || !hasAllowedRole || !hasAllowedOrg) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  next();
}
