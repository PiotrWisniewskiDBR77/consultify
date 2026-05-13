import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

const DEFAULT_ALLOWED_EMAIL_DOMAINS = ['dbr77.com'];
const DEFAULT_ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN', 'OWNER'];
const MAX_INTERNAL_TOOLS_EMAIL_CHARS = 254;
const MAX_INTERNAL_TOOLS_EMAIL_LOCAL_PART_CHARS = 64;
const MAX_INTERNAL_TOOLS_ORG_ID_CHARS = 128;
const MAX_INTERNAL_TOOLS_ROLE_CHARS = 64;
const MAX_INTERNAL_TOOLS_EMAIL_DOMAIN_CHARS = 253;
const MAX_INTERNAL_TOOLS_ALLOWED_ROLE_TOKEN_CHARS = 64;
const MAX_INTERNAL_TOOLS_ENV_CSV_CHARS = 4096;
const INTERNAL_TOOLS_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const INTERNAL_TOOLS_ASCII_DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const INTERNAL_TOOLS_ORG_ID_TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function normalizeOptionalString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function csv(value: unknown, fallback: string[]): string[] {
  const raw = typeof value === 'string' ? value : '';
  if (raw.length > MAX_INTERNAL_TOOLS_ENV_CSV_CHARS) {
    return fallback;
  }
  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function normalizeRole(role?: string | null): string {
  if (role != null && typeof role !== 'string') return '';
  const normalized = String(role || '')
    .trim()
    .toUpperCase();

  if (normalized === 'SUPER_ADMIN' || normalized === 'OWNER') return 'SUPERADMIN';
  if (normalized === 'ADMINISTRATOR') return 'ADMIN';
  return normalized;
}

function emailDomain(email?: string | null): string {
  return String(email || '')
    .split('@')
    .pop()
    ?.trim()
    .toLowerCase() || '';
}

function hasPlausibleMailboxHost(email: string): boolean {
  const firstAtIndex = email.indexOf('@');
  const atIndex = email.lastIndexOf('@');
  if (firstAtIndex !== atIndex) return false;
  if (atIndex <= 0 || atIndex >= email.length - 1) return false;
  const localPart = email.slice(0, atIndex).trim();
  const hostPart = email.slice(atIndex + 1).trim();
  const isHostMalformed =
    /\s/.test(hostPart) || hostPart.includes('..') || hostPart.startsWith('.') || hostPart.endsWith('.');
  return localPart.length > 0 && hostPart.length > 0 && !isHostMalformed;
}
function isAsciiDnsLikeDomain(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('.') || value.endsWith('.') || value.startsWith('-') || value.endsWith('-')) {
    return false;
  }
  if (value.includes('..')) return false;
  return INTERNAL_TOOLS_ASCII_DOMAIN_PATTERN.test(value);
}
function isSafeOrgIdToken(value: string): boolean {
  if (!value) return false;
  return INTERNAL_TOOLS_ORG_ID_TOKEN_PATTERN.test(value);
}

function readOrganizationId(req: AuthRequest): string {
  const user = safeRead(() => req.user, undefined as unknown as AuthRequest['user']);
  const fromPrimary = normalizeOptionalString(
    safeRead(() => user?.organizationId, undefined as unknown)
  );
  if (fromPrimary) return fromPrimary.toLowerCase();

  const fromLegacy = normalizeOptionalString(
    safeRead(() => (user as { organization_id?: string } | undefined)?.organization_id, undefined as unknown)
  );
  if (fromLegacy) return fromLegacy.toLowerCase();

  return normalizeOptionalString(safeRead(() => req.organizationId, undefined as unknown)).toLowerCase();
}

function isInternalToolsEnabled(): boolean {
  const nodeEnv = normalizeOptionalString(safeRead(() => process.env.NODE_ENV, ''));
  if (nodeEnv === 'development' || nodeEnv === 'test') return true;
  return normalizeOptionalString(safeRead(() => process.env.INTERNAL_TOOLS_ENABLED, '')) === 'true';
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

  const user = safeRead(() => req.user, undefined as unknown as AuthRequest['user']);
  const userEmail = normalizeOptionalString(safeRead(() => user?.email, undefined as unknown));
  if (!userEmail) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (userEmail.length > MAX_INTERNAL_TOOLS_EMAIL_CHARS || /[\u0000-\u001F\u007F]/.test(userEmail)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (/\s/.test(userEmail)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!hasPlausibleMailboxHost(userEmail)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const atIndex = userEmail.lastIndexOf('@');
  const localPart = atIndex > 0 ? userEmail.slice(0, atIndex) : '';
  if (localPart.length > MAX_INTERNAL_TOOLS_EMAIL_LOCAL_PART_CHARS) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const mailboxDomain = emailDomain(userEmail);
  if (
    mailboxDomain.length === 0 ||
    mailboxDomain.length > MAX_INTERNAL_TOOLS_EMAIL_DOMAIN_CHARS ||
    !isAsciiDnsLikeDomain(mailboxDomain)
  ) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const allowedDomains = csv(
    safeRead(() => process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS, undefined),
    DEFAULT_ALLOWED_EMAIL_DOMAINS
  );
  const allowedRoles = csv(
    safeRead(() => process.env.INTERNAL_TOOLS_ALLOWED_ROLES, undefined),
    DEFAULT_ALLOWED_ROLES
  ).map((role) => role.toUpperCase());
  const allowedOrgIds = csv(
    safeRead(() => process.env.INTERNAL_TOOLS_ALLOWED_ORG_IDS, undefined),
    []
  );
  if (
    allowedDomains.some(
      (allowedDomain) =>
        allowedDomain.length > MAX_INTERNAL_TOOLS_EMAIL_DOMAIN_CHARS ||
        INTERNAL_TOOLS_CONTROL_CHARS.test(allowedDomain) ||
        !isAsciiDnsLikeDomain(allowedDomain)
    )
  ) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (
    allowedRoles.some(
      (allowedRole) =>
        allowedRole.length > MAX_INTERNAL_TOOLS_ALLOWED_ROLE_TOKEN_CHARS ||
        INTERNAL_TOOLS_CONTROL_CHARS.test(allowedRole)
    )
  ) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (
    allowedOrgIds.some(
      (allowedOrgId) =>
        allowedOrgId.length > MAX_INTERNAL_TOOLS_ORG_ID_CHARS ||
        INTERNAL_TOOLS_CONTROL_CHARS.test(allowedOrgId) ||
        !isSafeOrgIdToken(allowedOrgId)
    )
  ) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const orgId = readOrganizationId(req);
  if (
    orgId &&
    (orgId.length > MAX_INTERNAL_TOOLS_ORG_ID_CHARS ||
      INTERNAL_TOOLS_CONTROL_CHARS.test(orgId) ||
      !isSafeOrgIdToken(orgId))
  ) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const roleRaw = safeRead(() => user?.role, undefined as unknown);
  if (typeof roleRaw === 'string' && roleRaw.length > MAX_INTERNAL_TOOLS_ROLE_CHARS) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const hasAllowedOrg = allowedOrgIds.length === 0 || allowedOrgIds.includes(orgId);
  const hasAllowedDomain = allowedDomains.includes(mailboxDomain);
  const hasAllowedRole = allowedRoles.includes(normalizeRole(roleRaw as string | null | undefined));

  if (!hasAllowedDomain || !hasAllowedRole || !hasAllowedOrg) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  next();
}
